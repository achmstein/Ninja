#nullable enable
using Chillax.Inventory.API.Application.Assist;
using Chillax.Inventory.API.Application.Queries;
using Chillax.Inventory.Domain.SeedWork;

namespace Inventory.UnitTests.Application;

[TestClass]
public class ReceiptProposalValidatorTest
{
    private static readonly List<StockItemView> Items =
    [
        new(1, new LocalizedText("Sugar", "سكر"), "g", 1000, "bag", false, true),
        new(2, new LocalizedText("Whole Milk", "لبن كامل الدسم"), "ml", 1000, "carton", false, true),
        new(3, new LocalizedText("Red Bull", "ريد بول"), "pcs", null, null, true, true),
    ];

    private static readonly ExtractedNewItem NoItem = new ExtractedNewItem("", "", "", 0, "");

    private static ReceiptExtraction Receipt(params ExtractedLine[] lines)
        => new ReceiptExtraction("Metro", "INV-7", "2026-09-14", "EGP", lines.Sum(l => l.LineTotal), lines, "");

    [TestMethod]
    public void A_clean_receipt_passes_through_with_no_warnings()
    {
        var proposal = ReceiptProposalValidator.Validate(Receipt(
            new ExtractedLine("Sugar 1kg x2", 2000, 2, 0.05m, 100, 1, 0.95, NoItem),
            new ExtractedLine("Red Bull x6", 6, 0, 30, 180, 3, 0.9, NoItem)), Items, []);

        Assert.AreEqual("Metro", proposal.Supplier);
        Assert.AreEqual("INV-7", proposal.InvoiceRef);
        Assert.AreEqual("2026-09-14", proposal.Date);
        Assert.AreEqual("EGP", proposal.Currency);
        Assert.AreEqual(280m, proposal.PrintedTotal);
        Assert.AreEqual(280m, proposal.ComputedTotal);
        Assert.IsEmpty(proposal.Warnings);
        Assert.HasCount(2, proposal.Lines);
        Assert.AreEqual(1, proposal.Lines[0].StockItemId);
        Assert.AreEqual(2000m, proposal.Lines[0].Quantity);
        Assert.AreEqual(2m, proposal.Lines[0].Packs);
        Assert.IsNull(proposal.Lines[0].NewItem);
        Assert.IsEmpty(proposal.Lines[0].Suggestions);
    }

    [TestMethod]
    public void Packs_times_pack_size_wins_over_a_wrong_quantity()
    {
        var proposal = ReceiptProposalValidator.Validate(Receipt(
            new ExtractedLine("Milk 1L x3", 3, 3, 0.02m, 60, 2, 0.9, NoItem)), Items, []);

        var line = proposal.Lines.Single();
        Assert.AreEqual(3000m, line.Quantity, "3 cartons of 1000 ml");
        Assert.AreEqual(0.02m, line.UnitCost);
        Assert.AreEqual(60m, line.LineTotal);
    }

    [TestMethod]
    public void An_unknown_id_is_dropped_and_the_line_gets_suggestions_and_a_new_item()
    {
        var proposal = ReceiptProposalValidator.Validate(Receipt(
            new ExtractedLine("سكر 1 كيلو", 1000, 1, 0.05m, 50, 99, 0.9, new ExtractedNewItem("Sugar 1 kg", "سكر", "g", 1000, "bag"))), Items, []);

        var line = proposal.Lines.Single();
        Assert.IsNull(line.StockItemId);
        Assert.AreEqual(0, line.Confidence);
        CollectionAssert.Contains(proposal.Warnings.ToList(), "line 1: the assistant picked a stock item that does not exist; matched by hand instead.");
        Assert.AreEqual(1, line.Suggestions.Single());
        Assert.AreEqual("Sugar 1 kg", line.NewItem!.Name.En);
        Assert.AreEqual("g", line.NewItem.Unit);
        Assert.AreEqual(1000m, line.NewItem.PackSize);
        Assert.AreEqual("bag", line.NewItem.PackName);
    }

