package user_videos

import (
	"github.com/marketkit/api/internal/models"
	"github.com/marketkit/api/internal/subscriptions"
)

// videoAccessDeniedReason decides whether a user may watch or download a video,
// returning "" when they may and a client-safe explanation when they may not.
//
// The rule, in one place because five handlers need it and had each grown their
// own copy:
//
//   - free and preview videos are open to any signed-in user;
//   - anything else needs at least one active subscription;
//   - and that subscription's features must cover the video's category.
//
// A category outside the known set stays accessible to any subscriber. That
// preserves the behaviour from before feature keys replaced boolean flags, so
// content filed under a category the plans do not enumerate does not silently
// become unreachable.
//
// action is the verb for the message ("watch", "download"), since a caller
// asking for a download link should not be told they cannot watch.
func videoAccessDeniedReason(userID string, video models.Video, action string) string {
	if video.IsFree || video.IsPreview {
		return ""
	}

	features := subscriptions.UserFeatureAccess(userID)
	if len(features) == 0 {
		return "subscription required to " + action + " this video"
	}

	if models.IsValidVideoCategory(video.Category) && !subscriptions.HasFeature(features, string(video.Category)) {
		return "your plan does not include access to this content"
	}
	return ""
}
