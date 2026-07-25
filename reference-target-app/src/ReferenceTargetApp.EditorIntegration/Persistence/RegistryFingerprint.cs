using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.EditorIntegration.Persistence;

public static class RegistryFingerprint
{
    public static string Create(IUiElementRegistry registry)
    {
        ArgumentNullException.ThrowIfNull(registry);
        var canonical = registry.Entries
            .OrderBy(entry => entry.ElementId, StringComparer.Ordinal)
            .Select(entry => new
            {
                elementId = entry.ElementId,
                scopeId = entry.ScopeId,
                parentId = entry.ParentId,
                kind = entry.Kind.ToString(),
                capabilities = Enum.GetValues<UiCapability>()
                    .Where(capability => capability != UiCapability.None && entry.Capabilities.HasFlag(capability))
                    .Select(capability => capability.ToString())
                    .OrderBy(value => value, StringComparer.Ordinal)
                    .ToArray()
            });
        var json = JsonSerializer.Serialize(canonical);
        return $"sha256:{Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(json)))}";
    }
}
