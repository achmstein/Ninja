using System.ComponentModel;
using System.Globalization;
using System.Text;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;

namespace Ninja.Assistant.API.Tools;

/// <summary>
/// The menu as the owner keeps it from chat: a dish's names, price and
/// category, its offer, a branch's own price, the categories, the choices on
/// a dish, promo codes and a dish's stock recipe. Setup only: nothing here
/// deletes, and nothing moves money. Each tool previews first and writes on
/// the confirm; a preview with the services' AI in it (a name filled in the
/// other language, suggested choices, a proposed recipe) travels to the
/// confirm as a signed draft, so what is written is what the owner saw.
/// </summary>
[McpServerToolType]
public sealed class MenuEditTools(TenantContext tenant, NinjaApiClient api, WriteFlow flow)
{
    private const string Catalog = "catalog-api";
    private const string Inventory = "inventory-api";

    internal const string UpdateItemTool = "update_menu_item";
    internal const string OfferTool = "set_item_offer";
    internal const string BranchPriceTool = "set_branch_price";
    internal const string CreateCategoryTool = "create_category";
    internal const string RenameCategoryTool = "rename_category";
    internal const string EditCustomizationTool = "edit_customization";
    internal const string AddCustomizationsTool = "add_customizations";
    internal const string CreatePromoTool = "create_promo_code";
    internal const string UpdatePromoTool = "update_promo_code";
    internal const string PromoActiveTool = "set_promo_active";
    internal const string RecipeTool = "set_recipe";

    // --- A dish ---------------------------------------------------------------

    [McpServerTool(Name = UpdateItemTool, Title = "Change a dish on the menu", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Changes a dish already on the menu: its English or Arabic name, its description, its price (the chain's own; set_branch_price changes one branch's), its category, the popular mark or the preparation time. Anything not given stays as it is. " +
        "Use for 'raise the latte to 55', 'move the brownie to Desserts', 'the Arabic name of the cold brew is كولد برو', 'mark the burger popular'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> UpdateMenuItem(
        [Description("The dish: its name in English or Arabic, or its id")] string item,
        [Description("Its new English name")] string? name = null,
        [Description("Its new Arabic name")] string? nameAr = null,
        [Description("Its new English description")] string? description = null,
        [Description("Its new Arabic description")] string? descriptionAr = null,
        [Description("Its new price, in the business's currency")] decimal? price = null,
        [Description("The category to move it to: an existing one's name (English or Arabic) or id. create_category makes a new one.")] string? category = null,
        [Description("true to mark it popular on the menu, false to unmark it")] bool? popular = null,
        [Description("Minutes it takes to prepare; 0 clears it")] int? prepMinutes = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (name is null && nameAr is null && description is null && descriptionAr is null && price is null && category is null && popular is null && prepMinutes is null)
            return ToolResults.Fail("Say what to change: a name, the description, the price, the category, popular or the preparation time.");
        if (price is < 0) return ToolResults.Fail("The price cannot be negative.");
        if (prepMinutes is < 0) return ToolResults.Fail("The preparation time cannot be negative.");

        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var (dish, missing) = await FindItemAsync(snap, item, ct);
        if (dish is null) return ToolResults.Fail(missing!);
        var chain = Chain(dish);

        var categoryId = dish.CatalogTypeId;
        LocalizedText? newCategory = null;
        if (!string.IsNullOrWhiteSpace(category))
        {
            var categories = await api.GetAsync<List<CategoryDto>>(Catalog, "/api/catalog/categories", AnyBranch(snap), ct);
            if (!categories.IsOk) return ToolResults.Fail(categories.Error!);
            var (picked, error) = NameResolver.Pick(categories.Value!, category, c => c.Id, c => c.Name, "category");
            if (picked is null) return ToolResults.Fail(error + " create_category makes a new one.");
            categoryId = picked.Id;
            newCategory = picked.Name;
        }

        var oldName = dish.Name ?? new LocalizedText(null, null);
        var oldDescription = dish.Description ?? new LocalizedText(null, null);
        var newName = new LocalizedText(MenuWriteTools.Clean(name) ?? oldName.En, MenuWriteTools.Clean(nameAr) ?? oldName.Ar);
        var newDescription = new LocalizedText(description is null ? oldDescription.En : MenuWriteTools.Clean(description), descriptionAr is null ? oldDescription.Ar : MenuWriteTools.Clean(descriptionAr));
        var newPrice = price ?? chain.Price;
        var newPopular = popular ?? dish.IsPopular;
        var newPrep = prepMinutes is null ? dish.PreparationTimeMinutes : prepMinutes == 0 ? null : prepMinutes;

        // Catalog checks an offer against the price only when the offer is set, so the price is checked here
        if (chain.IsOnOffer && chain.OfferPrice is { } offer && newPrice <= offer)
            return ToolResults.Fail($"\"{oldName.Both}\" is on offer at {snap.Currency} {ToolResults.Money(offer)}; its price must stay above that. End or change the offer first (set_item_offer).");

        var changes = new List<string>();
        if (newName.En != oldName.En) changes.Add($"English name \"{oldName.En}\" → \"{newName.En}\"");
        if (newName.Ar != oldName.Ar) changes.Add($"Arabic name \"{oldName.Ar}\" → \"{newName.Ar}\"");
        if (newDescription.En != oldDescription.En) changes.Add($"English description → \"{newDescription.En}\"");
        if (newDescription.Ar != oldDescription.Ar) changes.Add($"Arabic description → \"{newDescription.Ar}\"");
        if (newPrice != chain.Price) changes.Add($"price {snap.Currency} {ToolResults.Money(chain.Price)} → {ToolResults.Money(newPrice)}");
        if (categoryId != dish.CatalogTypeId) changes.Add($"category \"{dish.CatalogTypeName?.Both}\" → \"{newCategory?.Both}\"");
        if (newPopular != dish.IsPopular) changes.Add(newPopular ? "marked popular" : "no longer marked popular");
        if (newPrep != dish.PreparationTimeMinutes) changes.Add(newPrep is null ? "no preparation time" : $"preparation time {newPrep} minutes");
        if (string.IsNullOrEmpty(newName.En) && string.IsNullOrEmpty(newName.Ar)) return ToolResults.Fail("A dish needs a name.");
        if (changes.Count == 0) return ToolResults.Fail($"\"{oldName.Both}\" is already so; nothing would change.");

        var preview = $"Change \"{oldName.Both}\": {string.Join("; ", changes)}." + (price is not null && snap.Branches.Count(b => b.IsActive) > 1 ? " A branch with its own price keeps it." : "");
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var body = new UpdateCatalogItemRequest(newName, newDescription, newPrice, categoryId, chain.IsAvailable, chain.IsOnOffer, chain.OfferPrice,
            chain.OfferWeekdays, chain.OfferFrom, chain.OfferTo, newPopular, newPrep);
        var result = await api.SendAsync<Unit>(HttpMethod.Put, Catalog, $"/api/catalog/items/{dish.Id}", null, body, null, ct);
        flow.Audit(UpdateItemTool, new { itemId = dish.Id, item = oldName.Display, changes, requestId }, result.IsOk ? "updated" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, itemId = dish.Id, item = newName.Display, itemAr = newName.Arabic, changes });
    }

