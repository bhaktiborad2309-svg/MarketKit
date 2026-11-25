package storage

import (
	"strings"

	"github.com/marketkit/api/internal/config"
)

// ObjectKeyFromPublicURL recovers the storage key from a URL that was handed
// out to a client, so the object behind it can be deleted or replaced.
//
// It is the inverse of Store.PublicURL, and it has to cope with every shape
// that function can produce over the life of one deployment: a local
// "/uploads/..." path, an R2 bucket URL, a custom CDN base, or an absolute URL
// built from SERVER_BASE_URL.
//
// Returns "" when the URL matches none of them — treat that as "not ours" and
// do not delete anything.
func ObjectKeyFromPublicURL(publicURL string) string {
	if strings.HasPrefix(publicURL, "/uploads/") {
		return strings.TrimPrefix(publicURL, "/uploads/")
	}

	prefixes := []string{".r2.cloudflarestorage.com/"}
	if base := strings.TrimRight(config.App.R2PublicBase, "/"); base != "" {
		prefixes = append(prefixes, base+"/")
	}
	if base := strings.TrimRight(config.App.ServerBaseURL, "/"); base != "" {
		prefixes = append(prefixes, base+"/uploads/")
	}

	for _, prefix := range prefixes {
		if idx := strings.Index(publicURL, prefix); idx >= 0 {
			return publicURL[idx+len(prefix):]
		}
	}
	return ""
}
