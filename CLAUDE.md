# CLAUDE.md — Auto Flow Chrome Extension

Project-specific rules for Claude Code. These rules **override** default behavior and must be followed exactly.

---

## 1. GitHub Workflow

### 1.1 Always Use GitHub CLI
- All GitHub operations (issues, PRs, comments, labels) **must** use the `gh` CLI.
- Never use the GitHub web UI or API directly.

```bash
# Correct — always use gh CLI
gh issue create ...
gh issue comment <number> --body "..."
gh issue close <number>
gh pr create ...
```

### 1.2 Issue Lifecycle — Do Not Close Before Commit

**Never close a GitHub issue before the code is committed.**

The required sequence is:
```
Implement → Verify all AC → Commit → Close issue with evidence
```

Closing an issue before commit is strictly prohibited, even if all checks appear to pass locally.

### 1.3 Closing an Issue — Evidence Required

When closing a GitHub issue, **you must attach a comment with evidence** that every Acceptance Criterion (AC) has been satisfied. The evidence comment must include:

1. **AC verification table** — one row per AC showing pass/fail
2. **Actual command output** — copy-paste of terminal output proving each AC
3. **Demo or reproduction steps** — step-by-step instructions any user can follow to reproduce the verified behavior
4. **Test results** — paste the full output of `npm run test` and `npm run lint`

#### Evidence Comment Template

```markdown
## ✅ Issue Closing Evidence — [TASK-XX]

### AC Verification

| AC | Condition | Result | Evidence |
|----|-----------|--------|---------|
| AC-1 | <condition> | ✅ PASS | See log below |
| AC-2 | <condition> | ✅ PASS | See log below |

### Test Results
\`\`\`
<paste full output of: npm run test>
\`\`\`

### Lint Results
\`\`\`
<paste full output of: npm run lint>
\`\`\`

### Reproduction Steps
1. <step 1>
2. <step 2>
3. Expected: <what user should see>

### Demo / Logs
\`\`\`
<paste relevant console output, logs, or screenshots description>
\`\`\`
```

---

## 2. Issue Execution Protocol

### 2.1 Mandatory Verification Before Moving to Next Issue

**Never proceed to the next issue until all of the following pass for the current issue:**

```
[ ] npm run lint      → 0 errors, 0 warnings
[ ] npm run test      → 0 failures, all tests pass
[ ] npm run build     → build succeeds without error
[ ] All AC verified   → every AC in the issue passes
[ ] Evidence comment  → posted to the GitHub issue
[ ] Code committed    → changes committed to git
[ ] Issue closed      → gh issue close with evidence comment
```

If any item above fails, **stop and fix it before moving on**. Do not skip, work around, or defer any item.

### 2.2 Prohibited Actions

The following are **strictly forbidden** at all times:

| Prohibited | Why |
|-----------|-----|
| `eslint-disable` comments | Bypasses code quality enforcement |
| `// eslint-disable-next-line` | Same as above |
| `git commit --no-verify` | Skips pre-commit hooks |
| Closing issues without evidence | Unverified work |
| Moving to next issue with failing tests | Carries forward broken state |
| Skipping AC verification | Work cannot be trusted |
| Marking AC as passed without running the actual verification command | Assumption is not proof |

---

## 3. Test-Driven Development (TDD)

### 3.1 TDD is Mandatory for All Logic

TDD applies to **all layers** — backend, core logic, and frontend business logic.

**The Red-Green-Refactor cycle must be followed:**
```
1. RED   — Write a failing test that defines the expected behavior
2. GREEN — Write the minimum code to make the test pass
3. REFACTOR — Clean up while keeping tests green
```

### 3.2 Scope of TDD

| Layer | TDD Required | Examples |
|-------|-------------|---------|
| Background Worker | ✅ Yes | `ExecutionOrchestrator`, `StorageService`, `runWithRetry` |
| Content Script | ✅ Yes | `DOMController`, `StateObserver`, `FlowAutomator` |
| Shared utilities | ✅ Yes | `parseSceneLabel`, `sleep`, `generateId`, `randomDelay` |
| Popup core logic | ✅ Yes | `FileImporter`, `PopupBridge`, state transitions |
| Popup rendering | ⚠️ Recommended | Component render output, state-driven class changes |

### 3.3 No Core Logic Without Tests

- Any core logic function without a test is **incomplete**.
- Before committing, run `npm run test:coverage` and ensure coverage thresholds are met:
  - Lines: ≥ 80%
  - Functions: ≥ 80%
  - Branches: ≥ 70%

### 3.4 Test File Conventions

```
shared/utils.js           → shared/utils.test.js
content/DOMController.js  → content/DOMController.test.js
content/StateObserver.js  → content/StateObserver.test.js
background/worker.js      → background/worker.test.js
popup/services/FileImporter.js → popup/services/FileImporter.test.js
```

---

## 4. Architecture Principles

### 4.1 SOLID Principles

All code must adhere to SOLID principles:

| Principle | Rule |
|-----------|------|
| **S** — Single Responsibility | Each class/module has exactly one reason to change |
| **O** — Open/Closed | Open for extension, closed for modification |
| **L** — Liskov Substitution | Subtypes must be substitutable for base types |
| **I** — Interface Segregation | No module depends on methods it does not use |
| **D** — Dependency Inversion | Depend on abstractions, not concrete implementations |

### 4.2 Clean Architecture

