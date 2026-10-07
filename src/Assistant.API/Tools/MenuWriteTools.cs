using System.ComponentModel;
using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;

namespace Ninja.Assistant.API.Tools;

/// <summary>
/// A dish made whole from chat: the item, its customizations and its recipe
/// (with the stock items the recipe needs), and a photo if asked, previewed
/// together and made with one confirm. The preview's AI parts (the other
/// language, suggested choices, the recipe) are the services' own assistants;
/// the plan they make travels to the confirm as a signed draft, so what is
/// made is what the owner saw.
/// </summary>
[McpServerToolType]
public sealed class MenuWriteTools(TenantContext tenant, NinjaApiClient api, WriteFlow flow)
{
    internal const string CreateTool = "create_menu_item";

    /// <summary>The references the preview gives the options it proposes, before Catalog gives them ids</summary>
    internal const int FirstOptionRef = 900_000_001;

    /// <summary>The catalog item id the recipe proposer is told, before the item exists</summary>
    private const int PendingItemId = 999_999_999;

    public sealed record GroupInput(
        [property: Description("The group's name, e.g. Size or Milk")] string Name,
        [property: Description("Its options in order: name and the price it adds (0 for the standard one)")] List<OptionInput> Options,
        [property: Description("true when the customer must pick one (a size); false for optional extras")] bool Required = false,
        [property: Description("true when several can be picked (extras); false for one of them (a size, a milk)")] bool Multiple = false,
        [property: Description("The group's Arabic name, when the business shows Arabic")] string? NameAr = null);

    public sealed record OptionInput(
        [property: Description("The option's name, e.g. Large")] string Name,
        [property: Description("What it adds to the price, 0 for the standard choice")] decimal Price = 0,
        [property: Description("true for the one picked unless the customer changes it")] bool Default = false,
        [property: Description("The option's Arabic name, when the business shows Arabic")] string? NameAr = null);

