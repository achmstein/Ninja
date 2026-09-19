namespace Ninja.Inventory.UnitTests.Domain;

using Ninja.Inventory.Domain.AggregatesModel.PurchaseAggregate;
using Ninja.Inventory.Domain.AggregatesModel.StockCountAggregate;
using Ninja.Inventory.Domain.AggregatesModel.StockItemAggregate;
using Ninja.Inventory.Domain.Exceptions;
using Ninja.Inventory.Domain.SeedWork;

[TestClass]
public class DocumentsTest
{
    [TestMethod]
    public void A_receipt_totals_its_lines_and_lists_each_item_once()
    {
        var purchase = Purchase.Receive(1, " Metro ", "INV-7", [new PurchaseLine(1, 10, 2.5m), new PurchaseLine(2, 3, 100)], "owner");

        Assert.AreEqual(325m, purchase.Total);
        Assert.AreEqual("Metro", purchase.Supplier);
        Assert.AreEqual(2, purchase.Lines.Count);

        Assert.ThrowsExactly<InventoryDomainException>(() =>
            Purchase.Receive(1, null, null, [new PurchaseLine(1, 10, 2), new PurchaseLine(1, 5, 2)], "owner"));
        Assert.ThrowsExactly<InventoryDomainException>(() => Purchase.Receive(1, null, null, [], "owner"));
        Assert.ThrowsExactly<InventoryDomainException>(() => new PurchaseLine(1, 0, 2));
        Assert.ThrowsExactly<InventoryDomainException>(() => new PurchaseLine(1, 1, -2));
    }

    [TestMethod]
    public void A_count_freezes_expected_beside_counted_and_only_differences_move_stock()
    {
        var count = StockCount.Post(1, null,
        [
            new StockCountLine(1, expected: 10, counted: 8),
            new StockCountLine(2, expected: 5, counted: 5),
            new StockCountLine(3, expected: 0, counted: 2),
        ], "owner");

        var differences = count.Differences.ToDictionary(l => l.StockItemId, l => l.Variance);

        Assert.AreEqual(2, differences.Count);
        Assert.AreEqual(-2m, differences[1], "shrinkage is negative");
        Assert.AreEqual(2m, differences[3], "unrecorded stock is positive");

        Assert.ThrowsExactly<InventoryDomainException>(() => new StockCountLine(1, 10, -1));
        Assert.ThrowsExactly<InventoryDomainException>(() =>
            StockCount.Post(1, null, [new StockCountLine(1, 1, 1), new StockCountLine(1, 1, 2)], "owner"));
    }

    [TestMethod]
    public void A_stock_item_needs_a_name_and_a_unit_and_a_sane_pack()
    {
        var item = StockItem.Create(new LocalizedText(" Milk ", " لبن "), " ml ", 1000, " bag ", autoSoldOut: false);

        Assert.AreEqual("Milk", item.Name.En);
        Assert.AreEqual("لبن", item.Name.Ar);
        Assert.AreEqual("ml", item.Unit);
        Assert.AreEqual("bag", item.PackName);
        Assert.IsTrue(item.IsActive);

        Assert.ThrowsExactly<InventoryDomainException>(() => StockItem.Create(new LocalizedText(""), "pcs", null, null, true));
        Assert.ThrowsExactly<InventoryDomainException>(() => StockItem.Create(new LocalizedText("Cups"), " ", null, null, true));
        Assert.ThrowsExactly<InventoryDomainException>(() => StockItem.Create(new LocalizedText("Cups"), "pcs", 0, "sleeve", true));
    }
}
