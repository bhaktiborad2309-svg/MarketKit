package market

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/marketkit/api/internal/config"
	"github.com/marketkit/api/internal/database"
	"github.com/marketkit/api/internal/models"
	"github.com/marketkit/api/internal/modules/platform_wallet"
	"github.com/marketkit/api/internal/modules/wallet"
	"github.com/marketkit/api/internal/payments"
	"github.com/marketkit/api/internal/payments/provider"
	"github.com/marketkit/api/pkg/response"
	"gorm.io/gorm"
)

// sellerFeePercent returns the platform's cut on this seller's sales, after any
// discount their active market plan grants.
//
// FeeDiscountPct is a percentage off the fee, not off the price: at a 10% base
// fee, a plan with fee_discount_pct=20 leaves the seller paying 8%, not -10%.
func sellerFeePercent(sellerID string) int64 {
	base := wallet.FeePercent()
	discount := activeSellerFeeDiscount(sellerID)
	if discount <= 0 {
		return base
	}
	if discount > 100 {
		discount = 100
	}
	// Knocks off: effective = base * (100 - discount) / 100
	return base * int64(100-discount) / 100
}

// activeSellerFeeDiscount returns FeeDiscountPct for the seller's ACTIVE
// market plan subscription, or 0 if none.
func activeSellerFeeDiscount(sellerID string) int {
	type row struct {
		FeeDiscountPct int
	}
	var r row
	err := database.DB.Table("market_plan_subscriptions").
		Select("market_plans.fee_discount_pct").
		Joins("JOIN market_plans ON market_plans.id = market_plan_subscriptions.plan_id").
		Where("market_plan_subscriptions.user_id = ? AND market_plan_subscriptions.status = ? AND market_plan_subscriptions.expiry_date > ?",
			sellerID, models.SubscriptionActive, time.Now()).
		Order("market_plan_subscriptions.expiry_date DESC").
		Limit(1).
		Scan(&r).Error
	if err != nil {
		return 0
	}
	return r.FeeDiscountPct
}

// activeFeaturedSellerIDs returns user IDs among the given set that currently
// have an ACTIVE market plan with FeaturedSeller=true.
func activeFeaturedSellerIDs(userIDs []string) map[string]bool {
	out := map[string]bool{}
	if len(userIDs) == 0 {
		return out
	}
	var ids []string
	database.DB.Table("market_plan_subscriptions").
		Select("DISTINCT market_plan_subscriptions.user_id").
		Joins("JOIN market_plans ON market_plans.id = market_plan_subscriptions.plan_id").
		Where("market_plan_subscriptions.user_id IN ? AND market_plan_subscriptions.status = ? AND market_plan_subscriptions.expiry_date > ? AND market_plans.featured_seller = ?",
			userIDs, models.SubscriptionActive, time.Now(), true).
		Pluck("market_plan_subscriptions.user_id", &ids)
	for _, id := range ids {
		out[id] = true
	}
	return out
}

// HandleGetSellerFee returns the platform fee percent for the current user
// as a seller, applying FeeDiscountPct from their ACTIVE market plan if any.
func HandleGetSellerFee(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	return response.OK(c, fiber.Map{"fee_percent": sellerFeePercent(userID)})
}

// HandleListMarketPlans godoc
// @Summary     List active Product Market plans
// @Tags        User Market Plans
// @Produce     json
// @Security    UserAuth
// @Success     200  {object}  []models.MarketPlan
// @Router      /user/market/plans [get]
func HandleListMarketPlans(c *fiber.Ctx) error {
	var plans []models.MarketPlan
	if err := database.DB.Where("is_active = true").Order("price_minor ASC").Find(&plans).Error; err != nil {
		return response.InternalError(c, "failed to fetch market plans")
	}
	if plans == nil {
		plans = []models.MarketPlan{}
	}
	return response.OK(c, plans)
}

