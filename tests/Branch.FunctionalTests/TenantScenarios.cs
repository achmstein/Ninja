using System.Net;
using Ninja.Testing;

namespace Ninja.Branch.FunctionalTests;

/// <summary>The service, once for the suite.</summary>
[TestClass]
public static class Suite
{
    public static ServiceUnderTest<Program> Branch { get; private set; } = null!;

    [AssemblyInitialize]
    public static async Task StartAsync(TestContext context)
    {
        await SharedServices.StartAsync();
        Branch = new ServiceUnderTest<Program>("branchdb");
        _ = Branch.CreateClient();
    }

    [AssemblyCleanup]
    public static async Task StopAsync()
    {
        await Branch.DisposeAsync();
        await SharedServices.StopAsync();
    }
}

/// <summary>What the apps read off the wire; named here so a change in the API's shape fails a test.</summary>
public record TenantView(LocalizedView Name, string? PrimaryColor, string? CustomerUrl, FeaturesView Features, FeaturesView Entitlements, long Version);
public record LocalizedView(string En, string? Ar);
public record FeaturesView(bool Reservations, bool TimeBilling, bool Loyalty, bool Tabs, bool Inventory, bool Finance, bool Payroll, bool Kds)
{
    public static FeaturesView All => new(true, true, true, true, true, true, true, true);
}

/// <summary>
/// The brand every surface reads at boot, and the two things that decide
/// what a café may run: the plan, pushed by the control plane, and the
/// owner's own switches within it.
/// </summary>
[TestClass]
public sealed class TenantScenarios
{
    private const string Tenant = "/api/tenant";

    private static Caller Owner => Suite.Branch.As(Persona.Owner());
    private static Caller Control => Suite.Branch.As(Persona.ControlPlane());

    /// <summary>The café as it is now, with everything allowed again, so scenarios do not inherit each other's plan.</summary>
    private static async Task<TenantView> ResetAsync()
    {
        await Control.PutAsync<TenantView>($"{Tenant}/entitlements", FeaturesView.All);
        return await Owner.PutAsync<TenantView>(Tenant, Update(FeaturesView.All));
    }

    private static object Update(FeaturesView features, string name = "Chillax", string? color = "#112233")
        => new { name = new { en = name, ar = "تشيلاكس" }, primaryColor = color, customerUrl = (string?)null, features };

    [TestMethod]
    public async Task A_stack_nobody_has_told_otherwise_serves_its_seed_brand_with_every_switch_usable()
    {
        await ResetAsync();
        var anyone = Suite.Branch.AsAnonymous();

        var brand = await anyone.GetAsync<TenantView>(Tenant);

        Assert.AreEqual(FeaturesView.All, brand.Entitlements, "a stack stamped before plans keeps every switch usable");
        Assert.IsTrue(brand.Version > 0, "the version is what the surfaces cache-bust on");
    }

    [TestMethod]
    public async Task The_owner_changes_the_brand_and_every_surface_sees_a_new_version()
    {
        await ResetAsync();
        var before = await Owner.GetAsync<TenantView>(Tenant);

        var saved = await Owner.PutAsync<TenantView>(Tenant, Update(FeaturesView.All, name: "Blue Café", color: "#1E90FF"));

        Assert.AreEqual("Blue Café", saved.Name.En);
        Assert.AreEqual("تشيلاكس", saved.Name.Ar);
        Assert.AreEqual("#1e90ff", saved.PrimaryColor, "a colour is kept lower-case");
        Assert.IsTrue(saved.Version > before.Version, "the version moves, so the apps re-read the brand");

        var (status, detail) = await Owner.RefusedAsync(HttpMethod.Put, Tenant, Update(FeaturesView.All, color: "blue"));
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("#rrggbb", detail);

        (status, detail) = await Owner.RefusedAsync(HttpMethod.Put, Tenant, new { name = new { en = "" }, features = FeaturesView.All });
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("English name", detail);
    }

