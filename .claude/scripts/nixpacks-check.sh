#!/usr/bin/env bash
# Smoke for nixpacks.toml — validate the workspace-filter contract
# that Coolify/nixpacks will execute on deploy. Catches mismatches
# between the toml's default APP_NAME values and the actual workspace
# package.json files (typos, renames, removed `start`/`build` scripts).
#
# This does NOT run a full nixpacks Docker build — that needs
# `nixpacks` CLI installed locally and a Docker daemon. It validates
# the contract between the toml and the workspace, which is where
# config drift bugs actually live.
#
# Codex P2 on PR #29: "no committed test exercises the Nixpacks plan
# or the selected workspace build, so mistakes in phase keys, workspace
# filters, or required build-time env handling will only surface during
# deployment." This script is that test.

set -euo pipefail

PASS=true
fail() { echo "✗ $1" >&2; PASS=false; }

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

[ -f nixpacks.toml ] || { echo "✗ nixpacks.toml missing at repo root"; exit 1; }
command -v node >/dev/null || { echo "✗ node required"; exit 1; }

# Tiny JSON-path reader. Avoids depending on jq, which isn't part of
# the repo's standard toolchain (codex P2 on round 3 of this PR).
# Returns empty string when the path doesn't resolve.
json_get() {
  local file="$1"
  local path="$2"
  node -e "
    const fs = require('fs');
    const obj = JSON.parse(fs.readFileSync('$file', 'utf8'));
    const v = '$path'.split('.').reduce((a, k) => (a == null ? a : a[k]), obj);
    process.stdout.write(v == null ? '' : String(v));
  " 2>/dev/null
}

# Hardcoded contract: each deployable APP_NAME must map to a workspace
# package with BOTH `build` and `start` scripts. Adding a new service?
# Update both arrays in lockstep AND the comment block at the top of
# nixpacks.toml.
#
# Parallel arrays (not `declare -A`) for compatibility with macOS's
# default bash 3.2, which doesn't support associative arrays.
APP_NAMES=("@mezoyield/app" "@mezoyield/keeper")
APP_DIRS=("packages/app" "packages/keeper")

for i in "${!APP_NAMES[@]}"; do
  name="${APP_NAMES[$i]}"
  dir="${APP_DIRS[$i]}"
  pkg="$dir/package.json"
  echo "▶ $name → $dir"
  [ -f "$pkg" ] || { fail "$name: $pkg missing"; continue; }
  actual=$(json_get "$pkg" "name")
  [ "$actual" = "$name" ] || fail "$name: package.json says name='$actual', toml expects '$name'"
  for s in build start; do
    val=$(json_get "$pkg" "scripts.$s")
    if [ -z "$val" ]; then
      fail "$name: missing scripts.$s"
    else
      echo "  ✓ scripts.$s = $val"
    fi
  done
done

# Contracts is always built (typechain types), even though it's never
# started — verify it has a build script.
contracts_pkg="packages/contracts/package.json"
[ -f "$contracts_pkg" ] || { fail "contracts package missing"; exit 1; }
val=$(json_get "$contracts_pkg" "scripts.build")
if [ -z "$val" ]; then
  fail "contracts: missing scripts.build (nixpacks.toml's build phase always runs it)"
else
  echo "▶ @mezoyield/contracts → packages/contracts (build-only)"
  echo "  ✓ scripts.build = $val"
fi

# onlyIncludeFiles in nixpacks.toml's install phase should reference
# every workspace package.json — drift here means the install layer's
# Docker COPY fails before the build phase runs. Cross-check against
# the toml.
echo "▶ install phase: onlyIncludeFiles ↔ workspace coverage"
for dir in packages/app packages/contracts packages/keeper; do
  if grep -qE "^\s*\"${dir}/package.json\"" nixpacks.toml; then
    echo "  ✓ ${dir}/package.json listed"
  else
    fail "nixpacks.toml install.onlyIncludeFiles missing '${dir}/package.json'"
  fi
done

# Required nixpacks sections must be present. Catches typos in phase
# keys (e.g. `[phase.install]` instead of `[phases.install]`) that
# would silently produce a no-op build phase on Coolify.
echo "▶ nixpacks.toml structure"
for section in '\[phases.install\]' '\[phases.build\]' '\[start\]'; do
  if grep -qE "^${section}" nixpacks.toml; then
    echo "  ✓ ${section} present"
  else
    fail "nixpacks.toml missing required section: ${section}"
  fi
done

# Node version must be pinned in package.json's engines. Nixpacks
# reads this natively. Without it, Coolify gets the latest Node
# nixpacks auto-detects, which Hardhat 2.22 rejects on >=24.
echo "▶ Node version pin"
node_engine=$(json_get "package.json" "engines.node")
if [ -z "$node_engine" ]; then
  fail "package.json missing engines.node — nixpacks won't pin Node version on deploy"
else
  echo "  ✓ engines.node = $node_engine"
fi

# If nixpacks CLI is installed, generate the actual plan to catch
# anything our toml grep missed (malformed cmds, schema drift).
# Otherwise skip with a clear note.
if command -v nixpacks >/dev/null 2>&1; then
  echo "▶ nixpacks plan (CLI available — running real plan)"
  for name in "${APP_NAMES[@]}"; do
    APP_NAME="$name" nixpacks plan . >/dev/null 2>&1 \
      || fail "nixpacks plan failed for APP_NAME=$name"
    echo "  ✓ APP_NAME=$name"
  done
else
  echo "↷ nixpacks CLI not installed — skipping live plan check"
  echo "  (install: curl -sSL https://nixpacks.com/install.sh | bash)"
fi

if [ "$PASS" = true ]; then
  echo
  echo "✅ nixpacks deploy contract intact"
  exit 0
else
  echo
  echo "❌ deploy contract broken — fix nixpacks.toml or workspace before pushing"
  exit 1
fi