    [McpServerTool(Name = OfferTool, Title = "Put a dish on offer or end its offer", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Puts a dish on offer at a lower price, optionally only on some days and hours (happy hour), at every branch or at one; or ends the offer. The days and hours are the dish's own, the same at every branch. " +
        "Use for 'latte at 45 this week', 'happy hour on iced drinks 4 to 7', 'end the brownie offer at Maadi'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> SetItemOffer(
        [Description("The dish: its name in English or Arabic, or its id")] string item,
        [Description("true to put it on offer, false to end the offer")] bool on,
        [Description("The offer price, below its usual price; needed when on is true")] decimal? offerPrice = null,
        [Description("The days it runs, e.g. 'fri,sat' or 'mon tue wed'; 'every day' for all; leave out to keep the days it has")] string? days = null,
        [Description("The hours it runs each day, e.g. '16:00-19:00'; 'all day' for no hours; leave out to keep the hours it has")] string? hours = null,
        [Description("Branch id or name for an offer at that branch only; leave out for every branch")] string? branch = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        BranchResponse? at = null;
        if (!string.IsNullOrWhiteSpace(branch))
        {
            var one = BranchSelector.SelectOne(snap.Branches, branch);
            if (!one.IsOk) return ToolResults.Fail(one.Error!);
            at = one.Value!;
        }
        var (dish, missing) = await FindItemAsync(snap, item, ct);
        if (dish is null) return ToolResults.Fail(missing!);
        var chain = Chain(dish);

        if (on)
        {
            if (offerPrice is not > 0) return ToolResults.Fail("Say the offer price.");
            if (offerPrice >= chain.Price) return ToolResults.Fail($"The offer price must be below its usual price, {snap.Currency} {ToolResults.Money(chain.Price)}.");
        }

        var weekdays = chain.OfferWeekdays;
        if (days is not null)
        {
            var (mask, error) = ParseWeekdays(days);
            if (error is not null) return ToolResults.Fail(error);
            weekdays = mask;
        }
        var (from, to) = (chain.OfferFrom, chain.OfferTo);
        if (hours is not null)
        {
            var (f, t, error) = ParseHours(hours);
            if (error is not null) return ToolResults.Fail(error);
            (from, to) = (f, t);
        }

        var where = at is null ? "at every branch" : $"at {at.BothNames} only";
        var preview = on
            ? $"Put \"{dish.Name?.Both}\" on offer at {snap.Currency} {ToolResults.Money(offerPrice!.Value)} (usually {ToolResults.Money(chain.Price)}) {where}, {Window(weekdays, from, to)}."
            : $"End the offer on \"{dish.Name?.Both}\" {where}" + (chain.IsOnOffer && chain.OfferPrice is { } now ? $" (now {snap.Currency} {ToolResults.Money(now)})." : ".");
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var result = await api.SendAsync<CatalogItemDetail>(HttpMethod.Patch, Catalog, $"/api/catalog/items/{dish.Id}/offer", at?.Id,
            new SetItemOfferRequest(on, on ? offerPrice : null, weekdays, from, to), null, ct);
        flow.Audit(OfferTool, new { itemId = dish.Id, item = dish.Name?.Display, on, offerPrice, weekdays, from, to, branch = at?.Id, requestId }, result.IsOk ? (on ? "on offer" : "offer ended") : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, itemId = dish.Id, item = dish.Name?.Display, itemAr = dish.Name?.Arabic, onOffer = on, preview });
    }

