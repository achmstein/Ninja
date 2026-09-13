using Chillax.Finance.API.Apis;
using Chillax.Finance.API.Extensions;

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

app.MapFinanceApi();

app.UseDefaultOpenApi();
app.Run();
