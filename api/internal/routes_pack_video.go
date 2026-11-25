package internal

import (
	"github.com/gofiber/fiber/v2"
	"github.com/marketkit/api/internal/middleware"
	"github.com/marketkit/api/internal/modules/photo_categories"
	"github.com/marketkit/api/internal/modules/photos"
	"github.com/marketkit/api/internal/modules/playback"
	"github.com/marketkit/api/internal/modules/playlists"
	"github.com/marketkit/api/internal/modules/user_playlists"
	"github.com/marketkit/api/internal/modules/user_videos"
	"github.com/marketkit/api/internal/modules/video_engagement"
	"github.com/marketkit/api/internal/modules/videos"
)

// Video pack — upload, transcode, HLS playback, playlists, engagement,
// playback analytics and practice photos.
//
// Sold separately. Delete this file and the modules it imports to build a kit
// without it; nothing in the core points back here.
func init() {
	registerPack(registerVideoPackRoutes)
}

func registerVideoPackRoutes(v1 fiber.Router) {
	// ── Admin: Videos (/videos) ───────────────────────────────────────────────
	v := v1.Group("/videos", middleware.Authenticate)
	v.Get("/", videos.HandleList)
	v.Get("/presign-upload", videos.HandlePresignUpload)
	v.Post("/finalize", videos.HandleFinalize)
	v.Post("/", videos.HandleCreate)
	v.Get("/:id", videos.HandleGet)
	v.Patch("/:id", videos.HandleUpdate)
	v.Delete("/:id", videos.HandleDelete)
	v.Post("/:id/retry", videos.HandleRetry)
	v.Post("/:id/photos", videos.HandleUploadPhotos)
	v.Get("/:id/stream", streamLimiter, videos.HandleStream)
	v.Get("/:id/stream-url", streamLimiter, videos.HandleStreamURL)
	// Admin engagement (moderation)
	v.Get("/:id/engagement", video_engagement.HandleAdminGetEngagement)
	v.Get("/:id/comments", video_engagement.HandleAdminListComments)
	v.Post("/:id/comments/reply", video_engagement.HandleAdminReplyComment)
	v.Delete("/:id/comments/:cid", video_engagement.HandleAdminDeleteComment)

	// ── Admin: Playback Analytics (/playback) ─────────────────────────────────
	pb := v1.Group("/playback", middleware.Authenticate)
	pb.Get("/top-videos", playback.HandleTopVideos)
	pb.Get("/by-user", playback.HandleByUser)
	pb.Get("/summary", playback.HandleSummary)
	pb.Get("/daily-trend", playback.HandleDailyTrend)

	// ── Admin: Photos (/photos) ───────────────────────────────────────────────
	v1.Get("/photos/public", photos.HandlePublic)
	ph := v1.Group("/photos", middleware.Authenticate)
	ph.Get("/", photos.HandleList)
	ph.Post("/", photos.HandleCreate)
	ph.Patch("/:id", photos.HandleUpdate)
	ph.Delete("/:id", photos.HandleDelete)

	pc := v1.Group("/photo-categories", middleware.Authenticate)
	pc.Get("/", photo_categories.HandleList)
	pc.Post("/", photo_categories.HandleCreate)
	pc.Delete("/:id", photo_categories.HandleDelete)

	// ── Admin: Playlists (/admin/playlists) ──────────────────────────────────
	ap := v1.Group("/admin/playlists", middleware.Authenticate)
	ap.Get("/", playlists.HandleList)
	ap.Post("/", playlists.HandleCreate)
	ap.Get("/:id", playlists.HandleGetDetail)
	ap.Patch("/:id", playlists.HandleUpdate)
	ap.Delete("/:id", playlists.HandleDelete)
	ap.Put("/:id/videos", playlists.HandleSetVideos)

	// ── User: Videos (/user/videos) ───────────────────────────────────────────
	uv := v1.Group("/user/videos", middleware.UserAuthenticate)
	// Static sub-paths must be registered before /:id to avoid param capture.
	uv.Get("/intro", user_videos.HandleGetIntro)
	uv.Get("/latest", user_videos.HandleGetLatest)
	uv.Get("/", user_videos.HandleList)
	uv.Get("/:id/stream", user_videos.HandleStream)
	uv.Get("/:id/stream-url", user_videos.HandleStreamURL)
	uv.Get("/:id/download-url", user_videos.HandleDownloadURL)
	uv.Get("/:id/qualities", user_videos.HandleGetQualities)
	uv.Get("/:id/photos", user_videos.HandleGetPhotos)
	uv.Post("/:id/playback-log", user_videos.HandleLogPlayback)
	uv.Post("/:id/progress", user_videos.HandleSaveProgress)
	uv.Delete("/:id/progress", user_videos.HandleDeleteProgress)
	// User engagement
	uv.Get("/:id/reactions", video_engagement.HandleGetReactions)
	uv.Post("/:id/reactions", video_engagement.HandleToggleReaction)
	uv.Get("/:id/comments", video_engagement.HandleListComments)
	uv.Post("/:id/comments", commentLimiter, video_engagement.HandlePostComment)
	uv.Delete("/:id/comments/:cid", video_engagement.HandleDeleteComment)

	// ── User: Playlists (/user/playlists) ────────────────────────────────────
	uplists := v1.Group("/user/playlists", middleware.UserAuthenticate)
	uplists.Get("/", user_playlists.HandleList)
	uplists.Get("/:id", user_playlists.HandleGetDetail)
}
