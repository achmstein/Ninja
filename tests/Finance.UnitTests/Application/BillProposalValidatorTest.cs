#nullable enable
using Chillax.Finance.API.Application.Assist;
using Chillax.Finance.API.Application.Queries;
using Chillax.Finance.Domain.SeedWork;

namespace Finance.UnitTests.Application;

[TestClass]
public class BillProposalValidatorTest
{
    private static readonly DateOnly Today = new(2026, 9, 15);

    private static readonly List<ExpenseCategoryView> Categories =
    [
        new(1, new LocalizedText("Rent", "إيجار"), 1, true),
        new(2, new LocalizedText("Electricity", "كهرباء"), 2, true),
        new(3, new LocalizedText("Maintenance", "صيانة"), 3, true),
    ];

    private static readonly List<string> Vendors = ["North Cairo Electricity", "شركة الغاز", "Vodafone"];

    private static BillExtraction Bill(
        string date = "2026-09-10", decimal amount = 842.5m, int categoryId = 2, double confidence = 0.9,
        string vendor = "North Cairo Electricity", string note = "August, meter 12345", string currency = "EGP", string notes = "")
        => new(date, amount, categoryId, confidence, vendor, note, currency, notes);

    [TestMethod]
    public void A_clean_bill_passes_through_with_no_warnings()
    {
        var proposal = BillProposalValidator.Validate(Bill(), Categories, Vendors, Today);

        Assert.AreEqual("2026-09-10", proposal.Date);
        Assert.AreEqual(842.5m, proposal.Amount);
        Assert.AreEqual(2, proposal.CategoryId);
        Assert.AreEqual(0.9, proposal.CategoryConfidence);
        Assert.AreEqual("North Cairo Electricity", proposal.Vendor);
        Assert.AreEqual("August, meter 12345", proposal.Note);
        Assert.AreEqual("EGP", proposal.Currency);
        Assert.IsNull(proposal.Notes);
        Assert.IsEmpty(proposal.Warnings);
    }

    [TestMethod]
    public void A_vendor_spelled_differently_takes_the_spelling_on_file()
    {
        var proposal = BillProposalValidator.Validate(Bill(vendor: "  north  cairo ELECTRICITY "), Categories, Vendors, Today);
        Assert.AreEqual("North Cairo Electricity", proposal.Vendor);

        var arabic = BillProposalValidator.Validate(Bill(vendor: "شركة الغاز"), Categories, Vendors, Today);
        Assert.AreEqual("شركة الغاز", arabic.Vendor);

        var withMarks = BillProposalValidator.Validate(Bill(vendor: "شَرِكه الغاز"), Categories, Vendors, Today);
        Assert.AreEqual("شركة الغاز", withMarks.Vendor, "diacritics and ta marbuta fold to the spelling on file");
    }

    [TestMethod]
    public void A_vendor_nobody_recorded_before_stays_as_printed()
    {
        var proposal = BillProposalValidator.Validate(Bill(vendor: "Ahmed's Plumbing"), Categories, Vendors, Today);
        Assert.AreEqual("Ahmed's Plumbing", proposal.Vendor);
        Assert.IsEmpty(proposal.Warnings);
    }

    [TestMethod]
    public void A_missing_or_unreadable_date_is_left_for_the_user()
    {
        var missing = BillProposalValidator.Validate(Bill(date: ""), Categories, Vendors, Today);
        Assert.IsNull(missing.Date);
        CollectionAssert.Contains(missing.Warnings.ToList(), "No date could be read; check it.");

        var garbled = BillProposalValidator.Validate(Bill(date: "10/9/26"), Categories, Vendors, Today);
        Assert.IsNull(garbled.Date);
        Assert.IsTrue(garbled.Warnings.Any(w => w.Contains("10/9/26")), string.Join("; ", garbled.Warnings));
    }

    [TestMethod]
    public void A_date_after_today_is_dropped_and_an_old_one_is_flagged()
    {
        var future = BillProposalValidator.Validate(Bill(date: "2026-09-16"), Categories, Vendors, Today);
        Assert.IsNull(future.Date);
        Assert.IsTrue(future.Warnings.Any(w => w.Contains("after today")), string.Join("; ", future.Warnings));

        var old = BillProposalValidator.Validate(Bill(date: "2023-01-05"), Categories, Vendors, Today);
        Assert.AreEqual("2023-01-05", old.Date, "kept: the year may be right");
        Assert.IsTrue(old.Warnings.Any(w => w.Contains("more than two years ago")), string.Join("; ", old.Warnings));

        var today = BillProposalValidator.Validate(Bill(date: "2026-09-15"), Categories, Vendors, Today);
        Assert.AreEqual("2026-09-15", today.Date);
        Assert.IsEmpty(today.Warnings);
    }