    [McpServerTool(Name = CreateTool, Title = "Add a dish to the menu", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Adds a dish to the menu in one go: the item (named in both languages), its customizations (sizes, milks, extras) and its stock recipe built from the stock items the business already tracks, adding the ones it lacks in grams, ml or pieces; optionally a photo. " +
        "The preview shows all of it and writes nothing; the confirm makes it all. Use for 'add a Spanish latte, 85, with sizes and oat milk', 'put a new burger on the menu'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> CreateMenuItem(
        [Description("The dish's name, in English or Arabic (the other language is filled in)")] string name,
        [Description("Its price, in the business's currency")] decimal price,
        [Description("The category it goes in: an existing one's name or id, or a new name")] string category,
        [Description("A short description, optional")] string? description = null,
        [Description("The customization groups as the owner described them. Leave out to have them suggested when suggestCustomizations is true, or for none.")] List<GroupInput>? customizations = null,
        [Description("true to have customizations suggested for this dish when none are given")] bool suggestCustomizations = false,
        [Description("The recipe in the owner's words ('18 g beans, 200 ml milk, a 12 oz cup; large 300 ml milk; plain: no sugar'), 'auto' to have one proposed, or 'none'")] string recipe = "auto",
        [Description("A photo style to draw one: studio, rustic, overhead, moody or fresh; leave out for no photo")] string? photo = null,
        [Description("true to mark it popular on the menu")] bool popular = false,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        [Description(WriteFlow.DraftDescription)] string? draft = null,
        CancellationToken ct = default)
    {
        requestId ??= WriteFlow.NewRequestId();
        return confirm
            ? await ConfirmAsync(requestId, draft, ct)
            : await PreviewAsync(name, price, category, description, customizations, suggestCustomizations, recipe, photo, popular, requestId, ct);
    }

    // --- Preview -------------------------------------------------------------

    private async Task<CallToolResult> PreviewAsync(
        string name, decimal price, string category, string? description, List<GroupInput>? customizations, bool suggest,
        string recipe, string? photo, bool popular, string requestId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(name)) return ToolResults.Fail("The dish needs a name.");
        if (price < 0) return ToolResults.Fail("The price cannot be negative.");
        if (string.IsNullOrWhiteSpace(category)) return ToolResults.Fail("Say which category it goes in, or name a new one.");

        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var branch = snap.Branches.FirstOrDefault(b => b.IsActive) ?? snap.Branches.FirstOrDefault();
        var warnings = new List<string>();

        var categories = await api.GetAsync<List<CategoryDto>>("catalog-api", "/api/catalog/categories", branch?.Id, ct);
        if (!categories.IsOk) return ToolResults.Fail(categories.Error!);
        var (existing, newCategory) = PickCategory(categories.Value!, category);

        // The other language (and a description when none was given), from the menu's own assistant
        var given = Localized(name);
        var givenDescription = string.IsNullOrWhiteSpace(description) ? null : Localized(description);
        var localized = await api.SendAsync<LocalizeMenuResponse>(HttpMethod.Post, "catalog-api", "/api/catalog/assist/localize", branch?.Id,
            new LocalizeMenuRequest(0, given, givenDescription, existing?.Id, SuggestCategory: false, SuggestDescription: givenDescription is null), null, ct);
        var itemName = localized.IsOk ? Merge(given, localized.Value!.Name) : given;
        var itemDescription = localized.IsOk ? localized.Value!.Description ?? givenDescription : givenDescription;
        if (!localized.IsOk) warnings.Add($"The other language was not filled in ({localized.Error}); it can be added in the back office.");
        if (newCategory is not null && localized.IsOk)
        {
            var named = await api.SendAsync<LocalizeMenuResponse>(HttpMethod.Post, "catalog-api", "/api/catalog/assist/localize", branch?.Id,
                new LocalizeMenuRequest(1, newCategory, null, null, false, false), null, ct);
            if (named.IsOk) newCategory = Merge(newCategory, named.Value!.Name);
        }

        // The choices: as the owner gave them, or suggested
        var groups = new List<DraftGroup>();
        var nextRef = FirstOptionRef;
        if (customizations is { Count: > 0 })
        {
            foreach (var g in customizations)
            {
                if (string.IsNullOrWhiteSpace(g.Name) || g.Options is not { Count: > 0 })
                    return ToolResults.Fail("Every customization group needs a name and at least one option.");
                groups.Add(new DraftGroup(new LocalizedText(Clean(g.Name), Clean(g.NameAr)), g.Required, g.Multiple,
                    g.Options.Select(o => new DraftOption(nextRef++, new LocalizedText(Clean(o.Name), Clean(o.NameAr)), o.Price, o.Default)).ToList()));
            }
        }
        else if (suggest)
        {
            var suggested = await api.SendAsync<SuggestCustomizationsResponse>(HttpMethod.Post, "catalog-api", "/api/catalog/assist/customizations", branch?.Id,
                new SuggestCustomizationsRequest(itemName, itemDescription, existing?.Id, price), null, ct);
            if (suggested.IsOk)
            {
                foreach (var g in suggested.Value!.Groups ?? [])
                    groups.Add(new DraftGroup(g.Name, g.IsRequired, g.AllowMultiple,
                        (g.Options ?? []).Select(o => new DraftOption(nextRef++, o.Name, o.PriceAdjustment, o.IsDefault)).ToList()));
                warnings.AddRange(suggested.Value.Warnings ?? []);
            }
            else warnings.Add($"No customizations were suggested ({suggested.Error}).");
        }

        // The recipe, from the shelf, in the owner's words or proposed
        var plan = new DraftRecipe("none", [], []);
        var mode = recipe.Trim();
        if (!mode.Equals("none", StringComparison.OrdinalIgnoreCase))
        {
            var brief = mode.Equals("auto", StringComparison.OrdinalIgnoreCase) ? null : mode;
            var options = groups.SelectMany(g => g.Options.Select(o => new MenuOptionToTrack(o.Ref, g.Name.Display, o.Name))).ToList();
            var proposal = await api.SendAsync<RecipesProposal>(HttpMethod.Post, "inventory-api", "/api/inventory/recipes/assist/propose", branch?.Id,
                new ProposeRecipesRequest([new MenuItemToTrack(PendingItemId, itemName, itemDescription, (existing?.Name ?? newCategory)?.Display, price, options, brief)]), null, ct);
            if (proposal.IsOk && proposal.Value!.Recipes?.FirstOrDefault() is { } proposed)
            {
                var keys = (proposed.Lines ?? []).Select(l => l.NewItemKey).Where(k => k is not null).ToHashSet();
                plan = new DraftRecipe(
                    proposed.Kind,
                    (proposal.Value.NewItems ?? []).Where(n => keys.Contains(n.Key)).Select(n => new DraftStock(n.Key, n.Name, n.Unit, n.PackSize, n.PackName, n.AutoSoldOut)).ToList(),
                    (proposed.Lines ?? []).Select(l => new DraftLine(l.StockItemId, l.NewItemKey, l.Quantity, l.OptionIds ?? [], l.Slot, l.None)).ToList());
                warnings.AddRange(proposed.Warnings ?? []);
                warnings.AddRange(proposal.Value.Warnings ?? []);
            }
            else warnings.Add($"No recipe was proposed ({(proposal.IsOk ? "nothing came back" : proposal.Error)}); set it up in the back office later.");
        }

        var style = string.IsNullOrWhiteSpace(photo) || photo.Trim().Equals("none", StringComparison.OrdinalIgnoreCase) ? null : photo.Trim().ToLowerInvariant();
        var dish = new DishDraft(branch?.Id, itemName, itemDescription, price, existing?.Id, newCategory, (existing?.Name ?? newCategory)!.Both, popular, groups, plan, style);

        var shelf = plan.Lines.Any(l => l.StockItemId is not null)
            ? (await api.GetAsync<List<StockItemDto>>("inventory-api", "/api/inventory/items", branch?.Id, ct)).Value ?? []
            : [];
        return ToolResults.Ok(new
        {
            preview = Describe(dish, snap.Currency, shelf),
            warnings,
            requestId,
            draft = flow.Sign(dish, CreateTool, requestId),
            nextStep = WriteFlow.NextStepWithDraft,
        });
    }

