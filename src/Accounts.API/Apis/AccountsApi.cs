using System.ComponentModel;
using Chillax.Accounts.API.Application.Commands;
using Chillax.Accounts.API.Application.Queries;
using Chillax.Accounts.Domain.Exceptions;
using Chillax.ServiceDefaults;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Chillax.Accounts.API.Apis;

public static class AccountsApi
{
    public static IEndpointRouteBuilder MapAccountsApi(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("api/accounts");

        // Customer endpoints (Mobile App)
        api.MapGet("/my", GetMyAccount)
            .WithName("GetMyAccount")
            .WithSummary("Get my account")
            .WithDescription("Get the current user's account balance and recent transactions")
            .WithTags("Customer")
            .RequireAuthorization();

        api.MapGet("/my/transactions", GetMyTransactions)
            .WithName("GetMyTransactions")
            .WithSummary("Get my transactions")
            .WithDescription("Get the full transaction history for the current user")
            .WithTags("Customer")
            .RequireAuthorization();

        // Admin endpoints
        api.MapGet("/", GetAllAccounts)
            .WithName("GetAllAccounts")
            .WithSummary("List all accounts")
            .WithDescription("Get all customer accounts with balances (Admin only)")
            .WithTags("Admin")
            .RequireAuthorization("Admin");

        api.MapGet("/search", SearchAccounts)
            .WithName("SearchAccounts")
            .WithSummary("Search accounts")
            .WithDescription("Search customer accounts by name (Admin only)")
            .WithTags("Admin")
            .RequireAuthorization("Admin");

        // The till reads a balance, never the ledger: "owes 340" on the
        // customer's card and beside their name when a bill goes on account
        api.MapGet("/{customerId}/balance", GetAccountBalance)
            .WithName("GetAccountBalance")
            .WithSummary("Get a customer's tab balance")
            .WithDescription("Balance alone, no transactions (till staff). 404 when the customer has no tab yet. Positive = owed.")
            .WithTags("Pos")
            .RequireAuthorization("Pos");

        api.MapGet("/{customerId}", GetAccountByCustomerId)
            .WithName("GetAccountByCustomerId")
            .WithSummary("Get customer account")
            .WithDescription("Get a specific customer's account details (Admin only)")
            .WithTags("Admin")
            .RequireAuthorization("Admin");

        api.MapPost("/{customerId}/charge", AddCharge)
            .WithName("AddCharge")
            .WithSummary("Add charge")
            .WithDescription("Add a charge to a customer's account (Admin only)")
            .WithTags("Admin")
            .RequireAuthorization("Admin");

        api.MapPost("/{customerId}/payment", RecordPayment)
            .WithName("RecordPayment")
            .WithSummary("Record payment")
            .WithDescription("Record a payment for a customer's account (Admin only)")
            .WithTags("Admin")
            .RequireAuthorization("Admin");

        return app;
    }

    // Customer endpoints
    public static async Task<Ok<AccountViewModel?>> GetMyAccount(
        [FromServices] IAccountQueries queries,
        HttpContext httpContext)
    {
        var customerId = httpContext.User.GetUserId();
        if (string.IsNullOrEmpty(customerId))
        {
            return TypedResults.Ok<AccountViewModel?>(null);
        }

        var account = await queries.GetAccountByCustomerIdAsync(customerId);
        return TypedResults.Ok<AccountViewModel?>(account);
    }

    public static async Task<Ok<IEnumerable<TransactionViewModel>>> GetMyTransactions(
        [FromServices] IAccountQueries queries,
        HttpContext httpContext,
        [Description("Maximum number of transactions to return")] int? limit = null)
    {
        var customerId = httpContext.User.GetUserId();
        if (string.IsNullOrEmpty(customerId))
        {
            return TypedResults.Ok<IEnumerable<TransactionViewModel>>([]);
        }

        var transactions = await queries.GetTransactionsByCustomerIdAsync(customerId, limit);
        return TypedResults.Ok(transactions);
    }

    // Admin endpoints
    public static async Task<Ok<IEnumerable<AccountSummaryViewModel>>> GetAllAccounts(
        [FromServices] IAccountQueries queries)
    {
        var accounts = await queries.GetAllAccountsAsync();
        return TypedResults.Ok(accounts);
    }

    public static async Task<Ok<IEnumerable<AccountSummaryViewModel>>> SearchAccounts(
        [FromServices] IAccountQueries queries,
        [Description("Search term for customer name")] string? q = null)
    {
        var accounts = await queries.SearchAccountsAsync(q);
        return TypedResults.Ok(accounts);
    }

    public static async Task<Results<Ok<AccountSummaryViewModel>, NotFound>> GetAccountBalance(
        [FromServices] IAccountQueries queries,
        [Description("The customer ID")] string customerId)
    {
        var account = await queries.GetAccountSummaryByCustomerIdAsync(customerId);
        return account == null ? TypedResults.NotFound() : TypedResults.Ok(account);
    }

    public static async Task<Results<Ok<AccountViewModel>, NotFound>> GetAccountByCustomerId(
        [FromServices] IAccountQueries queries,
        [Description("The customer ID")] string customerId)
    {
        var account = await queries.GetAccountByCustomerIdAsync(customerId);
        if (account == null)
        {
            return TypedResults.NotFound();
        }
        return TypedResults.Ok(account);
    }

    public static async Task<Results<Ok, BadRequest<ProblemDetails>>> AddCharge(
        [FromServices] IMediator mediator,
        HttpContext httpContext,
        [Description("The customer ID")] string customerId,
        AddChargeRequest request)
    {
        var adminName = httpContext.User.GetUserName() ?? httpContext.User.GetUserId() ?? "admin";

        try
        {
            var command = new AddChargeCommand(
                customerId,
                request.CustomerName,
                request.Amount,
                request.Description,
                adminName);

            await mediator.Send(command);
            return TypedResults.Ok();
        }
        catch (AccountsDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> RecordPayment(
        [FromServices] IMediator mediator,
        HttpContext httpContext,
        [Description("The customer ID")] string customerId,
        RecordPaymentRequest request)
    {
        var adminName = httpContext.User.GetUserName() ?? httpContext.User.GetUserId() ?? "admin";

        try
        {
            var command = new RecordPaymentCommand(
                customerId,
                request.Amount,
                request.Description,
                adminName);

            await mediator.Send(command);
            return TypedResults.Ok();
        }
        catch (AccountsDomainException ex)
        {
            if (ex.Message.Contains("not found"))
            {
                return TypedResults.NotFound();
            }
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }
}

public record AddChargeRequest(
    decimal Amount,
    string? Description = null,
    string? CustomerName = null
);

public record RecordPaymentRequest(
    decimal Amount,
    string? Description = null
);
