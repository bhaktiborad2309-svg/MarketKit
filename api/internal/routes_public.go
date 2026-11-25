package internal

import (
	"github.com/gofiber/fiber/v2"
	"github.com/marketkit/api/internal/middleware"
	"github.com/marketkit/api/internal/modules/app_version"
	"github.com/marketkit/api/internal/modules/payments"
	"github.com/marketkit/api/internal/modules/refunds"
)

// registerPublicRoutes mounts the two groups that deliberately mix
// unauthenticated and admin routes under one prefix: the gateway webhook lives
// alongside the admin payment views, and the app's version check lives
// alongside admin publishing. Splitting either would change the group's
// middleware chain, so they stay whole and stay here.
func registerPublicRoutes(v1 fiber.Router) {
	// ── Admin: Payments (/payments) ───────────────────────────────────────────
	pay := v1.Group("/payments")
	// Gateway webhook. Point your provider's dashboard at /api/v1/payments/webhook.
	// The legacy Razorpay-specific path stays registered so existing gateway
	// configurations keep working after the provider abstraction landed.
	pay.Post("/webhook", payments.HandleWebhook)
	pay.Post("/razorpay-webhook", payments.HandleWebhook)
	payAuth := pay.Use(middleware.Authenticate)
	payAuth.Get("/", payments.HandleList)
	payAuth.Get("/:id", payments.HandleGet)
	payAuth.Post("/manual", payments.HandleManual)
	payAuth.Post("/:id/activate", payments.HandleActivate)
	payAuth.Post("/:id/request-refund", refunds.HandleRequest)

	// ── App Version (public check + admin publish) ────────────────────────────
	v1.Get("/app/version", app_version.HandleGetLatest)
	av := v1.Group("/admin/app-version", middleware.Authenticate)
	av.Post("/", app_version.HandleCreate)
	av.Post("/upload", app_version.HandleUpload)
	// Script-friendly upload: uses X-Publish-Secret header instead of JWT (no expiry).
	// Must NOT be under the /admin/app-version group prefix — that group injects
	// JWT middleware for all sub-paths, which would block PublishSecretAuth.
	v1.Post("/admin/apk/publish", middleware.PublishSecretAuth, app_version.HandleUpload)
}
