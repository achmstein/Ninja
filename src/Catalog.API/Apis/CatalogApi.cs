using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Chillax.Catalog.API.Dtos;
using Chillax.Catalog.API.Model;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Chillax.Catalog.API;

public static class CatalogApi
{
    public static IEndpointRouteBuilder MapCatalogApi(this IEndpointRouteBuilder app)
    {
        var vApi = app.NewVersionedApi("Catalog");
        var api = vApi.MapGroup("api/catalog").HasApiVersion(1, 0);

        api.MapCatalogAssistApi();
        api.MapPromoApi();

        // Menu Items endpoints
        api.MapGet("/items", GetAllItems)
            .WithName("ListItems")
            .WithSummary("List menu items")
            .WithDescription("Get a paginated list of menu items")
            .WithTags("Items");

        api.MapGet("/items/by", GetItemsByIds)
            .WithName("BatchGetItems")
            .WithSummary("Batch get menu items")
            .WithDescription("Get multiple items by IDs")
            .WithTags("Items");

        api.MapGet("/items/{id:int}", GetItemById)
            .WithName("GetItem")
            .WithSummary("Get menu item")
            .WithDescription("Get a menu item by ID")
            .WithTags("Items");

        api.MapGet("/items/by/{name:minlength(1)}", GetItemsByName)
            .WithName("GetItemsByName")
            .WithSummary("Search menu items by name")
            .WithDescription("Get a paginated list of menu items matching the name")
            .WithTags("Items");

        api.MapGet("/items/{id:int}/pic", GetItemPictureById)
            .WithName("GetItemPicture")
            .WithSummary("Get menu item picture")
            .WithDescription("Get the picture for a menu item")
            .WithTags("Items");

        api.MapGet("/items/type/{typeId}", GetItemsByType)
            .WithName("GetItemsByType")
            .WithSummary("Get menu items by category")
            .WithDescription("Get menu items of the specified category")
            .WithTags("Categories");

        api.MapGet("/items/available", GetAvailableItems)
            .WithName("GetAvailableItems")
            .WithSummary("Get available menu items")
            .WithDescription("Get only available menu items")
            .WithTags("Items");

        // Categories endpoints
        api.MapGet("/categories", GetCategories)
            .WithName("ListCategories")
            .WithSummary("List menu categories")
            .WithDescription("Get a list of menu categories (Drinks, Food, Snacks, Desserts)")
            .WithTags("Categories");

        api.MapPut("/categories/reorder", ReorderCategories)
            .WithName("ReorderCategories")
            .WithSummary("Reorder categories")
            .WithDescription("Batch update category display order (Admin only)")
            .WithTags("Categories")
            .RequireAuthorization("Admin");

        api.MapGet("/categories/{id:int}", GetCategoryById)
            .WithName("GetCategory")
            .WithSummary("Get menu category")
            .WithDescription("Get a menu category by ID")
            .WithTags("Categories");

        api.MapPost("/categories", CreateCategory)
            .WithName("CreateCategory")
            .WithSummary("Create a menu category")
            .WithDescription("Create a new menu category (Admin only)")
            .WithTags("Categories")
            .RequireAuthorization("Admin");

        api.MapPut("/categories/{id:int}", UpdateCategory)
            .WithName("UpdateCategory")
            .WithSummary("Update a menu category")
            .WithDescription("Update an existing menu category (Admin only)")
            .WithTags("Categories")
            .RequireAuthorization("Admin");

        api.MapDelete("/categories/{id:int}", DeleteCategory)
            .WithName("DeleteCategory")
            .WithSummary("Delete menu category")
            .WithDescription("Delete the specified menu category (Admin only)")
            .WithTags("Categories")
            .RequireAuthorization("Admin");

        api.MapPut("/items/reorder", ReorderItems)
            .WithName("ReorderItems")
            .WithSummary("Reorder menu items")
            .WithDescription("Batch update menu item display order (Admin only)")
            .WithTags("Items")
            .RequireAuthorization("Admin");

        // CRUD endpoints
        api.MapPost("/items", CreateItem)
            .WithName("CreateItem")
            .WithSummary("Create a menu item")
            .WithDescription("Create a new menu item (Admin only)")
            .WithTags("Items")
            .RequireAuthorization("Admin");

        api.MapPut("/items/{id:int}", UpdateItem)
            .WithName("UpdateItem")
            .WithSummary("Update a menu item")
            .WithDescription("Update an existing menu item (Admin only)")
            .WithTags("Items")
            .RequireAuthorization("Admin");

        api.MapDelete("/items/{id:int}", DeleteItemById)
            .WithName("DeleteItem")
            .WithSummary("Delete menu item")
            .WithDescription("Delete the specified menu item (Admin only)")
            .WithTags("Items")
            .RequireAuthorization("Admin");

        api.MapPatch("/items/{id:int}/availability", ToggleItemAvailability)
            .WithName("ToggleItemAvailability")
            .WithSummary("Toggle item availability")
            .WithDescription("Toggle the availability of a menu item for the branch in X-Branch-Id (Pos). Without the header, Admins toggle the global flag")
            .WithTags("Items")
            .RequireAuthorization("Pos");

        api.MapPatch("/items/{id:int}/offer", SetItemOffer)
            .WithName("SetItemOffer")
            .WithSummary("Set or clear item offer")
            .WithDescription("Set or clear the offer price for a menu item (Admin only)")
            .WithTags("Items")
            .RequireAuthorization("Admin");

        // Customization endpoints
        api.MapGet("/items/{id:int}/customizations", GetItemCustomizations)
            .WithName("GetItemCustomizations")
            .WithSummary("Get item customizations")
            .WithDescription("Get all customization options for a menu item")
            .WithTags("Customizations");

        // Upload item picture
        api.MapPost("/items/{id:int}/pic", UploadItemPicture)
            .WithName("UploadItemPicture")
            .WithSummary("Upload item picture")
            .WithDescription("Upload a picture for a menu item (Admin only)")
            .WithTags("Items")
            .RequireAuthorization("Admin")
            .DisableAntiforgery();

        api.MapDelete("/items/{id:int}/pic", DeleteItemPicture)
            .WithName("DeleteItemPicture")
            .WithSummary("Delete item picture")
            .WithDescription("Delete the picture for a menu item (Admin only)")
            .WithTags("Items")
            .RequireAuthorization("Admin");

        // Customization CRUD
        api.MapPost("/items/{id:int}/customizations", CreateCustomization)
            .WithName("CreateCustomization")
            .WithSummary("Create customization group")
            .WithDescription("Create a new customization group for a menu item (Admin only)")
            .WithTags("Customizations")
            .RequireAuthorization("Admin");

        api.MapPut("/items/{id:int}/customizations/{customizationId:int}", UpdateCustomization)
            .WithName("UpdateCustomization")
            .WithSummary("Update customization group")
            .WithDescription("Update a customization group (Admin only)")
            .WithTags("Customizations")
            .RequireAuthorization("Admin");

        api.MapDelete("/items/{id:int}/customizations/{customizationId:int}", DeleteCustomization)
            .WithName("DeleteCustomization")
            .WithSummary("Delete customization group")
            .WithDescription("Delete a customization group (Admin only)")
            .WithTags("Customizations")
            .RequireAuthorization("Admin");

        // User preferences endpoints
        api.MapGet("/preferences/{catalogItemId:int}", GetUserPreference)
            .WithName("GetUserPreference")
            .WithSummary("Get user's saved preferences for a menu item")
            .WithDescription("Get the user's saved customization preferences for a specific menu item")
            .WithTags("Preferences")
            .RequireAuthorization();

        api.MapGet("/preferences/{catalogItemId:int}/for/{userId}", GetUserPreferenceForCustomer)
            .WithName("GetUserPreferenceForCustomer")
            .WithSummary("Get a specific customer's saved preferences for a menu item")
            .WithDescription("Staff-only: read a given customer's saved customization preferences for a menu item, so the till can pre-fill the customize dialog when that customer is attached to the sale.")
            .WithTags("Preferences")
            .RequireAuthorization("Pos");

        api.MapGet("/preferences", GetUserPreferences)
            .WithName("GetUserPreferences")
            .WithSummary("Get all user preferences")
            .WithDescription("Get all saved customization preferences for the current user")
            .WithTags("Preferences")
            .RequireAuthorization();

        api.MapPost("/preferences/batch", GetUserPreferencesForItems)
            .WithName("GetUserPreferencesForItems")
            .WithSummary("Get preferences for multiple items")
            .WithDescription("Get the user's saved preferences for a list of catalog item IDs")
            .WithTags("Preferences")
            .RequireAuthorization();

        api.MapPost("/preferences", SaveUserPreferences)
            .WithName("SaveUserPreferences")
            .WithSummary("Save user preferences")
            .WithDescription("Save the user's customization preferences for multiple items (called after successful order)")
            .WithTags("Preferences")
            .RequireAuthorization();

        api.MapPost("/customers/{userId}/preferences", SaveUserPreferencesForCustomer)
            .WithName("SaveUserPreferencesForCustomer")
            .WithSummary("Save a specific customer's preferences")
            .WithDescription("Staff-only: record a given customer's customization choices after a POS order, so they pre-fill next time.")
            .WithTags("Preferences")
            .RequireAuthorization("Pos");

        // Favorites endpoints
        api.MapGet("/favorites", GetUserFavorites)
            .WithName("GetUserFavorites")
            .WithSummary("Get user's favorite items")
            .WithDescription("Get the list of catalog item IDs that the user has favorited")
            .WithTags("Favorites")
            .RequireAuthorization();

        api.MapPost("/favorites/{catalogItemId:int}", AddFavorite)
            .WithName("AddFavorite")
            .WithSummary("Add item to favorites")
            .WithDescription("Add a catalog item to the user's favorites")
            .WithTags("Favorites")
            .RequireAuthorization();

        api.MapDelete("/favorites/{catalogItemId:int}", RemoveFavorite)
            .WithName("RemoveFavorite")
            .WithSummary("Remove item from favorites")
            .WithDescription("Remove a catalog item from the user's favorites")
            .WithTags("Favorites")
            .RequireAuthorization();

        // "Usuals" — a customer's most-frequently-ordered items
        api.MapGet("/top-items", GetMyTopItems)
            .WithName("GetMyTopItems")
            .WithSummary("Get my most-ordered items")
            .WithDescription("The current user's most-frequently-ordered catalog item IDs, ranked, for the customer menu's 'your usuals' section.")
            .WithTags("Preferences")
            .RequireAuthorization();

        api.MapGet("/customers/{userId}/top-items", GetCustomerTopItems)
            .WithName("GetCustomerTopItems")
            .WithSummary("Get a customer's most-ordered items")
            .WithDescription("Staff-only: a given customer's most-frequently-ordered catalog item IDs, ranked, for the till's usuals quick-pick.")
            .WithTags("Preferences")
            .RequireAuthorization("Pos");

        // Branch override endpoints (Admin)
        api.MapPut("/branches/{branchId:int}/items/{itemId:int}/override", SetBranchItemOverride)
            .WithName("SetBranchItemOverride")
            .WithSummary("Set per-branch item override")
            .WithDescription("Set availability/price override for an item at a specific branch (Admin only)")
            .WithTags("Branch Overrides")
            .RequireAuthorization("Admin");

        api.MapDelete("/branches/{branchId:int}/items/{itemId:int}/override", RemoveBranchItemOverride)
            .WithName("RemoveBranchItemOverride")
            .WithSummary("Remove per-branch item override")
            .WithDescription("Remove override so item uses global values at this branch (Admin only)")
            .WithTags("Branch Overrides")
            .RequireAuthorization("Admin");

        api.MapGet("/branches/{branchId:int}/overrides", GetBranchOverridesForBranch)
            .WithName("GetBranchOverrides")
            .WithSummary("Get all overrides for a branch")
            .WithDescription("Get all item overrides for a specific branch (Admin only)")
            .WithTags("Branch Overrides")
            .RequireAuthorization("Admin");

        return app;
    }

    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    public static async Task<Ok<List<CatalogItemDto>>> GetAllItems(
        [AsParameters] CatalogServices services,
        HttpContext httpContext,
        [Description("Filter by category")] int? categoryId = null)
    {
        var baseUrl = GetBaseUrl(httpContext);
        var branchId = httpContext.GetRequiredBranchId();

        var query = services.Context.CatalogItems
            .Include(c => c.CatalogType)
            .Include(c => c.Customizations)
                .ThenInclude(c => c.Options)
            .AsQueryable();

        if (categoryId.HasValue)
        {
            query = query.Where(c => c.CatalogTypeId == categoryId.Value);
        }

        var items = await query
            .OrderBy(c => c.CatalogType!.DisplayOrder)
            .ThenBy(c => c.DisplayOrder)
            .ToListAsync();

        var overrides = await GetBranchOverrides(services.Context, branchId, items.Select(i => i.Id));
        var optionStockOuts = await GetBranchOptionStockOuts(services.Context, branchId);
        return TypedResults.Ok(items.ToDtoList(overrides, optionStockOuts, baseUrl));
    }

    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    public static async Task<Ok<List<CatalogItemDto>>> GetAvailableItems(
        [AsParameters] CatalogServices services,
        HttpContext httpContext,
        [Description("Filter by category")] int? categoryId = null)
    {
        var baseUrl = GetBaseUrl(httpContext);
        var branchId = httpContext.GetRequiredBranchId();

        var query = services.Context.CatalogItems
            .Include(c => c.CatalogType)
            .Include(c => c.Customizations)
                .ThenInclude(c => c.Options)
            .Where(c => c.IsAvailable);

        if (categoryId.HasValue)
        {
            query = query.Where(c => c.CatalogTypeId == categoryId.Value);
        }

        var items = await query
            .OrderBy(c => c.CatalogType!.DisplayOrder)
            .ThenBy(c => c.DisplayOrder)
            .ToListAsync();

        var overrides = await GetBranchOverrides(services.Context, branchId, items.Select(i => i.Id));
        var optionStockOuts = await GetBranchOptionStockOuts(services.Context, branchId);
        var dtos = items.ToDtoList(overrides, optionStockOuts, baseUrl);
        // Filter by branch-level availability
        return TypedResults.Ok(dtos.Where(d => d.IsAvailable).ToList());
    }

    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    public static async Task<Ok<List<CatalogItemDto>>> GetItemsByIds(
        [AsParameters] CatalogServices services,
        HttpContext httpContext,
        [Description("List of ids for menu items to return")] int[] ids)
    {
        var baseUrl = GetBaseUrl(httpContext);
        var items = await services.Context.CatalogItems
            .Include(c => c.CatalogType)
            .Include(c => c.Customizations)
                .ThenInclude(c => c.Options)
            .Where(item => ids.Contains(item.Id))
            .ToListAsync();
        return TypedResults.Ok(items.ToDtoList(baseUrl));
    }

    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    public static async Task<Results<Ok<CatalogItemDto>, NotFound, BadRequest<ProblemDetails>>> GetItemById(
        [AsParameters] CatalogServices services,
        HttpContext httpContext,
        [Description("The menu item id")] int id)
    {
        if (id <= 0)
        {
            return TypedResults.BadRequest<ProblemDetails>(new()
            {
                Detail = "Id is not valid"
            });
        }

        var baseUrl = GetBaseUrl(httpContext);
        var item = await services.Context.CatalogItems
            .Include(ci => ci.CatalogType)
            .Include(ci => ci.Customizations)
                .ThenInclude(c => c.Options)
            .SingleOrDefaultAsync(ci => ci.Id == id);

        if (item == null)
        {
            return TypedResults.NotFound();
        }

        return TypedResults.Ok(item.ToDto(baseUrl));
    }

    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    public static async Task<Ok<PaginatedItemsDto<CatalogItemDto>>> GetItemsByName(
        [AsParameters] PaginationRequest paginationRequest,
        [AsParameters] CatalogServices services,
        HttpContext httpContext,
        [Description("The name to search for")] string name)
    {
        var pageSize = paginationRequest.PageSize;
        var pageIndex = paginationRequest.PageIndex;
        var baseUrl = GetBaseUrl(httpContext);

        var query = services.Context.CatalogItems
            .Include(c => c.CatalogType)
            .Include(c => c.Customizations)
                .ThenInclude(c => c.Options)
            .Where(c => c.Name.En.ToLower().Contains(name.ToLower()));

        var totalItems = await query.LongCountAsync();

        var itemsOnPage = await query
            .OrderBy(c => c.DisplayOrder)
            .Skip(pageSize * pageIndex)
            .Take(pageSize)
            .ToListAsync();

        var dtos = itemsOnPage.ToDtoList(baseUrl);
        return TypedResults.Ok(new PaginatedItemsDto<CatalogItemDto>(pageIndex, pageSize, totalItems, dtos));
    }

    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    public static async Task<Ok<PaginatedItemsDto<CatalogItemDto>>> GetItemsByType(
        [AsParameters] PaginationRequest paginationRequest,
        [AsParameters] CatalogServices services,
        HttpContext httpContext,
        [Description("The category id")] int typeId)
    {
        var pageSize = paginationRequest.PageSize;
        var pageIndex = paginationRequest.PageIndex;
        var baseUrl = GetBaseUrl(httpContext);

        var query = services.Context.CatalogItems
            .Include(c => c.CatalogType)
            .Include(c => c.Customizations)
                .ThenInclude(c => c.Options)
            .Where(c => c.CatalogTypeId == typeId);

        var totalItems = await query.LongCountAsync();

        var itemsOnPage = await query
            .OrderBy(c => c.DisplayOrder)
            .Skip(pageSize * pageIndex)
            .Take(pageSize)
            .ToListAsync();

        var dtos = itemsOnPage.ToDtoList(baseUrl);
        return TypedResults.Ok(new PaginatedItemsDto<CatalogItemDto>(pageIndex, pageSize, totalItems, dtos));
    }

