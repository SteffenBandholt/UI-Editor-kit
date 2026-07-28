using System.Text.Json;

namespace ReferenceTargetApp.EditorIntegration.Geometry;

public static class GeometryEditModes
{
    public const string Guided = "guided";
    public const string Free = "free";
    public static string Normalize(string? value) => value == Free ? Free : Guided;
}

public static class GeometryRiskTypes
{
    public const string LeavesGroup = "leavesGroup";
    public const string LeavesParent = "leavesParent";
    public const string EntersNeighborArea = "entersNeighborArea";
    public const string OverlapsNeighbor = "overlapsNeighbor";
    public const string LeavesEditableArea = "leavesEditableArea";
    public const string GroupOverlap = "groupOverlap";
    public const string UnusualSpacing = "unusualSpacing";
}

public static class GeometryRiskActions
{
    public const string ClampToGroup = "clampToGroup";
    public const string ClampToArea = "clampToArea";
    public const string ApplyAnyway = "applyAnyway";
    public const string GoBack = "goBack";
    public const string Cancel = "cancel";
}

public sealed record GeometryBounds(double Left, double Top, double Width, double Height)
{
    public double Right => Left + Width;
    public double Bottom => Top + Height;
    public bool IsValid => double.IsFinite(Left) && double.IsFinite(Top) && double.IsFinite(Width) && double.IsFinite(Height) && Width > 0 && Height > 0;
}

public sealed record GeometryTarget(string ElementId, string DisplayName, string ElementType, GeometryBounds Bounds);
public sealed record GeometryNeighbor(string ElementId, string DisplayName, string ElementType, GeometryBounds Bounds, GeometryBounds? OverlapBounds = null, bool GeometryChanged = false);
public sealed record GeometryRisk(string RiskType, GeometryTarget? Subject = null);
public sealed record GeometryPreview(GeometryBounds CurrentBounds, GeometryBounds TargetBounds, GeometryBounds? GroupBounds, GeometryBounds? AreaBounds);
public sealed record GeometryTechnicalDetails(
    string? ElementId = null,
    string? GroupId = null,
    string? ParentId = null,
    string? EditableAreaId = null,
    string? ScopeId = null,
    int? RegistryVersion = null,
    string? RegistryFingerprint = null,
    string? EffectScope = null,
    IReadOnlyList<string>? AffectedElementIds = null,
    GeometryBounds? CurrentBounds = null,
    GeometryBounds? TargetBounds = null,
    string? ErrorCode = null,
    JsonElement? HostAdapterReadback = null,
    string? RollbackStatus = null);

public sealed record GeometryRiskAssessment(
    bool HasRisks,
    string EditMode,
    string? RiskType,
    IReadOnlyList<GeometryRisk> Risks,
    string Title,
    string Message,
    GeometryTarget Target,
    GeometryTarget? Group,
    GeometryTarget? Parent,
    GeometryTarget? EditableArea,
    IReadOnlyList<GeometryNeighbor> AffectedNeighbors,
    IReadOnlyList<string> SuggestedActions,
    GeometryTechnicalDetails TechnicalDetails,
    string OperationId,
    string? RollbackToken,
    GeometryPreview Preview,
    GeometryBounds? ClampedToGroupBounds,
    GeometryBounds? ClampedToAreaBounds);

public sealed record GeometryRiskConfirmation(string OperationId, string Action);

public enum GeometryRiskDecision
{
    ClampToGroup,
    ClampToArea,
    ApplyAnyway,
    GoBack,
    Cancel
}

public static class GeometryRiskDecisionExtensions
{
    public static string ToContractAction(this GeometryRiskDecision decision) => decision switch
    {
        GeometryRiskDecision.ClampToGroup => GeometryRiskActions.ClampToGroup,
        GeometryRiskDecision.ClampToArea => GeometryRiskActions.ClampToArea,
        GeometryRiskDecision.ApplyAnyway => GeometryRiskActions.ApplyAnyway,
        GeometryRiskDecision.GoBack => GeometryRiskActions.GoBack,
        _ => GeometryRiskActions.Cancel,
    };
}

