using Chillax.Payroll.API.Apis;
using Chillax.Payroll.API.Extensions;

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

app.MapPayrollApi();

app.UseDefaultOpenApi();
app.Run();
