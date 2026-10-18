# Antigravity Gemini quota-pool research

Date checked: 2026-10-07

## Decision

The current first-party evidence supports displaying **one combined Gemini baseline-quota status** for Antigravity's Gemini reasoning models, including Pro and Flash, while retaining a separate combined status for Claude and GPT models.

Confidence is **high for the product-level grouping shown to users** and **medium for the undocumented backend's internal accounting**. Google's current Models page explicitly presents two usage groups: `Gemini Models` and `Claude and GPT models`. The installed official Antigravity CLI reports those same two groups for the signed-in account. Google does not publish the private gateway's bucket identifiers or accounting algorithm, so the evidence establishes the supported UI meaning rather than the backend implementation.

This conclusion does not come from Pro and Flash having equal percentages. Equal values alone could be coincidental. It comes from Google's explicit group labels and the official client's current `/usage` output.

## Primary-source evidence

### 1. Current Antigravity Models page: explicit Gemini grouping

Google lists Gemini 3.8 Flash, 3.7 Flash, 3.6 Flash, and 3.1 Pro as selectable reasoning models. On the same page, the illustrated `View Usage` panel has one `Gemini Models` section with weekly and five-hour limits, followed by one `Claude and GPT models` section with its own weekly and five-hour limits. There are no separate Pro and Flash sections in that product UI. See [Google Antigravity Docs: Models](https://antigravity.google/docs/models).

This is the strongest published evidence for how quota should be summarized in a status bar because it is the current first-party UI contract and names the groups directly.

### 2. Installed official CLI: the same two groups

The official installed client was queried on 2026-10-07 with:

```powershell
agy.exe --print '/usage' --output-format text --print-timeout 20s
```

It exited successfully and reported:

```text
Gemini Models
  Weekly Limit Remaining: 95%
  Five Hour Limit Remaining: 93%
Claude and GPT models
  Weekly Limit Remaining: 48%
  Five Hour Limit Remaining: 100%
```

The reported reset timestamps were `2026-10-12T07:32:49Z` and `2026-10-07T17:39:19Z` for the Gemini weekly and five-hour limits, and `2026-10-11T10:06:02Z` and `2026-10-07T19:27:17Z` for the Claude/GPT limits.

This confirms that the current official client presents Pro and Flash through a shared Gemini group for this account. It still does not expose the private server's internal bucket keys.

### 3. Plans page: baseline quota is separate from paid overage credits

Google's [Antigravity Plans documentation](https://antigravity.google/docs/plans) says the baseline includes Gemini models such as Gemini 3.1 Pro and Gemini 3.8 Flash, describes plan-level five-hour and weekly rate limits, and says users can view baseline usage across models. It separately describes purchased AI credits as overage after baseline quota is exhausted.

The page also says overage begins after baseline quota for a particular model is exhausted. That wording is less precise than the grouped Models UI and should not be treated as proof of separate Pro and Flash pools. It may describe model eligibility or enforcement while the user-facing quota is grouped.

### 4. Google One Help: credits have model-dependent cost, not a baseline percentage

[Google One Help](https://support.google.com/googleone/answer/14534406?hl=en) describes a two-tier system:

- baseline quota consists of time-bound Antigravity usage limits determined by the subscription tier;
- AI credits are an overage balance used after baseline exhaustion and are deducted according to the selected model's standard pricing and request complexity.

Therefore, the status-bar percentage should represent baseline quota only. A Google AI credit balance is a different unit and may be consumed at different rates by Pro, Flash, Claude, or GPT. It should not be merged into the Gemini baseline percentage.

## Documentation ambiguity

The [CLI `/usage` documentation](https://antigravity.google/docs/cli/commands/usage/) says the panel provides limits for each supported model and gives Flash and Pro as examples. Other official CLI text calls the quotas model-specific. This conflicts with the current Models page and the observed CLI output, both of which present family groups.

The safest interpretation is:

- the backend may return model-level entries or enforce eligibility per model;
- the current official product summarizes those entries into one Gemini family quota and one Claude/GPT family quota;
- the extension should match that supported product-level presentation without claiming knowledge of the internal accounting algorithm.

## Recommendation for this extension

Combine Gemini Pro and Gemini Flash in the status bar under one `Gemini` label. Keep Claude and GPT models in the existing separate combined label. Do not display AI spend credits as though they were baseline quota.

When several gateway model entries contribute to the Gemini display, avoid assuming that matching percentages prove identity. Use the gateway fields and observed reset data defensively. If entries disagree because of stale or partial discovery data, a conservative aggregate (lowest remaining fraction and earliest valid reset) avoids overstating available quota, and the discrepancy should remain visible in logs for future gateway changes.

Because Antigravity and its gateway are explicitly subject to capacity-driven changes, this conclusion should be revisited if the official Models page or official `/usage` output returns to separate Pro and Flash groups.

## Update: conditional Argon display (2026-10-18)

### Verified first-party information

- [Google's Argon announcement](https://antigravity.google/blog/gemini-4-argon-in-google-antigravity) and [model availability table](https://antigravity.google/docs/models/) confirm Argon access for non-trial Google AI Pro, Ultra, and eligible Enterprise subscriptions. This is not a guarantee that any particular account's gateway catalogue contains it.
- The [public Argon model specification](https://ai.google.dev/gemini-api/docs/models/gemini-4-argon) lists a unified 1,048,576-token context and 65,536-token synchronous output limit. These are the bridge's configured limits, not independently verified private-gateway limits. Long decode is not enabled by this change.
- The [official CLI changelog](https://antigravity.google/docs/changelog/#rel-cli-1.4.0) lists CLI 1.4.0, released October 16, 2026. The PR updates the pinned version; it retains the existing changelist value. The exact 1.4.0 header fingerprint has not been captured locally.

### Contributor observation and local verification boundary

[@Jollyproxi's issue #3](https://github.com/lutfi238/antigravity-for-copilot-vscode/issues/3) and [PR #4](https://github.com/lutfi238/antigravity-for-copilot-vscode/pull/4) report Argon high/medium/low model IDs and a dedicated weekly quota allocation. Treat the dedicated-pool claim as contributor-reported rather than established backend accounting: the public pages reviewed do not expose quota-pool identifiers or prove that Argon consumption cannot affect another pool.

Local checks on October 18 used the installed CLI 1.3.6: `agy models` returned the existing six-model Flash/Claude/GPT roster without Argon, and the read-only `agy --print '/usage' --output-format text --print-timeout 20s` returned only Gemini and Claude/GPT groups. No model generation was requested. Argon generation, its exact gateway limits, and its independent quota accounting still require an eligible account. Account-dependent absence does not disprove the contributor's access.

### Extension policy and tests

Display discovered Gemini Argon model entries separately from standard Gemini and Claude/GPT. Preserve the lowest reported fraction and earliest valid reset within each display group, without manufacturing weekly/five-hour limits. Omit the Argon tooltip/accessibility section entirely if discovery contains no Argon bucket; explicit zero remains exhausted and a missing fraction remains unknown. Never inject Argon into a successful catalogue or the fallback roster.

Offline regressions cover quota isolation, reset aggregation, aliases, exhausted/unknown balances, account switches, discovered effort tiers, generation curation, and provider wire payloads. Passing fixtures establishes bridge behavior, not a live Argon entitlement or successful generation.
