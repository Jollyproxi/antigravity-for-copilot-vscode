# Graph Report - antigravity-for-copilot-vscode  (2026-10-18)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 812 nodes · 1472 edges · 63 communities (57 shown, 4 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b532f5f4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- toGemini.ts
- accountPlan.ts
- oauth.ts
- agyImage.ts
- models.ts
- vscode-stub.ts
- compilerOptions
- package.json
- agyCli.ts
- devDependencies
- agent-metadata.ts
- icon.build.cjs
- antigravity.effortSelection
- antigravity.modelSelection
- keywords
- enum
- scripts
- antigravity.endpoint
- esbuild.js
- properties
- antigravity.cliPath
- antigravity.hiddenModels
- antigravity.projectId
- antigravity.showStatusBar
- antigravity.showThinking
- activationEvents
- dependencies
- galleryBanner
- repository
- credentials.example.ts
- Changelog
- client.ts
- imageArtifacts.test.ts
- Antigravity Model Bridge
- provider.ts
- extension.ts
- GatewayClient
- config.ts
- Antigravity capability audit
- errors.ts
- AccountStore
- Live CLI runtime surface (57 names)
- project.ts
- PR-Agent setup
- awaitWithSignal
- Antigravity Gemini quota-pool research
- antigravity.toolCallIds
- Source
- Gateway API
- Authentication
- .provideLanguageModelChatResponse
- Protocol Translation
- Extension UI
- Tests
- AGENTS.md
- Antigravity Model Bridge
- Recommendation for Gaussian/Codex-style parity
- enum
- Primary-source evidence
- Q: please understand using /graphify
- Q: please understand inside this folder using graphify skills

## God Nodes (most connected - your core abstractions)
1. `Changelog` - 45 edges
2. `AccountStore` - 21 edges
3. `activate()` - 20 edges
4. `GatewayClient` - 16 edges
5. `TokenManager` - 16 edges
6. `parseAgyImageStream()` - 16 edges
7. `log` - 16 edges
8. `compilerOptions` - 15 edges
9. `QuotaStatusBar` - 14 edges
10. `buildRequest()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `harness()` --calls--> `AntigravityProvider`  [EXTRACTED]
  test/provider.test.ts → src/provider.ts
- `storage()` --calls--> `ImageArtifactStore`  [EXTRACTED]
  test/imageArtifacts.test.ts → src/imageArtifacts.ts
- `collect()` --calls--> `readSse()`  [EXTRACTED]
  test/stream.test.ts → src/api/stream.ts
- `harness()` --calls--> `ToolNameMap`  [EXTRACTED]
  test/translate.test.ts → src/translate/schema.ts
- `buildOptions()` --calls--> `SignatureCache`  [EXTRACTED]
  test/translate.test.ts → src/translate/thinking.ts

## Import Cycles
- None detected.

## Communities (63 total, 4 thin omitted)

### Community 0 - "toGemini.ts"
Cohesion: 0.06
Nodes (65): ModelSpec, candidatesOf(), closeThinkingPart(), createThinkingPart(), createUsageDataPart(), emitChunk(), EmitContext, emitPart() (+57 more)

### Community 1 - "accountPlan.ts"
Cohesion: 0.09
Nodes (19): AccountPlan, AccountPlanService, creditBalance(), parseAccountPlan(), record(), text(), Catalog, QuotaBucket (+11 more)

### Community 2 - "oauth.ts"
Cohesion: 0.14
Nodes (19): OAUTH_AUTHORIZE_URL, OAUTH_REDIRECT_PATH, OAUTH_REDIRECT_PORT, OAUTH_REDIRECT_URI, OAUTH_SCOPES, OAUTH_TOKEN_URL, OAUTH_USERINFO_URL, userAgent() (+11 more)

### Community 3 - "agyImage.ts"
Cohesion: 0.08
Nodes (52): addUnique(), AgyGeneratedImage, AgyImageResult, AgyImageStreamResult, buildAgyImagePrompt(), collectImageArtifacts(), decodeImageData(), dedupe() (+44 more)

### Community 4 - "models.ts"
Cohesion: 0.13
Nodes (22): baseName(), clamp(), classify(), collapseTiers(), curateModels(), FALLBACK_MODELS, Family, familyOf() (+14 more)

### Community 5 - "vscode-stub.ts"
Cohesion: 0.06
Nodes (18): CancellationError, EventEmitter, LanguageModelChatMessageRole, Assistant, User, LanguageModelChatToolMode, Auto, Required (+10 more)

### Community 6 - "compilerOptions"
Cohesion: 0.11
Nodes (18): ES2023, src, compilerOptions, exactOptionalPropertyTypes, lib, module, moduleResolution, noFallthroughCasesInSwitch (+10 more)

### Community 7 - "package.json"
Cohesion: 0.12
Nodes (15): bugs, url, description, displayName, engines, vscode, extensionKind, homepage (+7 more)

### Community 8 - "agyCli.ts"
Cohesion: 0.29
Nodes (9): AgySearchStreamResult, buildAgySearchPrompt(), isRecord(), parseAgySearchStream(), resolveAgyCommand(), runAgySearch(), workspaceCwd(), ANTIGRAVITY_WEB_SEARCH_TOOL_NAME (+1 more)

### Community 9 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, esbuild, @types/node, @types/vscode, typescript, vitest, @vscode/vsce, esbuild (+5 more)

### Community 10 - "agent-metadata.ts"
Cohesion: 0.24
Nodes (11): AgentMetadata, AgentSession, buildAgentMetadata(), buildEnvelope(), countSteps(), createSession(), fnv1a64Signed(), MODEL_ENUM (+3 more)

### Community 11 - "icon.build.cjs"
Cohesion: 0.24
Nodes (7): chunk(), crc32(), encodePng(), fs, img, SIZE, zlib

### Community 12 - "antigravity.effortSelection"
Cohesion: 0.20
Nodes (10): default, enum, markdownDescription, markdownEnumDescriptions, type, antigravity.effortSelection, One entry per model, with a **Thinking Effort** control beside it in the picker. Falls back to `#antigravity.reasoningEffort#` when nothing is selected., One picker entry per effort tier, e.g. Gemini 3.8 Flash (High) / (Medium) / (Low). (+2 more)