// HandleMyMarketPlan godoc
// @Summary     Current user's active Product Market plan subscription
// @Tags        User Market Plans
// @Produce     json
// @Security    UserAuth
// @Success     200  {object}  models.MarketPlanSubscription
// @Router      /user/market/plans/my [get]
func HandleMyMarketPlan(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)

	var sub models.MarketPlanSubscription
	err := database.DB.Preload("Plan").
		Where("user_id = ? AND status = ? AND expiry_date > ?", userID, models.SubscriptionActive, time.Now()).
		Order("expiry_date DESC").
		First(&sub).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return response.OK(c, nil)
		}
		return response.InternalError(c, "failed to fetch subscription")
	}
	return response.OK(c, sub)
}

// HandleCancelMyMarketPlan godoc
// @Summary     Cancel the current user's active Product Market plan (no refund)
// @Tags        User Market Plans
// @Produce     json
// @Security    UserAuth
// @Success     200  {object}  map[string]string
// @Failure     400  {object}  map[string]string
// @Router      /user/market/plans/my [delete]
func HandleCancelMyMarketPlan(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)

	var sub models.MarketPlanSubscription
	err := database.DB.
		Where("user_id = ? AND status = ? AND expiry_date > ?", userID, models.SubscriptionActive, time.Now()).
		Order("expiry_date DESC").
		First(&sub).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return response.BadRequest(c, "no active market plan to cancel")
		}
		return response.InternalError(c, "failed to fetch subscription")
	}

	result := database.DB.Model(&models.MarketPlanSubscription{}).
		Where("id = ? AND status = ?", sub.ID, models.SubscriptionActive).
		Update("status", models.SubscriptionCancelled)
	if result.Error != nil {
		return response.InternalError(c, "failed to cancel subscription")
	}
	if result.RowsAffected == 0 {
		return response.BadRequest(c, "no active market plan to cancel")
	}

	return response.OK(c, fiber.Map{"message": "market plan cancelled", "subscription_id": sub.ID})
}

// HandleCreateMarketPlanOrder godoc
// @Summary     Create a Razorpay order for a Product Market plan
// @Tags        User Market Plans
// @Produce     json
// @Security    UserAuth
// @Param       id  path  string  true  "Market Plan ID"
// @Success     200  {object}  map[string]interface{}
// @Router      /user/market/plans/{id}/order [post]
func HandleCreateMarketPlanOrder(c *fiber.Ctx) error {
	planID := c.Params("id")
	userID, _ := c.Locals("userID").(string)

	var plan models.MarketPlan
	if err := database.DB.First(&plan, "id = ? AND is_active = true", planID).Error; err != nil {
		return response.NotFound(c, "market plan not found")
	}

	var activeCount int64
	database.DB.Model(&models.MarketPlanSubscription{}).
		Where("user_id = ? AND status = ? AND expiry_date > ?", userID, models.SubscriptionActive, time.Now()).
		Count(&activeCount)
	if activeCount > 0 {
		return response.BadRequest(c, "you already have an active market plan")
	}

	if config.App.RazorpayKeyID == "" || config.App.RazorpayKeySecret == "" ||
		config.App.RazorpayKeyID == "rzp_test_xxxx" || config.App.RazorpayKeySecret == "xxxx" {
		return response.InternalError(c, "razorpay is not configured on the server")
	}

	order, err := createMarketPlanRazorpayOrder(plan.PriceMinor, userID, plan.ID)
	if err != nil {
		slog.Error("market plans: razorpay order creation failed", "error", err, "user_id", userID, "plan_id", plan.ID)
		return response.InternalError(c, "failed to create payment order")
	}

	sub := models.MarketPlanSubscription{
		UserID:          userID,
		PlanID:          plan.ID,
		Status:          models.SubscriptionPending,
		StartDate:       time.Now(),
		ExpiryDate:      time.Now(), // set on verify
		AmountMinor:     plan.PriceMinor,
		ProviderOrderID: &order.ID,
	}
	if err := database.DB.Create(&sub).Error; err != nil {
		return response.InternalError(c, "failed to create pending subscription")
	}

	return response.OK(c, payments.NewCheckout(order, plan.PriceMinor))
}

