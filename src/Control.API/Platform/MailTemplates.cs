using System.Globalization;
using System.Net;
using System.Text;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>
/// Every mail the platform sends, as plain strings in the apps' own voice
/// (Egyptian Arabic, plain English), laid out the same way: a title, a few
/// paragraphs, one link. The owner's language is the tenant's default; the
/// ops mails are English. Nothing here talks to a server.
/// </summary>
public static class MailTemplates
{
    public const string OwnerWelcomeName = "owner-welcome";
    public const string DemoExpiringName = "demo-expiring";
    public const string DemoStoppedName = "demo-stopped";
    public const string DemoDestroyedSoonName = "demo-destroyed-soon";
    public const string SubscriptionPastDueName = "subscription-past-due";
    public const string SubscriptionSuspendedName = "subscription-suspended";
    public const string PaymentReceivedName = "payment-received";
    public const string OpsProvisionFailedName = "ops-provision-failed";
    public const string OpsBackupFailedName = "ops-backup-failed";
    public const string OpsBackupStaleName = "ops-platform-backup-stale";
    public const string OpsDiskLowName = "ops-disk-low";
    public const string OpsJobStuckName = "ops-job-stuck";
    public const string OpsStackDownName = "ops-stack-down";
    public const string OpsWorkerDeadName = "ops-worker-dead";

    public static readonly string[] All =
    [
        OwnerWelcomeName, DemoExpiringName, DemoStoppedName, DemoDestroyedSoonName, SubscriptionPastDueName, SubscriptionSuspendedName, PaymentReceivedName,
        OpsProvisionFailedName, OpsBackupFailedName, OpsBackupStaleName, OpsDiskLowName, OpsJobStuckName, OpsStackDownName, OpsWorkerDeadName,
    ];

    public static MailMessage Welcome(Tenant t, TenantHosts hosts, MailOptions mail)
    {
        var ar = Arabic(t);
        var password = t.OwnerInitialPassword is { } p
            ? Pick(ar, $"Temporary password: {p} — you will be asked to change it the first time you sign in.", $"الباسورد المؤقت: {p} — هيتطلب منك تغيّره أول ما تدخل.")
            : Pick(ar, "Sign in with the password you set.", "ادخل بالباسورد اللي انت عملته.");
        return Build(OwnerWelcomeName, t, t.OwnerEmail, mail,
            Pick(ar, $"Welcome to {Name(t)}", $"أهلاً بيك في {Name(t)}"),
            [
                Pick(ar, $"{Name(t)} is up. Your admin app is where the menu, the tables, the staff and the look of the customer app are set.", $"{Name(t)} شغّال. تطبيق الإدارة هو اللي بتظبط منه المنيو والترابيزات والموظفين وشكل تطبيق العملاء."),
                Pick(ar, $"Sign in as {t.OwnerEmail}.", $"ادخل بـ {t.OwnerEmail}."),
                password,
                Pick(ar, $"Your customers open the menu at {hosts.CustomerUrl}.", $"عملاءك بيفتحوا المنيو من {hosts.CustomerUrl}."),
            ],
            (Pick(ar, "Open the admin app", "افتح تطبيق الإدارة"), hosts.AdminUrl));
    }

    public static MailMessage DemoExpiring(Tenant t, TenantHosts hosts, int daysLeft, MailOptions mail)
    {
        var ar = Arabic(t);
        return Build(DemoExpiringName, t, t.OwnerEmail, mail,
            Pick(ar, $"{Name(t)}: {Days(ar, daysLeft)} left on your demo", $"{Name(t)}: فاضل {Days(ar, daysLeft)} على الديمو"),
            [
                Pick(ar, $"Your demo of {Name(t)} stops in {Days(ar, daysLeft)}. Everything you set up stays for a week after that.", $"الديمو بتاع {Name(t)} هيقف بعد {Days(ar, daysLeft)}. كل اللي ظبطته هيفضل أسبوع بعدها."),
                Pick(ar, "Reply to this mail to keep it going, or to move onto a plan.", "رد على الإيميل ده عشان نمدّه، أو تنقل على باقة."),
            ],
            (Pick(ar, "Open the admin app", "افتح تطبيق الإدارة"), hosts.AdminUrl),
            replyTo: mail.OpsTo);
    }

