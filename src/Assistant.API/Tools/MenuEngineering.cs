namespace Ninja.Assistant.API.Tools;

/// <summary>
/// The menu-engineering matrix (Kasavana and Smith), the same rule the back
/// office's Menu engineering tab applies: an item is popular when its share
/// of units sold reaches 70% of an even split across the placed items, and
/// paying when its margin reaches the average margin weighted by units sold.
/// Only items with a price and every ingredient costed are placed.
/// </summary>
public static class MenuEngineering
{
    public const decimal PopularityFactor = 0.7m;

    public const string Star = "star", Plowhorse = "plowhorse", Puzzle = "puzzle", Dog = "dog";

    public static readonly string[] Classes = [Star, Plowhorse, Puzzle, Dog];

    /// <param name="Placeable">Has a price and no uncosted ingredient.</param>
    public sealed record Item(int Id, decimal Price, decimal Cost, decimal Sold, bool Placeable)
    {
        public decimal Margin => Price - Cost;
    }

    /// <param name="Class">Null when it could not be placed, or nothing placed sold.</param>
    public sealed record Placed(Item Item, decimal Mix, string? Class);

    public sealed record Matrix(IReadOnlyList<Placed> Items, decimal PopularShare, decimal AverageMargin, bool NoSales);

    public static Matrix Place(IReadOnlyList<Item> items)
    {
        var placeable = items.Where(d => d.Placeable).ToList();
        var totalSold = placeable.Sum(d => d.Sold);
        var popularShare = placeable.Count > 0 ? PopularityFactor / placeable.Count : 0;
        var averageMargin = totalSold > 0 ? placeable.Sum(d => d.Margin * d.Sold) / totalSold : 0;
        var noSales = totalSold == 0;

        var placed = items.Select(d =>
        {
            var mix = d.Placeable && totalSold > 0 ? d.Sold / totalSold : 0;
            string? cls = !d.Placeable || noSales
                ? null
                : mix >= popularShare
                    ? d.Margin >= averageMargin ? Star : Plowhorse
                    : d.Margin >= averageMargin ? Puzzle : Dog;
            return new Placed(d, mix, cls);
        }).ToList();

        return new Matrix(placed, popularShare, averageMargin, noSales);
    }
}
