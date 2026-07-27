namespace ReferenceTargetApp.EditorIntegration.Registry;

internal static class UiRegistryValidator
{
    private const UiCapability AllTextCapabilities =
        UiCapability.Position |
        UiCapability.Width |
        UiCapability.Height |
        UiCapability.TextPosition |
        UiCapability.FontSize |
        UiCapability.Visibility;

    public static IReadOnlyList<UiRegistryValidationError> Validate(IReadOnlyList<UiRegistryEntry> entries)
    {
        var errors = new List<UiRegistryValidationError>();

        foreach (var entry in entries)
        {
            if (string.IsNullOrWhiteSpace(entry.ElementId))
                Add(errors, UiRegistryValidationErrorCode.EmptyElementId, entry, "Element-ID must not be empty.");
            if (string.IsNullOrWhiteSpace(entry.ScopeId))
                Add(errors, UiRegistryValidationErrorCode.EmptyScopeId, entry, "Scope-ID must not be empty.");
            if (string.IsNullOrWhiteSpace(entry.DisplayName))
                Add(errors, UiRegistryValidationErrorCode.EmptyDisplayName, entry, "Display name must not be empty.");
            if (entry.NativeElement is null)
                Add(errors, UiRegistryValidationErrorCode.MissingNativeReference, entry, "Native WPF reference is required.");

            if (!Enum.IsDefined(entry.Kind))
            {
                Add(errors, UiRegistryValidationErrorCode.InvalidElementKind, entry, "Element kind is not defined.");
            }
            else
            {
                var allowedCapabilities = GetAllowedCapabilities(entry.Kind);
                if ((entry.Capabilities & ~allowedCapabilities) != UiCapability.None)
                    Add(errors, UiRegistryValidationErrorCode.InvalidCapability, entry, $"Capabilities are invalid for element kind {entry.Kind}.");
            }
        }

        foreach (var duplicate in entries
                     .Where(entry => !string.IsNullOrWhiteSpace(entry.ElementId))
                     .GroupBy(entry => entry.ElementId, StringComparer.Ordinal)
                     .Where(group => group.Count() > 1))
        {
            errors.Add(new UiRegistryValidationError(
                UiRegistryValidationErrorCode.DuplicateElementId,
                duplicate.Key,
                $"Element-ID '{duplicate.Key}' occurs more than once."));
        }

        var entriesById = new Dictionary<string, UiRegistryEntry>(StringComparer.Ordinal);
        foreach (var entry in entries.Where(entry => !string.IsNullOrWhiteSpace(entry.ElementId)))
            entriesById.TryAdd(entry.ElementId, entry);

        ValidateHierarchy(entries, entriesById, errors);
        ValidateCycles(entriesById, errors);
        return errors.AsReadOnly();
    }

    private static void ValidateHierarchy(
        IReadOnlyList<UiRegistryEntry> entries,
        IReadOnlyDictionary<string, UiRegistryEntry> entriesById,
        ICollection<UiRegistryValidationError> errors)
    {
        foreach (var entry in entries)
        {
            if (entry.Kind == UiElementKind.Scope)
            {
                if (!string.IsNullOrWhiteSpace(entry.ParentId))
                    Add(errors, UiRegistryValidationErrorCode.ScopeHasParent, entry, "A scope must not have a parent.");
                if (!string.Equals(entry.ScopeId, entry.ElementId, StringComparison.Ordinal))
                    Add(errors, UiRegistryValidationErrorCode.ScopeIdMismatch, entry, "A scope must use its own element ID as scope ID.");
                continue;
            }

            if (!entriesById.TryGetValue(entry.ScopeId, out var scope) || scope.Kind != UiElementKind.Scope)
                Add(errors, UiRegistryValidationErrorCode.UnknownScope, entry, $"Scope '{entry.ScopeId}' is not registered as a scope.");

            if (string.IsNullOrWhiteSpace(entry.ParentId))
            {
                Add(errors, UiRegistryValidationErrorCode.ParentRequired, entry, "A non-scope element requires a parent.");
                continue;
            }

            if (string.Equals(entry.ElementId, entry.ParentId, StringComparison.Ordinal))
            {
                Add(errors, UiRegistryValidationErrorCode.SelfParent, entry, "An element must not be its own parent.");
                continue;
            }

            if (!entriesById.TryGetValue(entry.ParentId, out var parent))
            {
                Add(errors, UiRegistryValidationErrorCode.UnknownParent, entry, $"Parent '{entry.ParentId}' is not registered.");
                continue;
            }

            if (!string.Equals(entry.ScopeId, parent.ScopeId, StringComparison.Ordinal))
                Add(errors, UiRegistryValidationErrorCode.ScopeMismatch, entry, "Parent and child must belong to the same scope.");
        }
    }

    private static void ValidateCycles(
        IReadOnlyDictionary<string, UiRegistryEntry> entriesById,
        ICollection<UiRegistryValidationError> errors)
    {
        var states = new Dictionary<string, int>(StringComparer.Ordinal);
        var reported = new HashSet<string>(StringComparer.Ordinal);

        foreach (var elementId in entriesById.Keys)
            Visit(elementId, entriesById, states, reported, errors);
    }

    private static void Visit(
        string elementId,
        IReadOnlyDictionary<string, UiRegistryEntry> entriesById,
        IDictionary<string, int> states,
        ISet<string> reported,
        ICollection<UiRegistryValidationError> errors)
    {
        states.TryGetValue(elementId, out var state);
        if (state == 2) return;
        if (state == 1)
        {
            if (reported.Add(elementId))
                errors.Add(new UiRegistryValidationError(
                    UiRegistryValidationErrorCode.ParentCycle,
                    elementId,
                    $"Parent hierarchy contains a cycle at '{elementId}'."));
            return;
        }

        states[elementId] = 1;
        var parentId = entriesById[elementId].ParentId;
        if (!string.IsNullOrWhiteSpace(parentId) && entriesById.ContainsKey(parentId))
            Visit(parentId, entriesById, states, reported, errors);
        states[elementId] = 2;
    }

    private static UiCapability GetAllowedCapabilities(UiElementKind kind) => kind switch
    {
        UiElementKind.Scope => UiCapability.Width | UiCapability.Height | UiCapability.Visibility,
        UiElementKind.Group or UiElementKind.Area or UiElementKind.FieldGroup =>
            UiCapability.Position | UiCapability.Width | UiCapability.Height | UiCapability.Visibility,
        UiElementKind.Table => AllTextCapabilities,
        UiElementKind.TableColumn => UiCapability.Width | UiCapability.TextPosition | UiCapability.FontSize | UiCapability.Visibility,
        UiElementKind.StaticText => AllTextCapabilities,
        UiElementKind.InputField => AllTextCapabilities,
        UiElementKind.StatusIndicator => AllTextCapabilities,
        UiElementKind.Button => AllTextCapabilities,
        _ => UiCapability.None
    };

    private static void Add(
        ICollection<UiRegistryValidationError> errors,
        UiRegistryValidationErrorCode code,
        UiRegistryEntry entry,
        string message) => errors.Add(new UiRegistryValidationError(code, entry.ElementId, message));
}
