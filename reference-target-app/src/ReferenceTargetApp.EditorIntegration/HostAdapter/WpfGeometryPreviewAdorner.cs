using System.Windows;
using System.Windows.Documents;
using System.Windows.Media;
using ReferenceTargetApp.EditorIntegration.Geometry;

namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

internal sealed class WpfGeometryPreviewAdorner(UIElement adornedElement, GeometryRiskAssessment assessment) : Adorner(adornedElement)
{
    protected override void OnRender(DrawingContext drawingContext)
    {
        base.OnRender(drawingContext);
        Draw(drawingContext, assessment.Preview.CurrentBounds, new Pen(Brushes.Black, 3), null);
        Draw(drawingContext, assessment.Preview.TargetBounds, new Pen(Brushes.OrangeRed, 3) { DashStyle = DashStyles.Dash }, new SolidColorBrush(Color.FromArgb(24, 249, 115, 22)));
        if (assessment.Preview.GroupBounds is { } group)
        {
            Draw(drawingContext, group, new Pen(Brushes.BlueViolet, 4), null);
            Draw(drawingContext, new(group.Left + 4, group.Top + 4, Math.Max(1, group.Width - 8), Math.Max(1, group.Height - 8)), new Pen(Brushes.BlueViolet, 1), null);
        }
        if (assessment.Preview.AreaBounds is { } area)
            Draw(drawingContext, area, new Pen(Brushes.Teal, 3) { DashStyle = DashStyles.Dot }, null);
        foreach (var neighbor in assessment.AffectedNeighbors.Where(item => item.OverlapBounds is not null))
            Draw(drawingContext, neighbor.OverlapBounds!, new Pen(Brushes.Firebrick, 4), HatchBrush());
    }

    private static void Draw(DrawingContext context, GeometryBounds bounds, Pen pen, Brush? fill) =>
        context.DrawRectangle(fill, pen, new Rect(bounds.Left, bounds.Top, bounds.Width, bounds.Height));

    private static DrawingBrush HatchBrush()
    {
        var group = new DrawingGroup();
        group.Children.Add(new GeometryDrawing(new SolidColorBrush(Color.FromArgb(35, 185, 28, 28)), null, new RectangleGeometry(new Rect(0, 0, 10, 10))));
        group.Children.Add(new GeometryDrawing(null, new Pen(new SolidColorBrush(Color.FromArgb(130, 185, 28, 28)), 2), new LineGeometry(new Point(0, 10), new Point(10, 0))));
        return new DrawingBrush(group) { TileMode = TileMode.Tile, Viewport = new Rect(0, 0, 10, 10), ViewportUnits = BrushMappingMode.Absolute };
    }
}
