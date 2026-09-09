using System.ComponentModel;
using System.Security.Claims;
using Chillax.Loyalty.API.Infrastructure;
using Chillax.Loyalty.API.Model;
using Chillax.ServiceDefaults;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Chillax.Loyalty.API.Apis;

public static class LoyaltyApi
{
    /// 100 loyalty points = 1 EGP
    public const int RedemptionPointsPerUnit = 100;

    public static IEndpointRouteBuilder MapLoyaltyApi(this IEndpointRouteBuilder app)
    {
        var vApi = app.NewVersionedApi("Loyalty");
        var api = vApi.MapGroup("api/loyalty").HasApiVersion(1, 0);

        // Account endpoints
        api.MapGet("/accounts", GetAllAccounts)
            .WithName("ListAccounts")
            .WithSummary("List all loyalty accounts")
            .WithDescription("Get all loyalty accounts (Admin only)")
            .WithTags("Accounts")
            .RequireAuthorization("Admin");

        api.MapGet("/accounts/{userId}", GetAccountByUserId)
            .WithName("GetAccount")
            .WithSummary("Get loyalty account")
            .WithDescription("Get a loyalty account by user ID — the user themself, or till staff")
            .WithTags("Accounts")
            .RequireAuthorization();

        api.MapPost("/accounts", CreateAccount)
            .WithName("CreateAccount")
            .WithSummary("Create loyalty account")
            .WithDescription("Enroll a user in the program — themself, or the back office on their behalf")
            .WithTags("Accounts")
            .RequireAuthorization();

        api.MapGet("/accounts/{userId}/balance", GetBalance)
            .WithName("GetBalance")
            .WithSummary("Get points balance")
            .WithDescription("Get the current points balance for a user — the user themself, or till staff")
            .WithTags("Accounts")
            .RequireAuthorization();

        // Transaction endpoints
        api.MapGet("/transactions/{userId}", GetTransactions)
            .WithName("GetTransactions")
            .WithSummary("Get transaction history")
            .WithDescription("Get all transactions for a user — the user themself, or till staff")
            .WithTags("Transactions")
            .RequireAuthorization();

        api.MapPost("/transactions/earn", EarnPoints)
            .WithName("EarnPoints")
            .WithSummary("Earn points")
            .WithDescription("Add points to a user's account (Admin only)")
            .WithTags("Transactions")
            .RequireAuthorization("Admin");

        api.MapPost("/transactions/adjust", AdjustPoints)
            .WithName("AdjustPoints")
            .WithSummary("Adjust points")
            .WithDescription("Manual adjustment of points (Admin only)")
            .WithTags("Transactions")
            .RequireAuthorization("Admin");

        // Tier endpoints
        api.MapGet("/tiers", GetTierInfo)
            .WithName("GetTierInfo")
            .WithSummary("Get tier information")
            .WithDescription("Get loyalty tier thresholds and benefits")
            .WithTags("Tiers");

        // Points value endpoint (public)
        api.MapGet("/points-value", GetPointsValue)
            .WithName("GetPointsValue")
            .WithSummary("Get discount value for points")
            .WithDescription("Convert loyalty points to their currency discount value")
            .WithTags("Points");

        // Stats endpoints
        api.MapGet("/stats", GetStats)
            .WithName("GetStats")
            .WithSummary("Get loyalty stats")
            .WithDescription("Get loyalty program statistics (Admin only)")
            .WithTags("Stats")
            .RequireAuthorization("Admin");

        return app;
    }

    // Account endpoints
    public static async Task<Ok<List<AccountDto>>> GetAllAccounts(
        LoyaltyContext context,
        [FromQuery] int? first,
        [FromQuery] int? max)
    {
        var query = context.Accounts.OrderByDescending(a => a.LifetimePoints).AsQueryable();

        if (first.HasValue)
            query = query.Skip(first.Value);
        if (max.HasValue)
            query = query.Take(max.Value);
        else
            query = query.Take(50);

        var accounts = await query.ToListAsync();
        return TypedResults.Ok(accounts.Select(a => new AccountDto(a)).ToList());
    }

    public static async Task<Results<Ok<AccountDto>, NotFound, ForbidHttpResult>> GetAccountByUserId(
        LoyaltyContext context,
        ClaimsPrincipal user,
        [Description("The user ID")] string userId)
    {
        // A member reads their own card; the till reads the customer's in front of it
        if (!user.CanActFor(userId))
        {
            return TypedResults.Forbid();
        }

        var account = await context.Accounts.FirstOrDefaultAsync(a => a.UserId == userId);

        if (account == null)
        {
            return TypedResults.NotFound();
        }

        return TypedResults.Ok(new AccountDto(account));
    }

