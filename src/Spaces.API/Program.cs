using Chillax.Spaces.API.Apis;
using Chillax.Spaces.API.Extensions;

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

app.MapPlacesApi();
app.MapRoomsApi();
app.MapTablesApi();

app.UseDefaultOpenApi();
app.Run();
