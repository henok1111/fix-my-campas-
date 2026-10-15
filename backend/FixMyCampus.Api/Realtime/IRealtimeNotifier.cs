namespace FixMyCampus.Api.Realtime;

public interface IRealtimeNotifier
{
    Task TicketsChangedAsync(CancellationToken cancellationToken);
    Task UsersChangedAsync(CancellationToken cancellationToken);
}