### Community 13 - "antigravity.modelSelection"
Cohesion: 0.29
Nodes (7): default, markdownDescription, markdownEnumDescriptions, type, antigravity.modelSelection, Keep additional discovered generations and Flash Lite; still exclude non-chat/internal aliases and duplicate display names., Show only the newest discovered Gemini generation per product line, retaining all its effort tiers, plus discovered Claude and GPT-OSS models. Exclude Flash Lite and internal aliases.

### Community 14 - "keywords"
Cohesion: 0.25
Nodes (9): categories, keywords, ai, antigravity, chat, copilot, gemini, gpt-oss (+1 more)

### Community 15 - "enum"
Cohesion: 0.25
Nodes (8): default, enum, markdownDescription, type, antigravity.reasoningEffort, high, low, medium

### Community 16 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, check, compile, package:vsix, test, test:watch, typecheck, vscode:prepublish (+1 more)

### Community 17 - "antigravity.endpoint"
Cohesion: 0.25
Nodes (8): default, description, enum, type, antigravity.endpoint, auto, daily, prod

### Community 18 - "esbuild.js"
Cohesion: 0.33
Nodes (6): esbuild, fs, main(), problemMatcherPlugin, production, watch

### Community 19 - "properties"
Cohesion: 0.18
Nodes (11): default, markdownDescription, type, properties, title, contributes, commands, configuration (+3 more)

### Community 20 - "antigravity.cliPath"
Cohesion: 0.33
Nodes (6): default, markdownDescription, tags, type, antigravity.cliPath, advanced

### Community 21 - "antigravity.hiddenModels"
Cohesion: 0.33
Nodes (6): default, description, items, type, type, antigravity.hiddenModels

### Community 22 - "antigravity.projectId"
Cohesion: 0.50
Nodes (4): default, markdownDescription, type, antigravity.projectId

### Community 23 - "antigravity.showStatusBar"
Cohesion: 0.50
Nodes (4): default, description, type, antigravity.showStatusBar

### Community 24 - "antigravity.showThinking"
Cohesion: 0.50
Nodes (4): default, markdownDescription, type, antigravity.showThinking

