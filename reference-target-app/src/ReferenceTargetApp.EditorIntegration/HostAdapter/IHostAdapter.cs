using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

public interface IHostAdapter
{
    IUiElementRegistry GetRegistry();
    LayoutState GetCurrentLayoutState();
    ChangeResult SubmitChangeRequest(ChangeRequest changeRequest);
}
