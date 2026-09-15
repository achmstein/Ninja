using System.Globalization;
using Chillax.AI.Json;
using Chillax.Inventory.API.Application.Queries;

namespace Chillax.Inventory.API.Application.Assist;

/// <summary>
/// Turns what the model read into a proposal the review sheet can trust:
/// ids are checked against the shelf, quantities are recomputed from
/// packs, money is reconciled, and every doubt becomes a warning on the
/// line it belongs to. Pure, so it is easy to test against odd answers.
/// </summary>
public static class ReceiptProposalValidator
{
    public static readonly IReadOnlySet<string> Units = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "pcs", "g", "ml", "kg", "l" };

    private const decimal MoneyTolerance = 0.05m;

    /// <summary>A unit cost this far from the last receipt's is worth a look before it moves the average.</summary>
    public const decimal PriceChangeThreshold = 0.10m;

    public static ReceiptProposal Validate(ReceiptExtraction extraction, IReadOnlyList<StockItemView> candidates, IReadOnlyList<string> extraWarnings,
        IReadOnlyDictionary<int, decimal>? lastCosts = null)
    {
        var byId = candidates.ToDictionary(c => c.Id);
        var warnings = new List<string>(extraWarnings);
        var lines = new List<ProposedLine>();
        var index = 0;

        foreach (var raw in extraction.Lines ?? [])
        {
            var rawText = AIJson.Clean(raw.RawText, 200);
            if (rawText.Length == 0 && raw.Quantity == 0 && raw.LineTotal == 0)
                continue; // an empty line is noise, not a warning

            index++;
            var tag = $"line {index}";
            var confidence = Math.Clamp(double.IsFinite(raw.Confidence) ? raw.Confidence : 0, 0, 1);

            // The match: only an id that is on the shelf counts
            StockItemView? item = null;
            if (raw.StockItemId > 0)
            {
                if (byId.TryGetValue(raw.StockItemId, out var found))
                    item = found;
                else
                    warnings.Add($"{tag}: the assistant picked a stock item that does not exist; matched by hand instead.");
            }

            if (item is null)
                confidence = 0;
            else if (confidence < 0.5)
                warnings.Add($"{tag}: the match to \"{item.Name.En}\" is a guess; check it.");

            // Quantity: packs win when the item is bought by the pack
            var quantity = Round(raw.Quantity, 3);
            decimal? packs = raw.Packs > 0 ? Round(raw.Packs, 3) : null;
            if (packs is { } p && item?.PackSize is { } itemPackSize && itemPackSize > 0)
            {
                var fromPacks = Round(p * itemPackSize, 3);
                if (quantity <= 0 || Math.Abs(fromPacks - quantity) > 0.001m)
                    quantity = fromPacks;
            }

            if (quantity <= 0)
            {
                warnings.Add($"{tag}: no quantity could be read; enter it.");
                quantity = 0;
                confidence = Math.Min(confidence, 0.4);
            }

            // Money: a negative or missing cost comes from the total
            var unitCost = raw.UnitCost < 0 ? 0 : Round(raw.UnitCost, 4);
            var lineTotal = raw.LineTotal < 0 ? 0 : Round(raw.LineTotal, 2);
            if (unitCost == 0 && lineTotal > 0 && quantity > 0)
                unitCost = Round(lineTotal / quantity, 4);
            else if (lineTotal == 0 && unitCost > 0 && quantity > 0)
                lineTotal = Round(unitCost * quantity, 2);
            else if (quantity > 0 && unitCost > 0 && lineTotal > 0)
            {
                var expected = Round(unitCost * quantity, 2);
                var tolerance = Math.Max(MoneyTolerance, lineTotal * 0.01m);
                if (Math.Abs(expected - lineTotal) > tolerance)
                {
                    warnings.Add($"{tag}: {quantity:0.###} × {unitCost:0.####} is {expected:0.00}, not {lineTotal:0.00}; priced by the printed total.");
                    unitCost = Round(lineTotal / quantity, 4);
                }
            }

            if (lineTotal == 0 && unitCost == 0)
                warnings.Add($"{tag}: no price could be read; enter it.");

            // A matched item that costs noticeably more or less than last time
            if (item is not null && unitCost > 0 && lastCosts is not null
                && lastCosts.TryGetValue(item.Id, out var last) && last > 0)
            {
                var change = (unitCost - last) / last;
                if (Math.Abs(change) >= PriceChangeThreshold)
                    warnings.Add($"{tag}: \"{item.Name.En}\" is {unitCost:0.####} per {item.Unit}, {(change > 0 ? "up" : "down")} {Math.Abs(change) * 100:0}% from {last:0.####} last time.");
            }

            // A new item only when nothing matched
            ProposedNewItem? newItem = null;
            if (item is null)
            {
                var nameEn = AIJson.Clean(raw.NewItem?.NameEn, 120);
                var nameAr = AIJson.Clean(raw.NewItem?.NameAr, 120);
                if (nameEn.Length == 0)
                    nameEn = rawText.Length > 0 ? rawText : $"Receipt line {index}";

                var unit = AIJson.Clean(raw.NewItem?.Unit, 10).ToLowerInvariant();
                if (!Units.Contains(unit))
                {
                    if (unit.Length > 0)
                        warnings.Add($"{tag}: unit \"{unit}\" is not one of pcs, g, ml, kg, l; set to pcs.");
                    unit = "pcs";
                }

                decimal? packSize = raw.NewItem is { PackSize: > 0 } ? Round(raw.NewItem.PackSize, 3) : null;
                var packName = AIJson.Clean(raw.NewItem?.PackName, 40);
                newItem = new ProposedNewItem(new LocalizedText(nameEn, nameAr.Length == 0 ? null : nameAr), unit, packSize, packName.Length == 0 ? null : packName);
            }

            var suggestions = item is null ? StockItemMatcher.Suggest(rawText, candidates) : [];

            lines.Add(new ProposedLine(index, rawText, quantity, packs, unitCost, lineTotal, item?.Id, Round(confidence, 2), suggestions, newItem));
        }

        if (lines.Count == 0)
            warnings.Add("No purchasable lines were found on the receipt.");

        var computedTotal = Round(lines.Sum(l => l.LineTotal), 2);
        decimal? printedTotal = extraction.PrintedTotal > 0 ? Round(extraction.PrintedTotal, 2) : null;
        if (printedTotal is { } printed && Math.Abs(printed - computedTotal) > Math.Max(MoneyTolerance, printed * 0.01m))
            warnings.Add($"The lines add up to {computedTotal:0.00} but the receipt says {printed:0.00}.");

        var currency = AIJson.Clean(extraction.Currency, 3).ToUpperInvariant();
        if (currency.Length == 0)
            currency = "EGP";
        else if (currency != "EGP")
            warnings.Add($"The receipt is in {currency}, not EGP.");

        string? date = null;
        var rawDate = AIJson.Clean(extraction.Date, 20);
        if (rawDate.Length > 0)
        {
            if (DateOnly.TryParseExact(rawDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
                date = parsed.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            else
                warnings.Add($"The receipt date \"{rawDate}\" could not be read as a date.");
        }

        var notes = AIJson.Clean(extraction.Notes, 300);

        return new ReceiptProposal(
            NullIfEmpty(AIJson.Clean(extraction.Supplier, 120)),
            NullIfEmpty(AIJson.Clean(extraction.InvoiceRef, 60)),
            date,
            currency,
            printedTotal,
            computedTotal,
            lines,
            warnings,
            NullIfEmpty(notes));
    }

    private static decimal Round(decimal value, int decimals) => Math.Round(value, decimals, MidpointRounding.AwayFromZero);

    private static double Round(double value, int decimals) => Math.Round(value, decimals, MidpointRounding.AwayFromZero);

    private static string? NullIfEmpty(string value) => value.Length == 0 ? null : value;
}
