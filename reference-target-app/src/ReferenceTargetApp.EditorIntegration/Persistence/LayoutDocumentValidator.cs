using System.Text.Json;
using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.EditorIntegration.Persistence;

public static class LayoutDocumentValidator
{
    private const double MaximumFontSize = 512;
    private static readonly HashSet<string> DocumentFields = new(StringComparer.Ordinal)
    {
        "schemaVersion", "applicationId", "profileId", "scopeId", "savedAt", "registryFingerprint", "layoutState"
    };
    private static readonly HashSet<string> LayoutStateFields = new(StringComparer.Ordinal) { "elements" };
    private static readonly HashSet<string> ElementFields = new(StringComparer.Ordinal)
    {
        "elementId", "scopeId", "x", "y", "width", "height", "textOffsetX", "textOffsetY", "fontSize", "visible"
    };

    public static LayoutDocumentValidationResult ValidateJsonShape(JsonElement root)
    {
        var errors = new List<LayoutPersistenceError>();
        if (root.ValueKind != JsonValueKind.Object)
            return Result(new("invalid_layout_document", "Speicherdokument muss ein Objekt sein."));

        ValidateObjectFields(root, DocumentFields, string.Empty, errors);
        if (!root.TryGetProperty("layoutState", out var layoutState) || layoutState.ValueKind != JsonValueKind.Object)
        {
            errors.Add(new("invalid_layout_document", "layoutState muss ein Objekt sein.", "layoutState"));
            return new(errors);
        }

        ValidateObjectFields(layoutState, LayoutStateFields, "layoutState", errors);
        if (!layoutState.TryGetProperty("elements", out var elements) || elements.ValueKind != JsonValueKind.Array)
        {
            errors.Add(new("invalid_layout_document", "layoutState.elements muss eine Liste sein.", "layoutState.elements"));
            return new(errors);
        }

        var index = 0;
        foreach (var element in elements.EnumerateArray())
        {
            var path = $"layoutState.elements[{index++}]";
            if (element.ValueKind != JsonValueKind.Object)
            {
                errors.Add(new("invalid_layout_document", "Layout-Element muss ein Objekt sein.", path));
                continue;
            }
            ValidateObjectFields(element, ElementFields, path, errors);
        }
        return new(errors);
    }

    public static LayoutDocumentValidationResult Validate(
        PersistedLayoutDocument? document,
        LayoutPersistenceOptions options,
        IUiElementRegistry registry)
    {
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(registry);
        var errors = new List<LayoutPersistenceError>();
        if (document is null)
            return Result(new("invalid_layout_document", "Speicherdokument fehlt."));

        if (document.SchemaVersion != PersistedLayoutDocumentFactory.SchemaVersion)
            errors.Add(new("unsupported_schema_version", "schemaVersion wird nicht unterstützt.", "schemaVersion"));
        if (!string.Equals(document.ApplicationId, options.ApplicationId, StringComparison.Ordinal))
            errors.Add(new("wrong_application", "applicationId passt nicht zur Ziel-App.", "applicationId"));
        if (!string.Equals(document.ProfileId, options.ProfileId, StringComparison.Ordinal))
            errors.Add(new("wrong_profile", "profileId passt nicht zum Layoutprofil.", "profileId"));
        if (!string.Equals(document.ScopeId, options.ScopeId, StringComparison.Ordinal))
            errors.Add(new("wrong_scope", "scopeId passt nicht zum registrierten Bereich.", "scopeId"));
        if (document.SavedAt == default)
            errors.Add(new("invalid_layout_document", "savedAt fehlt oder ist ungültig.", "savedAt"));

        var expectedFingerprint = RegistryFingerprint.Create(registry);
        if (!string.Equals(document.RegistryFingerprint, expectedFingerprint, StringComparison.Ordinal))
            errors.Add(new("incompatible_registry", "Registry-Fingerprint ist nicht kompatibel.", "registryFingerprint"));

        if (document.LayoutState?.Elements is null)
        {
            errors.Add(new("invalid_layout_document", "layoutState.elements fehlt.", "layoutState.elements"));
            return new(errors);
        }

        var registered = registry.Entries.ToDictionary(entry => entry.ElementId, StringComparer.Ordinal);
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var element in document.LayoutState.Elements)
        {
            if (element is null || string.IsNullOrWhiteSpace(element.ElementId))
            {
                errors.Add(new("invalid_layout_document", "Element-ID fehlt.", "layoutState.elements.elementId"));
                continue;
            }
            if (!seen.Add(element.ElementId))
            {
                errors.Add(new("duplicate_element", $"Element '{element.ElementId}' ist doppelt vorhanden.", "layoutState.elements.elementId"));
                continue;
            }
            if (!registered.TryGetValue(element.ElementId, out var entry))
            {
                errors.Add(new("unknown_element", $"Element '{element.ElementId}' ist nicht registriert.", "layoutState.elements.elementId"));
                continue;
            }
            ValidateElement(element, entry, options, errors);
        }

