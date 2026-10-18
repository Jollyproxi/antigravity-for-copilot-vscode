# GitHub automation

## Ownership and contracts

- `workflows/pr-agent.yml` owns opt-in PR-Agent reviews; `PR_AGENT.md` documents
  activation, credentials, cost, trust boundaries, and release pins.
- Keep the bot disabled until a maintainer supplies its repository variables and
  API-key secret. Never reuse local OAuth credentials or commit API keys.
- Pin the executing Docker image by digest, not a rolling wrapper or image tag.
- Never check out or execute contributor code in this privileged workflow.
- Automatic reviews accept all human contributors, including forks and first-time
  contributors; preserve the draft/bot exclusions and exact, trusted-commenter
  `/review` gate. Never interpolate PR text into shell commands or settings.
- Keep contents read-only; do not enable approval, merge, code pushes, or arbitrary
  comment-command/configuration execution. Disable PR-supplied settings/context.
- Keep these maintenance files excluded from VSIX packaging.

## Verification

- `actionlint .github/workflows/pr-agent.yml` validates YAML and expressions.
- Exercise provider validation with synthetic keys only; never print real keys.
- End-to-end review needs a configured provider and incurs API usage. Do not claim
  a live review succeeded based only on lint or a skipped workflow.
