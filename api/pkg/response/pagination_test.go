package response

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

// pageParamsFor runs PageParams against a request with the given query string.
func pageParamsFor(t *testing.T, query string) (page, limit, offset int) {
	t.Helper()
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error {
		page, limit, offset = PageParams(c)
		return nil
	})
	if _, err := app.Test(httptest.NewRequest("GET", "/?"+query, nil)); err != nil {
		t.Fatalf("test request failed: %v", err)
	}
	return page, limit, offset
}

func TestPageParamsClampsBadInput(t *testing.T) {
	cases := []struct {
		name                            string
		query                           string
		wantPage, wantLimit, wantOffset int
	}{
		{"no query at all", "", 1, 20, 0},
		{"normal values", "page=3&limit=50", 3, 50, 100},
		{"page zero falls back", "page=0", 1, 20, 0},
		{"negative page falls back", "page=-5", 1, 20, 0},
		{"limit zero falls back", "limit=0", 1, 20, 0},
		{"limit over the ceiling falls back", "limit=101", 1, 20, 0},
		{"limit exactly at the ceiling is kept", "limit=100", 1, 100, 0},
		{"unparseable values fall back", "page=abc&limit=xyz", 1, 20, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			page, limit, offset := pageParamsFor(t, tc.query)
			if page != tc.wantPage || limit != tc.wantLimit || offset != tc.wantOffset {
				t.Errorf("PageParams(%q) = (%d, %d, %d), want (%d, %d, %d)",
					tc.query, page, limit, offset, tc.wantPage, tc.wantLimit, tc.wantOffset)
			}
		})
	}
}

func TestMetaForCountsPages(t *testing.T) {
	cases := []struct {
		name      string
		page      int
		limit     int
		total     int64
		wantPages int
	}{
		{"no rows means no pages", 1, 20, 0, 0},
		{"a partial page still counts as one", 1, 20, 1, 1},
		{"exactly full", 1, 20, 20, 1},
		{"one row into the second page", 1, 20, 21, 2},
		{"rounds the last partial page up", 1, 20, 55, 3},
		{"a zero limit cannot divide", 1, 0, 55, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			meta := MetaFor(tc.page, tc.limit, tc.total)
			if meta.Pages != tc.wantPages {
				t.Errorf("MetaFor(%d, %d, %d).Pages = %d, want %d",
					tc.page, tc.limit, tc.total, meta.Pages, tc.wantPages)
			}
			if meta.Page != tc.page || meta.Limit != tc.limit || meta.Total != tc.total {
				t.Errorf("MetaFor did not pass through its inputs: %+v", meta)
			}
		})
	}
}
