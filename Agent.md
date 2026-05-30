# Agent.md

> Entry point for all agent sessions. Read this file first.

## Operating Instructions

1. **Session Start**: Read this file. Determine the current loop from `asef/Feats.json`.
2. **If no active Feature**: Wait for human input (new Feature request or Project Loop task).
3. **If active Feature exists**: Read its `Spec.md` and `Plan.md`, resume the Edit Loop from where it left off.
4. **Escalate to human** when: a Spec is ambiguous, a Plan is rejected, tests fail after 3 consecutive fix-forward attempts, or scope creep is detected.

## Artefact Registry

| Artefact | Location | Purpose | Read | Write |
|---|---|---|---|---|
| `Agent.md` | `./` | Agent entry point & routing table | Session start | Project Loop init |
| `Project.md` | `asef/` | Project charter — goals, stack, constraints | Every session | Project Loop only |
| `Architecture.md` | `asef/` | Structural blueprint — components, connections, folder layout | Feature start | Feature start (if arch changes approved) |
| `Knowledge.md` | `asef/` | Reusable decisions, patterns, gotchas | As needed | Feature close, periodically curated |
| `FlowDiagram.md` | `asef/` | Mermaid diagram of system data/control flows | As needed | Project init, after Architecture.md changes |
| `Feats.json` | `asef/` | Feature tracker — status, artefact paths, dependencies | Session start, Feature transitions | Feature start, status changes, Feature close |
| `Logging.md` | `asef/` | Full logger specification — event schema, vocabulary, instructions, query examples | When writing or querying log events | Never (static spec) |
| `Logger.ndjson` | `asef/` | Append-only execution log — one JSON object per line | Post-hoc review only | Continuous (every significant event) |
| `Rollback.md` | `asef/features/{feat-id}/` | Documents why/how a Feature was abandoned | When reviewing rollbacks | When abandoning a Feature |
| `Pre-State.md` | `asef/features/{feat-id}/` | Codebase snapshot before Feature work | During Feature | Feature start |
| `Spec.md` | `asef/features/{feat-id}/` | Feature contract — behaviour, acceptance criteria, arch changes | During Feature | Feature start (human-approved) |
| `Tests.md` | `asef/features/{feat-id}/` | Test plan — unit, integration, regression, edge cases | During Feature | After Spec approval |
| `Plan.md` | `asef/features/{feat-id}/` | Implementation plan — edit sequence, rationale, risks | During Feature | After Tests, before Edit Loop |
| `Post-State.md` | `asef/features/{feat-id}/` | Codebase snapshot after Feature completion | Post-Feature review | Feature close |
| `EditPlan.md` | `asef/features/{feat-id}/edits/{edit-id}/` | Pre-change declaration for a single Edit | During Edit | Edit start |
| `EditSummary.md` | `asef/features/{feat-id}/edits/{edit-id}/` | Post-change record for a single Edit | Post-Edit review | Edit close |

## Feats.json Schema

```json
{
  "features": [
    {
      "id": "feat-001",
      "name": "User authentication",
      "status": "in-progress | complete | blocked | rolled-back",
      "depends_on": [],
      "rollback_ref": null,
      "created_at": "2026-03-30T10:00:00Z",
      "completed_at": null,
      "edits": [
        {
          "id": "edit-001",
          "description": "Add login endpoint",
          "status": "complete | in-progress | failed"
        }
      ]
    }
  ]
}
```

- `status`: one of `in-progress`, `complete`, `blocked`, `rolled-back`.
- `rollback_ref`: if status is `rolled-back`, references the rollback Feature's ID.
- `edits`: ordered list of Edits within the Feature. Each Edit has its own status.
- Feature artefacts are always at `asef/features/{id}/` — no need to store paths explicitly.

## Logger

`asef/Logger.ndjson` is the append-only execution log. Full specification — event schema, vocabulary, instructions, and query examples — is in **`asef/Logging.md`**. Read that file whenever writing or querying log events.

## Dependency Graph

