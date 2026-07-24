using System.Runtime.ExceptionServices;
using System.Threading;

namespace ReferenceTargetApp.Tests;

internal static class StaTest
{
    public static void Run(Action action)
    {
        ArgumentNullException.ThrowIfNull(action);
        Exception? capturedException = null;
        var thread = new Thread(() =>
        {
            try
            {
                action();
            }
            catch (Exception exception)
            {
                capturedException = exception;
            }
        });

        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();

        if (capturedException is not null)
            ExceptionDispatchInfo.Capture(capturedException).Throw();
    }
}