    [TestMethod]
    public async Task The_plan_clamps_the_switches_and_an_owner_never_turns_on_what_is_not_in_it()
    {
        await ResetAsync();
        // Everything on, then Starter arrives: inventory, finance and payroll are not in it
        var starter = new FeaturesView(true, true, true, true, false, false, false, true);

        var pushed = await Control.PutAsync<TenantView>($"{Tenant}/entitlements", starter);

        Assert.AreEqual(starter, pushed.Entitlements);
        Assert.AreEqual(starter, pushed.Features, "what was switched on beyond the plan goes off with it");

        // The owner asks for everything back; only what the plan allows is kept
        var asked = await Owner.PutAsync<TenantView>(Tenant, Update(FeaturesView.All));
        Assert.IsFalse(asked.Features.Inventory, "a module outside the plan cannot be switched on");
        Assert.IsFalse(asked.Features.Finance);
        Assert.IsFalse(asked.Features.Payroll);
        Assert.IsTrue(asked.Features.Loyalty, "what the plan includes is the owner's to turn");

        // And an owner may always switch an entitled module off
        var off = await Owner.PutAsync<TenantView>(Tenant, Update(starter with { Loyalty = false }));
        Assert.IsFalse(off.Features.Loyalty);
        Assert.IsTrue(off.Entitlements.Loyalty, "switched off by the owner is not the same as not in the plan");
    }

    [TestMethod]
    public async Task The_entitlements_are_the_control_planes_alone()
    {
        await ResetAsync();

        foreach (var persona in new[] { Persona.Owner(), Persona.Admin(), Persona.Cashier() })
        {
            var (status, _) = await Suite.Branch.As(persona).RefusedAsync(HttpMethod.Put, $"{Tenant}/entitlements", FeaturesView.All);
            Assert.AreEqual(HttpStatusCode.Forbidden, status, $"{persona.Name} does not set the plan");
        }

        var (anonymous, _) = await Suite.Branch.AsAnonymous().RefusedAsync(HttpMethod.Put, $"{Tenant}/entitlements", FeaturesView.All);
        Assert.AreEqual(HttpStatusCode.Unauthorized, anonymous);

        // And the brand is the owner's: an admin may read it, not write it
        var (adminWrite, _) = await Suite.Branch.As(Persona.Admin()).RefusedAsync(HttpMethod.Put, Tenant, Update(FeaturesView.All));
        Assert.AreEqual(HttpStatusCode.Forbidden, adminWrite);
    }

    [TestMethod]
    public async Task A_module_that_is_not_in_the_plan_answers_402_and_names_itself()
    {
        var anyone = Suite.Branch.AsAnonymous();

        using var response = await anyone.RawAsync(HttpMethod.Get, $"{Tenant}/module-off?module=inventory");

        Assert.AreEqual(HttpStatusCode.PaymentRequired, response.StatusCode, "the gateway sends a blocked module's calls here");
        var problem = await response.Content.ReadAsStringAsync();
        Assert.Contains("module-off", problem, StringComparison.Ordinal);
        Assert.Contains("inventory", problem, StringComparison.Ordinal, "the app is told which module to ask about");
    }

    [TestMethod]
    public async Task The_manifest_names_the_cafe_so_installing_the_app_puts_its_name_on_the_phone()
    {
        await ResetAsync();
        await Owner.PutAsync<TenantView>(Tenant, Update(FeaturesView.All, name: "Chillax Zamalek"));
        var anyone = Suite.Branch.AsAnonymous();

        using var manifest = await anyone.RawAsync(HttpMethod.Get, $"{Tenant}/manifest?app=client");
        Assert.AreEqual(HttpStatusCode.OK, manifest.StatusCode);
        Assert.Contains("Chillax Zamalek", await manifest.Content.ReadAsStringAsync(), StringComparison.Ordinal);

        var (status, detail) = await anyone.RefusedAsync(HttpMethod.Get, $"{Tenant}/manifest?app=nonsense");
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("client, admin, pos or kds", detail);
    }
}
