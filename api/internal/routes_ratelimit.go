package internal

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
)

// The rate limiters guarding the routes in routes_admin.go and routes_user.go.
//
// Every one of them is the same middleware with four things dialled in: how
// many requests, over what window, counted against whom, and what to say when
// the caller runs out. The two constructors below take exactly those four
// things, so each limiter reads as one line of policy instead of fourteen
// lines of identical config.

// rateLimitPerIP counts requests against the caller's IP address. Use it on
// endpoints reached *before* the caller has proven who they are — login, OTP,
// password reset — where there is no user ID to count against yet.
func rateLimitPerIP(maxRequests int, window time.Duration, tooManyMessage string) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        maxRequests,
		Expiration: window,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: tooManyResponse(tooManyMessage),
	})
}

// rateLimitPerAccount counts requests against one signed-in account.
//
// localsKey is where the auth middleware parked the ID — "userID" for the app,
// "adminID" for the admin panel — and the two are separate namespaces, so an
// admin and a user with the same ID never share a bucket. keyPrefix separates
// one endpoint's budget from another's: without it, uploading an avatar would
// eat into the same allowance as posting a comment.
func rateLimitPerAccount(localsKey, keyPrefix string, maxRequests int, window time.Duration, tooManyMessage string) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        maxRequests,
		Expiration: window,
		KeyGenerator: func(c *fiber.Ctx) string {
			id, _ := c.Locals(localsKey).(string)
			return keyPrefix + id
		},
		LimitReached: tooManyResponse(tooManyMessage),
	})
}

// tooManyResponse builds the 429 handler shared by both constructors.
func tooManyResponse(message string) func(*fiber.Ctx) error {
	return func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
			"success": false,
			"error":   message,
		})
	}
}

// Login and account recovery, all counted per IP because the caller is not
// signed in yet.
var (
	otpLimiter = rateLimitPerIP(5, time.Minute,
		"too many OTP requests — try again in a minute")

	// Deliberately a separate bucket from otpLimiter: sharing one between
	// "send me a code" and "here is my code" means two mistyped codes lock a
	// legitimate user out of their own login. Same ceiling, independent budget.
	otpVerifyLimiter = rateLimitPerIP(5, time.Minute,
		"too many verification attempts — try again in a minute")

	// Looser than the OTP limiter because legitimate clients refresh routinely;
	// tight enough to make brute-forcing a stolen refresh token impractical.
	refreshLimiter = rateLimitPerIP(20, time.Minute,
		"too many requests — try again shortly")

	// Guards the endpoint that consumes a reset code and sets a new password.
	resetPasswordLimiter = rateLimitPerIP(3, time.Hour,
		"too many password reset attempts — try again in an hour")
)

// Per-account limits on what a signed-in caller can do.
var (
	streamLimiter = rateLimitPerAccount("userID", "stream_", 10, time.Minute,
		"too many stream requests, please slow down")

	postLimiter = rateLimitPerAccount("userID", "community_post_", 3, 10*time.Minute,
		"too many posts — wait 10 minutes")

	replyLimiter = rateLimitPerAccount("userID", "community_reply_", 10, 10*time.Minute,
		"too many replies — wait 10 minutes")

	commentLimiter = rateLimitPerAccount("userID", "video_comment_", 10, 10*time.Minute,
		"too many comments — wait 10 minutes")

	messageLimiter = rateLimitPerAccount("userID", "product_message_", 10, 10*time.Minute,
		"too many messages — wait 10 minutes")

	// Marketplace listings have no admin approval gate, so this is the primary
	// spam control.
	productUploadLimiter = rateLimitPerAccount("userID", "product_upload_", 5, 10*time.Minute,
		"too many product uploads — wait 10 minutes")

	// Stops a stolen session being used to brute-force the current password.
	adminChangePasswordLimiter = rateLimitPerAccount("adminID", "change_password_admin_", 5, time.Minute,
		"too many attempts — try again in a minute")

	userChangePasswordLimiter = rateLimitPerAccount("userID", "change_password_user_", 5, time.Minute,
		"too many attempts — try again in a minute")

	// Each avatar upload writes a new object before the old one is cleaned up,
	// so unbounded uploads would fill storage.
	adminAvatarLimiter = rateLimitPerAccount("adminID", "avatar_admin_", 5, 10*time.Minute,
		"too many avatar uploads — wait 10 minutes")

	userAvatarLimiter = rateLimitPerAccount("userID", "avatar_user_", 5, 10*time.Minute,
		"too many avatar uploads — wait 10 minutes")
)
