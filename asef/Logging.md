# Logging.md

> Full specification for `asef/Logger.ndjson`. Read this when writing or querying log events.

## Format

`asef/Logger.ndjson` is a newline-delimited JSON file — each line is one self-contained event object. **Never modify or delete existing lines. Only append.**

## Event Schema

```json
{
  "ts":     "<ISO 8601 timestamp>",
  "loop":   "project | feature | edit",
  "feat":   "<feat-id or null>",
  "edit":   "<edit-id or null>",
  "event":  "<event type>",
  "detail": "<short human-readable description>"
}
```

## Event Vocabulary

| Event | When to log |
|---|---|
| `loop_open` | A Project, Feature, or Edit loop starts |
| `loop_close` | A Project, Feature, or Edit loop closes cleanly |
| `artefact_write` | Any `.md` or `.json` artefact is created or updated |
| `developer_confirm` | Developer approves an `EditPlan.md`, `Spec.md`, or `Plan.md` |
| `developer_reject` | Developer rejects a plan or spec — include revision reason in `detail` |
| `test_pass` | Test run completes with all tests passing |
| `test_fail` | Test run produces one or more failures — include failure summary in `detail` |
| `escalation` | Agent cannot proceed and is waiting on human input — include reason in `detail` |
| `deviation` | Agent deviated from `EditPlan.md` or `Plan.md` — include what changed and why in `detail` |
| `correction` | A previously logged entry was incorrect — reference the original `ts` in `detail` |

## Instructions

- **Log decisions and state changes, not routine reads.** File reads, internal reasoning, and status checks are not logged.
- **Log immediately** — write the event at the moment it occurs, not retrospectively.
- **`detail` should be one sentence** — enough to understand the event without reading the artefact. Not a summary of the artefact, just the signal.
- **Never rewrite or delete lines.** If a logged entry was wrong, append a `correction` event referencing the original timestamp.

## Querying

```bash
# All events for a feature
grep '"feat-003"' asef/Logger.ndjson | jq

# All test failures
jq 'select(.event == "test_fail")' asef/Logger.ndjson

# All developer rejections
jq 'select(.event == "developer_reject")' asef/Logger.ndjson

# Full timeline of a single edit
jq 'select(.feat == "feat-003" and .edit == "edit-002")' asef/Logger.ndjson

# All escalations
jq 'select(.event == "escalation")' asef/Logger.ndjson
```
