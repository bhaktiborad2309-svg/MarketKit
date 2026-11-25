package storage

import (
	"testing"

	"github.com/marketkit/api/internal/config"
)

func TestObjectKeyFromPublicURL(t *testing.T) {
	config.App.R2PublicBase = "https://cdn.example.com"
	config.App.ServerBaseURL = "https://api.example.com"
	t.Cleanup(func() {
		config.App.R2PublicBase = ""
		config.App.ServerBaseURL = ""
	})

	cases := []struct {
		name string
		url  string
		want string
	}{
		{"local uploads path", "/uploads/avatars/abc.jpg", "avatars/abc.jpg"},
		{"custom CDN base", "https://cdn.example.com/avatars/abc.jpg", "avatars/abc.jpg"},
		{"absolute server URL", "https://api.example.com/uploads/avatars/abc.jpg", "avatars/abc.jpg"},
		{"r2 bucket URL", "https://acct.r2.cloudflarestorage.com/avatars/abc.jpg", "avatars/abc.jpg"},
		{"nested key keeps its path", "/uploads/videos/thumbnail/thumb_x.jpg", "videos/thumbnail/thumb_x.jpg"},
		{"a URL from somewhere else is not ours", "https://evil.example.net/avatars/abc.jpg", ""},
		{"empty stays empty", "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ObjectKeyFromPublicURL(tc.url); got != tc.want {
				t.Errorf("ObjectKeyFromPublicURL(%q) = %q, want %q", tc.url, got, tc.want)
			}
		})
	}
}
