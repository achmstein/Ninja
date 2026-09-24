var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.AddApplicationServices();
builder.Services.AddProblemDetails();

var withApiVersioning = builder.Services.AddApiVersioning();

builder.AddDefaultOpenApi(withApiVersioning);

var app = builder.Build();

app.MapDefaultEndpoints();

app.UseAuthentication();
app.UseAuthorization();

// After authentication: the guest-order limiter exempts signed-in callers,
// so it has to run once we know who they are
app.UseRateLimiter();

var orders = app.NewVersionedApi("Orders");

orders.MapOrdersApiV1()
      .MapKitchenOrderRoutes()
      .RequireAuthorization();

var kitchen = app.NewVersionedApi("Kitchen");

kitchen.MapKitchenApiV1()
       .RequireAuthorization();

// The print connector signs with its own key; its endpoints say which need staff
var connector = app.NewVersionedApi("PrintConnector");

connector.MapPrintConnectorApiV1();

app.UseDefaultOpenApi();
app.Run();
