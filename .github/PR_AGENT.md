# PR-Agent setup

The workflow in `workflows/pr-agent.yml` uses the open-source
[PR-Agent GitHub Action](https://docs.pr-agent.ai/installation/github/).
It is **disabled by default** until a maintainer explicitly enables it.
It does not use the extension's Antigravity credentials or Copilot subscription.

## Gemini configuration

The initial provider choice is Gemini 3.8 Flash. Configure these repository
variables without changing the workflow:

```text
PR_AGENT_PROVIDER = gemini
PR_AGENT_MODEL = gemini/gemini-3.8-flash
PR_AGENT_ENABLED = false
```

Create an API key in [Google AI Studio](https://aistudio.google.com/apikey), then
save it as the `PR_AGENT_API_KEY` GitHub Actions secret using the instructions
below. Keep reviews disabled until the secret is present and the workflow has
reached `main`; then set `PR_AGENT_ENABLED` to `true`.

Google lists a [free tier for Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.8-flash),
subject to account/region eligibility and rate limits. Use an eligible free-tier
API project if you want free inference; a billing-enabled project can incur
charges. Free-tier content may be used to improve Google's products. This API
quota is separate from Antigravity or Copilot subscriptions.

## Enable later

After the workflow has been committed and pushed to `main`:

1. Choose a provider and an available model. Examples below are configuration
   examples, not a guarantee of access or free usage:

   | Provider variable | Example model variable | API key source |
   | --- | --- | --- |
   | `openai` | `gpt-4.1` | OpenAI API platform |
   | `gemini` | `gemini/gemini-3.8-flash` | Google AI Studio |
   | `openrouter` | `openrouter/openai/gpt-4.1` | OpenRouter |

2. In **Settings → Secrets and variables → Actions → Secrets**, create
   `PR_AGENT_API_KEY` with that provider's API key. Never put the key in a file,
   issue, PR comment, or chat. With GitHub CLI, use the interactive prompt:

   ```powershell
   gh secret set PR_AGENT_API_KEY --repo lutfi238/antigravity-for-copilot-vscode
   ```

3. In the **Variables** tab, create:
   - `PR_AGENT_PROVIDER`: one of `openai`, `gemini`, or `openrouter`.
   - `PR_AGENT_MODEL`: the matching model ID, using the format above.
   - `PR_AGENT_ENABLED`: `true` (set this **last**).

   No extra GitHub personal access token is needed: the workflow uses GitHub's
   short-lived `GITHUB_TOKEN`. Do not broaden the repository's default token
   permissions or enable **Allow GitHub Actions to create and approve pull requests**.

4. On an open PR, post exactly `/review` as an owner, organization member, or
   repository collaborator. Check the **Actions → PR Agent** run and its review
   comment. This is a paid/API-quota-consuming end-to-end test; it has not been
   run while credentials are unconfigured.

To pause reviews, set `PR_AGENT_ENABLED` to `false` or remove it. Missing enable,
provider, or model variables cause the job to be skipped; an enabled job with a
missing API key or mismatched model fails with a configuration message.

## Behavior and trust boundary

- Automatic reviews run on non-draft PRs targeting `main`, on open, reopen,
  ready-for-review, and new commits, only when the PR author's GitHub association
  is `OWNER`, `MEMBER`, or `COLLABORATOR`.
- Fork PRs from other contributors are not reviewed automatically. An owner,
  member, or collaborator can request a review by posting exactly `/review`.
  Other commands and command-line/configuration arguments are not accepted.
- Bot events, ordinary issues, and comments on closed PRs are ignored.
- `pull_request_target` runs trusted base-branch workflow code. There is **no
  checkout, dependency installation, build, or execution of PR code**. PR-Agent
  reads the proposed changes through GitHub's API.
- The job can read contents and write PR/issue feedback, but has no contents-write
  permission. Auto-approval, description rewriting, code improvement, and review
  labels are disabled. Review output is advisory, not a security guarantee.
- PR-provided `.pr_agent.toml`, per-directory/global settings, and repository
  instruction files are disabled for this workflow. Trusted review instructions
  live in the workflow environment instead.
- The selected provider receives PR content for analysis. Review its privacy,
  retention, pricing, and rate limits before enabling. Do not submit credentials
  or sensitive code. Prompt-injection guidance reduces risk but cannot guarantee
  correct model behavior. PR-Agent itself is trusted third-party code and receives
  the selected API key and short-lived GitHub token.
- Only the selected provider receives a configured credential. Model fallback is
  disabled, input budgeting is capped at 32,000 tokens, and each job has a
  15-minute timeout. Those limits are **not a monetary spending cap**; configure
  provider-side budgets/alerts as well. New commits can each incur another review.

## Pinned release and updates

The workflow pins the Docker image for PR-Agent **v0.48.0** by its immutable OCI
index digest, not `@main` or a mutable tag:

```text
pragent/pr-agent@sha256:80edef71baa3df28c129d858d4b53784abfc14704c235efb32b6c461d5399a6d
```

The digest was resolved from `pragent/pr-agent:0.48.0-github_action` on
2026-10-18. The release wrapper itself uses a rolling image, so pinning only
the wrapper's Git commit would not pin the code executing with secrets.

For updates, review the upstream release and security notes, resolve its image
digest, and verify the upstream GitHub artifact attestation before changing the
pin. For this release:

```powershell
gh attestation verify "oci://index.docker.io/pragent/pr-agent@sha256:80edef71baa3df28c129d858d4b53784abfc14704c235efb32b6c461d5399a6d" --repo The-PR-Agent/pr-agent
```

Validate YAML and GitHub expressions with `actionlint .github/workflows/pr-agent.yml`
and keep the no-checkout, association, exact-command, and permission safeguards.

References: [official GitHub setup](https://docs.pr-agent.ai/installation/github/),
[model configuration](https://docs.pr-agent.ai/usage-guide/changing_a_model/), and
[GitHub's pull_request_target security guidance](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target).
