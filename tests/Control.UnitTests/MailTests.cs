using System.Text.Json.Nodes;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

/// <summary>Every mail renders in both languages with nothing unfilled; delivery retries and audits; the demo sweep decides right.</summary>
[TestClass]
public sealed class MailTests
{
    private static readonly PlatformOptions Platform = new()
    {
        Domain = "ninja.app",
        ControlUrl = "https://control.ninja.app",
        Mail = { Host = "smtp.test", From = "no-reply@ninja.app", OpsTo = "ops@ninja.app" },
    };

    private static Tenant Blue(string language) => new()
    {
        Slug = "blue",
        NameEn = "Blue <Bottle>",
        NameAr = "بلو",
        DefaultLanguage = language,
        OwnerEmail = "owner@blue.test",
        OwnerInitialPassword = "Temp1234abcd",
        Kind = TenantKind.Demo,
    };

    private static IEnumerable<MailMessage> Everything(Tenant t)
    {
        var hosts = TenantHosts.For(t, Platform);
        yield return MailTemplates.Welcome(t, hosts, Platform.Mail);
        yield return MailTemplates.DemoExpiring(t, hosts, 3, Platform.Mail);
        yield return MailTemplates.DemoStopped(t, hosts, 7, Platform.Mail);
        yield return MailTemplates.DemoDestroyedSoon(t, hosts, 2, Platform.Mail);
        yield return MailTemplates.SubscriptionPastDue(t, hosts, DateTimeOffset.UtcNow.AddDays(7), Platform.Mail);
        yield return MailTemplates.SubscriptionSuspended(t, hosts, Platform.Mail);
        yield return MailTemplates.PaymentReceived(t, 1500.5m, "EGP", DateTimeOffset.UtcNow.AddDays(30), "INV-7", Platform.Mail);
        yield return MailTemplates.OpsProvisionFailed(t, Guid.NewGuid(), "boom", Platform);
        yield return MailTemplates.OpsBackupFailed(t, "disk full", Platform);
        yield return MailTemplates.OpsBackupStale([("blue", null), ("red", DateTimeOffset.UtcNow.AddDays(-3))], Platform);
        yield return MailTemplates.OpsDiskLow(1200, 5120, Platform);
        yield return MailTemplates.OpsJobStuck("blue", "upgrade", 52, Platform);
        yield return MailTemplates.OpsStackDown("blue", Platform);
        yield return MailTemplates.OpsWorkerDead("Stamp", Platform);
    }

    [TestMethod]
    [DataRow("en")]
    [DataRow("ar")]
    public void Every_template_renders_with_nothing_unfilled_and_the_owner_addressed(string language)
    {
        var tenant = Blue(language);
        var all = Everything(tenant).ToList();
        CollectionAssert.AreEquivalent(MailTemplates.All, all.Select(m => m.Template).ToArray());
        foreach (var m in all)
        {
            Assert.IsFalse(string.IsNullOrWhiteSpace(m.Subject), m.Template);
            Assert.Contains("<html", m.Html, m.Template);
            Assert.DoesNotContain("<td", m.Text, $"{m.Template}: the text body is text, not the HTML");
            Assert.IsFalse(m.Html.Contains("{{") || m.Html.Contains("{0}"), $"{m.Template}: an unfilled slot");
            var ops = m.Template.StartsWith("ops-", StringComparison.Ordinal);
            // The Arabic mails use the Arabic name; the English ones and the ops mails about a tenant carry the English one, encoded
            if ((ops || language == "en") && m.Slug is not null) Assert.Contains("&lt;Bottle&gt;", m.Html, $"{m.Template}: the name is encoded on the way into the HTML");
            Assert.AreEqual(ops ? "ops@ninja.app" : "owner@blue.test", m.To, m.Template);
            Assert.AreEqual(!ops && language == "ar", m.Html.Contains("dir=\"rtl\""), $"{m.Template}: Arabic is right-to-left, ops mail is English");
        }
    }

    [TestMethod]
    public void The_welcome_carries_the_admin_app_the_email_and_the_temporary_password()
    {
        var tenant = Blue("en");
        var welcome = MailTemplates.Welcome(tenant, TenantHosts.For(tenant, Platform), Platform.Mail);
        Assert.Contains("https://admin.blue.ninja.app", welcome.Text);
        Assert.Contains("owner@blue.test", welcome.Text);
        Assert.Contains("Temp1234abcd", welcome.Text);
        Assert.IsNull(welcome.ReplyTo);

        tenant.OwnerInitialPassword = null;
        var later = MailTemplates.Welcome(tenant, TenantHosts.For(tenant, Platform), Platform.Mail);
        Assert.Contains("the password you set", later.Text);

        // The demo mails invite a reply, which lands with whoever runs the platform
        Assert.AreEqual("ops@ninja.app", MailTemplates.DemoExpiring(tenant, TenantHosts.For(tenant, Platform), 3, Platform.Mail).ReplyTo);
    }

    [TestMethod]
    public void The_realms_smtp_is_empty_while_mail_is_off_and_keycloak_shaped_when_on()
    {
        Assert.AreEqual("{}", Templates.SmtpServerJson(new MailOptions()));
        var on = JsonNode.Parse(Templates.SmtpServerJson(new MailOptions { Host = "smtp.test", Port = 2525, User = "u", Password = "p", From = "no-reply@x" }))!.AsObject();
        Assert.AreEqual("smtp.test", on["host"]!.GetValue<string>());
        Assert.AreEqual("2525", on["port"]!.GetValue<string>(), "every value is a string, as Keycloak wants them");
        Assert.AreEqual("true", on["auth"]!.GetValue<string>());
        Assert.AreEqual("true", on["starttls"]!.GetValue<string>());
        Assert.AreEqual("p", on["password"]!.GetValue<string>());
        var anonymous = JsonNode.Parse(Templates.SmtpServerJson(new MailOptions { Host = "smtp.test" }))!.AsObject();
        Assert.AreEqual("false", anonymous["auth"]!.GetValue<string>());
        Assert.IsFalse(anonymous.ContainsKey("user"));
    }