The project follows Clean Architecture with strict layer boundaries:

```
┌─────────────────────────────────────┐
│         UI Layer (Popup)            │  ← Rendering only, no business logic
├─────────────────────────────────────┤
│      Application Layer              │  ← Use cases: ExecutionOrchestrator
├─────────────────────────────────────┤
│       Domain Layer (Shared)         │  ← Pure logic: utils, constants, parsers
├─────────────────────────────────────┤
│    Infrastructure Layer             │  ← chrome.storage, chrome.tabs, DOM
└─────────────────────────────────────┘
```

**Layer rules:**
- Inner layers must never import from outer layers
- Domain layer has zero dependencies on Chrome APIs
- Business logic must be pure functions testable without a browser

---

## 5. Git Hooks (Husky)

### 5.1 Pre-Commit Hook

The pre-commit hook runs **automatically** and **cannot be bypassed**. It executes in order:

```
1. npm run lint   — ESLint with zero tolerance (--max-warnings=0)
2. npm run test   — All unit tests must pass
3. npm run build  — Extension must build successfully
```

If any step fails, the commit is **aborted**. Fix the issue and re-attempt.

### 5.2 Commit Message Hook

All commit messages must follow **Conventional Commits**:

```
<type>(scope): <subject>

Types: feat | fix | docs | style | refactor | test | chore | build | ci
```

Examples:
```bash
feat(content): add DOM selector fallback strategy
fix(background): prevent service worker from being killed during long runs
test(shared): add parseSceneLabel unit tests
docs(claude): add TDD and AC evidence requirements
```

### 5.3 Verifying Hook Setup

```bash
# Confirm hooks are installed
ls -la .husky/
# → pre-commit, commit-msg

# Confirm husky is active
cat .git/config | grep hooksPath
# → hooksPath = .husky

# Manually test the pre-commit hook
.husky/pre-commit
```

### 5.4 Never Bypass Hooks

```bash
# ❌ FORBIDDEN — never use these
git commit --no-verify
git commit -n

# ✅ CORRECT — always commit normally
git commit -m "feat(scope): description"
```

---

## 6. ESLint Rules

- ESLint config is defined in `eslint.config.js`.
- Run `npm run lint` before every commit (the hook does this automatically).
- **Never add `eslint-disable` comments** to silence errors. Fix the root cause instead.
- `--max-warnings=0` is enforced: warnings are treated as errors.

```bash
# Check lint
npm run lint

# Auto-fix safe issues only (review changes before committing)
npm run lint:fix
```

---

## 7. Commit Workflow

The complete workflow for every task:

```bash
# 1. Write failing test first (TDD Red)
# 2. Implement to make test pass (TDD Green)
# 3. Refactor (TDD Refactor)

# 4. Verify locally
npm run lint        # Must output: "0 problems"
npm run test        # Must output: "X passed, 0 failed"
npm run build       # Must output: "✅ Build complete"

# 5. Stage and commit (hooks run automatically)
git add <specific files>
git commit -m "feat(scope): description"
# → pre-commit hook runs lint + test + build
# → commit-msg hook validates message format

# 6. Push
git push

# 7. Post evidence and close issue
gh issue comment <number> --body "$(cat evidence.md)"
gh issue close <number>
```

---

## 8. Definition of Done

A task is **Done** only when **all** of the following are true:

- [ ] TDD cycle completed (tests written before implementation)
- [ ] `npm run lint` passes with 0 errors and 0 warnings
- [ ] `npm run test` passes with 0 failures
- [ ] `npm run test:coverage` meets thresholds (≥80% lines/functions, ≥70% branches)
- [ ] `npm run build` succeeds
- [ ] All Acceptance Criteria verified with actual command output
- [ ] Evidence comment posted to GitHub issue via `gh issue comment`
- [ ] Code committed (pre-commit hooks passed)
- [ ] GitHub issue closed via `gh issue close`

---

## 9. Project Structure Reference

```
auto-flow/
├── CLAUDE.md               ← This file
├── manifest.json
├── package.json
├── eslint.config.js
├── vitest.config.js
├── .husky/
│   ├── pre-commit          ← lint + test + build
│   └── commit-msg          ← conventional commit format
├── scripts/
│   └── build.js
├── shared/                 ← Domain layer (pure, no Chrome API)
│   ├── constants.js
│   ├── utils.js
│   ├── utils.test.js
│   └── i18n/
├── content/                ← Infrastructure layer
│   ├── content.js
│   ├── selectors.js
│   ├── DOMController.js
│   ├── DOMController.test.js
│   ├── StateObserver.js
│   ├── StateObserver.test.js
│   └── FlowAutomator.js
├── background/             ← Application layer
│   ├── worker.js
│   └── worker.test.js
├── popup/                  ← UI layer
│   ├── index.html
│   ├── index.js
│   ├── components/
│   └── services/
│       ├── PopupBridge.js
│       ├── FileImporter.js
│       └── FileImporter.test.js
└── assets/
```

---

## 10. Quick Reference

```bash
npm run lint            # ESLint check
npm run lint:fix        # Auto-fix lint issues
npm run test            # Run all unit tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
npm run build           # Package extension to dist/

gh issue list           # List open issues
gh issue comment <N> --body "..." # Add comment to issue
gh issue close <N>      # Close issue (only after evidence posted + committed)
gh pr create            # Create pull request
```