    public static MailMessage DemoStopped(Tenant t, TenantHosts hosts, int graceDays, MailOptions mail)
    {
        var ar = Arabic(t);
        return Build(DemoStoppedName, t, t.OwnerEmail, mail,
            Pick(ar, $"{Name(t)}: your demo has stopped", $"{Name(t)}: الديمو وقف"),
            [
                Pick(ar, $"The demo of {Name(t)} has reached its end and is paused. Nothing is lost yet: it is kept for {Days(ar, graceDays)}.", $"الديمو بتاع {Name(t)} خلص وقته واتوقف. لسه مفيش حاجة ضاعت: محفوظ {Days(ar, graceDays)}."),
                Pick(ar, "Reply to this mail to bring it back or to move onto a plan.", "رد على الإيميل ده عشان نرجّعه أو تنقل على باقة."),
            ],
            null,
            replyTo: mail.OpsTo);
    }

    public static MailMessage DemoDestroyedSoon(Tenant t, TenantHosts hosts, int daysLeft, MailOptions mail)
    {
        var ar = Arabic(t);
        return Build(DemoDestroyedSoonName, t, t.OwnerEmail, mail,
            Pick(ar, $"{Name(t)}: the demo is deleted in {Days(ar, daysLeft)}", $"{Name(t)}: الديمو هيتمسح بعد {Days(ar, daysLeft)}"),
            [
                Pick(ar, $"The stopped demo of {Name(t)} and everything in it will be deleted in {Days(ar, daysLeft)}.", $"الديمو المتوقف بتاع {Name(t)} وكل اللي فيه هيتمسح بعد {Days(ar, daysLeft)}."),
                Pick(ar, "Reply to this mail before then to keep it.", "رد على الإيميل ده قبلها عشان نحتفظ بيه."),
            ],
            null,
            replyTo: mail.OpsTo);
    }

    public static MailMessage SubscriptionPastDue(Tenant t, TenantHosts hosts, DateTimeOffset graceEnds, MailOptions mail)
    {
        var ar = Arabic(t);
        return Build(SubscriptionPastDueName, t, t.OwnerEmail, mail,
            Pick(ar, $"{Name(t)}: payment due", $"{Name(t)}: في دفعة مستحقة"),
            [
                Pick(ar, $"The subscription of {Name(t)} has run past its paid period. Everything keeps working until {Date(ar, graceEnds)}.", $"اشتراك {Name(t)} عدّى المدة المدفوعة. كل حاجة هتفضل شغّالة لحد {Date(ar, graceEnds)}."),
                Pick(ar, "Reply to this mail to settle it, or if a payment is already on its way.", "رد على الإيميل ده عشان تسدد، أو لو الدفعة في الطريق."),
            ],
            (Pick(ar, "Open the admin app", "افتح تطبيق الإدارة"), hosts.AdminUrl),
            replyTo: mail.OpsTo);
    }

    public static MailMessage SubscriptionSuspended(Tenant t, TenantHosts hosts, MailOptions mail)
    {
        var ar = Arabic(t);
        return Build(SubscriptionSuspendedName, t, t.OwnerEmail, mail,
            Pick(ar, $"{Name(t)} is paused", $"{Name(t)} اتوقف"),
            [
                Pick(ar, $"{Name(t)} is paused: the menu, the till and the admin app are off until the subscription is settled. Nothing is lost.", $"{Name(t)} متوقف: المنيو والكاشير وتطبيق الإدارة واقفين لحد ما الاشتراك يتسدد. مفيش حاجة ضاعت."),
                Pick(ar, "Reply to this mail to settle it and everything comes back within minutes.", "رد على الإيميل ده عشان تسدد وكل حاجة هترجع في دقايق."),
            ],
            null,
            replyTo: mail.OpsTo);
    }

