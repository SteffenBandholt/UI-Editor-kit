namespace ReferenceTargetApp.EditorIntegration.Persistence;

public sealed record LayoutProfileDefinition(string ProfileId, string DisplayName);

public static class LayoutProfileCatalog
{
    public const string StandardId = "standard";
    public const string CompactId = "compact";

    public static IReadOnlyList<LayoutProfileDefinition> All { get; } =
    [
        new(StandardId, "Standard"),
        new(CompactId, "Kompakt")
    ];

    public static LayoutProfileDefinition? Find(string profileId) =>
        All.FirstOrDefault(profile => string.Equals(profile.ProfileId, profileId, StringComparison.Ordinal));
}
