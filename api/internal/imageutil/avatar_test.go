package imageutil

import (
	"bytes"
	"io"
	"strings"
	"testing"
)

// Minimal valid file headers, enough for http.DetectContentType.
var (
	pngHeader  = []byte("\x89PNG\r\n\x1a\n" + strings.Repeat("\x00", 40))
	jpegHeader = []byte("\xff\xd8\xff\xe0" + strings.Repeat("\x00", 40))
)

func TestNormalizeAvatarUploadTrustsKnownExtensions(t *testing.T) {
	cases := []struct {
		filename string
		wantExt  string
		wantMIME string
	}{
		{"me.jpg", ".jpg", "image/jpeg"},
		{"me.jpeg", ".jpeg", "image/jpeg"},
		{"me.PNG", ".png", "image/png"},
		{"me.webp", ".webp", "image/webp"},
	}
	for _, tc := range cases {
		t.Run(tc.filename, func(t *testing.T) {
			ext, mime, _, _, err := NormalizeAvatarUpload(tc.filename, bytes.NewReader(jpegHeader), 44)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if ext != tc.wantExt || mime != tc.wantMIME {
				t.Errorf("got (%q, %q), want (%q, %q)", ext, mime, tc.wantExt, tc.wantMIME)
			}
		})
	}
}

// A lying extension must not decide what we store — the bytes do.
func TestNormalizeAvatarUploadSniffsUntrustedExtensions(t *testing.T) {
	ext, mime, body, _, err := NormalizeAvatarUpload("payload.txt", bytes.NewReader(pngHeader), int64(len(pngHeader)))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ext != ".png" || mime != "image/png" {
		t.Errorf("got (%q, %q), want (.png, image/png)", ext, mime)
	}

	// The sniffed head must be stitched back on, or the stored file loses its
	// first 512 bytes.
	got, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("reading body: %v", err)
	}
	if !bytes.Equal(got, pngHeader) {
		t.Errorf("body lost bytes: got %d, want %d", len(got), len(pngHeader))
	}
}

func TestNormalizeAvatarUploadRejectsNonImages(t *testing.T) {
	_, _, _, _, err := NormalizeAvatarUpload("notes", strings.NewReader("just some plain text"), 20)
	if err == nil {
		t.Fatal("expected a non-image upload to be rejected")
	}
}

func TestAvatarMIMEForExtDefaultsToJPEG(t *testing.T) {
	cases := map[string]string{
		".png":  "image/png",
		".webp": "image/webp",
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		"":      "image/jpeg",
	}
	for ext, want := range cases {
		if got := AvatarMIMEForExt(ext); got != want {
			t.Errorf("AvatarMIMEForExt(%q) = %q, want %q", ext, got, want)
		}
	}
}
