package internal

import (
	"github.com/gofiber/fiber/v2"
	"github.com/marketkit/api/internal/middleware"
	"github.com/marketkit/api/internal/modules/admins"
	"github.com/marketkit/api/internal/modules/audit_logs"
	"github.com/marketkit/api/internal/modules/auth"
	"github.com/marketkit/api/internal/modules/dashboard"
	"github.com/marketkit/api/internal/modules/market"
	"github.com/marketkit/api/internal/modules/notifications"
	"github.com/marketkit/api/internal/modules/plans"
	"github.com/marketkit/api/internal/modules/platform_wallet"
	"github.com/marketkit/api/internal/modules/refunds"
	"github.com/marketkit/api/internal/modules/revenue"
	"github.com/marketkit/api/internal/modules/sessions"
	"github.com/marketkit/api/internal/modules/users"
	"github.com/marketkit/api/internal/modules/wallet"
)

// registerAdminRoutes mounts everything behind the admin JWT (middleware.Authenticate),
// plus the admin login endpoints that issue that JWT in the first place.
func registerAdminRoutes(v1 fiber.Router) {
	// ── Admin Auth (/auth) ────────────────────────────────────────────────────
	a := v1.Group("/auth")
	a.Post("/register", otpLimiter, auth.HandleRegister)
	a.Post("/send-otp", otpLimiter, auth.HandleSendOTP)
	a.Post("/verify-otp", otpVerifyLimiter, auth.HandleVerifyOTP)
	a.Post("/refresh", refreshLimiter, auth.HandleRefresh)
	a.Post("/logout", auth.HandleLogout)
	a.Get("/me", middleware.Authenticate, auth.HandleMe)
	a.Patch("/me", middleware.Authenticate, auth.HandleUpdateProfile)
	a.Post("/avatar", middleware.Authenticate, adminAvatarLimiter, auth.HandleUploadAvatar)
	a.Delete("/avatar", middleware.Authenticate, auth.HandleDeleteAvatar)
	a.Post("/change-password", middleware.Authenticate, adminChangePasswordLimiter, auth.HandleChangePassword)
	a.Get("/google", auth.HandleGoogleLogin)
	a.Get("/google/callback", auth.HandleGoogleCallback)

	// ── Admin: Users (/users) ─────────────────────────────────────────────────
	u := v1.Group("/users", middleware.Authenticate)
	u.Get("/", users.HandleList)
	u.Post("/send-otp", otpLimiter, users.HandleSendUserOTP)
	u.Post("/verify-otp", otpVerifyLimiter, users.HandleVerifyUserOTP)
	u.Post("/", users.HandleCreate)
	u.Get("/:id", users.HandleGet)
	u.Patch("/:id", users.HandleUpdate)
	u.Delete("/:id", users.HandleDelete)
	u.Post("/:id/force-logout", users.HandleForceLogout)
	u.Patch("/:id/suspend", users.HandleSuspend)
	u.Post("/:id/change-plan", users.HandleChangePlan)
	u.Post("/:id/assign-free-plan", users.HandleAssignFreePlan)
	u.Post("/:id/cancel-free-plan", users.HandleCancelFreePlan)

	// ── Admin: Admin accounts (/admins) ─────────────────────────────────────────────────
	ad := v1.Group("/admins", middleware.Authenticate)
	ad.Get("/", admins.HandleList)
	ad.Post("/", admins.HandleCreate)
	ad.Delete("/:id", admins.HandleDelete)
	ad.Patch("/:id/super", admins.HandleSetSuper)

	// ── Admin: Plans (/plans) ─────────────────────────────────────────────────
	v1.Get("/plans/public", plans.HandlePublicList)
	pl := v1.Group("/plans", middleware.Authenticate)
	pl.Get("/", plans.HandleList)
	pl.Post("/", plans.HandleCreate)
	pl.Patch("/:id", plans.HandleUpdate)
	pl.Delete("/:id", plans.HandleDelete)

	// ── Admin: Refund Requests (/refunds) ─────────────────────────────────────
	rf := v1.Group("/refunds", middleware.Authenticate)
	rf.Get("/", refunds.HandleList)
	rf.Post("/:id/approve", refunds.HandleApprove)
	rf.Post("/:id/reject", refunds.HandleReject)

	// ── Admin: Sessions (/sessions) ───────────────────────────────────────────
	s := v1.Group("/sessions", middleware.Authenticate)
	s.Get("/", sessions.HandleList)
	s.Post("/backfill-locations", sessions.HandleBackfillLocations)
	s.Delete("/", sessions.HandleRevokeAll)
	s.Delete("/:id", sessions.HandleRevoke)

	// ── Admin: Audit Logs (/audit-logs) ───────────────────────────────────────
	al := v1.Group("/audit-logs", middleware.Authenticate)
	al.Get("/", audit_logs.HandleList)

	// ── Admin: Dashboard (/dashboard) ─────────────────────────────────────────
	d := v1.Group("/dashboard", middleware.Authenticate)
	d.Get("/stats", dashboard.HandleStats)
	d.Get("/recent-payments", dashboard.HandleRecentPayments)
	d.Get("/recent-activity", dashboard.HandleRecentActivity)
	d.Get("/user-growth", dashboard.HandleUserGrowth)
	d.Get("/plan-distribution", dashboard.HandlePlanDistribution)

	// ── Admin: Revenue (/revenue) ─────────────────────────────────────────────
	r := v1.Group("/revenue", middleware.Authenticate)
	r.Get("/summary", revenue.HandleSummary)
	r.Get("/monthly", revenue.HandleMonthly)
	r.Get("/by-plan", revenue.HandleByPlan)
	r.Get("/forecast", revenue.HandleForecast)
	r.Get("/renewal-stats", revenue.HandleRenewalStats)

	// ── Admin: Notifications (/admin/notifications) ───────────────────────────
	n := v1.Group("/admin/notifications", middleware.Authenticate)
	n.Get("/", notifications.HandleListNotifications)
	n.Post("/broadcast", notifications.HandleBroadcast)
	n.Delete("/", notifications.HandleClearNotifications)
	n.Delete("/:id", notifications.HandleDeleteNotification)

	// ── Admin: Product Market (/market) ────────────────────────────────────────
	am := v1.Group("/market", middleware.Authenticate)
	am.Get("/products", market.HandleAdminListProducts)
	am.Delete("/products/:id", market.HandleAdminDeleteProduct)
	am.Get("/categories", market.HandleAdminListCategories)
	am.Post("/categories", market.HandleAdminCreateCategory)
	am.Put("/categories/:id", market.HandleAdminUpdateCategory)
	am.Post("/categories/:id/photo", market.HandleAdminUploadCategoryPhoto)
	am.Delete("/categories/:id", market.HandleAdminDeleteCategory)
	am.Get("/purchases", market.HandleAdminListPurchases)
	am.Get("/purchases/:id/messages", market.HandleAdminListPurchaseMessages)
	am.Post("/purchases/:id/messages", market.HandleAdminReplyPurchaseMessage)
	am.Get("/users", market.HandleAdminListMarketUsers)
	am.Get("/users/:id/products", market.HandleAdminMarketUserProducts)
	am.Get("/plans", market.HandleAdminListMarketPlans)
	am.Post("/plans", market.HandleAdminCreateMarketPlan)
	am.Put("/plans/:id", market.HandleAdminUpdateMarketPlan)
	am.Delete("/plans/:id", market.HandleAdminDeleteMarketPlan)
	am.Get("/plan-payments", market.HandleAdminListMarketPlanPayments)
	am.Get("/revenue/summary", market.HandleMarketRevenueSummary)
	am.Get("/revenue/monthly", market.HandleMarketRevenueMonthly)

	// ── Admin: Wallet (/wallet) ───────────────────────────────────────────────
	aw := v1.Group("/wallet", middleware.Authenticate)
	aw.Get("/withdrawals", wallet.HandleAdminListWithdrawals)
	aw.Post("/withdrawals/:id/settle", wallet.HandleAdminSettle)
	aw.Get("/users/:id/transactions", wallet.HandleAdminUserTransactions)
	aw.Get("/settings", wallet.HandleGetSettings)
	aw.Put("/settings", wallet.HandleUpdateSettings)

	// ── Admin: Platform Wallet (/platform-wallet) — super-admin only ─────────
	pw := v1.Group("/platform-wallet", middleware.Authenticate)
	pw.Get("/", platform_wallet.HandleGet)
	pw.Get("/transactions", platform_wallet.HandleTransactions)
	pw.Post("/withdrawals", platform_wallet.HandleCreateWithdrawal)
}
