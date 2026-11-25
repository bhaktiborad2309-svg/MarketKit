package market

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/marketkit/api/internal/database"
	"github.com/marketkit/api/internal/models"
	"github.com/marketkit/api/pkg/response"
)

type marketPlanWithStats struct {
	models.MarketPlan
	Subscribers int64 `json:"subscribers"`
}

// HandleAdminListMarketPlans godoc
// @Summary     List all Product Market plans with subscriber counts (admin)
// @Tags        Admin Market Plans
// @Produce     json
// @Security    AdminAuth
// @Success     200  {object}  []marketPlanWithStats
// @Router      /market/plans [get]
func HandleAdminListMarketPlans(c *fiber.Ctx) error {
	var result []marketPlanWithStats
	if err := database.DB.Raw(`
		SELECT market_plans.*, COALESCE(s.cnt, 0) AS subscribers
		FROM market_plans
		LEFT JOIN (
			SELECT plan_id, COUNT(*) AS cnt
			FROM market_plan_subscriptions
			WHERE status = ?
			GROUP BY plan_id
		) s ON s.plan_id = market_plans.id
		ORDER BY market_plans.created_at DESC
	`, models.SubscriptionActive).Scan(&result).Error; err != nil {
		return response.InternalError(c, "failed to fetch market plans")
	}
	if result == nil {
		result = []marketPlanWithStats{}
	}
	return response.OK(c, result)
}

// HandleAdminCreateMarketPlan godoc
// @Summary     Create a Product Market plan (admin)
// @Tags        Admin Market Plans
// @Produce     json
// @Security    AdminAuth
// @Router      /market/plans [post]
func HandleAdminCreateMarketPlan(c *fiber.Ctx) error {
	var body struct {
		Name           string `json:"name"`
		Description    string `json:"description"`
		PriceMinor     int64  `json:"price_minor"`
		DurationDays   int    `json:"duration_days"`
		FeeDiscountPct int    `json:"fee_discount_pct"`
		FeaturedSeller bool   `json:"featured_seller"`
	}
	if err := c.BodyParser(&body); err != nil {
		return response.BadRequest(c, "invalid request body")
	}
	if body.Name == "" {
		return response.BadRequest(c, "plan name is required")
	}
	if body.PriceMinor <= 0 {
		return response.BadRequest(c, "price must be greater than 0")
	}
	if body.DurationDays <= 0 {
		body.DurationDays = 30
	}
	if body.FeeDiscountPct < 0 || body.FeeDiscountPct > 100 {
		return response.BadRequest(c, "fee_discount_pct must be between 0 and 100")
	}

	plan := models.MarketPlan{
		Name:           body.Name,
		Description:    body.Description,
		PriceMinor:     body.PriceMinor,
		DurationDays:   body.DurationDays,
		FeeDiscountPct: body.FeeDiscountPct,
		FeaturedSeller: body.FeaturedSeller,
		IsActive:       true,
	}
	if err := database.DB.Create(&plan).Error; err != nil {
		if database.IsUniqueViolation(err) {
			return response.BadRequest(c, "a market plan with this name already exists")
		}
		return response.InternalError(c, "failed to create market plan")
	}
	return response.Created(c, marketPlanWithStats{MarketPlan: plan, Subscribers: 0})
}

// HandleAdminUpdateMarketPlan godoc
// @Summary     Update a Product Market plan (admin)
// @Tags        Admin Market Plans
// @Produce     json
// @Security    AdminAuth
// @Param       id  path  string  true  "Plan ID"
// @Router      /market/plans/{id} [put]
func HandleAdminUpdateMarketPlan(c *fiber.Ctx) error {
	var plan models.MarketPlan
	if err := database.DB.First(&plan, "id = ?", c.Params("id")).Error; err != nil {
		return response.NotFound(c, "market plan not found")
	}

	var body struct {
		Name           *string `json:"name"`
		Description    *string `json:"description"`
		PriceMinor     *int64  `json:"price_minor"`
		DurationDays   *int    `json:"duration_days"`
		FeeDiscountPct *int    `json:"fee_discount_pct"`
		FeaturedSeller *bool   `json:"featured_seller"`
		IsActive       *bool   `json:"is_active"`
	}
	if err := c.BodyParser(&body); err != nil {
		return response.BadRequest(c, "invalid request body")
	}

	updates := map[string]interface{}{}
	if body.Name != nil {
		updates["name"] = *body.Name
	}
	if body.Description != nil {
		updates["description"] = *body.Description
	}
	if body.PriceMinor != nil {
		if *body.PriceMinor <= 0 {
			return response.BadRequest(c, "price must be greater than 0")
		}
		updates["price_minor"] = *body.PriceMinor
	}
	if body.DurationDays != nil {
		if *body.DurationDays <= 0 {
			return response.BadRequest(c, "duration must be greater than 0 days")
		}
		updates["duration_days"] = *body.DurationDays
	}
	if body.FeeDiscountPct != nil {
		if *body.FeeDiscountPct < 0 || *body.FeeDiscountPct > 100 {
			return response.BadRequest(c, "fee_discount_pct must be between 0 and 100")
		}
		updates["fee_discount_pct"] = *body.FeeDiscountPct
	}
	if body.FeaturedSeller != nil {
		updates["featured_seller"] = *body.FeaturedSeller
	}
	if body.IsActive != nil {
		updates["is_active"] = *body.IsActive
	}

	if err := database.DB.Model(&plan).Updates(updates).Error; err != nil {
		return response.InternalError(c, "failed to update market plan")
	}
	database.DB.First(&plan, "id = ?", plan.ID)
	return response.OK(c, plan)
}

