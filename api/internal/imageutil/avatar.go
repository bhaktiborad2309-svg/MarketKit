package imageutil

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
)

// MaxAvatarBytes caps a profile picture upload. Matches the community and
// market image limits so a user never hits three different ceilings.
const MaxAvatarBytes = 5 * 1024 * 1024 // 5 MB

// avatarExtensions are the filename extensions we trust without sniffing.
var avatarExtensions = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".webp": true,
}

// NormalizeAvatarUpload works out what an uploaded profile picture actually is
// and hands back everything needed to store it.
//
// A trusted extension is taken at face value. Anything else (no extension, or
// a ".txt" that is really a PNG) gets its first 512 bytes sniffed, and only
// jpeg/png/webp are accepted — so the extension a client sends never decides
// what we store.
//
// The returned body is the full stream: when sniffing consumed the head, it is
// stitched back on with io.MultiReader, so callers read it exactly once from
// the start.
func NormalizeAvatarUpload(filename string, src io.Reader, reportedSize int64) (ext, mimeType string, body io.Reader, size int64, err error) {
	ext = strings.ToLower(filepath.Ext(filename))
	if avatarExtensions[ext] {
		return ext, AvatarMIMEForExt(ext), src, reportedSize, nil
	}

	head := make([]byte, 512)
	n, readErr := io.ReadFull(src, head)
	if readErr != nil && !errors.Is(readErr, io.ErrUnexpectedEOF) && !errors.Is(readErr, io.EOF) {
		return "", "", nil, 0, fmt.Errorf("failed to read uploaded file")
	}
	head = head[:n]

	switch http.DetectContentType(head) {
	case "image/jpeg":
		ext, mimeType = ".jpg", "image/jpeg"
	case "image/png":
		ext, mimeType = ".png", "image/png"
	case "image/webp":
		ext, mimeType = ".webp", "image/webp"
	default:
		return "", "", nil, 0, fmt.Errorf("unsupported image format (jpg, png, webp only)")
	}

	body = io.MultiReader(bytes.NewReader(head), src)
	size = reportedSize
	if size <= 0 {
		size = int64(len(head))
	}
	return ext, mimeType, body, size, nil
}

// AvatarMIMEForExt maps a trusted avatar extension to its content type,
// defaulting to jpeg since that is what .jpg and .jpeg both mean.
func AvatarMIMEForExt(ext string) string {
	switch ext {
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	default:
		return "image/jpeg"
	}
}