    public static async Task<Results<Created<AccountDto>, Conflict<ProblemDetails>, ForbidHttpResult>> CreateAccount(
        LoyaltyContext context,
        CreateAccountRequest request,
        ClaimsPrincipal user)
    {
        // Joining is the customer's own act in their app, or the back
        // office's on their behalf — never the till's: points are earned and
        // spent in the app, the till only shows them
        var isSelf = string.Equals(user.GetUserId(), request.UserId, StringComparison.Ordinal);
        var isAdmin = user.GetRoles().Contains("Admin", StringComparer.OrdinalIgnoreCase);
        if (!isSelf && !isAdmin)
        {
            return TypedResults.Forbid();
        }

        // Check if account already exists
        var existing = await context.Accounts.FirstOrDefaultAsync(a => a.UserId == request.UserId);
        if (existing != null)
        {
            return TypedResults.Conflict<ProblemDetails>(new()
            {
                Detail = "Account already exists for this user"
            });
        }

        // Joining oneself: the name is on the token. Enrolled by the back
        // office: it sends the customer's name — never the admin's own; a
        // missing one is backfilled by the profile and order events.
        var displayName = isSelf ? user.GetUserName() : request.UserDisplayName;

        var account = new LoyaltyAccount
        {
            UserId = request.UserId,
            UserDisplayName = displayName
        };

        context.Accounts.Add(account);
        await context.SaveChangesAsync();

        return TypedResults.Created($"/api/loyalty/accounts/{account.UserId}", new AccountDto(account));
    }

    public static async Task<Results<Ok<BalanceDto>, NotFound, ForbidHttpResult>> GetBalance(
        LoyaltyContext context,
        ClaimsPrincipal user,
        [Description("The user ID")] string userId)
    {
        if (!user.CanActFor(userId))
        {
            return TypedResults.Forbid();
        }

        var account = await context.Accounts.FirstOrDefaultAsync(a => a.UserId == userId);

        if (account == null)
        {
            return TypedResults.NotFound();
        }

        return TypedResults.Ok(new BalanceDto(
            account.PointsBalance,
            account.LifetimePoints,
            account.CurrentTier.ToString()
        ));
    }

    // Transaction endpoints
    public static async Task<Results<Ok<List<TransactionDto>>, NotFound, ForbidHttpResult>> GetTransactions(
        LoyaltyContext context,
        ClaimsPrincipal user,
        [Description("The user ID")] string userId,
        [FromQuery] int? first,
        [FromQuery] int? max)
    {
        if (!user.CanActFor(userId))
        {
            return TypedResults.Forbid();
        }

        var account = await context.Accounts.FirstOrDefaultAsync(a => a.UserId == userId);

        if (account == null)
        {
            return TypedResults.NotFound();
        }

        var query = context.Transactions
            .Where(t => t.AccountId == account.Id)
            .OrderByDescending(t => t.CreatedAt)
            .AsQueryable();

        if (first.HasValue)
            query = query.Skip(first.Value);
        if (max.HasValue)
            query = query.Take(max.Value);
        else
            query = query.Take(50);

        var transactions = await query.ToListAsync();
        return TypedResults.Ok(transactions.Select(t => new TransactionDto(t)).ToList());
    }

    public static async Task<Results<Ok<TransactionDto>, NotFound, BadRequest<ProblemDetails>>> EarnPoints(
        LoyaltyContext context,
        EarnPointsRequest request)
    {
        var account = await context.Accounts
            .Include(a => a.Transactions)
            .FirstOrDefaultAsync(a => a.UserId == request.UserId);

        if (account == null)
        {
            // Auto-create account if it doesn't exist
            account = new LoyaltyAccount { UserId = request.UserId, UserDisplayName = request.UserDisplayName };
            context.Accounts.Add(account);
            await context.SaveChangesAsync();
        }
        else if (request.UserDisplayName != null && account.UserDisplayName != request.UserDisplayName)
        {
            // Update display name if provided and different
            account.UserDisplayName = request.UserDisplayName;
        }

        try
        {
            if (!Enum.TryParse<TransactionType>(request.Type, true, out var transactionType))
            {
                return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"Invalid transaction type: {request.Type}" });
            }

            account.AddPoints(request.Points, transactionType, request.ReferenceId, request.Description);
            await context.SaveChangesAsync();

