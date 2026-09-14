#nullable enable
using Chillax.Finance.API.Application.Commands;
using Chillax.Finance.API.Application.Queries;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Chillax.Finance.API.Apis;

public static class FinanceApi
{
    public static RouteGroupBuilder MapFinanceApi(this IEndpointRouteBuilder app)
    {
        // Back-office work: Admin (branch-checked) or Owner. Expenses and the
        // accounts belong to the branch named by X-Branch-Id; categories,
        // suppliers and partners are global records.
        var api = app.NewVersionedApi("Finance")
            .MapGroup("api/finance")
            .HasApiVersion(1.0)
            .RequireAuthorization("Admin");

        // Categories
        api.MapGet("/categories", GetCategories).WithName("GetExpenseCategories");
        api.MapPost("/categories", SaveCategory).WithName("SaveExpenseCategory")
            .WithSummary("Add a category, or edit one when the body carries its id");

        // Expenses
        api.MapGet("/expenses", GetExpenses).WithName("GetExpenses")
            .WithSummary("The branch's expenses in a date range, with totals by category");
        api.MapPost("/expenses", RecordExpense).WithName("RecordExpense")
            .WithSummary("An expense keyed in: from the drawer, the bank, or a partner's own pocket");
        api.MapPost("/expenses/{id:int}/void", VoidExpense).WithName("VoidExpense")
            .WithSummary("Void an expense with a reason; it stays on the list, struck through");
        api.MapPost("/expenses/{id:int}/receipt", AttachReceipt).WithName("AttachExpenseReceipt")
            .WithSummary("Attach the photo or PDF of the bill (5 MB at most); uploading again replaces it")
            .DisableAntiforgery();
        api.MapGet("/expenses/{id:int}/receipt", GetReceipt).WithName("GetExpenseReceipt")
            .WithSummary("The attached bill, as the file it was uploaded as");
        api.MapDelete("/expenses/{id:int}/receipt", RemoveReceipt).WithName("RemoveExpenseReceipt");

        // Recurring bills
        api.MapGet("/recurring", GetRecurring).WithName("GetRecurringExpenses")
            .WithSummary("The branch's monthly bills that post themselves");
        api.MapPost("/recurring", SaveRecurring).WithName("SaveRecurringExpense")
            .WithSummary("Add a recurring bill, or edit one when the body carries its id");

        // Suppliers
        api.MapGet("/suppliers", GetSuppliers).WithName("GetSuppliers")
            .WithSummary("Suppliers with what the branch owes each");
        api.MapPost("/suppliers", SaveSupplier).WithName("SaveSupplier")
            .WithSummary("Add a supplier, or edit one when the body carries its id");
        api.MapGet("/suppliers/{id:int}/ledger", GetSupplierLedger).WithName("GetSupplierLedger");
        api.MapPost("/suppliers/{id:int}/ledger", PostSupplierEntry).WithName("PostSupplierEntry")
            .WithSummary("A payment made outside the drawer, a credit, or an invoice with no stock receipt");

        // The owners' own business: who the partners are, what they hold,
        // and whether the month made money. A branch manager runs expenses
        // and suppliers; this stays with the Owner role.
        var owners = app.NewVersionedApi("Finance")
            .MapGroup("api/finance")
            .HasApiVersion(1.0)
            .RequireAuthorization("Owner");

        owners.MapGet("/partners", GetPartners).WithName("GetPartners")
            .WithSummary("The branch's partners with what the café holds of theirs");
        owners.MapPost("/partners", SavePartner).WithName("SavePartner")
            .WithSummary("Add a partner, or edit one when the body carries its id");
        owners.MapGet("/partners/{id:int}/ledger", GetPartnerLedger).WithName("GetPartnerLedger");
        owners.MapPost("/partners/{id:int}/ledger", PostPartnerEntry).WithName("PostPartnerEntry")
            .WithSummary("Money a partner put in or took outside the drawer");

        owners.MapGet("/profit", GetProfit).WithName("GetProfit")
            .WithSummary("A month's profit and loss at the branch: sales, cost of goods, labour, expenses");
        owners.MapGet("/profit/trend", GetProfitTrend).WithName("GetProfitTrend")
            .WithSummary("The last months' headline figures, newest first");

        // The till's pickers, read by a cashier
        var till = app.NewVersionedApi("Finance")
            .MapGroup("api/finance/till")
            .HasApiVersion(1.0)
            .RequireAuthorization("Pos");

        till.MapGet("/suppliers", GetTillSuppliers).WithName("GetTillSuppliers");
        till.MapGet("/partners", GetTillPartners).WithName("GetTillPartners");
        till.MapGet("/categories", GetTillCategories).WithName("GetTillCategories");

        return api;
    }

    // Categories

    public static async Task<Ok<IReadOnlyList<ExpenseCategoryView>>> GetCategories(
        [FromServices] IFinanceQueries queries,
        bool includeInactive = false)
        => TypedResults.Ok(await queries.GetCategoriesAsync(includeInactive));

