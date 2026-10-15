namespace Ninja.Finance.UnitTests.Domain;

using Ninja.Finance.API.Application.IntegrationEvents.Events;
using Ninja.Finance.Domain.AggregatesModel.PartnerAggregate;
using Ninja.Finance.Domain.AggregatesModel.ProfitAggregate;
using Ninja.Finance.Domain.Exceptions;
using Ninja.Finance.Domain.Services;

[TestClass]
public class ProfitFactsTest
{
    // January: Cairo is two hours ahead of UTC, with no summer time to think about
    private static DateTime CairoJan(int day, int hour, int minute = 0) => new(2026, 1, day, hour - 2, minute, 0, DateTimeKind.Utc);

    [TestMethod]
    public void A_branch_whose_day_starts_at_five_in_the_afternoon_counts_the_morning_as_yesterday()
    {
        var five = new TimeOnly(17, 0);

        Assert.AreEqual(new DateOnly(2026, 1, 14), BusinessDay.Of(CairoJan(15, 16, 59), five), "a minute before the day turns over");
        Assert.AreEqual(new DateOnly(2026, 1, 15), BusinessDay.Of(CairoJan(15, 17, 0), five), "on the dot it is the new day");
        Assert.AreEqual(new DateOnly(2026, 1, 15), BusinessDay.Of(CairoJan(16, 2, 0), five), "the small hours are still the evening's");
        Assert.AreEqual(new DateOnly(2026, 1, 15), BusinessDay.Of(CairoJan(16, 12, 0), five), "and so is the next noon, before five");
    }

    [TestMethod]
    public void A_branch_not_heard_of_keeps_the_early_morning_cutoff()
    {
        Assert.AreEqual(new DateOnly(2026, 1, 14), BusinessDay.Of(CairoJan(15, 5, 59)));
        Assert.AreEqual(new DateOnly(2026, 1, 15), BusinessDay.Of(CairoJan(15, 6, 0)));
        Assert.AreEqual(BusinessDay.Of(CairoJan(15, 6, 0)), BusinessDay.Of(CairoJan(15, 6, 0), BusinessDay.DefaultStart));
    }

    [TestMethod]
    public void A_refund_carries_its_share_of_the_sales_vat()
    {
        var sale = new SalesFact(1, new DateOnly(2026, 3, 1), SalesFactKind.Sale, 1140m, 140m, "ticket:7", 7);
        var refund = new SalesFact(1, new DateOnly(2026, 3, 2), SalesFactKind.Refund, 114m, 0, "refund:3", 7);

        refund.TakeVatShareOf(sale);

        Assert.AreEqual(14m, refund.Vat, "a tenth of the bill went back, and a tenth of its VAT with it");
        Assert.AreEqual(0m, SalesFact.VatShare(100m, 1000m, 0m), "a sale without VAT gives none back");
        Assert.AreEqual(140m, SalesFact.VatShare(2000m, 1140m, 140m), "never more than the sale had");
        Assert.ThrowsExactly<FinanceDomainException>(() => sale.TakeVatShareOf(refund));
    }

    [TestMethod]
    public void A_payslip_over_a_months_end_is_shared_between_the_months_by_days()
    {
        // 20 March to 19 April: thirty-one days, twelve of them March's
        var fact = new LabourFact(1, 5, 42, new DateOnly(2026, 3, 20), new DateOnly(2026, 4, 19), 3100m, DateTime.UtcNow);

        Assert.AreEqual(1200m, fact.ShareOf(new DateOnly(2026, 3, 1), new DateOnly(2026, 3, 31)));
        Assert.AreEqual(1900m, fact.ShareOf(new DateOnly(2026, 4, 1), new DateOnly(2026, 4, 30)));
        Assert.AreEqual(0m, fact.ShareOf(new DateOnly(2026, 5, 1), new DateOnly(2026, 5, 31)));

        var month = new LabourFact(1, 5, 43, new DateOnly(2026, 5, 1), new DateOnly(2026, 5, 31), 3000m, DateTime.UtcNow);
        Assert.AreEqual(3000m, month.ShareOf(new DateOnly(2026, 5, 1), new DateOnly(2026, 5, 31)), "a month's own payslip is all the month's");
    }

    [TestMethod]
    public void An_older_labour_figure_arriving_late_never_replaces_a_newer_one()
    {
        var noon = new DateTime(2026, 3, 10, 12, 0, 0, DateTimeKind.Utc);
        var fact = new LabourFact(1, 5, 42, new DateOnly(2026, 3, 1), new DateOnly(2026, 3, 31), 900m, noon);

        Assert.IsFalse(fact.Set(1, new DateOnly(2026, 3, 31), 600m, noon.AddMinutes(-5)), "the figure from before is stale");
        Assert.AreEqual(900m, fact.Amount);

        Assert.IsTrue(fact.Set(1, new DateOnly(2026, 3, 31), 1000m, noon.AddMinutes(5)));
        Assert.AreEqual(1000m, fact.Amount);
    }

    [TestMethod]
    public void A_branch_keeps_the_newest_day_start_it_was_told()
    {
        var day = new BranchDayStart(3, new TimeOnly(17, 0), version: 200);

        Assert.IsFalse(day.Set(new TimeOnly(6, 0), version: 100));
        Assert.AreEqual(new TimeOnly(17, 0), day.DayStart);
        Assert.IsTrue(day.Set(new TimeOnly(5, 0), version: 300));
        Assert.AreEqual(new TimeOnly(5, 0), day.DayStart);
    }

    [TestMethod]
    public void A_branchs_partners_hold_a_hundred_percent_of_it_at_most()
    {
        var hany = Saved(new Partner("Hany", null, null, [(1, 60m), (2, 100m)]), 1);
        var gone = Saved(new Partner("Gone", null, null, [(1, 100m)]), 2);
        gone.Update("Gone", null, null, [(1, 100m)], isActive: false);
        var everyone = new[] { hany, gone };

        Partner.CheckSharesFit(null, true, [(1, 40m)], everyone);
        var over = Assert.ThrowsExactly<FinanceDomainException>(() => Partner.CheckSharesFit(null, true, [(1, 50m)], everyone));
        StringAssert.Contains(over.Message, "40%");
        Assert.ThrowsExactly<FinanceDomainException>(() => Partner.CheckSharesFit(null, true, [(2, 1m)], everyone));

        // Hany raising his own share is measured against the others, not against himself
        Partner.CheckSharesFit(hany.Id, true, [(1, 100m)], everyone);
        // Someone stepping down holds nothing
        Partner.CheckSharesFit(null, false, [(1, 100m)], everyone);
    }

    [TestMethod]
    public void The_labour_cost_is_payrolls_own_figure_or_the_earnings_from_an_older_payroll()
    {
        Assert.AreEqual(450m, new EmployeeEarningsChangedIntegrationEvent { NetEarned = 400m, LabourCost = 450m }.Cost());
        Assert.AreEqual(400m, new EmployeeEarningsChangedIntegrationEvent { NetEarned = 400m }.Cost());
    }

    private static Partner Saved(Partner partner, int id)
    {
        typeof(Partner).GetProperty(nameof(Partner.Id))!.SetValue(partner, id);
        return partner;
    }
}
