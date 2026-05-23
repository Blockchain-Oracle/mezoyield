# AGENTS.md

Conventions for AI coding/review tools working in this repo (Codex CLI, OpenAI Codex GitHub App, and anything else following the AGENTS.md spec).

The closest AGENTS.md to a changed file wins. Place tighter rules under `packages/<x>/AGENTS.md` if a module needs them.

## Review guidelines

### Block on
- New behavior shipped without a corresponding test.
- Swallowed errors (`catch (_) {}`, broad `except: pass`, `|| true` on commands whose failure matters). Errors must surface or be logged with reason.
- Mock data, placeholder strings, or fabricated values in hot-path source (see "House rules" in `CLAUDE.md`).
- Disabling lint rules inline, skipping tests via `.skip`, or `--no-verify` git pushes.
- Direct writes to `main` or other protected branches.
- Hardcoded secrets, API keys, or tokens.
- Hardcoded sponsor or stakeholder identifiers inside operating logic — those belong in config.

### Flag (don't auto-block)
- Three or more similar lines suggesting an abstraction may be premature.
- New dependencies for trivial functionality.
- Comments narrating what code does. Comments are for the *why*.
- Backwards-compatibility shims when the upstream caller can be updated in the same PR.

### Approve fast
- Tests that exercise behavior described in the PR.
- Code that matches existing patterns in the same package.
- Diffs that delete more than they add.

### Codex-specific
- If a PR comment mentions `@codex review`, run an additional review pass.
- If a PR comment mentions `@codex <free-text>`, treat as a Codex Cloud task request, not a review pass.

## Build & test

See `CLAUDE.md` for the contributor guide and the full local gate. CI runs the same checks on every PR.

