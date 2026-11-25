package internal

import (
	"github.com/gofiber/fiber/v2"
)

// packRegistrars holds the route registration for optional add-on packs.
//
// Each pack lives in its own routes_pack_*.go file and appends itself here
// from an init(). Nothing in the core references a pack by name, so removing
// a pack is deleting its file and its modules — the slice simply comes up
// shorter and the build stays green. scripts/make-pack.sh relies on that.
var packRegistrars []func(fiber.Router)

// registerPack adds a pack's routes to the set mounted by RegisterRoutes.
func registerPack(register func(fiber.Router)) {
	packRegistrars = append(packRegistrars, register)
}

// RegisterRoutes mounts all API routes onto the given v1 router group.
// The route map is split by who is allowed to call it — see routes_admin.go,
// routes_user.go and routes_public.go — plus whichever add-on packs are
// present in this build.
func RegisterRoutes(v1 fiber.Router) {
	registerAdminRoutes(v1)
	registerUserRoutes(v1)
	registerPublicRoutes(v1)

	for _, registerPackRoutes := range packRegistrars {
		registerPackRoutes(v1)
	}
}
