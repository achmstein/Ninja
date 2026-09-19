#nullable enable
namespace Ninja.Finance.API.Application.Assist;

/// <summary>
/// What the assistant proposes from the photo of a bill. Nothing is
/// recorded: the expense form takes these as suggestions for the fields
/// the user has not typed, and the user saves.
/// </summary>
/// <param name="Date">The bill's date as ISO yyyy-MM-dd when it could be read.</param>
/// <param name="Amount">The amount to pay, when it could be read.</param>
/// <param name="CategoryId">The expense category the bill falls under, from the list; null when the assistant was not sure.</param>
/// <param name="CategoryConfidence">0–1: how sure the assistant is of the category (0 when none).</param>
/// <param name="Vendor">Who the bill is from, spelled the way earlier expenses spell it when it matched one.</param>
/// <param name="Note">What the bill is for, in a few words: the period, the account or invoice number.</param>
/// <param name="Currency">ISO code; EGP unless the bill says otherwise.</param>
/// <param name="Warnings">What to look at before saving.</param>
/// <param name="Notes">The assistant's own remark, when it had one.</param>
public sealed record BillProposal(
    string? Date,
    decimal? Amount,
    int? CategoryId,
    double CategoryConfidence,
    string? Vendor,
    string? Note,
    string Currency,
    IReadOnlyList<string> Warnings,
    string? Notes);

// What the model answers. Every field is required and nothing is nullable
// so the JSON schema stays plain enough for every provider; "" and 0 mean
// "none" and the validator turns them into nulls.

public sealed record BillExtraction(
    string Date,
    decimal Amount,
    int CategoryId,
    double CategoryConfidence,
    string Vendor,
    string Note,
    string Currency,
    string Notes);

/// <summary>The text part of the prompt: which day it is, the categories to pick from, and the vendors already on file.</summary>
internal sealed record BillPrompt(string Today, IReadOnlyList<CategoryCandidate> Categories, IReadOnlyList<string> Vendors);

internal sealed record CategoryCandidate(int Id, string En, string Ar);