### Community 25 - "activationEvents"
Cohesion: 0.67
Nodes (3): activationEvents, onLanguageModelChatProvider:antigravity, onStartupFinished

### Community 26 - "dependencies"
Cohesion: 0.67
Nodes (3): dependencies, undici, undici

### Community 27 - "galleryBanner"
Cohesion: 0.67
Nodes (3): galleryBanner, color, theme

### Community 28 - "repository"
Cohesion: 0.67
Nodes (3): repository, type, url

### Community 31 - "Changelog"
Cohesion: 0.04
Nodes (45): 0.0.1, 0.0.2, 0.10.0, 0.11.0, 0.12.0, 0.12.1, 0.12.2, 0.12.3 (+37 more)

### Community 32 - "client.ts"
Cohesion: 0.16
Nodes (20): contentsOf(), EndpointSet, hasId(), isRecord(), partsOf(), RequestOptions, summarizeRequest(), SummaryContent (+12 more)

### Community 33 - "imageArtifacts.test.ts"
Cohesion: 0.14
Nodes (14): AgyImageRequest, EXTENSIONS, ImageArtifactReference, ImageArtifactStore, imageReferenceMarkdown(), missingImagePreviews(), ANTIGRAVITY_IMAGE_GENERATION_TOOL_NAME, createImageToolResult() (+6 more)

### Community 34 - "Antigravity Model Bridge"
Cohesion: 0.11
Nodes (19): Antigravity Model Bridge, Automated PR reviews, Common commands, Configuration, Context window, Contributors, Develop locally, Diagnostics and privacy (+11 more)

### Community 35 - "provider.ts"
Cohesion: 0.17
Nodes (16): asEffort(), availableEfforts(), buildConfigurationSchema(), Effort, EFFORT_DESCRIPTION, EFFORT_LABEL, EFFORT_ORDER, EffortSource (+8 more)

### Community 36 - "extension.ts"
Cohesion: 0.30
Nodes (12): onModelAffectingChange(), activate(), registerAntigravityImageGenerationTool(), initLogging(), showLogs(), manage(), removeAccount(), showAuthStatus() (+4 more)

### Community 38 - "config.ts"
Cohesion: 0.18
Nodes (6): ENDPOINT_DAILY, ENDPOINT_PROD, config, harness(), sseResponse(), TestToken

### Community 39 - "Antigravity capability audit"
Cohesion: 0.17
Nodes (12): Antigravity capability audit, Argon review — 2026-10-18, Boundary in this extension, Evidence snapshot, Executive conclusion, Image-generation update — 2026-10-14, MCP and customization model, Model catalogue update — 2026-10-14 (+4 more)

### Community 40 - "errors.ts"
Cohesion: 0.23
Nodes (6): describe(), extractMessage(), GatewayError, toGatewayError(), toLanguageModelError(), redact()

### Community 42 - "Live CLI runtime surface (57 names)"
Cohesion: 0.20
Nodes (10): Agent orchestration (7), Automation, media, memory, and lifecycle (5), Browser automation (23), Filesystem and notebooks (10), Human approval and security (4), Live CLI runtime surface (57 names), MCP resources and dispatch (3), Observed native call shapes (+2 more)

### Community 43 - "project.ts"
Cohesion: 0.29
Nodes (6): bootstrapMetadata(), DISCOVERY_ENDPOINTS, FALLBACK_PROJECT_ID, LoadCodeAssistResponse, OnboardUserResponse, ProjectResolver

### Community 44 - "PR-Agent setup"
Cohesion: 0.22
Nodes (5): Behavior and trust boundary, Enable later, Gemini configuration, Pinned release and updates, PR-Agent setup

### Community 45 - "awaitWithSignal"
Cohesion: 0.39
Nodes (5): awaitWithSignal(), findSeparator(), parseEvent(), readSse(), collect()

### Community 46 - "Antigravity Gemini quota-pool research"
Cohesion: 0.25
Nodes (8): Antigravity Gemini quota-pool research, Contributor observation and local verification boundary, Decision, Documentation ambiguity, Extension policy and tests, Recommendation for this extension, Update: conditional Argon display (2026-10-18), Verified first-party information

