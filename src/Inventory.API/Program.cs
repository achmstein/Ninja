using Chillax.Inventory.API.Apis;
using Chillax.Inventory.API.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.AddApplicationServices();
builder.Services.AddProblemDetails();

var withApiVersioning = builder.Services.AddApiVersioning();

builder.AddDefaultOpenApi(withApiVersioning);

var app = builder.Build();

app.MapDefaultEndpoints();

app.UseStatusCodePages();

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapInventoryApi();

app.UseDefaultOpenApi();
app.Run();
