using ReferenceTargetApp.EditorIntegration.Geometry;

namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

public interface IGeometryRiskHostAdapter : IAsyncHostAdapter
{
    Task<ChangeResult> SubmitGeometryChangeRequestAsync(
        ChangeRequest request,
        string editMode,
        GeometryRiskConfirmation? confirmation = null,
        CancellationToken cancellationToken = default);

    Task ClearGeometryPreviewAsync(CancellationToken cancellationToken = default);
}
