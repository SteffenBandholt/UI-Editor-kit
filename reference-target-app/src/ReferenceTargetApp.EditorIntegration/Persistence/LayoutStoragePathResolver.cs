using System.IO;
using ReferenceTargetApp.EditorIntegration.OrderHeader;

namespace ReferenceTargetApp.EditorIntegration.Persistence;

public static class LayoutStoragePathResolver
{
    public static LayoutPersistenceOptions ResolveDefault() => ForRoot(Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "UI-Editor-kit",
        "ReferenceTargetApp",
        "layouts"));

    public static LayoutPersistenceOptions ForRoot(string rootDirectory)
    {
        if (string.IsNullOrWhiteSpace(rootDirectory))
            throw new ArgumentException("Layout-Speicherordner darf nicht leer sein.", nameof(rootDirectory));

        return new LayoutPersistenceOptions(
            Path.GetFullPath(rootDirectory),
            LayoutPersistenceOptions.DefaultApplicationId,
            LayoutPersistenceOptions.DefaultProfileId,
            OrderHeaderRegistryIds.Scope,
            LayoutPersistenceOptions.DefaultFileName);
    }

    public static string GetLayoutFilePath(LayoutPersistenceOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        if (string.IsNullOrWhiteSpace(options.FileName) ||
            !string.Equals(Path.GetFileName(options.FileName), options.FileName, StringComparison.Ordinal))
            throw new ArgumentException("Layout-Dateiname muss ein einfacher Dateiname sein.", nameof(options));
        return Path.Combine(Path.GetFullPath(options.RootDirectory), options.FileName);
    }
}
