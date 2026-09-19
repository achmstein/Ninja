using Ninja.Notification.API.Apis;
using Ninja.Notification.API.Extensions;
using Ninja.Notification.API.Hubs;
using Ninja.ServiceDefaults;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.AddDefaultOpenApi();
builder.AddDefaultAuthentication();
builder.AddApplicationServices();

var app = builder.Build();

app.UseDefaultOpenApi();
app.MapDefaultEndpoints();

app.UseAuthentication();
app.UseAuthorization();

// After authentication: the guest limiter exempts signed-in callers, so it
// has to run once we know who they are
app.UseRateLimiter();

app.MapNotificationApi();
app.MapHub<NotificationHub>("/hub/notifications");

app.Run();
