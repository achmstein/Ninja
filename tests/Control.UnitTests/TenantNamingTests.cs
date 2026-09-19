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
    }

    [TestMethod]
    public void Names_on_the_shared_box_carry_the_slug()
    {
        Assert.AreEqual("ninja-blue", TenantNaming.Project("blue"));
        Assert.AreEqual("blue_catalogdb", TenantNaming.Database("blue", "catalogdb"));
        Assert.AreEqual("blue-catalog-api", TenantNaming.Service("blue", "catalog"));
        Assert.AreEqual("blue-gateway", TenantNaming.Gateway("blue"));
        Assert.AreEqual("blue-branch-uploads", TenantNaming.UploadsVolume("blue"));
        Assert.AreEqual(11, TenantNaming.Databases.Length);
        Assert.AreEqual(12, TenantNaming.Services.Length);
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
}
