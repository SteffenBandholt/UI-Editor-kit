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