    [ProducesResponseType<byte[]>(StatusCodes.Status200OK, "application/octet-stream",
        ["image/png", "image/gif", "image/jpeg", "image/bmp", "image/tiff",
          "image/wmf", "image/jp2", "image/svg+xml", "image/webp"])]
    public static async Task<Results<PhysicalFileHttpResult, NotFound>> GetItemPictureById(
        CatalogContext context,
        IWebHostEnvironment environment,
        [Description("The menu item id")] int id)
    {
        var item = await context.CatalogItems.FindAsync(id);

        if (item is null || item.PictureFileName is null)
        {
            return TypedResults.NotFound();
        }

        var path = GetFullPath(environment.ContentRootPath, item.PictureFileName);

        string imageFileExtension = Path.GetExtension(item.PictureFileName) ?? string.Empty;
        string mimetype = GetImageMimeTypeFromImageFileExtension(imageFileExtension);
        DateTime lastModified = File.GetLastWriteTimeUtc(path);

        return TypedResults.PhysicalFile(path, mimetype, lastModified: lastModified);
    }

    public static async Task<Ok<List<CatalogTypeDto>>> GetCategories(CatalogContext context)
    {
        var categories = await context.CatalogTypes.OrderBy(x => x.DisplayOrder).ToListAsync();
        return TypedResults.Ok(categories.ToDtoList());
    }

