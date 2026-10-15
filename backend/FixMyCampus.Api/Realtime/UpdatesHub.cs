using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace FixMyCampus.Api.Realtime;

[Authorize]
public sealed class UpdatesHub : Hub
{
}