        foreach (var missingId in registered.Keys.Except(seen, StringComparer.Ordinal))
            errors.Add(new("missing_element", $"Registriertes Element '{missingId}' fehlt im LayoutState.", "layoutState.elements"));

        return new(errors);
    }

    private static void ValidateElement(
        PersistedElementLayout element,
        UiRegistryEntry entry,
        LayoutPersistenceOptions options,
        ICollection<LayoutPersistenceError> errors)
    {
        var prefix = $"layoutState.elements.{entry.ElementId}";
        if (!string.Equals(element.ScopeId, options.ScopeId, StringComparison.Ordinal) ||
            !string.Equals(element.ScopeId, entry.ScopeId, StringComparison.Ordinal))
            errors.Add(new("wrong_scope", "Element verwendet einen unzulässigen Scope.", $"{prefix}.scopeId"));

        ValidateCapabilityPair(element.X, element.Y, entry.Capabilities.HasFlag(UiCapability.Position), "position", prefix, errors);
        ValidateCapabilityValue(element.Width, entry.Capabilities.HasFlag(UiCapability.Width), "width", prefix, errors, positive: true);
        ValidateCapabilityValue(element.Height, entry.Capabilities.HasFlag(UiCapability.Height), "height", prefix, errors, positive: true);
        ValidateCapabilityPair(element.TextOffsetX, element.TextOffsetY, entry.Capabilities.HasFlag(UiCapability.TextPosition), "textOffset", prefix, errors, nonNegative: true);
        ValidateCapabilityValue(element.FontSize, entry.Capabilities.HasFlag(UiCapability.FontSize), "fontSize", prefix, errors, positive: true, maximum: MaximumFontSize);
        ValidateCapabilityBoolean(element.Visible, entry.Capabilities.HasFlag(UiCapability.Visibility), "visible", prefix, errors);
    }

    private static void ValidateCapabilityBoolean(
        bool? value,
        bool allowed,
        string field,
        string prefix,
        ICollection<LayoutPersistenceError> errors)
    {
        if (!allowed)
        {
            if (value is not null)
                errors.Add(new("operation_not_allowed", $"{field} ist fuer dieses Element nicht erlaubt.", $"{prefix}.{field}"));
            return;
        }
        if (value is null)
            errors.Add(new("invalid_layout_value", $"{field} fehlt.", $"{prefix}.{field}"));
    }

    private static void ValidateCapabilityPair(
        double? first,
        double? second,
        bool allowed,
        string field,
        string prefix,
        ICollection<LayoutPersistenceError> errors,
        bool nonNegative = false)
    {
        if (!allowed)
        {
            if (first is not null || second is not null)
                errors.Add(new("operation_not_allowed", $"{field} ist für dieses Element nicht erlaubt.", $"{prefix}.{field}"));
            return;
        }
        if (first is null || second is null)
        {
            errors.Add(new("invalid_layout_value", $"{field} muss vollständig vorhanden sein.", $"{prefix}.{field}"));
            return;
        }
        ValidateNumber(first.Value, $"{prefix}.{field}", errors, nonNegative: nonNegative);
        ValidateNumber(second.Value, $"{prefix}.{field}", errors, nonNegative: nonNegative);
    }

    private static void ValidateCapabilityValue(
        double? value,
        bool allowed,
        string field,
        string prefix,
        ICollection<LayoutPersistenceError> errors,
        bool positive = false,
        double? maximum = null)
    {
        if (!allowed)
        {
            if (value is not null)
                errors.Add(new("operation_not_allowed", $"{field} ist für dieses Element nicht erlaubt.", $"{prefix}.{field}"));
            return;
        }
        if (value is null)
        {
            errors.Add(new("invalid_layout_value", $"{field} fehlt.", $"{prefix}.{field}"));
            return;
        }
        ValidateNumber(value.Value, $"{prefix}.{field}", errors, positive: positive, maximum: maximum);
    }

    private static void ValidateNumber(
        double value,
        string field,
        ICollection<LayoutPersistenceError> errors,
        bool positive = false,
        bool nonNegative = false,
        double? maximum = null)
    {
        if (!double.IsFinite(value) || positive && value <= 0 || nonNegative && value < 0 || maximum is not null && value > maximum)
            errors.Add(new("invalid_layout_value", "Layoutwert ist nicht endlich oder außerhalb des zulässigen Bereichs.", field));
    }

    private static void ValidateObjectFields(
        JsonElement value,
        ISet<string> allowed,
        string path,
        ICollection<LayoutPersistenceError> errors)
    {
        foreach (var property in value.EnumerateObject())
        {
            if (!allowed.Contains(property.Name))
                errors.Add(new("forbidden_field", $"Feld '{property.Name}' ist nicht erlaubt.", string.IsNullOrEmpty(path) ? property.Name : $"{path}.{property.Name}"));
        }
    }

    private static LayoutDocumentValidationResult Result(LayoutPersistenceError error) => new([error]);
}
