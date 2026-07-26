using System.Text.Json;

namespace ReferenceTargetApp.EditorIntegration.Electron;

public sealed record ElectronTargetContract(
    string ApplicationId,
    string DisplayName,
    string AppVersion,
    string Framework,
    string ContractVersion,
    string AdapterVersion,
    int RegistryVersion,
    string RegistryFingerprint,
    string RegistryStatus,
    IReadOnlyList<string> ActiveScopes,
    string ProfileRoot,
    IReadOnlyList<string> SupportedOperations,
    string SelectionCapability,
    string UiCapability,
    bool VisibilityCapability,
    bool LabelFieldSeparation,
    string TransportProtocolVersion,
    string SessionId,
    int ProcessId,
    string PdfCapability)
{
    public const string CurrentVersion = "1.1";
    public const string CurrentAdapterVersion = "1.1";

    public static ElectronTargetContract FromHandshake(JsonElement handshake)
    {
        if (!handshake.TryGetProperty("contract", out var value) || value.ValueKind != JsonValueKind.Object)
            throw new ElectronEditorException(ElectronEditorErrorCodes.HandshakeFailed, "Electron-Ziel-App-Vertrag fehlt.");
        ElectronTargetContract contract;
        try
        {
            contract = value.Deserialize<ElectronTargetContract>(new JsonSerializerOptions(JsonSerializerDefaults.Web))
                       ?? throw new JsonException("Vertrag fehlt.");
        }
        catch (JsonException exception)
        {
            throw new ElectronEditorException(ElectronEditorErrorCodes.HandshakeFailed, "Electron-Ziel-App-Vertrag ist ungültig.", exception);
        }
        contract.Validate();
        return contract;
    }

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(ApplicationId) || string.IsNullOrWhiteSpace(DisplayName) || string.IsNullOrWhiteSpace(AppVersion) ||
            Framework != "electron" || ContractVersion != CurrentVersion || AdapterVersion != CurrentAdapterVersion || RegistryVersion < 1 ||
            string.IsNullOrWhiteSpace(RegistryFingerprint) || !RegistryFingerprint.StartsWith("sha256:", StringComparison.Ordinal) || RegistryFingerprint.Length != 71 ||
            RegistryStatus is not ("complete" or "incomplete" or "changed") ||
            ActiveScopes.Count == 0 || ActiveScopes.Distinct(StringComparer.Ordinal).Count() != ActiveScopes.Count ||
            string.IsNullOrWhiteSpace(ProfileRoot) || SelectionCapability != "bidirectional" || UiCapability != "layout" ||
            !VisibilityCapability || !LabelFieldSeparation || TransportProtocolVersion != LocalTargetProtocol.Version ||
            string.IsNullOrWhiteSpace(SessionId) || ProcessId < 1 || PdfCapability != "unavailable")
            throw new ElectronEditorException(ElectronEditorErrorCodes.HandshakeFailed, "Electron-Ziel-App-Vertrag verletzt M80.");
        var allowed = new HashSet<string>(["move", "resize", "resizeWidth", "resizeHeight", "textMove", "textResize", "setVisibility"], StringComparer.Ordinal);
        if (SupportedOperations.Count == 0 || SupportedOperations.Any(operation => !allowed.Contains(operation)))
            throw new ElectronEditorException(ElectronEditorErrorCodes.HandshakeFailed, "Electron-Ziel-App-Operationen sind ungültig.");
    }
}
