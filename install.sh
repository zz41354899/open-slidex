#!/bin/sh
set -eu

REPOSITORY="zz41354899/open-slidex"
DEFAULT_RELEASE_BASE_URL="https://github.com/$REPOSITORY/releases/latest/download"
RELEASE_BASE_URL="${OPEN_SLIDEX_RELEASE_BASE_URL:-$DEFAULT_RELEASE_BASE_URL}"
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

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

is_valid_version() {
  printf '%s\n' "$1" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$'
}

write_pointer() {
  pointer_path="$1"
  pointer_value="$2"
  pointer_temp="${pointer_path}.tmp.$$"
  rm -f "$pointer_temp"
  printf '%s\n' "$pointer_value" > "$pointer_temp"
  mv "$pointer_temp" "$pointer_path"
}

download_file() {
  source_path="$1"
  destination="$2"
  case "$source_path" in
    http://*|https://*|file://*) curl -fsSL "$source_path" -o "$destination" ;;
    *) cp "$source_path" "$destination" ;;
  esac
}

json_string() {
  key="$1"
  file="$2"
  sed -n 's/^[[:space:]]*"'"$key"'"[[:space:]]*:[[:space:]]*"\([^"]*\)"[,[:space:]]*$/\1/p' "$file"
}

validate_archive_entries() {
  archive="$1"
  entry_list="$TEMP_ROOT/archive-entries.txt"
  verbose_list="$TEMP_ROOT/archive-verbose.txt"
  tar -tzf "$archive" > "$entry_list" || return 1
  tar -tvzf "$archive" > "$verbose_list" || return 1
  awk '
    BEGIN { found_root = 0; found_child = 0 }
    {
      raw = $0
      if (raw ~ /\\/ || raw ~ /[[:cntrl:]]/) exit 1
      name = raw
      sub(/\/$/, "", name)
      if (name == "" || name ~ /^\//) exit 1
      count = split(name, parts, "/")
      if (parts[1] != "open-slidex") exit 1
      for (part_index = 1; part_index <= count; part_index++) {
        if (parts[part_index] == "" || parts[part_index] == "." || parts[part_index] == "..") exit 1
      }
      folded = tolower(name)
      if (seen[folded]++) exit 1
      if (name == "open-slidex") found_root = 1
      else found_child = 1
    }
    END { if (!found_root || !found_child) exit 1 }
  ' "$entry_list" || return 1
  awk '
    substr($0, 1, 1) !~ /^[-dlh]$/ { exit 1 }
    substr($0, 1, 1) == "l" {
      marker = " -> "
      marker_index = index($0, marker)
      if (!marker_index) exit 1
      target = substr($0, marker_index + length(marker))
      if (target == "" || target ~ /^\// || target ~ /\\/) exit 1
    }
    substr($0, 1, 1) == "h" {
      marker = " link to "
      marker_index = index($0, marker)
      if (!marker_index) exit 1
      target = substr($0, marker_index + length(marker))
      if (target !~ /^open-slidex\// || target ~ /\\/) exit 1
      count = split(target, parts, "/")
      for (part_index = 1; part_index <= count; part_index++) {
        if (parts[part_index] == "" || parts[part_index] == "." || parts[part_index] == "..") exit 1
      }
    }
  ' "$verbose_list" || return 1
}

validate_extracted_links() {
  release_root="$1"
  failure_marker="$TEMP_ROOT/link-validation-failed"
  find "$release_root" -type l -print | while IFS= read -r link_path; do
    link_target="$(readlink "$link_path")" || { : > "$failure_marker"; break; }
    case "$link_target" in
      /*) : > "$failure_marker"; break ;;
    esac
    if [ -d "$link_path" ]; then
      resolved_target="$(CDPATH= cd -- "$link_path" 2>/dev/null && pwd -P)" || {
        : > "$failure_marker"
        break
      }
    else
      target_parent="$(dirname -- "$link_target")"
      target_name="$(basename -- "$link_target")"
      resolved_parent="$(CDPATH= cd -- "$(dirname -- "$link_path")/$target_parent" 2>/dev/null && pwd -P)" || {
        : > "$failure_marker"
        break
      }
      resolved_target="$resolved_parent/$target_name"
      [ -e "$resolved_target" ] || { : > "$failure_marker"; break; }
    fi
    case "$resolved_target" in
      "$release_root"|"$release_root"/*) ;;
      *) : > "$failure_marker"; break ;;
    esac
  done
  [ ! -e "$failure_marker" ]
}

if [ "$(uname -s)" != "Darwin" ]; then
  fail 'OpenSlideX standalone installation is available only on macOS. Use npx open-slidex@latest on other platforms.'
fi

case "$(uname -m)" in
  arm64) TARGET="darwin-arm64"; EXPECTED_ARCH="arm64" ;;
  x86_64) TARGET="darwin-x64"; EXPECTED_ARCH="x64" ;;
  *) fail "OpenSlideX does not support this macOS architecture: $(uname -m)" ;;
esac

ASSET="open-slidex-$TARGET.tar.gz"
TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/open-slidex-install.XXXXXX")"
trap 'rm -rf "$TEMP_ROOT"' EXIT HUP INT TERM

ARCHIVE_PATH="$TEMP_ROOT/$ASSET"
CHECKSUM_PATH="$TEMP_ROOT/SHA256SUMS.txt"
BUNDLE_PATH="$TEMP_ROOT/$ASSET.intoto.jsonl"
download_file "$RELEASE_BASE_URL/$ASSET" "$ARCHIVE_PATH"
download_file "$RELEASE_BASE_URL/SHA256SUMS.txt" "$CHECKSUM_PATH"
if [ "$RELEASE_BASE_URL" = "$DEFAULT_RELEASE_BASE_URL" ]; then
  download_file "$RELEASE_BASE_URL/$ASSET.intoto.jsonl" "$BUNDLE_PATH"
fi

EXPECTED_SHA="$(awk -v asset="$ASSET" '$2 == asset || $2 == "*" asset { print $1; exit }' "$CHECKSUM_PATH")"
case "$EXPECTED_SHA" in ""|*[!0-9a-fA-F]*) fail "The OpenSlideX release checksum for $ASSET is invalid." ;; esac
[ "${#EXPECTED_SHA}" -eq 64 ] || fail "The OpenSlideX release checksum for $ASSET is invalid."
ACTUAL_SHA="$(shasum -a 256 "$ARCHIVE_PATH" | awk '{ print $1 }')"
[ "$(printf '%s' "$EXPECTED_SHA" | tr 'A-F' 'a-f')" = "$ACTUAL_SHA" ] || \
  fail 'OpenSlideX download checksum verification failed. Nothing was installed.'
validate_archive_entries "$ARCHIVE_PATH" || \
  fail 'The OpenSlideX archive has unsafe or conflicting paths. Nothing was installed.'

EXTRACT_ROOT="$TEMP_ROOT/extract"
mkdir -p "$EXTRACT_ROOT"
tar -xzf "$ARCHIVE_PATH" -C "$EXTRACT_ROOT"
EXTRACT_ROOT="$(CDPATH= cd -- "$EXTRACT_ROOT" && pwd -P)"
RELEASE_SOURCE="$EXTRACT_ROOT/open-slidex"
[ -d "$RELEASE_SOURCE" ] || fail 'The OpenSlideX release archive is incomplete. Nothing was installed.'
RELEASE_SOURCE="$(CDPATH= cd -- "$RELEASE_SOURCE" && pwd -P)"
[ "$RELEASE_SOURCE" = "$EXTRACT_ROOT/open-slidex" ] || \
  fail 'The OpenSlideX release root resolves outside the extraction directory. Nothing was installed.'
validate_extracted_links "$RELEASE_SOURCE" || \
  fail 'The OpenSlideX archive contains a link outside its release root. Nothing was installed.'

VERSION_PATH="$RELEASE_SOURCE/VERSION"
MANIFEST_PATH="$RELEASE_SOURCE/release.json"
[ -f "$VERSION_PATH" ] && [ ! -L "$VERSION_PATH" ] && [ -f "$MANIFEST_PATH" ] && [ ! -L "$MANIFEST_PATH" ] || \
  fail 'The OpenSlideX release archive is incomplete. Nothing was installed.'
VERSION="$(sed -n '1p' "$VERSION_PATH")"
[ "$(wc -l < "$VERSION_PATH" | tr -d ' ')" -eq 1 ] || fail 'The OpenSlideX release version must be one line.'
is_valid_version "$VERSION" || fail 'The OpenSlideX release has an invalid version. Nothing was installed.'
MANIFEST_VERSION="$(json_string version "$MANIFEST_PATH")"
MANIFEST_TARGET="$(json_string target "$MANIFEST_PATH")"
MANIFEST_PLATFORM="$(json_string platform "$MANIFEST_PATH")"
MANIFEST_ARCH="$(json_string architecture "$MANIFEST_PATH")"
MANIFEST_ASSET="$(json_string asset "$MANIFEST_PATH")"
MANIFEST_INSTALLER="$(json_string installer "$MANIFEST_PATH")"
[ "$MANIFEST_VERSION" = "$VERSION" ] && [ "$MANIFEST_TARGET" = "$TARGET" ] && \
  [ "$MANIFEST_PLATFORM" = "darwin" ] && [ "$MANIFEST_ARCH" = "$EXPECTED_ARCH" ] && \
  [ "$MANIFEST_ASSET" = "$ASSET" ] && [ "$MANIFEST_INSTALLER" = "install.sh" ] || \
  fail 'The OpenSlideX release identity does not match this macOS installer. Nothing was installed.'

if [ "$RELEASE_BASE_URL" = "$DEFAULT_RELEASE_BASE_URL" ]; then
  command -v gh >/dev/null 2>&1 || \
    fail 'GitHub CLI is required to verify the release attestation. Install gh, then run the installer again.'
  GH_CONFIG_DIR="$TEMP_ROOT/gh-config" GH_TOKEN='' GH_ENTERPRISE_TOKEN='' \
    gh attestation verify "$ARCHIVE_PATH" --repo "$REPOSITORY" --bundle "$BUNDLE_PATH" \
    --signer-workflow "$REPOSITORY/.github/workflows/standalone-release.yml" \
    --source-ref "refs/tags/v$VERSION" --deny-self-hosted-runners >/dev/null 2>&1 || \
    fail 'OpenSlideX release provenance verification failed. Nothing was installed.'
fi

NODE="$RELEASE_SOURCE/node/bin/node"
CLI="$RELEASE_SOURCE/app/node_modules/open-slidex/dist/cli.mjs"
ARCHIVE_INSTALLER="$RELEASE_SOURCE/install.sh"
[ -x "$NODE" ] && [ -f "$CLI" ] && [ ! -L "$CLI" ] && [ -f "$ARCHIVE_INSTALLER" ] && [ ! -L "$ARCHIVE_INSTALLER" ] || \
  fail 'The OpenSlideX release runtime is incomplete. Nothing was installed.'
"$NODE" "$CLI" --version >/dev/null 2>&1 || \
  fail 'The OpenSlideX release failed its pre-activation check. The installed version was not changed.'

[ ! -L "$INSTALL_ROOT" ] || fail 'The OpenSlideX install root must not be a symbolic link.'
[ ! -L "$BIN_DIR" ] || fail 'The OpenSlideX binary directory must not be a symbolic link.'
mkdir -p "$INSTALL_ROOT/versions" "$BIN_DIR"
INSTALL_ROOT="$(CDPATH= cd -- "$INSTALL_ROOT" && pwd -P)"
VERSIONS_ROOT="$(CDPATH= cd -- "$INSTALL_ROOT/versions" && pwd -P)"
BIN_DIR="$(CDPATH= cd -- "$BIN_DIR" && pwd -P)"
VERSION_ROOT="$VERSIONS_ROOT/$VERSION"
case "$VERSION_ROOT" in "$VERSIONS_ROOT"/*) ;; *) fail 'Invalid OpenSlideX version path.' ;; esac

CURRENT_VERSION=""
if [ -e "$INSTALL_ROOT/current" ] || [ -L "$INSTALL_ROOT/current" ]; then
  [ -f "$INSTALL_ROOT/current" ] && [ ! -L "$INSTALL_ROOT/current" ] || fail 'The installed current-version pointer is unsafe.'
  CURRENT_VERSION="$(sed -n '1p' "$INSTALL_ROOT/current")"
  [ "$(wc -l < "$INSTALL_ROOT/current" | tr -d ' ')" -eq 1 ] || fail 'The installed current-version pointer is invalid.'
  is_valid_version "$CURRENT_VERSION" || fail 'The installed current-version pointer is invalid.'
fi

STAGED_VERSION="$VERSIONS_ROOT/.install-$VERSION-$$"
rm -rf "$STAGED_VERSION"
mv "$RELEASE_SOURCE" "$STAGED_VERSION"
INSTALLER_TEMP="$INSTALL_ROOT/.installer.sh.$$"
rm -f "$INSTALLER_TEMP"
cp "$STAGED_VERSION/install.sh" "$INSTALLER_TEMP"
chmod 755 "$INSTALLER_TEMP"

if [ "$CURRENT_VERSION" = "$VERSION" ] && [ -d "$VERSION_ROOT" ]; then
  rm -rf "$STAGED_VERSION"
else
  if [ -e "$VERSION_ROOT" ]; then rm -rf "$VERSION_ROOT"; fi
  mv "$STAGED_VERSION" "$VERSION_ROOT"
fi

if [ -e "$INSTALL_ROOT/workspace" ] || [ -L "$INSTALL_ROOT/workspace" ]; then
  [ -f "$INSTALL_ROOT/workspace" ] && [ ! -L "$INSTALL_ROOT/workspace" ] || fail 'The OpenSlideX workspace pointer is unsafe.'
else
  WORKSPACE_ROOT="${OPEN_SLIDEX_WORKSPACE:-$HOME/Documents/OpenSlideX Workspace}"
  mkdir -p "$WORKSPACE_ROOT"
  printf '%s\n' "$WORKSPACE_ROOT" > "$INSTALL_ROOT/workspace"
fi

MANAGER_TEMP="$INSTALL_ROOT/.manager.sh.$$"
rm -f "$MANAGER_TEMP"
cat > "$MANAGER_TEMP" <<'MANAGER'
#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)"
[ -f "$ROOT/.open-slidex-install" ] || {
  printf 'OpenSlideX installation metadata is missing. Reinstall OpenSlideX.\n' >&2
  exit 1
}
BIN_DIR="$(cat "$ROOT/bin-dir")"

is_valid_version() {
  printf '%s\n' "$1" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$'
}

write_pointer() {
  pointer_path="$1"
  pointer_value="$2"
  pointer_temp="${pointer_path}.tmp.$$"
  rm -f "$pointer_temp"
  printf '%s\n' "$pointer_value" > "$pointer_temp"
  mv "$pointer_temp" "$pointer_path"
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
    [ -f "$ROOT/installer.sh" ] && [ ! -L "$ROOT/installer.sh" ] || {
      printf 'The verified OpenSlideX updater is missing. Reinstall from a release asset.\n' >&2
      exit 1
    }
    OPEN_SLIDEX_INSTALL_ROOT="$ROOT" OPEN_SLIDEX_BIN_DIR="$BIN_DIR" sh "$ROOT/installer.sh" --update
    exit $?
    ;;
  rollback)
    [ -f "$ROOT/current" ] && [ -f "$ROOT/previous" ] || {
      printf 'No previous OpenSlideX version is available for rollback.\n' >&2
      exit 1
    }
    CURRENT="$(sed -n '1p' "$ROOT/current")"
    PREVIOUS="$(sed -n '1p' "$ROOT/previous")"
    is_valid_version "$CURRENT" && is_valid_version "$PREVIOUS" && [ "$CURRENT" != "$PREVIOUS" ] || {
      printf 'OpenSlideX rollback metadata is invalid.\n' >&2
      exit 1
    }
    [ -x "$ROOT/versions/$PREVIOUS/node/bin/node" ] && \
      [ -f "$ROOT/versions/$PREVIOUS/app/node_modules/open-slidex/dist/cli.mjs" ] || {
      printf 'The previous OpenSlideX version is incomplete.\n' >&2
      exit 1
    }
    write_pointer "$ROOT/current" "$PREVIOUS"
    write_pointer "$ROOT/previous" "$CURRENT"
    printf 'OpenSlideX rolled back to %s.\n' "$PREVIOUS"
    exit 0
    ;;
  uninstall)
    if [ -f "$ROOT/profile-path" ]; then remove_profile_entry "$(cat "$ROOT/profile-path")"; fi
    rm -f "$BIN_DIR/slidex" "$BIN_DIR/.open-slidex-root"
    rm -rf "$ROOT"
    printf 'OpenSlideX was uninstalled. Your Workspace presentations were kept.\n'
    exit 0
    ;;
esac

VERSION="$(sed -n '1p' "$ROOT/current")"
is_valid_version "$VERSION" || {
  printf 'The installed OpenSlideX version pointer is invalid. Reinstall OpenSlideX.\n' >&2
  exit 1
}
RELEASE_ROOT="$ROOT/versions/$VERSION"
NODE="$RELEASE_ROOT/node/bin/node"
CLI="$RELEASE_ROOT/app/node_modules/open-slidex/dist/cli.mjs"
if [ ! -x "$NODE" ] || [ ! -f "$CLI" ]; then
  printf 'OpenSlideX %s is incomplete. Run slidex rollback or reinstall.\n' "$VERSION" >&2
  exit 1
fi
export PLAYWRIGHT_BROWSERS_PATH="$RELEASE_ROOT/browsers"
export OPEN_SLIDEX_STANDALONE="1"
if [ "$#" -eq 0 ]; then set -- workspace "$(cat "$ROOT/workspace")"; fi
exec "$NODE" "$CLI" "$@"
MANAGER
chmod 755 "$MANAGER_TEMP"

LAUNCHER_TEMP="$BIN_DIR/.slidex.$$"
rm -f "$LAUNCHER_TEMP"
cat > "$LAUNCHER_TEMP" <<'LAUNCHER'
#!/bin/sh
set -eu
ROOT_FILE="$(dirname -- "$0")/.open-slidex-root"
[ -f "$ROOT_FILE" ] || {
  printf 'OpenSlideX launcher metadata is missing. Reinstall OpenSlideX.\n' >&2
  exit 1
}
exec "$(cat "$ROOT_FILE")/manager.sh" "$@"
LAUNCHER
chmod 755 "$LAUNCHER_TEMP"

write_pointer "$INSTALL_ROOT/bin-dir" "$BIN_DIR"
write_pointer "$INSTALL_ROOT/.open-slidex-install" "open-slidex-standalone"
write_pointer "$BIN_DIR/.open-slidex-root" "$INSTALL_ROOT"
mv "$INSTALLER_TEMP" "$INSTALL_ROOT/installer.sh"
mv "$MANAGER_TEMP" "$INSTALL_ROOT/manager.sh"
mv "$LAUNCHER_TEMP" "$BIN_DIR/slidex"

if [ -n "$CURRENT_VERSION" ] && [ "$CURRENT_VERSION" != "$VERSION" ] && [ -d "$VERSIONS_ROOT/$CURRENT_VERSION" ]; then
  write_pointer "$INSTALL_ROOT/previous" "$CURRENT_VERSION"
else
  rm -f "$INSTALL_ROOT/previous"
fi
write_pointer "$INSTALL_ROOT/current" "$VERSION"

PREVIOUS_VERSION=""
if [ -f "$INSTALL_ROOT/previous" ]; then PREVIOUS_VERSION="$(sed -n '1p' "$INSTALL_ROOT/previous")"; fi
for INSTALLED_ROOT in "$VERSIONS_ROOT"/*; do
  [ -d "$INSTALLED_ROOT" ] || continue
  INSTALLED_VERSION="$(basename -- "$INSTALLED_ROOT")"
  if [ "$INSTALLED_VERSION" != "$VERSION" ] && [ "$INSTALLED_VERSION" != "$PREVIOUS_VERSION" ]; then
    rm -rf "$INSTALLED_ROOT"
  fi
done

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

if [ "$MODE" = "update" ]; then printf 'OpenSlideX was updated to %s.\n' "$VERSION"
else printf 'OpenSlideX %s was installed.\n' "$VERSION"
fi
if [ "$PATH_UPDATED" = "1" ]; then printf 'Open a new terminal, then run: slidex\n'
else printf 'Run: %s/slidex\n' "$BIN_DIR"
fi
printf 'Update later with: slidex update\n'
printf 'Rollback with: slidex rollback\n'
printf 'Uninstall with: slidex uninstall\n'