    public static async Task<Results<Ok<CreatedResponse>, BadRequest<string>>> SaveCategory(
        CategoryRequest request,
        [FromServices] IMediator mediator)
    {
        try
        {
            var id = await mediator.Send(new SaveCategoryCommand(request.Id, request.Name, request.DisplayOrder, request.IsActive ?? true));
            return TypedResults.Ok(new CreatedResponse(id));
        }
        catch (FinanceDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    // Expenses

    public static async Task<Ok<ExpensesView>> GetExpenses(
        HttpContext httpContext,
        [FromServices] IFinanceQueries queries,
        DateOnly from,
        DateOnly to)
        => TypedResults.Ok(await queries.GetExpensesAsync(httpContext.GetRequiredBranchId(), from, to));

    public static async Task<Results<Ok<CreatedResponse>, BadRequest<string>>> RecordExpense(
        ExpenseRequest request,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        HttpContext httpContext,
        [FromServices] IMediator mediator)
    {
        var branchId = httpContext.GetRequiredBranchId();

        try
        {
            var id = await mediator.SendIdentified<RecordExpenseCommand, int>(requestId, new RecordExpenseCommand(
                branchId, request.Date, request.CategoryId, request.Amount, request.PaidFrom, request.PartnerId,
                request.Vendor, request.Note, httpContext.GetActor()));
            return TypedResults.Ok(new CreatedResponse(id));
        }
        catch (FinanceDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok, BadRequest<string>>> VoidExpense(
        int id,
        VoidRequest request,
        HttpContext httpContext,
        [FromServices] IMediator mediator)
    {
        try
        {
            await mediator.Send(new VoidExpenseCommand(id, request.Reason, httpContext.GetActor()));
            return TypedResults.Ok();
        }
        catch (FinanceDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok, BadRequest<string>>> AttachReceipt(
        int id,
        IFormFile file,
        HttpContext httpContext,
        [FromServices] IMediator mediator)
    {
        if (file.Length > ExpenseReceipt.MaxBytes)
            return TypedResults.BadRequest("The receipt file is too large; 5 MB at most.");

        await using var stream = file.OpenReadStream();
        using var buffer = new MemoryStream();
        await stream.CopyToAsync(buffer);

        try
        {
            await mediator.Send(new AttachReceiptCommand(id, file.ContentType, file.FileName, buffer.ToArray(), httpContext.GetActor()));
            return TypedResults.Ok();
        }
        catch (FinanceDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<FileContentHttpResult, NotFound>> GetReceipt(
        int id,
        [FromServices] IExpenseRepository expenses)
    {
        var receipt = await expenses.GetReceiptAsync(id);
        return receipt is null
            ? TypedResults.NotFound()
            : TypedResults.File(receipt.Data, receipt.ContentType, receipt.FileName, lastModified: receipt.UploadedAt);
    }

    public static async Task<Results<Ok, NotFound>> RemoveReceipt(
        int id,
        [FromServices] IMediator mediator)
        => await mediator.Send(new RemoveReceiptCommand(id)) ? TypedResults.Ok() : TypedResults.NotFound();

    // Recurring bills

    public static async Task<Ok<IReadOnlyList<RecurringExpenseView>>> GetRecurring(
        HttpContext httpContext,
        [FromServices] IFinanceQueries queries)
        => TypedResults.Ok(await queries.GetRecurringAsync(httpContext.GetRequiredBranchId()));

    public static async Task<Results<Ok<CreatedResponse>, BadRequest<string>>> SaveRecurring(
        RecurringExpenseRequest request,
        HttpContext httpContext,
        [FromServices] IMediator mediator)
    {
        var branchId = httpContext.GetRequiredBranchId();

        try
        {
            var id = await mediator.Send(new SaveRecurringExpenseCommand(request.Id, branchId, request.CategoryId, request.Amount,
                request.DayOfMonth, request.PaidFrom, request.PartnerId, request.Vendor, request.Note, request.IsActive ?? true));
            return TypedResults.Ok(new CreatedResponse(id));
        }
        catch (FinanceDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    // Suppliers

    public static async Task<Ok<IReadOnlyList<SupplierView>>> GetSuppliers(
        HttpContext httpContext,
        [FromServices] IFinanceQueries queries,
        bool includeInactive = false)
        => TypedResults.Ok(await queries.GetSuppliersAsync(httpContext.GetRequiredBranchId(), includeInactive));

    public static async Task<Results<Ok<CreatedResponse>, BadRequest<string>>> SaveSupplier(
        SupplierRequest request,
        [FromServices] IMediator mediator)
    {
        try
        {
            var id = await mediator.Send(new SaveSupplierCommand(request.Id, request.Name, request.Phone, request.Notes, request.IsActive ?? true));
            return TypedResults.Ok(new CreatedResponse(id));
        }
        catch (FinanceDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok<SupplierLedgerView>, NotFound>> GetSupplierLedger(
        int id,
        HttpContext httpContext,
        [FromServices] IFinanceQueries queries)
    {
        var ledger = await queries.GetSupplierLedgerAsync(id, httpContext.GetRequiredBranchId());
        return ledger is null ? TypedResults.NotFound() : TypedResults.Ok(ledger);
    }

    public static async Task<Results<Ok<CreatedResponse>, BadRequest<string>>> PostSupplierEntry(
        int id,
        SupplierEntryRequest request,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        HttpContext httpContext,
        [FromServices] IMediator mediator)
    {
        var branchId = httpContext.GetRequiredBranchId();

        try
        {
            var entryId = await mediator.SendIdentified<PostSupplierEntryCommand, int>(requestId, new PostSupplierEntryCommand(
                id, branchId, request.Type, request.Amount, request.Date, request.Note, httpContext.GetActor()));
            return TypedResults.Ok(new CreatedResponse(entryId));
        }
        catch (FinanceDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    // Partners

    public static async Task<Ok<IReadOnlyList<PartnerView>>> GetPartners(
        HttpContext httpContext,
        [FromServices] IFinanceQueries queries,
        bool includeInactive = false)
        => TypedResults.Ok(await queries.GetPartnersAsync(httpContext.GetRequiredBranchId(), includeInactive));

    public static async Task<Results<Ok<CreatedResponse>, BadRequest<string>>> SavePartner(
        PartnerRequest request,
        [FromServices] IMediator mediator)
    {
        try
        {
            var id = await mediator.Send(new SavePartnerCommand(request.Id, request.Name, request.Phone, request.UserId,
                request.Shares.Select(s => new PartnerShareInput(s.BranchId, s.Percent)).ToList(), request.IsActive ?? true));
            return TypedResults.Ok(new CreatedResponse(id));
        }
        catch (FinanceDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok<PartnerLedgerView>, NotFound>> GetPartnerLedger(
        int id,
        HttpContext httpContext,
        [FromServices] IFinanceQueries queries)
    {
        var ledger = await queries.GetPartnerLedgerAsync(id, httpContext.GetRequiredBranchId());
        return ledger is null ? TypedResults.NotFound() : TypedResults.Ok(ledger);
    }

    public static async Task<Results<Ok<CreatedResponse>, BadRequest<string>>> PostPartnerEntry(
        int id,
        PartnerEntryRequest request,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        HttpContext httpContext,
        [FromServices] IMediator mediator)
    {
        var branchId = httpContext.GetRequiredBranchId();

        try
        {
            var entryId = await mediator.SendIdentified<PostPartnerEntryCommand, int>(requestId, new PostPartnerEntryCommand(
                id, branchId, request.Type, request.Amount, request.Date, request.Note, httpContext.GetActor()));
            return TypedResults.Ok(new CreatedResponse(entryId));
        }
        catch (FinanceDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    // Profit and loss

    public static async Task<Ok<ProfitView>> GetProfit(
        HttpContext httpContext,
        [FromServices] IFinanceQueries queries,
        int year,
        int month)
        => TypedResults.Ok(await queries.GetProfitAsync(httpContext.GetRequiredBranchId(), year, Math.Clamp(month, 1, 12)));

    public static async Task<Ok<IReadOnlyList<ProfitMonthView>>> GetProfitTrend(
        HttpContext httpContext,
        [FromServices] IFinanceQueries queries,
        int months = 6)
        => TypedResults.Ok(await queries.GetProfitTrendAsync(httpContext.GetRequiredBranchId(), Math.Clamp(months, 1, 24)));

    // The till

    public static async Task<Ok<IReadOnlyList<TillSupplierView>>> GetTillSuppliers(HttpContext httpContext, [FromServices] IFinanceQueries queries)
        => TypedResults.Ok(await queries.GetTillSuppliersAsync(httpContext.GetRequiredBranchId()));

    public static async Task<Ok<IReadOnlyList<TillPickView>>> GetTillPartners(HttpContext httpContext, [FromServices] IFinanceQueries queries)
        => TypedResults.Ok(await queries.GetTillPartnersAsync(httpContext.GetRequiredBranchId()));

    public static async Task<Ok<IReadOnlyList<TillCategoryView>>> GetTillCategories([FromServices] IFinanceQueries queries)
        => TypedResults.Ok(await queries.GetTillCategoriesAsync());
}

public record CreatedResponse(int Id);

public record CategoryRequest(int? Id, LocalizedText Name, int DisplayOrder, bool? IsActive = null);

public record ExpenseRequest(DateOnly Date, int CategoryId, decimal Amount, PaidFrom PaidFrom, int? PartnerId, string? Vendor, string? Note);

public record VoidRequest(string Reason);

public record RecurringExpenseRequest(int? Id, int CategoryId, decimal Amount, int DayOfMonth, PaidFrom PaidFrom, int? PartnerId, string? Vendor, string? Note, bool? IsActive = null);

public record SupplierRequest(int? Id, string Name, string? Phone, string? Notes, bool? IsActive = null);

public record SupplierEntryRequest(SupplierEntryType Type, decimal Amount, DateOnly Date, string? Note);

public record PartnerShareRequest(int BranchId, decimal Percent);

public record PartnerRequest(int? Id, string Name, string? Phone, string? UserId, IReadOnlyList<PartnerShareRequest> Shares, bool? IsActive = null);

public record PartnerEntryRequest(PartnerEntryType Type, decimal Amount, DateOnly Date, string? Note);
