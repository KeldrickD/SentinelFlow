# Developer-Ready Ticket List (With Acceptance Criteria)

## EPIC 1 — Core Smart Contracts

### Ticket: OpsTarget Contract

**Goal:** Expose safe, demo-friendly operational controls.

**Acceptance Criteria**

- Contract exposes:
  - `pause()`
  - `unpause()`
  - `setRiskMode(uint8)`
  - `setMaxTx(uint256)`
- Only callable by authorized executor (CRE workflow address)
- Emits events for each action
- No internal automation logic

---

### Ticket: DecisionJournal Contract

**Goal:** Immutable audit log for all workflow decisions.

**Acceptance Criteria**

- Emits `DecisionLogged` event with:
  - policyId
  - signal value
  - computed deviation
  - action taken
  - result
  - timestamp
- Supports “NO_ACTION” decisions
- No overwriting or deletion

---

## EPIC 2 — CRE Workflow

### Ticket: Signal Reader

**Goal:** Read price or risk signal deterministically.

**Acceptance Criteria**

- Reads Chainlink feed OR mocked local signal
- Normalizes signal value
- Errors explicitly if unavailable

---

### Ticket: Policy Evaluator

**Goal:** Decide whether an action should be taken.

**Acceptance Criteria**

- Supports:
  - deviation threshold
  - cooldown window
  - dry-run flag
- Returns explicit decision object:
  - action | no_action
  - reason string

---

### Ticket: Action Executor

**Goal:** Execute onchain calls safely.

**Acceptance Criteria**

- Allowlisted contract targets only
- Calls OpsTarget functions
- Handles revert gracefully
- No retries without cooldown reset

---

### Ticket: Decision Logger

**Goal:** Persist decision outcome.

**Acceptance Criteria**

- Logs every evaluation
- Includes no-action decisions
- Links tx hash if executed

---

## EPIC 3 — CLI / Minimal UI (Optional)

### Ticket: Status Viewer

**Goal:** Inspect last SentinelFlow decision.

**Acceptance Criteria**

- Shows:
  - last policy evaluated
  - last action taken
  - current risk mode
- Read-only
- No mutation logic
