namespace Ninja.Finance.UnitTests.Domain;

using Ninja.Finance.Domain.AggregatesModel.ExpenseAggregate;
using Ninja.Finance.Domain.AggregatesModel.PartnerAggregate;
using Ninja.Finance.Domain.AggregatesModel.SupplierAggregate;
using Ninja.Finance.Domain.Exceptions;
using Ninja.Finance.Domain.SeedWork;

[TestClass]
public class FinanceDomainTest
{
    [TestMethod]
    public void An_expense_needs_a_category_a_positive_amount_and_a_partner_when_paid_from_their_pocket()
    {
        var rent = new Expense(1, new DateOnly(2026, 9, 1), 3, 5000, PaidFrom.Bank, null, "Landlord", null, "owner");
        Assert.AreEqual(5000m, rent.Amount);
        Assert.IsNull(rent.PartnerId);

        var paidByPartner = new Expense(1, new DateOnly(2026, 9, 2), 3, 200, PaidFrom.Partner, 7, null, "plumber", "owner");
        Assert.AreEqual(7, paidByPartner.PartnerId);

        // A partner named on drawer money is ignored: it was the café's cash
        var fromDrawer = new Expense(1, new DateOnly(2026, 9, 2), 3, 200, PaidFrom.Drawer, 7, null, null, "till");
        Assert.IsNull(fromDrawer.PartnerId);

        Assert.ThrowsExactly<FinanceDomainException>(() => new Expense(1, new DateOnly(2026, 9, 1), 0, 100, PaidFrom.Drawer, null, null, null, "x"));
        Assert.ThrowsExactly<FinanceDomainException>(() => new Expense(1, new DateOnly(2026, 9, 1), 3, 0, PaidFrom.Drawer, null, null, null, "x"));
        Assert.ThrowsExactly<FinanceDomainException>(() => new Expense(1, new DateOnly(2026, 9, 1), 3, 100, PaidFrom.Partner, null, null, null, "x"));

        rent.Void("wrong month", "owner");
        Assert.IsTrue(rent.IsVoided);
        Assert.ThrowsExactly<FinanceDomainException>(() => rent.Void("again", "owner"));
    }

    [TestMethod]
    public void A_suppliers_balance_rises_with_invoices_and_falls_with_payments_and_credits()
    {
        var lines = new[]
        {
            new SupplierEntry(1, 1, SupplierEntryType.Invoice, 1000, new DateOnly(2026, 9, 1), "delivery", "sys", FinanceSource.Purchase, "purchase:1"),
            new SupplierEntry(1, 1, SupplierEntryType.Payment, 600, new DateOnly(2026, 9, 5), null, "till", FinanceSource.Till, "shift:1:movement:2"),
            new SupplierEntry(1, 1, SupplierEntryType.Credit, 50, new DateOnly(2026, 9, 6), "returned crate", "owner"),
        };

        Assert.AreEqual(350m, lines.Sum(l => l.Signed));
        Assert.ThrowsExactly<FinanceDomainException>(() => new SupplierEntry(1, 1, SupplierEntryType.Payment, 0, new DateOnly(2026, 9, 5), null, "x"));
    }

    [TestMethod]
    public void A_partner_owns_branches_and_their_balance_is_contributions_less_drawings()
    {
        var partner = new Partner("Ahmed", null, null, [(2, 50m), (1, 100m), (1, 100m)]);
        CollectionAssert.AreEqual(new[] { 1, 2 }, partner.BranchIds.ToList());
        Assert.IsTrue(partner.Owns(2));
        Assert.IsFalse(partner.Owns(3));
        Assert.AreEqual(50m, partner.ShareAt(2));
        Assert.AreEqual(0m, partner.ShareAt(3));

        var lines = new[]
        {
            new PartnerEntry(1, 1, PartnerEntryType.Contribution, 10000, new DateOnly(2026, 9, 1), "capital", "owner"),
            new PartnerEntry(1, 1, PartnerEntryType.Drawing, 1500, new DateOnly(2026, 9, 10), null, "till", FinanceSource.Till, "shift:3:movement:4"),
        };
        Assert.AreEqual(8500m, lines.Sum(l => l.Signed));

        Assert.ThrowsExactly<FinanceDomainException>(() => new Partner(" ", null, null, [(1, 100m)]));
        Assert.ThrowsExactly<FinanceDomainException>(() => new Partner("Ahmed", null, null, []));
        Assert.ThrowsExactly<FinanceDomainException>(() => new Partner("Ahmed", null, null, [(1, 120m)]));
    }

    [TestMethod]
    public void A_category_needs_a_name_in_some_language()
    {
        Assert.ThrowsExactly<FinanceDomainException>(() => new ExpenseCategory(new LocalizedText("", null), 0));
        Assert.AreEqual("إيجار", new ExpenseCategory(new LocalizedText("Rent", "إيجار"), 0).Name.Ar);
    }
}
