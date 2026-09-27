using Ninja.Tenant.API.Model;
using Ninja.Tenant.API.Services;

namespace Ninja.Tenant.UnitTests;

/// <summary>The café's colours for its sign-in pages.</summary>
[TestClass]
public sealed class LoginCssTests
{
    [TestMethod]
    public void The_brand_colour_becomes_the_primary_on_both_schemes()
    {
        var css = LoginCss.For(new API.Model.Tenant { PrimaryColor = "#0055FF" });
        StringAssert.Contains(css, "--primary: #0055ff;");
        StringAssert.Contains(css, ":root[data-theme='dark']");
        StringAssert.Contains(css, "--ring: color-mix(in oklch, #0055ff 60%, transparent);");
    }

    [TestMethod]
    public void The_dark_scheme_takes_its_own_seed_when_the_cafe_set_one()
    {
        var tenant = new API.Model.Tenant { PrimaryColor = "#0055ff", Theme = new TenantTheme { Dark = new TenantThemeDark { Primary = "#88aaff" } } };
        var css = LoginCss.For(tenant);
        var dark = css[css.IndexOf(":root[data-theme='dark']", StringComparison.Ordinal)..];
        StringAssert.Contains(dark, "--primary: #88aaff;");
    }

    [TestMethod]
    public void No_colour_and_anything_that_is_not_a_colour_change_nothing()
    {
        Assert.IsFalse(LoginCss.For(new API.Model.Tenant()).Contains("--primary"));
        Assert.IsFalse(LoginCss.For(new API.Model.Tenant { PrimaryColor = "red; } body { display:none" }).Contains("--primary"));
    }

    [TestMethod]
    public void The_text_on_the_colour_is_whichever_reads()
    {
        Assert.AreEqual("#ffffff", LoginCss.OnColour("#0055ff"));
        Assert.AreEqual("#0a0a0a", LoginCss.OnColour("#ffd400"));
    }
}
