using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

/// <summary>
/// A cafe speaks one Arabic and everything the platform sends it follows:
/// the owner's mail and the login page. Only the lines that actually read
/// differently carry a Standard of their own; the rest fall back.
/// </summary>
[TestClass]
public sealed class ArabicStyleTests
{
    private static readonly PlatformOptions Platform = new()
    {
        Domain = "ninja.app",
        ControlUrl = "https://control.ninja.app",
        Mail = { Host = "smtp.test", From = "no-reply@ninja.app", OpsTo = "ops@ninja.app" },
    };

    private static Tenant Cafe(string arabicStyle) => new()
    {
        Slug = "blue",
        NameEn = "Blue Bottle",
        NameAr = "بلو",
        DefaultLanguage = "ar",
        ArabicStyle = arabicStyle,
        OwnerEmail = "owner@blue.test",
        Kind = TenantKind.Customer,
    };

    private static TenantHosts Hosts(Tenant t) => TenantHosts.For(t, Platform);

    /// <summary>
    /// The owner reads the back office, and the back office reads one Arabic.
    /// The café's own choice is about its customers, so the mail must not move
    /// with it.
    /// </summary>
    [TestMethod]
    public void The_owners_mail_reads_the_same_whichever_arabic_the_cafe_chose()
    {
        var egyptian = MailTemplates.Welcome(Cafe("egyptian"), Hosts(Cafe("egyptian")), Platform.Mail);
        var standard = MailTemplates.Welcome(Cafe("standard"), Hosts(Cafe("standard")), Platform.Mail);

        Assert.AreEqual(standard.Subject, egyptian.Subject);
        Assert.AreEqual(standard.Text, egyptian.Text);
        StringAssert.Contains(egyptian.Subject, "مرحبًا بك");
        Assert.IsFalse(egyptian.Subject.Contains("أهلاً بيك"), "the Egyptian greeting should not reach the owner");
    }

    [TestMethod]
    public void An_english_cafe_gets_english_mail()
    {
        var t = Cafe("standard");
        t.DefaultLanguage = "en";
        var mail = MailTemplates.Welcome(t, Hosts(t), Platform.Mail);

        StringAssert.Contains(mail.Subject, "Welcome to");
    }

    [TestMethod]
    public void The_day_count_reads_as_the_back_office_writes_it()
    {
        foreach (var style in new[] { "egyptian", "standard" })
        {
            var t = Cafe(style);
            var subject = MailTemplates.DemoExpiring(t, Hosts(t), 2, Platform.Mail).Subject;
            StringAssert.Contains(subject, "يومان", style);
            Assert.IsFalse(subject.Contains("يومين"), style);
        }
    }

    /// <summary>One theme serves every realm, so its two bundles must agree.</summary>
    [TestMethod]
    public void The_login_page_says_the_same_things_in_both_languages()
    {
        var en = Bundle("messages_en.properties");
        var ar = Bundle("messages_ar.properties");

        Assert.IsTrue(en.Count > 30, "the login bundle looks empty");
        foreach (var key in en.Keys)
        {
            Assert.IsTrue(ar.ContainsKey(key), $"{key} is on the login page in English but not in Arabic");
        }
    }

    /// <summary>
    /// A realm stamps its own phone pattern and placeholder from its country
    /// (PhoneRules.For), so no login text may name one market's shape.
    /// </summary>
    [TestMethod]
    public void The_login_page_does_not_name_one_markets_phone_number()
    {
        foreach (var file in new[] { "messages_en.properties", "messages_ar.properties" })
        {
            foreach (var (key, text) in Bundle(file))
            {
                Assert.IsFalse(text.Contains("01x") || text.Contains("05x"),
                    $"{file}:{key} spells out one country's phone shape: {text}");
            }
        }
    }

    private static Dictionary<string, string> Bundle(string name) =>
        File.ReadAllLines(FindUp($"src/Ninja.AppHost/KeycloakConfiguration/themes/ninja/login/messages/{name}"))
            .Where(l => !l.TrimStart().StartsWith('#') && l.Contains('='))
            .ToDictionary(l => l[..l.IndexOf('=')].Trim(), l => l[(l.IndexOf('=') + 1)..].Trim());

    /// <summary>The repo root from wherever the test assembly runs.</summary>
    private static string FindUp(string relative)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, relative)))
            dir = dir.Parent;
        return Path.Combine(dir!.FullName, relative);
    }
}