public static class GeometryRiskMessages
{
    public static (string Title, string Message) ForPdf(string riskType, string displayName, string areaName) =>
        riskType == GeometryRiskTypes.OverlapsNeighbor
            ? ("PDF-Element überlappt ein anderes Element", $"Das Element „{displayName}“ überlappt ein anderes PDF-Element.")
            : ("PDF-Element verlässt den Seitenbereich", $"Das Element „{displayName}“ überschreitet den Bereich „{areaName}“.");
}

public static class GeometryRiskEvaluator
{
    public static GeometryRiskAssessment Evaluate(
        string editMode,
        string operationId,
        string scopeId,
        GeometryTarget target,
        GeometryBounds targetBounds,
        GeometryTarget? group,
        GeometryTarget? parent,
        GeometryTarget? editableArea,
        IReadOnlyList<GeometryNeighbor> neighbors,
        string? rollbackToken = null)
    {
        if (string.IsNullOrWhiteSpace(operationId)) throw new ArgumentException("operationId fehlt.", nameof(operationId));
        if (!target.Bounds.IsValid || !targetBounds.IsValid) throw new ArgumentException("Zielgeometrie ist ungültig.", nameof(targetBounds));
        var risks = new List<GeometryRisk>();
        if (group is not null && !Contains(group.Bounds, targetBounds)) Add(risks, GeometryRiskTypes.LeavesGroup, group);
        if (parent is not null && !Contains(parent.Bounds, targetBounds)) Add(risks, GeometryRiskTypes.LeavesParent, parent);
        if (editableArea is not null && !Contains(editableArea.Bounds, targetBounds)) Add(risks, GeometryRiskTypes.LeavesEditableArea, editableArea);
        var normalizedNeighbors = neighbors.Select(item => item with { OverlapBounds = Intersection(targetBounds, item.Bounds) }).ToArray();
        foreach (var neighbor in normalizedNeighbors)
        {
            var next = Area(neighbor.OverlapBounds);
            var previous = Area(Intersection(target.Bounds, neighbor.Bounds));
            if (next > previous + 0.5)
            {
                var type = neighbor.ElementType is "area" or "group" or "fieldGroup" or "layoutZone"
                    ? GeometryRiskTypes.EntersNeighborArea
                    : GeometryRiskTypes.OverlapsNeighbor;
                Add(risks, type, new(neighbor.ElementId, neighbor.DisplayName, neighbor.ElementType, neighbor.Bounds));
                if (target.ElementType is "group" or "fieldGroup" && neighbor.ElementType is "group" or "fieldGroup")
                    Add(risks, GeometryRiskTypes.GroupOverlap, new(neighbor.ElementId, neighbor.DisplayName, neighbor.ElementType, neighbor.Bounds));
            }
            else if (neighbor.GeometryChanged)
                Add(risks, GeometryRiskTypes.EntersNeighborArea, new(neighbor.ElementId, neighbor.DisplayName, neighbor.ElementType, neighbor.Bounds));
        }
        if (Math.Sqrt(Math.Pow(targetBounds.Left - target.Bounds.Left, 2) + Math.Pow(targetBounds.Top - target.Bounds.Top, 2)) > Math.Max(target.Bounds.Width, target.Bounds.Height) * 4)
            Add(risks, GeometryRiskTypes.UnusualSpacing, null);
        var normalizedMode = GeometryEditModes.Normalize(editMode);
        var actions = new List<string>();
        if (normalizedMode == GeometryEditModes.Guided && risks.Any(item => item.RiskType == GeometryRiskTypes.LeavesGroup)) actions.Add(GeometryRiskActions.ClampToGroup);
        if (normalizedMode == GeometryEditModes.Guided && risks.Any(item => item.RiskType is GeometryRiskTypes.LeavesParent or GeometryRiskTypes.LeavesEditableArea)) actions.Add(GeometryRiskActions.ClampToArea);
        actions.Add(GeometryRiskActions.ApplyAnyway);
        if (risks.Any(item => item.RiskType is GeometryRiskTypes.EntersNeighborArea or GeometryRiskTypes.OverlapsNeighbor or GeometryRiskTypes.GroupOverlap)) actions.Add(GeometryRiskActions.GoBack);
        actions.Add(GeometryRiskActions.Cancel);
        var (title, message) = Describe(risks.FirstOrDefault(), target, group, parent, editableArea);
        return new(risks.Count > 0, normalizedMode, risks.FirstOrDefault()?.RiskType, risks, title, message,
            target with { Bounds = targetBounds }, group, parent, editableArea, normalizedNeighbors,
            actions.Distinct(StringComparer.Ordinal).ToArray(),
            new(target.ElementId, group?.ElementId, parent?.ElementId, editableArea?.ElementId, scopeId,
                AffectedElementIds: normalizedNeighbors.Select(item => item.ElementId).ToArray(), CurrentBounds: target.Bounds,
                TargetBounds: targetBounds, RollbackStatus: "guaranteed"),
            operationId, rollbackToken,
            new(target.Bounds, targetBounds, group?.Bounds, editableArea?.Bounds ?? parent?.Bounds),
            group is null ? null : Clamp(targetBounds, group.Bounds),
            editableArea is null && parent is null ? null : Clamp(targetBounds, (editableArea ?? parent)!.Bounds));
    }

