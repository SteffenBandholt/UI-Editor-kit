# Native multi-ref template targets — issue #95

Design decision (LV B2/B3, E1, F1, G1, K8/M75): UI layout only in the existing
standalone WPF editor. No new editor UI, PDF, domain operation, table/column,
field, button, group or parent is generated. The application declares those
structures through its existing complete component contract. The existing tree
selects one stable template ID even when no instances are mounted. No DOM scan,
record IDs, product wrappers, automatic registration or second profile store.
BBMpro, invoice logic and PrintCore are outside this change.

## Registration and logical state

An existing declared target adds `referenceKind: "multi"` and a nonnegative
integer `mountedInstanceCount`. `referenceResolved: false` is accepted only when
that count is zero. A single-ref target retains its existing semantics. Parents,
expected inventory, type, role, baseline, selection and capability declarations
remain required. A missing parent or logical state is an error even at count zero.

For example, a host may declare `bbmpro.invoice.sheet.position.template` and
`bbmpro.invoice.sheet.catalog.template`; the kit contains no special case for
these names. It never registers individual invoice positions or catalog records.
The enclosing BBMpro scope must remain `incomplete` until its complete contract
and the real Windows acceptance have passed. This change does not unlock it.

Allowed template operations: `move`, `resize`, `resizeWidth`, `resizeHeight`,
`spacingIncrease`, `spacingDecrease`, `spacingSet`, `spacingReset`, and only the
subset explicitly permitted by the application. Domain operations, text/value
editing, visibility changes and table mutations are excluded from this template
contract. Every spacing target and operation effect must still be declared.

`getLayoutState` returns exactly one logical state per registry target, including
empty templates. Values describe shared layout intent in DIP, never the first
row's absolute position or a union of all row bounds. Rendering/filtering/reordering
changes references and counts, not layout identity or dirty state.

## Host integration through the existing local pipe

`createMultiRefTemplateTarget` is exported from the CommonJS kit API. It supplies
an app-neutral atomic host implementation; the native editor owns the session.
The application supplies explicit references and renderer primitives:

```js
const { createMultiRefTemplateTarget } = require('ui-editor-kit');
const rows = createMultiRefTemplateTarget({
  entry: declaredTemplateEntry,
  resolveReferences: () => currentExplicitRowRefs,
  capture: node => captureExactLayoutStyles(node),
  apply: (node, logicalState) => applyTemplateLayout(node, logicalState),
  restore: (node, snapshot) => restoreExactLayoutStyles(node, snapshot),
  read: node => readTemplateLayoutIntent(node),
  isReferenceValid: node => node.isConnected && declaredContainer.contains(node),
});
```

These callbacks belong to the target renderer. `isReferenceValid` checks the
explicit declared container and connection; the default rejects disconnected DOM
refs without scanning. `capture` must preserve all
changed style/binding values, and `restore` must restore those exact values.
`read` reports actual applied logical geometry and spacing in DIP. Callbacks may
be asynchronous. They must not change business values, invoke services or change
the reference list themselves. The helper does not inspect DOM/WPF trees.

The existing host's `getRegistry` merges `rows.getReferenceStatus()` into the
registered entry; `getLayoutState` includes `rows.getLayoutState()`. Its
`submitChange` routes the request for that registered ID to
`await rows.submitChange(changeRequest)` and wraps it as `changeResult` in the
existing protocol response. Other registered targets keep their existing route.

After the target renderer remounts/filters/reorders its refs, explicitly await
`rows.reapply()` before publishing the new set for selection. A successful reapply
uses the retained shared state, including changes made while the set was empty.
Check failures and withhold interaction until recovery. The helper snapshots all
refs before mutation, verifies every applied result, then checks reference identity
and order again. A partially applied operation restores every captured ref,
including detached refs and the node whose mutation threw. A rollback failure
blocks the helper until the app rebuilds/reconnects it from the confirmed profile.

Successful `changeResult` adds:

```json
{"templateReadback":{"mountedInstanceCount":3,"appliedInstanceCount":3,"referenceStable":true}}
```

Counts describe the reference set used for this operation, so they may differ from
the handshake count. Zero/zero is valid: the logical state is updated for future
mounts. The native adapter requires a matching request/target/operation, finite
logical before/after states, matching requested values, unchanged unrelated layout
fields and a complete stable-set receipt. Missing/unstable/mismatching readback or
failed rollback blocks further native state capture, changes and Save until
reconnection; it cannot publish an unverified clean profile.

## Save, Discard, disconnect and restart

The native adapter preserves `ReferenceKind` in the existing registry. All edits
therefore flow through the existing `LayoutProfileSession`, undo frames,
`explicitOperations`, batch restore and `AtomicJsonLayoutProfileStore`. Discard
restores the last committed template values through the same `submitChange`
route, also for zero/new refs. Relative spacing restores as absolute `spacingSet`.

There is no helper-side profile file or independent Save boundary. The host keeps
using its existing `acknowledgeLayoutSave`/`layoutSaveCommitted` implementation
from `EXPLICIT_LAYOUT_SESSION.md`. ACK validates the candidate; only
`layoutSaveCommitted` advances its in-memory disconnect rollback boundary. A failed
ACK/disconnect leaves Saved unchanged and restores the previous profile bytes.
The native session may retry Save. Disconnect outside Save invokes the host's
existing rollback path for the same logical template IDs. Do not merely restore
old DOM objects: use the template operation route for the current reference set.

The host's existing startup service calls `loadTargetStartupLayout`, then applies
the validated `explicitOperations` through the same target route before exposing
refs. Reconstruct the helper with the declared baseline first; apply the saved
operations to its logical state even with zero refs. Subsequent `reapply` calls
project that state onto new instances. Existing startup receipts prevent double
application when the native editor opens.

Profile schema remains 2 and the save transaction journal remains version 1.
Multi-ref scope hashes add `referenceKind: "multi"` to the canonical entry; native
and official JS startup loaders agree. All legacy single-ref hashes remain byte
compatible. Counts, node identities and rendered business rows are excluded from
both fingerprints and profiles. Single/multi contract changes require an explicit
migration; native compatibility reconciliation is deliberately blocked when the
current registry contains multi-ref targets and profile validation fails.

## Verification and remaining acceptance

- `node scripts/tests/multi-ref-template.test.cjs`: actual host helper, 0/1/N,
  remount/reapply, empty state, malformed/domain payloads, partial renderer errors,
  mismatching readback, unstable refs, failed rollback, official schema-2 restart
  and interrupted-save journal recovery.
- `M95MultiRefTemplateTests`: native adapter plus real WPF Border refs and the
  official session/store; 0/1/N at layout transforms 1/1.25/1.5, save/discard/new
  session load, ACK/commit ordering, rejected-save bytes/retry, missing parents,
  instance-state rejection, unstable readback and failed rollback.
- The WPF transform unit cases are not a physical display-DPI or BBMpro acceptance.
  Actual local Windows tests and the issue's BBMpro acceptance (two real invoice
  positions, catalog results, render restart, 100/125/150% display, Save/Discard/
  Restart, unchanged SQLite business data) are still required. No merge or product
  acceptance is implied by a cross-build or JS test result.

Local Windows test commands from the kit checkout (the repository's patched
.NET 10 / WindowsDesktop 10.0.13 runtime policy must be installed):

```powershell
dotnet test reference-target-app/ReferenceTargetApp.slnx --filter FullyQualifiedName~M95MultiRefTemplateTests
dotnet test reference-target-app/ReferenceTargetApp.slnx
dotnet test UIEditorKit.slnx
node scripts/run-all-js-tests.cjs
```

The BBMpro host must route its declared template IDs through this contract (or an
equivalent validated renderer implementation) before its scope can be enabled.
This kit-only change does not modify that integration or supply invoice data.