    public static async Task<Results<Ok<CatalogTypeDto>, NotFound>> GetCategoryById(
        CatalogContext context,
        [Description("The category id")] int id)
    {
        var category = await context.CatalogTypes.FindAsync(id);

        if (category is null)
        {
            return TypedResults.NotFound();
        }

        return TypedResults.Ok(category.ToDto());
    }

    public static async Task<Created<CatalogTypeDto>> CreateCategory(
        CatalogContext context,
        CatalogType category)
    {
        var newCategory = new CatalogType(category.Name) { DisplayOrder = category.DisplayOrder };
        context.CatalogTypes.Add(newCategory);
        await context.SaveChangesAsync();

        return TypedResults.Created($"/api/catalog/categories/{newCategory.Id}", newCategory.ToDto());
    }

    public static async Task<Results<Ok<CatalogTypeDto>, NotFound>> UpdateCategory(
        CatalogContext context,
        [Description("The category id")] int id,
        CatalogType categoryToUpdate)
    {
        var category = await context.CatalogTypes.FindAsync(id);

        if (category is null)
        {
            return TypedResults.NotFound();
        }

        category.Name = categoryToUpdate.Name;
        category.DisplayOrder = categoryToUpdate.DisplayOrder;
        await context.SaveChangesAsync();

        return TypedResults.Ok(category.ToDto());
    }

