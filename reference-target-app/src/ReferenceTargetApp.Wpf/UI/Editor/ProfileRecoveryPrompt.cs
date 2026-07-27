using System.Windows;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.UI.Views;

namespace ReferenceTargetApp.UI.Editor;

internal enum ProfileRecoveryDecision { Baseline, Migrate, Cancel }

internal interface IProfileRecoveryPrompt
{
    ProfileRecoveryDecision Ask(ProfileInspection inspection);
}

internal sealed class NativeProfileRecoveryPrompt : IProfileRecoveryPrompt
{
    public ProfileRecoveryDecision Ask(ProfileInspection inspection)
    {
        var dialog = new ProfileRecoveryDialog(inspection);
        if (Application.Current?.MainWindow is { IsVisible: true } owner) dialog.Owner = owner;
        return dialog.ShowDecision();
    }
}
