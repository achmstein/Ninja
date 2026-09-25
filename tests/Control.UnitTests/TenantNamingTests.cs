using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

[TestClass]
public sealed class TenantNamingTests
{
    [TestMethod]
    [DataRow("Blue Bottle Café", "blue-bottle-caf")]
    [DataRow("  Joe's   Coffee!! ", "joe-s-coffee")]
    [DataRow("كافيه", null)]
    [DataRow("ab", null)]
    [DataRow("A very long café name that keeps going and going", "a-very-long-caf-name-tha")]
    public void Slug_from_a_name(string name, string? expected)
        => Assert.AreEqual(expected, TenantNaming.SlugFrom(name));

    [TestMethod]
    public void A_drill_slug_fits_the_24_characters_a_slug_may_have()
    {
        Assert.AreEqual("drill-blue", TenantNaming.DrillSlug("blue"));
        var drill = TenantNaming.DrillSlug("a-very-long-cafe-name-th");
        Assert.HasCount(24, drill);
        Assert.IsTrue(TenantNaming.IsValidSlug(drill), drill);
    }

    /// <summary>
    /// The same secrets go on rabbitmqctl's command line (add_user,
    /// change_password), which reads a word starting with '-' as an option
    /// and refuses the user. One in 64 base64url strings starts with one.
    /// </summary>
    [TestMethod]
    public void A_secret_never_starts_with_a_dash_and_stays_32_url_safe_characters()
    {
        for (var i = 0; i < 20_000; i++)
        {
            var secret = TenantNaming.NewSecret();
            Assert.HasCount(32, secret);
            Assert.IsFalse(secret.StartsWith('-'), secret);
            Assert.IsTrue(secret.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_'), secret);
        }
    }

    [TestMethod]
    public void The_cafes_own_service_is_tenant_with_its_own_database_and_queue()
    {
        CollectionAssert.Contains(TenantNaming.Services, "tenant");
        CollectionAssert.DoesNotContain(TenantNaming.Services, "branch");
        CollectionAssert.Contains(TenantNaming.Databases, "tenantdb");
        CollectionAssert.DoesNotContain(TenantNaming.Databases, "branchdb");
        Assert.AreEqual("blue-tenant-api", TenantNaming.Service("blue", "tenant"));
        Assert.AreEqual("Tenant", TenantNaming.Queue("tenant"), "Tenant.API's EventBus:SubscriptionClientName");
        Assert.AreEqual("blue_tenantdb", TenantNaming.Database("blue", "tenantdb"));
    }

    [TestMethod]
    public void The_role_and_the_broker_user_are_the_slug_with_a_suffix_no_slug_can_carry()
    {
        Assert.AreEqual("blue-bottle_app", TenantNaming.DbRole("blue-bottle"));
        Assert.AreEqual("blue-bottle_app", TenantNaming.BrokerUser("blue-bottle"));
        Assert.IsFalse(TenantNaming.IsValidSlug("blue_app"), "no tenant can be named after another's role");
    }

    [TestMethod]
    [DataRow("blue-bottle", true)]
    [DataRow("cafe123", true)]
    [DataRow("Blue", false)]
    [DataRow("a--b", false)]
    [DataRow("-abc", false)]
    [DataRow("abc-", false)]
    [DataRow("api", false)]
    [DataRow("admin", false)]
    [DataRow("ab", false)]
    public void Slug_rules(string slug, bool valid)
        => Assert.AreEqual(valid, TenantNaming.IsValidSlug(slug));

    [TestMethod]
    public void Hosts_hang_off_the_platform_domain_unless_the_cafe_brought_its_own()
    {
        var platform = new PlatformOptions { Domain = "ninja.app" };
        var tenant = new Tenant { Slug = "blue" };

        var hosts = TenantHosts.For(tenant, platform);
        Assert.AreEqual("blue.ninja.app", hosts.Customer);
        Assert.AreEqual("admin.blue.ninja.app", hosts.Admin);
        Assert.AreEqual("pos.blue.ninja.app", hosts.Pos);
        Assert.AreEqual("kds.blue.ninja.app", hosts.Kds);
        Assert.AreEqual("api.blue.ninja.app", hosts.Api);

        tenant.CustomerDomain = "menu.bluebottle.com";
        Assert.AreEqual("https://menu.bluebottle.com", TenantHosts.For(tenant, platform).CustomerUrl);
        Assert.AreEqual("https://admin.blue.ninja.app", TenantHosts.For(tenant, platform).AdminUrl);

        var laptop = new PlatformOptions { Domain = "localhost", Scheme = "http" };
        Assert.AreEqual("http://admin.blue.localhost", TenantHosts.For(new Tenant { Slug = "blue" }, laptop).AdminUrl);
    }

    [TestMethod]
    public void Names_on_the_shared_box_carry_the_slug()
    {
        Assert.AreEqual("ninja-blue", TenantNaming.Project("blue"));
        Assert.AreEqual("blue_catalogdb", TenantNaming.Database("blue", "catalogdb"));
        Assert.AreEqual("blue-catalog-api", TenantNaming.Service("blue", "catalog"));
        Assert.AreEqual("blue-gateway", TenantNaming.Gateway("blue"));
        Assert.AreEqual("blue-branch-uploads", TenantNaming.UploadsVolume("blue"));
        Assert.AreEqual("ninja-blue_blue-branch-uploads", TenantNaming.UploadsVolumeOnDocker("blue"));
        Assert.AreEqual("blue-catalog-pics", TenantNaming.PicsVolume("blue"));
        Assert.AreEqual("ninja-blue_blue-catalog-pics", TenantNaming.PicsVolumeOnDocker("blue"));
        Assert.AreEqual(11, TenantNaming.Databases.Length);
        Assert.AreEqual(13, TenantNaming.Services.Length);
        Assert.AreEqual("Inventory", TenantNaming.Queue("inventory"));
    }

    [TestMethod]
    public void Secrets_and_passwords_are_long_enough_and_url_safe()
    {
        var secret = TenantNaming.NewSecret();
        Assert.AreEqual(32, secret.Length);
        Assert.IsFalse(secret.Contains('+') || secret.Contains('/'));
        var password = TenantNaming.NewPassword();
        Assert.AreEqual(12, password.Length);
        Assert.IsFalse(password.Any(c => "0O1lI".Contains(c)));
    }

    [TestMethod]
    [DataRow("menu.cafe.com", true)]
    [DataRow("cafe.com", true)]
    [DataRow("a-b.example.co.uk", true)]
    [DataRow("cafe", false)]
    [DataRow("Menu.Cafe.com", false)]
    [DataRow("menu cafe.com", false)]
    [DataRow("menu.cafe.com {", false)]
    [DataRow("-menu.cafe.com", false)]
    [DataRow("menu..cafe.com", false)]
    [DataRow("menu.cafe.123", false)]
    public void A_customer_domain_is_a_host_name_and_nothing_that_could_reach_the_edge_config(string host, bool ok)
        => Assert.AreEqual(ok, TenantNaming.IsValidHostname(host), host);

    [TestMethod]
    public void The_slug_is_read_off_any_platform_host()
    {
        var platform = new PlatformOptions { Domain = "ninja.app" };
        Assert.AreEqual("blue", TenantHosts.SlugFromHost("blue.ninja.app", platform));
        Assert.AreEqual("blue", TenantHosts.SlugFromHost("admin.blue.ninja.app", platform));
        Assert.AreEqual("blue", TenantHosts.SlugFromHost("api.blue.ninja.app", platform));
        Assert.IsNull(TenantHosts.SlugFromHost("ninja.app", platform));
        Assert.IsNull(TenantHosts.SlugFromHost("menu.cafe.com", platform));
        Assert.IsNull(TenantHosts.SlugFromHost("evil.blue.ninja.app", platform), "an unknown prefix is not a slug");
        Assert.IsNull(TenantHosts.SlugFromHost("blue.ninja.app.evil.com", platform));
    }

    [TestMethod]
    public void A_customer_domain_is_normalised_and_the_platforms_own_hosts_are_refused()
    {
        var platform = new PlatformOptions { Domain = "ninja.app" };
        Assert.AreEqual("menu.cafe.com", TenantHosts.NormalizeCustomerDomain("  Menu.Cafe.COM ", platform, out var error));
        Assert.IsNull(error);
        Assert.IsNull(TenantHosts.NormalizeCustomerDomain("   ", platform, out error));
        Assert.IsNull(error);
        Assert.IsNull(TenantHosts.NormalizeCustomerDomain("blue.ninja.app", platform, out error));
        Assert.IsNotNull(error);
        Assert.IsNull(TenantHosts.NormalizeCustomerDomain("menu cafe.com", platform, out error));
        Assert.IsNotNull(error);
    }
}
