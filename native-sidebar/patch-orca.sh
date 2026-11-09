#!/usr/bin/env bash
# Adds VS Code-style indentation and indent guides to Orca's own left sidebar (macOS).
#
# It builds Orca's renderer from the source of the installed version with
# sidebar-indent-guides.patch applied, then swaps that renderer into the installed app.
# A backup is kept per version; `restore` puts the original back.
#
#   ./patch-orca.sh apply     build and install the patched sidebar (rerun after each Orca update)
#   ./patch-orca.sh restore   put back the original files for the installed version
#   ./patch-orca.sh status    show whether the installed Orca is patched
#
# Quit and reopen Orca afterwards. Needs git, Node 24 and corepack (pnpm).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="${ORCA_APP:-/Applications/Orca.app}"
RES="$APP/Contents/Resources"
UNPACKED_RENDERER="$RES/app.asar.unpacked/out/renderer"
STATE="${ORCA_SIDEBAR_PATCH_HOME:-$HOME/Library/Application Support/orca-sidebar-patch}"
PATCH_FILE="$HERE/sidebar-indent-guides.patch"
MARKER=".orca-sidebar-patch"
REPO_URL="https://github.com/stablyai/orca.git"

die() { echo "error: $*" >&2; exit 1; }
log() { echo "==> $*"; }

[[ "$(uname)" == "Darwin" ]] || die "this script supports macOS only"
[[ -f "$RES/app.asar" ]] || die "Orca not found at $APP (set ORCA_APP)"

VERSION="$(defaults read "$APP/Contents/Info.plist" CFBundleShortVersionString)"
SRC="$STATE/src/v$VERSION"
BACKUP="$STATE/backup/v$VERSION"

is_patched() { [[ -f "$UNPACKED_RENDERER/$MARKER" ]]; }

backup() {
  if [[ -d "$BACKUP" ]]; then
    log "backup for $VERSION already exists"
    return
  fi
  is_patched && die "the installed renderer is already patched but no backup exists"
  log "backing up the original files to $BACKUP"
  mkdir -p "$BACKUP"
  cp "$RES/app.asar" "$BACKUP/app.asar"
  ditto "$UNPACKED_RENDERER" "$BACKUP/renderer"
}

build() {
  if [[ ! -d "$SRC/.git" ]]; then
    log "fetching Orca v$VERSION source"
    mkdir -p "$(dirname "$SRC")"
    git -c advice.detachedHead=false clone --quiet --depth 1 --branch "v$VERSION" "$REPO_URL" "$SRC"
  fi
  cd "$SRC"
  if git apply --reverse --check "$PATCH_FILE" 2>/dev/null; then
    log "patch already applied to the source"
  else
    git apply --check "$PATCH_FILE" || die "the patch does not apply to Orca v$VERSION; update sidebar-indent-guides.patch"
    git apply "$PATCH_FILE"
  fi
  local build_log="$STATE/build.log"
  : > "$build_log"
  log "installing dependencies (first run takes a few minutes; output in $build_log)"
  corepack pnpm install --frozen-lockfile >> "$build_log" 2>&1 || die "pnpm install failed, see $build_log"
  log "building the renderer"
  {
    corepack pnpm run build:packages &&
      ORCA_ELECTRON_VITE_TARGET=renderer node config/scripts/desktop-build/execution/run-electron-vite-build.mjs &&
      node config/scripts/development/web-client/project-renderer-web-client.mjs
  } >> "$build_log" 2>&1 || die "the renderer build failed, see $build_log"
  rm -rf out/renderer/.vite
  echo "$VERSION" > "out/renderer/$MARKER"
}

install_renderer() {
  local built="$SRC/out/renderer"
  log "swapping the renderer into $APP"
  node "$HERE/asar-renderer.cjs" "$RES/app.asar" "$built" "$RES/app.asar.patched"
  rm -rf "$UNPACKED_RENDERER.new" "$UNPACKED_RENDERER.old"
  ditto "$built" "$UNPACKED_RENDERER.new"
  mv "$UNPACKED_RENDERER" "$UNPACKED_RENDERER.old"
  mv "$UNPACKED_RENDERER.new" "$UNPACKED_RENDERER"
  mv "$RES/app.asar.patched" "$RES/app.asar"
  rm -rf "$UNPACKED_RENDERER.old"
}

restore() {
  [[ -d "$BACKUP" ]] || die "no backup for Orca $VERSION in $BACKUP"
  log "restoring the original files for $VERSION"
  rm -rf "$UNPACKED_RENDERER.new"
  ditto "$BACKUP/renderer" "$UNPACKED_RENDERER.new"
  rm -rf "$UNPACKED_RENDERER.old"
  mv "$UNPACKED_RENDERER" "$UNPACKED_RENDERER.old"
  mv "$UNPACKED_RENDERER.new" "$UNPACKED_RENDERER"
  cp "$BACKUP/app.asar" "$RES/app.asar"
  rm -rf "$UNPACKED_RENDERER.old"
}

case "${1:-}" in
  apply)
    backup
    build
    install_renderer
    log "done: quit Orca (Cmd+Q) and open it again"
    ;;
  restore)
    restore
    log "done: quit Orca (Cmd+Q) and open it again"
    ;;
  status)
    if is_patched; then
      echo "Orca $VERSION: patched ($(cat "$UNPACKED_RENDERER/$MARKER"))"
    else
      echo "Orca $VERSION: original"
    fi
    ;;
  *)
    sed -n '2,12p' "$0"
    exit 2
    ;;
esac
