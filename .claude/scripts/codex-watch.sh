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
  # Codex sometimes embeds findings IN the review body itself (with a deep
  # link to the file:line and a P-badge image), separate from inline
  # comments — so we surface the body too when it carries a P-badge.
  local reviews_on_head
  reviews_on_head="$(gh api "repos/$REPO/pulls/$PR/reviews" \
    --jq "[.[] | select(.user.login==\"$BOT\") | select(.commit_id==\"$head_sha\")] | length")"
  local review_body_findings
  review_body_findings="$(gh api "repos/$REPO/pulls/$PR/reviews" \
    --jq "[.[] | select(.user.login==\"$BOT\") | select(.commit_id==\"$head_sha\") | select(.body | test(\"P[0-9]\\\\s*Badge\")) | .body]")"
  local body_finding_count
  body_finding_count="$(echo "$review_body_findings" | jq 'length')"

  # 2. Inline per-line comments from Codex filed AGAINST the head SHA.
  #
  # Subtle GitHub API behavior: each review comment has two commit fields.
  # `original_commit_id` is immutable (the commit the comment was actually
  # filed on); `commit_id` auto-bumps forward to the latest commit where
  # the line position still resolves. Filtering by `commit_id == head_sha`
  # gives false positives — older findings that GitHub bubbled up because
  # the diff context is still alive in the file. The truthful "Codex filed
  # this against THIS commit" signal is `original_commit_id == head_sha`.
  # We additionally surface (separately) any prior findings whose
  # `position` is non-null + `commit_id == head_sha`, since those are
  # un-resolved findings from earlier commits that still apply to the
  # current head and may need triage.
  local inline_json
  inline_json="$(gh api "repos/$REPO/pulls/$PR/comments" \
    --jq "[.[] | select(.user.login==\"$BOT\") | select(.original_commit_id==\"$head_sha\") | {path,line,body,created_at}]")"
  local inline_count
  inline_count="$(echo "$inline_json" | jq 'length')"

  local carried_json
  carried_json="$(gh api "repos/$REPO/pulls/$PR/comments" \
    --jq "[.[] | select(.user.login==\"$BOT\") | select(.original_commit_id!=\"$head_sha\") | select(.commit_id==\"$head_sha\") | select(.position!=null) | {path,line,body,created_at,original_commit_id}]")"
  local carried_count
  carried_count="$(echo "$carried_json" | jq 'length')"

  # 3. Reactions on the PR-as-issue (Codex thumbs-up = approval).
  local thumbs_up
  thumbs_up="$(gh api "repos/$REPO/issues/$PR/reactions" \
    --jq "[.[] | select(.user.login==\"$BOT\") | select(.content==\"+1\")] | length")"
  local eyes
  eyes="$(gh api "repos/$REPO/issues/$PR/reactions" \
    --jq "[.[] | select(.user.login==\"$BOT\") | select(.content==\"eyes\")] | length")"

  echo "  Codex reviews filed on head: $reviews_on_head"
  echo "  Codex inline findings filed on head: $inline_count"
  echo "  Codex review-body findings on head (P-badge in body): $body_finding_count"
  echo "  Codex carried-forward findings (still anchor to head): $carried_count"
  echo "  Codex reactions: 👍×$thumbs_up 👀×$eyes"

  # No review yet against the head SHA. (Reactions on PR-as-issue do NOT
  # signal head-specific approval — Codex doesn't dismiss old ones on push.
  # The real "approved this commit" signal is a review filed against head.)
  if [ "$reviews_on_head" -eq 0 ] && [ "$inline_count" -eq 0 ]; then
    if [ "$eyes" -gt 0 ]; then
      echo "  → STATUS: pending (Codex is reviewing $head_sha — 👀 reaction present)"
    else
      echo "  → STATUS: pending (Codex has not yet reviewed $head_sha)"
    fi
    if [ "$carried_count" -gt 0 ]; then
      echo
      echo "  ⚠ $carried_count earlier finding(s) still anchor to head — possibly unaddressed:"
      echo "$carried_json" | jq -r '.[] | "    - [" + (.original_commit_id[0:10]) + "] " + .path + ":" + (.line|tostring) + " — " + (.body | split("\n") | .[0])'
    fi
    return 2
  fi

  # Print findings — both inline AND review-body (Codex uses both channels).
  if [ "$inline_count" -gt 0 ]; then
    echo
    echo "── Codex inline findings filed against $head_sha ──"
    echo "$inline_json" | jq -r '.[] | "[\(.created_at)] \(.path):\(.line)\n\(.body)\n---"'
  fi
  if [ "$body_finding_count" -gt 0 ]; then
    echo
    echo "── Codex review-body findings filed against $head_sha ──"
    echo "$review_body_findings" | jq -r '.[] | . + "\n---"'
  fi
  if [ "$inline_count" -gt 0 ] || [ "$body_finding_count" -gt 0 ]; then
    echo "  → STATUS: findings present — triage above."
    return 1
  fi

  if [ "$reviews_on_head" -gt 0 ]; then
    echo "  → STATUS: reviewed clean (headline review, no inline or body findings)."
    return 0
  fi

  echo "  → STATUS: indeterminate; inspect manually."
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
