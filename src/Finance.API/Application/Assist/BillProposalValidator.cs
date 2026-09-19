#nullable enable
using System.Globalization;
using Ninja.AI.Json;
using Ninja.AI.Text;
using Ninja.Finance.API.Application.Queries;

namespace Ninja.Finance.API.Application.Assist;

/// <summary>
/// Turns what the model read into a proposal the expense form can trust:
/// the category must be on the list, the date must be a day that has
/// happened, the amount positive, the vendor spelled the way earlier
/// expenses spell it, and every doubt becomes a warning. Pure, so it is
/// easy to test against odd answers.
/// </summary>
public static class BillProposalValidator
{
    /// <summary>A bill older than this is probably a misread year.</summary>
    private static readonly TimeSpan OldBill = TimeSpan.FromDays(2 * 365);

    /// <summary>A café's single expense above this is worth a second look.</summary>
    private const decimal LargeAmount = 1_000_000m;

    public static BillProposal Validate(BillExtraction extraction, IReadOnlyList<ExpenseCategoryView> categories, IReadOnlyList<string> vendors, DateOnly today)
    {
        var warnings = new List<string>();

        // Date: a day that has happened, else it is left for the user
        string? date = null;
        var rawDate = AIJson.Clean(extraction.Date, 20);
        if (rawDate.Length == 0)
        {
            warnings.Add("No date could be read; check it.");
        }
        else if (!DateOnly.TryParseExact(rawDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
        {
            warnings.Add($"The bill's date \"{rawDate}\" could not be read as a date.");
        }
        else if (parsed > today)
        {
            warnings.Add($"The bill is dated {parsed:yyyy-MM-dd}, after today; enter the date.");
        }
        else
        {
            if (today.ToDateTime(TimeOnly.MinValue) - parsed.ToDateTime(TimeOnly.MinValue) > OldBill)
                warnings.Add($"The bill is dated {parsed:yyyy-MM-dd}, more than two years ago; check the year.");
            date = parsed.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }

        // Amount: positive, or nothing
        decimal? amount = null;
        if (extraction.Amount > 0)
        {
            amount = Math.Round(extraction.Amount, 2, MidpointRounding.AwayFromZero);
            if (amount > LargeAmount)
                warnings.Add($"The amount read is {amount:0.00}; check it.");
        }
        else
        {
            warnings.Add("No amount could be read; enter it.");
        }

        // Category: only one from the list, and only when the assistant meant it
        int? categoryId = null;
        var confidence = Math.Clamp(double.IsFinite(extraction.CategoryConfidence) ? extraction.CategoryConfidence : 0, 0, 1);
        if (extraction.CategoryId > 0)
        {
            var category = categories.FirstOrDefault(c => c.Id == extraction.CategoryId);
            if (category is null)
            {
                warnings.Add("The assistant picked a category that does not exist; pick one.");
            }
            else
            {
                categoryId = category.Id;
                if (confidence < 0.5)
                    warnings.Add($"The category \"{category.Name.En}\" is a guess; check it.");
            }
        }
        else
        {
            warnings.Add("No category fitted the bill; pick one.");
        }

        if (categoryId is null)
            confidence = 0;

        // Vendor: the spelling already on file wins over the one on the bill
        var vendor = AIJson.Clean(extraction.Vendor, 200);
        if (vendor.Length > 0)
        {
            var folded = TextFolding.Fold(vendor);
            var known = vendors.FirstOrDefault(v => TextFolding.Fold(v) == folded);
            if (known is not null)
                vendor = known.Trim();
        }

        var currency = AIJson.Clean(extraction.Currency, 3).ToUpperInvariant();
        if (currency.Length == 0)
            currency = "EGP";
        else if (currency != "EGP")
            warnings.Add($"The bill is in {currency}, not EGP.");

        return new BillProposal(
            date,
            amount,
            categoryId,
            Math.Round(confidence, 2, MidpointRounding.AwayFromZero),
            NullIfEmpty(vendor),
            NullIfEmpty(AIJson.Clean(extraction.Note, 500)),
            currency,
            warnings,
            NullIfEmpty(AIJson.Clean(extraction.Notes, 300)));
    }

    private static string? NullIfEmpty(string value) => value.Length == 0 ? null : value;
}
