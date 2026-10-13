#nullable enable
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Ninja.Catalog.API.Application;

namespace Ninja.Catalog.API;

/// <summary>
/// The till's look at another branch's menu before it sends a phone delivery
/// there: what each line of the cart costs at that branch now, and what it ran
/// out of. Priced exactly as the order will be checked when it arrives
/// (<see cref="BranchMenu"/>), so an order sent at these prices goes through.
/// </summary>
public static class PriceCheckApi
{
    /// <summary>More lines than any cart has: a request past it is not a cart.</summary>
    public const int MaxLines = 200;

    public static RouteGroupBuilder MapPriceCheckApi(this RouteGroupBuilder api)
    {
        // The branch is in the body, not the route: a cashier asks about a branch
        // they do not work at, which branch access would refuse on a route value.
        // Nothing is changed, and nothing is shown that the branch's menu does not
        api.MapPost("/price-check", CheckPrices)
            .WithName("CheckBranchPrices")
            .WithSummary("Price a cart at another branch")
            .WithDescription("For each line, what it costs at the branch now (its own price and offer, the options' adjustments), whether the item is on there or sold out, which chosen options it ran out of, and whether the price differs from the one sent. The same pricing the order's check uses (Pos)")
            .WithTags("Items")
            .RequireAuthorization("Pos");

        return api;
    }

    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    public static async Task<Results<Ok<PriceCheckResponse>, BadRequest<ProblemDetails>>> CheckPrices(
        CatalogContext context,
        PriceCheckRequest request)
    {
        if (request.BranchId <= 0)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "Say which branch to price the cart at." });
        if (request.Lines is not { Count: > 0 and <= MaxLines } lines)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"Send between 1 and {MaxLines} lines." });

        var menu = await BranchMenu.LoadAsync(context, request.BranchId, lines.Select(l => l.ItemId));
        var now = TenantClock.Now;

        return TypedResults.Ok(new PriceCheckResponse(request.BranchId, [.. lines.Select(l => Check(menu, l, now))]));
    }

    /// <summary>One line, priced at the branch as its order would be.</summary>
    public static PriceCheckResult Check(BranchMenu menu, PriceCheckLine line, DateTime local)
    {
        var at = menu.Price(line.ItemId, line.OptionIds, local);
        return new PriceCheckResult(
            line.ItemId,
            at.Price,
            at.BasePrice,
            at.Available,
            at.OutOfStock,
            [.. at.SoldOutOptionIds],
            at.CanBeSold && BranchMenu.Differs(at.Price, line.UnitPrice),
            at.CanBeSold && !BranchMenu.CostsMore(at.Price, line.UnitPrice));
    }
}

/// <param name="BranchId">The branch to price the cart at: any of the business's.</param>
public record PriceCheckRequest(int BranchId, List<PriceCheckLine>? Lines);

/// <param name="OptionIds">The chosen options, as the order sends them.</param>
/// <param name="UnitPrice">What the line costs on the till now, options in: the price the order would carry.</param>
public record PriceCheckLine(int ItemId, List<int>? OptionIds, decimal UnitPrice);

/// <param name="Lines">One answer per line sent, in the same order.</param>
public record PriceCheckResponse(int BranchId, List<PriceCheckResult> Lines);

/// <param name="Price">What the line costs at the branch, options in.</param>
/// <param name="BasePrice">The item alone at the branch, before its options.</param>
/// <param name="Available">The item is on the menu and on at the branch.</param>
/// <param name="OutOfStock">The branch ran out of it.</param>
/// <param name="SoldOutOptionIds">The chosen options the branch cannot make.</param>
/// <param name="Changed">It can be sold there, at a price that differs from the one sent.</param>
/// <param name="WouldPass">An order carrying the sent price would go through there: sellable, and not priced higher than sent.</param>
public record PriceCheckResult(
    int ItemId,
    decimal Price,
    decimal BasePrice,
    bool Available,
    bool OutOfStock,
    List<int> SoldOutOptionIds,
    bool Changed,
    bool WouldPass);
