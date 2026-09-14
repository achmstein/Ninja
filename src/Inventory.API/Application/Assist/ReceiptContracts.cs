namespace Chillax.Inventory.API.Application.Assist;

/// <summary>
/// What the assistant proposes from a receipt photo. Nothing is posted:
/// the user reviews every line, creates the new items they agree with and
/// then receives the purchase the usual way.
/// </summary>
/// <param name="Supplier">The supplier name as printed on the receipt, if legible.</param>
/// <param name="InvoiceRef">Invoice or receipt number as printed.</param>
/// <param name="Date">Receipt date as ISO yyyy-MM-dd when it could be read.</param>
/// <param name="Currency">ISO code; EGP unless the receipt says otherwise.</param>
/// <param name="PrintedTotal">The grand total printed on the receipt, if any.</param>
/// <param name="ComputedTotal">The sum of the proposed line totals.</param>
/// <param name="Lines">Every purchasable line, top to bottom.</param>
/// <param name="Warnings">What to look at before accepting ("line 3: …").</param>
/// <param name="Notes">The assistant's own remark, when it had one.</param>
public sealed record ReceiptProposal(
    string? Supplier,
    string? InvoiceRef,
    string? Date,
    string Currency,
    decimal? PrintedTotal,
    decimal ComputedTotal,
    IReadOnlyList<ProposedLine> Lines,
    IReadOnlyList<string> Warnings,
    string? Notes);

/// <param name="Index">Position on the receipt, from 1.</param>
/// <param name="RawText">The line as printed, for the user to compare against.</param>
/// <param name="Quantity">In the matched item's base unit (grams, millilitres, pieces).</param>
/// <param name="Packs">How many packs the receipt shows, when the item is bought by the pack.</param>
/// <param name="UnitCost">Per base unit.</param>
/// <param name="LineTotal">Quantity × unit cost, reconciled with the printed total.</param>
/// <param name="StockItemId">The existing stock item this line is for, when the assistant was confident.</param>
/// <param name="Confidence">0–1: how sure the assistant is of the match (0 when unmatched).</param>
/// <param name="Suggestions">Stock item ids that look similar, best first, for the picker.</param>
/// <param name="NewItem">What to create when nothing on the shelf matches.</param>
public sealed record ProposedLine(
    int Index,
    string RawText,
    decimal Quantity,
    decimal? Packs,
    decimal UnitCost,
    decimal LineTotal,
    int? StockItemId,
    double Confidence,
    IReadOnlyList<int> Suggestions,
    ProposedNewItem? NewItem);

/// <param name="Name">English and Arabic, both filled in.</param>
/// <param name="Unit">pcs, g, ml, kg or l.</param>
/// <param name="PackSize">Base units per pack when bought by the pack (a 1.5 l bottle of water: 1500 ml).</param>
/// <param name="PackName">What the pack is called ("bottle", "bag", "carton").</param>
public sealed record ProposedNewItem(LocalizedText Name, string Unit, decimal? PackSize, string? PackName);

// What the model answers. Every field is required and nothing is nullable
// so the JSON schema stays plain enough for every provider; "" and 0 mean
// "none" and the validator turns them into nulls.

public sealed record ReceiptExtraction(
    string Supplier,
    string InvoiceRef,
    string Date,
    string Currency,
    decimal PrintedTotal,
    IReadOnlyList<ExtractedLine> Lines,
    string Notes);

public sealed record ExtractedLine(
    string RawText,
    decimal Quantity,
    decimal Packs,
    decimal UnitCost,
    decimal LineTotal,
    int StockItemId,
    double Confidence,
    ExtractedNewItem NewItem);

public sealed record ExtractedNewItem(string NameEn, string NameAr, string Unit, decimal PackSize, string PackName);

/// <summary>The text part of the prompt: which branch, which day, and what is already on the shelf.</summary>
internal sealed record ReceiptPrompt(int BranchId, string Today, IReadOnlyList<CandidateItem> Candidates);

internal sealed record CandidateItem(int Id, string En, string Ar, string Unit, decimal PackSize, string PackName);
