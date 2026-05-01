#!/usr/bin/env bash
# codex-watch.sh — surface every Codex review signal on a PR.
#
# Why this exists: `gh pr view` only shows the *headline* review body
# ("Here are some automated review suggestions"). The actual P1/P2/P3
# findings are inline comments on a different API endpoint, and Codex
# also signals state via emoji reactions on the PR. Three endpoints
# must be polled to know the full state:
#
#   1. /pulls/<n>/reviews          — headline review submissions (state)
#   2. /pulls/<n>/comments         — inline per-line P1/P2/P3 (the meat)
#   3. /issues/<n>/reactions       — eyes=reviewing, +1=approved
#
# Codex bot login: chatgpt-codex-connector[bot]
#
# Usage: .claude/scripts/codex-watch.sh <pr-number> [--watch]
#   --watch  poll every 30s until Codex has reviewed the head SHA and
#            either reacted +1 or its findings are printed.
#
# Exit codes:
#   0  Codex has reviewed head SHA and approved (👍 reaction)
#   1  Codex has reviewed head SHA and left findings (printed above)
#   2  Codex has not yet reviewed head SHA (still pending)
#   3  Bad invocation / API error

set -euo pipefail

PR="${1:?usage: codex-watch.sh <pr-number> [--watch]}"
WATCH="${2:-}"
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
BOT="chatgpt-codex-connector[bot]"

check_once() {
  local head_sha
  head_sha="$(gh api "repos/$REPO/pulls/$PR" --jq .head.sha)"
  echo "── PR #$PR · head=${head_sha:0:10} · repo=$REPO ──"

  # 1. Headline reviews from Codex (filtered to head SHA).
  local reviews_on_head
  reviews_on_head="$(gh api "repos/$REPO/pulls/$PR/reviews" \
    --jq "[.[] | select(.user.login==\"$BOT\") | select(.commit_id==\"$head_sha\")] | length")"

  # 2. Inline per-line comments from Codex on the head SHA.
  local inline_json
  inline_json="$(gh api "repos/$REPO/pulls/$PR/comments" \
    --jq "[.[] | select(.user.login==\"$BOT\") | select(.commit_id==\"$head_sha\") | {path,line,body,created_at}]")"
  local inline_count
  inline_count="$(echo "$inline_json" | jq 'length')"

  # 3. Reactions on the PR-as-issue (Codex thumbs-up = approval).
  local thumbs_up
  thumbs_up="$(gh api "repos/$REPO/issues/$PR/reactions" \
    --jq "[.[] | select(.user.login==\"$BOT\") | select(.content==\"+1\")] | length")"
  local eyes
  eyes="$(gh api "repos/$REPO/issues/$PR/reactions" \
    --jq "[.[] | select(.user.login==\"$BOT\") | select(.content==\"eyes\")] | length")"

  echo "  Codex reviews on head: $reviews_on_head"
  echo "  Codex inline comments on head: $inline_count"
  echo "  Codex reactions: 👍×$thumbs_up 👀×$eyes"

  # No review yet against the head SHA.
  if [ "$reviews_on_head" -eq 0 ] && [ "$inline_count" -eq 0 ]; then
    echo "  → STATUS: pending (Codex has not yet reviewed $head_sha)"
    return 2
  fi

  # Reviewed. Print findings.
  if [ "$inline_count" -gt 0 ]; then
    echo
    echo "── Codex inline findings on head ──"
    echo "$inline_json" | jq -r '.[] | "[\(.created_at)] \(.path):\(.line)\n\(.body)\n---"'
    echo
    echo "  → STATUS: findings present — triage above."
    return 1
  fi

  if [ "$thumbs_up" -gt 0 ]; then
    echo "  → STATUS: approved (👍 on head)"
    return 0
  fi

  # Headline review with no inline findings and no thumbs-up — Codex
  # left a top-level comment-only review (rare, but possible).
  echo "  → STATUS: reviewed but no inline findings; check headline body."
  return 0
}

if [ "$WATCH" = "--watch" ]; then
  while :; do
    set +e
    check_once
    rc=$?
    set -e
    [ $rc -ne 2 ] && exit $rc
    echo "  (re-checking in 30s...)"
    sleep 30
  done
fi

check_once
