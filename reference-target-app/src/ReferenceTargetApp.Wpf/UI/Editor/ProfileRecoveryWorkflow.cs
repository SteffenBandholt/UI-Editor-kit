using System.IO;
using ReferenceTargetApp.EditorIntegration.Electron;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.EditorIntegration.Pdf;

namespace ReferenceTargetApp.UI.Editor;

internal sealed record UiProfilePreparation(LayoutProfileStartupResult Startup, ProfileInspection Inspection, ProfileArchiveResult? Archive);
internal sealed record PdfProfilePreparation(PdfLayoutSession Session, ProfileInspection Inspection, ProfileArchiveResult? Archive);

internal sealed class ProfileRecoveryWorkflow(IProfileRecoveryPrompt prompt)
{
    internal async Task<UiProfilePreparation> PrepareUiAsync(
        IReadOnlyDictionary<string, IHostAdapter> adapters,
        AtomicJsonLayoutProfileStore store,
        ActiveLayoutProfileStore activeStore,
        ProfileRecoveryContext context,
        CancellationToken cancellationToken,
        IReadOnlyDictionary<string, LayoutState>? declaredBaseline = null,
        bool startupLayoutApplied = false)
    {
        var profileId = await activeStore.LoadAsync(cancellationToken);
        var recovery = new LayoutProfileRecoveryService(adapters, store);
        var inspection = await recovery.InspectAsync(profileId, cancellationToken);
        if (inspection.State is ProfileCompatibilityState.Compatible or ProfileCompatibilityState.Missing)
        {
            if (inspection.State == ProfileCompatibilityState.Compatible && startupLayoutApplied)
            {
                var baseline = declaredBaseline ?? adapters.ToDictionary(pair => pair.Key, pair => pair.Value.GetCurrentLayoutState(), StringComparer.Ordinal);
                var saved = adapters.ToDictionary(pair => pair.Key, pair => pair.Value.GetCurrentLayoutState(), StringComparer.Ordinal);
                var session = new LayoutProfileSession(adapters, baseline, store, activeStore, profileId, saved,
                    savedDocument: inspection.UiDocument);
                var preappliedStartup = new LayoutProfileStartupResult(true, true, "startup_layout_already_applied",
                    "Das kompatible UI-Profil ist bereits durch die Ziel-App aktiv.", profileId, true, session);
                return new(preappliedStartup, inspection, null);
            }
            var startup = await RestoreUiAsync(adapters, store, activeStore, cancellationToken, declaredBaseline);
            if (startup.Success) return new(startup, inspection, null);
            if (!startup.RollbackSucceeded)
                throw new ElectronEditorException(ElectronEditorErrorCodes.UiProfileRestoreFailed,
                    "Das UI-Profil konnte nicht wiederhergestellt und nicht vollstaendig zurueckgerollt werden.");
            inspection = inspection with
            {
                State = ProfileCompatibilityState.Blocked,
                Code = ElectronEditorErrorCodes.UiProfileRestoreFailed,
                Message = "Das UI-Profil konnte nicht sicher angewandt werden."
            };
        }

        var decision = prompt.Ask(inspection);
        if (decision == ProfileRecoveryDecision.Cancel)
            throw new ElectronEditorException(ElectronEditorErrorCodes.ProfileUserCancelled, "Der Nutzer hat den Profilstart abgebrochen.");

        var archiveService = new ProfileArchiveService(store.RootDirectory);
        ProfileArchiveResult? archive = null;
        if (decision == ProfileRecoveryDecision.Migrate)
        {
            if (!inspection.MigrationAvailable)
                throw new ElectronEditorException(ElectronEditorErrorCodes.ProfileMigrationFailed, "Eine sichere Migration ist fuer dieses Profil nicht verfuegbar.");
            var migration = await recovery.MigrateAsync(inspection, profileId, archiveService, context, cancellationToken);
            if (!migration.Success)
                throw new ElectronEditorException(migration.Code, migration.Message);
        }
        else
        {
            archive = await archiveService.ArchiveAsync(inspection, context, "baseline-start", cancellationToken);
            if (!archive.Success)
                throw new ElectronEditorException(ElectronEditorErrorCodes.ProfileArchiveFailed, archive.Message);
        }

        var recovered = await RestoreUiAsync(adapters, store, activeStore, cancellationToken, declaredBaseline);
        if (!recovered.Success)
            throw new ElectronEditorException(ElectronEditorErrorCodes.UiProfileRestoreFailed, recovered.Message);
        if (decision == ProfileRecoveryDecision.Baseline)
            recovered = recovered with
            {
                Code = ElectronEditorErrorCodes.ProfileBaselineStarted,
                Message = "UI-Arbeitsbereich wurde sauber mit der Ziel-App-Baseline gestartet."
            };
        return new(recovered, inspection, archive);
    }

    internal async Task<PdfProfilePreparation> PreparePdfAsync(
        IPdfHostAdapter adapter,
        AtomicJsonPdfLayoutProfileStore store,
        ProfileRecoveryContext context,
        CancellationToken cancellationToken)
    {
        var recovery = new PdfProfileRecoveryService(store);
        var inspection = await recovery.InspectAsync(adapter.GetRegistry(), cancellationToken);
        var session = new PdfLayoutSession(adapter, store);
        if (inspection.State == ProfileCompatibilityState.Compatible)
        {
            var restored = await session.LoadAsync(cancellationToken);
            if (restored.Success) return new(session, inspection, null);
            if (!restored.RollbackSucceeded)
                throw new ElectronEditorException(ElectronEditorErrorCodes.PdfProfileRestoreFailed,
                    "Das PDF-Profil konnte nicht wiederhergestellt und nicht vollstaendig zurueckgerollt werden.");
            inspection = inspection with
            {
                State = ProfileCompatibilityState.Blocked,
                Code = ElectronEditorErrorCodes.PdfProfileRestoreFailed,
                Message = "Das PDF-Profil konnte nicht sicher angewandt werden."
            };
        }
        else if (inspection.State == ProfileCompatibilityState.Missing)
        {
            return new(session, inspection, null);
        }

        var decision = prompt.Ask(inspection);
        if (decision == ProfileRecoveryDecision.Cancel)
            throw new ElectronEditorException(ElectronEditorErrorCodes.ProfileUserCancelled, "Der Nutzer hat den Profilstart abgebrochen.");
        if (decision == ProfileRecoveryDecision.Migrate)
            throw new ElectronEditorException(ElectronEditorErrorCodes.ProfileMigrationFailed, "Eine sichere PDF-Profilmigration ist fuer dieses Profil nicht verfuegbar.");

        var archive = await new ProfileArchiveService(Path.GetDirectoryName(store.RootDirectory)!).ArchiveAsync(
            inspection, context, "baseline-start", cancellationToken);
        if (!archive.Success)
            throw new ElectronEditorException(ElectronEditorErrorCodes.ProfileArchiveFailed, archive.Message);
        return new(new PdfLayoutSession(adapter, store), inspection, archive);
    }

    private static Task<LayoutProfileStartupResult> RestoreUiAsync(
        IReadOnlyDictionary<string, IHostAdapter> adapters,
        AtomicJsonLayoutProfileStore store,
        ActiveLayoutProfileStore activeStore,
        CancellationToken cancellationToken,
        IReadOnlyDictionary<string, LayoutState>? declaredBaseline) =>
        new LayoutProfileStartupCoordinator(adapters, store, activeStore, allowCompatibleRegistryReconciliation: false, declaredBaseline)
            .RestoreAsync(cancellationToken);
}
