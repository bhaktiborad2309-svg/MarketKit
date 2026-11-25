package videos

import (
	"context"
	"log/slog"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/marketkit/api/internal/database"
	"github.com/marketkit/api/internal/models"
	"github.com/marketkit/api/pkg/response"
	"github.com/marketkit/api/pkg/safego"
)

// videoEdits is what one PATCH asked to change: the column updates to write,
// plus — when the edit is the one that publishes the video — the details needed
// to announce it.
type videoEdits struct {
	Updates map[string]interface{}

	// AnnounceOnPublish is non-nil only when this edit flips a video to
	// PUBLISHED that was not published before, so subscribers are told once.
	AnnounceOnPublish *videoPublishAnnouncement
}

type videoPublishAnnouncement struct {
	Title        string
	ThumbnailURL string
}

// applyMultipartVideoEdits reads the admin edit modal's form submission: title,
// description, category, an optional replacement thumbnail, and an optional
// playlist move.
//
// A rejected thumbnail is logged and skipped rather than failing the whole
// edit — the admin's text changes should still land.
func applyMultipartVideoEdits(c *fiber.Ctx, video *models.Video) (videoEdits, error) {
	updates := map[string]interface{}{}

	if title := c.FormValue("title"); title != "" {
		updates["title"] = title
	}
	if description := c.FormValue("description"); description != "" {
		updates["description"] = description
	} else if c.FormValue("description") == "" && c.FormValue("clear_description") == "1" {
		updates["description"] = ""
	}

	if category := models.VideoCategory(c.FormValue("category")); category != "" {
		if !models.IsValidVideoCategory(category) {
			return videoEdits{}, response.BadRequest(c, "invalid category")
		}
		if category != video.Category {
			updates["category"] = category
		}
	}

	if thumbFile, err := c.FormFile("thumbnail"); err == nil {
		if url, _, err := uploadValidatedThumbnail(context.Background(), thumbFile); err != nil {
			slog.Warn("[upload] rejected invalid thumbnail", "filename", thumbFile.Filename, "error", err)
		} else {
			deleteStoredThumbnail(context.Background(), video.ThumbnailURL)
			updates["thumbnail_url"] = url
		}
	}

	if playlistID := c.FormValue("playlist_id"); playlistID != "" || c.FormValue("clear_playlist") == "1" {
		videoID := video.ID
		safego.Run("videos: assign playlist", func() { movePlaylistAssignment(videoID, playlistID) })
	}

	return videoEdits{Updates: updates}, nil
}

// applyJSONVideoEdits reads the JSON body used by the admin table's inline
// toggles: publish/unpublish, preview, free, intro, and a thumbnail URL.
//
// Every field is a pointer so "absent" and "set to false" stay distinguishable
// — sending is_free:false must clear the flag, while omitting it must not.
func applyJSONVideoEdits(c *fiber.Ctx, video *models.Video, previousStatus models.VideoStatus) (videoEdits, error) {
	var body struct {
		Title        *string             `json:"title"`
		Description  *string             `json:"description"`
		Status       *models.VideoStatus `json:"status"`
		IsPreview    *bool               `json:"is_preview"`
		IsFree       *bool               `json:"is_free"`
		IsIntro      *bool               `json:"is_intro"`
		ThumbnailURL *string             `json:"thumbnail_url"`
	}
	c.BodyParser(&body)

	if err := validateVideoStatusChange(c, body.Status, video); err != nil {
		return videoEdits{}, err
	}
	if body.Title != nil && strings.TrimSpace(*body.Title) == "" {
		return videoEdits{}, response.BadRequest(c, "title cannot be empty")
	}

	updates := map[string]interface{}{}
	if body.Title != nil {
		updates["title"] = *body.Title
	}
	if body.Description != nil {
		updates["description"] = *body.Description
	}
	if body.Status != nil {
		updates["status"] = *body.Status
	}
	if body.IsPreview != nil {
		updates["is_preview"] = *body.IsPreview
	}
	if body.IsFree != nil {
		updates["is_free"] = *body.IsFree
	}
	if body.IsIntro != nil {
		updates["is_intro"] = *body.IsIntro
		// Only one video can be the intro — clear all others first.
		if *body.IsIntro {
			database.DB.Model(&models.Video{}).Where("id != ?", video.ID).Update("is_intro", false)
		}
	}
	if body.ThumbnailURL != nil {
		updates["thumbnail_url"] = replaceThumbnailURL(c, video, *body.ThumbnailURL)
	}

	edits := videoEdits{Updates: updates}
	if body.Status != nil && *body.Status == models.VideoStatusPublished && previousStatus != models.VideoStatusPublished {
		edits.AnnounceOnPublish = &videoPublishAnnouncement{
			Title:        video.Title,
			ThumbnailURL: announcementThumbnail(video, body.ThumbnailURL),
		}
	}
	return edits, nil
}

// validateVideoStatusChange rejects unknown statuses, and refuses to publish a
// video that has no HLS ladder yet — publishing a raw upload would stream the
// original file with no quality options.
func validateVideoStatusChange(c *fiber.Ctx, newStatus *models.VideoStatus, video *models.Video) error {
	if newStatus == nil {
		return nil
	}

	validStatuses := map[string]bool{
		"PUBLISHED": true, "DRAFT": true, "PROCESSING": true, "ERROR": true,
	}
	if !validStatuses[string(*newStatus)] {
		return response.BadRequest(c, "invalid status value")
	}

	if *newStatus == models.VideoStatusPublished && video.HLSKey == "" {
		if video.Status == models.VideoStatusError {
			return response.BadRequest(c, "transcoding failed for this video — retry the transcode before publishing")
		}
		return response.BadRequest(c, "video is still transcoding — it can be published once transcoding completes")
	}
	return nil
}

// replaceThumbnailURL deletes the previously stored thumbnail when the URL
// actually changed, and returns the value to write: nil to clear the column,
// otherwise the new URL.
func replaceThumbnailURL(c *fiber.Ctx, video *models.Video, rawNewURL string) interface{} {
	newURL := strings.TrimSpace(rawNewURL)

	oldURL := ""
	if video.ThumbnailURL != nil {
		oldURL = *video.ThumbnailURL
	}
	if newURL != oldURL {
		deleteStoredThumbnail(c.Context(), video.ThumbnailURL)
	}

	if newURL == "" {
		return nil
	}
	return newURL
}

// announcementThumbnail picks the image for the "new video" push: the one being
// set in this request if there is one, otherwise whatever the video already had.
func announcementThumbnail(video *models.Video, incomingURL *string) string {
	if incomingURL != nil {
		if thumb := strings.TrimSpace(*incomingURL); thumb != "" {
			return thumb
		}
	}
	if video.ThumbnailURL != nil {
		return *video.ThumbnailURL
	}
	return ""
}
