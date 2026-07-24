using ReferenceTargetApp.Domain.Models;

namespace ReferenceTargetApp.Tests;

[TestClass]
public sealed class DomainArchitectureTests
{
    [TestMethod]
    public void DomainAssemblyHasNoWpfDependency()
    {
        var referencedAssemblies = typeof(Order).Assembly.GetReferencedAssemblies().Select(reference => reference.Name).ToArray();

        CollectionAssert.DoesNotContain(referencedAssemblies, "PresentationFramework");
        CollectionAssert.DoesNotContain(referencedAssemblies, "PresentationCore");
        CollectionAssert.DoesNotContain(referencedAssemblies, "WindowsBase");
    }

    [TestMethod]
    public void DomainAssemblyHasNoUiEditorKitOrIntegrationDependency()
    {
        var referencedAssemblies = typeof(Order).Assembly.GetReferencedAssemblies().Select(reference => reference.Name ?? string.Empty).ToArray();

        Assert.IsFalse(referencedAssemblies.Any(name => name.Contains("UI-Editor", StringComparison.OrdinalIgnoreCase)));
        Assert.IsFalse(referencedAssemblies.Any(name => name.Contains("EditorIntegration", StringComparison.OrdinalIgnoreCase)));
        Assert.IsFalse(referencedAssemblies.Any(name => name.Contains("ReferenceTargetApp.Wpf", StringComparison.OrdinalIgnoreCase)));
    }
}
