using System.Net;
using Ninja.Finance.Domain.AggregatesModel.ExpenseAggregate;
using Ninja.Finance.Domain.AggregatesModel.PartnerAggregate;
using Ninja.Finance.Domain.AggregatesModel.SupplierAggregate;
using Ninja.Testing;

namespace Ninja.Finance.FunctionalTests;

/// <summary>What the apps read off the wire; named here so a change in the API's shape fails a test.</summary>
public record SupplierListView(int Id, string Name, string? Phone, string? Notes, bool IsActive, decimal Balance);
public record SupplierLedgerView(int SupplierId, decimal Balance, List<SupplierEntryView> Entries);
public record SupplierEntryView(int Id, int SupplierId, int BranchId, SupplierEntryType Type, decimal Amount, decimal Signed, DateOnly Date, string? Note, string? Reference, FinanceSource Source, string RecordedBy);
public record PartnerShareView(int BranchId, decimal Percent);
public record PartnerListView(int Id, string Name, string? Phone, string? UserId, List<int> BranchIds, List<PartnerShareView> Shares, bool IsActive, decimal Balance);
public record PartnerLedgerView(int PartnerId, decimal Balance, List<PartnerEntryView> Entries);
public record PartnerEntryView(int Id, int PartnerId, int BranchId, PartnerEntryType Type, decimal Amount, decimal Signed, DateOnly Date, string? Note, string? Reference, FinanceSource Source, string RecordedBy);
public record TillPickView(int Id, string Name);
public record TillSupplierView(int Id, string Name, decimal Balance);

/// <summary>
/// The two accounts a café keeps outside the drawer: what it owes the
/// people it buys from, and what it holds of its partners' money. Both are
/// per branch, and the partners' side is the owner's alone.
/// </summary>
[TestClass]
public sealed class AccountScenarios
{
    private const string March = "2026-03";

    private static async Task<int> ASupplierAsync(Caller books, string name)
    {
        var created = await books.PostAsync<CreatedView>(Suite.Url("/suppliers"), new { name, phone = "0100 000 0000", notes = (string?)null });
        return created.Id;
    }

    private static async Task<int> APartnerAsync(Caller owner, string name, int branch, decimal percent)
    {
        var created = await owner.PostAsync<CreatedView>(Suite.Url("/partners"), new
        {
            name,
            phone = (string?)null,
            userId = (string?)null,
            shares = new[] { new { branchId = branch, percent } },
        });
        return created.Id;
    }

    [TestMethod]
    public async Task A_supplier_is_owed_what_was_delivered_less_what_was_paid()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var roastery = await ASupplierAsync(books, $"The roastery {branch}");

        await books.PostAsync<CreatedView>(Suite.Url($"/suppliers/{roastery}/ledger"), new
        {
            type = (int)SupplierEntryType.Invoice, amount = 1000m, date = $"{March}-02", note = "Two sacks",
        });
        await books.PostAsync<CreatedView>(Suite.Url($"/suppliers/{roastery}/ledger"), new
        {
            type = (int)SupplierEntryType.Payment, amount = 400m, date = $"{March}-09", note = "On account",
        });
        await books.PostAsync<CreatedView>(Suite.Url($"/suppliers/{roastery}/ledger"), new
        {
            type = (int)SupplierEntryType.Credit, amount = 100m, date = $"{March}-10", note = "A sack came back wet",
        });

        var ledger = await books.GetAsync<SupplierLedgerView>(Suite.Url($"/suppliers/{roastery}/ledger"));
        Assert.AreEqual(500m, ledger.Balance, "a thousand delivered, four hundred paid, a hundred credited");
        Assert.AreEqual(3, ledger.Entries.Count);
        Assert.AreEqual($"{March}-10", ledger.Entries.First().Date.ToString("yyyy-MM-dd"), "newest first");

