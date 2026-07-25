using System.Collections;
using System.Collections.ObjectModel;

namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

public sealed class ChangeRequest
{
    public ChangeRequest(
        string changeId,
        string elementId,
        string operation,
        IReadOnlyDictionary<string, object?>? payload,
        DateTimeOffset createdAt,
        string source,
        string? scope = null,
        string? note = null,
        string? reason = null)
    {
        ChangeId = changeId;
        ElementId = elementId;
        Operation = operation;
        Payload = payload is null ? null : CopyDictionary(payload);
        CreatedAt = createdAt;
        Source = source;
        Scope = scope;
        Note = note;
        Reason = reason;
    }

    public string ChangeId { get; }
    public string ElementId { get; }
    public string Operation { get; }
    public IReadOnlyDictionary<string, object?>? Payload { get; }
    public DateTimeOffset CreatedAt { get; }
    public string Source { get; }
    public string? Scope { get; }
    public string? Note { get; }
    public string? Reason { get; }

    private static IReadOnlyDictionary<string, object?> CopyDictionary(IReadOnlyDictionary<string, object?> source)
    {
        var copy = source.ToDictionary(pair => pair.Key, pair => CopyValue(pair.Value), StringComparer.Ordinal);
        return new ReadOnlyDictionary<string, object?>(copy);
    }

    private static object? CopyValue(object? value)
    {
        if (value is IReadOnlyDictionary<string, object?> readOnlyDictionary)
            return CopyDictionary(readOnlyDictionary);
        if (value is IDictionary<string, object?> dictionary)
            return CopyDictionary(new ReadOnlyDictionary<string, object?>(dictionary));
        if (value is IEnumerable sequence and not string)
            return new ReadOnlyCollection<object?>(sequence.Cast<object?>().Select(CopyValue).ToList());
        return value;
    }
}
