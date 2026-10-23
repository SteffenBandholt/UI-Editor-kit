# Explicit layout editing session (K8/M75, F1/G1/H1)

Design: UI-only lifecycle change in the existing standalone native editor. No new
editor targets, components, tables, fields, parents, capabilities or registries.
All existing explicit app registrations and domain-action locks remain binding.
No PDF renderer or business operation changes.

The existing LayoutProfileSession owns Working, Saved and Baseline. Commands
apply transient host changes and record operations/undo; only explicit Save
(including Save in the existing close/profile-change dialog) writes a profile.
Reset and Undo also remain transient. Discard restores the last Saved boundary,
not the original declaration; successful Discard clears abandoned undo history.
Cancel in the close dialog leaves the window and edits open.

The existing version-2 profile JSON and acknowledgement stay compatible. Before
publishing a Save candidate, the atomic store writes and flushes a version-1
`<profile>.layout-profile.json.save-transaction.json` journal containing the owning process ID and the exact
previous file bytes (base64), or no previous file. File.Replace/Move publishes the
fully flushed candidate. Only successful target acknowledgement removes the
journal and advances Saved. The additive `layoutSaveCommitted` event then
advances the target rollback boundary using the previously validated snapshot.
Acknowledgement alone must not advance that boundary. Legacy targets may ignore
the additive event; new integrations use it to protect an interrupted Save. Rejection, exception or cancellation restores the
previous bytes; interruption leaves a journal that the official native/JS
startup loaders recover before loading a profile. Invalid journals block startup
without applying or overwriting the candidate. A live owning process also blocks
concurrent startup recovery; it must not roll back an in-flight Save. Journals contain layout only.

Disconnect outside Save does not write any profile. The app's existing official
host boundary restores transient styles; the native editor reports connection
loss and cannot submit further changes. No app-specific persistence is added.

Tests: `node scripts/tests/explicit-layout-session.test.cjs`, all commands via
`node scripts/run-all-js-tests.cjs`, native `M8623SaveCloseAcknowledgementTests`,
full Windows native-security matrix and BBMpro's real-native acceptance driver.
Results and remaining baseline failures are recorded in PR #94 and #69.

Relative spacing edits (`spacingIncrease`, `spacingDecrease`, `spacingReset`)
are canonicalized to absolute `spacingSet` during Discard, Undo and Load. The
saved spacing is a value, not an increment to replay. Duplicate operations are
restored once; an unavailable restore operation also rolls back prior batch
steps instead of leaving a partially restored layout. Native regression:
`RelativeSpacingEditsDiscardUndoAndLoadAsSavedAbsoluteValues`.

The native window coordinator schedules opening/activation on the owning UI
dispatcher even if waiting for Close's lifecycle lock resumed on a worker
thread. The existing loaded-window integration test exercises immediate reopen.

## Actual verification and open acceptance (2026-10-18)

Functional commit: `323c1918ff770e2a4a7eabbe291bf5430e52dd6d`.
[Complete Windows matrix 39156021248](https://github.com/SteffenBandholt/UI-Editor-kit/actions/runs/39156021248):

| Check | Installed SDK 10.0.402 | Isolated SDK 10.0.100 |
| --- | --- | --- |
| Both solutions restored, full transitive audits | passed, 0 vulnerable packages | passed, 0 vulnerable packages |
| Both native applications built | passed | passed |
| Shared real self-contained WPF publish | passed, runtime 10.0.13 | passed, runtime 10.0.13 |
| New session/spacing tests and existing immediate-reopen integration | passed | passed |
| Full reference suite, no tests skipped | 159/162 | 159/162 |
| Full Manager suite, no tests skipped | 102/103 | 102/103 |

All 68 JavaScript commands ran independently: 64 passed. The same four baseline
source-snapshot cases fail: m82-3-spacing-compact-ui, m82-5-simple-editor-mode,
m82-7-capability-guided-simple-mode, m82-7-3-text-resize-current-value.
Native baseline failures remain CompactWorkspaceUsesAvailableWidthAndKeepsToolbarOutsideColumns,
DefaultPathIsUserLocalAndAtomicStoreWritesVersionedNeutralDocument,
VisibleUiPdfEndToEndUsesTwoRealProcessesAndCleansArtifacts (child -1073741811),
and Manager Existing_Electron_reference_is_detected_without_second_bridge_or_registry
(the external BBM reference repository is absent). No assertions were weakened.
Cross-build: zero warnings/errors; contract self-test, security/publish guards,
pack dry-run and release check pass. NuGetAudit and TreatWarningsAsErrors remain on.

BBMpro's actual WPF/pipe/UIA run confirmed transient edits and the real Win32
Discard confirmation, then exposed the relative-spacing restore bug fixed here.
The complete new BBMpro Save/Discard/Cancel/failure/restart/disconnect scenario
must still be rerun. Its next run
[39154946232](https://github.com/SteffenBandholt/BBMpro/actions/runs/39154946232)
and retry failed before provisioning any runner: zero steps, runner_id 0, no job
log. This is not a passed acceptance test; the platform's annotation is required
from the account owner. Physical DPI/monitor review and production approval
remain separate. No merge or release.

Multi-ref template targets use the same logical state/session/store and commit
handshake. Native and host contracts, empty-list behavior and acceptance limits
are specified in [NATIVE_MULTI_REF_TEMPLATES.md](NATIVE_MULTI_REF_TEMPLATES.md).
