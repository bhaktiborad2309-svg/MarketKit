package internal

import (
	"github.com/gofiber/fiber/v2"
	"github.com/marketkit/api/internal/middleware"
	"github.com/marketkit/api/internal/modules/market"
	"github.com/marketkit/api/internal/modules/user_auth"
	"github.com/marketkit/api/internal/modules/user_notifications"
	"github.com/marketkit/api/internal/modules/user_payments"
	"github.com/marketkit/api/internal/modules/wallet"
)

// registerUserRoutes mounts everything behind the end-user JWT
// (middleware.UserAuthenticate), plus the app's own login endpoints.
func registerUserRoutes(v1 fiber.Router) {
	// ── User Auth (/user/auth) ────────────────────────────────────────────────
	ua := v1.Group("/user/auth")
	ua.Post("/register", otpLimiter, user_auth.HandleRegister)
	ua.Post("/forgot-password", otpLimiter, user_auth.HandleForgotPassword)
	ua.Post("/reset-password", resetPasswordLimiter, user_auth.HandleResetPassword)
	ua.Post("/send-otp", otpLimiter, user_auth.HandleSendOTP)
	ua.Post("/verify-otp", otpVerifyLimiter, user_auth.HandleVerifyOTP)
	ua.Post("/google", otpLimiter, user_auth.HandleGoogleLogin)
	ua.Post("/refresh", refreshLimiter, user_auth.HandleRefresh)
	ua.Post("/logout", user_auth.HandleLogout)
	ua.Get("/me", middleware.UserAuthenticate, user_auth.HandleMe)
	ua.Patch("/me", middleware.UserAuthenticate, user_auth.HandleUpdateProfile)
	ua.Delete("/me", middleware.UserAuthenticate, user_auth.HandleDeleteAccount)
	ua.Post("/avatar", middleware.UserAuthenticate, userAvatarLimiter, user_auth.HandleUploadAvatar)
	ua.Delete("/avatar", middleware.UserAuthenticate, user_auth.HandleDeleteAvatar)
	ua.Post("/change-password", middleware.UserAuthenticate, userChangePasswordLimiter, user_auth.HandleChangePassword)
	ua.Get("/device-token", middleware.UserAuthenticate, user_auth.HandleListDeviceTokens)
	ua.Post("/device-token", middleware.UserAuthenticate, user_auth.HandleRegisterDeviceToken)
	ua.Patch("/me/app-mode", middleware.UserAuthenticate, user_auth.HandleSetAppMode)

	// ── User: Payments (/user/payments) ───────────────────────────────────────
	up := v1.Group("/user/payments", middleware.UserAuthenticate)
	up.Post("/order", user_payments.HandleCreateOrder)
	up.Post("/verify", user_payments.HandleVerifyPayment)

	// ── User: Notifications (/user/notifications) ─────────────────────────────
	un := v1.Group("/user/notifications", middleware.UserAuthenticate)
	un.Get("/", user_notifications.HandleList)
	un.Post("/read", user_notifications.HandleMarkAllRead)
	un.Delete("/", user_notifications.HandleClearAll)
	un.Delete("/:id", user_notifications.HandleDeleteOne)

	// ── User: Product Market (/user/market) ────────────────────────────────────
	um := v1.Group("/user/market", middleware.UserAuthenticate)
	um.Get("/products", market.HandleListProducts)
	um.Post("/products", productUploadLimiter, market.HandleCreateProduct)
	// Static sub-paths must be registered before /products/:id to avoid param capture.
	um.Get("/fee", market.HandleGetSellerFee)
	um.Get("/categories", market.HandleListCategories)
	um.Get("/my/products", market.HandleMyProducts)
	um.Get("/my/products/:id/stats", market.HandleMyProductStats)
	um.Get("/my/purchases", market.HandleMyPurchases)
	um.Get("/my/earnings", market.HandleEarnings)
	um.Post("/purchases/order", market.HandleCreatePurchaseOrder)
	um.Post("/purchases/verify", market.HandleVerifyPurchase)
	um.Post("/purchases/wallet", market.HandlePurchaseWithWallet)
	// Product Market Plans (separate from learning /plans)
	um.Get("/plans", market.HandleListMarketPlans)
	um.Get("/plans/my", market.HandleMyMarketPlan)
	um.Delete("/plans/my", market.HandleCancelMyMarketPlan)
	um.Post("/plans/verify", market.HandleVerifyMarketPlan)
	um.Post("/plans/:id/order", market.HandleCreateMarketPlanOrder)
	um.Post("/plans/:id/wallet", market.HandleSubscribeMarketPlanWithWallet)
	um.Get("/products/:id", market.HandleGetProduct)
	um.Delete("/products/:id", market.HandleDeleteProduct)
	um.Get("/products/:id/download-url", market.HandleDownloadURL)
	um.Get("/purchases/:id/invoice", market.HandleDownloadInvoice)
	um.Get("/products/:id/messages", market.HandleListProductMessages)
	um.Post("/products/:id/messages", messageLimiter, market.HandlePostProductMessage)

	// ── User: Wallet (/user/wallet) ───────────────────────────────────────────
	uw := v1.Group("/user/wallet", middleware.UserAuthenticate)
	uw.Get("/", wallet.HandleSummary)
	uw.Get("/transactions", wallet.HandleTransactions)
	uw.Post("/topup/order", wallet.HandleTopupOrder)
	uw.Post("/topup/verify", wallet.HandleTopupVerify)
	uw.Get("/payout-details", wallet.HandleGetPayoutDetails)
	uw.Put("/payout-details", wallet.HandleUpsertPayoutDetails)
	uw.Post("/withdrawals", wallet.HandleCreateWithdrawal)
	uw.Get("/withdrawals", wallet.HandleMyWithdrawals)
}
