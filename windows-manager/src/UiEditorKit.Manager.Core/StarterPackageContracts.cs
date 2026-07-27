using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using UiEditorKit.Manager.Domain;

namespace UiEditorKit.Manager.Core;

public static partial class StarterTargetContract
{
    public const int SchemaVersion = 2;
    public const string ProductName = "App-Starterpaket";
    public const string ManifestFileName = "ui-editor-target.json";
    public const string OwnershipFileName = ".ui-editor-kit/starter-installation.json";
    public const string ContractVersion = "1.2";
    public const string TransportProtocolVersion = "1.0";
    public const string EmptyRegistryFingerprint = "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

    public static IReadOnlyList<string> Validate(StarterTargetManifest? manifest)
    {
        var errors = new List<string>();
        if (manifest is null) return ["Manifest fehlt."];
        if (manifest.SchemaVersion != SchemaVersion) errors.Add("schemaVersion wird nicht unterstuetzt.");
        if (string.IsNullOrWhiteSpace(manifest.StarterPackageVersion)) errors.Add("starterPackageVersion fehlt.");
        if (!ApplicationIdPattern().IsMatch(manifest.ApplicationId ?? string.Empty)) errors.Add("applicationId ist ungueltig.");
        if (string.IsNullOrWhiteSpace(manifest.DisplayName)) errors.Add("displayName fehlt.");
        if (!StarterFrameworks.Supported.Contains(manifest.Framework)) errors.Add("Framework wird nicht unterstuetzt.");
        if (manifest.IntegrationMode is not (StarterIntegrationModes.NewApp or StarterIntegrationModes.ExistingApp)) errors.Add("integrationMode ist ungueltig.");
        if (manifest.ContractVersion != ContractVersion) errors.Add("contractVersion ist inkompatibel.");
        if (string.IsNullOrWhiteSpace(manifest.AdapterVersion)) errors.Add("adapterVersion fehlt.");
        if (!StarterRegistryStatuses.Supported.Contains(manifest.RegistryStatus)) errors.Add("registryStatus ist ungueltig.");
        if (manifest.RegistryVersion < 0) errors.Add("registryVersion ist ungueltig.");
        if (!FingerprintPattern().IsMatch(manifest.RegistryFingerprint ?? string.Empty)) errors.Add("registryFingerprint ist ungueltig.");
        if (!ManagerPathRules.IsSafeRelativePath(manifest.ProfileRoot)) errors.Add("profileRoot ist unsicher.");
        if (manifest.SelectionCapability != "bidirectional") errors.Add("selectionCapability ist inkompatibel.");
        if (!manifest.VisibilityCapability) errors.Add("visibilityCapability fehlt.");
        if (!manifest.LabelFieldSeparation) errors.Add("labelFieldSeparation fehlt.");
        if (manifest.TransportProtocolVersion != TransportProtocolVersion) errors.Add("transportProtocolVersion ist inkompatibel.");
        if (manifest.InstallationOwnership is null || manifest.InstallationOwnership.Owner != ProductName ||
            manifest.InstallationOwnership.ManifestPath != OwnershipFileName)
            errors.Add("installationOwnership ist ungueltig.");
        if (manifest.IntegrationMode == StarterIntegrationModes.NewApp && manifest.RegistryStatus == StarterRegistryStatuses.RegistrationRequired)
            errors.Add("Neue Apps duerfen nicht in den Bestandsregistrierungsstatus wechseln.");
        if (manifest.IntegrationMode == StarterIntegrationModes.ExistingApp && manifest.RegistryStatus == StarterRegistryStatuses.Development)
            errors.Add("Bestehende Apps duerfen nicht als development registriert werden.");
        if (manifest.RegistryStatus is StarterRegistryStatuses.Development or StarterRegistryStatuses.RegistrationRequired && manifest.ActiveScopes.Count != 0)
            errors.Add("Unvollstaendige Apps duerfen keine aktiven Scopes vortaeuschen.");
        return errors;
    }

    public static string PreviewId(string root, string version, IEnumerable<StarterPlanFile> files)
    {
        var canonical = string.Join('\n', new[] { Path.GetFullPath(root), version }.Concat(files.OrderBy(item => item.RelativePath, StringComparer.Ordinal)
            .Select(item => $"{item.RelativePath}|{item.Action}|{item.OldHash}|{item.NewHash}")));
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
    }

    [GeneratedRegex("^[a-z0-9][a-z0-9.-]{2,79}$", RegexOptions.CultureInvariant)]
    private static partial Regex ApplicationIdPattern();

    [GeneratedRegex("^sha256:[a-f0-9]{64}$", RegexOptions.CultureInvariant)]
    private static partial Regex FingerprintPattern();
}
