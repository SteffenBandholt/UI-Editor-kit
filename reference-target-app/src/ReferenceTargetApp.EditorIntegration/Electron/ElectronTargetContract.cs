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
    string PdfCapability,
    ElectronPdfTargetContract? PdfContract,
    ElectronStartupLayoutReceipt? StartupLayout = null)
{
    public const string CurrentVersion = "1.2";
    public const string CurrentAdapterVersion = "1.2";

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
            string.IsNullOrWhiteSpace(SessionId) || ProcessId < 1 || PdfCapability is not ("available" or "unavailable") ||
            PdfCapability == "available" && PdfContract is null || PdfCapability == "unavailable" && PdfContract is not null)
            throw new ElectronEditorException(ElectronEditorErrorCodes.HandshakeFailed, "Electron-Ziel-App-Vertrag verletzt M80.");
        var allowed = new HashSet<string>(["move", "resize", "resizeWidth", "resizeHeight", "textMove", "textResize", "setVisibility",
            "spacingIncrease", "spacingDecrease", "spacingSet", "spacingReset"], StringComparer.Ordinal);
        if (SupportedOperations.Count == 0 || SupportedOperations.Any(operation => !allowed.Contains(operation)))
            throw new ElectronEditorException(ElectronEditorErrorCodes.HandshakeFailed, "Electron-Ziel-App-Operationen sind ungültig.");
        PdfContract?.Validate(ApplicationId);
        StartupLayout?.Validate();
    }
}

public sealed record ElectronStartupLayoutReceipt(
    bool Applied,
    string State,
    string Code,
    string? ProfileId = null,
    DateTimeOffset? SavedAt = null,
    string? ProfileSha256 = null,
    bool EditorProcessRequired = false)
{
    public void Validate()
    {
        if (EditorProcessRequired || string.IsNullOrWhiteSpace(State) || string.IsNullOrWhiteSpace(Code) ||
            Applied && (State != "compatible" || string.IsNullOrWhiteSpace(ProfileId) || SavedAt is null ||
                        string.IsNullOrWhiteSpace(ProfileSha256) || ProfileSha256.Length != 64))
            throw new ElectronEditorException(ElectronEditorErrorCodes.HandshakeFailed, "Startlayout-Nachweis ist ungültig.");
    }
}

public sealed record ElectronPdfTargetContract(
    string ApplicationId,
    string DocumentTypeId,
    string DisplayName,
    string ContractVersion,
    int RegistryVersion,
    string RegistryFingerprint,
    string ProfileScope,
    IReadOnlyList<string> SupportedOperations,
    string PageSettingsCapability,
    string PreviewCapability,
    string RegenerateCapability,
    string ActiveDocumentId,
    string PdfRegistryStatus)
{
    public void Validate(string expectedApplicationId)
    {
        var allowed = new HashSet<string>(["move", "resize", "resizeWidth", "resizeHeight", "textMove", "textResize",
            "setTextAlignment", "setLineSpacing", "setVisibility", "setPageMargins"], StringComparer.Ordinal);
        if (ApplicationId != expectedApplicationId || string.IsNullOrWhiteSpace(DocumentTypeId) || string.IsNullOrWhiteSpace(DisplayName) ||
            ContractVersion != "1.0" || RegistryVersion < 1 || !RegistryFingerprint.StartsWith("sha256:", StringComparison.Ordinal) || RegistryFingerprint.Length != 71 ||
            string.IsNullOrWhiteSpace(ProfileScope) || !ProfileScope.StartsWith("pdf.", StringComparison.Ordinal) ||
            SupportedOperations.Count == 0 || SupportedOperations.Any(operation => !allowed.Contains(operation)) ||
            PageSettingsCapability is not ("margins" or "none") || PreviewCapability != "nativePdf" || RegenerateCapability != "explicit" ||
            string.IsNullOrWhiteSpace(ActiveDocumentId) || PdfRegistryStatus is not ("available" or "unavailable" or "incomplete" or "changed" or "incompatible" or "blocked"))
            throw new ElectronEditorException(ElectronEditorErrorCodes.HandshakeFailed, "Electron-PDF-Zielvertrag ist ungueltig.");
    }
}