    public static MailMessage PaymentReceived(Tenant t, decimal amount, string currency, DateTimeOffset periodEnd, string? reference, MailOptions mail)
    {
        var ar = Arabic(t);
        var money = $"{amount.ToString("0.##", CultureInfo.InvariantCulture)} {currency}";
        return Build(PaymentReceivedName, t, t.OwnerEmail, mail,
            Pick(ar, $"{Name(t)}: payment received", $"{Name(t)}: وصلتنا الدفعة"),
            [
                Pick(ar, $"Thank you. {money} received for {Name(t)}; the subscription is paid through {Date(ar, periodEnd)}.", $"شكراً. وصلنا {money} لـ {Name(t)}؛ الاشتراك مدفوع لحد {Date(ar, periodEnd)}."),
                reference is null ? null : Pick(ar, $"Reference: {reference}", $"المرجع: {reference}"),
            ],
            null);
    }

    public static MailMessage OpsProvisionFailed(Tenant t, Guid runId, string error, PlatformOptions platform)
        => Ops(OpsProvisionFailedName, t, platform, $"Stamp of {t.Slug} failed",
            [$"Provisioning {t.NameEn} ({t.Slug}) failed in run {runId}.", $"Error: {error}"],
            ("Open the tenant", $"{platform.ControlUrl.TrimEnd('/')}/t/{t.Slug}"));

    public static MailMessage OpsBackupFailed(Tenant t, string error, PlatformOptions platform)
        => Ops(OpsBackupFailedName, t, platform, $"Backup of {t.Slug} failed",
            [$"The backup of {t.NameEn} ({t.Slug}) failed.", $"Error: {error}"],
            ("Open the tenant's backups", $"{platform.ControlUrl.TrimEnd('/')}/t/{t.Slug}?tab=backups"));

    public static MailMessage OpsBackupStale(IReadOnlyList<(string Slug, DateTimeOffset? LastAt)> stale, PlatformOptions platform)
        => Ops(OpsBackupStaleName, null, platform, $"{stale.Count} tenant(s) without a recent backup",
            [
                "These running tenants have no backup from the last two days:",
                .. stale.Select(s => $"{s.Slug}: {(s.LastAt is { } at ? $"last {at:yyyy-MM-dd HH:mm} UTC" : "never")}"),
            ],
            ("Open the platform", platform.ControlUrl));

    public static MailMessage OpsDiskLow(long freeMb, int floorMb, PlatformOptions platform)
        => Ops(OpsDiskLowName, null, platform, "The tenants drive is nearly full",
            [$"{freeMb} MB are free on the tenants drive, below the {floorMb} MB floor. No backup is taken and no stack is stamped until space is freed.",
             "Old backups and archives under /opt/ninja/tenants are the usual weight; docker system prune reclaims images nobody runs."],
            ("Open the capacity view", $"{platform.ControlUrl.TrimEnd('/')}/?tab=capacity"));

    public static MailMessage OpsJobStuck(string slug, string action, int minutes, PlatformOptions platform)
        => Ops(OpsJobStuckName, null, platform, $"{action} on {slug} has run for {minutes} minutes",
            [$"The {action} job for {slug} started {minutes} minutes ago and has not finished. Nothing has been stopped: a large restore is slow, a hung docker command is not.",
             "The tenant's page shows the step it is on; the control plane log has the command."],
            ("Open the tenant", $"{platform.ControlUrl.TrimEnd('/')}/t/{slug}"));

    public static MailMessage OpsStackDown(string slug, PlatformOptions platform)
        => Ops(OpsStackDownName, null, platform, $"{slug} is down",
            [$"{slug} is Running on the record, but none of its containers are running on the box. Nothing has been changed.",
             "Start it from its page, or look at its containers and logs first."],
            ("Open the tenant", $"{platform.ControlUrl.TrimEnd('/')}/t/{slug}?tab=health"));

    public static MailMessage OpsWorkerDead(string lane, PlatformOptions platform)
        => Ops(OpsWorkerDeadName, null, platform, $"The {lane} lane has stopped",
            [$"The {lane} worker has not gone round for minutes; jobs in that lane are not running. Restart the control plane: every job on the line survives a restart."],
            ("Open the queue", $"{platform.ControlUrl.TrimEnd('/')}/?tab=queue"));

    // ---------- the frame ----------