    public static async Task<Results<NoContent, NotFound, Conflict<ProblemDetails>>> DeleteCategory(
        CatalogContext context,
        [Description("The category id")] int id)
    {
        var category = await context.CatalogTypes.FindAsync(id);

        if (category is null)
        {
            return TypedResults.NotFound();
        }

        // Check if any items use this category
        var hasItems = await context.CatalogItems.AnyAsync(i => i.CatalogTypeId == id);
        if (hasItems)
        {
            return TypedResults.Conflict<ProblemDetails>(new()
            {
                Detail = "Cannot delete category that has menu items. Move or delete the items first."
            });
        }

        context.CatalogTypes.Remove(category);
        await context.SaveChangesAsync();

        return TypedResults.NoContent();
    }

    public static async Task<Ok> ReorderCategories(
        CatalogContext context,
        [FromBody] ReorderRequest request)
    {
        var ids = request.Items.Select(i => i.Id).ToList();
        var categories = await context.CatalogTypes
            .Where(c => ids.Contains(c.Id))
            .ToListAsync();

        foreach (var item in request.Items)
        {
            var category = categories.FirstOrDefault(c => c.Id == item.Id);
            if (category != null)
            {
                category.DisplayOrder = item.DisplayOrder;
            }
        }

        await context.SaveChangesAsync();
        return TypedResults.Ok();
    }

    public static async Task<Ok> ReorderItems(
        CatalogContext context,
        [FromBody] ReorderRequest request)
    {
        var ids = request.Items.Select(i => i.Id).ToList();
        var items = await context.CatalogItems
            .Where(c => ids.Contains(c.Id))
            .ToListAsync();

        foreach (var item in request.Items)
        {
            var catalogItem = items.FirstOrDefault(c => c.Id == item.Id);
            if (catalogItem != null)
            {
                catalogItem.DisplayOrder = item.DisplayOrder;
            }
        }

        await context.SaveChangesAsync();
        return TypedResults.Ok();
    }

    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    public static async Task<Created<CatalogItemDto>> CreateItem(
        [AsParameters] CatalogServices services,
        HttpContext httpContext,
        CatalogItem product)
    {
        var item = new CatalogItem(product.Name)
        {
            CatalogTypeId = product.CatalogTypeId,
            Description = product.Description,
            PictureFileName = product.PictureFileName,
            Price = product.Price,
            IsAvailable = product.IsAvailable,
            IsOnOffer = product.IsOnOffer,
            OfferPrice = product.OfferPrice,
            IsPopular = product.IsPopular,
            PreparationTimeMinutes = product.PreparationTimeMinutes,
            DisplayOrder = product.DisplayOrder
        };

        services.Context.CatalogItems.Add(item);
        await services.Context.SaveChangesAsync();

        // Return the created item, as the category, customization and bundle
        // endpoints do. Callers need its id to follow up - uploading the
        // item's picture, for one - and a bodyless 201 left them nothing.
        return TypedResults.Created(
            $"/api/catalog/items/{item.Id}",
            item.ToDto(GetBaseUrl(httpContext)));
    }

    public static async Task<Results<Ok, NotFound<ProblemDetails>>> UpdateItem(
        [Description("The id of the menu item to update")] int id,
        [AsParameters] CatalogServices services,
        UpdateCatalogItemRequest productToUpdate)
    {
        var catalogItem = await services.Context.CatalogItems.SingleOrDefaultAsync(i => i.Id == id);

        if (catalogItem == null)
        {
            return TypedResults.NotFound<ProblemDetails>(new()
            {
                Detail = $"Item with id {id} not found."
            });
        }

        // Update properties (PictureFileName is managed separately via the upload endpoint)
        catalogItem.Name = productToUpdate.Name;
        catalogItem.Description = productToUpdate.Description;
        catalogItem.Price = productToUpdate.Price;
        catalogItem.CatalogTypeId = productToUpdate.CatalogTypeId;
        catalogItem.IsAvailable = productToUpdate.IsAvailable;
        catalogItem.IsOnOffer = productToUpdate.IsOnOffer;
        catalogItem.OfferPrice = productToUpdate.OfferPrice;
        // The offer's window: every day and all day unless both hours parse
        catalogItem.OfferWeekdays = productToUpdate.OfferWeekdays is > 0 ? productToUpdate.OfferWeekdays : null;
        TryParseWindow(productToUpdate.OfferFrom, productToUpdate.OfferTo, out var offerFrom, out var offerTo);
        catalogItem.OfferFrom = offerFrom;
        catalogItem.OfferTo = offerTo;
        catalogItem.IsPopular = productToUpdate.IsPopular;
        catalogItem.PreparationTimeMinutes = productToUpdate.PreparationTimeMinutes;
        // DisplayOrder is owned by /items/reorder: an edit must never reshuffle the menu

        var priceChanged = services.Context.Entry(catalogItem).Property(i => i.Price).IsModified;

        if (priceChanged)
        {
            var originalPrice = services.Context.Entry(catalogItem).Property(i => i.Price).OriginalValue;
            var priceChangedEvent = new ProductPriceChangedIntegrationEvent(catalogItem.Id, productToUpdate.Price, originalPrice);
            await services.EventService.SaveEventAndCatalogContextChangesAsync(priceChangedEvent);
            await services.EventService.PublishThroughEventBusAsync(priceChangedEvent);
        }
        else
        {
            await services.Context.SaveChangesAsync();
        }

        return TypedResults.Ok();
    }

    public static async Task<Results<NoContent, NotFound>> DeleteItemById(
        [AsParameters] CatalogServices services,
        [Description("The id of the menu item to delete")] int id)
    {
        var item = await services.Context.CatalogItems.SingleOrDefaultAsync(x => x.Id == id);

        if (item is null)
        {
            return TypedResults.NotFound();
        }

        services.Context.CatalogItems.Remove(item);
        await services.Context.SaveChangesAsync();
        return TypedResults.NoContent();
    }

