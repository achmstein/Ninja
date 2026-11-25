#nullable enable
using Microsoft.AspNetCore.Http.HttpResults;
using Ninja.Sales.Infrastructure;
using Ninja.Sales.Infrastructure.Projections;

namespace Ninja.Sales.API.Apis;

/// <summary>
/// The money between the business and its courier companies, for the admin's Couriers page: what
/// each company's couriers collected for the business, what it charged, what was settled between
/// them, and so what is owed. Business-wide: a company carries for every branch and pays the
/// business as one.
/// </summary>
public static class CouriersApi
{
    public const int MaxPageSize = 100;

    public static RouteGroupBuilder MapCouriersApi(this IEndpointRouteBuilder app)
    {
        var api = app.NewVersionedApi("Couriers")
            .MapGroup("api/sales/couriers")
            .HasApiVersion(1.0)
            .RequireAuthorization("Admin");

        api.MapGet("/balances", GetBalancesAsync)
            .WithName("GetCourierBalances")
            .WithSummary("What each courier company owes the business, or is owed (admin)")
            .WithDescription("Per company: what its couriers collected, its fees, what was settled either way, and the balance (collected less fees less settled; positive, the company owes the business). With the deliveries whose bills are still open because the courier collected short.");

        api.MapGet("/{providerId:int}/jobs", GetJobsAsync)
            .WithName("GetCourierJobs")
            .WithSummary("A courier company's deliveries, newest first, a page at a time (admin)")
            .WithDescription("Each with its branch, what was collected, the fee and what became of the bill.");

        api.MapGet("/{providerId:int}/payouts", GetPayoutsAsync)
            .WithName("GetCourierPayouts")
            .WithSummary("Money settled with a courier company, newest first (admin)");

        api.MapPost("/{providerId:int}/payouts", AddPayoutAsync)
            .WithName("AddCourierPayout")
            .WithSummary("Record money settled with a courier company (admin)")
            .WithDescription("Positive: the company paid the business what its couriers collected. Negative: the business paid the company (fees beyond what it collected).");

        return api;
    }

    public static async Task<Ok<List<CourierBalanceView>>> GetBalancesAsync(SalesContext context)
    {
        var jobs = await context.CourierJobs.AsNoTracking()
            .GroupBy(j => j.ProviderId)
            .Select(g => new
            {
                ProviderId = g.Key,
                Collected = g.Sum(j => j.Collected),
                Fees = g.Sum(j => j.Fee),
                Deliveries = g.Count(),
                Short = g.Count(j => j.Outcome == CourierJobOutcome.Short),
                Last = g.Max(j => j.At),
            })
            .ToListAsync();
        var payouts = await context.CourierPayouts.AsNoTracking()
            .GroupBy(p => p.ProviderId)
            .Select(g => new { ProviderId = g.Key, Settled = g.Sum(p => p.Amount) })
            .ToDictionaryAsync(p => p.ProviderId, p => p.Settled);
        // The name each company was last carried or paid under
        var names = (await context.CourierJobs.AsNoTracking().OrderBy(j => j.At).Select(j => new { j.ProviderId, j.Provider }).ToListAsync())
            .Concat(await context.CourierPayouts.AsNoTracking().OrderBy(p => p.RecordedAt).Select(p => new { p.ProviderId, p.Provider }).ToListAsync())
            .GroupBy(n => n.ProviderId)
            .ToDictionary(g => g.Key, g => g.Last().Provider);

        var ids = jobs.Select(j => j.ProviderId).Union(payouts.Keys);
        var rows = ids.Select(id =>
        {
            var job = jobs.FirstOrDefault(j => j.ProviderId == id);
            var collected = job?.Collected ?? 0;
            var fees = job?.Fees ?? 0;
            var settled = payouts.GetValueOrDefault(id);
            return new CourierBalanceView(id, names.GetValueOrDefault(id) ?? $"#{id}", job?.Deliveries ?? 0, collected, fees, settled,
                collected - fees - settled, job?.Short ?? 0, job?.Last);
        })
            .OrderByDescending(r => Math.Abs(r.Balance))
            .ThenBy(r => r.Provider)
            .ToList();
        return TypedResults.Ok(rows);
    }