### Community 47 - "antigravity.toolCallIds"
Cohesion: 0.25
Nodes (8): default, markdownDescription, markdownEnumDescriptions, type, antigravity.toolCallIds, Forward ids for Claude models only. The gateway's Anthropic adapter requires a non-empty `tool_use.id`, which it cannot always synthesize., Forward ids for every model family, including Gemini., Never forward tool-call ids. Gemini pairs calls to results by name and does not need them.

### Community 48 - "Source"
Cohesion: 0.29
Nodes (7): Child DOX Index, Local Contracts, Ownership, Purpose, Source, Verification, Work Guidance

### Community 49 - "Gateway API"
Cohesion: 0.29
Nodes (7): Child DOX Index, Gateway API, Local Contracts, Ownership, Purpose, Verification, Work Guidance

### Community 50 - "Authentication"
Cohesion: 0.29
Nodes (7): Authentication, Child DOX Index, Local Contracts, Ownership, Purpose, Verification, Work Guidance

### Community 52 - "Protocol Translation"
Cohesion: 0.29
Nodes (7): Child DOX Index, Local Contracts, Ownership, Protocol Translation, Purpose, Verification, Work Guidance

### Community 53 - "Extension UI"
Cohesion: 0.29
Nodes (7): Child DOX Index, Extension UI, Local Contracts, Ownership, Purpose, Verification, Work Guidance

### Community 54 - "Tests"
Cohesion: 0.29
Nodes (7): Child DOX Index, Local Contracts, Ownership, Purpose, Tests, Verification, Work Guidance

### Community 55 - "AGENTS.md"
Cohesion: 0.33
Nodes (3): GitHub automation, Ownership and contracts, Verification

### Community 56 - "Antigravity Model Bridge"
Cohesion: 0.33
Nodes (6): Antigravity Model Bridge, Child DOX Index, Purpose, Repository Contracts, Verification, Work Guidance

### Community 57 - "Recommendation for Gaussian/Codex-style parity"
Cohesion: 0.33
Nodes (6): 1. Implemented in 0.14.0: explicit VS Code web-search bridge, 2. Implemented in 0.15.0 (artifact recovery fixed in 0.15.1): explicit VS Code image-generation bridge, 3. Optional shared adapter: standalone MCP server, 4. Exact native harness (high fidelity, high coupling), Avoid, Recommendation for Gaussian/Codex-style parity

### Community 58 - "enum"
Cohesion: 0.33
Nodes (6): enum, enum, all, claude, latest, off

### Community 59 - "Primary-source evidence"
Cohesion: 0.40
Nodes (5): 1. Current Antigravity Models page: explicit Gemini grouping, 2. Installed official CLI: the same two groups, 3. Plans page: baseline quota is separate from paid overage credits, 4. Google One Help: credits have model-dependent cost, not a baseline percentage, Primary-source evidence

### Community 60 - "Q: please understand using /graphify"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: please understand using /graphify, Source Nodes

### Community 61 - "Q: please understand inside this folder using graphify skills"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: please understand inside this folder using graphify skills, Source Nodes

## Knowledge Gaps
- **326 isolated node(s):** `VSCodeWithThinkingPart`, `Obj`, `GeminiFunctionDeclaration`, `GenerateContentBody`, `AgentMetadata` (+321 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 377 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `properties` connect `properties` to `antigravity.effortSelection`, `antigravity.modelSelection`, `enum`, `antigravity.toolCallIds`, `antigravity.endpoint`, `antigravity.cliPath`, `antigravity.hiddenModels`, `antigravity.projectId`, `antigravity.showStatusBar`, `antigravity.showThinking`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `log` connect `client.ts` to `accountPlan.ts`, `oauth.ts`, `agyImage.ts`, `models.ts`, `extension.ts`, `provider.ts`, `config.ts`, `project.ts`, `awaitWithSignal`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `newOperationId()` connect `accountPlan.ts` to `client.ts`, `oauth.ts`, `provider.ts`, `agyImage.ts`, `.provideLanguageModelChatResponse`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `activate()` (e.g. with `.active()` and `.refresh()`) actually correct?**
  _`activate()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `VSCodeWithThinkingPart`, `Obj`, `GeminiFunctionDeclaration` to the rest of the system?**
  _326 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `toGemini.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Should `accountPlan.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09291521486643438 - nodes in this community are weakly interconnected._