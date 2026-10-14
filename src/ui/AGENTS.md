# Extension UI

## Purpose

- Present account, quota, logs, settings, and refresh actions through native VS Code UI.

## Ownership

- `manage.ts` owns the management QuickPick and sign-in/auth-status flows.
- `statusBar.ts` owns signed-out, loading, hidden, and quota-summary status bar states.

## Local Contracts

- Use native VS Code commands, QuickPick/message APIs, settings navigation, and status bar items.
- Keep account switching and removal synchronized with `AccountStore` notifications and provider refresh.
- Display two quota groups: Gemini (all models, including Pro and Flash) and Claude/GPT.
- Display account AI credit balance separately from baseline quota, preserving explicit zero and distinguishing missing metadata. Credit display never changes spending settings.
- Keep the bar compact; separate account/plan and each quota/reset group in the tooltip. Show only backend-reported plans, distinguish loading from missing metadata, count models actually offered in the picker, and ignore late plan updates for another account.
- Respect `antigravity.showStatusBar` and dispose all UI resources through the extension context.
- User-facing errors should be actionable and must not reveal credentials, tokens, prompts, or tool data.

## Work Guidance

- Keep UI orchestration thin; authentication and catalogue rules remain in their owning modules.
- Update `package.json` command/configuration contributions and README text when public UI changes.

## Verification

- `npm run typecheck`
- `npm test -- test/statusBar.test.ts` verifies quota text with a mocked VS Code status bar; exercise real rendering, QuickPick and command flows in an Extension Development Host.

## Child DOX Index

- No child AGENTS.md files are needed; this folder is one native VS Code UI boundary.