    private sealed class CountingMailer(int failFirst, bool configured = true) : IMailer
    {
        public int Calls { get; private set; }
        public bool Configured => configured;
        public Task SendAsync(MailMessage message, CancellationToken ct)
        {
            Calls++;
            return Calls <= failFirst ? throw new InvalidOperationException($"attempt {Calls} refused") : Task.CompletedTask;
        }
    }

    private sealed class CollectingAudit : IAuditWriter
    {
        public List<string> Actions { get; } = [];
        public Task WriteAsync(string action, string? slug, object? details, CancellationToken ct, string? source = null) { Actions.Add(action); return Task.CompletedTask; }
    }

    private static readonly MailMessage Message = new("owner@blue.test", "s", "<html></html>", "t", "owner-welcome", "blue");

    private static Task NoWait(TimeSpan wait, CancellationToken ct) => Task.CompletedTask;

    [TestMethod]
    public async Task Delivery_succeeds_first_time_and_audits_sent()
    {
        var mailer = new CountingMailer(failFirst: 0);
        var audit = new CollectingAudit();
        var status = new MailStatus();
        var (outcome, attempts, error) = await MailSender.DeliverAsync(Message, mailer, audit, status, NoWait, CancellationToken.None);
        Assert.AreEqual(1, mailer.Calls);
        CollectionAssert.AreEqual(new[] { "mail.sent" }, audit.Actions);
        Assert.AreEqual(1, status.Sent);
        Assert.IsNotNull(status.LastSentAt);
        Assert.AreEqual((MailOutcome.Sent, 1, (string?)null), (outcome, attempts, error));
    }

    [TestMethod]
    public async Task Delivery_retries_twice_then_audits_failed()
    {
        var mailer = new CountingMailer(failFirst: 5);
        var audit = new CollectingAudit();
        var status = new MailStatus();
        var (outcome, attempts, error) = await MailSender.DeliverAsync(Message, mailer, audit, status, NoWait, CancellationToken.None);
        Assert.AreEqual(3, mailer.Calls);
        CollectionAssert.AreEqual(new[] { "mail.failed" }, audit.Actions);
        Assert.AreEqual(1, status.Failed);
        Assert.Contains("attempt 3", status.LastError!);
        Assert.AreEqual(MailOutcome.Failed, outcome);
        Assert.AreEqual(3, attempts);
        Assert.Contains("attempt 3", error!);
    }

    [TestMethod]
    public async Task Mail_that_is_off_is_skipped_once_and_never_retried()
    {
        var mailer = new CountingMailer(failFirst: 0, configured: false);
        var audit = new CollectingAudit();
        var status = new MailStatus();
        var (outcome, _, _) = await MailSender.DeliverAsync(Message, mailer, audit, status, NoWait, CancellationToken.None);
        Assert.AreEqual(1, mailer.Calls);
        CollectionAssert.AreEqual(new[] { "mail.skipped" }, audit.Actions);
        Assert.AreEqual(1, status.Skipped);
        Assert.AreEqual(MailOutcome.Skipped, outcome);
    }

    [TestMethod]
    public void The_demo_sweep_warns_once_stops_warns_again_and_destroys()
    {
        var now = new DateTimeOffset(2026, 9, 20, 12, 0, 0, TimeSpan.Zero);
        Tenant Demo(TenantStatus status, int expiresInDays, DateTimeOffset? warned = null, DateTimeOffset? destroyWarned = null)
            => new() { Kind = TenantKind.Demo, Status = status, ExpiresAt = now.AddDays(expiresInDays), ExpiryWarnedAt = warned, DestroyWarnedAt = destroyWarned };
        DemoAction Decide(Tenant t) => DemoExpiryService.Decide(t, now, graceDays: 7, warnDays: 3, destroyWarnDays: 2);

        Assert.AreEqual(DemoAction.None, Decide(Demo(TenantStatus.Running, 4)));
        Assert.AreEqual(DemoAction.Warn, Decide(Demo(TenantStatus.Running, 3)));
        Assert.AreEqual(DemoAction.None, Decide(Demo(TenantStatus.Running, 3, warned: now)), "warned once");
        Assert.AreEqual(DemoAction.Stop, Decide(Demo(TenantStatus.Running, 0)));
        Assert.AreEqual(DemoAction.None, Decide(Demo(TenantStatus.Stopped, -4)), "stopped, grace running, nothing to say yet");
        Assert.AreEqual(DemoAction.WarnDestroy, Decide(Demo(TenantStatus.Stopped, -5)));
        Assert.AreEqual(DemoAction.None, Decide(Demo(TenantStatus.Stopped, -5, destroyWarned: now)));
        Assert.AreEqual(DemoAction.Destroy, Decide(Demo(TenantStatus.Stopped, -7)));
        Assert.AreEqual(DemoAction.None, Decide(new Tenant { Kind = TenantKind.Customer, Status = TenantStatus.Running, ExpiresAt = now }), "customers do not expire");
        Assert.AreEqual(DemoAction.None, Decide(new Tenant { Kind = TenantKind.Demo, Status = TenantStatus.Failed, ExpiresAt = now }));
    }
}