    public static async Task<Results<Ok<CatalogItemDto>, NotFound, BadRequest<ProblemDetails>>> ToggleItemAvailability(
        [AsParameters] CatalogServices services,
        HttpContext httpContext,
        [Description("The id of the menu item")] int id,
        [FromBody] SetAvailabilityRequest? request = null)
    {
        var branchId = httpContext.GetBranchId();

        // The till only ever marks an item sold out at its own branch; the
        // global flag stays a back-office decision.
        if (!branchId.HasValue &&
            !httpContext.User.GetRoles().Contains("Admin", StringComparer.OrdinalIgnoreCase))
        {
            return TypedResults.BadRequest<ProblemDetails>(new()
            {
                Detail = $"{BranchHeaderExtensions.HeaderName} required"
            });
        }

        var item = await services.Context.CatalogItems
            .Include(c => c.CatalogType)
            .Include(c => c.Customizations)
                .ThenInclude(c => c.Options)
            .SingleOrDefaultAsync(x => x.Id == id);

        if (item is null)
        {
            return TypedResults.NotFound();
        }

        var baseUrl = GetBaseUrl(httpContext);

        if (branchId.HasValue)
        {
            // Branch-scoped: create/update a BranchItemOverride
            var existing = await services.Context.BranchItemOverrides
                .FirstOrDefaultAsync(o => o.BranchId == branchId.Value && o.CatalogItemId == id);

            var newAvailability = request?.IsAvailable ?? !(existing?.IsAvailable ?? item.IsAvailable);

            if (existing != null)
            {
                existing.IsAvailable = newAvailability;
                // Marking it available by hand overrides Inventory's stock-out
                // ("we found a box in the back"); it comes back on the next stock event
                if (newAvailability)
                {
                    existing.IsOutOfStock = false;
                }
            }
            else
            {
                existing = new BranchItemOverride
                {
                    BranchId = branchId.Value,
                    CatalogItemId = id,
                    IsAvailable = newAvailability,
                };
                services.Context.BranchItemOverrides.Add(existing);
            }

            // A branch can only restrict (by hand or by an Inventory stock-out),
            // so the event carries the effective state the branch's menus now show
            var branchChangedEvent = new CatalogItemAvailabilityChangedIntegrationEvent(
                id, branchId.Value, item.IsAvailable && newAvailability && !existing.IsOutOfStock);
            await services.EventService.SaveEventAndCatalogContextChangesAsync(branchChangedEvent);
            await services.EventService.PublishThroughEventBusAsync(branchChangedEvent);
            var optionStockOuts = await GetBranchOptionStockOuts(services.Context, branchId.Value);
            return TypedResults.Ok(item.ToDto(existing, optionStockOuts, baseUrl));
        }

        // No branch header: modify global availability
        item.IsAvailable = request?.IsAvailable ?? !item.IsAvailable;

        var globalChangedEvent = new CatalogItemAvailabilityChangedIntegrationEvent(id, null, item.IsAvailable);
        await services.EventService.SaveEventAndCatalogContextChangesAsync(globalChangedEvent);
        await services.EventService.PublishThroughEventBusAsync(globalChangedEvent);

        return TypedResults.Ok(item.ToDto(baseUrl));
    }

    public static async Task<Results<Ok<CatalogItemDto>, NotFound, BadRequest<ProblemDetails>>> SetItemOffer(
        [AsParameters] CatalogServices services,
        HttpContext httpContext,
        [Description("The id of the menu item")] int id,
        [FromBody] SetItemOfferRequest request)
    {
        var item = await services.Context.CatalogItems
            .Include(c => c.CatalogType)
            .Include(c => c.Customizations)
                .ThenInclude(c => c.Options)
            .SingleOrDefaultAsync(x => x.Id == id);

        if (item is null)
        {
            return TypedResults.NotFound();
        }

        if (request.IsOnOffer)
        {
            if (!request.OfferPrice.HasValue || request.OfferPrice.Value <= 0)
            {
                return TypedResults.BadRequest<ProblemDetails>(new()
                {
                    Detail = "Offer price must be greater than 0"
                });
            }
            if (request.OfferPrice.Value >= item.Price)
            {
                return TypedResults.BadRequest<ProblemDetails>(new()
                {
                    Detail = "Offer price must be less than the regular price"
                });
            }
        }

        if (!TryParseWindow(request.OfferFrom, request.OfferTo, out var offerFrom, out var offerTo))
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The offer hours are a pair of HH:mm times, or neither" });
        }

        // The window is the item's, chain-wide; a branch overrides only the switch and the price
        item.OfferWeekdays = request.OfferWeekdays is > 0 ? request.OfferWeekdays : null;
        item.OfferFrom = offerFrom;
        item.OfferTo = offerTo;

        var baseUrl = GetBaseUrl(httpContext);
        var branchId = httpContext.GetBranchId();

        if (branchId.HasValue)
        {
            // Branch-scoped: create/update a BranchItemOverride
            var existing = await services.Context.BranchItemOverrides
                .FirstOrDefaultAsync(o => o.BranchId == branchId.Value && o.CatalogItemId == id);

            if (existing != null)
            {
                existing.IsOnOfferOverride = request.IsOnOffer;
                existing.OfferPriceOverride = request.IsOnOffer ? request.OfferPrice : null;
            }
            else
            {
                existing = new BranchItemOverride
                {
                    BranchId = branchId.Value,
                    CatalogItemId = id,
                    IsAvailable = item.IsAvailable,
                    IsOnOfferOverride = request.IsOnOffer,
                    OfferPriceOverride = request.IsOnOffer ? request.OfferPrice : null,
                };
                services.Context.BranchItemOverrides.Add(existing);
            }

            await services.Context.SaveChangesAsync();
            var optionStockOuts = await GetBranchOptionStockOuts(services.Context, branchId.Value);
            return TypedResults.Ok(item.ToDto(existing, optionStockOuts, baseUrl));
        }

        // No branch header: modify global offer
        item.IsOnOffer = request.IsOnOffer;
        item.OfferPrice = request.IsOnOffer ? request.OfferPrice : null;
        await services.Context.SaveChangesAsync();