    // --- Confirm -------------------------------------------------------------

    private async Task<CallToolResult> ConfirmAsync(string requestId, string? token, CancellationToken ct)
    {
        var (dish, error) = flow.Open<DishDraft>(token, CreateTool, requestId);
        if (dish is null) return ToolResults.Fail(error!);
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var done = new List<string>();
        var branch = dish.BranchId;

        // 1. The dish, its category and its options, in one go
        var compose = new ComposeItemRequest(dish.Name, dish.Description, dish.Price, dish.CategoryId, dish.NewCategory, dish.Popular, null,
            dish.Groups.Select(g => new ComposeGroup(g.Name, g.Required, g.Multiple, g.Options.Select(o => new ComposeOption(o.Ref, o.Name, o.Price, o.Default)).ToList())).ToList());
        var made = await api.SendAsync<ComposeItemResult>(HttpMethod.Post, "catalog-api", "/api/catalog/items/compose", branch, compose, flow.StepKey(CreateTool, requestId, "item"), ct);
        if (!made.IsOk) return Finish(dish, null, done, $"The dish was not made: {made.Error}");
        var itemId = made.Value!.ItemId;
        done.Add($"\"{dish.Name.Both}\" is on the menu at {dish.Price:0.##}" + (dish.Groups.Count > 0 ? $", with {string.Join(", ", dish.Groups.Select(g => g.Name.Display))}" : "") + ".");
        var optionIds = (made.Value.Options ?? []).ToDictionary(o => o.Ref, o => o.Id);

        // 2. The stock items the recipe needs that the shelf lacks
        var stockIds = new Dictionary<string, int>();
        foreach (var stock in dish.Recipe.NewStock)
        {
            var created = await api.SendAsync<CreatedResponse>(HttpMethod.Post, "inventory-api", "/api/inventory/items", branch,
                new StockItemRequest(stock.Name, stock.Unit, stock.PackSize, stock.PackName, stock.AutoSoldOut), flow.StepKey(CreateTool, requestId, $"stock:{stock.Key}"), ct);
            var id = created.IsOk ? created.Value!.Id : 0;
            // A repeated confirm: Inventory says the request was already handled, without its id; find it by name
            if (created.IsOk && id == 0) id = await FindStockAsync(stock.Name, branch, ct) ?? 0;
            if (id == 0) return Finish(dish, itemId, done, $"The stock item \"{stock.Name.Both}\" was not added ({created.Error ?? "not found after adding"}), so the recipe was not set. Set it up on the dish's Stock tab.");
            stockIds[stock.Key] = id;
            done.Add($"Stock item \"{stock.Name.Both}\" added, counted in {stock.Unit}.");
        }

        // 3. The recipe, with the options' real ids
        if (dish.Recipe.Kind == "unit")
        {
            var unit = await api.SendAsync<CreatedResponse>(HttpMethod.Post, "inventory-api", "/api/inventory/recipes/track-by-unit", branch,
                new TrackByUnitRequest(itemId, dish.Name), flow.StepKey(CreateTool, requestId, "unit"), ct);
            if (!unit.IsOk) return Finish(dish, itemId, done, $"Its stock was not set up ({unit.Error}).");
            done.Add("Stock: it is counted as a unit of its own, one per sale.");
        }
        else if (dish.Recipe.Kind == "recipe" && dish.Recipe.Lines.Count > 0)
        {
            var lines = new List<RecipeLineInput>();
            foreach (var line in dish.Recipe.Lines)
            {
                var stockId = line.StockItemId ?? (line.NewItemKey is { } key && stockIds.TryGetValue(key, out var id) ? id : 0);
                if (stockId == 0) continue;
                lines.Add(new RecipeLineInput(stockId, line.Quantity, line.OptionRefs.Select(r => optionIds.GetValueOrDefault(r)).Where(id => id > 0).ToList(), line.Slot, line.None));
            }
            var set = await api.SendAsync<Unit>(HttpMethod.Put, "inventory-api", $"/api/inventory/recipes/{itemId}", branch, new RecipeRequest(lines), null, ct);
            if (!set.IsOk) return Finish(dish, itemId, done, $"The recipe was not set ({set.Error}). Set it up on the dish's Stock tab.");
            done.Add($"Recipe set: {lines.Count} line{(lines.Count == 1 ? "" : "s")}; each sale takes its ingredients off the stock.");
        }

        // 4. A photo, drawn and uploaded
        if (dish.PhotoStyle is { } style)
        {
            var drawn = await api.SendAsync<byte[]>(HttpMethod.Post, "catalog-api", "/api/catalog/assist/photo", branch,
                new DrawDishPhotoRequest(dish.Name.En, dish.Name.Ar, dish.Description?.Display, dish.CategoryLabel, style, null), null, ct);
            if (drawn.IsOk)
            {
                var form = new MultipartFormDataContent();
                var file = new ByteArrayContent(drawn.Value!);
                file.Headers.ContentType = new MediaTypeHeaderValue("image/webp");
                form.Add(file, "file", "dish.webp");
                var uploaded = await api.SendAsync<Unit>(HttpMethod.Post, "catalog-api", $"/api/catalog/items/{itemId}/pic", branch, form, null, ct);
                done.Add(uploaded.IsOk ? $"A {style} photo was drawn and set." : $"The photo was drawn but not saved ({uploaded.Error}).");
            }
            else done.Add($"No photo was drawn ({drawn.Error}); add one in the back office.");
        }

        return Finish(dish, itemId, done, null);
    }