// HandleVerifyMarketPlan godoc
// @Summary     Verify Razorpay payment and activate Product Market plan
// @Tags        User Market Plans
// @Accept      json
// @Produce     json
// @Security    UserAuth
// @Param       body  body  map[string]string  true  "provider_order_id, provider_payment_id, provider_signature"
// @Success     200  {object}  map[string]string
// @Router      /user/market/plans/verify [post]
func HandleVerifyMarketPlan(c *fiber.Ctx) error {
	var body struct {
		ProviderOrderID   string `json:"provider_order_id"`
		ProviderPaymentID string `json:"provider_payment_id"`
		ProviderSignature string `json:"provider_signature"`
	}
	if err := c.BodyParser(&body); err != nil {
		return response.BadRequest(c, "invalid request body")
	}
	if body.ProviderOrderID == "" || body.ProviderPaymentID == "" || body.ProviderSignature == "" {
		return response.BadRequest(c, "provider_order_id, provider_payment_id, and provider_signature are required")
	}

	userID, _ := c.Locals("userID").(string)

	msg := body.ProviderOrderID + "|" + body.ProviderPaymentID
	mac := hmac.New(sha256.New, []byte(config.App.RazorpayKeySecret))
	mac.Write([]byte(msg))
	expected := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(body.ProviderSignature), []byte(expected)) {
		return response.BadRequest(c, "invalid razorpay signature")
	}

	var sub models.MarketPlanSubscription
	if err := database.DB.Preload("Plan").
		Where("user_id = ? AND provider_order_id = ?", userID, body.ProviderOrderID).
		First(&sub).Error; err != nil {
		return response.NotFound(c, "pending subscription not found")
	}
	if sub.Status == models.SubscriptionActive {
		return response.OK(c, fiber.Map{"message": "plan already activated", "subscription_id": sub.ID})
	}

	var activeCount int64
	database.DB.Model(&models.MarketPlanSubscription{}).
		Where("user_id = ? AND status = ? AND expiry_date > ? AND id != ?",
			userID, models.SubscriptionActive, time.Now(), sub.ID).
		Count(&activeCount)
	if activeCount > 0 {
		return response.BadRequest(c, "you already have an active market plan")
	}

	if !activateMarketPlanSubscriptionIfPending(&sub, body.ProviderPaymentID) {
		return response.OK(c, fiber.Map{"message": "plan already activated", "subscription_id": sub.ID})
	}

	return response.OK(c, fiber.Map{"message": "market plan activated", "subscription_id": sub.ID})
}

// HandleSubscribeMarketPlanWithWallet godoc
// @Summary     Pay for a Product Market plan using wallet balance
// @Tags        User Market Plans
// @Produce     json
// @Security    UserAuth
// @Param       id  path  string  true  "Market Plan ID"
// @Success     200  {object}  map[string]string
// @Failure     400  {object}  map[string]string
// @Router      /user/market/plans/{id}/wallet [post]
func HandleSubscribeMarketPlanWithWallet(c *fiber.Ctx) error {
	planID := c.Params("id")
	userID, _ := c.Locals("userID").(string)

	var plan models.MarketPlan
	if err := database.DB.First(&plan, "id = ? AND is_active = true", planID).Error; err != nil {
		return response.NotFound(c, "market plan not found")
	}

	var activeCount int64
	database.DB.Model(&models.MarketPlanSubscription{}).
		Where("user_id = ? AND status = ? AND expiry_date > ?", userID, models.SubscriptionActive, time.Now()).
		Count(&activeCount)
	if activeCount > 0 {
		return response.BadRequest(c, "you already have an active market plan")
	}

	now := time.Now()
	expiresAt := marketPlanExpiry(now, plan.DurationDays)

	sub := models.MarketPlanSubscription{
		UserID:      userID,
		PlanID:      plan.ID,
		Status:      models.SubscriptionActive,
		StartDate:   now,
		ExpiryDate:  expiresAt,
		AmountMinor: plan.PriceMinor,
		PaidAt:      &now,
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&sub).Error; err != nil {
			return err
		}
		if _, err := wallet.Apply(tx, userID, models.WalletTxPlanDebit, -plan.PriceMinor,
			&sub.ID, models.JSONMap{"plan_id": plan.ID, "plan_name": plan.Name}); err != nil {
			return err
		}
		_, err := platform_wallet.Apply(tx, models.PlatformSourceMarketPlan, plan.PriceMinor,
			&sub.ID, models.JSONMap{"plan_id": plan.ID, "plan_name": plan.Name, "paid_via": "WALLET"})
		return err
	})
	if err == wallet.ErrInsufficientBalance {
		return response.BadRequest(c, "insufficient wallet balance")
	}
	if err != nil {
		return response.InternalErrorWithLog(c, "market plans: wallet subscribe", err)
	}

	return response.OK(c, fiber.Map{"message": "market plan activated", "subscription_id": sub.ID})
}

