using Ninja.Tenant.API.Apis;
using Ninja.Tenant.API.Extensions;
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

app.MapBranchApi();
app.MapTenantApi();

app.Run();
