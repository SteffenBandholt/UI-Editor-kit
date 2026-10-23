using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.Geometry;

namespace ReferenceTargetApp.EditorIntegration.Electron;

// A receipt describes the whole current reference set, never business/instance IDs.
public sealed record TemplateChangeReadback(
    [property: System.Text.Json.Serialization.JsonRequired] int MountedInstanceCount,
    [property: System.Text.Json.Serialization.JsonRequired] int AppliedInstanceCount,
    [property: System.Text.Json.Serialization.JsonRequired] bool ReferenceStable);

internal static class TemplateTargetContract
{
    internal static readonly HashSet<string> Operations = new(
        ["move", "resize", "resizeWidth", "resizeHeight", "spacingIncrease", "spacingDecrease", "spacingSet", "spacingReset"],
        StringComparer.Ordinal);

    internal static bool ValidReference(string kind, bool resolved, int? count) => kind switch
    {
        "single" => resolved,
        "multi" => count is >= 0 && (count == 0 || resolved),
        _ => false
    };

    internal static void ValidateState(ElectronTargetSession.RemoteRegistryScope scope, ElectronTargetSession.RemoteScopeLayoutState state)
    {
        if (state.ScopeId != scope.ScopeId || state.Elements.Count != scope.Elements.Count ||
            state.Elements.Select(element => element.ElementId).Distinct(StringComparer.Ordinal).Count() != state.Elements.Count ||
            scope.Elements.Any(entry => !state.Elements.Any(element => element.ElementId == entry.Id)) ||
            state.Elements.Any(element => !Finite(element)))
            throw new ElectronEditorException(ElectronEditorErrorCodes.RegistryInvalid,
                "LayoutState muss genau einen endlichen logischen Zustand pro registriertem Ziel enthalten, auch bei leerer Liste.");
    }

    internal static bool ValidResult(ChangeRequest request, ElectronTargetSession.RemoteChangeResult result, ElectronTargetSession.RemoteRegistrationEntry entry, ElementLayoutState current)
    {
        if (result.ChangeId != request.ChangeId || result.ElementId != request.ElementId || result.Operation != request.Operation)
            return false;
        if (!result.Success) return true;
        var receipt = result.TemplateReadback;
        if (receipt is null || !receipt.ReferenceStable || receipt.MountedInstanceCount < 0 ||
            receipt.AppliedInstanceCount != receipt.MountedInstanceCount ||
            result.PreviousState is not { } previous || result.NewState is not { } next ||
            previous.ElementId != request.ElementId || next.ElementId != request.ElementId || !Finite(previous) || !Finite(next) ||
            !SameSpacing(previous.Spacing, current.Spacing) || !Same(previous.X, current.X) || !Same(previous.Y, current.Y) || !Same(previous.Width, current.Width) || !Same(previous.Height, current.Height) ||
            result.AffectedStates?.Any(state => state.ElementId != request.ElementId &&
                entry.OperationAffectedIds?.GetValueOrDefault(request.Operation)?.Contains(state.ElementId, StringComparer.Ordinal) != true || !Finite(state)) == true)
            return false;
        // The host returns logical template values, not a first-instance box or
        // a bounding union whose size changes when rows are filtered/reordered.
        bool Matches(string key, double value) => request.Payload?.TryGetValue(key, out var wanted) == true &&
            wanted is not null && double.TryParse(Convert.ToString(wanted, System.Globalization.CultureInfo.InvariantCulture),
                System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var number) &&
            double.IsFinite(number) && Math.Abs(number - value) <= 0.05;
        if (next.TextOffsetX != previous.TextOffsetX || next.TextOffsetY != previous.TextOffsetY || next.FontSize != previous.FontSize || next.Visible != previous.Visible || !Equals(next.Table, previous.Table))
            return false;
        var moves = request.Operation == "move";
        var changesWidth = request.Operation is "resize" or "resizeWidth";
        var changesHeight = request.Operation is "resize" or "resizeHeight";
        if (!moves && (!Same(next.X, previous.X) || !Same(next.Y, previous.Y)) ||
            !changesWidth && !Same(next.Width, previous.Width) || !changesHeight && !Same(next.Height, previous.Height)) return false;
        var spacingKeys = (previous.Spacing?.Keys ?? []).Union(next.Spacing?.Keys ?? []).ToArray();
        if (!SpacingOperations.All.Contains(request.Operation))
            return spacingKeys.All(key => Same(previous.Spacing?.GetValueOrDefault(key) ?? 0, next.Spacing?.GetValueOrDefault(key) ?? 0)) && GeometryMatches();
        var payload = System.Text.Json.JsonSerializer.SerializeToElement(request.Payload);
        var spacing = payload.GetProperty("spacing");
        var target = spacing.GetProperty("target").GetString()!;
        var old = previous.Spacing?.GetValueOrDefault(target) ?? 0;
        var amount = request.Operation == "spacingReset" ? 0 : spacing.GetProperty("value").GetDouble();
        var wanted = request.Operation switch
        {
            "spacingIncrease" => old + amount, "spacingDecrease" => Math.Max(0, old - amount),
            "spacingReset" => entry.Baseline?.Spacing?.GetValueOrDefault(target) ?? 0, _ => amount
        };
        return Same(next.Spacing?.GetValueOrDefault(target) ?? 0, wanted) &&
            spacingKeys.Where(key => key != target).All(key => Same(previous.Spacing?.GetValueOrDefault(key) ?? 0, next.Spacing?.GetValueOrDefault(key) ?? 0));

        bool GeometryMatches() => request.Operation switch
        {
            "move" => Matches("x", next.X) && Matches("y", next.Y),
            "resize" => Matches("width", next.Width) && Matches("height", next.Height),
            "resizeWidth" => Matches("width", next.Width),
            "resizeHeight" => Matches("height", next.Height),
            _ => SpacingOperations.All.Contains(request.Operation) && next.Spacing is not null
        };
    }

    private static bool SameSpacing(IReadOnlyDictionary<string, double>? left, IReadOnlyDictionary<string, double>? right) =>
        (left?.Keys ?? []).Union(right?.Keys ?? []).All(key => Same(left?.GetValueOrDefault(key) ?? 0, right?.GetValueOrDefault(key) ?? 0));

    private static bool Same(double left, double right) => Math.Abs(left - right) <= 0.05;

    private static bool Finite(ElectronTargetSession.RemoteElementLayoutState state) =>
        double.IsFinite(state.X) && double.IsFinite(state.Y) && double.IsFinite(state.Width) && state.Width >= 0 &&
        double.IsFinite(state.Height) && state.Height >= 0 &&
        (state.TextOffsetX is null || double.IsFinite(state.TextOffsetX.Value)) &&
        (state.TextOffsetY is null || double.IsFinite(state.TextOffsetY.Value)) &&
        (state.FontSize is null || double.IsFinite(state.FontSize.Value)) &&
        (state.Spacing is null || state.Spacing.All(pair => SpacingTargets.All.Contains(pair.Key) && double.IsFinite(pair.Value) && pair.Value >= 0));
}
