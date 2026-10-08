using System.ComponentModel;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;
using static Ninja.Assistant.API.Tools.ToolSupport;

namespace Ninja.Assistant.API.Tools;

/// <summary>
/// The menu as the owner thinks of it: what is on it and at what price, what
/// each dish is made of, and what it costs to make. The menu is one list for
/// the chain with branch overrides on top, so each branch is read with its own
/// X-Branch-Id and the answer says where a price or availability differs.
/// </summary>
[McpServerToolType]
public sealed class MenuReadTools(TenantContext tenant, NinjaApiClient api, TimeProvider clock)
{
    private const string CategoryDescription = "A category's name (English or Arabic) or id, to keep only that category. Omit for the whole menu.";

    [McpServerTool(Name = "get_menu", Title = "Menu", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("The menu by category: each item's id, name, price, offer (price, days and hours, whether it is live now), whether it is popular, its customization groups in short (\"Size (3, required)\"), and the branches where it is sold out or out of stock, or priced differently. Totals first. Use for 'what is on the menu', 'how much is a latte', 'what is sold out at Maadi', 'which items are on offer'. For one item in full use get_menu_item.")]
    public async Task<CallToolResult> GetMenu(
        [Description(CategoryDescription)] string? category = null,
        [Description(BranchDescription)] string? branch = null,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await ReadSupport.ResolveAsync(tenant, branch, ct);
        if (fail is not null) return fail;

        var fan = await FanOut.PerBranchAsync(branches!, b => api.GetAsync<List<MenuItemView>>("catalog-api", "/api/catalog/items", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        // The items are the chain's; the first branch's list gives their order and categories
        var items = fan.Ok[0].Value;
        if (!string.IsNullOrWhiteSpace(category))
        {
            var (picked, error) = PickCategory(items, category);
            if (picked is null) return ToolResults.Fail(error!);
            items = items.Where(i => i.CatalogTypeId == picked.CatalogTypeId).ToList();
        }
        var at = fan.Ok.Select(x => (x.Branch, Items: x.Value.ToDictionary(i => i.Id))).ToList();

        var rows = items.Select(i => new
        {
            item = i,
            soldOutAt = Where(at, i.Id, x => !x.IsAvailable && !x.IsOutOfStock),
            outOfStockAt = Where(at, i.Id, x => x.IsOutOfStock),
        }).ToList();

        return ToolResults.Ok(new
        {
            currency = snap!.Currency,
            branches = at.Select(x => new { id = x.Branch.Id, name = x.Branch.DisplayName, nameAr = x.Branch.NameAr }),
            items = rows.Count,
            soldOutSomewhere = rows.Count(r => r.soldOutAt is not null || r.outOfStockAt is not null),
            onOffer = rows.Count(r => Offer(r.item, at) is not null),
            categories = rows.GroupBy(r => r.item.CatalogTypeId).Select(g => new
            {
                category = g.First().item.CatalogTypeName?.Display,
                categoryAr = g.First().item.CatalogTypeName?.Arabic,
                categoryId = g.Key,
                items = g.Select(r => new
                {
                    id = r.item.Id,
                    name = r.item.Name?.Display,
                    nameAr = r.item.Name?.Arabic,
                    price = ChainPrice(r.item),
                    branchPrices = BranchPrices(r.item, at),
                    offer = Offer(r.item, at),
                    popular = r.item.IsPopular ? true : (bool?)null,
                    choices = Choices(r.item),
                    r.soldOutAt,
                    r.outOfStockAt,
                }),
            }),
            errors = ErrorsOrNull(fan.Errors),
        });
    }

    [McpServerTool(Name = "get_menu_item", Title = "Menu item", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("One menu item in full: description, category, price and offer, availability and price at each branch, every customization group with its options and what each adds to the price, and, when the business tracks stock, its recipe line by line with what each line costs and the dish's food cost and margin. Use for 'what goes in the Spanish latte', 'what are the latte's options', 'what does a burger cost us to make'.")]
    public async Task<CallToolResult> GetMenuItem(
        [Description("The item's name (English or Arabic, or a part of it) or its id")] string item,
        [Description(BranchDescription)] string? branch = null,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await ReadSupport.ResolveAsync(tenant, branch, ct);
        if (fail is not null) return fail;

        var fan = await FanOut.PerBranchAsync(branches!, b => api.GetAsync<List<MenuItemView>>("catalog-api", "/api/catalog/items", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        var (found, error) = NameResolver.Pick(fan.Ok[0].Value, item, i => i.Id, i => i.Name, "menu item");
        if (found is null) return ToolResults.Fail(error!);
        var at = fan.Ok.Select(x => (x.Branch, Items: x.Value.ToDictionary(i => i.Id))).ToList();
        var options = (found.Customizations ?? []).SelectMany(g => g.Options ?? []).ToDictionary(o => o.Id, o => o.Name);

        // The recipe is costed at one branch's average costs: the one asked about, else the first
        var anchor = ReadSupport.Anchor(snap!, branches)!;
        var costs = await api.GetAsync<List<RecipeCostView>>("inventory-api", "/api/inventory/recipes/costs", anchor.Id, ct);
        object recipe;
        if (!costs.IsOk)
            recipe = new { note = costs.Error };
        else if (costs.Value!.FirstOrDefault(c => c.CatalogItemId == found.Id) is not { } cost)
            recipe = new { note = "Not tracked in inventory: selling it takes nothing off the shelf." };
        else
        {
            var price = at.FirstOrDefault(x => x.Branch.Id == anchor.Id).Items?.GetValueOrDefault(found.Id)?.Price ?? found.Price;
            recipe = new
            {
                costedAt = anchor.DisplayName,
                costedAtAr = anchor.NameAr,
                baseCost = Math.Round(cost.BaseCost, 2),
                margin = Math.Round(price - cost.BaseCost, 2),
                foodCostPercent = price > 0 ? Math.Round(cost.BaseCost / price * 100, 1) : (decimal?)null,
                costIncomplete = cost.Uncosted is { Count: > 0 } ? "Some ingredients were never received at this branch, so they have no cost yet: the cost is a lower bound." : null,
                lines = (cost.Lines ?? []).OrderBy(l => l.Slot).ThenBy(l => l.OptionIds?.Count ?? 0).Select(l => new
                {
                    stockItem = l.Name?.Display,
                    stockItemAr = l.Name?.Arabic,
                    quantity = l.IsNone ? 0 : l.Quantity,
                    unit = l.Unit,
                    @for = OptionNames(l.OptionIds, options),
                    none = l.IsNone ? true : (bool?)null,
                    cost = Math.Round(l.Cost, 2),
                }),
            };
        }

        return ToolResults.Ok(new
        {
            currency = snap!.Currency,
            id = found.Id,
            name = found.Name?.Display,
            nameAr = found.Name?.Arabic,
            description = found.Description?.Display is { Length: > 0 } d ? d : null,
            descriptionAr = found.Description?.Arabic,
            category = found.CatalogTypeName?.Display,
            categoryAr = found.CatalogTypeName?.Arabic,
            price = ChainPrice(found),
            offer = Offer(found, at),
            popular = found.IsPopular,
            preparationMinutes = found.PreparationTimeMinutes,
            branches = at.Select(x => x.Items.GetValueOrDefault(found.Id) is { } b
                ? new { branch = x.Branch.DisplayName, branchAr = x.Branch.NameAr, available = b.IsAvailable, outOfStock = b.IsOutOfStock ? true : (bool?)null, price = b.Price, nowCharged = b.EffectivePrice }
                : new { branch = x.Branch.DisplayName, branchAr = x.Branch.NameAr, available = false, outOfStock = (bool?)null, price = 0m, nowCharged = 0m }),
            customizations = (found.Customizations ?? []).OrderBy(g => g.DisplayOrder).Select(g => new
            {
                group = g.Name?.Display,
                groupAr = g.Name?.Arabic,
                required = g.IsRequired,
                pickSeveral = g.AllowMultiple,
                options = (g.Options ?? []).OrderBy(o => o.DisplayOrder).Select(o => new
                {
                    option = o.Name?.Display,
                    optionAr = o.Name?.Arabic,
                    adds = o.PriceAdjustment,
                    @default = o.IsDefault ? true : (bool?)null,
                    outOfStockAt = Names(at.Where(x => x.Items.GetValueOrDefault(found.Id)?.Customizations?.SelectMany(cg => cg.Options ?? []).Any(oo => oo.Id == o.Id && oo.IsOutOfStock) == true).Select(x => x.Branch)),
                }),
            }),
            recipe,
            errors = ErrorsOrNull(fan.Errors),
        });
    }

    [McpServerTool(Name = "get_recipes", Title = "Recipes", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("What each tracked menu item takes off the shelf per sale: its stock items with quantities and units, and the lines that change with an option (Large: 300 ml milk; plain: no sugar). Also how many menu items are not tracked and which. Use for 'what is in our recipes', 'which dishes have no recipe', 'how much milk goes in a cappuccino'. Needs the inventory module.")]
    public async Task<CallToolResult> GetRecipes(
        [Description("One item's name or id, to see only its recipe")] string? item = null,
        [Description(CategoryDescription)] string? category = null,
        [Description(TopDescription)] int top = 20,
        CancellationToken ct = default)
    {
        var (snap, _, fail) = await ReadSupport.ResolveAsync(tenant, null, ct);
        if (fail is not null) return fail;
        top = ToolResults.ClampTop(top);
        var anchor = ReadSupport.Anchor(snap!, null)!;

        // Recipes are the chain's; the menu gives them their names
        var menu = await api.GetAsync<List<MenuItemView>>("catalog-api", "/api/catalog/items", anchor.Id, ct);
        if (!menu.IsOk) return ToolResults.Fail(menu.Error!);
        var recipes = await api.GetAsync<List<RecipeView>>("inventory-api", "/api/inventory/recipes", anchor.Id, ct);
        if (!recipes.IsOk) return ToolResults.Fail(recipes.Error!);

        var items = menu.Value!;
        if (!string.IsNullOrWhiteSpace(category))
        {
            var (picked, error) = PickCategory(items, category);
            if (picked is null) return ToolResults.Fail(error!);
            items = items.Where(i => i.CatalogTypeId == picked.CatalogTypeId).ToList();
        }
        if (!string.IsNullOrWhiteSpace(item))
        {
            var (picked, error) = NameResolver.Pick(items, item, i => i.Id, i => i.Name, "menu item");
            if (picked is null) return ToolResults.Fail(error!);
            items = [picked];
        }

        var byItem = recipes.Value!.ToDictionary(r => r.CatalogItemId);
        var tracked = items.Where(i => byItem.ContainsKey(i.Id)).ToList();
        var untracked = items.Where(i => !byItem.ContainsKey(i.Id)).ToList();

        return ToolResults.Ok(new
        {
            tracked = tracked.Count,
            notTracked = untracked.Count,
            notTrackedItems = untracked.Take(top).Select(i => new { id = i.Id, name = i.Name?.Display, nameAr = i.Name?.Arabic }),
            recipes = tracked.Take(top).Select(i =>
            {
                var options = (i.Customizations ?? []).SelectMany(g => g.Options ?? []).ToDictionary(o => o.Id, o => o.Name);
                return new
                {
                    id = i.Id,
                    item = i.Name?.Display,
                    itemAr = i.Name?.Arabic,
                    category = i.CatalogTypeName?.Display,
                    categoryAr = i.CatalogTypeName?.Arabic,
                    lines = (byItem[i.Id].Lines ?? []).OrderBy(l => l.Slot).ThenBy(l => l.OptionIds?.Count ?? 0).Select(l => new
                    {
                        stockItem = l.Name?.Display,
                        stockItemAr = l.Name?.Arabic,
                        quantity = l.IsNone ? 0 : l.Quantity,
                        unit = l.Unit,
                        @for = OptionNames(l.OptionIds, options),
                        none = l.IsNone ? true : (bool?)null,
                    }),
                };
            }),
            more = tracked.Count > top ? tracked.Count - top : (int?)null,
        });
    }

    [McpServerTool(Name = "get_food_cost", Title = "Food cost and margins", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("What one sale of each tracked dish costs in ingredients at each branch's average costs, against its menu price: cost, margin and food-cost percentage, worst margins first, plus the branch's average food-cost percentage. Use for 'which dishes make the least money', 'food cost of the burgers', 'is the latte priced right'. Needs the inventory module; dishes without a recipe are left out.")]
    public async Task<CallToolResult> GetFoodCost(
        [Description(CategoryDescription)] string? category = null,
        [Description(BranchDescription)] string? branch = null,
        [Description(TopDescription)] int top = 15,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await ReadSupport.ResolveAsync(tenant, branch, ct);
        if (fail is not null) return fail;
        top = ToolResults.ClampTop(top);

        // Prices can differ by branch, and so can average costs: both are read per branch
        var fan = await FanOut.PerBranchAsync(branches!, async b =>
        {
            var costs = await api.GetAsync<List<RecipeCostView>>("inventory-api", "/api/inventory/recipes/costs", b.Id, ct);
            if (!costs.IsOk) return ApiResult<(List<RecipeCostView>, List<MenuItemView>)>.Fail(costs.Error!, costs.Status);
            var menu = await api.GetAsync<List<MenuItemView>>("catalog-api", "/api/catalog/items", b.Id, ct);
            if (!menu.IsOk) return ApiResult<(List<RecipeCostView>, List<MenuItemView>)>.Fail(menu.Error!, menu.Status);
            return ApiResult<(List<RecipeCostView>, List<MenuItemView>)>.Ok((costs.Value!, menu.Value!));
        });
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        int? categoryId = null;
        if (!string.IsNullOrWhiteSpace(category))
        {
            var (picked, error) = PickCategory(fan.Ok[0].Value.Item2, category);
            if (picked is null) return ToolResults.Fail(error!);
            categoryId = picked.CatalogTypeId;
        }

        var perBranch = fan.Ok.Select(x =>
        {
            var menu = x.Value.Item2.ToDictionary(i => i.Id);
            var rows = x.Value.Item1
                .Where(c => menu.ContainsKey(c.CatalogItemId) && (categoryId is null || menu[c.CatalogItemId].CatalogTypeId == categoryId))
                .Select(c =>
                {
                    var i = menu[c.CatalogItemId];
                    var offer = i.IsOnOffer && i.OfferPrice is { } op ? op : (decimal?)null;
                    return new
                    {
                        id = i.Id,
                        item = i.Name?.Display,
                        itemAr = i.Name?.Arabic,
                        category = i.CatalogTypeName?.Display,
                        categoryAr = i.CatalogTypeName?.Arabic,
                        price = i.Price,
                        cost = Math.Round(c.BaseCost, 2),
                        margin = Math.Round(i.Price - c.BaseCost, 2),
                        foodCostPercent = i.Price > 0 ? Math.Round(c.BaseCost / i.Price * 100, 1) : (decimal?)null,
                        offerPrice = offer,
                        offerMargin = offer is { } o ? Math.Round(o - c.BaseCost, 2) : (decimal?)null,
                        costIncomplete = c.Uncosted is { Count: > 0 } ? true : (bool?)null,
                    };
                })
                .OrderByDescending(r => r.foodCostPercent ?? decimal.MaxValue)
                .ToList();
            var percents = rows.Where(r => r.foodCostPercent is not null).Select(r => r.foodCostPercent!.Value).ToList();
            return new
            {
                id = x.Branch.Id,
                name = x.Branch.DisplayName,
                nameAr = x.Branch.NameAr,
                tracked = rows.Count,
                averageFoodCostPercent = percents.Count > 0 ? Math.Round(percents.Average(), 1) : (decimal?)null,
                worstFirst = rows.Take(top),
                more = rows.Count > top ? rows.Count - top : (int?)null,
            };
        }).ToList();

        return ToolResults.Ok(new
        {
            currency = snap!.Currency,
            note = "Costs are one sale with the default choices, at the branch's average ingredient costs; prices are the menu's regular price at the branch. costIncomplete marks a dish with an ingredient never received at the branch: its cost is a lower bound.",
            branches = perBranch,
            errors = ErrorsOrNull(fan.Errors),
        });
    }

    [McpServerTool(Name = "get_promo_codes", Title = "Promo codes", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("The promo codes customers can type at checkout: the discount (a percentage or an amount), the minimum order, when it runs, how many times it has been used out of how many allowed, once per customer or not, and its state now (live, scheduled, expired, used up, off). Use for 'which promo codes are running', 'how many people used SUMMER10'.")]
    public async Task<CallToolResult> GetPromoCodes(
        [Description("Only the codes that work right now")] bool liveOnly = false,
        [Description(TopDescription)] int top = 20,
        CancellationToken ct = default)
    {
        var (snap, _, fail) = await ReadSupport.ResolveAsync(tenant, null, ct);
        if (fail is not null) return fail;
        top = ToolResults.ClampTop(top);

        var promos = await api.GetAsync<List<PromoCodeView>>("catalog-api", "/api/catalog/promos", null, ct);
        if (!promos.IsOk) return ToolResults.Fail(promos.Error!);

        var now = clock.GetUtcNow().UtcDateTime;
        var rows = promos.Value!.Select(p => (p, state: State(p, now))).Where(x => !liveOnly || x.state == "live").ToList();
        return ToolResults.Ok(new
        {
            currency = snap!.Currency,
            codes = rows.Count,
            live = rows.Count(x => x.state == "live"),
            timesUsed = rows.Sum(x => x.p.Uses),
            promos = rows.Take(top).Select(x => new
            {
                x.p.Id,
                x.p.Code,
                discount = x.p.Kind == PromoKind.Percent ? ToolResults.Money(x.p.Value) + "%" : null,
                discountAmount = x.p.Kind == PromoKind.Amount ? x.p.Value : (decimal?)null,
                minimumOrder = x.p.MinSubtotal,
                starts = ReadSupport.Local(snap, x.p.StartsAt),
                ends = ReadSupport.Local(snap, x.p.EndsAt),
                used = x.p.Uses,
                maxUses = x.p.MaxUses,
                oncePerCustomer = x.p.OncePerCustomer,
                x.state,
            }),
            more = rows.Count > top ? rows.Count - top : (int?)null,
        });
    }

    // --- Shared --------------------------------------------------------------

    private static string State(PromoCodeView p, DateTime now)
    {
        if (!p.IsActive) return "off";
        if (p.EndsAt is { } end && end <= now) return "expired";
        if (p.StartsAt is { } start && start > now) return "scheduled";
        if (p.MaxUses is { } max && p.Uses >= max) return "used up";
        return "live";
    }

    /// <summary>The categories the menu's items name, picked from the way NameResolver picks anything.</summary>
    private static (MenuItemView? Picked, string? Error) PickCategory(List<MenuItemView> items, string category)
    {
        var categories = items.GroupBy(i => i.CatalogTypeId).Select(g => g.First()).ToList();
        return NameResolver.Pick(categories, category, i => i.CatalogTypeId, i => i.CatalogTypeName, "category");
    }

    private static decimal ChainPrice(MenuItemView i) => i.Base?.Price ?? i.Price;

    /// <summary>The branches where the item's price differs from the chain's; null when none does.</summary>
    private static object? BranchPrices(MenuItemView i, List<(BranchResponse Branch, Dictionary<int, MenuItemView> Items)> at)
    {
        var differing = at.Where(x => x.Items.GetValueOrDefault(i.Id) is { } b && b.Price != ChainPrice(i))
            .Select(x => new { branch = x.Branch.DisplayName, branchAr = x.Branch.NameAr, price = x.Items[i.Id].Price })
            .ToList();
        return differing.Count == 0 ? null : differing;
    }

    /// <summary>The offer when it is switched on anywhere: its price, its days and hours, and where it is live right now.</summary>
    private static object? Offer(MenuItemView i, List<(BranchResponse Branch, Dictionary<int, MenuItemView> Items)> at)
    {
        var liveAt = at.Where(x => x.Items.GetValueOrDefault(i.Id)?.IsOnOffer == true).Select(x => x.Branch).ToList();
        if (!(i.Base?.IsOnOffer ?? false) && liveAt.Count == 0) return null;
        return new
        {
            price = i.OfferPrice ?? i.Base?.OfferPrice,
            days = ReadSupport.Weekdays(i.OfferWeekdays),
            from = i.OfferFrom,
            to = i.OfferTo,
            liveNowAt = Names(liveAt),
        };
    }

    private static List<string>? Choices(MenuItemView i)
    {
        var groups = (i.Customizations ?? []).OrderBy(g => g.DisplayOrder)
            .Select(g => $"{g.Name?.Display} ({(g.Options ?? []).Count}{(g.IsRequired ? ", required" : "")}{(g.AllowMultiple ? ", several" : "")})")
            .ToList();
        return groups.Count == 0 ? null : groups;
    }

    private static List<string>? Where(List<(BranchResponse Branch, Dictionary<int, MenuItemView> Items)> at, int id, Func<MenuItemView, bool> test)
        => Names(at.Where(x => x.Items.GetValueOrDefault(id) is { } i && test(i)).Select(x => x.Branch));

    private static List<string>? Names(IEnumerable<BranchResponse> branches)
    {
        var names = branches.Select(b => b.BothNames).ToList();
        return names.Count == 0 ? null : names;
    }

    /// <summary>The options a recipe line is for, by name ("Large / Oat milk"); null for the slot's default line.</summary>
    private static string? OptionNames(List<int>? ids, Dictionary<int, LocalizedText?> options)
        => ids is not { Count: > 0 } ? null : string.Join(" / ", ids.Select(id => options.GetValueOrDefault(id)?.Both ?? $"option {id}"));
}
