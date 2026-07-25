using System.IO;
using System.Text.Json;
using ReferenceTargetApp.EditorIntegration.HostAdapter;

namespace ReferenceTargetApp.EditorIntegration.Protocol;

internal static class ChangeRequestProtocolTranslator
{
    public static ChangeRequest Translate(JsonElement payload)
    {
        if (!payload.TryGetProperty("changeRequest", out var request) || request.ValueKind != JsonValueKind.Object)
            throw new InvalidDataException("submitChangeRequest enthält keinen Änderungsauftrag.");

        return new ChangeRequest(
            RequiredString(request, "changeId"),
            RequiredString(request, "elementId"),
            RequiredString(request, "operation"),
            RequiredDictionary(request, "payload"),
            RequiredTimestamp(request, "createdAt"),
            RequiredString(request, "source"),
            OptionalString(request, "scope"),
            OptionalString(request, "note"),
            OptionalString(request, "reason"));
    }

    private static string RequiredString(JsonElement source, string propertyName) =>
        source.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()!
            : throw new InvalidDataException($"Pflichtfeld fehlt oder ist ungültig: {propertyName}.");

    private static string? OptionalString(JsonElement source, string propertyName) =>
        source.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static DateTimeOffset RequiredTimestamp(JsonElement source, string propertyName) =>
        source.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String && value.TryGetDateTimeOffset(out var timestamp)
            ? timestamp
            : throw new InvalidDataException($"Zeitstempel fehlt oder ist ungültig: {propertyName}.");

    private static IReadOnlyDictionary<string, object?> RequiredDictionary(JsonElement source, string propertyName)
    {
        if (!source.TryGetProperty(propertyName, out var value) || value.ValueKind != JsonValueKind.Object)
            throw new InvalidDataException($"Objekt fehlt oder ist ungültig: {propertyName}.");
        return ConvertObject(value);
    }

    private static IReadOnlyDictionary<string, object?> ConvertObject(JsonElement source) =>
        source.EnumerateObject().ToDictionary(property => property.Name, property => ConvertValue(property.Value), StringComparer.Ordinal);

    private static object? ConvertValue(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.Object => ConvertObject(value),
        JsonValueKind.Array => value.EnumerateArray().Select(ConvertValue).ToArray(),
        JsonValueKind.String => value.GetString(),
        JsonValueKind.Number when value.TryGetInt64(out var integer) => integer,
        JsonValueKind.Number => value.GetDouble(),
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Null => null,
        _ => throw new InvalidDataException("Nicht unterstützter JSON-Wert im Änderungsauftrag.")
    };
}
