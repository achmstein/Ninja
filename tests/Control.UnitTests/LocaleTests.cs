using Ninja.ServiceDefaults;
using System.Text.Json.Nodes;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

[TestClass]
public sealed class LocaleTests
{
    [TestMethod]
    [DataRow("EG", "01")]
    [DataRow("sa", "05")]
    [DataRow("AE", "05")]
    [DataRow("GB", "07")]
    public void The_phone_field_shows_a_mobile_of_the_country(string country, string start)
    {
        var (pattern, placeholder) = PhoneRules.For(country);
        Assert.AreEqual(PhoneRules.LoosePattern, pattern, "any spelling gets as far as the server, which reads it");
        StringAssert.StartsWith(placeholder, start);
        Assert.IsTrue(PhoneRules.IsValid(placeholder, country));
    }

    [TestMethod]
    public void Defaults_are_tenant_ones_and_bad_values_are_refused()
    {
        var (country, currency, tz, lang) = LocaleFields.Normalize(null, "", " ", null, out var error);
        Assert.IsNull(error);
        Assert.AreEqual("EG", country);
        Assert.AreEqual("EGP", currency);
        Assert.AreEqual("Africa/Cairo", tz);
        Assert.AreEqual("ar", lang);

        var (c2, cur2, tz2, lang2) = LocaleFields.Normalize("sa", "sar", "Asia/Riyadh", "EN", out error);
        Assert.IsNull(error);
        Assert.AreEqual(("SA", "SAR", "Asia/Riyadh", "en"), (c2, cur2, tz2, lang2));

        // A country alone implies the rest; an unknown country keeps tenant one's defaults
        Assert.AreEqual(("SA", "SAR", "Asia/Riyadh", "ar"), LocaleFields.Normalize("SA", null, null, null, out error));
        Assert.AreEqual(("GB", "GBP", "Europe/London", "en"), LocaleFields.Normalize("gb", null, null, null, out error));
        Assert.AreEqual(("ZZ", "EGP", "Africa/Cairo", "ar"), LocaleFields.Normalize("ZZ", null, null, null, out error));

        LocaleFields.Normalize("Egypt", null, null, null, out error);
        StringAssert.Contains(error, "country");
        LocaleFields.Normalize(null, "pounds", null, null, out error);
        StringAssert.Contains(error, "currency");
        LocaleFields.Normalize(null, null, "Mars/Olympus", null, out error);
        StringAssert.Contains(error, "time zone");
        LocaleFields.Normalize(null, null, null, "fr", out error);
        StringAssert.Contains(error, "ar or en");
    }

    [TestMethod]
    public void The_realm_takes_any_spelling_and_shows_the_tenants_country_s_own()
    {
        var platform = new PlatformOptions { Domain = "ninja.app", KeycloakPublicUrl = "https://auth.ninja.app" };
        foreach (var country in new[] { "EG", "SA", "GB" })
        {
            var tenant = new Tenant { Slug = "blue", NameEn = "Blue", OwnerEmail = "o@b.test", IdentitySecret = "i", ControlSecret = "c", Country = country };
            var realm = JsonNode.Parse(Templates.TenantRealm(tenant, TenantHosts.For(tenant, platform), platform))!.AsObject();
            // The user profile is JSON kept as a string in the realm's attributes
            var profileJson = realm["components"]!["org.keycloak.userprofile.UserProfileProvider"]![0]!["config"]!["kc.user.profile.config"]![0]!.GetValue<string>();
            var phone = JsonNode.Parse(profileJson)!["attributes"]!.AsArray().Single(a => a!["name"]!.GetValue<string>() == "phoneNumber")!;
            Assert.AreEqual(PhoneRules.LoosePattern, phone["validations"]!["pattern"]!["pattern"]!.GetValue<string>(), country);
            Assert.AreEqual(PhoneRules.For(country).Placeholder, phone["annotations"]!["inputTypePlaceholder"]!.GetValue<string>(), country);
        }
    }
}
