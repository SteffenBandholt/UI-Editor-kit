using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using ReferenceTargetApp.EditorIntegration.Protocol;

namespace ReferenceTargetApp.EditorIntegration.EditorUi;

public sealed record EditorUiState(
    string ScopeId,
    EditorUiTree Tree,
    EditorUiDetails? Details,
    EditorUiPanel Panel);

public sealed record EditorUiTree(EditorUiTreeNode? Root, IReadOnlyList<EditorUiTreeNode> Nodes);

public sealed record EditorUiTreeNode(
    string Id,
    string? Label,
    string Type,
    string Role,
    string? ParentId,
    int Order,
    bool Visible,
    bool Editable,
    int Depth,
    IReadOnlyList<string> Path,
    IReadOnlyList<EditorUiTreeNode> Children);

public sealed record EditorUiDetails(
    string ElementId,
    string? Label,
    string Type,
    string Role,
    string? ParentId,
    int Order,
    bool Visible,
    bool Editable,
    EditorUiOperations? Operations,
    EditorUiLayoutEntry CurrentLayout,
    string? SelectionKind = null,
    IReadOnlyList<string>? SelectionLevels = null,
    IReadOnlyDictionary<string, string>? OperationEffects = null,
    IReadOnlyDictionary<string, IReadOnlyList<string>>? OperationAffectedIds = null,
    IReadOnlyList<string>? SpacingTargets = null);

public sealed record EditorUiOperations(
    IReadOnlyList<string> AllowedOps,
    IReadOnlyList<string> LockedOps,
    IReadOnlyList<string> AvailableOps);

public sealed record EditorUiLayoutEntry(
    string ElementId,
    EditorUiElementLayout? Element,
    EditorUiTextLayout? Text,
    IReadOnlyDictionary<string, double>? Spacing = null);

public sealed record EditorUiElementLayout(double X, double Y, double Width, double Height);
public sealed record EditorUiTextLayout(double? OffsetX, double? OffsetY, double? FontSize);

public sealed record EditorUiPanel(
    EditorUiSelection Selection,
    string Layer,
    IReadOnlyList<EditorUiChoice> Layers,
    IReadOnlyList<EditorUiChoice> Modes,
    EditorUiDirectionPad Dpad,
    double StepSize,
    EditorUiStatus Status,
    bool Busy);

public sealed record EditorUiSelection(
    bool Selected,
    string? ElementId,
    string Name,
    bool Editable,
    IReadOnlyList<string> AllowedOps,
    IReadOnlyList<string> EffectiveOps,
    IReadOnlyList<string> AvailableModes);

public sealed record EditorUiChoice(string Id, string Label, bool Enabled, bool Active);
public sealed record EditorUiDirectionPad(EditorUiButton Up, EditorUiButton Down, EditorUiButton Left, EditorUiButton Right);
public sealed record EditorUiButton(bool Enabled, bool Visible, string Label, string Intent, string? ReasonCode, string? Direction, string? AriaLabel);
public sealed record EditorUiStatus(string Kind, string Code, string MessageKey, string Message, bool? RollbackComplete = null);

public sealed record EditorUiChangeOutcome(EditorUiState State, HostAdapter.ChangeResult Result);

internal static class EditorUiStateTranslator
{
    public static EditorUiState Translate(JsonElement payload)
    {
        if (!payload.TryGetProperty("editorUiState", out var state) || state.ValueKind != JsonValueKind.Object)
            throw new InvalidDataException("editorUiState fehlt in der Prozessantwort.");
        try
        {
            return state.Deserialize<EditorUiState>(EditorProtocolJson.Options)
                ?? throw new InvalidDataException("editorUiState konnte nicht gelesen werden.");
        }
        catch (JsonException exception)
        {
            throw new InvalidDataException("editorUiState ist ungueltig.", exception);
        }
    }
}