    [TestMethod]
    public void An_amount_that_could_not_be_read_or_is_absurd_is_warned_about()
    {
        var none = BillProposalValidator.Validate(Bill(amount: 0), Categories, Vendors, Today);
        Assert.IsNull(none.Amount);
        CollectionAssert.Contains(none.Warnings.ToList(), "No amount could be read; enter it.");

        var negative = BillProposalValidator.Validate(Bill(amount: -5), Categories, Vendors, Today);
        Assert.IsNull(negative.Amount);

        var huge = BillProposalValidator.Validate(Bill(amount: 2_500_000), Categories, Vendors, Today);
        Assert.AreEqual(2_500_000m, huge.Amount, "kept: it may be real");
        Assert.IsTrue(huge.Warnings.Any(w => w.Contains("2500000.00")), string.Join("; ", huge.Warnings));

        var rounded = BillProposalValidator.Validate(Bill(amount: 12.345m), Categories, Vendors, Today);
        Assert.AreEqual(12.35m, rounded.Amount);
    }

    [TestMethod]
    public void The_category_must_be_on_the_list_and_a_guess_is_flagged()
    {
        var unknown = BillProposalValidator.Validate(Bill(categoryId: 99), Categories, Vendors, Today);
        Assert.IsNull(unknown.CategoryId);
        Assert.AreEqual(0, unknown.CategoryConfidence);
        CollectionAssert.Contains(unknown.Warnings.ToList(), "The assistant picked a category that does not exist; pick one.");

        var none = BillProposalValidator.Validate(Bill(categoryId: 0, confidence: 0), Categories, Vendors, Today);
        Assert.IsNull(none.CategoryId);
        CollectionAssert.Contains(none.Warnings.ToList(), "No category fitted the bill; pick one.");

        var guess = BillProposalValidator.Validate(Bill(categoryId: 3, confidence: 0.3), Categories, Vendors, Today);
        Assert.AreEqual(3, guess.CategoryId);
        Assert.AreEqual(0.3, guess.CategoryConfidence);
        CollectionAssert.Contains(guess.Warnings.ToList(), "The category \"Maintenance\" is a guess; check it.");

        var wild = BillProposalValidator.Validate(Bill(confidence: double.NaN), Categories, Vendors, Today);
        Assert.AreEqual(2, wild.CategoryId);
        Assert.AreEqual(0, wild.CategoryConfidence, "a confidence that is not a number counts as none");
    }

    [TestMethod]
    public void Text_is_cleaned_capped_and_emptied_to_null()
    {
        var proposal = BillProposalValidator.Validate(Bill(
            vendor: "  Vodafone\t\n ", note: new string('x', 600), notes: "  "), Categories, Vendors, Today);

        Assert.AreEqual("Vodafone", proposal.Vendor);
        Assert.HasCount(500, proposal.Note!);
        Assert.IsNull(proposal.Notes);

        var blank = BillProposalValidator.Validate(Bill(vendor: "", note: "", notes: "Not a bill: a photo of a cat"), Categories, Vendors, Today);
        Assert.IsNull(blank.Vendor);
        Assert.IsNull(blank.Note);
        Assert.AreEqual("Not a bill: a photo of a cat", blank.Notes);
    }

    [TestMethod]
    public void A_foreign_currency_is_flagged_and_an_empty_one_is_EGP()
    {
        var usd = BillProposalValidator.Validate(Bill(currency: "usd"), Categories, Vendors, Today);
        Assert.AreEqual("USD", usd.Currency);
        CollectionAssert.Contains(usd.Warnings.ToList(), "The bill is in USD, not EGP.");

        var none = BillProposalValidator.Validate(Bill(currency: ""), Categories, Vendors, Today);
        Assert.AreEqual("EGP", none.Currency);
        Assert.IsEmpty(none.Warnings);
    }
}