```
Agent.md
 ├── asef/Project.md
 ├── asef/Architecture.md ← updated by Features via Spec.md "Architecture Changes"
 ├── asef/Knowledge.md ← fed by Feature close learnings
 ├── asef/FlowDiagram.md ← regenerated from Architecture.md
 ├── asef/Feats.json ← updated at Feature boundaries
 ├── asef/Logging.md ← logger spec, read when writing or querying events
 ├── asef/Logger.ndjson ← append-only, continuous
 │
 └── [Per Feature: asef/features/{feat-id}/]
      ├── Pre-State.md
      ├── Spec.md ← depends on Architecture.md, Project.md
      ├── Tests.md ← derived from Spec.md
      ├── Plan.md ← derived from Spec.md + Tests.md
      ├── Post-State.md ← produced at Feature close
      ├── Rollback.md ← only if Feature is abandoned
      │
      └── [Per Edit: edits/{edit-id}/]
           ├── EditPlan.md ← scoped from Plan.md
           └── EditSummary.md ← produced after change
```

## Current Loop

**Status**: Project Loop — Complete. Ready and waiting for the next Feature Loop or developer request.

---

## Loop Lifecycles

### Project Loop Lifecycle

> Runs once at project initialisation. Re-running implies fundamental re-architecture.

1. Human provides project brief (goals, constraints, tech preferences).
2. Agent produces `asef/Project.md` (draft) → human reviews.
3. Agent produces `asef/Architecture.md` (draft) → human reviews.
4. Agent generates `asef/FlowDiagram.md` (Mermaid) from `Architecture.md`.
5. Agent initialises `asef/Knowledge.md` (empty).
6. Agent initialises `asef/Feats.json`, `asef/Logger.json`, `Agent.md`.
7. Human approves → Project Loop closes.

### Feature Loop Lifecycle

> Runs once per user story, capability, or meaningful unit of work.

1. Agent reads `Agent.md` → identifies current project context.
2. Agent produces `Pre-State.md` (snapshot of relevant codebase state).
3. Human provides or agent drafts `Spec.md` → human reviews & approves.
4. Agent produces `Tests.md` from `Spec.md` → human reviews.
5. Agent produces `Plan.md` from `Spec.md` + `Tests.md` → human reviews & approves.
6. Agent enters Edit Loop — for each Edit:
   - Draft `EditPlan.md` → **present to developer for confirmation**.
   - Make the code change.
   - Run relevant tests.
   - Produce `EditSummary.md` → **present to developer**.
   - Any developer-requested change during the Feature is a new Edit through this same cycle.
7. After all Edits, agent runs full test suite (including regressions) → produces Test Results.
8. **On all-green**:
   - Agent produces `Post-State.md`.
   - Agent updates `asef/Knowledge.md` with decisions and learnings.
   - Agent updates `asef/Feats.json` (status → `complete`).
   - Agent raises a PR to `main`.
   - Feature Loop closes.
9. **On test failure**:
   - Agent re-enters Edit Loop to fix.
   - Returns to step 7.

### Edit Loop Lifecycle

> Runs once per atomic code change within a Feature. **Every code change is an Edit — no exceptions.**

1. Agent identifies next required change from `Plan.md` / `Tests.md` / test failures / developer request.
2. Agent creates `asef/features/{feat-id}/edits/{edit-id}/` directory.
3. Agent produces `EditPlan.md` (what will change and why).
4. **Agent presents `EditPlan.md` to developer for confirmation** → developer approves or revises.
5. Agent makes the code change.
6. Agent runs relevant tests (unit + affected integration).
7. **On pass**:
   - Agent produces `EditSummary.md`.
   - **Agent presents `EditSummary.md` to developer** — what changed, test results, side effects.
   - Agent updates edit status in `asef/Feats.json`.
   - Agent appends an event to `asef/Logger.ndjson`.
   - Edit Loop closes → returns to Feature Loop.
8. **On fail**:
   - Agent diagnoses failure and presents findings to developer.
   - Agent may start a new Edit (fix-forward) or revert current Edit.
   - Returns to step 2.

> **Rule**: If the developer requests any code change during an active Feature — bug fix, tweak, refactor, "just change this one thing" — it is a new Edit. The agent must create a new `edits/{edit-id}/` directory, draft an `EditPlan.md`, get developer confirmation, make the change, run tests, and present the `EditSummary.md`. No code change is ever made without this cycle.

