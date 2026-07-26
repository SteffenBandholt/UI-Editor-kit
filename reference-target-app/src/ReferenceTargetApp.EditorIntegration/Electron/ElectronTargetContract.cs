using System.Text.Json;

namespace ReferenceTargetApp.EditorIntegration.Electron;

public sealed record ElectronTargetContract(
    string ApplicationId,
    string DisplayName,
    string Framework,
    string ContractVersion,
    int RegistryVersion,
    IReadOnlyList<string> ActiveScopes,
    string ProfileRoot,
    IReadOnlyList<string> SupportedOperations,
    string SelectionCapability,
    bool VisibilityCapability,
    bool LabelFieldSeparation,
    string TransportProtocolVersion,
    string SessionId,
    int ProcessId,
    string PdfCapability)
{
    public const string CurrentVersion = "1.0";

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
        if (string.IsNullOrWhiteSpace(ApplicationId) || string.IsNullOrWhiteSpace(DisplayName) ||
            Framework != "electron" || ContractVersion != CurrentVersion || RegistryVersion < 1 ||
            ActiveScopes.Count == 0 || ActiveScopes.Distinct(StringComparer.Ordinal).Count() != ActiveScopes.Count ||
            string.IsNullOrWhiteSpace(ProfileRoot) || SelectionCapability != "bidirectional" ||
            !VisibilityCapability || !LabelFieldSeparation || TransportProtocolVersion != LocalTargetProtocol.Version ||
            string.IsNullOrWhiteSpace(SessionId) || ProcessId < 1 || PdfCapability != "unavailable")
            throw new ElectronEditorException(ElectronEditorErrorCodes.HandshakeFailed, "Electron-Ziel-App-Vertrag verletzt M80.");
        var allowed = new HashSet<string>(["move", "resize", "resizeWidth", "resizeHeight", "textMove", "textResize", "setVisibility"], StringComparer.Ordinal);
        if (SupportedOperations.Count == 0 || SupportedOperations.Any(operation => !allowed.Contains(operation)))
            throw new ElectronEditorException(ElectronEditorErrorCodes.HandshakeFailed, "Electron-Ziel-App-Operationen sind ungültig.");
    }
}