    [TestMethod]
    public void A_new_item_gets_a_safe_unit_and_a_name_when_the_model_left_them_out()
    {
        var proposal = ReceiptProposalValidator.Validate(Receipt(
            new ExtractedLine("Paper cups 12oz", 50, 0, 1, 50, 0, 0, new ExtractedNewItem("", "", "box", 0, ""))), Items, []);

        var line = proposal.Lines.Single();
        Assert.AreEqual("Paper cups 12oz", line.NewItem!.Name.En);
        Assert.IsNull(line.NewItem.Name.Ar);
        Assert.AreEqual("pcs", line.NewItem.Unit);
        Assert.IsNull(line.NewItem.PackSize);
        CollectionAssert.Contains(proposal.Warnings.ToList(), "line 1: unit \"box\" is not one of pcs, g, ml, kg, l; set to pcs.");
    }

    [TestMethod]
    public void Money_is_reconciled_from_whatever_two_numbers_are_there()
    {
        var proposal = ReceiptProposalValidator.Validate(Receipt(
            new ExtractedLine("Red Bull x6", 6, 0, 0, 180, 3, 0.9, NoItem),
            new ExtractedLine("Red Bull x2", 2, 0, 30, 0, 3, 0.9, NoItem),
            new ExtractedLine("Red Bull x4", 4, 0, 30, 100, 3, 0.9, NoItem)), Items, []);

        Assert.AreEqual(30m, proposal.Lines[0].UnitCost, "cost from the total");
        Assert.AreEqual(60m, proposal.Lines[1].LineTotal, "total from the cost");
        Assert.AreEqual(25m, proposal.Lines[2].UnitCost, "the printed total wins over qty × cost");
        Assert.AreEqual(100m, proposal.Lines[2].LineTotal);
        Assert.IsTrue(proposal.Warnings.Any(w => w.StartsWith("line 3:") && w.Contains("priced by the printed total")), string.Join("; ", proposal.Warnings));
    }

    [TestMethod]
    public void Missing_quantity_or_price_is_a_warning_not_a_guess()
    {
        var proposal = ReceiptProposalValidator.Validate(Receipt(
            new ExtractedLine("Sugar", 0, 0, 0, 0, 1, 0.9, NoItem)), Items, []);

        var line = proposal.Lines.Single();
        Assert.AreEqual(0m, line.Quantity);
        Assert.AreEqual(0m, line.UnitCost);
        Assert.IsLessThanOrEqualTo(0.4, line.Confidence);
        Assert.IsTrue(proposal.Warnings.Any(w => w.Contains("no quantity")));
        Assert.IsTrue(proposal.Warnings.Any(w => w.Contains("no price")));
    }

    [TestMethod]
    public void Totals_currency_and_date_are_checked()
    {
        var extraction = new ReceiptExtraction("", "", "14/09/2026", "usd", 999,
            [new ExtractedLine("Red Bull x6", 6, 0, 30, 180, 3, 0.4, NoItem)], "The bottom is cut off");

        var proposal = ReceiptProposalValidator.Validate(extraction, Items, ["only 500 offered"]);

        Assert.IsNull(proposal.Supplier);
        Assert.IsNull(proposal.InvoiceRef);
        Assert.IsNull(proposal.Date);
        Assert.AreEqual("USD", proposal.Currency);
        Assert.AreEqual(999m, proposal.PrintedTotal);
        Assert.AreEqual(180m, proposal.ComputedTotal);
        Assert.AreEqual("The bottom is cut off", proposal.Notes);
        Assert.AreEqual("only 500 offered", proposal.Warnings[0]);
        Assert.IsTrue(proposal.Warnings.Any(w => w.Contains("add up to 180.00")));
        Assert.IsTrue(proposal.Warnings.Any(w => w.Contains("USD")));
        Assert.IsTrue(proposal.Warnings.Any(w => w.Contains("14/09/2026")));
        Assert.IsTrue(proposal.Warnings.Any(w => w.Contains("is a guess")));
    }

    [TestMethod]
    public void Empty_lines_are_skipped_and_an_empty_receipt_says_so()
    {
        var proposal = ReceiptProposalValidator.Validate(Receipt(new ExtractedLine("", 0, 0, 0, 0, 0, 0, NoItem)), Items, []);

        Assert.IsEmpty(proposal.Lines);
        CollectionAssert.Contains(proposal.Warnings.ToList(), "No purchasable lines were found on the receipt.");
    }
}
