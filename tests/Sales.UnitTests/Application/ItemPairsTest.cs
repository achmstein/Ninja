using Ninja.Sales.API.Application.Queries;

namespace Ninja.Sales.UnitTests.Application;

/// <summary>What an item is bought with, which the pairing suggester weighs over its own guesses.</summary>
[TestClass]
public class ItemPairsTest
{
    private const int Latte = 1, Croissant = 2, Waffle = 3, Water = 4;

    [TestMethod]
    public void Counts_tickets_not_lines_and_only_those_with_the_item()
    {
        int?[][] tickets =
        [
            [Latte, Croissant, Croissant],
            [Latte, Latte, Waffle, Croissant],
            [Latte, null],
            [Croissant, Waffle],
        ];

        var report = ItemPairs.Count(Latte, tickets);

        Assert.AreEqual(3, report.TicketsWithItem);
        CollectionAssert.AreEqual(new[] { Croissant, Waffle }, report.Pairs.Select(p => p.CatalogItemId).ToArray());
        Assert.AreEqual(2, report.Pairs[0].Together);
        Assert.AreEqual(0.667m, report.Pairs[0].Share);
    }

    [TestMethod]
    public void An_item_never_sold_has_no_pairs()
    {
        var report = ItemPairs.Count(Water, new int?[][] { [Latte, Croissant] });

        Assert.AreEqual(0, report.TicketsWithItem);
        Assert.IsEmpty(report.Pairs);
    }

    [TestMethod]
    public void Names_at_most_the_top_fifteen()
    {
        var ticket = new int?[] { Latte }.Concat(Enumerable.Range(100, 30).Select(i => (int?)i)).ToArray();

        Assert.HasCount(ItemPairs.MaxPairs, ItemPairs.Count(Latte, [ticket]).Pairs);
    }
}