    private CallToolResult Finish(DishDraft dish, int? itemId, List<string> done, string? failure)
    {
        flow.Audit(CreateTool, new { dish = dish.Name.Display, dish.Price, itemId, groups = dish.Groups.Count, recipe = dish.Recipe.Kind, newStock = dish.Recipe.NewStock.Count },
            failure ?? $"item {itemId}");
        return failure is null
            ? ToolResults.Ok(new { done = true, itemId, steps = done })
            : ToolResults.Ok(new { done = false, itemId, steps = done, stopped = failure, next = "Calling again with the same requestId and draft finishes the rest without making anything twice." });
    }

    private async Task<int?> FindStockAsync(LocalizedText name, int? branch, CancellationToken ct)
    {
        var items = await api.GetAsync<List<StockItemDto>>("inventory-api", "/api/inventory/items", branch, ct);
        return items.Value?.FirstOrDefault(i => Same(i.Name, name))?.Id;
    }

    // --- Pieces --------------------------------------------------------------

    internal static (CategoryDto? Existing, LocalizedText? New) PickCategory(IReadOnlyList<CategoryDto> categories, string text)
    {
        text = text.Trim();
        if (int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) && categories.FirstOrDefault(c => c.Id == id) is { } byId)
            return (byId, null);
        var match = categories.FirstOrDefault(c => Hit(c.Name, text, exact: true)) ?? categories.FirstOrDefault(c => Hit(c.Name, text, exact: false));
        return match is not null ? (match, null) : (null, Localized(text));
    }

    /// <summary>The words given, on the side of their script: Arabic letters are the Arabic name</summary>
    internal static LocalizedText Localized(string text)
    {
        text = text.Trim();
        return text.Any(c => c is >= '؀' and <= 'ۿ') ? new LocalizedText(null, text) : new LocalizedText(text, null);
    }

    /// <summary>What the owner gave wins; the assistant fills the side left empty</summary>
    private static LocalizedText Merge(LocalizedText given, LocalizedText filled)
        => new(string.IsNullOrWhiteSpace(given.En) ? filled.En : given.En, string.IsNullOrWhiteSpace(given.Ar) ? filled.Ar : given.Ar);

    private static string? Clean(string? text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();

    private static bool Hit(LocalizedText? name, string text, bool exact)
    {
        static bool One(string? n, string t, bool exact)
            => !string.IsNullOrEmpty(n) && (exact ? n.Equals(t, StringComparison.OrdinalIgnoreCase) : n.Contains(t, StringComparison.OrdinalIgnoreCase));
        return One(name?.En, text, exact) || One(name?.Ar, text, exact);
    }

    private static bool Same(LocalizedText? a, LocalizedText b)
        => (!string.IsNullOrEmpty(b.En) && string.Equals(a?.En, b.En, StringComparison.OrdinalIgnoreCase))
           || (!string.IsNullOrEmpty(b.Ar) && string.Equals(a?.Ar, b.Ar, StringComparison.Ordinal));

    /// <summary>The preview as the owner reads it: the dish, its choices, its recipe in plain lines, what is added to stock</summary>
    internal static string Describe(DishDraft dish, string currency, IReadOnlyList<StockItemDto> shelf)
    {
        var sb = new StringBuilder();
        sb.Append($"Add \"{dish.Name.Both}\" at {currency} {ToolResults.Money(dish.Price)} to ");
        sb.AppendLine(dish.CategoryId is null ? $"a new category \"{dish.CategoryLabel}\"." : $"\"{dish.CategoryLabel}\".");
        if (dish.Description is { } d) sb.AppendLine($"Description: {d.Both}");
        if (dish.Popular) sb.AppendLine("Marked popular.");

        var optionName = dish.Groups.SelectMany(g => g.Options).ToDictionary(o => o.Ref, o => o.Name.Display);
        foreach (var g in dish.Groups)
        {
            var options = string.Join(", ", g.Options.Select(o => o.Name.Both + (o.Price != 0 ? $" +{ToolResults.Money(o.Price)}" : "") + (o.Default ? " (default)" : "")));
            sb.AppendLine($"Choice \"{g.Name.Both}\" ({(g.Required ? "must pick" : "optional")}{(g.Multiple ? ", several" : "")}): {options}");
        }

        var r = dish.Recipe;
        if (r.Kind == "unit") sb.AppendLine("Stock: counted as a unit of its own, one per sale.");
        else if (r.Kind == "recipe" && r.Lines.Count > 0)
        {
            string Ingredient(DraftLine l)
            {
                if (l.NewItemKey is { } key && r.NewStock.FirstOrDefault(s => s.Key == key) is { } fresh) return $"{fresh.Name.Display}|{fresh.Unit}";
                var onShelf = shelf.FirstOrDefault(s => s.Id == l.StockItemId);
                return $"{onShelf?.Name?.Display ?? $"stock item {l.StockItemId}"}|{onShelf?.Unit ?? ""}";
            }
            sb.AppendLine("Recipe, per sale:");
            foreach (var l in r.Lines.OrderBy(l => l.Slot).ThenBy(l => l.OptionRefs.Count))
            {
                var (what, unit) = Ingredient(l).Split('|') is [var w, var u] ? (w, u) : (Ingredient(l), "");
                var when = l.OptionRefs.Count == 0 ? "" : string.Join(" + ", l.OptionRefs.Select(o => optionName.GetValueOrDefault(o, "?"))) + ": ";
                sb.AppendLine(l.None ? $"- {when}no {what}" : $"- {when}{what} {l.Quantity:0.###} {unit}".TrimEnd());
            }
            if (r.NewStock.Count > 0)
                sb.AppendLine("New stock items: " + string.Join(", ", r.NewStock.Select(s => $"{s.Name.Both} (in {s.Unit})")) + ".");
        }
        else sb.AppendLine("No stock recipe.");

        if (dish.PhotoStyle is { } style) sb.AppendLine($"A {style} photo will be drawn for it.");
        return sb.ToString().TrimEnd();
    }
}

// The plan a preview makes and a confirm carries out, signed (Auth/DraftSigner)

public sealed record DishDraft(
    int? BranchId, LocalizedText Name, LocalizedText? Description, decimal Price,
    int? CategoryId, LocalizedText? NewCategory, string CategoryLabel, bool Popular,
    List<DraftGroup> Groups, DraftRecipe Recipe, string? PhotoStyle);

public sealed record DraftGroup(LocalizedText Name, bool Required, bool Multiple, List<DraftOption> Options);

public sealed record DraftOption(int Ref, LocalizedText Name, decimal Price, bool Default);

/// <param name="Kind">"recipe", "unit" or "none"</param>
public sealed record DraftRecipe(string Kind, List<DraftStock> NewStock, List<DraftLine> Lines);

public sealed record DraftStock(string Key, LocalizedText Name, string Unit, decimal? PackSize, LocalizedText? PackName, bool AutoSoldOut);

public sealed record DraftLine(int? StockItemId, string? NewItemKey, decimal Quantity, List<int> OptionRefs, int Slot, bool None);
