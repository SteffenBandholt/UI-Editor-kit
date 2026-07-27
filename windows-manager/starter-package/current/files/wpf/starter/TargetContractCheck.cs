namespace AppStarter.UiEditor;

public static class TargetContractCheck
{
    public static void VerifyDevelopmentSkeleton()
    {
        if (Registry.Version != 0 || Registry.Scopes.Count != 0) throw new InvalidOperationException("Das Startergeruest darf keine fertige Registry vortaeuschen.");
    }
}
