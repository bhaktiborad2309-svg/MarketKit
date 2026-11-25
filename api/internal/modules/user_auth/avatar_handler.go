package user_auth

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/marketkit/api/internal/database"
	"github.com/marketkit/api/internal/imageutil"
	"github.com/marketkit/api/internal/models"
	"github.com/marketkit/api/internal/storage"
	"github.com/marketkit/api/pkg/response"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// HandleUploadAvatar saves a new profile picture for the current user.
// @Summary     Upload profile picture
// @Tags        User Auth
// @Accept      multipart/form-data
// @Produce     json
// @Security    UserAuth
// @Param       file  formData  file  true  "Avatar file (jpg, png, webp only)"
// @Success     200  {object}  map[string]string
// @Failure     400  {object}  map[string]string
// @Failure     401  {object}  map[string]string
// @Router      /auth/avatar [post]
func HandleUploadAvatar(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)

	file, err := c.FormFile("file")
	if err != nil {
		return response.BadRequest(c, "image file is required")
	}
	if file.Size > imageutil.MaxAvatarBytes {
		return response.BadRequest(c, "image must be under 5 MB")
	}

	src, err := file.Open()
	if err != nil {
		return response.InternalError(c, "failed to read uploaded file")
	}
	defer src.Close()

	ext, mimeType, body, size, err := imageutil.NormalizeAvatarUpload(file.Filename, src, file.Size)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}

	fileKey := fmt.Sprintf("avatars/%s%s", uuid.New().String(), ext)

	if err := storage.Store.Upload(context.Background(), fileKey, mimeType, body, size); err != nil {
		slog.Error("[upload] failed to store avatar", "key", fileKey, "error", err)
		return response.InternalError(c, "failed to save avatar")
	}

	avatarURL := storage.Store.PublicURL(fileKey)

	// Read-old-URL-then-update was two unsynchronized DB calls — concurrent
	// requests could race on the stale read and each overwrite the other's
	// URL, orphaning every upload but the last writer. Lock the row for the
	// duration of the swap so concurrent calls serialize instead of racing.
	var oldAvatarURL string
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		var user models.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", userID).First(&user).Error; err != nil {
			return err
		}
		if user.AvatarURL != nil {
			oldAvatarURL = *user.AvatarURL
		}
		return tx.Model(&models.User{}).Where("id = ?", userID).Update("avatar_url", avatarURL).Error
	})
	if err != nil {
		slog.Error("[upload] failed to update avatar_url", "error", err)
		return response.InternalError(c, "failed to save avatar")
	}

	if oldAvatarURL != "" {
		if oldKey := storage.ObjectKeyFromPublicURL(oldAvatarURL); oldKey != "" {
			_ = storage.Store.Delete(context.Background(), oldKey)
		}
	}

	return response.OK(c, fiber.Map{"avatar_url": avatarURL})
}

// HandleDeleteAvatar removes the current user's profile picture.
func HandleDeleteAvatar(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	var user models.User
	database.DB.Where("id = ?", userID).First(&user)
	if user.AvatarURL != nil && *user.AvatarURL != "" {
		if key := storage.ObjectKeyFromPublicURL(*user.AvatarURL); key != "" {
			_ = storage.Store.Delete(context.Background(), key)
		}
	}
	database.DB.Model(&models.User{}).Where("id = ?", userID).Update("avatar_url", nil)
	return response.OK(c, fiber.Map{"message": "avatar removed"})
}
