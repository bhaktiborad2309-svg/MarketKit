package response

import (
	"math"
	"strconv"

	"github.com/gofiber/fiber/v2"
)

// Defaults and ceilings for ?page= and ?limit=. The ceiling exists so a client
// cannot ask for the whole table in one request.
const (
	DefaultPage  = 1
	DefaultLimit = 20
	MaxLimit     = 100
)

// PageParams reads ?page= and ?limit= off the request and clamps them into
// something safe to hand to the database.
//
// Anything missing, unparseable, or out of range falls back to the defaults
// rather than erroring — a bad page number is not worth a 400 to the caller.
// The returned offset is ready for .Offset(): (page - 1) * limit.
func PageParams(c *fiber.Ctx) (page, limit, offset int) {
	return PageParamsWith(c, DefaultLimit, MaxLimit)
}

// PageParamsWith is PageParams for the handful of endpoints that want their own
// page size — the audit log, for instance, defaults to 50 and allows 200.
func PageParamsWith(c *fiber.Ctx, defaultLimit, maxLimit int) (page, limit, offset int) {
	page = PageNumber(c)
	limit, _ = strconv.Atoi(c.Query("limit", strconv.Itoa(defaultLimit)))
	if limit < 1 || limit > maxLimit {
		limit = defaultLimit
	}
	return page, limit, (page - 1) * limit
}

// PageNumber reads just ?page=, clamped to 1 or above. Use it for endpoints
// with a fixed page size, where ?limit= is deliberately not a knob the client
// gets to turn.
func PageNumber(c *fiber.Ctx) int {
	page, _ := strconv.Atoi(c.Query("page", strconv.Itoa(DefaultPage)))
	if page < 1 {
		return DefaultPage
	}
	return page
}

// MetaFor builds the Meta block that goes back with a paginated response,
// working out the page count from the row total.
func MetaFor(page, limit int, total int64) Meta {
	pages := 0
	if limit > 0 {
		pages = int(math.Ceil(float64(total) / float64(limit)))
	}
	return Meta{Page: page, Limit: limit, Total: total, Pages: pages}
}
