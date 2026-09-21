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
app.UseAuthorization();

app.MapControlApi();

app.Run();
