using System.Collections;
using System.Globalization;
using ReferenceTargetApp.EditorIntegration.Registry;
using ReferenceTargetApp.EditorIntegration.Geometry;
using ReferenceTargetApp.EditorIntegration.Tables;

namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

internal static class ChangeRequestValidator
{
    private const double MaximumFontSize = 35791d;
    private static readonly HashSet<string> ForbiddenFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "fachDaten", "businessData", "domainData", "database", "sql", "recordId", "entity", "entityId",
        "tableName", "customerId", "projectId", "domainStatus", "action", "actions", "save", "delete",
        "submit", "upload", "import", "export", "filePath", "command", "commands"
    };

    public static ValidationOutcome Validate(ChangeRequest? request, IUiElementRegistry registry)
    {
        ArgumentNullException.ThrowIfNull(registry);
        if (request is null)
            return ValidationOutcome.Fail(HostAdapterErrorCodes.InvalidChangeRequest, "Änderungsauftrag fehlt.");
        if (string.IsNullOrWhiteSpace(request.ChangeId) || string.IsNullOrWhiteSpace(request.ElementId) ||
            string.IsNullOrWhiteSpace(request.Operation) || string.IsNullOrWhiteSpace(request.Source) ||
            request.CreatedAt == default)
            return ValidationOutcome.Fail(HostAdapterErrorCodes.InvalidChangeRequest, "Pflichtfelder des Änderungsauftrags sind unvollständig.");

        var entry = registry.FindById(request.ElementId);
        if (entry is null)
            return ValidationOutcome.Fail(HostAdapterErrorCodes.UnknownElement, $"Element '{request.ElementId}' ist nicht registriert.");
        if (!string.IsNullOrWhiteSpace(request.Scope) && !string.Equals(request.Scope, entry.ScopeId, StringComparison.Ordinal))
            return ValidationOutcome.Fail(HostAdapterErrorCodes.WrongScope, $"Scope '{request.Scope}' passt nicht zum registrierten Element.");
        if (entry.NativeElement is null)
            return ValidationOutcome.Fail(HostAdapterErrorCodes.ElementReferenceMissing, "Native WPF-Referenz fehlt.");

        var capability = RequiredCapability(request.Operation);
        if (capability is null && request.Operation != HostAdapterOperations.Resize && !SpacingOperations.All.Contains(request.Operation) && !HostAdapterOperations.TableOperations.Contains(request.Operation))
            return ValidationOutcome.Fail(HostAdapterErrorCodes.OperationNotAllowed, $"Operation '{request.Operation}' ist nicht bekannt.");
        if (capability is not null && !entry.Capabilities.HasFlag(capability.Value))
            return ValidationOutcome.Fail(HostAdapterErrorCodes.OperationNotAllowed, $"Operation '{request.Operation}' ist für '{request.ElementId}' nicht freigegeben.");
        if (request.Payload is null)
            return ValidationOutcome.Fail(HostAdapterErrorCodes.InvalidPayload, "Payload fehlt.");

        var forbiddenPath = FindForbiddenField(request.Payload, "payload");
        if (forbiddenPath is not null)
            return ValidationOutcome.Fail(HostAdapterErrorCodes.ForbiddenField, $"Verbotenes Feld vorhanden: {forbiddenPath}.");

        return request.Operation switch
        {
            HostAdapterOperations.Move => ValidateMove(request.Payload),
            HostAdapterOperations.Resize => ValidateResize(request.Payload, entry),
            HostAdapterOperations.ResizeWidth => ValidateSingleSize(request.Payload, "width", HostAdapterOperations.ResizeWidth),
            HostAdapterOperations.ResizeHeight => ValidateSingleSize(request.Payload, "height", HostAdapterOperations.ResizeHeight),
            HostAdapterOperations.TextMove => ValidateTextMove(request.Payload),
            HostAdapterOperations.TextResize => ValidateTextResize(request.Payload),
            HostAdapterOperations.SetVisibility => ValidateVisibility(request.Payload),
            HostAdapterOperations.SpacingIncrease or HostAdapterOperations.SpacingDecrease or HostAdapterOperations.SpacingSet or HostAdapterOperations.SpacingReset => ValidateSpacing(request.Operation, request.Payload, entry),
            HostAdapterOperations.FitTableToViewport or HostAdapterOperations.ResizeColumnsProportionally or
            HostAdapterOperations.SetHorizontalOverflowMode or HostAdapterOperations.SetColumnWidthMode or
            HostAdapterOperations.SetColumnWrapMode or HostAdapterOperations.SetColumnOverflowMode or
            HostAdapterOperations.SetRowHeightMode or HostAdapterOperations.ResetTableColumn or HostAdapterOperations.ResetTable => ValidateTable(request.Operation, request.Payload, entry),
            _ => ValidationOutcome.Fail(HostAdapterErrorCodes.OperationNotAllowed, "Operation ist nicht erlaubt.")
        };
    }

    private static ValidationOutcome ValidateTable(string operation, IReadOnlyDictionary<string, object?> payload, UiRegistryEntry entry)
    {
        if (!HasOnlyKeys(payload, "table") || !TryGetDictionary(payload, "table", out var table))
            return Invalid("Tabellenoperation erwartet ausschließlich table.");
        if (entry.AllowedOperations?.Contains(operation, StringComparer.Ordinal) != true)
            return ValidationOutcome.Fail(HostAdapterErrorCodes.OperationNotAllowed, "Tabellenoperation ist für das Ziel nicht freigegeben.");
        string[] allowed = operation switch
        {
            HostAdapterOperations.FitTableToViewport => ["strategy", "selectedColumnId", "neighborAction", "previewAccepted"],
            HostAdapterOperations.ResizeColumnsProportionally => ["strategy", "previewAccepted"],
            HostAdapterOperations.SetHorizontalOverflowMode => ["horizontalOverflowMode"],
            HostAdapterOperations.SetColumnWidthMode => ["widthMode"],
            HostAdapterOperations.SetColumnWrapMode => ["wrapMode"],
            HostAdapterOperations.SetColumnOverflowMode => ["overflowMode"],
            HostAdapterOperations.SetRowHeightMode => ["rowHeightMode"],
            _ => [],
        };
        if (!HasOnlyKeys(table, allowed)) return Invalid("Tabellenpayload enthält unbekannte Felder.");
        bool StringIn(string key, IReadOnlySet<string> values) => table.TryGetValue(key, out var raw) && raw is string value && values.Contains(value);
        if (operation == HostAdapterOperations.SetHorizontalOverflowMode && !StringIn("horizontalOverflowMode", TableHorizontalOverflowModes.All)) return Invalid("Horizontaler Überlaufmodus ist ungültig.");
        if (operation == HostAdapterOperations.SetColumnWidthMode && !StringIn("widthMode", TableWidthModes.All)) return Invalid("Breitenmodus ist ungültig.");
        if (operation == HostAdapterOperations.SetColumnWrapMode && !StringIn("wrapMode", TableWrapModes.All)) return Invalid("Umbruchmodus ist ungültig.");
        if (operation == HostAdapterOperations.SetColumnOverflowMode && !StringIn("overflowMode", TableOverflowModes.All)) return Invalid("Überlaufmodus ist ungültig.");
        if (operation == HostAdapterOperations.SetRowHeightMode && !StringIn("rowHeightMode", TableRowHeightModes.All)) return Invalid("Zeilenhöhenmodus ist ungültig.");
        if (operation is HostAdapterOperations.FitTableToViewport or HostAdapterOperations.ResizeColumnsProportionally &&
            (!table.TryGetValue("previewAccepted", out var accepted) || accepted is not true))
            return ValidationOutcome.Fail("table_preview_confirmation_required", "Tabellenanpassung braucht eine bestätigte Vorschau.");
        if (entry.WpfTableBinding is null && entry.WpfTableColumnBinding is null)
            return ValidationOutcome.Fail(HostAdapterErrorCodes.ElementReferenceMissing, "WPF-Tabellenbindung fehlt.");
        return ValidationOutcome.Ok(new(operation, TableIntent: new Dictionary<string, object?>(table, StringComparer.Ordinal)));
    }

    private static ValidationOutcome ValidateMove(IReadOnlyDictionary<string, object?> payload)
    {
        if (!HasOnlyKeys(payload, "x", "y") || (!payload.ContainsKey("x") && !payload.ContainsKey("y")))
            return Invalid("move erwartet ausschließlich x und/oder y.");
        if (!TryOptionalFiniteNumber(payload, "x", out var x) || !TryOptionalFiniteNumber(payload, "y", out var y))
            return Invalid("x und y müssen endliche Zahlen sein.");
        return ValidationOutcome.Ok(new ValidatedLayoutChange(HostAdapterOperations.Move, X: x, Y: y));
    }

    private static ValidationOutcome ValidateSingleSize(
        IReadOnlyDictionary<string, object?> payload,
        string field,
        string operation)
    {
        if (!HasOnlyKeys(payload, field) || !TryRequiredFiniteNumber(payload, field, out var value) || value <= 0)
            return Invalid($"{operation} erwartet ausschließlich eine positive endliche Zahl in {field}.");
        return operation == HostAdapterOperations.ResizeWidth
            ? ValidationOutcome.Ok(new ValidatedLayoutChange(operation, Width: value))
            : ValidationOutcome.Ok(new ValidatedLayoutChange(operation, Height: value));
    }

    private static ValidationOutcome ValidateResize(
        IReadOnlyDictionary<string, object?> payload,
        UiRegistryEntry entry)
    {
        if (!HasOnlyKeys(payload, "width", "height") || (!payload.ContainsKey("width") && !payload.ContainsKey("height")) ||
            !TryOptionalFiniteNumber(payload, "width", out var width) || !TryOptionalFiniteNumber(payload, "height", out var height) ||
            width <= 0 || height <= 0)
            return Invalid("resize erwartet ausschließlich positive endliche Werte in width und/oder height.");
        if (width is not null && !entry.Capabilities.HasFlag(UiCapability.Width) ||
            height is not null && !entry.Capabilities.HasFlag(UiCapability.Height))
            return ValidationOutcome.Fail(HostAdapterErrorCodes.OperationNotAllowed, "resize enthält eine nicht freigegebene Größenachse.");
        return ValidationOutcome.Ok(new ValidatedLayoutChange(HostAdapterOperations.Resize, Width: width, Height: height));
    }

    private static ValidationOutcome ValidateTextMove(IReadOnlyDictionary<string, object?> payload)
    {
        if (!HasOnlyKeys(payload, "text") || !TryGetDictionary(payload, "text", out var text) ||
            !HasOnlyKeys(text, "offsetX", "offsetY") || (!text.ContainsKey("offsetX") && !text.ContainsKey("offsetY")))
            return Invalid("textMove erwartet ausschließlich text.offsetX und/oder text.offsetY.");
        if (!TryOptionalFiniteNumber(text, "offsetX", out var offsetX) || !TryOptionalFiniteNumber(text, "offsetY", out var offsetY) ||
            offsetX < 0 || offsetY < 0)
            return Invalid("Textoffsets müssen endliche, nicht-negative Zahlen sein.");
        return ValidationOutcome.Ok(new ValidatedLayoutChange(HostAdapterOperations.TextMove, TextOffsetX: offsetX, TextOffsetY: offsetY));
    }

    private static ValidationOutcome ValidateTextResize(IReadOnlyDictionary<string, object?> payload)
    {
        if (!HasOnlyKeys(payload, "text") || !TryGetDictionary(payload, "text", out var text) ||
            !HasOnlyKeys(text, "fontSize", "unit", "expectedCurrentFontSize") || !TryRequiredFiniteNumber(text, "fontSize", out var fontSize) ||
            fontSize <= 0 || fontSize > MaximumFontSize)
            return Invalid($"textResize erwartet eine Schriftgröße größer 0 und höchstens {MaximumFontSize.ToString(CultureInfo.InvariantCulture)}.");
        if (text.TryGetValue("unit", out var rawUnit) &&
            (rawUnit is not string unit || !string.Equals(unit, TextResizeContract.Unit, StringComparison.Ordinal)))
            return Invalid("textResize verwendet ausschliesslich die normalisierte Einheit dip.");
        if (!TryOptionalFiniteNumber(text, "expectedCurrentFontSize", out var expectedCurrentFontSize) || expectedCurrentFontSize <= 0)
            return Invalid("Der erwartete aktuelle Schriftwert muss eine positive endliche DIP-Zahl sein.");
        return ValidationOutcome.Ok(new ValidatedLayoutChange(HostAdapterOperations.TextResize,
            FontSize: fontSize, ExpectedCurrentFontSize: expectedCurrentFontSize));
    }

    private static ValidationOutcome ValidateVisibility(IReadOnlyDictionary<string, object?> payload)
    {
        if (!HasOnlyKeys(payload, "visible") || !payload.TryGetValue("visible", out var raw) || raw is not bool visible)
            return Invalid("setVisibility erwartet ausschliesslich einen Boolean in visible.");
        return ValidationOutcome.Ok(new ValidatedLayoutChange(HostAdapterOperations.SetVisibility, Visible: visible));
    }

    private static ValidationOutcome ValidateSpacing(string operation, IReadOnlyDictionary<string, object?> payload, UiRegistryEntry entry)
    {
        if (!HasOnlyKeys(payload, "spacing") || !TryGetDictionary(payload, "spacing", out var spacing))
            return Invalid("Abstandsoperation erwartet ausschließlich spacing.");
        var expectedKeys = operation == HostAdapterOperations.SpacingReset ? new[] { "target" } : new[] { "target", "value" };
        if (!HasOnlyKeys(spacing, expectedKeys) || !spacing.TryGetValue("target", out var rawTarget) || rawTarget is not string target ||
            !SpacingTargets.All.Contains(target) || entry.SpacingTargets?.Contains(target, StringComparer.Ordinal) != true)
            return ValidationOutcome.Fail(HostAdapterErrorCodes.OperationNotAllowed, "Abstandsziel ist nicht freigegeben.");
        double? value = null;
        if (operation != HostAdapterOperations.SpacingReset)
        {
            if (!TryRequiredFiniteNumber(spacing, "value", out var parsed) || parsed < 0)
                return Invalid("Abstandswert muss endlich und nicht negativ sein.");
            value = parsed;
        }
        return ValidationOutcome.Ok(new(operation, SpacingTarget: target, SpacingValue: value));
    }

    private static UiCapability? RequiredCapability(string operation) => operation switch
    {
        HostAdapterOperations.Move => UiCapability.Position,
        HostAdapterOperations.ResizeWidth => UiCapability.Width,
        HostAdapterOperations.ResizeHeight => UiCapability.Height,
        HostAdapterOperations.TextMove => UiCapability.TextPosition,
        HostAdapterOperations.TextResize => UiCapability.FontSize,
        HostAdapterOperations.SetVisibility => UiCapability.Visibility,
        HostAdapterOperations.SpacingIncrease or HostAdapterOperations.SpacingDecrease or HostAdapterOperations.SpacingSet or HostAdapterOperations.SpacingReset => UiCapability.Spacing,
        _ => null
    };

    private static bool HasOnlyKeys(IReadOnlyDictionary<string, object?> payload, params string[] keys)
    {
        var allowed = new HashSet<string>(keys, StringComparer.Ordinal);
        return payload.Keys.All(allowed.Contains);
    }

    private static bool TryGetDictionary(
        IReadOnlyDictionary<string, object?> source,
        string key,
        out IReadOnlyDictionary<string, object?> value)
    {
        if (source.TryGetValue(key, out var raw) && raw is IReadOnlyDictionary<string, object?> dictionary)
        {
            value = dictionary;
            return true;
        }
        value = null!;
        return false;
    }

    private static bool TryRequiredFiniteNumber(
        IReadOnlyDictionary<string, object?> source,
        string key,
        out double value)
    {
        value = 0;
        return source.TryGetValue(key, out var raw) && TryFiniteNumber(raw, out value);
    }

    private static bool TryOptionalFiniteNumber(
        IReadOnlyDictionary<string, object?> source,
        string key,
        out double? value)
    {
        value = null;
        if (!source.TryGetValue(key, out var raw)) return true;
        if (!TryFiniteNumber(raw, out var number)) return false;
        value = number;
        return true;
    }

    private static bool TryFiniteNumber(object? value, out double number)
    {
        number = 0;
        if (value is null or bool or char or string || value is not IConvertible) return false;
        try
        {
            number = Convert.ToDouble(value, CultureInfo.InvariantCulture);
            return double.IsFinite(number);
        }
        catch (Exception exception) when (exception is FormatException or InvalidCastException or OverflowException)
        {
            return false;
        }
    }

    private static string? FindForbiddenField(object? value, string path)
    {
        if (value is IReadOnlyDictionary<string, object?> dictionary)
        {
            foreach (var pair in dictionary)
            {
                var fieldPath = $"{path}.{pair.Key}";
                if (ForbiddenFields.Contains(pair.Key)) return fieldPath;
                var nested = FindForbiddenField(pair.Value, fieldPath);
                if (nested is not null) return nested;
            }
        }
        else if (value is IEnumerable sequence and not string)
        {
            var index = 0;
            foreach (var item in sequence)
            {
                var nested = FindForbiddenField(item, $"{path}[{index++}]");
                if (nested is not null) return nested;
            }
        }
        return null;
    }

    private static ValidationOutcome Invalid(string message) =>
        ValidationOutcome.Fail(HostAdapterErrorCodes.InvalidPayload, message);
}

internal sealed record ValidationOutcome(
    bool Success,
    ValidatedLayoutChange? Change,
    string? ErrorCode,
    string? Message)
{
    public static ValidationOutcome Ok(ValidatedLayoutChange change) => new(true, change, null, null);
    public static ValidationOutcome Fail(string errorCode, string message) => new(false, null, errorCode, message);
}
