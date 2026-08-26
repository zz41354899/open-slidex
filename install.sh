#!/bin/sh
set -eu

REPOSITORY="zz41354899/open-slidex"
DEFAULT_RELEASE_BASE_URL="https://github.com/$REPOSITORY/releases/latest/download"
DEFAULT_INSTALLER_URL="https://raw.githubusercontent.com/$REPOSITORY/main/install.sh"
RELEASE_BASE_URL="${OPEN_SLIDEX_RELEASE_BASE_URL:-$DEFAULT_RELEASE_BASE_URL}"
INSTALLER_URL="${OPEN_SLIDEX_INSTALLER_URL:-$DEFAULT_INSTALLER_URL}"
INSTALL_ROOT="${OPEN_SLIDEX_INSTALL_ROOT:-$HOME/.local/share/open-slidex}"
BIN_DIR="${OPEN_SLIDEX_BIN_DIR:-$HOME/.local/bin}"
MODE="install"

case "${1:-}" in
  "") ;;
  --update) MODE="update" ;;
  *)
    printf 'Usage: install.sh [--update]\n' >&2
    exit 2
    ;;
esac

if [ "$(uname -s)" != "Darwin" ]; then
  printf 'OpenSlideX install.sh currently supports macOS. Use install.ps1 on Windows.\n' >&2
  exit 1
fi

case "$(uname -m)" in
  arm64) TARGET="darwin-arm64" ;;
  x86_64) TARGET="darwin-x64" ;;
  *)
    printf 'OpenSlideX does not support this macOS architecture: %s\n' "$(uname -m)" >&2
    exit 1
    ;;
esac

ASSET="open-slidex-$TARGET.tar.gz"
TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/open-slidex-install.XXXXXX")"
trap 'rm -rf "$TEMP_ROOT"' EXIT HUP INT TERM

download_file() {
  source_path="$1"
  destination="$2"
  case "$source_path" in
    http://*|https://*|file://*)
      curl -fsSL "$source_path" -o "$destination"
      ;;
    *)
      cp "$source_path" "$destination"
      ;;
  esac
}

ARCHIVE_PATH="$TEMP_ROOT/$ASSET"
CHECKSUM_PATH="$TEMP_ROOT/SHA256SUMS.txt"
download_file "$RELEASE_BASE_URL/$ASSET" "$ARCHIVE_PATH"
download_file "$RELEASE_BASE_URL/SHA256SUMS.txt" "$CHECKSUM_PATH"

EXPECTED_SHA="$(awk -v asset="$ASSET" '$2 == asset || $2 == "*" asset { print $1; exit }' "$CHECKSUM_PATH")"
if [ -z "$EXPECTED_SHA" ]; then
  printf 'The OpenSlideX release checksum does not list %s.\n' "$ASSET" >&2
  exit 1
fi
ACTUAL_SHA="$(shasum -a 256 "$ARCHIVE_PATH" | awk '{ print $1 }')"
if [ "$EXPECTED_SHA" != "$ACTUAL_SHA" ]; then
  printf 'OpenSlideX download checksum verification failed. Nothing was installed.\n' >&2
  exit 1
fi

EXTRACT_ROOT="$TEMP_ROOT/extract"
mkdir -p "$EXTRACT_ROOT"
tar -xzf "$ARCHIVE_PATH" -C "$EXTRACT_ROOT"
RELEASE_SOURCE="$EXTRACT_ROOT/open-slidex"
if [ ! -f "$RELEASE_SOURCE/VERSION" ] || [ ! -f "$RELEASE_SOURCE/release.json" ]; then
  printf 'The OpenSlideX release archive is incomplete. Nothing was installed.\n' >&2
  exit 1
fi
VERSION="$(tr -d '\r\n' < "$RELEASE_SOURCE/VERSION")"
case "$VERSION" in
  ""|*[!0-9A-Za-z._-]*)
    printf 'The OpenSlideX release has an invalid version. Nothing was installed.\n' >&2
    exit 1
    ;;
esac

mkdir -p "$INSTALL_ROOT/versions" "$BIN_DIR"
VERSION_ROOT="$INSTALL_ROOT/versions/$VERSION"
STAGED_VERSION="$INSTALL_ROOT/versions/.install-$VERSION-$$"
rm -rf "$STAGED_VERSION"
mv "$RELEASE_SOURCE" "$STAGED_VERSION"
CURRENT_VERSION=""
if [ -f "$INSTALL_ROOT/current" ]; then CURRENT_VERSION="$(cat "$INSTALL_ROOT/current")"; fi
if [ "$CURRENT_VERSION" = "$VERSION" ] && [ -d "$VERSION_ROOT" ]; then
  rm -rf "$STAGED_VERSION"
else
  if [ -d "$VERSION_ROOT" ]; then rm -rf "$VERSION_ROOT"; fi
  mv "$STAGED_VERSION" "$VERSION_ROOT"
