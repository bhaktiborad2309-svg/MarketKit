#!/usr/bin/env bash
#
# Build a MarketKit release tree with only the packs a buyer paid for.
#
#   ./scripts/make-pack.sh                      # core only (Starter)
#   ./scripts/make-pack.sh --packs video        # core + Video pack
#   ./scripts/make-pack.sh --packs video,community --tier pro
#
# Everything lives in one repository. This script stages a copy, deletes the
# packs that were not bought, then *proves the result compiles* before zipping
# it. If a build fails the script stops and leaves the staged tree in place so
# you can look at it — shipping a kit that does not build is the one outcome
# worth failing loudly over.
#
# Adding a pack later means adding one entry to the manifest below, an
# internal/routes_pack_<name>.go on the API side, and the web/app paths it
# owns. Nothing in the core is allowed to import a pack.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"
ALL_PACKS=(video community)

PACKS=""
TIER="starter"
SKIP_VERIFY=0
VERIFY_APP=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --packs)       PACKS="$2"; shift 2 ;;
    --tier)        TIER="$2"; shift 2 ;;
    --skip-verify) SKIP_VERIFY=1; shift ;;
    --verify-app)  VERIFY_APP=1; shift ;;
    -h|--help)     sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

say()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\n\033[31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

included() {
  local want="$1"
  IFS=',' read -ra got <<< "$PACKS"
  for p in "${got[@]}"; do [[ "$p" == "$want" ]] && return 0; done
  return 1
}

# ── Pack manifest ────────────────────────────────────────────────────────────
# Paths each pack owns outright. Deleted when the pack is not included.

video_paths() {
  cat <<'EOF'
api/internal/routes_pack_video.go
api/internal/modules/videos
api/internal/modules/user_videos
api/internal/modules/video_engagement
api/internal/modules/playlists
api/internal/modules/user_playlists
api/internal/modules/playback
api/internal/modules/photos
api/internal/modules/photo_categories
api/internal/workers
web/src/pages/VideosPage.tsx
web/src/pages/videos
web/src/pages/PlaylistsPage.tsx
web/src/pages/PhotosPage.tsx
web/src/pages/PlaybackPage.tsx
EOF
}

community_paths() {
  cat <<'EOF'
api/internal/routes_pack_community.go
api/internal/modules/community
web/src/pages/CommunityPage.tsx
EOF
}

# NOT YET SEPARABLE: the Flutter app.
#
# app/lib/features/{community,video_player,photos,library,downloads,favorites}
# are reachable only through core/router/app_router.dart, which is the good
# news — one file. The bad news is that file also owns the bottom navigation:
# destinations are positional and selectedIndex is computed by matching route
# prefixes to hardcoded indices, so deleting a section renumbers the rest.
# home/ and library/ are built around the video side too.
#
# Deleting those directories yields a tree that does not compile, so the app
# ships whole in every tier for now and the pack boundary is enforced by the
# API and the admin panel. A Starter buyer's app simply has nothing to show in
# those sections — the endpoints are gone.
#
# Doing this properly means making the nav data-driven (a list of sections the
# router builds destinations and indices from) so a removed section drops out
# rather than shifting its neighbours. That is UI work, not file deletion, and
# it is the remaining half of pack separation.

# ── Stage ────────────────────────────────────────────────────────────────────

STAGE="$DIST/marketkit-$TIER"
say "Staging $TIER tree (packs: ${PACKS:-none})"
rm -rf "$STAGE"
mkdir -p "$STAGE"

# git archive gives us exactly the tracked files — no node_modules, no build
# output, no local .env, no uploads. Anything untracked was never going to ship.
git -C "$ROOT" archive HEAD | tar -x -C "$STAGE"
info "$(find "$STAGE" -type f | wc -l) tracked files"

# ── Strip excluded packs ─────────────────────────────────────────────────────

for pack in "${ALL_PACKS[@]}"; do
  if included "$pack"; then
    info "keeping  $pack pack"
    continue
  fi
  say "Removing $pack pack"
  while read -r path; do
    [[ -z "$path" ]] && continue
    if [[ -e "$STAGE/$path" ]]; then
      rm -rf "${STAGE:?}/$path"
      info "removed $path"
    else
      die "manifest lists $path but it is not in the tree — manifest is stale"
    fi
  done < <("${pack}_paths")
done

# ── Patch the few places that name a pack ────────────────────────────────────
# The API needs none: packs self-register through internal/routes.go, so
# deleting routes_pack_*.go is enough. These are the web and app surfaces that
# still hardcode a route or a nav entry.

patch_out() { # file, pattern — drop matching lines, assert at least one went
  local file="$STAGE/$1" pattern="$2" before after
  [[ -f "$file" ]] || return 0
  before=$(wc -l < "$file")
  grep -vE "$pattern" "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  after=$(wc -l < "$file")
  (( before > after )) || die "no lines matched /$pattern/ in $1 — patch is stale"
  info "patched $1 (-$((before - after)) lines)"
}

if ! included video; then
  say "Patching video references"
  patch_out api/cmd/api/main.go 'workers\.NewVideoTranscoder|internal/workers'
  patch_out web/src/App.tsx 'VideosPage|PlaylistsPage|PhotosPage|PlaybackPage'
  patch_out web/src/components/AdminLayout.tsx '"/videos"|"/playlists"|"/photos"|"/playback"'
fi

if ! included community; then
  say "Patching community references"
  patch_out web/src/App.tsx 'CommunityPage'
  patch_out web/src/components/AdminLayout.tsx '"/community"'
fi

# ── Docs and licence reflect what is actually in the box ─────────────────────

say "Writing pack manifest"
{
  echo "# Packs in this build"
  echo
  echo "Tier: **${TIER}**"
  echo
  for pack in "${ALL_PACKS[@]}"; do
    if included "$pack"; then echo "- ✅ ${pack} pack — included"
    else echo "- ⬜ ${pack} pack — not included (sold separately)"; fi
  done
  echo
  echo "Add a pack later and we send you a new build; your existing code is"
  echo "unaffected, because packs only ever add files."
  echo
  echo "## The mobile app"
  echo
  echo "The Flutter app ships complete in every tier. Screens belonging to a"
  echo "pack you did not buy are still in the source, but their API endpoints"
  echo "are not in your backend, so those sections stay empty. Delete the"
  echo "features you do not want under \`app/lib/features/\`, then remove their"
  echo "routes from \`app/lib/core/router/app_router.dart\`."
} > "$STAGE/PACKS.md"
info "PACKS.md"

# ── Verify ───────────────────────────────────────────────────────────────────

if [[ "$SKIP_VERIFY" == "1" ]]; then
  say "Skipping verification (--skip-verify)"
else
  say "Verifying the API compiles"
  if command -v go >/dev/null 2>&1; then
    (cd "$STAGE/api" && go build ./...) || die "API does not build without the excluded packs"
  elif docker compose -f "$ROOT/docker-compose.dev.yml" ps --status running 2>/dev/null | grep -q api; then
    # No local Go toolchain — borrow the dev container's.
    docker run --rm -v "$STAGE/api":/src -w /src \
      "$(docker compose -f "$ROOT/docker-compose.dev.yml" images -q api | head -1)" \
      go build ./... || die "API does not build without the excluded packs"
  else
    die "no Go toolchain and no running api container — install Go or 'make dev', or pass --skip-verify"
  fi
  info "go build ./... clean"

  say "Verifying the admin panel type-checks"
  if [[ -d "$ROOT/web/node_modules" ]]; then
    ln -sfn "$ROOT/web/node_modules" "$STAGE/web/node_modules"
    (cd "$STAGE/web" && npx --no-install tsc --noEmit -p tsconfig.app.json) \
      || die "admin panel does not type-check without the excluded packs"
    rm -f "$STAGE/web/node_modules"
    info "tsc --noEmit clean"
  else
    info "skipped — run 'make web-install' first to enable this check"
  fi

  if [[ "$VERIFY_APP" == "1" ]]; then
    say "Verifying the Flutter app analyses"
    command -v flutter >/dev/null 2>&1 || die "--verify-app needs flutter on PATH"
    (cd "$STAGE/app" && flutter pub get >/dev/null && flutter analyze --no-fatal-infos) \
      || die "Flutter app does not analyse without the excluded packs"
    info "flutter analyze clean"
  fi
fi

# ── Package ──────────────────────────────────────────────────────────────────

say "Packaging"
ZIP="$DIST/marketkit-$TIER${PACKS:+-${PACKS//,/-}}.zip"
rm -f "$ZIP"
# --verify-app leaves .dart_tool/ and build/ behind, and the tsc check leaves a
# node_modules symlink; none of that belongs in a buyer's download.
(cd "$DIST" && zip -qr "$ZIP" "$(basename "$STAGE")" \
  -x '*/node_modules/*' '*/.dart_tool/*' '*/build/*' '*/.flutter-plugins-dependencies')
info "$(du -h "$ZIP" | cut -f1)  $ZIP"

say "Done"
info "tree: $STAGE"
info "zip:  $ZIP"
