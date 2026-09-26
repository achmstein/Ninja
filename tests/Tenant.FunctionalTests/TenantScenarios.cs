using System.Net;
using Ninja.Testing;

namespace Ninja.Tenant.FunctionalTests;

/// <summary>The service, once for the suite.</summary>
[TestClass]
public static class Suite
{
    public static ServiceUnderTest<Program> TenantApi { get; private set; } = null!;

    [AssemblyInitialize]
    public static async Task StartAsync(TestContext context)
    {
        await SharedServices.StartAsync();
        TenantApi = new ServiceUnderTest<Program>("tenantdb");
        _ = TenantApi.CreateClient();
    }

    [AssemblyCleanup]
    public static async Task StopAsync()
    {
        await TenantApi.DisposeAsync();
        await SharedServices.StopAsync();
    }
}

/// <summary>What the apps read off the wire; named here so a change in the API's shape fails a test.</summary>
public record TenantView(LocalizedView Name, string? PrimaryColor, string? CustomerUrl, FeaturesView Features, FeaturesView Entitlements, long Version);
public record LocalizedView(string En, string? Ar);
public record FeaturesView(bool Reservations, bool TimeBilling, bool Loyalty, bool Tabs, bool Inventory, bool Finance, bool Payroll, bool Kds, bool OnlinePayments = false)
{
    public static FeaturesView All => new(true, true, true, true, true, true, true, true, true);
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

    private static Caller Owner => Suite.TenantApi.As(Persona.Owner());
    private static Caller Control => Suite.TenantApi.As(Persona.ControlPlane());

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
        var anyone = Suite.TenantApi.AsAnonymous();

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

    private record ThemeView(string? Radius, string? Style, LayoutView? Layout);
    private record LayoutView(string? MenuItem, string? Categories, string? Header, string? Buttons, string? Surface, string? Density);
    private record StyledView(ThemeView Theme, long Version);

    private static object Styled(object? theme)
        => new { name = new { en = "Chillax", ar = "تشيلاكس" }, primaryColor = "#112233", features = FeaturesView.All, theme };

    [TestMethod]
    public async Task The_owner_picks_a_style_and_dresses_single_parts_otherwise()
    {
        await ResetAsync();
        var anyone = Suite.TenantApi.AsAnonymous();

        var classic = await anyone.GetAsync<StyledView>(Tenant);
        Assert.IsNull(classic.Theme.Style, "a café that never chose is classic, as every café looked before styles");
        Assert.IsNull(classic.Theme.Layout);

        await Owner.PutAsync<StyledView>(Tenant, Styled(new { radius = "lg", style = " Bold ", layout = new { menuItem = "row", density = "AIRY" } }));
        var saved = await anyone.GetAsync<StyledView>(Tenant);
        Assert.AreEqual("bold", saved.Theme.Style, "trimmed and lower-cased like every other seed");
        Assert.AreEqual(new LayoutView("row", null, null, null, null, "airy"), saved.Theme.Layout, "only the parts chosen are kept; the rest are the style's");
        Assert.AreEqual("lg", saved.Theme.Radius, "the café's own seeds stand beside the style");

        // A layout that chooses nothing is no layout
        var cleared = await Owner.PutAsync<StyledView>(Tenant, Styled(new { style = "cozy", layout = new { menuItem = "" } }));
        Assert.AreEqual("cozy", cleared.Theme.Style);
        Assert.IsNull(cleared.Theme.Layout);

        var (status, detail) = await Owner.RefusedAsync(HttpMethod.Put, Tenant, Styled(new { style = "neon" }));
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("classic, minimal, bold, cozy, night", detail);

        (status, detail) = await Owner.RefusedAsync(HttpMethod.Put, Tenant, Styled(new { layout = new { header = "floating" } }));
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("header layout", detail);
    }

    private record AssistantView(string? Name, string? Tone, string? Manner, string? Language, string? Notes);
    private record WithAssistant(AssistantView Assistant);

    [TestMethod]
    public async Task The_owner_sets_how_their_assistant_speaks_and_everyone_reads_it_with_the_brand()
    {
        await ResetAsync();

        await Owner.PutAsync<WithAssistant>($"{Tenant}/assistant", new { name = " Zein ", tone = "Detailed", manner = "formal", language = "ar-eg", notes = "Flag any discount over 20%." });
        var read = await Suite.TenantApi.AsAnonymous().GetAsync<WithAssistant>(Tenant);
        Assert.AreEqual(new AssistantView("Zein", "detailed", "formal", "ar-eg", "Flag any discount over 20%."), read.Assistant, "the assistant reads it with the public brand");

        var cleared = await Owner.PutAsync<WithAssistant>($"{Tenant}/assistant", new { });
        Assert.AreEqual(new AssistantView(null, null, null, null, null), cleared.Assistant, "nothing set is the platform's default");

        var (status, detail) = await Owner.RefusedAsync(HttpMethod.Put, $"{Tenant}/assistant", new { tone = "chatty" });
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("brief, detailed", detail);

        var (admin, _) = await Suite.TenantApi.As(Persona.Admin()).RefusedAsync(HttpMethod.Put, $"{Tenant}/assistant", new { name = "X" });
        Assert.AreEqual(HttpStatusCode.Forbidden, admin, "the owner's assistant is the owner's");
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
        Assert.IsFalse(asked.Features.OnlinePayments, "online payments are an add-on the plan did not bring");

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
            var (status, _) = await Suite.TenantApi.As(persona).RefusedAsync(HttpMethod.Put, $"{Tenant}/entitlements", FeaturesView.All);
            Assert.AreEqual(HttpStatusCode.Forbidden, status, $"{persona.Name} does not set the plan");
        }

        var (anonymous, _) = await Suite.TenantApi.AsAnonymous().RefusedAsync(HttpMethod.Put, $"{Tenant}/entitlements", FeaturesView.All);
        Assert.AreEqual(HttpStatusCode.Unauthorized, anonymous);

        // And the brand is the owner's: an admin may read it, not write it
        var (adminWrite, _) = await Suite.TenantApi.As(Persona.Admin()).RefusedAsync(HttpMethod.Put, Tenant, Update(FeaturesView.All));
        Assert.AreEqual(HttpStatusCode.Forbidden, adminWrite);
    }

    [TestMethod]
    public async Task A_module_that_is_not_in_the_plan_answers_402_and_names_itself()
    {
        var anyone = Suite.TenantApi.AsAnonymous();

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
        var anyone = Suite.TenantApi.AsAnonymous();

        using var manifest = await anyone.RawAsync(HttpMethod.Get, $"{Tenant}/manifest?app=client");
        Assert.AreEqual(HttpStatusCode.OK, manifest.StatusCode);
        Assert.Contains("Chillax Zamalek", await manifest.Content.ReadAsStringAsync(), StringComparison.Ordinal);

        var (status, detail) = await anyone.RefusedAsync(HttpMethod.Get, $"{Tenant}/manifest?app=nonsense");
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("client, admin, pos or kds", detail);
    }
}