fi
printf '%s\n' "$VERSION" > "$INSTALL_ROOT/current"
for INSTALLED_VERSION in "$INSTALL_ROOT"/versions/*; do
  [ -d "$INSTALLED_VERSION" ] || continue
  if [ "$INSTALLED_VERSION" != "$VERSION_ROOT" ]; then rm -rf "$INSTALLED_VERSION"; fi
done
printf '%s\n' "$BIN_DIR" > "$INSTALL_ROOT/bin-dir"
printf '%s\n' "$INSTALLER_URL" > "$INSTALL_ROOT/installer-url"
printf 'open-slidex-standalone\n' > "$INSTALL_ROOT/.open-slidex-install"

if [ ! -f "$INSTALL_ROOT/workspace" ]; then
  WORKSPACE_ROOT="${OPEN_SLIDEX_WORKSPACE:-$HOME/Documents/OpenSlideX Workspace}"
  mkdir -p "$WORKSPACE_ROOT"
  printf '%s\n' "$WORKSPACE_ROOT" > "$INSTALL_ROOT/workspace"
fi

cat > "$INSTALL_ROOT/manager.sh" <<'MANAGER'
#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ ! -f "$ROOT/.open-slidex-install" ]; then
  printf 'OpenSlideX installation metadata is missing. Reinstall OpenSlideX.\n' >&2
  exit 1
fi
BIN_DIR="$(cat "$ROOT/bin-dir")"

download_file() {
  source_path="$1"
  destination="$2"
  case "$source_path" in
    http://*|https://*|file://*) curl -fsSL "$source_path" -o "$destination" ;;
    *) cp "$source_path" "$destination" ;;
  esac
}

remove_profile_entry() {
  profile_path="$1"
  [ -f "$profile_path" ] || return 0
  profile_temp="${profile_path}.open-slidex-$$"
  awk '
    $0 == "# >>> OpenSlideX >>>" { skip = 1; next }
    $0 == "# <<< OpenSlideX <<<" { skip = 0; next }
    !skip { print }
  ' "$profile_path" > "$profile_temp"
  mv "$profile_temp" "$profile_path"
}

case "${1:-}" in
  update)
    TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/open-slidex-update.XXXXXX")"
    trap 'rm -rf "$TEMP_ROOT"' EXIT HUP INT TERM
    INSTALLER_URL="${OPEN_SLIDEX_INSTALLER_URL:-$(cat "$ROOT/installer-url")}"
    INSTALLER_PATH="$TEMP_ROOT/install.sh"
    download_file "$INSTALLER_URL" "$INSTALLER_PATH"
    OPEN_SLIDEX_INSTALL_ROOT="$ROOT" \
      OPEN_SLIDEX_BIN_DIR="$BIN_DIR" \
      OPEN_SLIDEX_INSTALLER_URL="$INSTALLER_URL" \
      sh "$INSTALLER_PATH" --update
    exit $?
    ;;
  uninstall)
    if [ -f "$ROOT/profile-path" ]; then
      remove_profile_entry "$(cat "$ROOT/profile-path")"
    fi
    rm -f "$BIN_DIR/slidex" "$BIN_DIR/.open-slidex-root"
    rm -rf "$ROOT"
    printf 'OpenSlideX was uninstalled. Your Workspace presentations were kept.\n'
    exit 0
    ;;
esac

VERSION="$(cat "$ROOT/current")"
RELEASE_ROOT="$ROOT/versions/$VERSION"
NODE="$RELEASE_ROOT/node/bin/node"
CLI="$RELEASE_ROOT/app/node_modules/open-slidex/dist/cli.mjs"
if [ ! -x "$NODE" ] || [ ! -f "$CLI" ]; then
  printf 'OpenSlideX %s is incomplete. Run the installer again.\n' "$VERSION" >&2
  exit 1
fi
export PLAYWRIGHT_BROWSERS_PATH="$RELEASE_ROOT/browsers"
export OPEN_SLIDEX_STANDALONE="1"
if [ "$#" -eq 0 ]; then
  set -- workspace "$(cat "$ROOT/workspace")"
fi
exec "$NODE" "$CLI" "$@"
MANAGER
chmod 755 "$INSTALL_ROOT/manager.sh"

cat > "$BIN_DIR/slidex" <<'LAUNCHER'
#!/bin/sh
set -eu
ROOT_FILE="$(dirname -- "$0")/.open-slidex-root"
if [ ! -f "$ROOT_FILE" ]; then
  printf 'OpenSlideX launcher metadata is missing. Reinstall OpenSlideX.\n' >&2
  exit 1
fi
exec "$(cat "$ROOT_FILE")/manager.sh" "$@"
LAUNCHER
chmod 755 "$BIN_DIR/slidex"
printf '%s\n' "$INSTALL_ROOT" > "$BIN_DIR/.open-slidex-root"

PATH_UPDATED="0"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    if [ "${OPEN_SLIDEX_SKIP_PATH_UPDATE:-0}" != "1" ]; then
      case "${SHELL:-}" in
        */zsh) PROFILE_PATH="$HOME/.zprofile" ;;
        */bash) PROFILE_PATH="$HOME/.bash_profile" ;;
        *) PROFILE_PATH="$HOME/.profile" ;;
      esac
      if ! grep -Fq '# >>> OpenSlideX >>>' "$PROFILE_PATH" 2>/dev/null; then
        {
          printf '\n# >>> OpenSlideX >>>\n'
          printf 'export PATH="%s:$PATH"\n' "$BIN_DIR"
          printf '# <<< OpenSlideX <<<\n'
        } >> "$PROFILE_PATH"
      fi
      printf '%s\n' "$PROFILE_PATH" > "$INSTALL_ROOT/profile-path"
      PATH_UPDATED="1"
    fi
    ;;
esac

if [ "$MODE" = "update" ]; then
  printf 'OpenSlideX was updated to %s.\n' "$VERSION"
else
  printf 'OpenSlideX %s was installed.\n' "$VERSION"
fi
if [ "$PATH_UPDATED" = "1" ]; then
  printf 'Open a new terminal, then run: slidex\n'
else
  printf 'Run: %s/slidex\n' "$BIN_DIR"
fi
printf 'Update later with: slidex update\n'
printf 'Uninstall with: slidex uninstall\n'
