namespace ReferenceTargetApp.EditorIntegration.Persistence;

public sealed record LayoutPersistenceOptions(
    string RootDirectory,
    string ApplicationId,
    string ProfileId,
    string ScopeId,
    string FileName)
{
    public const string DefaultApplicationId = "reference-target-app";
    public const string DefaultProfileId = "order-header-default";
    public const string DefaultFileName = "order-header-default.layout.json";
}
