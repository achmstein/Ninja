using Chillax.E2E.Harness;

namespace Chillax.E2E.Guards;

/// <summary>The harness itself: tokens, BFF routing, bus and hub plumbing — before any workflow runs.</summary>
public sealed class SmokeTests(ChillaxApp app) : ScenarioTest(app)
{
    [Fact]
    public async Task Personas_get_tokens_with_the_claims_the_services_key_on()
    {
        var cashier = await App.Tokens.GetAsync(Persona.Cashier, Ct);
        Assert.Contains("Cashier", cashier.Roles);
        Assert.Contains(1, cashier.Branches);
        Assert.NotEmpty(cashier.Subject);

        var admin = await App.Tokens.GetAsync(Persona.Admin, Ct);
        Assert.Contains("Admin", admin.Roles);
        Assert.Contains("Owner", admin.Roles);

        var tester = await App.Tokens.GetAsync(Persona.Tester, Ct);
        Assert.Contains("Customer", tester.Roles);
    }

    [Fact]
    public async Task Bff_routes_to_the_seeded_services()
    {
        var branches = await App.Cashier.GetJsonAsync("/api/branches", Ct);
        Assert.Contains(branches.EnumerateArray(), b => b.GetProperty("id").GetInt32() == 1);

        var items = await App.Cashier.GetJsonAsync("/api/catalog/items", Ct);
        Assert.True(items.GetArrayLength() > 10, "seeded menu");

        var rooms = await App.Cashier.GetJsonAsync("/api/rooms", Ct);
        Assert.True(rooms.GetArrayLength() >= 6, "seeded rooms");

        using var noShift = await App.Cashier.SendAsync(HttpMethod.Get, "/api/shifts/current", null, Ct, ensureSuccess: false);
        Assert.Equal(HttpStatusCode.NotFound, noShift.StatusCode);
    }

    [Fact]
    public void Recorders_are_connected()
    {
        Assert.Equal(Microsoft.AspNetCore.SignalR.Client.HubConnectionState.Connected, App.Hub.State);
        Assert.NotEmpty(App.ConnectionStrings);
        Assert.Empty(App.Logs.Failures(Marker.Start));
    }
}