        return TypedResults.Ok(item.ToDto(baseUrl));
    }

    public static async Task<Results<Ok<List<ItemCustomizationDto>>, NotFound>> GetItemCustomizations(
        [AsParameters] CatalogServices services,
        HttpContext httpContext,
        [Description("The id of the menu item")] int id)
    {
        var item = await services.Context.CatalogItems.SingleOrDefaultAsync(x => x.Id == id);

        if (item is null)
        {
            return TypedResults.NotFound();
        }

        var customizations = await services.Context.ItemCustomizations
            .Include(c => c.Options.OrderBy(o => o.DisplayOrder))
            .Where(c => c.CatalogItemId == id)
            .OrderBy(c => c.DisplayOrder)
            .ToListAsync();

        // Branch-optional: with the header the options carry that branch's
        // stock-outs (what admin's customizations sheet shows); without it
        // the flag stays false
        var branchId = httpContext.GetBranchId();
        if (branchId is null)
        {
            return TypedResults.Ok(customizations.ToDtoList());
        }

        var optionStockOuts = await GetBranchOptionStockOuts(services.Context, branchId.Value);
        return TypedResults.Ok(customizations.ToDtoList(optionStockOuts));
    }

    // Upload picture handler
    public static async Task<Results<Ok<string>, NotFound, BadRequest<ProblemDetails>>> UploadItemPicture(
        [AsParameters] CatalogServices services,
        IWebHostEnvironment environment,
        [Description("The menu item id")] int id,
        IFormFile file)
    {
        var item = await services.Context.CatalogItems.FindAsync(id);
        if (item is null) return TypedResults.NotFound();

        // Validate file type
        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(extension))
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "Invalid file type. Allowed types: jpg, jpeg, png, webp" });
        }

        // Delete old file if exists
        if (!string.IsNullOrEmpty(item.PictureFileName))
        {
            var oldPath = GetFullPath(environment.ContentRootPath, item.PictureFileName);
            if (File.Exists(oldPath)) File.Delete(oldPath);
        }

        // Save file with timestamp to bust client caches
        var fileName = $"{id}_{DateTimeOffset.UtcNow.Ticks}{extension}";
        var path = GetFullPath(environment.ContentRootPath, fileName);
        using var stream = new FileStream(path, FileMode.Create);
        await file.CopyToAsync(stream);

        // Update item
        item.PictureFileName = fileName;
        await services.Context.SaveChangesAsync();

        return TypedResults.Ok(fileName);
    }

    // Delete picture handler
    public static async Task<Results<NoContent, NotFound>> DeleteItemPicture(
        [AsParameters] CatalogServices services,
        IWebHostEnvironment environment,
        [Description("The menu item id")] int id)
    {
        var item = await services.Context.CatalogItems.FindAsync(id);
        if (item is null) return TypedResults.NotFound();

        if (!string.IsNullOrEmpty(item.PictureFileName))
        {
            var path = GetFullPath(environment.ContentRootPath, item.PictureFileName);
            if (File.Exists(path))
            {
                File.Delete(path);
            }
            item.PictureFileName = null;
            await services.Context.SaveChangesAsync();
        }

        return TypedResults.NoContent();
    }

    // Create customization handler
    public static async Task<Results<Created<ItemCustomizationDto>, NotFound>> CreateCustomization(
        [AsParameters] CatalogServices services,
        [Description("The menu item id")] int id,
        ItemCustomization customization)
    {
        var item = await services.Context.CatalogItems.FindAsync(id);
        if (item is null) return TypedResults.NotFound();

        var newCustomization = new ItemCustomization(customization.Name)
        {
            CatalogItemId = id,
            IsRequired = customization.IsRequired,
            AllowMultiple = customization.AllowMultiple,
            DisplayOrder = customization.DisplayOrder
        };

        foreach (var option in customization.Options)
        {
            newCustomization.Options.Add(new CustomizationOption(option.Name)
            {
                PriceAdjustment = option.PriceAdjustment,
                IsDefault = option.IsDefault,
                DisplayOrder = option.DisplayOrder
            });
        }

        services.Context.ItemCustomizations.Add(newCustomization);
        await services.Context.SaveChangesAsync();

        return TypedResults.Created($"/api/catalog/items/{id}/customizations/{newCustomization.Id}", newCustomization.ToDto());
    }

    // Update customization handler
    public static async Task<Results<Ok<ItemCustomizationDto>, NotFound>> UpdateCustomization(
        [AsParameters] CatalogServices services,
        [Description("The menu item id")] int id,
        [Description("The customization id")] int customizationId,
        ItemCustomization customizationToUpdate)
    {
        var customization = await services.Context.ItemCustomizations
            .Include(c => c.Options)
            .FirstOrDefaultAsync(c => c.Id == customizationId && c.CatalogItemId == id);

        if (customization is null) return TypedResults.NotFound();

        customization.Name = customizationToUpdate.Name;
        customization.IsRequired = customizationToUpdate.IsRequired;
        customization.AllowMultiple = customizationToUpdate.AllowMultiple;
        customization.DisplayOrder = customizationToUpdate.DisplayOrder;

        // Replace options
        services.Context.CustomizationOptions.RemoveRange(customization.Options);
        customization.Options.Clear();

        foreach (var option in customizationToUpdate.Options)
        {
            customization.Options.Add(new CustomizationOption(option.Name)
            {
                PriceAdjustment = option.PriceAdjustment,
                IsDefault = option.IsDefault,
                DisplayOrder = option.DisplayOrder
            });
        }

        await services.Context.SaveChangesAsync();
        return TypedResults.Ok(customization.ToDto());
    }

    // Delete customization handler
    public static async Task<Results<NoContent, NotFound>> DeleteCustomization(
        [AsParameters] CatalogServices services,
        [Description("The menu item id")] int id,
        [Description("The customization id")] int customizationId)
    {
        var customization = await services.Context.ItemCustomizations
            .FirstOrDefaultAsync(c => c.Id == customizationId && c.CatalogItemId == id);

        if (customization is null) return TypedResults.NotFound();

        services.Context.ItemCustomizations.Remove(customization);
        await services.Context.SaveChangesAsync();
        return TypedResults.NoContent();
    }

    private static string GetImageMimeTypeFromImageFileExtension(string extension) => extension switch
    {
        ".png" => "image/png",
        ".gif" => "image/gif",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".bmp" => "image/bmp",
        ".tiff" => "image/tiff",
        ".wmf" => "image/wmf",
        ".jp2" => "image/jp2",
        ".svg" => "image/svg+xml",
        ".webp" => "image/webp",
        _ => "application/octet-stream",
    };

    public static string GetFullPath(string contentRootPath, string pictureFileName) =>
        Path.Combine(contentRootPath, "Pics", pictureFileName);

    /// <summary>"HH:mm" and "HH:mm", or neither; anything else is a bad request.</summary>
    private static bool TryParseWindow(string? fromText, string? toText, out TimeOnly? from, out TimeOnly? to)
    {
        from = null;
        to = null;

        if (string.IsNullOrWhiteSpace(fromText) && string.IsNullOrWhiteSpace(toText))
            return true;

        if (!TimeOnly.TryParseExact(fromText, "HH:mm", out var f) || !TimeOnly.TryParseExact(toText, "HH:mm", out var t))
            return false;

        from = f;
        to = t;
        return true;
    }

    private static string GetBaseUrl(HttpContext httpContext)
    {
        // The public address, when one is configured: behind Caddy and the
        // YARP BFF the forwarded scheme arrives as the BFF's own (http), and
        // picture links built from it are refused by iOS and by browsers on
        // an https page. Production pins it; development derives it below.
        var configured = httpContext.RequestServices.GetRequiredService<IOptions<CatalogOptions>>().Value.PicBaseUrl;
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return configured.TrimEnd('/');
        }

        var request = httpContext.Request;

        // Check for forwarded headers (when behind a reverse proxy like YARP)
        var forwardedHost = request.Headers["X-Forwarded-Host"].FirstOrDefault();
        var forwardedProto = request.Headers["X-Forwarded-Proto"].FirstOrDefault();

        if (!string.IsNullOrEmpty(forwardedHost))
        {
            var scheme = forwardedProto ?? request.Scheme;
            return $"{scheme}://{forwardedHost}";
        }

        return $"{request.Scheme}://{request.Host}";
    }

    // User preferences handlers
    public static async Task<Results<Ok<UserItemPreferenceDto>, NotFound>> GetUserPreference(
        [AsParameters] CatalogServices services,
        ClaimsPrincipal user,
        [Description("The catalog item id")] int catalogItemId)
    {
        var userId = user.GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return TypedResults.NotFound();
        }

        var preference = await services.Context.UserItemPreferences
            .Include(p => p.SelectedOptions)
            .FirstOrDefaultAsync(p => p.UserId == userId && p.CatalogItemId == catalogItemId);

        if (preference == null)
        {
            return TypedResults.NotFound();
        }

        return TypedResults.Ok(preference.ToDto());
    }

    // Staff read a specific customer's saved preferences (the cashier is
    // signed in, not the customer, so we take the customer id from the route
    // rather than the token). Guarded by the "Pos" policy.
    public static async Task<Results<Ok<UserItemPreferenceDto>, NotFound>> GetUserPreferenceForCustomer(
        [AsParameters] CatalogServices services,
        [Description("The catalog item id")] int catalogItemId,
        [Description("The customer's identity id")] string userId)
    {
        if (string.IsNullOrEmpty(userId))
        {
            return TypedResults.NotFound();
        }

        var preference = await services.Context.UserItemPreferences
            .Include(p => p.SelectedOptions)
            .FirstOrDefaultAsync(p => p.UserId == userId && p.CatalogItemId == catalogItemId);

        if (preference == null)
        {
            return TypedResults.NotFound();
        }

        return TypedResults.Ok(preference.ToDto());
    }

    public static async Task<Ok<List<UserItemPreferenceDto>>> GetUserPreferences(
        [AsParameters] CatalogServices services,
        ClaimsPrincipal user)
    {
        var userId = user.GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return TypedResults.Ok(new List<UserItemPreferenceDto>());
        }

        var preferences = await services.Context.UserItemPreferences
            .Include(p => p.SelectedOptions)
            .Where(p => p.UserId == userId)
            .ToListAsync();

        return TypedResults.Ok(preferences.ToDtoList());
    }

    public static async Task<Ok<List<UserItemPreferenceDto>>> GetUserPreferencesForItems(
        [AsParameters] CatalogServices services,
        ClaimsPrincipal user,
        [FromBody] int[] catalogItemIds)
    {
        var userId = user.GetUserId();
        if (string.IsNullOrEmpty(userId) || catalogItemIds.Length == 0)
        {
            return TypedResults.Ok(new List<UserItemPreferenceDto>());
        }

        var preferences = await services.Context.UserItemPreferences
            .Include(p => p.SelectedOptions)
            .Where(p => p.UserId == userId && catalogItemIds.Contains(p.CatalogItemId))
            .ToListAsync();

        return TypedResults.Ok(preferences.ToDtoList());
    }

    public static async Task<Ok> SaveUserPreferences(
        [AsParameters] CatalogServices services,
        ClaimsPrincipal user,
        [FromBody] SaveUserPreferencesRequest request)
    {
        var userId = user.GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return TypedResults.Ok();
        }

        await SavePreferencesForUserAsync(services.Context, userId, request);
        return TypedResults.Ok();
    }

    // Staff save a specific customer's preferences (the till, after a POS order
    // for an attached customer, records how the cashier customized their items —
    // so it prefills next time, the same as the customer app does for its own
    // orders). Guarded by "Pos".
    public static async Task<Ok> SaveUserPreferencesForCustomer(
        [AsParameters] CatalogServices services,
        [Description("The customer's identity id")] string userId,
        [FromBody] SaveUserPreferencesRequest request)
    {
        if (string.IsNullOrEmpty(userId))
        {
            return TypedResults.Ok();
        }

        await SavePreferencesForUserAsync(services.Context, userId, request);
        return TypedResults.Ok();
    }

    // Upsert one user's saved customization options, last-write-wins per item.
    // Shared by the token-scoped and the staff (for-customer) save endpoints.
    private static async Task SavePreferencesForUserAsync(
        CatalogContext context, string userId, SaveUserPreferencesRequest request)
    {
        if (request.Items.Count == 0)
        {
            return;
        }

        foreach (var item in request.Items)
        {
            if (item.SelectedOptions.Count == 0)
            {
                continue;
            }

            var existingPreference = await context.UserItemPreferences
                .Include(p => p.SelectedOptions)
                .FirstOrDefaultAsync(p =>
                    p.UserId == userId &&
                    p.CatalogItemId == item.CatalogItemId);

            if (existingPreference != null)
            {
                context.UserPreferenceOptions.RemoveRange(existingPreference.SelectedOptions);
                existingPreference.SelectedOptions.Clear();
                foreach (var option in item.SelectedOptions)
                {
                    existingPreference.SelectedOptions.Add(new Model.UserPreferenceOption
                    {
                        CustomizationId = option.CustomizationId,
                        OptionId = option.OptionId
                    });
                }
                existingPreference.LastUpdated = DateTime.UtcNow;
            }
            else
            {
                var newPreference = new Model.UserItemPreference
                {
                    UserId = userId,
                    CatalogItemId = item.CatalogItemId,
                    LastUpdated = DateTime.UtcNow
                };
                foreach (var option in item.SelectedOptions)
                {
                    newPreference.SelectedOptions.Add(new Model.UserPreferenceOption
                    {
                        CustomizationId = option.CustomizationId,
                        OptionId = option.OptionId
                    });
                }
                context.UserItemPreferences.Add(newPreference);
            }
        }

        await context.SaveChangesAsync();
    }

    // Favorites handlers
    public static async Task<Ok<List<int>>> GetUserFavorites(
        [AsParameters] CatalogServices services,
        ClaimsPrincipal user)
    {
        var userId = user.GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return TypedResults.Ok(new List<int>());
        }

        var favoriteIds = await services.Context.UserItemFavorites
            .Where(f => f.UserId == userId)
            .OrderByDescending(f => f.AddedAt)
            .Select(f => f.CatalogItemId)
            .ToListAsync();

        return TypedResults.Ok(favoriteIds);
    }

    // "Usuals" handlers ------------------------------------------------------

    /// <summary>
    /// An item must have been ordered on at least this many separate orders to
    /// count as a "usual" — a one-off or two never shows, only what a frequent
    /// customer actually reorders.
    /// </summary>
    private const int MinOrdersForUsual = 3;

    /// <summary>How many ranked ids to return at most; the front-ends render the ones they carry.</summary>
    private const int TopItemsLimit = 12;

    // A customer's most-frequently-ordered items: grouped by item, kept only
    // when ordered on >= MinOrdersForUsual orders, ranked by order count then
    // recency. Ids only — every front-end already holds the branch-priced item
    // list in memory and maps ids to its own tiles.
    private static Task<List<int>> RankTopItemsAsync(CatalogContext context, string userId, int max)
    {
        return context.CustomerItemPurchases
            .Where(p => p.UserId == userId)
            .GroupBy(p => p.CatalogItemId)
            .Where(g => g.Count() >= MinOrdersForUsual)
            .OrderByDescending(g => g.Count())
            .ThenByDescending(g => g.Max(p => p.OrderedAt))
            .Select(g => g.Key)
            .Take(max)
            .ToListAsync();
    }

    public static async Task<Ok<List<int>>> GetMyTopItems(
        [AsParameters] CatalogServices services,
        ClaimsPrincipal user)
    {
        var userId = user.GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return TypedResults.Ok(new List<int>());
        }

        var ids = await RankTopItemsAsync(services.Context, userId, TopItemsLimit);
        return TypedResults.Ok(ids);
    }

    public static async Task<Ok<List<int>>> GetCustomerTopItems(
        [AsParameters] CatalogServices services,
        [Description("The customer's identity id")] string userId)
    {
        if (string.IsNullOrEmpty(userId))
        {
            return TypedResults.Ok(new List<int>());
        }

        var ids = await RankTopItemsAsync(services.Context, userId, TopItemsLimit);
        return TypedResults.Ok(ids);
    }

    public static async Task<Results<Ok, NotFound>> AddFavorite(
        [AsParameters] CatalogServices services,
        ClaimsPrincipal user,
        [Description("The catalog item id to add to favorites")] int catalogItemId)
    {
        var userId = user.GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return TypedResults.NotFound();
        }

        // Check if item exists
        var itemExists = await services.Context.CatalogItems.AnyAsync(i => i.Id == catalogItemId);
        if (!itemExists)
        {
            return TypedResults.NotFound();
        }

        // Check if already favorited
        var existingFavorite = await services.Context.UserItemFavorites
            .FirstOrDefaultAsync(f => f.UserId == userId && f.CatalogItemId == catalogItemId);

        if (existingFavorite == null)
        {
            var favorite = new Model.UserItemFavorite
            {
                UserId = userId,
                CatalogItemId = catalogItemId,
                AddedAt = DateTime.UtcNow
            };
            services.Context.UserItemFavorites.Add(favorite);
            await services.Context.SaveChangesAsync();
        }

        return TypedResults.Ok();
    }

    public static async Task<Results<Ok, NotFound>> RemoveFavorite(
        [AsParameters] CatalogServices services,
        ClaimsPrincipal user,
        [Description("The catalog item id to remove from favorites")] int catalogItemId)
    {
        var userId = user.GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return TypedResults.NotFound();
        }

        var favorite = await services.Context.UserItemFavorites
            .FirstOrDefaultAsync(f => f.UserId == userId && f.CatalogItemId == catalogItemId);

        if (favorite == null)
        {
            return TypedResults.NotFound();
        }

        services.Context.UserItemFavorites.Remove(favorite);
        await services.Context.SaveChangesAsync();

        return TypedResults.Ok();
    }

    // Branch override handlers
    public static async Task<Results<Ok<BranchItemOverrideDto>, NotFound>> SetBranchItemOverride(
        [AsParameters] CatalogServices services,
        [Description("The branch ID")] int branchId,
        [Description("The catalog item ID")] int itemId,
        BranchItemOverrideRequest request)
    {
        var item = await services.Context.CatalogItems.FindAsync(itemId);
        if (item == null)
            return TypedResults.NotFound();

        var existing = await services.Context.BranchItemOverrides
            .FirstOrDefaultAsync(o => o.BranchId == branchId && o.CatalogItemId == itemId);

        if (existing != null)
        {
            existing.IsAvailable = request.IsAvailable;
            existing.PriceOverride = request.PriceOverride;
            existing.OfferPriceOverride = request.OfferPriceOverride;
            existing.IsOnOfferOverride = request.IsOnOfferOverride;
        }
        else
        {
            existing = new BranchItemOverride
            {
                BranchId = branchId,
                CatalogItemId = itemId,
                IsAvailable = request.IsAvailable,
                PriceOverride = request.PriceOverride,
                OfferPriceOverride = request.OfferPriceOverride,
                IsOnOfferOverride = request.IsOnOfferOverride
            };
            services.Context.BranchItemOverrides.Add(existing);
        }

        await services.Context.SaveChangesAsync();

        return TypedResults.Ok(new BranchItemOverrideDto(
            existing.Id, existing.BranchId, existing.CatalogItemId,
            existing.IsAvailable, existing.IsOutOfStock, existing.PriceOverride,
            existing.OfferPriceOverride, existing.IsOnOfferOverride));
    }

    public static async Task<Results<NoContent, NotFound>> RemoveBranchItemOverride(
        [AsParameters] CatalogServices services,
        [Description("The branch ID")] int branchId,
        [Description("The catalog item ID")] int itemId)
    {
        var existing = await services.Context.BranchItemOverrides
            .FirstOrDefaultAsync(o => o.BranchId == branchId && o.CatalogItemId == itemId);

        if (existing == null)
            return TypedResults.NotFound();

        services.Context.BranchItemOverrides.Remove(existing);
        await services.Context.SaveChangesAsync();

        return TypedResults.NoContent();
    }

    public static async Task<Ok<List<BranchItemOverrideDto>>> GetBranchOverridesForBranch(
        [AsParameters] CatalogServices services,
        [Description("The branch ID")] int branchId)
    {
        var overrides = await services.Context.BranchItemOverrides
            .AsNoTracking()
            .Where(o => o.BranchId == branchId)
            .Select(o => new BranchItemOverrideDto(
                o.Id, o.BranchId, o.CatalogItemId,
                o.IsAvailable, o.IsOutOfStock, o.PriceOverride,
                o.OfferPriceOverride, o.IsOnOfferOverride))
            .ToListAsync();

        return TypedResults.Ok(overrides);
    }

    /// <summary>
    /// Helper to load branch overrides for a set of item IDs.
    /// </summary>
    private static async Task<Dictionary<int, BranchItemOverride>> GetBranchOverrides(
        CatalogContext context, int branchId, IEnumerable<int> itemIds)
    {
        return await context.BranchItemOverrides
            .Where(o => o.BranchId == branchId && itemIds.Contains(o.CatalogItemId))
            .ToDictionaryAsync(o => o.CatalogItemId);
    }

    /// <summary>
    /// Helper to load the ids of every customization option Inventory has
    /// marked sold out at a branch (one small query per request).
    /// </summary>
    private static async Task<IReadOnlySet<int>> GetBranchOptionStockOuts(CatalogContext context, int branchId)
    {
        var ids = await context.BranchOptionStockOuts
            .Where(s => s.BranchId == branchId)
            .Select(s => s.CustomizationOptionId)
            .ToListAsync();
        return ids.ToHashSet();
    }
}
