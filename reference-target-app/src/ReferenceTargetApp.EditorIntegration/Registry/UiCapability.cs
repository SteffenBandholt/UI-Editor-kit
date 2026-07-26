namespace ReferenceTargetApp.EditorIntegration.Registry;

[Flags]
public enum UiCapability
{
    None = 0,
    Position = 1 << 0,
    Width = 1 << 1,
    Height = 1 << 2,
    TextPosition = 1 << 3,
    FontSize = 1 << 4,
    Visibility = 1 << 5
}
