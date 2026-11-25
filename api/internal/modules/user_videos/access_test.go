package user_videos

import (
	"testing"

	"github.com/marketkit/api/internal/models"
	"github.com/marketkit/api/internal/testutil"
)

func TestMain(m *testing.M) { testutil.RunMain(m) }

// These cases pin the entitlement rule that five handlers depend on. The
// interesting one is the last: a paid video filed under a category the plans do
// not enumerate must still require *some* subscription. The hand-rolled copy of
// this check in the bonus-photos handler skipped that test, which let a user
// with no subscription at all reach paid content.
func TestVideoAccessDeniedReason(t *testing.T) {
	freeVideo := models.Video{IsFree: true, Category: models.VideoCategory("ANYTHING")}
	previewVideo := models.Video{IsPreview: true, Category: models.VideoCategory("ANYTHING")}
	paidUnknownCategory := models.Video{Category: models.VideoCategory("NOT_A_REAL_CATEGORY")}

	// A user ID that owns no subscription: UserFeatureAccess returns nothing.
	const noSubscriptionUserID = "00000000-0000-0000-0000-000000000000"

	t.Run("free video is open to anyone", func(t *testing.T) {
		if reason := videoAccessDeniedReason(noSubscriptionUserID, freeVideo, "watch"); reason != "" {
			t.Errorf("expected access, got %q", reason)
		}
	})

	t.Run("preview video is open to anyone", func(t *testing.T) {
		if reason := videoAccessDeniedReason(noSubscriptionUserID, previewVideo, "watch"); reason != "" {
			t.Errorf("expected access, got %q", reason)
		}
	})

	t.Run("paid video with an unknown category still needs a subscription", func(t *testing.T) {
		reason := videoAccessDeniedReason(noSubscriptionUserID, paidUnknownCategory, "view photos for")
		if reason == "" {
			t.Fatal("a user with no subscription reached paid content")
		}
		if reason != "subscription required to view photos for this video" {
			t.Errorf("unexpected message: %q", reason)
		}
	})

	t.Run("the action verb reaches the message", func(t *testing.T) {
		paid := models.Video{Category: models.VideoCategory("NOT_A_REAL_CATEGORY")}
		if got := videoAccessDeniedReason(noSubscriptionUserID, paid, "download"); got != "subscription required to download this video" {
			t.Errorf("got %q", got)
		}
	})
}