---

## Developer Request Pathways

How the agent interprets common developer commands.

| Request | Action |
|---|---|
| **"Initialise the project structure"** | Read `asef/Architecture.md`, create the folder structure and scaffolding defined there, generate `asef/FlowDiagram.md`. |
| **"Initialise Feature"** | Create `asef/features/{feat-id}/` directory, add entry to `asef/Feats.json`, generate empty `Pre-State.md`, `Spec.md`, `Tests.md`, `Plan.md` stubs. |
| **"Spec this Feature"** | Draft or refine `Spec.md` for the active Feature. Present to human for approval. |
| **"Plan this Feature"** | Generate `Plan.md` from the approved `Spec.md` + `Tests.md`. Present to human for approval. |
| **"Start working"** | Enter the Edit Loop for the active Feature. Requires approved `Plan.md`. |
| **"Change / fix / tweak X"** (during active Feature) | Create a new Edit: draft `EditPlan.md` → confirm with developer → make change → run tests → present `EditSummary.md`. |
| **"Run tests"** | Execute the test suite scoped to the active Feature. Log results. |
| **"What's the status?"** | Read `asef/Feats.json` and report: active Feature, current Edit, blockers, test state. |
| **"Roll back this Feature"** | Initiate Rollback policy: produce `Rollback.md`, create rollback Feature, mark original as `rolled-back`. |
| **"Update architecture"** | Propose changes to `asef/Architecture.md`, regenerate `asef/FlowDiagram.md`. Requires human approval. Only valid at Feature boundaries. |
| **"Review knowledge"** | Open `asef/Knowledge.md`, prune stale entries, consolidate duplicates. |

---

## Standing Policies

### Branching & Commits

- Each Feature maps to a Git branch: `feat/{feat-id}-{short-name}` (e.g., `feat/feat-001-user-auth`).
- Multiple Edits within a Feature accumulate on the branch.
- Commit message format: `feat({feat-id}): {short description}`.
- After feature is developed, a PR must be raised to main.

### Architecture Maintenance

- `Architecture.md` is **not** frozen after the Project Loop.
- At Feature start, evaluate whether architecture changes are needed.
- If yes, propose modifications in `Spec.md` under "Architecture Changes".
- On Feature approval, apply changes to `Architecture.md` and regenerate `asef/FlowDiagram.md` before entering the Edit Loop.
- A full Project Loop re-run is only needed if `Project.md` itself (Goals, Tech Stack, Users) is invalidated.

### Knowledge Curation

- `Knowledge.md` is fully LLM-maintained.
- **Record only reusable content**: commonly used knowledge including but not limited to recurring reasoning paths, non-obvious decisions, cross-cutting gotchas.
- **Do not** dump routine observations.
- Prune as necessary after each feature development is done.

### Rollback

- A rollback is a **Feature**, not an ad-hoc action.
- When abandoning a Feature:
  1. Produce `Rollback.md`: why abandoned, what changed, what to undo, residual risk.
  2. Create a new rollback Feature in `Feats.json` with its own full artefact trail.
  3. Set the abandoned Feature's status to `"rolled-back"` with a reference to the rollback Feature ID.
  4. Preserve all partial artefacts from the abandoned Feature (never delete).

### Edit Discipline

- **Every code change within a Feature is an Edit.** No exceptions — not for "quick fixes", not for "small tweaks", not for "just this one thing."
- Each Edit follows the full cycle: `EditPlan.md` → developer confirms → code change → run tests → `EditSummary.md` → developer sees results.
- An Edit that grows beyond its `EditPlan.md` must be split into multiple Edits.
- The agent never makes code changes without presenting the `EditPlan.md` first and getting developer confirmation.
- The agent never moves to the next Edit without presenting the `EditSummary.md` and test results.

### Scope Discipline

- A Feature that changes architecture beyond its `Spec.md` must pause for Spec revision.
- No code changes happen outside a loop.
- No loop runs without its artefacts.

### Fail-Forward with Audit

- On test failure: log the failure, produce a new `EditPlan.md`, proceed transparently.
- Never silently retry. Never suppress errors.
- After 3 consecutive fix-forward failures on the same issue, escalate to human.