    [McpServerTool(Name = BranchPriceTool, Title = "Set a dish's price or availability at one branch", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Gives a dish its own price at one branch, puts it back to the chain's price there, or says whether that branch sells it at all. Other branches are not touched. " +
        "Use for 'the latte is 60 at the mall branch', 'Maadi does not sell the burger', 'Nasr City back to the normal price for the brownie'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> SetBranchPrice(
        [Description("The dish: its name in English or Arabic, or its id")] string item,
        [Description("Branch id or name; required when the business has more than one active branch")] string? branch = null,
        [Description("Its price at this branch")] decimal? price = null,
        [Description("true to go back to the chain's price at this branch")] bool usualPrice = false,
        [Description("false when this branch does not sell it, true when it does again")] bool? available = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (price is null && !usualPrice && available is null) return ToolResults.Fail("Say the price at this branch, usualPrice=true, or whether it sells the dish.");
        if (price is <= 0) return ToolResults.Fail("The price must be more than zero.");

        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var one = BranchSelector.SelectOne(snap.Branches, branch);
        if (!one.IsOk) return ToolResults.Fail(one.Error!);
        var at = one.Value!;
        var (dish, missing) = await FindItemAsync(snap, item, ct);
        if (dish is null) return ToolResults.Fail(missing!);
        var chain = Chain(dish);

        var overrides = await api.GetAsync<List<BranchItemOverrideDto>>(Catalog, $"/api/catalog/branches/{at.Id}/overrides", at.Id, ct);
        if (!overrides.IsOk) return ToolResults.Fail(overrides.Error!);
        var existing = overrides.Value!.FirstOrDefault(o => o.CatalogItemId == dish.Id);

        var newPrice = usualPrice ? null : price ?? existing?.PriceOverride;
        var newAvailable = available ?? existing?.IsAvailable ?? true;
        var changes = new List<string>();
        var oldShown = existing?.PriceOverride ?? chain.Price;
        var newShown = newPrice ?? chain.Price;
        if (newPrice != existing?.PriceOverride)
            changes.Add($"price {snap.Currency} {ToolResults.Money(oldShown)} → {ToolResults.Money(newShown)}{(newPrice is null ? " (the chain's price)" : "")}");
        if (newAvailable != (existing?.IsAvailable ?? true))
            changes.Add(newAvailable ? "sold here again" : "not sold here");
        if (changes.Count == 0) return ToolResults.Fail($"\"{dish.Name?.Both}\" is already so at {at.BothNames}; nothing would change.");

        var preview = $"At {at.BothNames}, \"{dish.Name?.Both}\": {string.Join("; ", changes)}. Other branches keep theirs.";
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        // The override is written whole: the branch's offer, set by set_item_offer, is carried over
        var body = new BranchItemOverrideRequest(newAvailable, newPrice, existing?.OfferPriceOverride, existing?.IsOnOfferOverride);
        var result = await api.SendAsync<BranchItemOverrideDto>(HttpMethod.Put, Catalog, $"/api/catalog/branches/{at.Id}/items/{dish.Id}/override", at.Id, body, null, ct);
        flow.Audit(BranchPriceTool, new { itemId = dish.Id, item = dish.Name?.Display, branch = at.Id, price = newPrice, available = newAvailable, requestId }, result.IsOk ? "override set" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, itemId = dish.Id, item = dish.Name?.Display, itemAr = dish.Name?.Arabic, branch = at.DisplayName, branchAr = at.NameAr, price = newShown, available = newAvailable });
    }

    // --- Categories -----------------------------------------------------------

    [McpServerTool(Name = CreateCategoryTool, Title = "Add a menu category", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Adds a category to the menu, last in order, named in both languages (the menu's assistant fills the one not given). " +
        "Use for 'add a Desserts section', 'new category: Fresh juices / عصائر فريش'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> CreateCategory(
        [Description("The category's name, in English or Arabic")] string name,
        [Description("Its Arabic name, when the owner gave both")] string? nameAr = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        [Description(WriteFlow.DraftDescription)] string? draft = null,
        CancellationToken ct = default)
    {
        requestId ??= WriteFlow.NewRequestId();
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var branch = AnyBranch(snapshot.Value!);
        var categories = await api.GetAsync<List<CategoryDto>>(Catalog, "/api/catalog/categories", branch, ct);
        if (!categories.IsOk) return ToolResults.Fail(categories.Error!);

        if (confirm)
        {
            var (plan, error) = flow.Open<CategoryDraft>(draft, CreateCategoryTool, requestId);
            if (plan is null) return ToolResults.Fail(error!);
            if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

            // Catalog takes no request id here: a confirm repeated after it landed finds the category by name
            if (categories.Value!.FirstOrDefault(c => MenuWriteTools.Same(c.Name, plan.Name)) is { } made)
                return ToolResults.Ok(new { done = true, categoryId = made.Id, category = made.Name?.Display, categoryAr = made.Name?.Arabic, note = "It was already there; nothing was made twice." });
            var created = await api.SendAsync<CategoryDto>(HttpMethod.Post, Catalog, "/api/catalog/categories", null, new MenuCategoryRequest(plan.Name, plan.DisplayOrder), null, ct);
            flow.Audit(CreateCategoryTool, new { category = plan.Name.Display, requestId }, created.IsOk ? $"category {created.Value!.Id}" : created.Error!);
            if (!created.IsOk) return ToolResults.Fail(created.Error!);
            return ToolResults.Ok(new { done = true, categoryId = created.Value!.Id, category = plan.Name.Display, categoryAr = plan.Name.Arabic });
        }

        if (string.IsNullOrWhiteSpace(name)) return ToolResults.Fail("The category needs a name.");
        var given = MenuWriteTools.Localized(name);
        if (MenuWriteTools.Clean(nameAr) is { } ar) given = new LocalizedText(given.En, ar);
        if (categories.Value!.FirstOrDefault(c => MenuWriteTools.Same(c.Name, given)) is { } there)
            return ToolResults.Fail($"There is already a category \"{there.Name?.Both}\" (id {there.Id}).");

        var warnings = new List<string>();
        if (string.IsNullOrWhiteSpace(given.En) || string.IsNullOrWhiteSpace(given.Ar))
        {
            var filled = await api.SendAsync<LocalizeMenuResponse>(HttpMethod.Post, Catalog, "/api/catalog/assist/localize", branch,
                new LocalizeMenuRequest(1, given, null, null, false, false), null, ct);
            if (filled.IsOk) given = MenuWriteTools.Merge(given, filled.Value!.Name);
            else warnings.Add($"The other language was not filled in ({filled.Error}); rename_category can add it later.");
        }

        var order = categories.Value!.Count == 0 ? 1 : categories.Value!.Max(c => c.DisplayOrder) + 1;
        var category = new CategoryDraft(given, order);
        return ToolResults.Ok(new
        {
            preview = $"Add the category \"{given.Both}\", last on the menu.",
            warnings,
            requestId,
            draft = flow.Sign(category, CreateCategoryTool, requestId),
            nextStep = WriteFlow.NextStepWithDraft,
        });
    }

    [McpServerTool(Name = RenameCategoryTool, Title = "Rename a menu category", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Renames a menu category in English, in Arabic or both; the name not given stays. Its dishes and place on the menu stay as they are. " +
        "Use for 'rename Hot drinks to Coffee', 'the Arabic of Desserts is حلويات'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> RenameCategory(
        [Description("The category: its name in English or Arabic, or its id")] string category,
        [Description("Its new English name")] string? name = null,
        [Description("Its new Arabic name")] string? nameAr = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (MenuWriteTools.Clean(name) is null && MenuWriteTools.Clean(nameAr) is null) return ToolResults.Fail("Say the new name, in English (name) or Arabic (nameAr).");
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var categories = await api.GetAsync<List<CategoryDto>>(Catalog, "/api/catalog/categories", AnyBranch(snapshot.Value!), ct);
        if (!categories.IsOk) return ToolResults.Fail(categories.Error!);
        var (picked, error) = NameResolver.Pick(categories.Value!, category, c => c.Id, c => c.Name, "category");
        if (picked is null) return ToolResults.Fail(error!);

        var old = picked.Name ?? new LocalizedText(null, null);
        var renamed = new LocalizedText(MenuWriteTools.Clean(name) ?? old.En, MenuWriteTools.Clean(nameAr) ?? old.Ar);
        if (renamed == old) return ToolResults.Fail($"The category is already called \"{old.Both}\".");

        var preview = $"Rename the category \"{old.Both}\" to \"{renamed.Both}\".";
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var result = await api.SendAsync<CategoryDto>(HttpMethod.Put, Catalog, $"/api/catalog/categories/{picked.Id}", null, new MenuCategoryRequest(renamed, picked.DisplayOrder), null, ct);
        flow.Audit(RenameCategoryTool, new { categoryId = picked.Id, from = old.Display, to = renamed.Display, requestId }, result.IsOk ? "renamed" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, categoryId = picked.Id, category = renamed.Display, categoryAr = renamed.Arabic });
    }

    // --- Choices on a dish ----------------------------------------------------

    [McpServerTool(Name = EditCustomizationTool, Title = "Change an option on a dish", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Changes one choice group already on a dish (a size, a milk, extras): adds an option to it, renames an option, or changes what an option adds to the price. Every other option stays as it is, and so do the recipes that name them. " +
        "Use for 'add almond milk +15 to the latte's milk', 'large is now +20', 'rename Regular to Medium'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> EditCustomization(
        [Description("The dish: its name in English or Arabic, or its id")] string item,
        [Description("The choice group on it, e.g. Size or Milk (name or id)")] string group,
        [Description("The option to change (name or id); with add=true, the new option's name in English or Arabic")] string option,
        [Description("true to add the option to the group")] bool add = false,
        [Description("The option's new English name")] string? newName = null,
        [Description("The option's new Arabic name (or the new option's Arabic name)")] string? newNameAr = null,
        [Description("What the option adds to the price; 0 for nothing")] decimal? price = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var (dish, missing) = await FindItemAsync(snap, item, ct);
        if (dish is null) return ToolResults.Fail(missing!);
        var groups = await api.GetAsync<List<CustomizationDto>>(Catalog, $"/api/catalog/items/{dish.Id}/customizations", null, ct);
        if (!groups.IsOk) return ToolResults.Fail(groups.Error!);
        if (groups.Value!.Count == 0) return ToolResults.Fail($"\"{dish.Name?.Both}\" has no choices yet; add_customizations adds them.");
        var (g, gError) = NameResolver.Pick(groups.Value!, group, x => x.Id, x => x.Name, "choice group");
        if (g is null) return ToolResults.Fail($"{gError} Its choices are: {string.Join(", ", groups.Value!.Select(x => x.Name?.Both))}.");

        var options = (g.Options ?? []).OrderBy(o => o.DisplayOrder).ToList();
        var sent = options.Select(o => new CustomizationOptionRequest(o.Id, o.Name ?? new LocalizedText(null, null), o.PriceAdjustment, o.IsDefault, o.DisplayOrder)).ToList();
        string preview;
        if (add)
        {
            var fresh = MenuWriteTools.Localized(option);
            if (MenuWriteTools.Clean(newNameAr) is { } ar) fresh = new LocalizedText(fresh.En, ar);
            if (string.IsNullOrWhiteSpace(fresh.Display)) return ToolResults.Fail("Say the new option's name.");
            if (options.FirstOrDefault(o => MenuWriteTools.Same(o.Name, fresh)) is { } there)
            {
                // A confirm repeated after it landed finds the option already there
                if (confirm) return ToolResults.Ok(new { done = true, itemId = dish.Id, group = g.Name?.Display, option = there.Name?.Display, note = "It was already there; nothing was added twice." });
                return ToolResults.Fail($"\"{g.Name?.Both}\" already has \"{there.Name?.Both}\".");
            }
            var added = price ?? 0;
            sent.Add(new CustomizationOptionRequest(0, fresh, added, false, options.Count == 0 ? 0 : options.Max(o => o.DisplayOrder) + 1));
            preview = $"Add \"{fresh.Both}\"{Adds(added, snap.Currency)} to \"{g.Name?.Both}\" on \"{dish.Name?.Both}\".";
        }
        else
        {
            var (o, oError) = NameResolver.Pick(options, option, x => x.Id, x => x.Name, "option");
            if (o is null) return ToolResults.Fail($"{oError} The options of \"{g.Name?.Both}\" are: {string.Join(", ", options.Select(x => x.Name?.Both))}.");
            var old = o.Name ?? new LocalizedText(null, null);
            var renamed = new LocalizedText(MenuWriteTools.Clean(newName) ?? old.En, MenuWriteTools.Clean(newNameAr) ?? old.Ar);
            var newPrice = price ?? o.PriceAdjustment;
            var changes = new List<string>();
            if (renamed != old) changes.Add($"renamed \"{renamed.Both}\"");
            if (newPrice != o.PriceAdjustment) changes.Add($"adds {snap.Currency} {ToolResults.Money(newPrice)} (was {ToolResults.Money(o.PriceAdjustment)})");
            if (changes.Count == 0) return ToolResults.Fail("Say what to change: newName, newNameAr or price; or add=true to add an option.");
            var i = sent.FindIndex(s => s.Id == o.Id);
            sent[i] = sent[i] with { Name = renamed, PriceAdjustment = newPrice };
            preview = $"On \"{dish.Name?.Both}\", in \"{g.Name?.Both}\", \"{old.Both}\": {string.Join("; ", changes)}.";
        }

        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        // Catalog deletes every option an update leaves out, so all of them go, each with its id
        var body = new CustomizationRequest(g.Name ?? new LocalizedText(null, null), g.IsRequired, g.AllowMultiple, g.DisplayOrder, sent);
        var result = await api.SendAsync<CustomizationDto>(HttpMethod.Put, Catalog, $"/api/catalog/items/{dish.Id}/customizations/{g.Id}", null, body, null, ct);
        flow.Audit(EditCustomizationTool, new { itemId = dish.Id, groupId = g.Id, option, add, newName, newNameAr, price, requestId }, result.IsOk ? "updated" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, itemId = dish.Id, group = g.Name?.Display, groupAr = g.Name?.Arabic, preview });
    }

    [McpServerTool(Name = AddCustomizationsTool, Title = "Add choices to a dish", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Adds choice groups (sizes, milks, extras, sugar) to a dish already on the menu: as the owner gave them, or suggested for the dish by the menu's assistant when none are given. Groups it already has are left alone. " +
        "Use for 'add sizes to the iced latte: regular, large +15', 'suggest options for the burger'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> AddCustomizations(
        [Description("The dish: its name in English or Arabic, or its id")] string item,
        [Description("The groups as the owner described them; leave out to have them suggested")] List<MenuWriteTools.GroupInput>? customizations = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        [Description(WriteFlow.DraftDescription)] string? draft = null,
        CancellationToken ct = default)
    {
        requestId ??= WriteFlow.NewRequestId();
        if (confirm)
        {
            var (plan, error) = flow.Open<ChoicesDraft>(draft, AddCustomizationsTool, requestId);
            if (plan is null) return ToolResults.Fail(error!);
            if (flow.Limit() is { } limited) return ToolResults.Fail(limited);
            return await AddGroupsAsync(plan, requestId, ct);
        }

        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var (dish, missing) = await FindItemAsync(snap, item, ct);
        if (dish is null) return ToolResults.Fail(missing!);
        var existing = await api.GetAsync<List<CustomizationDto>>(Catalog, $"/api/catalog/items/{dish.Id}/customizations", null, ct);
        if (!existing.IsOk) return ToolResults.Fail(existing.Error!);
        var dishName = dish.Name ?? new LocalizedText(null, null);

        var groups = new List<DraftGroup>();
        var warnings = new List<string>();
        if (customizations is { Count: > 0 })
        {
            foreach (var g in customizations)
            {
                if (string.IsNullOrWhiteSpace(g.Name) || g.Options is not { Count: > 0 })
                    return ToolResults.Fail("Every choice group needs a name and at least one option.");
                groups.Add(new DraftGroup(new LocalizedText(MenuWriteTools.Clean(g.Name), MenuWriteTools.Clean(g.NameAr)), g.Required, g.Multiple,
                    g.Options.Select((o, i) => new DraftOption(i, new LocalizedText(MenuWriteTools.Clean(o.Name), MenuWriteTools.Clean(o.NameAr)), o.Price, o.Default)).ToList()));
            }
        }
        else
        {
            var suggested = await api.SendAsync<SuggestCustomizationsResponse>(HttpMethod.Post, Catalog, "/api/catalog/assist/customizations", AnyBranch(snap),
                new SuggestCustomizationsRequest(dishName, dish.Description, dish.CatalogTypeId, Chain(dish).Price, existing.Value!.Select(g => g.Name).OfType<LocalizedText>().ToList()), null, ct);
            if (!suggested.IsOk) return ToolResults.Fail($"No choices were suggested: {suggested.Error}");
            foreach (var g in suggested.Value!.Groups ?? [])
                groups.Add(new DraftGroup(g.Name, g.IsRequired, g.AllowMultiple, (g.Options ?? []).Select((o, i) => new DraftOption(i, o.Name, o.PriceAdjustment, o.IsDefault)).ToList()));
            warnings.AddRange(suggested.Value.Warnings ?? []);
        }

        foreach (var g in groups.ToList())
        {
            if (existing.Value!.FirstOrDefault(e => MenuWriteTools.Same(e.Name, g.Name)) is not { } there) continue;
            warnings.Add($"\"{dishName.Both}\" already has \"{there.Name?.Both}\"; it is left as it is (edit_customization changes it).");
            groups.Remove(g);
        }
        if (groups.Count == 0) return ToolResults.Fail(warnings.Count > 0 ? string.Join(" ", warnings) : "There were no choices to add.");

        var sb = new StringBuilder($"Add to \"{dishName.Both}\":\n");
        foreach (var g in groups)
            sb.AppendLine($"Choice \"{g.Name.Both}\" ({(g.Required ? "must pick" : "optional")}{(g.Multiple ? ", several" : "")}): " +
                string.Join(", ", g.Options.Select(o => o.Name.Both + (o.Price != 0 ? $" +{ToolResults.Money(o.Price)}" : "") + (o.Default ? " (default)" : ""))));
        var choices = new ChoicesDraft(dish.Id, dishName, groups);
        return ToolResults.Ok(new
        {
            preview = sb.ToString().TrimEnd(),
            warnings,
            requestId,
            draft = flow.Sign(choices, AddCustomizationsTool, requestId),
            nextStep = WriteFlow.NextStepWithDraft,
        });
    }

    private async Task<CallToolResult> AddGroupsAsync(ChoicesDraft plan, string requestId, CancellationToken ct)
    {
        // Catalog takes no request id here: a group already on the dish (a confirm repeated after it landed) is not added again
        var existing = await api.GetAsync<List<CustomizationDto>>(Catalog, $"/api/catalog/items/{plan.ItemId}/customizations", null, ct);
        if (!existing.IsOk) return ToolResults.Fail(existing.Error!);
        var order = existing.Value!.Count == 0 ? 0 : existing.Value!.Max(g => g.DisplayOrder) + 1;
        var done = new List<string>();
        string? failure = null;
        foreach (var g in plan.Groups)
        {
            if (existing.Value!.Any(e => MenuWriteTools.Same(e.Name, g.Name)))
            {
                done.Add($"\"{g.Name.Display}\" was already there.");
                continue;
            }
            var body = new CustomizationRequest(g.Name, g.Required, g.Multiple, order++,
                g.Options.Select((o, i) => new CustomizationOptionRequest(0, o.Name, o.Price, o.Default, i)).ToList());
            var made = await api.SendAsync<CustomizationDto>(HttpMethod.Post, Catalog, $"/api/catalog/items/{plan.ItemId}/customizations", null, body, null, ct);
            if (!made.IsOk)
            {
                failure = $"\"{g.Name.Display}\" was not added: {made.Error}";
                break;
            }
            done.Add($"\"{g.Name.Display}\" added with {g.Options.Count} option{(g.Options.Count == 1 ? "" : "s")}.");
        }
        flow.Audit(AddCustomizationsTool, new { itemId = plan.ItemId, item = plan.ItemName.Display, groups = plan.Groups.Select(g => g.Name.Display), requestId }, failure ?? "added");
        return failure is null
            ? ToolResults.Ok(new { done = true, itemId = plan.ItemId, steps = done })
            : ToolResults.Ok(new { done = false, itemId = plan.ItemId, steps = done, stopped = failure, next = "Calling again with the same requestId and draft adds the rest without adding anything twice." });
    }

    // --- Promo codes ----------------------------------------------------------

    [McpServerTool(Name = CreatePromoTool, Title = "Create a promo code", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Creates a promo code customers type at checkout: a percentage or a fixed amount off the items, optionally with a minimum order, start and end days, a cap on uses, and once per customer (the default). " +
        "Use for 'make a code WELCOME10 for 10% off', 'RAMADAN 50 pounds off orders over 300 until the end of the month'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> CreatePromoCode(
        [Description("The code: letters, digits and dashes, up to 20; it is kept in capitals")] string code,
        [Description("percent or amount")] string kind,
        [Description("How much off: the percentage (1-100) or the amount")] decimal value,
        [Description("The smallest order it works on, optional")] decimal? minSubtotal = null,
        [Description("The first day it works, yyyy-MM-dd; default now")] string? startsOn = null,
        [Description("The last day it works, yyyy-MM-dd (through the end of that day); default no end")] string? endsOn = null,
        [Description("How many times it can be used in all; default no cap")] int? maxUses = null,
        [Description("true (default) when each customer may use it once")] bool oncePerCustomer = true,
        [Description("false to create it switched off")] bool active = true,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;

        var normalized = code.Trim().ToUpperInvariant();
        var kindCode = ParseKind(kind);
        if (kindCode < 0) return ToolResults.Fail("kind must be percent or amount.");
        var (starts, sError) = ParseDay(startsOn);
        var (ends, eError) = ParseDay(endsOn);
        if ((sError ?? eError) is { } dayError) return ToolResults.Fail(dayError);
        var request = new PromoCodeRequest(normalized, kindCode, value, minSubtotal, starts is { } s ? StartUtc(s, snap.Zone) : null, ends is { } e ? StartUtc(e.AddDays(1), snap.Zone) : null, maxUses, oncePerCustomer, active);
        if (Check(request) is { } invalid) return ToolResults.Fail(invalid);

        var promos = await api.GetAsync<List<PromoCodeDto>>(Catalog, "/api/catalog/promos", null, ct);
        if (!promos.IsOk) return ToolResults.Fail(promos.Error!);
        var there = promos.Value!.FirstOrDefault(p => p.Code.Equals(normalized, StringComparison.OrdinalIgnoreCase));
        if (there is not null && !confirm) return ToolResults.Fail($"The code {normalized} already exists; update_promo_code changes it.");

        var preview = $"Create the promo code {Describe(request, snap)}.";
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);
        // Catalog takes no request id here: a confirm repeated after it landed finds the code
        if (there is not null) return ToolResults.Ok(new { done = true, promoId = there.Id, code = there.Code, note = "It was already there; nothing was made twice." });

        var created = await api.SendAsync<PromoCodeDto>(HttpMethod.Post, Catalog, "/api/catalog/promos", null, request, null, ct);
        flow.Audit(CreatePromoTool, new { code = normalized, kind = kindCode, value, minSubtotal, startsOn, endsOn, maxUses, oncePerCustomer, active, requestId }, created.IsOk ? $"promo {created.Value!.Id}" : created.Error!);
        if (!created.IsOk) return ToolResults.Fail(created.Error!);
        return ToolResults.Ok(new { done = true, promoId = created.Value!.Id, code = created.Value.Code, preview });
    }

    [McpServerTool(Name = UpdatePromoTool, Title = "Change a promo code", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Changes a promo code's rules: the code itself, how much it takes off, the minimum order, its days, its cap on uses or once per customer. Anything not given stays. " +
        "Use for 'make WELCOME10 15% instead', 'extend RAMADAN to the 30th', 'no minimum on SUMMER'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> UpdatePromoCode(
        [Description("The code as it is now, or its id")] string code,
        [Description("A new code text")] string? newCode = null,
        [Description("percent or amount")] string? kind = null,
        [Description("How much off: the percentage (1-100) or the amount")] decimal? value = null,
        [Description("The smallest order it works on; 0 for no minimum")] decimal? minSubtotal = null,
        [Description("The first day it works, yyyy-MM-dd; 'none' for from now")] string? startsOn = null,
        [Description("The last day it works, yyyy-MM-dd; 'none' for no end")] string? endsOn = null,
        [Description("How many times it can be used in all; 0 for no cap")] int? maxUses = null,
        [Description("true when each customer may use it once")] bool? oncePerCustomer = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var (promo, missing) = await FindPromoAsync(code, ct);
        if (promo is null) return ToolResults.Fail(missing!);

        var kindCode = kind is null ? promo.Kind : ParseKind(kind);
        if (kindCode < 0) return ToolResults.Fail("kind must be percent or amount.");
        var starts = promo.StartsAt;
        if (startsOn is not null)
        {
            var (day, error) = ParseDay(startsOn);
            if (error is not null) return ToolResults.Fail(error);
            starts = day is { } d ? StartUtc(d, snap.Zone) : null;
        }
        var ends = promo.EndsAt;
        if (endsOn is not null)
        {
            var (day, error) = ParseDay(endsOn);
            if (error is not null) return ToolResults.Fail(error);
            ends = day is { } d ? StartUtc(d.AddDays(1), snap.Zone) : null;
        }
        var request = new PromoCodeRequest(
            newCode?.Trim().ToUpperInvariant() ?? promo.Code, kindCode, value ?? promo.Value,
            minSubtotal is null ? promo.MinSubtotal : minSubtotal == 0 ? null : minSubtotal,
            starts, ends,
            maxUses is null ? promo.MaxUses : maxUses == 0 ? null : maxUses,
            oncePerCustomer ?? promo.OncePerCustomer, promo.IsActive);
        if (Check(request) is { } invalid) return ToolResults.Fail(invalid);
        var before = new PromoCodeRequest(promo.Code, promo.Kind, promo.Value, promo.MinSubtotal, promo.StartsAt, promo.EndsAt, promo.MaxUses, promo.OncePerCustomer, promo.IsActive);
        if (request == before) return ToolResults.Fail($"{promo.Code} is already so; nothing would change.");

        var preview = $"Change the promo code {Describe(before, snap)} to {Describe(request, snap)}." + (promo.Uses > 0 ? $" It has been used {promo.Uses} time{(promo.Uses == 1 ? "" : "s")}; those orders keep their discount." : "");
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var result = await api.SendAsync<PromoCodeDto>(HttpMethod.Put, Catalog, $"/api/catalog/promos/{promo.Id}", null, request, null, ct);
        flow.Audit(UpdatePromoTool, new { promoId = promo.Id, code = promo.Code, newCode, kind, value, minSubtotal, startsOn, endsOn, maxUses, oncePerCustomer, requestId }, result.IsOk ? "updated" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, promoId = promo.Id, code = result.Value!.Code, preview });
    }

    [McpServerTool(Name = PromoActiveTool, Title = "Switch a promo code on or off", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Switches a promo code off (customers can no longer use it) or back on. Its rules and the orders that used it stay. " +
        "Use for 'stop the SUMMER code', 'turn WELCOME10 back on'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> SetPromoActive(
        [Description("The code, or its id")] string code,
        [Description("true to switch it on, false to switch it off")] bool active,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var (promo, missing) = await FindPromoAsync(code, ct);
        if (promo is null) return ToolResults.Fail(missing!);
        if (promo.IsActive == active && !confirm) return ToolResults.Fail($"{promo.Code} is already {(active ? "on" : "off")}.");

        var preview = active
            ? $"Switch the promo code {promo.Code} back on: customers can use it again."
            : $"Switch the promo code {promo.Code} off: customers can no longer use it (used {promo.Uses} time{(promo.Uses == 1 ? "" : "s")} so far).";
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var result = await api.SendAsync<PromoCodeDto>(HttpMethod.Patch, Catalog, $"/api/catalog/promos/{promo.Id}/active", null, new SetPromoActiveRequest(active), null, ct);
        flow.Audit(PromoActiveTool, new { promoId = promo.Id, code = promo.Code, active, requestId }, result.IsOk ? (active ? "on" : "off") : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, promoId = promo.Id, code = promo.Code, active = result.Value!.IsActive });
    }

    // --- A dish's recipe ------------------------------------------------------

    [McpServerTool(Name = RecipeTool, Title = "Set a dish's stock recipe", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Sets the stock recipe of a dish already on the menu, from the owner's own words or proposed: what one sale takes off the stock, and what each of its options changes. It is built from the stock items the business already tracks, adding the ones it lacks in grams, ml or pieces. It replaces the dish's current recipe. " +
        "Use for 'the latte takes 18 g beans and 200 ml milk, large 300 ml', 'set up the stock for the burger'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> SetRecipe(
        [Description("The dish: its name in English or Arabic, or its id")] string item,
        [Description("The recipe in the owner's words ('18 g beans, 200 ml milk, a 12 oz cup; large 300 ml milk; plain: no sugar'), or 'auto' to have one proposed")] string recipe = "auto",
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        [Description(WriteFlow.DraftDescription)] string? draft = null,
        CancellationToken ct = default)
    {
        requestId ??= WriteFlow.NewRequestId();
        if (confirm)
        {
            var (plan, error) = flow.Open<RecipeDraft>(draft, RecipeTool, requestId);
            if (plan is null) return ToolResults.Fail(error!);
            if (flow.Limit() is { } limited) return ToolResults.Fail(limited);
            return await SetRecipeAsync(plan, requestId, ct);
        }

        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var branch = AnyBranch(snap);
        var (dish, missing) = await FindItemAsync(snap, item, ct);
        if (dish is null) return ToolResults.Fail(missing!);
        var dishName = dish.Name ?? new LocalizedText(null, null);

        // The proposer is told the dish's real options, so the lines it makes name real ids
        var groups = await api.GetAsync<List<CustomizationDto>>(Catalog, $"/api/catalog/items/{dish.Id}/customizations", null, ct);
        if (!groups.IsOk) return ToolResults.Fail(groups.Error!);
        var options = groups.Value!.SelectMany(g => (g.Options ?? []).Select(o => new MenuOptionToTrack(o.Id, g.Name?.Display ?? "", o.Name ?? new LocalizedText(null, null)))).ToList();
        var words = recipe.Trim();
        var brief = words.Length == 0 || words.Equals("auto", StringComparison.OrdinalIgnoreCase) ? null : words.Length > 1000 ? words[..1000] : words;

        var proposal = await api.SendAsync<RecipesProposal>(HttpMethod.Post, Inventory, "/api/inventory/recipes/assist/propose", branch,
            new ProposeRecipesRequest([new MenuItemToTrack(dish.Id, dishName, dish.Description, dish.CatalogTypeName?.Display, Chain(dish).Price, options, brief)]), null, ct);
        if (!proposal.IsOk) return ToolResults.Fail($"No recipe was proposed: {proposal.Error}");
        if (proposal.Value!.Recipes?.FirstOrDefault() is not { } proposed || proposed.Kind is not ("recipe" or "unit") || (proposed.Kind == "recipe" && proposed.Lines is not { Count: > 0 }))
            return ToolResults.Fail("No recipe came back for this dish; describe it in your own words (what goes in and how much) and try again.");

        var keys = (proposed.Lines ?? []).Select(l => l.NewItemKey).Where(k => k is not null).ToHashSet();
        var steps = new DraftRecipe(
            proposed.Kind,
            (proposal.Value.NewItems ?? []).Where(n => keys.Contains(n.Key)).Select(n => new DraftStock(n.Key, n.Name, n.Unit, n.PackSize, n.PackName, n.AutoSoldOut)).ToList(),
            (proposed.Lines ?? []).Select(l => new DraftLine(l.StockItemId, l.NewItemKey, l.Quantity, l.OptionIds ?? [], l.Slot, l.None)).ToList());
        var warnings = new List<string>();
        warnings.AddRange(proposed.Warnings ?? []);
        warnings.AddRange(proposal.Value.Warnings ?? []);

        var shelf = (await api.GetAsync<List<StockItemDto>>(Inventory, "/api/inventory/items", branch, ct)).Value ?? [];
        var current = await api.GetAsync<RecipeView>(Inventory, $"/api/inventory/recipes/{dish.Id}", branch, ct);
        var sb = new StringBuilder($"Set the stock recipe of \"{dishName.Both}\"");
        sb.AppendLine(current.IsOk && current.Value!.Lines is { Count: > 0 } now ? $", in place of its current one ({now.Count} line{(now.Count == 1 ? "" : "s")})." : ".");
        MenuWriteTools.DescribeRecipe(sb, steps, options.ToDictionary(o => o.Id, o => o.Name.Display), shelf);

        var signed = new RecipeDraft(branch, dish.Id, dishName, steps);
        return ToolResults.Ok(new
        {
            preview = sb.ToString().TrimEnd(),
            warnings,
            requestId,
            draft = flow.Sign(signed, RecipeTool, requestId),
            nextStep = WriteFlow.NextStepWithDraft,
        });
    }

    private async Task<CallToolResult> SetRecipeAsync(RecipeDraft plan, string requestId, CancellationToken ct)
    {
        var done = new List<string>();
        var branch = plan.BranchId;
        CallToolResult Finish(string? failure)
        {
            flow.Audit(RecipeTool, new { itemId = plan.ItemId, item = plan.ItemName.Display, kind = plan.Recipe.Kind, lines = plan.Recipe.Lines.Count, newStock = plan.Recipe.NewStock.Count, requestId }, failure ?? "recipe set");
            return failure is null
                ? ToolResults.Ok(new { done = true, itemId = plan.ItemId, steps = done })
                : ToolResults.Ok(new { done = false, itemId = plan.ItemId, steps = done, stopped = failure, next = "Calling again with the same requestId and draft finishes the rest without making anything twice." });
        }

        if (plan.Recipe.Kind == "unit")
        {
            var unit = await api.SendAsync<CreatedResponse>(HttpMethod.Post, Inventory, "/api/inventory/recipes/track-by-unit", branch,
                new TrackByUnitRequest(plan.ItemId, plan.ItemName), flow.StepKey(RecipeTool, requestId, "unit"), ct);
            if (!unit.IsOk) return Finish($"Its stock was not set up ({unit.Error}).");
            done.Add("Stock: it is counted as a unit of its own, one per sale.");
            return Finish(null);
        }

        // The stock items the recipe needs that the shelf lacks, each under its own idempotency key
        var stockIds = new Dictionary<string, int>();
        foreach (var stock in plan.Recipe.NewStock)
        {
            var created = await api.SendAsync<CreatedResponse>(HttpMethod.Post, Inventory, "/api/inventory/items", branch,
                new StockItemRequest(stock.Name, stock.Unit, stock.PackSize, stock.PackName, stock.AutoSoldOut), flow.StepKey(RecipeTool, requestId, $"stock:{stock.Key}"), ct);
            var id = created.IsOk ? created.Value!.Id : 0;
            // A repeated confirm: Inventory says the request was already handled, without its id; find it by name
            if (created.IsOk && id == 0)
            {
                var shelf = await api.GetAsync<List<StockItemDto>>(Inventory, "/api/inventory/items", branch, ct);
                id = shelf.Value?.FirstOrDefault(i => MenuWriteTools.Same(i.Name, stock.Name))?.Id ?? 0;
            }
            if (id == 0) return Finish($"The stock item \"{stock.Name.Both}\" was not added ({created.Error ?? "not found after adding"}), so the recipe was not set.");
            stockIds[stock.Key] = id;
            done.Add($"Stock item \"{stock.Name.Both}\" added, counted in {stock.Unit}.");
        }

        var lines = new List<RecipeLineInput>();
        foreach (var line in plan.Recipe.Lines)
        {
            var stockId = line.StockItemId ?? (line.NewItemKey is { } key && stockIds.TryGetValue(key, out var id) ? id : 0);
            if (stockId == 0) continue;
            lines.Add(new RecipeLineInput(stockId, line.Quantity, line.OptionRefs, line.Slot, line.None));
        }
        var set = await api.SendAsync<Unit>(HttpMethod.Put, Inventory, $"/api/inventory/recipes/{plan.ItemId}", branch, new RecipeRequest(lines), null, ct);
        if (!set.IsOk) return Finish($"The recipe was not set ({set.Error}).");
        done.Add($"Recipe set: {lines.Count} line{(lines.Count == 1 ? "" : "s")}; each sale takes its ingredients off the stock.");
        return Finish(null);
    }

    // --- Pieces ---------------------------------------------------------------

    /// <summary>Reads that need a branch (the menu list, the assistants) ask as the first active one; the menu is the chain's</summary>
    private static int? AnyBranch(TenantSnapshot snap) => (snap.Branches.FirstOrDefault(b => b.IsActive) ?? snap.Branches.FirstOrDefault())?.Id;

    private static CatalogItemBase Chain(CatalogItemDetail dish)
        => dish.Base ?? new CatalogItemBase(dish.Price, dish.OfferPrice, dish.IsOnOffer, dish.IsAvailable, dish.OfferWeekdays, dish.OfferFrom, dish.OfferTo);

    private async Task<(CatalogItemDetail? Item, string? Error)> FindItemAsync(TenantSnapshot snap, string text, CancellationToken ct)
    {
        var items = await api.GetAsync<List<CatalogItemDetail>>(Catalog, "/api/catalog/items", AnyBranch(snap), ct);
        if (!items.IsOk) return (null, items.Error);
        return NameResolver.Pick(items.Value!, text, i => i.Id, i => i.Name, "menu item");
    }

    private async Task<(PromoCodeDto? Promo, string? Error)> FindPromoAsync(string text, CancellationToken ct)
    {
        var promos = await api.GetAsync<List<PromoCodeDto>>(Catalog, "/api/catalog/promos", null, ct);
        if (!promos.IsOk) return (null, promos.Error);
        // A code may be all digits: the code itself is tried before an id
        if (promos.Value!.FirstOrDefault(p => p.Code.Equals(text.Trim(), StringComparison.OrdinalIgnoreCase)) is { } exact) return (exact, null);
        return NameResolver.Pick(promos.Value!, text, p => p.Id, p => new LocalizedText(p.Code, null), "promo code");
    }

    private static string Adds(decimal price, string currency) => price == 0 ? "" : $" (+{currency} {ToolResults.Money(price)})";

    /// <summary>"fri,sat", "mon tue wed", "every day": a bit per DayOfWeek (1 is Sunday), null for every day</summary>
    internal static (int? Mask, string? Error) ParseWeekdays(string text)
    {
        var t = text.Trim().ToLowerInvariant();
        if (t is "" or "every day" or "everyday" or "daily" or "all" or "all days") return (null, null);
        var mask = 0;
        foreach (var word in t.Split([',', ' ', '/', '&', '+'], StringSplitOptions.RemoveEmptyEntries))
        {
            if (word == "and") continue;
            var day = Enum.GetValues<DayOfWeek>().Cast<DayOfWeek?>().FirstOrDefault(d => d.ToString()!.ToLowerInvariant().StartsWith(word.Length >= 3 ? word[..3] : "?", StringComparison.Ordinal));
            if (day is null) return (null, $"'{word}' is not a day; name days like 'fri,sat' or say 'every day'.");
            mask |= 1 << (int)day.Value;
        }
        return (mask == 0 || mask == 127 ? null : mask, null);
    }

    /// <summary>"16:00-19:00" or "all day"</summary>
    internal static (string? From, string? To, string? Error) ParseHours(string text)
    {
        var t = text.Trim().ToLowerInvariant();
        if (t is "" or "all day" or "allday" or "any time" or "anytime" or "none") return (null, null, null);
        var parts = t.Split(['-', '–', ' '], StringSplitOptions.RemoveEmptyEntries).Where(p => p != "to").ToArray();
        if (parts.Length == 2
            && TimeOnly.TryParseExact(parts[0], ["HH:mm", "H:mm", "HH"], CultureInfo.InvariantCulture, DateTimeStyles.None, out var from)
            && TimeOnly.TryParseExact(parts[1], ["HH:mm", "H:mm", "HH"], CultureInfo.InvariantCulture, DateTimeStyles.None, out var to))
            return (from.ToString("HH:mm", CultureInfo.InvariantCulture), to.ToString("HH:mm", CultureInfo.InvariantCulture), null);
        return (null, null, "hours must be like 16:00-19:00 (24-hour clock), or 'all day'.");
    }

    private static string Window(int? weekdays, string? from, string? to)
    {
        var days = weekdays is null or 0 or 127
            ? "every day"
            : "on " + string.Join(", ", Enum.GetValues<DayOfWeek>().Where(d => (weekdays.Value & (1 << (int)d)) != 0).Select(d => d.ToString()[..3]));
        return from is null || to is null ? $"{days}, all day" : $"{days}, {from}-{to}";
    }

    private static int ParseKind(string kind) => kind.Trim().ToLowerInvariant() switch
    {
        "percent" or "percentage" or "%" => 0,
        "amount" or "fixed" or "money" => 1,
        _ => -1,
    };

    /// <summary>A day as yyyy-MM-dd; 'none' clears it</summary>
    internal static (DateOnly? Day, string? Error) ParseDay(string? text)
    {
        var t = text?.Trim();
        if (string.IsNullOrEmpty(t) || t.Equals("none", StringComparison.OrdinalIgnoreCase)) return (null, null);
        return DateOnly.TryParseExact(t, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var day)
            ? (day, null)
            : (null, "Days must be yyyy-MM-dd.");
    }

    /// <summary>Midnight of a business's day, in UTC: a code starts then, and ends at the next one</summary>
    internal static DateTime StartUtc(DateOnly day, TimeZoneInfo zone)
        => TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), zone);

    private static DateOnly LocalDay(DateTime utc, TimeZoneInfo zone)
        => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), zone));

    /// <summary>Catalog's own checks, said before anything is sent</summary>
    private static string? Check(PromoCodeRequest r)
    {
        if (r.Code.Length is 0 or > 20 || !r.Code.All(c => char.IsAsciiLetterOrDigit(c) || c == '-'))
            return "A code is letters, digits and dashes, up to 20 characters.";
        if (r.Value <= 0) return "The discount must be more than zero.";
        if (r.Kind == 0 && r.Value > 100) return "A percentage cannot be more than 100.";
        if (r.MinSubtotal is < 0) return "The minimum cannot be negative.";
        if (r.MaxUses is <= 0) return "The number of uses must be at least one.";
        if (r.StartsAt is { } from && r.EndsAt is { } to && to <= from) return "The code must end after it starts.";
        return null;
    }

    private static string Describe(PromoCodeRequest r, TenantSnapshot snap)
    {
        var sb = new StringBuilder(r.Code).Append(": ");
        sb.Append(r.Kind == 0 ? $"{ToolResults.Money(r.Value)}% off" : $"{snap.Currency} {ToolResults.Money(r.Value)} off");
        if (r.MinSubtotal is { } min) sb.Append($" orders of {snap.Currency} {ToolResults.Money(min)} or more");
        if (r.StartsAt is { } from) sb.Append($", from {ToolSupport.Day(LocalDay(from, snap.Zone))}");
        if (r.EndsAt is { } to) sb.Append($", through {ToolSupport.Day(LocalDay(to.AddTicks(-1), snap.Zone))}");
        if (r.MaxUses is { } cap) sb.Append($", {cap} use{(cap == 1 ? "" : "s")} in all");
        sb.Append(r.OncePerCustomer ? ", once per customer" : ", any number of times per customer");
        if (!r.IsActive) sb.Append(", switched off");
        return sb.ToString();
    }
}

// The plans a preview makes and a confirm carries out, signed (Auth/DraftSigner)

public sealed record CategoryDraft(LocalizedText Name, int DisplayOrder);

public sealed record ChoicesDraft(int ItemId, LocalizedText ItemName, List<DraftGroup> Groups);

public sealed record RecipeDraft(int? BranchId, int ItemId, LocalizedText ItemName, DraftRecipe Recipe);
