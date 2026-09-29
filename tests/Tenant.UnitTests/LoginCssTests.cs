using Ninja.Tenant.API.Model;
using Ninja.Tenant.API.Services;

namespace Ninja.Tenant.UnitTests;

/// <summary>The café's colours for its sign-in pages.</summary>
[TestClass]
public sealed class LoginCssTests
{
    private const string Api = "https://api.cafe.example";

    [TestMethod]
    public void The_brand_colour_becomes_the_primary_on_both_schemes()
    {
        var css = LoginCss.For(new API.Model.Tenant { PrimaryColor = "#0055FF" }, Api);
        StringAssert.Contains(css, "--primary: #0055ff;");
        StringAssert.Contains(css, ":root[data-theme='dark']");
        StringAssert.Contains(css, "--ring: color-mix(in oklch, #0055ff 60%, transparent);");
    }

    [TestMethod]
    public void The_dark_scheme_takes_its_own_seed_when_the_cafe_set_one()
    {
        var tenant = new API.Model.Tenant { PrimaryColor = "#0055ff", Theme = new TenantTheme { Dark = new TenantThemeDark { Primary = "#88aaff" } } };
        var css = LoginCss.For(tenant, Api);
        var dark = css[css.IndexOf(":root[data-theme='dark']", StringComparison.Ordinal)..];
        StringAssert.Contains(dark, "--primary: #88aaff;");
    }

    [TestMethod]
    public void No_colour_and_anything_that_is_not_a_colour_change_nothing()
    {
        Assert.IsFalse(LoginCss.For(new API.Model.Tenant(), Api).Contains("--primary"));
        Assert.IsFalse(LoginCss.For(new API.Model.Tenant { PrimaryColor = "red; } body { display:none" }, Api).Contains("--primary"));
    }

    [TestMethod]
    public void The_text_on_the_colour_is_whichever_reads()
    {
        Assert.AreEqual("#ffffff", LoginCss.OnColour("#0055ff"));
        Assert.AreEqual("#0a0a0a", LoginCss.OnColour("#ffd400"));
    }

    [TestMethod]
    public void The_cafes_fonts_are_loaded_first_and_named_for_the_pages()
    {
        var css = LoginCss.For(new API.Model.Tenant { PrimaryColor = "#0055ff", Theme = new TenantTheme { FontLatin = "Satoshi", FontArabic = "Readex Pro" } }, Api);
        Assert.IsTrue(css.StartsWith("@import url('https://api.fontshare.com/v2/css?f[]=satoshi", StringComparison.Ordinal));
        StringAssert.Contains(css, "@import url('https://fonts.googleapis.com/css2?family=Readex+Pro:");
        StringAssert.Contains(css, "--font-latin: 'Satoshi';");
        StringAssert.Contains(css, "--font-arabic: 'Readex Pro';");
    }

    [TestMethod]
    public void The_wordmark_heads_the_page_before_the_logo_by_language_and_scheme()
    {
        var tenant = new API.Model.Tenant
        {
            Images = new()
            {
                [TenantImageSlots.Logo] = new TenantImage { Version = 1, Width = 512, Height = 512 },
                [TenantImageSlots.LogoDark] = new TenantImage { Version = 2, Width = 512, Height = 512 },
                [TenantImageSlots.WordmarkAr] = new TenantImage { Version = 3, Width = 600, Height = 200 },
            },
        };
        var css = LoginCss.Logo(tenant, Api);
        string Rule(string selector)
        {
            var start = css.IndexOf(selector + " {", StringComparison.Ordinal);
            return css[start..css.IndexOf('}', start)];
        }

        StringAssert.Contains(Rule(":root"), "--nj-logo: url('https://api.cafe.example/api/tenant/images/logo?v=1');");
        StringAssert.Contains(Rule(":root[data-theme='dark']"), "--nj-logo: url('https://api.cafe.example/api/tenant/images/logo-dark?v=2');");
        StringAssert.Contains(Rule(":root[lang='ar']"), "--nj-logo: url('https://api.cafe.example/api/tenant/images/wordmark-ar?v=3');");
        StringAssert.Contains(Rule(":root[lang='ar']"), "--nj-logo-ratio: 600 / 200;");
        // No dark Arabic wordmark: the light one, before any logo
        StringAssert.Contains(Rule(":root[lang='ar'][data-theme='dark']"), "wordmark-ar?v=3");
    }

    [TestMethod]
    public void No_uploaded_image_leaves_the_page_its_icon()
    {
        Assert.AreEqual("", LoginCss.Logo(new API.Model.Tenant(), Api));
        Assert.IsFalse(LoginCss.For(new API.Model.Tenant { PrimaryColor = "#0055ff" }, Api).Contains("--nj-logo"));
    }

    [TestMethod]
    public void The_logo_is_addressed_on_the_api_host_or_left_to_the_icon()
    {
        var tenant = new API.Model.Tenant { Images = new() { [TenantImageSlots.Logo] = new TenantImage { Version = 1, Width = 512, Height = 512 } } };
        // Only the origin of the API's address, whatever follows it
        StringAssert.Contains(LoginCss.Logo(tenant, "http://localhost:5000/some/path?x=1"), "url('http://localhost:5000/api/tenant/images/logo?v=1')");
        // No host to address it on (a path alone would be asked of Keycloak's): the page keeps the café's icon
        Assert.AreEqual("", LoginCss.Logo(tenant, null));
        Assert.AreEqual("", LoginCss.Logo(tenant, "/api"));
        Assert.AreEqual("", LoginCss.Logo(tenant, "javascript:alert(1)"));
    }

    [TestMethod]
    public void A_font_off_the_cafes_lists_never_reaches_the_sheet()
    {
        var css = LoginCss.For(new API.Model.Tenant { Theme = new TenantTheme { FontLatin = "x'); } body { display:none" } }, Api);
        Assert.IsFalse(css.Contains("@import"));
        Assert.IsFalse(css.Contains("--font-latin"));
    }
}
