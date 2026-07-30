using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace ReferenceTargetApp.EditorIntegration.Topology;

public sealed record UiTopologyNode(
    string ControlType,
    string RegistryId,
    string? ParentRegistryId,
    int Order,
    bool DynamicContent = false);

public sealed record UiTopologyComparison(
    bool Success,
    string BeforeFingerprint,
    string AfterFingerprint,
    string? ErrorCode);

public static class UiTopologyFingerprint
{
    public static string Create(IEnumerable<UiTopologyNode> nodes)
    {
        ArgumentNullException.ThrowIfNull(nodes);
        var included = nodes.Where(node => !node.DynamicContent).ToArray();
        if (included.Any(node => string.IsNullOrWhiteSpace(node.ControlType) || string.IsNullOrWhiteSpace(node.RegistryId) || node.Order < 0))
            throw new ArgumentException("Jeder Topologieknoten braucht Controltyp, Registry-ID und Reihenfolge.", nameof(nodes));
        if (included.Select(node => node.RegistryId).Distinct(StringComparer.Ordinal).Count() != included.Length)
            throw new ArgumentException("Registry-IDs im Topologie-Fingerprint muessen eindeutig sein.", nameof(nodes));
        var ids = included.Select(node => node.RegistryId).ToHashSet(StringComparer.Ordinal);
        if (included.Any(node => node.ParentRegistryId is not null && !ids.Contains(node.ParentRegistryId)))
            throw new ArgumentException("Ein Topologie-Parent fehlt.", nameof(nodes));
        var canonical = included
            .OrderBy(node => node.ParentRegistryId ?? string.Empty, StringComparer.Ordinal)
            .ThenBy(node => node.Order)
            .ThenBy(node => node.RegistryId, StringComparer.Ordinal)
            .Select(node => new
            {
                kind = node.ControlType.Trim(),
                stableId = node.RegistryId.Trim(),
                parentId = node.ParentRegistryId,
                order = node.Order,
            });
        var json = JsonSerializer.Serialize(canonical);
        return $"sha256:{Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(json)))}";
    }

    public static UiTopologyComparison Compare(IEnumerable<UiTopologyNode> before, IEnumerable<UiTopologyNode> after)
    {
        var beforeFingerprint = Create(before);
        var afterFingerprint = Create(after);
        var success = string.Equals(beforeFingerprint, afterFingerprint, StringComparison.Ordinal);
        return new(success, beforeFingerprint, afterFingerprint, success ? null : "target_ui_topology_changed");
    }
}
