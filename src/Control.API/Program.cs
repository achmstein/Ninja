using Ninja.Control.API.Apis;
using Ninja.Control.API.Extensions;
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

app.MapControlApi();

app.Run();
