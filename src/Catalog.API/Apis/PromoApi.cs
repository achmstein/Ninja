using System.ComponentModel;
using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Chillax.Catalog.API;

/// <summary>
/// Promo codes: the cart's quote, and the admin's list. Redemption is not an
/// endpoint — it happens when the order passes the item check, so the code
/// can never be spent without an order behind it.
/// </summary>
public static class PromoApi
{
    /// <summary>The header the customer web app sends for a device without an account.</summary>
    private const string GuestHeader = "X-Guest-Id";

    public static RouteGroupBuilder MapPromoApi(this RouteGroupBuilder api)
    {
        api.MapGet("/promos/quote", QuotePromo)
            .WithName("QuotePromo")
            .WithSummary("What a promo code is worth against a cart")
            .WithDescription("Checks a code against the items subtotal for the caller (the signed-in customer, or the guest device named by X-Guest-Id) and returns the discount it would give, or why it gives none. Nothing is redeemed: the order redeems the code when it is placed.")
            .WithTags("Promos");

        api.MapGet("/promos", ListPromos)
            .WithName("ListPromos")
            .WithSummary("Every promo code, newest first (Admin only)")
            .WithTags("Promos")
            .RequireAuthorization("Admin");

        api.MapPost("/promos", CreatePromo)
            .WithName("CreatePromo")
            .WithSummary("Create a promo code (Admin only)")
            .WithTags("Promos")
            .RequireAuthorization("Admin");

        api.MapPut("/promos/{id:int}", UpdatePromo)
            .WithName("UpdatePromo")
            .WithSummary("Change a promo code's rules (Admin only)")
            .WithTags("Promos")
            .RequireAuthorization("Admin");

        api.MapPatch("/promos/{id:int}/active", SetPromoActive)
            .WithName("SetPromoActive")
            .WithSummary("Switch a promo code on or off (Admin only)")
            .WithTags("Promos")
            .RequireAuthorization("Admin");

        api.MapDelete("/promos/{id:int}", DeletePromo)
            .WithName("DeletePromo")
            .WithSummary("Delete a promo code; the orders that used it keep their discount (Admin only)")
            .WithTags("Promos")
            .RequireAuthorization("Admin");

        return api;
    }

    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    public static async Task<Results<Ok<PromoQuote>, BadRequest<ProblemDetails>>> QuotePromo(
        CatalogContext context,
        ClaimsPrincipal user,
        HttpContext httpContext,
        [Description("The code as typed")] string code,
        [Description("The cart's items subtotal")] decimal subtotal)
    {
        var normalized = PromoCode.Normalize(code);
        if (!PromoCode.IsWellFormed(normalized))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "That is not a promo code." });

        var promo = await context.PromoCodes.AsNoTracking().FirstOrDefaultAsync(p => p.Code == normalized);
        if (promo is null)
            return TypedResults.Ok(PromoQuote.Refused(normalized, PromoRefusal.NotFound));

        var customerKey = user.GetUserId() ?? httpContext.Request.Headers[GuestHeader].FirstOrDefault();
        var used = !string.IsNullOrEmpty(customerKey)
            && await context.PromoRedemptions.AnyAsync(r => r.Code == normalized && r.CustomerKey == customerKey);

        return TypedResults.Ok(promo.Evaluate(subtotal, used, DateTime.UtcNow));
    }

    public static async Task<Ok<List<PromoCodeDto>>> ListPromos(CatalogContext context)
    {
        var promos = await context.PromoCodes.AsNoTracking()
            .OrderByDescending(p => p.Id)
            .Select(p => p.ToDto())
            .ToListAsync();

        return TypedResults.Ok(promos);
    }

    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    public static async Task<Results<Created<PromoCodeDto>, BadRequest<ProblemDetails>>> CreatePromo(
        CatalogContext context,
        PromoCodeRequest request)
    {
        if (Validate(request) is { } error)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = error });

        var code = PromoCode.Normalize(request.Code);
        if (await context.PromoCodes.AnyAsync(p => p.Code == code))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "That code already exists." });

        var promo = new PromoCode { Code = code };
        request.ApplyTo(promo);
        context.PromoCodes.Add(promo);
        await context.SaveChangesAsync();

        return TypedResults.Created($"/api/catalog/promos/{promo.Id}", promo.ToDto());
    }

    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    public static async Task<Results<Ok<PromoCodeDto>, NotFound, BadRequest<ProblemDetails>>> UpdatePromo(
        CatalogContext context,
        [Description("The promo code id")] int id,
        PromoCodeRequest request)
    {
        var promo = await context.PromoCodes.FindAsync(id);
        if (promo is null)
            return TypedResults.NotFound();

        if (Validate(request) is { } error)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = error });

        var code = PromoCode.Normalize(request.Code);
        if (code != promo.Code && await context.PromoCodes.AnyAsync(p => p.Code == code))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "That code already exists." });

        // Renaming keeps the redemptions under the old text; the count on the
        // code is what gates further use, and it carries over.
        promo.Code = code;
        request.ApplyTo(promo);
        await context.SaveChangesAsync();

        return TypedResults.Ok(promo.ToDto());
    }

    public static async Task<Results<Ok<PromoCodeDto>, NotFound>> SetPromoActive(
        CatalogContext context,
        [Description("The promo code id")] int id,
        SetPromoActiveRequest request)
    {
        var promo = await context.PromoCodes.FindAsync(id);
        if (promo is null)
            return TypedResults.NotFound();

        promo.IsActive = request.IsActive;
        await context.SaveChangesAsync();

        return TypedResults.Ok(promo.ToDto());
    }

    public static async Task<Results<NoContent, NotFound>> DeletePromo(
        CatalogContext context,
        [Description("The promo code id")] int id)
    {
        var promo = await context.PromoCodes.FindAsync(id);
        if (promo is null)
            return TypedResults.NotFound();

        context.PromoCodes.Remove(promo);
        await context.SaveChangesAsync();

        return TypedResults.NoContent();
    }

    private static string? Validate(PromoCodeRequest request)
    {
        if (!PromoCode.IsWellFormed(PromoCode.Normalize(request.Code)))
            return $"A code is letters, digits and dashes, up to {PromoCode.CodeMaxLength} characters.";
        if (request.Value <= 0)
            return "The discount must be more than zero.";
        if (request.Kind == PromoKind.Percent && request.Value > 100)
            return "A percentage cannot be more than 100.";
        if (request.MinSubtotal is < 0)
            return "The minimum cannot be negative.";
        if (request.MaxUses is <= 0)
            return "The number of uses must be at least one.";
        if (request.StartsAt is { } from && request.EndsAt is { } to && to <= from)
            return "The code must end after it starts.";
        return null;
    }

    private static void ApplyTo(this PromoCodeRequest request, PromoCode promo)
    {
        promo.Kind = request.Kind;
        promo.Value = request.Value;
        promo.MinSubtotal = request.MinSubtotal;
        promo.StartsAt = request.StartsAt;
        promo.EndsAt = request.EndsAt;
        promo.MaxUses = request.MaxUses;
        promo.OncePerCustomer = request.OncePerCustomer;
        promo.IsActive = request.IsActive;
    }

    private static PromoCodeDto ToDto(this PromoCode p) => new(
        p.Id, p.Code, p.Kind, p.Value, p.MinSubtotal, p.StartsAt, p.EndsAt, p.MaxUses, p.OncePerCustomer, p.IsActive, p.Uses);
}

public record PromoCodeDto(
    int Id,
    string Code,
    PromoKind Kind,
    decimal Value,
    decimal? MinSubtotal,
    DateTime? StartsAt,
    DateTime? EndsAt,
    int? MaxUses,
    bool OncePerCustomer,
    bool IsActive,
    int Uses);

public record PromoCodeRequest(
    string Code,
    PromoKind Kind,
    decimal Value,
    decimal? MinSubtotal = null,
    DateTime? StartsAt = null,
    DateTime? EndsAt = null,
    int? MaxUses = null,
    bool OncePerCustomer = true,
    bool IsActive = true);

public record SetPromoActiveRequest(bool IsActive);