// HandleAdminDeleteMarketPlan godoc
// @Summary     Delete a Product Market plan (admin)
// @Tags        Admin Market Plans
// @Produce     json
// @Security    AdminAuth
// @Param       id  path  string  true  "Plan ID"
// @Router      /market/plans/{id} [delete]
func HandleAdminDeleteMarketPlan(c *fiber.Ctx) error {
	var plan models.MarketPlan
	if err := database.DB.First(&plan, "id = ?", c.Params("id")).Error; err != nil {
		return response.NotFound(c, "market plan not found")
	}

	var activeSubscribers int64
	database.DB.Model(&models.MarketPlanSubscription{}).
		Where("plan_id = ? AND status = ?", plan.ID, models.SubscriptionActive).
		Count(&activeSubscribers)
	if activeSubscribers > 0 {
		return response.BadRequest(c, "cannot delete a plan with active subscribers")
	}

	if err := database.DB.Delete(&models.MarketPlan{}, "id = ?", plan.ID).Error; err != nil {
		return response.InternalError(c, "failed to delete market plan")
	}
	return response.OK(c, fiber.Map{"message": "market plan deleted"})
}

type marketPlanPaymentRow struct {
	ID                string     `json:"id"`
	UserID            string     `json:"user_id"`
	PlanID            string     `json:"plan_id"`
	Status            string     `json:"status"`
	StartDate         time.Time  `json:"start_date"`
	ExpiryDate        time.Time  `json:"expiry_date"`
	AmountMinor       int64      `json:"amount_minor"`
	ProviderOrderID   *string    `json:"provider_order_id,omitempty"`
	ProviderPaymentID *string    `json:"provider_payment_id,omitempty"`
	PaidAt            *time.Time `json:"paid_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	Provider          string     `json:"provider"`
	User              *struct {
		ID    string `json:"id"`
		Name  string `json:"name"`
		Email string `json:"email"`
	} `json:"user,omitempty"`
	Plan *struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"plan,omitempty"`
}

// HandleAdminListMarketPlanPayments godoc
// @Summary     List Product Market plan subscription payments (admin)
// @Tags        Admin Market Plans
// @Produce     json
// @Security    AdminAuth
// @Param       page    query  int     false  "Page"
// @Param       limit   query  int     false  "Limit"
// @Param       search  query  string  false  "Search user name or email"
// @Param       status  query  string  false  "ACTIVE|EXPIRED|CANCELLED|PENDING"
// @Success     200  {object}  map[string]interface{}
// @Router      /market/plan-payments [get]
func HandleAdminListMarketPlanPayments(c *fiber.Ctx) error {
	page, limit, _ := response.PageParams(c)

	q := database.DB.Model(&models.MarketPlanSubscription{}).
		Preload("User").Preload("Plan")

	// Default: paid subscriptions only (exclude unpaid PENDING orders).
	if st := c.Query("status"); st != "" {
		q = q.Where("market_plan_subscriptions.status = ?", st)
	} else {
		q = q.Where(
			"market_plan_subscriptions.paid_at IS NOT NULL OR market_plan_subscriptions.status IN ?",
			[]string{
				string(models.SubscriptionActive),
				string(models.SubscriptionExpired),
				string(models.SubscriptionCancelled),
			},
		)
	}

	if s := c.Query("search"); s != "" {
		q = q.Joins("JOIN users ON users.id = market_plan_subscriptions.user_id").
			Where("users.name ILIKE ? OR users.email ILIKE ?", "%"+s+"%", "%"+s+"%")
	}

	var total int64
	q.Count(&total)

	var subs []models.MarketPlanSubscription
	if err := q.Offset((page - 1) * limit).Limit(limit).
		Order("market_plan_subscriptions.created_at DESC").
		Find(&subs).Error; err != nil {
		return response.InternalError(c, "failed to fetch market plan payments")
	}

	rows := make([]marketPlanPaymentRow, 0, len(subs))
	for _, sub := range subs {
		gateway := "WALLET"
		if sub.ProviderPaymentID != nil && *sub.ProviderPaymentID != "" {
			gateway = "RAZORPAY"
		}
		row := marketPlanPaymentRow{
			ID:                sub.ID,
			UserID:            sub.UserID,
			PlanID:            sub.PlanID,
			Status:            string(sub.Status),
			StartDate:         sub.StartDate,
			ExpiryDate:        sub.ExpiryDate,
			AmountMinor:       sub.AmountMinor,
			ProviderOrderID:   sub.ProviderOrderID,
			ProviderPaymentID: sub.ProviderPaymentID,
			PaidAt:            sub.PaidAt,
			CreatedAt:         sub.CreatedAt,
			Provider:          gateway,
		}
		if sub.User.ID != "" {
			row.User = &struct {
				ID    string `json:"id"`
				Name  string `json:"name"`
				Email string `json:"email"`
			}{ID: sub.User.ID, Name: sub.User.Name, Email: sub.User.Email}
		}
		if sub.Plan.ID != "" {
			row.Plan = &struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			}{ID: sub.Plan.ID, Name: sub.Plan.Name}
		}
		rows = append(rows, row)
	}

	return response.Paginated(c, rows, response.MetaFor(page, limit, total))
}
