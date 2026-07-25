using System.Collections.ObjectModel;
using ReferenceTargetApp.EditorIntegration.EditorUi;

namespace ReferenceTargetApp.UI.ViewModels;

internal sealed class EditorTreeNodeViewModel
{
    public EditorTreeNodeViewModel(EditorUiTreeNode node, string? selectedElementId = null)
    {
        Id = node.Id;
        Label = node.Label ?? node.Id;
        Type = node.Type;
        IsSelected = string.Equals(node.Id, selectedElementId, StringComparison.Ordinal);
        Children = new ObservableCollection<EditorTreeNodeViewModel>(node.Children.Select(child => new EditorTreeNodeViewModel(child, selectedElementId)));
    }

    public string Id { get; }
    public string Label { get; }
    public string Type { get; }
    public string DisplayLabel => $"{Label}  ·  {Type}";
    public bool IsSelected { get; }
    public ObservableCollection<EditorTreeNodeViewModel> Children { get; }
    public override string ToString() => DisplayLabel;
}

internal sealed record EditorChoiceViewModel(string Id, string Label, bool Enabled, bool Active);
