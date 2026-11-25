package user_auth

import (
	"log/slog"

	"github.com/gofiber/fiber/v2"
	"github.com/marketkit/api/internal/database"
	"github.com/marketkit/api/internal/models"
	"github.com/marketkit/api/pkg/response"
)

// HandleRegisterDeviceToken upserts an FCM device token for the current user.
// @Summary     Register device token
// @Tags        User Auth
// @Accept      json
// @Produce     json
// @Security    UserAuth
// @Param       body  body  map[string]interface{}  true  "Token and platform"
// @Success     200  {object}  map[string]string
// @Failure     400  {object}  map[string]string
// @Failure     401  {object}  map[string]string
// @Router      /auth/device-token [post]
func maskToken(token string) string {
	if len(token) <= 8 {
		return token
	}
	return token[:8] + "..."
}

func HandleRegisterDeviceToken(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)

	var body struct {
		Token    string `json:"token"`
		Platform string `json:"platform"`
	}
	if err := c.BodyParser(&body); err != nil || body.Token == "" {
		return response.BadRequest(c, "token is required")
	}
	platform := body.Platform
	if platform == "" {
		platform = "android"
	}

	slog.Info("device token registration", "user_id", userID, "platform", platform, "token_prefix", maskToken(body.Token))

	token := models.DeviceToken{
		UserID:   userID,
		Token:    body.Token,
		Platform: platform,
	}
	// Upsert by token value — reassign to this user if token already exists
	database.DB.Where(models.DeviceToken{Token: body.Token}).
		Assign(models.DeviceToken{UserID: userID, Platform: platform}).
		FirstOrCreate(&token)

	return response.OK(c, fiber.Map{"message": "device token registered"})
}

func HandleListDeviceTokens(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	var tokens []models.DeviceToken
	database.DB.Where("user_id = ?", userID).Find(&tokens)

	// Mask the token and drop the internal row ID — callers only need to know
	// which platforms/devices are registered, not the raw FCM credential.
	out := make([]fiber.Map, len(tokens))
	for i, t := range tokens {
		out[i] = fiber.Map{
			"platform":     t.Platform,
			"token_prefix": maskToken(t.Token),
			"updated_at":   t.UpdatedAt,
		}
	}
	return response.OK(c, fiber.Map{
		"count":  len(tokens),
		"tokens": out,
	})
}
