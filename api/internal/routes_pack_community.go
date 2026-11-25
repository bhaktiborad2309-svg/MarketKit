package internal

import (
	"github.com/gofiber/fiber/v2"
	"github.com/marketkit/api/internal/middleware"
	"github.com/marketkit/api/internal/modules/community"
)

// Community pack — posts, replies and moderation.
//
// Sold separately. Delete this file and internal/modules/community to build a
// kit without it; nothing in the core points back here.
func init() {
	registerPack(registerCommunityPackRoutes)
}

func registerCommunityPackRoutes(v1 fiber.Router) {
	// ── Admin: Community (/community) ─────────────────────────────────────────
	ac := v1.Group("/community", middleware.Authenticate)
	ac.Get("/posts", community.HandleAdminListPosts)
	ac.Get("/posts/:id", community.HandleAdminGetPost)
	ac.Post("/posts", community.HandleAdminCreatePost)
	ac.Post("/posts/:id/replies", community.HandleAdminCreateReply)
	ac.Patch("/posts/:id", community.HandleAdminUpdatePost)
	ac.Delete("/posts/:id", community.HandleAdminDeletePost)
	ac.Delete("/replies/:id", community.HandleAdminDeleteReply)
	ac.Patch("/posts/:id/flag", community.HandleAdminFlagPost)

	// ── User: Community (/user/community) ─────────────────────────────────────
	uc := v1.Group("/user/community", middleware.UserAuthenticate)
	uc.Get("/posts", community.HandleListPosts)
	uc.Post("/posts", postLimiter, community.HandleCreatePost)
	uc.Get("/posts/:id", community.HandleGetPost)
	uc.Get("/posts/:id/replies", community.HandleListReplies)
	uc.Post("/posts/:id/replies", replyLimiter, community.HandleCreateReply)
}
