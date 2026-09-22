using System.Net;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.FunctionalTests;

/// <summary>Billing by hand: a payment moves what is paid through, a café that does not pay is suspended, and a payment or a resume brings it back.</summary>
[TestClass]
public sealed class BillingScenarios
{
    [TestMethod]
    public async Task A_payment_extends_what_is_paid_through_and_is_kept_on_the_record()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("pay");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);
        var periodEnd = DateTimeOffset.UtcNow.AddMonths(1);

        var paid = await api.RecordPaymentAsync(slug, 1500m, periodEnd, reference: "INV-1");
        Assert.AreEqual(SubscriptionStatus.Active, paid.Status);
        Api.AssertSameInstant(periodEnd, paid.PaidThrough, "what is paid through is the period's end");
        var payment = paid.Payments.Single();
        Assert.AreEqual(1500m, payment.Amount);
        Assert.AreEqual("EGP", payment.Currency);
        Assert.AreEqual("INV-1", payment.Reference);
        Assert.AreEqual(TestAuth.UserId, payment.RecordedBy);

        // A payment for a period that ends sooner does not pull the date back
        var earlier = await api.RecordPaymentAsync(slug, 500m, periodEnd.AddDays(-10), reference: "INV-2");
        Api.AssertSameInstant(periodEnd, earlier.PaidThrough, "a shorter period does not pull the date back");
        Assert.HasCount(2, earlier.Payments);
        Assert.IsTrue((await api.AuditAsync(slug)).Count(a => a.Action == "payment.recorded") == 2);
    }

    [TestMethod]
    public async Task A_suspended_stack_comes_back_with_a_payment()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("suspend");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);

        await api.SuspendAsync(slug);
        var suspended = await api.SettledAsync(slug);
        Assert.AreEqual(TenantStatus.Suspended, suspended.Status);
        Assert.AreEqual(SubscriptionStatus.Suspended, suspended.Subscription.Status);
        Assert.IsNotNull(suspended.Subscription.SuspendedAt);

        var (status, detail) = await api.RefusedAsync(HttpMethod.Post, $"/api/control/tenants/{slug}/start");
        Assert.AreEqual(HttpStatusCode.Conflict, status);
        Assert.Contains("suspended for non-payment", detail, "a plain start does not undo a suspension");

        await api.RecordPaymentAsync(slug, 1500m, DateTimeOffset.UtcNow.AddMonths(1));
        var back = await api.SettledAsync(slug);
        Assert.AreEqual(TenantStatus.Running, back.Status, back.LastError);
        Assert.AreEqual(SubscriptionStatus.Active, back.Subscription.Status);
        Assert.IsNull(back.Subscription.SuspendedAt);
        var audit = await api.AuditAsync(slug);
        Assert.IsTrue(audit.Any(a => a.Action == "tenant.resume"));
    }

    [TestMethod]
    public async Task A_resume_brings_a_suspended_stack_back_unpaid_until_the_sweep_looks_again()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("resume");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);
        await api.SuspendAsync(slug);
        await api.SettledAsync(slug);

        await api.ResumeAsync(slug);
        var back = await api.SettledAsync(slug);

        Assert.AreEqual(TenantStatus.Running, back.Status, back.LastError);
        Assert.AreEqual(SubscriptionStatus.Active, back.Subscription.Status);
        Assert.IsNull(back.Subscription.PaidThrough, "nothing was paid; the sweep may suspend it again");

        var (status, _) = await api.RefusedAsync(HttpMethod.Post, $"/api/control/tenants/{slug}/subscription/resume");
        Assert.AreEqual(HttpStatusCode.Conflict, status, "a running stack has nothing to resume");
    }

    [TestMethod]
    public async Task The_grace_days_are_the_tenants_own_or_the_platforms()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("grace");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);

        Assert.AreEqual(7, (await api.SubscriptionAsync(slug)).GraceDays, "the platform's default");
        var own = await api.SetSubscriptionAsync(slug, TenantPlan.Starter, [], graceDays: 30);
        Assert.AreEqual(30, own.GraceDays);
        await api.SettledAsync(slug);

        var (status, detail) = await api.RefusedAsync(HttpMethod.Post, $"/api/control/tenants/{slug}/subscription/payments", new { amount = 0, currency = "EGP", periodEnd = DateTimeOffset.UtcNow.AddMonths(1) });
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("more than zero", detail);

        (status, detail) = await api.RefusedAsync(HttpMethod.Post, $"/api/control/tenants/{slug}/subscription/payments", new { amount = 10, currency = "pounds", periodEnd = DateTimeOffset.UtcNow.AddMonths(1) });
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("ISO 4217", detail);
    }

    [TestMethod]
    public async Task The_sweep_tells_a_customer_past_its_period_and_suspends_past_its_grace()
    {
        // The decision the nightly sweep makes, on the rules the API's own records carry
        var today = new DateOnly(2026, 9, 20);
        static Tenant Paid(int daysAgo, SubscriptionStatus status = SubscriptionStatus.Active, TenantStatus stack = TenantStatus.Running)
            => new() { Kind = TenantKind.Customer, Status = stack, Subscription = status, PaidThrough = new DateTimeOffset(2026, 9, 20, 12, 0, 0, TimeSpan.Zero).AddDays(-daysAgo) };

        Assert.AreEqual(SweepDecision.None, SubscriptionSweep.Decide(Paid(0), today, 7));
        Assert.AreEqual(SweepDecision.PastDue, SubscriptionSweep.Decide(Paid(1), today, 7));
        Assert.AreEqual(SweepDecision.None, SubscriptionSweep.Decide(Paid(7, SubscriptionStatus.PastDue), today, 7));
        Assert.AreEqual(SweepDecision.Suspend, SubscriptionSweep.Decide(Paid(8, SubscriptionStatus.PastDue), today, 7));
        Assert.AreEqual(SweepDecision.None, SubscriptionSweep.Decide(Paid(8, SubscriptionStatus.Suspended, TenantStatus.Suspended), today, 7));
    }
}