        var invoice = ledger.Entries.Single(e => e.Type == SupplierEntryType.Invoice);
        Assert.AreEqual(1000m, invoice.Amount, "a line is always a positive amount");
        Assert.AreEqual(1000m, invoice.Signed, "and its type says which way it goes");
        Assert.AreEqual(-400m, ledger.Entries.Single(e => e.Type == SupplierEntryType.Payment).Signed);
        Assert.AreEqual(FinanceSource.Manual, invoice.Source, "keyed in, not from a delivery or the till");
        Assert.AreEqual(branch, invoice.BranchId);

        var onTheList = (await books.GetAsync<List<SupplierListView>>(Suite.Url("/suppliers"))).Single(s => s.Id == roastery);
        Assert.AreEqual(500m, onTheList.Balance, "the list says what is owed without opening the account");

        // The account is the branch's own
        var elsewhere = await Suite.BackOfficeAt(Suite.NewBranch()).GetAsync<SupplierLedgerView>(Suite.Url($"/suppliers/{roastery}/ledger"));
        Assert.AreEqual(0m, elsewhere.Balance, "another branch owes this supplier nothing yet");
        Assert.IsEmpty(elsewhere.Entries);
    }

    [TestMethod]
    public async Task A_partner_puts_money_in_and_takes_money_out()
    {
        var branch = Suite.NewBranch();
        var owner = Suite.OwnerAt(branch);
        var hany = await APartnerAsync(owner, $"Hany {branch}", branch, 60m);

        await owner.PostAsync<CreatedView>(Suite.Url($"/partners/{hany}/ledger"), new
        {
            type = (int)PartnerEntryType.Contribution, amount = 5000m, date = $"{March}-01", note = "For the new grinder",
        });
        await owner.PostAsync<CreatedView>(Suite.Url($"/partners/{hany}/ledger"), new
        {
            type = (int)PartnerEntryType.Drawing, amount = 2000m, date = $"{March}-20", note = "Taken on the 20th",
        });

        var ledger = await owner.GetAsync<PartnerLedgerView>(Suite.Url($"/partners/{hany}/ledger"));
        Assert.AreEqual(3000m, ledger.Balance, "five thousand in, two out: the café holds three");
        Assert.AreEqual(5000m, ledger.Entries.Single(e => e.Type == PartnerEntryType.Contribution).Signed);
        Assert.AreEqual(-2000m, ledger.Entries.Single(e => e.Type == PartnerEntryType.Drawing).Signed);

        var listed = (await owner.GetAsync<List<PartnerListView>>(Suite.Url("/partners"))).Single(p => p.Id == hany);
        Assert.AreEqual(3000m, listed.Balance);
        Assert.AreEqual(60m, listed.Shares.Single().Percent, "and the share they own of this branch");
        CollectionAssert.Contains(listed.BranchIds, branch);

        // The partners are the owners' own business
        var (byManager, _) = await Suite.BackOfficeAt(branch).RefusedAsync(HttpMethod.Get, Suite.Url("/partners"));
        Assert.AreEqual(HttpStatusCode.Forbidden, byManager, "a branch manager runs the expenses, not the partnership");

        var (byTill, _) = await Suite.TillAt(branch).RefusedAsync(HttpMethod.Post, Suite.Url($"/partners/{hany}/ledger"), new
        {
            type = (int)PartnerEntryType.Drawing, amount = 10m, date = $"{March}-21",
        });
        Assert.AreEqual(HttpStatusCode.Forbidden, byTill);

        // What the till may see of them: the name, to put on a pay-out
        var picks = await Suite.TillAt(branch).GetAsync<List<TillPickView>>($"/api/finance/till/partners?{Suite.Version}");
        Assert.AreEqual($"Hany {branch}", picks.Single(p => p.Id == hany).Name);
    }

    [TestMethod]
    public async Task A_bill_a_partner_paid_from_their_own_pocket_is_money_they_put_in()
    {
        var branch = Suite.NewBranch();
        var owner = Suite.OwnerAt(branch);
        var books = Suite.BackOfficeAt(branch);
        var samia = await APartnerAsync(owner, $"Samia {branch}", branch, 40m);
        var rent = (await books.GetAsync<List<CategoryView>>(Suite.Url("/categories"))).First(c => c.Name.En == "Rent").Id;

        var expense = await books.PostAsync<CreatedView>(Suite.Url("/expenses"), new
        {
            date = $"{March}-03", categoryId = rent, amount = 5000m, paidFrom = (int)PaidFrom.Partner, partnerId = samia,
            vendor = "The landlord",
        });

        var ledger = await owner.GetAsync<PartnerLedgerView>(Suite.Url($"/partners/{samia}/ledger"));
        Assert.AreEqual(5000m, ledger.Balance, "the rent she paid is money the café owes her");
        var entry = ledger.Entries.Single();
        Assert.AreEqual(PartnerEntryType.Contribution, entry.Type);
        Assert.AreEqual($"expense:{expense.Id}", entry.Reference, "and it is the expense that put it there");

        var (voided, detail) = await books.RefusedAsync(HttpMethod.Post, Suite.Url($"/expenses/{expense.Id}/void"), new { reason = "The landlord was paid twice" });
        Assert.AreEqual(HttpStatusCode.OK, voided, detail);

        var after = await owner.GetAsync<PartnerLedgerView>(Suite.Url($"/partners/{samia}/ledger"));
        Assert.AreEqual(0m, after.Balance, "voiding the bill takes the credit back off her account");
        Assert.AreEqual(PartnerEntryType.Drawing, after.Entries.First().Type);

        // A partner of another café is not one here
        var stranger = await APartnerAsync(owner, $"Stranger {branch}", Suite.NewBranch(), 10m);
        var (notHere, why) = await books.RefusedAsync(HttpMethod.Post, Suite.Url("/expenses"), new
        {
            date = $"{March}-04", categoryId = rent, amount = 100m, paidFrom = (int)PaidFrom.Partner, partnerId = stranger,
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, notHere);
        Assert.Contains("not a partner at this branch", why);
    }

    [TestMethod]
    public async Task Who_the_cafe_buys_from_is_edited_switched_off_and_refused_when_it_is_nobody()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var grocer = await ASupplierAsync(books, $"The grocer {branch}");

        await books.PostAsync<CreatedView>(Suite.Url($"/suppliers/{grocer}/ledger"), new
        {
            type = (int)SupplierEntryType.Invoice, amount = 250m, date = $"{March}-06",
        });

        var renamed = await books.PostAsync<CreatedView>(Suite.Url("/suppliers"), new
        {
            id = grocer, name = $"The corner grocer {branch}", phone = "0100 111 1111", notes = "Milk on Mondays", isActive = false,
        });
        Assert.AreEqual(grocer, renamed.Id, "the same supplier, edited");

        Assert.IsFalse((await books.GetAsync<List<SupplierListView>>(Suite.Url("/suppliers"))).Any(s => s.Id == grocer),
            "one switched off is off the list");
        var kept = (await books.GetAsync<List<SupplierListView>>(Suite.Url("/suppliers") + "&includeInactive=true")).Single(s => s.Id == grocer);
        Assert.AreEqual(250m, kept.Balance, "but what is owed them does not go away");
        Assert.AreEqual("Milk on Mondays", kept.Notes);

        Assert.IsFalse((await Suite.TillAt(branch).GetAsync<List<TillSupplierView>>($"/api/finance/till/suppliers?{Suite.Version}")).Any(s => s.Id == grocer),
            "and the till does not offer to pay someone the café no longer buys from");

        var (noName, _) = await books.RefusedAsync(HttpMethod.Post, Suite.Url("/suppliers"), new { name = "  " });
        Assert.AreEqual(HttpStatusCode.BadRequest, noName);

        var (nothing, _) = await books.RefusedAsync(HttpMethod.Post, Suite.Url($"/suppliers/{grocer}/ledger"), new
        {
            type = (int)SupplierEntryType.Payment, amount = 0m, date = $"{March}-07",
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, nothing, "a line on an account is always some money");

        var (nobody, _) = await books.RefusedAsync(HttpMethod.Get, Suite.Url("/suppliers/999999/ledger"));
        Assert.AreEqual(HttpStatusCode.NotFound, nobody, "an account nobody keeps is not found");
    }
}
