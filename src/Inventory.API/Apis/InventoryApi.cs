#nullable enable
using Chillax.AI;
using Chillax.AI.Agents;
using Chillax.AI.Http;
using Chillax.AI.Images;
using Chillax.Inventory.API.Application.Assist;
using Chillax.Inventory.API.Application.Commands;
using Chillax.Inventory.API.Application.Queries;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Chillax.Inventory.API.Apis;

public static class InventoryApi
{
    public static RouteGroupBuilder MapInventoryApi(this IEndpointRouteBuilder app)
    {
        // The storeroom is back-office work: Admin (branch-checked) or Owner.
        // Stock items and recipes are global; levels, movements, receipts
        // and counts belong to the branch named by X-Branch-Id.
        var api = app.NewVersionedApi("Inventory")
            .MapGroup("api/inventory")
            .HasApiVersion(1.0)
            .RequireAuthorization("Admin");

        // Stock items
        api.MapGet("/items", GetStockItems)
            .WithName("GetStockItems")
            .WithSummary("Stock items (ingredients and sellable units), active ones unless asked otherwise");

        api.MapGet("/items/{id:int}", GetStockItem)
            .WithName("GetStockItem");

        api.MapPost("/items", CreateStockItem)
            .WithName("CreateStockItem")
            .WithSummary("Add a stock item");

        api.MapPut("/items/{id:int}", UpdateStockItem)
            .WithName("UpdateStockItem")
            .WithSummary("Edit a stock item, including retiring it");

        api.MapPut("/items/{id:int}/reorder-level", SetReorderLevel)
            .WithName("SetReorderLevel")
            .WithSummary("Set where the low-stock warning fires for this item at the branch (null clears it)");

        api.MapGet("/items/{id:int}/costs", GetCostHistory)
            .WithName("GetStockItemCosts")
            .WithSummary("What the branch paid for this item, receipt by receipt, newest first");

        // Levels and the ledger
        api.MapGet("/levels", GetLevels)
            .WithName("GetStockLevels")
            .WithSummary("Every active stock item with what the branch has on hand");

        api.MapGet("/movements", GetMovements)
            .WithName("GetStockMovements")
            .WithSummary("The branch's ledger, newest first, optionally one item or a date range");

        api.MapPost("/movements", PostAdjustment)
            .WithName("PostStockAdjustment")
            .WithSummary("Record waste or an adjustment by hand, with a reason");

        // Receipts
        api.MapGet("/purchases", GetPurchases)
            .WithName("GetPurchases")
            .WithSummary("Receipts at the branch, newest first");

        api.MapGet("/purchases/{id:int}", GetPurchase)
            .WithName("GetPurchase");

        api.MapPost("/purchases", ReceivePurchase)
            .WithName("ReceivePurchase")
            .WithSummary("Receive stock into the branch")
            .WithDescription("Quantities are in each item's base unit; the unit cost sets the branch's moving average.");

        api.MapPost("/purchases/scan", ScanReceipt)
            .WithName("ScanReceipt")
            .WithSummary("Read a receipt photo into proposed purchase lines")
            .WithDescription("The assistant matches each line to a stock item or proposes a new one. Nothing is posted: review the proposal, create the new items, then receive the purchase.")
            .DisableAntiforgery()
            .RequireRateLimiting(ChillaxAIRateLimiting.PolicyName);

        // Counts
        api.MapGet("/counts", GetStockCounts)
            .WithName("GetStockCounts")
            .WithSummary("Physical counts at the branch, newest first");

        api.MapGet("/counts/{id:int}", GetStockCount)
            .WithName("GetStockCount");

        api.MapPost("/counts", PostStockCount)
            .WithName("PostStockCount")
            .WithSummary("Post a physical count; the ledger is corrected to what was found");

        // Transfers between branches
        api.MapGet("/transfers", GetTransfers)
            .WithName("GetTransfers")
            .WithSummary("Transfers the branch sent or received, newest first");

        api.MapGet("/transfers/{id:int}", GetTransfer)
            .WithName("GetTransfer");

        // The destination is a route value named branchId so the branch
        // access check covers it like the header's source branch
        api.MapPost("/transfers/to/{branchId:int}", TransferStock)
            .WithName("TransferStock")
            .WithSummary("Send stock from the branch in X-Branch-Id to another branch");

        // Reports and repair
        api.MapGet("/reports/usage", GetUsageReport)
            .WithName("GetUsageReport")
            .WithSummary("What each stock item did over a period, valued at posting cost, plus the stock value now");

        api.MapGet("/reports/variance", GetVarianceReport)
            .WithName("GetVarianceReport")
            .WithSummary("The period as opening, received, theoretical usage, waste, count variance and closing, per item and in money");

        api.MapPost("/levels/rebuild", RebuildLevels)
            .WithName("RebuildStockLevels")
            .WithSummary("Recompute the branch's levels from its ledger")
            .RequireAuthorization("Owner");

        // Recipes
        api.MapGet("/recipes", GetRecipes)
            .WithName("GetRecipes")
            .WithSummary("Every tracked menu item and what one unit takes");

        api.MapGet("/recipes/costs", GetRecipeCosts)
            .WithName("GetRecipeCosts")
            .WithSummary("What one sale of each tracked menu item costs at the branch's average ingredient costs");

        api.MapPost("/recipes/assist/propose", ProposeRecipes)
            .WithName("ProposeRecipes")
            .WithSummary("Propose the stock rule for a batch of menu items: sold as a unit, or a recipe with the ingredients the shelf is missing")
            .WithDescription("Nothing is saved: the review sheet creates the ingredients it agrees with, then sets each recipe or tracks the item by unit through the endpoints that already exist.")
            .RequireRateLimiting(ChillaxAIRateLimiting.PolicyName);

        api.MapGet("/recipes/{catalogItemId:int}", GetRecipe)
            .WithName("GetRecipe");

        api.MapPut("/recipes/{catalogItemId:int}", SetRecipe)
            .WithName("SetRecipe")
            .WithSummary("Set a menu item's recipe (starts tracking it)");

        api.MapDelete("/recipes/{catalogItemId:int}", RemoveRecipe)
            .WithName("RemoveRecipe")
            .WithSummary("Stop tracking a menu item");

        api.MapPost("/recipes/track-by-unit", TrackByUnit)
            .WithName("TrackByUnit")
            .WithSummary("Track a menu item sold as-is: one stock item, one each, sells out when it runs dry");

        return api;
    }