    private static MailMessage Build(string template, Tenant t, string to, MailOptions mail, string title, IEnumerable<string?> paragraphs, (string Label, string Url)? cta, string? replyTo = null)
    {
        var (html, text) = Layout(Arabic(t) ? "ar" : "en", title, paragraphs.Where(p => p is not null).Select(p => p!).ToList(), cta, mail.FromName);
        return new MailMessage(to, title, html, text, template, t.Slug, string.IsNullOrWhiteSpace(replyTo) ? null : replyTo);
    }

    private static MailMessage Ops(string template, Tenant? t, PlatformOptions platform, string title, IReadOnlyList<string> paragraphs, (string Label, string Url)? cta)
    {
        var (html, text) = Layout("en", title, paragraphs, cta, platform.Mail.FromName);
        return new MailMessage(platform.Mail.OpsTo ?? "", title, html, text, template, t?.Slug);
    }

    /// <summary>One table, inline styles, the platform's mark as text; every value encoded on the way into the HTML.</summary>
    internal static (string Html, string Text) Layout(string lang, string title, IReadOnlyList<string> paragraphs, (string Label, string Url)? cta, string brand)
    {
        var rtl = lang == "ar";
        var html = new StringBuilder();
        html.Append($"<!doctype html><html lang=\"{lang}\" dir=\"{(rtl ? "rtl" : "ltr")}\"><head><meta charset=\"utf-8\"><title>{E(title)}</title></head>");
        html.Append("<body style=\"margin:0;padding:24px;background:#f4f4f5;font-family:Inter,Segoe UI,Arial,sans-serif;color:#18181b\">");
        html.Append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr><td align=\"center\">");
        html.Append("<table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:480px;background:#ffffff;border-radius:12px;padding:32px\">");
        html.Append($"<tr><td style=\"padding-bottom:16px\"><span style=\"display:inline-block;width:28px;height:28px;line-height:28px;border-radius:7px;background:#18181b;color:#fff;font-weight:700;text-align:center\">N</span> <strong style=\"vertical-align:top;line-height:28px\">{E(brand)}</strong></td></tr>");
        html.Append($"<tr><td style=\"font-size:20px;font-weight:600;padding-bottom:12px\">{E(title)}</td></tr>");
        foreach (var p in paragraphs)
            html.Append($"<tr><td style=\"font-size:15px;line-height:1.5;padding-bottom:12px\">{E(p)}</td></tr>");
        if (cta is { } c)
            html.Append($"<tr><td style=\"padding-top:8px\"><a href=\"{E(c.Url)}\" style=\"display:inline-block;padding:10px 18px;border-radius:8px;background:#18181b;color:#fff;text-decoration:none;font-weight:600\">{E(c.Label)}</a></td></tr>");
        html.Append("</table></td></tr></table></body></html>");

        var text = new StringBuilder();
        text.AppendLine(title);
        text.AppendLine();
        foreach (var p in paragraphs) { text.AppendLine(p); text.AppendLine(); }
        if (cta is { } link) text.AppendLine($"{link.Label}: {link.Url}");
        return (html.ToString(), text.ToString().TrimEnd());
    }

    private static bool Arabic(Tenant t) => t.DefaultLanguage == "ar";

    private static string Name(Tenant t) => Arabic(t) && !string.IsNullOrEmpty(t.NameAr) ? t.NameAr : t.NameEn;

    private static string Pick(bool ar, string en, string arabic) => ar ? arabic : en;

    private static string Days(bool ar, int n) => ar
        ? n switch { 1 => "يوم", 2 => "يومين", <= 10 => $"{n} أيام", _ => $"{n} يوم" }
        : n == 1 ? "1 day" : $"{n} days";

    private static string Date(bool ar, DateTimeOffset d) => d.ToString("d MMMM yyyy", ar ? Egypt : CultureInfo.InvariantCulture);

    /// <summary>Arabic month names when the runtime has ICU; the invariant names otherwise, rather than no mail.</summary>
    private static readonly CultureInfo Egypt = Culture("ar-EG");

    private static CultureInfo Culture(string name)
    {
        try { return CultureInfo.GetCultureInfo(name); }
        catch (CultureNotFoundException) { return CultureInfo.InvariantCulture; }
    }

    private static string E(string s) => WebUtility.HtmlEncode(s);
}
