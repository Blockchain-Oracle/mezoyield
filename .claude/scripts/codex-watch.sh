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
  local head_sha head_pushed_at
  head_sha="$(gh api "repos/$REPO/pulls/$PR" --jq .head.sha)"
  # Use the commit's committer date as a "head exists since" floor. Any
  # Codex top-level approval comment/reaction with a timestamp AFTER this
  # is a head-specific signal. Codex's "Chef's kiss / no major issues"
  # path drops a top-level issue comment + a 👍 reaction without filing a
  # formal Reviews API entry, so this is the only way to detect approval.
  head_pushed_at="$(gh api "repos/$REPO/commits/$head_sha" --jq .commit.committer.date)"
  echo "── PR #$PR · head=${head_sha:0:10} · pushed=$head_pushed_at · repo=$REPO ──"

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
  # Reactions are NOT commit-scoped — a 👍 from an earlier commit persists
  # forever — so we filter by created_at > head_pushed_at to know whether
  # the latest reaction is for the current head.
  local thumbs_up_on_head
  thumbs_up_on_head="$(gh api "repos/$REPO/issues/$PR/reactions" \
    --jq "[.[] | select(.user.login==\"$BOT\") | select(.content==\"+1\") | select(.created_at > \"$head_pushed_at\")] | length")"
  local eyes_on_head
  eyes_on_head="$(gh api "repos/$REPO/issues/$PR/reactions" \
    --jq "[.[] | select(.user.login==\"$BOT\") | select(.content==\"eyes\") | select(.created_at > \"$head_pushed_at\")] | length")"

  # 4. Top-level issue comments posted AFTER head was pushed. Codex uses
  # this for "no major issues" approvals (text body like "Chef's kiss" /
  # "Didn't find any major issues") in lieu of a formal Reviews entry.
  local approval_comment_count
  approval_comment_count="$(gh api "repos/$REPO/issues/$PR/comments" \
    --jq "[.[] | select(.user.login==\"$BOT\") | select(.created_at > \"$head_pushed_at\") | select(.body | test(\"(?i)didn't find any major issues|chef's kiss|no major issues\"))] | length")"

  echo "  Codex reviews filed on head: $reviews_on_head"
  echo "  Codex inline findings filed on head: $inline_count"
  echo "  Codex review-body findings on head (P-badge in body): $body_finding_count"
  echo "  Codex carried-forward findings (still anchor to head): $carried_count"
  echo "  Codex reactions on head (post-push): 👍×$thumbs_up_on_head 👀×$eyes_on_head"
  echo "  Codex \"no major issues\" approval comments on head: $approval_comment_count"

  # Findings on head — print both inline AND review-body (Codex uses both).
  if [ "$inline_count" -gt 0 ] || [ "$body_finding_count" -gt 0 ]; then
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
    echo "  → STATUS: findings present — triage above."
    return 1
  fi

  # Approval signals on head:
  #   (a) "no major issues" / "Chef's kiss" top-level comment posted after
  #       the head SHA was pushed, AND/OR
  #   (b) a 👍 reaction posted after the head SHA was pushed, AND/OR
  #   (c) a Reviews API entry filed against head SHA with no findings.
  if [ "$approval_comment_count" -gt 0 ] || [ "$thumbs_up_on_head" -gt 0 ]; then
    echo "  → STATUS: approved (Codex left a no-findings comment / 👍 after head was pushed)."
    return 0
  fi

  if [ "$reviews_on_head" -gt 0 ]; then
    echo "  → STATUS: reviewed clean (headline review, no inline or body findings)."
    return 0
  fi

  # Pending — Codex hasn't yet emitted any head-specific signal.
  if [ "$eyes_on_head" -gt 0 ]; then
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
