using Chillax.Notification.API.Apis;
using Chillax.Notification.API.Extensions;
using Chillax.Notification.API.Hubs;
using Chillax.ServiceDefaults;

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
