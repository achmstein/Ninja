using Ninja.Control.API.Apis;
using Ninja.Control.API.Extensions;
using Ninja.ServiceDefaults;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.AddDefaultOpenApi();
builder.AddDefaultAuthentication();
builder.AddApplicationServices();
// An unhandled failure answers as a problem, like every refusal the API writes by hand
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseExceptionHandler();
app.UseDefaultOpenApi();
app.MapDefaultEndpoints();

app.UseAuthentication();
// After authentication, so the global limiter can meter per admin rather than per address
app.UseRateLimiter();
app.UseAuthorization();

app.MapControlApi();
// Talabat's plugin for every business, at control.{domain}/api/talabat
app.MapTalabatApi();
// Every business's AI calls, at control-api:8080/ai/v1 on the platform's network
app.MapAiGateway();

app.Run();