            var transaction = account.Transactions.OrderByDescending(t => t.CreatedAt).First();
            return TypedResults.Ok(new TransactionDto(transaction));
        }
        catch (ArgumentException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok<TransactionDto>, NotFound, BadRequest<ProblemDetails>>> AdjustPoints(
        LoyaltyContext context,
        AdjustPointsRequest request)
    {
        var account = await context.Accounts
            .Include(a => a.Transactions)
            .FirstOrDefaultAsync(a => a.UserId == request.UserId);

        if (account == null)
        {
            return TypedResults.NotFound();
        }

        var transaction = new PointsTransaction
        {
            AccountId = account.Id,
            Points = request.Points,
            Type = TransactionType.Adjustment,
            Description = request.Reason  // Only Adjustment type uses Description
        };

        account.PointsBalance += request.Points;
        if (request.Points > 0)
        {
            account.LifetimePoints += request.Points;
        }
        account.UpdatedAt = DateTime.UtcNow;

        context.Transactions.Add(transaction);
        await context.SaveChangesAsync();

        return TypedResults.Ok(new TransactionDto(transaction));
    }

    // Points value endpoint
    public static Ok<PointsValueDto> GetPointsValue([FromQuery] int points)
    {
        var discountValue = (double)points / RedemptionPointsPerUnit;
        return TypedResults.Ok(new PointsValueDto(points, discountValue, RedemptionPointsPerUnit));
    }

    // Tier endpoints
    public static Ok<TierInfoDto[]> GetTierInfo()
    {
        return TypedResults.Ok(new[]
        {
            new TierInfoDto("Bronze", 0, "Starting tier - 2% back on every order"),
            new TierInfoDto("Silver", 1000, "1.25x points (2.5% back)"),
            new TierInfoDto("Gold", 5000, "1.5x points (3% back) + free delivery"),
            new TierInfoDto("Platinum", 10000, "2x points (4% back) + VIP perks")
        });
    }

    // Stats endpoints
    public static async Task<Ok<LoyaltyStatsDto>> GetStats(LoyaltyContext context)
    {
        var totalAccounts = await context.Accounts.CountAsync();
        var tierCounts = await context.Accounts
            .GroupBy(a => a.CurrentTier)
            .Select(g => new { Tier = g.Key, Count = g.Count() })
            .ToListAsync();

        var today = DateTime.UtcNow.Date;
        var thisWeek = today.AddDays(-7);
        var thisMonth = today.AddDays(-30);

        var pointsToday = await context.Transactions
            .Where(t => t.CreatedAt >= today && t.Points > 0)
            .SumAsync(t => t.Points);

        var pointsThisWeek = await context.Transactions
            .Where(t => t.CreatedAt >= thisWeek && t.Points > 0)
            .SumAsync(t => t.Points);

        var pointsThisMonth = await context.Transactions
            .Where(t => t.CreatedAt >= thisMonth && t.Points > 0)
            .SumAsync(t => t.Points);

        return TypedResults.Ok(new LoyaltyStatsDto(
            totalAccounts,
            tierCounts.ToDictionary(t => t.Tier.ToString(), t => t.Count),
            pointsToday,
            pointsThisWeek,
            pointsThisMonth
        ));
    }
}

// DTOs
public record CreateAccountRequest(string UserId, string? UserDisplayName = null);
public record EarnPointsRequest(string UserId, int Points, string Type, string? ReferenceId = null, string? Description = null, string? UserDisplayName = null);
public record AdjustPointsRequest(string UserId, int Points, string Reason);

public record AccountDto(
    int Id,
    string UserId,
    string? UserDisplayName,
    int PointsBalance,
    int LifetimePoints,
    string CurrentTier,
    DateTime CreatedAt,
    DateTime UpdatedAt)
{
    public AccountDto(LoyaltyAccount account) : this(
        account.Id,
        account.UserId,
        account.UserDisplayName,
        account.PointsBalance,
        account.LifetimePoints,
        account.CurrentTier.ToString(),
        account.CreatedAt,
        account.UpdatedAt)
    { }
}

public record BalanceDto(int Balance, int LifetimePoints, string Tier);

public record TransactionDto(
    int Id,
    int Points,
    string Type,
    string? ReferenceId,
    string? Description,  // Only used for Adjustment type
    DateTime CreatedAt)
{
    public TransactionDto(PointsTransaction t) : this(
        t.Id, t.Points, t.Type.ToString(), t.ReferenceId, t.Description, t.CreatedAt)
    { }
}

public record TierInfoDto(string Name, int PointsRequired, string Benefits);

public record PointsValueDto(int Points, double DiscountValue, int RedemptionRate);

public record LoyaltyStatsDto(
    int TotalAccounts,
    Dictionary<string, int> AccountsByTier,
    int PointsIssuedToday,
    int PointsIssuedThisWeek,
    int PointsIssuedThisMonth
);