    public static GeometryBounds Clamp(GeometryBounds candidate, GeometryBounds container) => new(
        candidate.Width >= container.Width ? container.Left : Math.Min(Math.Max(candidate.Left, container.Left), container.Right - candidate.Width),
        candidate.Height >= container.Height ? container.Top : Math.Min(Math.Max(candidate.Top, container.Top), container.Bottom - candidate.Height),
        candidate.Width, candidate.Height);

    private static bool Contains(GeometryBounds container, GeometryBounds candidate) =>
        candidate.Left >= container.Left - 0.01 && candidate.Top >= container.Top - 0.01 &&
        candidate.Right <= container.Right + 0.01 && candidate.Bottom <= container.Bottom + 0.01;
    private static GeometryBounds? Intersection(GeometryBounds left, GeometryBounds right)
    {
        var x = Math.Max(left.Left, right.Left); var y = Math.Max(left.Top, right.Top);
        var width = Math.Max(0, Math.Min(left.Right, right.Right) - x); var height = Math.Max(0, Math.Min(left.Bottom, right.Bottom) - y);
        return width > 0 && height > 0 ? new(x, y, width, height) : null;
    }
    private static double Area(GeometryBounds? value) => value is null ? 0 : value.Width * value.Height;
    private static void Add(List<GeometryRisk> risks, string type, GeometryTarget? subject)
    {
        if (!risks.Any(item => item.RiskType == type && item.Subject?.ElementId == subject?.ElementId)) risks.Add(new(type, subject));
    }
    private static (string Title, string Message) Describe(GeometryRisk? risk, GeometryTarget target, GeometryTarget? group, GeometryTarget? parent, GeometryTarget? area) => risk?.RiskType switch
    {
        GeometryRiskTypes.LeavesGroup => ("Element verlässt seine Gruppe", $"Das Element „{target.DisplayName}“ wird außerhalb der Gruppe „{group?.DisplayName ?? "zugehörige Gruppe"}“ verschoben."),
        GeometryRiskTypes.LeavesParent => ("Element verlässt seinen Bereich", $"Ein Teil des Elements „{target.DisplayName}“ liegt künftig außerhalb von „{parent?.DisplayName ?? "seinem Bereich"}“."),
        GeometryRiskTypes.EntersNeighborArea => ("Element wird in einen Nachbarbereich verschoben", $"Das Element „{target.DisplayName}“ wird in den Bereich „{risk.Subject?.DisplayName ?? "eines Nachbarelements"}“ verschoben."),
        GeometryRiskTypes.OverlapsNeighbor => ("Element überlappt ein Nachbarelement", $"Das Element „{target.DisplayName}“ überlappt „{risk.Subject?.DisplayName ?? "ein Nachbarelement"}“."),
        GeometryRiskTypes.LeavesEditableArea => ("Element verlässt den bearbeitbaren Bereich", $"Ein Teil des Elements liegt künftig außerhalb des Bereichs „{area?.DisplayName ?? "bearbeitbarer Bereich"}“."),
        GeometryRiskTypes.GroupOverlap => ("Gruppe überlappt eine andere Gruppe", $"Die Gruppe „{target.DisplayName}“ überlappt „{risk.Subject?.DisplayName ?? "eine Nachbargruppe"}“."),
        GeometryRiskTypes.UnusualSpacing => ("Ungewöhnlich großer Abstand", $"Das Element „{target.DisplayName}“ wird ungewöhnlich weit von seinem bisherigen Bereich verschoben."),
        _ => (string.Empty, string.Empty),
    };
}
