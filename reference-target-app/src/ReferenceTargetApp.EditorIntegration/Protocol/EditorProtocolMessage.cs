using System.Text.Json;
using System.Text.Json.Serialization;

namespace ReferenceTargetApp.EditorIntegration.Protocol;

public sealed record EditorProtocolMessage(
    string ProtocolVersion,
    string MessageId,
    string MessageType,
    DateTimeOffset Timestamp,
    JsonElement Payload,
    string? SessionId = null,
    string? ReplyTo = null);

internal static class EditorProtocolJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNameCaseInsensitive = false
    };

    public static EditorProtocolMessage Create(string messageType, object payload, string? sessionId = null) => new(
        EditorProtocol.Version,
        $"host-{Guid.NewGuid():N}",
        messageType,
        DateTimeOffset.UtcNow,
        JsonSerializer.SerializeToElement(payload, Options),
        sessionId);

    public static string Serialize(EditorProtocolMessage message) => JsonSerializer.Serialize(message, Options);

    public static bool TryDeserialize(string line, out EditorProtocolMessage? message)
    {
        try
        {
            message = JsonSerializer.Deserialize<EditorProtocolMessage>(line, Options);
            return message is not null &&
                   !string.IsNullOrWhiteSpace(message.ProtocolVersion) &&
                   !string.IsNullOrWhiteSpace(message.MessageId) &&
                   !string.IsNullOrWhiteSpace(message.MessageType) &&
                   message.Timestamp != default &&
                   message.Payload.ValueKind == JsonValueKind.Object;
        }
        catch (JsonException)
        {
            message = null;
            return false;
        }
    }
}