func marketPlanExpiry(start time.Time, durationDays int) time.Time {
	if durationDays <= 0 {
		durationDays = 30
	}
	return start.AddDate(0, 0, durationDays)
}

// activateMarketPlanSubscriptionIfPending flips a PENDING market plan
// subscription to ACTIVE, and reports whether this call is the one that did it.
//
// The status != ACTIVE guard makes it idempotent, so the verify endpoint and
// the webhook can both race for the same payment and only one of them wins.
// Callers use the bool to decide whether to send the confirmation — otherwise
// the buyer gets two emails for one purchase.
func activateMarketPlanSubscriptionIfPending(sub *models.MarketPlanSubscription, razorpayPaymentID string) bool {
	now := time.Now()
	expiresAt := marketPlanExpiry(now, sub.Plan.DurationDays)

	activated := false
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&models.MarketPlanSubscription{}).
			Where("id = ? AND status = ?", sub.ID, models.SubscriptionPending).
			Updates(map[string]interface{}{
				"status":              models.SubscriptionActive,
				"provider_payment_id": razorpayPaymentID,
				"paid_at":             now,
				"start_date":          now,
				"expiry_date":         expiresAt,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return nil
		}
		if _, err := platform_wallet.Apply(tx, models.PlatformSourceMarketPlan, sub.AmountMinor,
			&sub.ID, models.JSONMap{"plan_id": sub.PlanID, "paid_via": "RAZORPAY"}); err != nil {
			return err
		}
		activated = true
		return nil
	})
	if err != nil {
		slog.Error("market plans: failed to activate subscription", "subscription_id", sub.ID, "error", err)
		return false
	}
	return activated
}

// CaptureMarketPlanOrder resolves a webhook payment.captured event against
// market_plan_subscriptions. Returns true if a market plan sub was activated.
func CaptureMarketPlanOrder(orderID, razorpayPaymentID string) bool {
	var sub models.MarketPlanSubscription
	if err := database.DB.Preload("Plan").
		Where("provider_order_id = ?", orderID).First(&sub).Error; err != nil {
		return false
	}
	if sub.Status == models.SubscriptionActive {
		return true
	}
	var activeCount int64
	database.DB.Model(&models.MarketPlanSubscription{}).
		Where("user_id = ? AND status = ? AND expiry_date > ? AND id != ?",
			sub.UserID, models.SubscriptionActive, time.Now(), sub.ID).
		Count(&activeCount)
	if activeCount > 0 {
		return true // already has active; ignore duplicate payment
	}
	activateMarketPlanSubscriptionIfPending(&sub, razorpayPaymentID)
	return true
}

func createMarketPlanRazorpayOrder(amountMinor int64, userID, planID string) (provider.Order, error) {
	order, err := payments.CreateOrder(context.Background(), amountMinor,
		payments.Receipt("mp", userID, planID),
		map[string]string{"user_id": userID, "market_plan_id": planID})
	if err != nil {
		return provider.Order{}, err
	}
	return order, nil
}
