using System.Collections.ObjectModel;

namespace ReferenceTargetApp.EditorIntegration.Registry;

public sealed class UiRegistryValidationException : ArgumentException
{
    public UiRegistryValidationException(IEnumerable<UiRegistryValidationError> errors)
        : base(CreateMessage(errors, out var materializedErrors))
    {
        Errors = new ReadOnlyCollection<UiRegistryValidationError>(materializedErrors);
    }

    public IReadOnlyList<UiRegistryValidationError> Errors { get; }

    private static string CreateMessage(
        IEnumerable<UiRegistryValidationError> errors,
        out List<UiRegistryValidationError> materializedErrors)
    {
        materializedErrors = errors?.ToList() ?? throw new ArgumentNullException(nameof(errors));
        return $"The UI registry is invalid: {string.Join("; ", materializedErrors.Select(error => error.Message))}";
    }
}