    // Stock items

    public static async Task<Ok<IReadOnlyList<StockItemView>>> GetStockItems(
        [FromServices] IInventoryQueries queries,
        bool includeInactive = false)
        => TypedResults.Ok(await queries.GetStockItemsAsync(includeInactive));

    public static async Task<Results<Ok<StockItemView>, NotFound>> GetStockItem(
        int id,
        [FromServices] IInventoryQueries queries)
    {
        var item = await queries.GetStockItemAsync(id);
        return item is null ? TypedResults.NotFound() : TypedResults.Ok(item);
    }

    public static async Task<Results<Ok<CreatedResponse>, BadRequest<string>>> CreateStockItem(
        StockItemRequest request,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        [FromServices] IMediator mediator)
    {
        try
        {
            var id = await mediator.SendIdentified<CreateStockItemCommand, int>(requestId, new CreateStockItemCommand(
                request.Name, request.Unit, request.PackSize, request.PackName, request.AutoSoldOut));

            return TypedResults.Ok(new CreatedResponse(id));
        }
        catch (InventoryDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok, BadRequest<string>>> UpdateStockItem(
        int id,
        StockItemRequest request,
        [FromServices] IMediator mediator)
    {
        try
        {
            await mediator.Send(new UpdateStockItemCommand(
                id, request.Name, request.Unit, request.PackSize, request.PackName, request.AutoSoldOut, request.IsActive ?? true));

            return TypedResults.Ok();
        }
        catch (InventoryDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok, BadRequest<string>>> SetReorderLevel(
        int id,
        ReorderLevelRequest request,
        HttpContext httpContext,
        [FromServices] IMediator mediator)
    {
        var branchId = httpContext.GetRequiredBranchId();

        try
        {
            await mediator.Send(new SetReorderLevelCommand(branchId, id, request.ReorderLevel));
            return TypedResults.Ok();
        }
        catch (InventoryDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    // Levels and the ledger

    public static async Task<Ok<IReadOnlyList<CostHistoryView>>> GetCostHistory(
        int id,
        HttpContext httpContext,
        [FromServices] IInventoryQueries queries,
        int take = 30)
    {
        var branchId = httpContext.GetRequiredBranchId();
        return TypedResults.Ok(await queries.GetCostHistoryAsync(branchId, id, Math.Clamp(take, 1, 200)));
    }

    public static async Task<Ok<IReadOnlyList<StockLevelView>>> GetLevels(
        HttpContext httpContext,
        [FromServices] IInventoryQueries queries,
        bool low = false,
        bool includeRetired = false)
    {
        var branchId = httpContext.GetRequiredBranchId();
        return TypedResults.Ok(await queries.GetLevelsAsync(branchId, low, includeRetired));
    }

    public static async Task<Ok<PagedResult<MovementView>>> GetMovements(
        HttpContext httpContext,
        [FromServices] IInventoryQueries queries,
        int? stockItemId = null,
        MovementType? type = null,
        DateTime? from = null,
        DateTime? to = null,
        int pageIndex = 0,
        int pageSize = 50)
    {
        var branchId = httpContext.GetRequiredBranchId();
        pageSize = Math.Clamp(pageSize, 1, 200);
        return TypedResults.Ok(await queries.GetMovementsAsync(branchId, stockItemId, type, from, to, Math.Max(0, pageIndex), pageSize));
    }

    public static async Task<Results<Ok, BadRequest<string>>> PostAdjustment(
        AdjustmentRequest request,
        HttpContext httpContext,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        [FromServices] IMediator mediator)
    {
        var branchId = httpContext.GetRequiredBranchId();

        try
        {
            await mediator.SendIdentified<PostAdjustmentCommand, bool>(requestId, new PostAdjustmentCommand(
                branchId, request.StockItemId, request.Type, request.Quantity, request.Reason, request.UnitCost, httpContext.GetActor()));

            return TypedResults.Ok();
        }
        catch (InventoryDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    // Receipts

    public static async Task<Ok<PagedResult<PurchaseView>>> GetPurchases(
        HttpContext httpContext,
        [FromServices] IInventoryQueries queries,
        int pageIndex = 0,
        int pageSize = 20)
    {
        var branchId = httpContext.GetRequiredBranchId();
        pageSize = Math.Clamp(pageSize, 1, 100);
        return TypedResults.Ok(await queries.GetPurchasesAsync(branchId, Math.Max(0, pageIndex), pageSize));
    }

    public static async Task<Results<Ok<PurchaseView>, NotFound>> GetPurchase(
        int id,
        [FromServices] IInventoryQueries queries)
    {
        var purchase = await queries.GetPurchaseAsync(id);
        return purchase is null ? TypedResults.NotFound() : TypedResults.Ok(purchase);
    }

    public static async Task<Results<Ok<CreatedResponse>, BadRequest<string>>> ReceivePurchase(
        PurchaseRequest request,
        HttpContext httpContext,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        [FromServices] IMediator mediator)
    {
        var branchId = httpContext.GetRequiredBranchId();

        try
        {
            var id = await mediator.SendIdentified<ReceivePurchaseCommand, int>(requestId, new ReceivePurchaseCommand(
                branchId, request.Supplier, request.InvoiceRef, request.Lines, httpContext.GetActor(), request.SupplierId));

            return TypedResults.Ok(new CreatedResponse(id));
        }
        catch (InventoryDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok<ReceiptProposal>, BadRequest<string>, ProblemHttpResult>> ScanReceipt(
        IFormFile file,
        HttpContext httpContext,
        [FromServices] ReceiptScanner scanner,
        [FromServices] IInventoryQueries queries,
        [FromServices] IOptions<AIOptions> aiOptions,
        CancellationToken ct)
    {
        var branchId = httpContext.GetRequiredBranchId();

        if (!scanner.IsEnabled)
            return AIProblems.NotConfigured();

        var (image, error) = await ImageValidation.ReadAsync(file, aiOptions.Value.MaxImageBytes, ct);
        if (image is null)
            return TypedResults.BadRequest(error ?? "The receipt image could not be read.");

        var stockItems = await queries.GetStockItemsAsync(includeInactive: false);
        var lastCosts = (await queries.GetLastCostsAsync(branchId)).ToDictionary(kv => kv.Key, kv => kv.Value.UnitCost);

        try
        {
            return TypedResults.Ok(await scanner.ScanAsync(branchId, image, stockItems, ct, lastCosts));
        }
        catch (AIException ex)
        {
            return AIProblems.From(ex, httpContext);
        }
    }

    // Counts

    public static async Task<Ok<PagedResult<StockCountView>>> GetStockCounts(
        HttpContext httpContext,
        [FromServices] IInventoryQueries queries,
        int pageIndex = 0,
        int pageSize = 20)
    {
        var branchId = httpContext.GetRequiredBranchId();
        pageSize = Math.Clamp(pageSize, 1, 100);
        return TypedResults.Ok(await queries.GetStockCountsAsync(branchId, Math.Max(0, pageIndex), pageSize));
    }

    public static async Task<Results<Ok<StockCountView>, NotFound>> GetStockCount(
        int id,
        [FromServices] IInventoryQueries queries)
    {
        var count = await queries.GetStockCountAsync(id);
        return count is null ? TypedResults.NotFound() : TypedResults.Ok(count);
    }

    public static async Task<Results<Ok<CreatedResponse>, BadRequest<string>>> PostStockCount(
        StockCountRequest request,
        HttpContext httpContext,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        [FromServices] IMediator mediator)
    {
        var branchId = httpContext.GetRequiredBranchId();

        try
        {
            var id = await mediator.SendIdentified<PostStockCountCommand, int>(requestId, new PostStockCountCommand(
                branchId, request.Note, request.Lines, httpContext.GetActor()));

            return TypedResults.Ok(new CreatedResponse(id));
        }
        catch (InventoryDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    // Transfers, reports and repair

    public static async Task<Ok<PagedResult<TransferView>>> GetTransfers(
        HttpContext httpContext,
        [FromServices] IInventoryQueries queries,
        int pageIndex = 0,
        int pageSize = 20)
    {
        var branchId = httpContext.GetRequiredBranchId();
        pageSize = Math.Clamp(pageSize, 1, 100);
        return TypedResults.Ok(await queries.GetTransfersAsync(branchId, Math.Max(0, pageIndex), pageSize));
    }

    public static async Task<Results<Ok<TransferView>, NotFound>> GetTransfer(
        int id,
        [FromServices] IInventoryQueries queries)
    {
        var transfer = await queries.GetTransferAsync(id);
        return transfer is null ? TypedResults.NotFound() : TypedResults.Ok(transfer);
    }

    public static async Task<Results<Ok<CreatedResponse>, BadRequest<string>>> TransferStock(
        int branchId,
        TransferRequest request,
        HttpContext httpContext,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        [FromServices] IMediator mediator)
    {
        var fromBranchId = httpContext.GetRequiredBranchId();

        try
        {
            var id = await mediator.SendIdentified<TransferStockCommand, int>(requestId, new TransferStockCommand(
                fromBranchId, branchId, request.Note, request.Lines, httpContext.GetActor()));

            return TypedResults.Ok(new CreatedResponse(id));
        }
        catch (InventoryDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok<UsageReport>, BadRequest<string>>> GetUsageReport(
        HttpContext httpContext,
        [FromServices] IInventoryQueries queries,
        DateTime from,
        DateTime to)
    {
        var branchId = httpContext.GetRequiredBranchId();

        if (to <= from)
            return TypedResults.BadRequest("The period must end after it starts.");

        return TypedResults.Ok(await queries.GetUsageReportAsync(branchId, from, to));
    }

    public static async Task<Results<Ok<VarianceReport>, BadRequest<string>>> GetVarianceReport(
        HttpContext httpContext,
        [FromServices] IInventoryQueries queries,
        DateTime from,
        DateTime to)
    {
        var branchId = httpContext.GetRequiredBranchId();

        if (to <= from)
            return TypedResults.BadRequest("The period must end after it starts.");

        return TypedResults.Ok(await queries.GetVarianceReportAsync(branchId, from, to));
    }

    public static async Task<Ok<RebuildResponse>> RebuildLevels(
        HttpContext httpContext,
        [FromServices] IMediator mediator)
    {
        var branchId = httpContext.GetRequiredBranchId();
        var changed = await mediator.Send(new RebuildLevelsCommand(branchId));
        return TypedResults.Ok(new RebuildResponse(changed));
    }

    // Recipes

    public static async Task<Ok<IReadOnlyList<RecipeView>>> GetRecipes(
        [FromServices] IInventoryQueries queries)
        => TypedResults.Ok(await queries.GetRecipesAsync());

    public static async Task<Results<Ok<RecipesProposal>, BadRequest<string>, ProblemHttpResult>> ProposeRecipes(
        ProposeRecipesRequest request,
        HttpContext httpContext,
        [FromServices] RecipeProposer proposer,
        [FromServices] IInventoryQueries queries,
        CancellationToken ct)
    {
        if (!proposer.IsEnabled)
            return AIProblems.NotConfigured();

        var items = request.Items ?? [];
        if (items.Count == 0)
            return TypedResults.BadRequest("Pick at least one menu item.");
        if (items.Count > RecipeProposer.MaxItems)
            return TypedResults.BadRequest($"At most {RecipeProposer.MaxItems} menu items per call.");
        if (items.Any(i => i.CatalogItemId <= 0 || string.IsNullOrWhiteSpace(i.Name.En)))
            return TypedResults.BadRequest("Every menu item needs its id and an English name.");

        var shelf = await queries.GetStockItemsAsync(includeInactive: false);

        try
        {
            return TypedResults.Ok(await proposer.ProposeAsync(items, shelf, ct));
        }
        catch (AIException ex)
        {
            return AIProblems.From(ex, httpContext);
        }
    }

    public static async Task<Ok<IReadOnlyList<RecipeCostView>>> GetRecipeCosts(
        HttpContext httpContext,
        [FromServices] IInventoryQueries queries)
        => TypedResults.Ok(await queries.GetRecipeCostsAsync(httpContext.GetRequiredBranchId()));

    public static async Task<Results<Ok<RecipeView>, NotFound>> GetRecipe(
        int catalogItemId,
        [FromServices] IInventoryQueries queries)
    {
        var recipe = await queries.GetRecipeAsync(catalogItemId);
        return recipe is null ? TypedResults.NotFound() : TypedResults.Ok(recipe);
    }

    public static async Task<Results<Ok, BadRequest<string>>> SetRecipe(
        int catalogItemId,
        RecipeRequest request,
        [FromServices] IMediator mediator)
    {
        try
        {
            await mediator.Send(new SetRecipeCommand(catalogItemId, request.Lines));
            return TypedResults.Ok();
        }
        catch (InventoryDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<NoContent, NotFound>> RemoveRecipe(
        int catalogItemId,
        [FromServices] IMediator mediator)
        => await mediator.Send(new RemoveRecipeCommand(catalogItemId))
            ? TypedResults.NoContent()
            : TypedResults.NotFound();

    public static async Task<Results<Ok<CreatedResponse>, BadRequest<string>>> TrackByUnit(
        TrackByUnitRequest request,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        [FromServices] IMediator mediator)
    {
        try
        {
            var stockItemId = await mediator.SendIdentified<TrackByUnitCommand, int>(requestId, new TrackByUnitCommand(
                request.CatalogItemId, request.Name));

            return TypedResults.Ok(new CreatedResponse(stockItemId));
        }
        catch (InventoryDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }
}

public record CreatedResponse(int Id);

public record StockItemRequest(LocalizedText Name, string Unit, decimal? PackSize, string? PackName, bool AutoSoldOut, bool? IsActive = null);

public record ReorderLevelRequest(decimal? ReorderLevel);

public record AdjustmentRequest(int StockItemId, MovementType Type, decimal Quantity, string Reason, decimal? UnitCost = null);

public record PurchaseRequest(string? Supplier, string? InvoiceRef, IReadOnlyList<PurchaseLineInput> Lines, int? SupplierId = null);

public record StockCountRequest(string? Note, IReadOnlyList<StockCountLineInput> Lines);

public record RecipeRequest(IReadOnlyList<RecipeLineInput> Lines);

public record TrackByUnitRequest(int CatalogItemId, LocalizedText Name);

public record TransferRequest(string? Note, IReadOnlyList<TransferLineInput> Lines);

public record RebuildResponse(int Changed);