    public static async Task<Ok<CourierJobsPage>> GetJobsAsync(int providerId, SalesContext context, int pageIndex = 0, int pageSize = 25)
    {
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        pageIndex = Math.Max(0, pageIndex);
        var query = context.CourierJobs.AsNoTracking().Where(j => j.ProviderId == providerId);
        var total = await query.CountAsync();
        var rows = await query.OrderByDescending(j => j.At)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .Select(j => new CourierJobView(j.OrderId, j.BranchId, j.Collected, j.Fee, j.BillTotal, j.Outcome.ToString(), j.TicketId, j.At))
            .ToListAsync();
        return TypedResults.Ok(new CourierJobsPage(rows, total, pageIndex, pageSize));
    }

    public static async Task<Ok<List<CourierPayoutView>>> GetPayoutsAsync(int providerId, SalesContext context)
    {
        var rows = await context.CourierPayouts.AsNoTracking()
            .Where(p => p.ProviderId == providerId)
            .OrderByDescending(p => p.PaidOn)
            .ThenByDescending(p => p.Id)
            .Take(200)
            .Select(p => new CourierPayoutView(p.Id, p.Amount, p.PaidOn, p.Note, p.RecordedBy, p.RecordedAt))
            .ToListAsync();
        return TypedResults.Ok(rows);
    }

    public static async Task<Results<Ok<CourierPayoutView>, BadRequest<string>>> AddPayoutAsync(
        int providerId, CourierPayoutRequest request, SalesContext context, HttpContext httpContext, TimeProvider time)
    {
        if (request.Amount == 0)
            return TypedResults.BadRequest("Say how much was settled.");
        if (string.IsNullOrWhiteSpace(request.Provider) || request.Provider.Trim().Length > 100)
            return TypedResults.BadRequest("Name the courier company.");
        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        if (note is { Length: > 300 })
            return TypedResults.BadRequest("The note is longer than 300 characters.");

        var now = time.GetUtcNow().UtcDateTime;
        var payout = context.CourierPayouts.Add(new CourierPayout
        {
            ProviderId = providerId,
            Provider = request.Provider.Trim(),
            Amount = request.Amount,
            PaidOn = request.PaidOn ?? DateOnly.FromDateTime(now),
            Note = note,
            RecordedBy = httpContext.GetActor(),
            RecordedAt = now,
        }).Entity;
        await context.SaveChangesAsync();
        return TypedResults.Ok(new CourierPayoutView(payout.Id, payout.Amount, payout.PaidOn, payout.Note, payout.RecordedBy, payout.RecordedAt));
    }
}

/// <param name="Balance">Collected less fees less settled: positive, the company owes the business; negative, the business owes the company.</param>
/// <param name="ShortDeliveries">Deliveries whose courier collected less than the bill: their bills wait open at the till.</param>
public record CourierBalanceView(int ProviderId, string Provider, int Deliveries, decimal Collected, decimal Fees, decimal Settled,
    decimal Balance, int ShortDeliveries, DateTime? LastDeliveryAt);

/// <param name="Outcome">Pending, Settled, Short, AlreadySettled or Failed.</param>
public record CourierJobView(int OrderId, int BranchId, decimal Collected, decimal Fee, decimal? BillTotal, string Outcome, int? TicketId, DateTime At);

public record CourierJobsPage(List<CourierJobView> Items, int Total, int PageIndex, int PageSize);

public record CourierPayoutView(int Id, decimal Amount, DateOnly PaidOn, string? Note, string RecordedBy, DateTime RecordedAt);

/// <param name="Amount">Positive: the company paid the business. Negative: the business paid the company.</param>
/// <param name="Provider">The company's name, as the admin's list shows it.</param>
/// <param name="PaidOn">The day the money changed hands; today when left out.</param>
public record CourierPayoutRequest(decimal Amount, string Provider, DateOnly? PaidOn = null, string? Note = null);
