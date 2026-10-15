using Microsoft.AspNetCore.SignalR;

namespace FixMyCampus.Api.Realtime;

public static class RealtimeEvents
{
    public const string TicketsChanged = "TicketsChanged";
    public const string UsersChanged = "UsersChanged";
}

public sealed class SignalRRealtimeNotifier(
    IHubContext<UpdatesHub> hubContext,
    ILogger<SignalRRealtimeNotifier> logger) : IRealtimeNotifier
{
    public Task TicketsChangedAsync(CancellationToken cancellationToken) =>
        NotifyAsync(RealtimeEvents.TicketsChanged, cancellationToken);

    public Task UsersChangedAsync(CancellationToken cancellationToken) =>
        NotifyAsync(RealtimeEvents.UsersChanged, cancellationToken);

    private async Task NotifyAsync(
        string eventName,
        CancellationToken cancellationToken)
    {
        try
        {
            await hubContext.Clients.All.SendAsync(eventName, cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogWarning(
                exception,
                "Unable to broadcast the {EventName} SignalR event.",
                eventName);
        }
    }
}
