using System.ComponentModel;
using System.Globalization;
using System.Text;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;

namespace Ninja.Assistant.API.Tools;

/// <summary>
/// The storeroom from chat: the stock items themselves (added, renamed,
/// retired rather than deleted), where a branch's low-stock warning sits, and
/// the branch's ledger: waste, a correction, a delivery received, a count and
/// a transfer to another branch. Each previews first and writes on the
/// confirm, under an idempotency key Inventory keeps, so a confirm sent twice
/// posts once. Quantities are in the item's own unit (g, ml or pcs); the
/// owner may say kg or litres and they are converted, never guessed.
/// </summary>
[McpServerToolType]
public sealed class StockWriteTools(TenantContext tenant, NinjaApiClient api, WriteFlow flow)
{
    private const string Inventory = "inventory-api";

    internal const string CreateTool = "create_stock_item";
    internal const string UpdateTool = "update_stock_item";
    internal const string ReorderTool = "set_reorder_level";
    internal const string WasteTool = "record_waste";
    internal const string AdjustTool = "adjust_stock";
    internal const string PurchaseTool = "record_purchase";
    internal const string CountTool = "record_stock_count";
    internal const string TransferTool = "transfer_stock";

    /// <summary>Inventory's MovementType numbers for the two posted by hand</summary>
    internal const int Waste = 2;
    internal const int Adjustment = 4;

    private const string BranchDescription = "Branch id or name; required when the business has more than one active branch";
    private const string UnitDescription = "The unit the owner said (kg, g, l, ml or pcs) when it is not the item's own; it is converted";

    public sealed record StockLine(
        [property: Description("The stock item: its name in English or Arabic, or its id")] string Item,
        [property: Description("How much, in the item's own unit or in Unit")] decimal Quantity,
        [property: Description("kg, g, l, ml or pcs when not the item's own unit")] string? Unit = null);

    public sealed record PurchaseLine(
        [property: Description("The stock item: its name in English or Arabic, or its id")] string Item,
        [property: Description("How much came, in the item's own unit or in Unit")] decimal Quantity,
        [property: Description("The price per unit (per Unit when given); or give Total")] decimal? UnitCost = null,
        [property: Description("What the line cost in all, instead of UnitCost")] decimal? Total = null,
        [property: Description("kg, g, l, ml or pcs when not the item's own unit")] string? Unit = null);

    // --- Stock items ----------------------------------------------------------

    [McpServerTool(Name = CreateTool, Title = "Add a stock item", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Adds an item the business keeps in stock (an ingredient, a cup, a bottle sold as it is), counted in grams, ml or pieces, for every branch. " +
        "Use for 'start tracking oat milk in ml', 'add 12 oz cups', 'we buy beans in 1 kg bags'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> CreateStockItem(
        [Description("Its name, in English or Arabic")] string name,
        [Description("g, ml or pcs: what its quantities are counted in")] string unit,
        [Description("Its Arabic name, when the owner gave both")] string? nameAr = null,
        [Description("How much one pack holds, in its unit (1000 for a 1 kg bag of an item in g); optional")] decimal? packSize = null,
        [Description("What a pack is called, e.g. bag, bottle, carton; optional")] string? packName = null,
        [Description("true when the dishes that need it should sell out when it runs out")] bool autoSoldOut = false,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(name)) return ToolResults.Fail("The stock item needs a name.");
        var baseUnit = BaseUnit(unit);
        if (baseUnit is null) return ToolResults.Fail("unit must be g, ml or pcs (a kilo is 1000 g, a litre 1000 ml).");
        if (packSize is < 0) return ToolResults.Fail("The pack size cannot be negative.");

        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var shelf = await api.GetAsync<List<StockItemView>>(Inventory, "/api/inventory/items?includeInactive=true", null, ct);
        if (!shelf.IsOk) return ToolResults.Fail(shelf.Error!);

        var given = MenuWriteTools.Localized(name);
        if (MenuWriteTools.Clean(nameAr) is { } ar) given = new LocalizedText(given.En, ar);
        var there = shelf.Value!.FirstOrDefault(s => MenuWriteTools.Same(s.Name, given));
        if (there is not null && !confirm)
            return ToolResults.Fail(there.IsActive
                ? $"\"{there.Name?.Both}\" is already a stock item (id {there.Id}, in {there.Unit})."
                : $"\"{there.Name?.Both}\" is a retired stock item (id {there.Id}); update_stock_item with active=true brings it back.");

        var pack = packSize is > 0 && MenuWriteTools.Clean(packName) is { } said ? MenuWriteTools.Localized(said) : null;
        var preview = $"Add the stock item \"{given.Both}\", counted in {baseUnit}"
            + (packSize is > 0 ? $", bought in packs of {Qty(packSize.Value, baseUnit)}{(pack is null ? "" : $" ({pack.Display})")}" : "")
            + (autoSoldOut ? ", and the dishes that need it sell out when it runs out" : "") + ".";
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var created = await api.SendAsync<CreatedResponse>(HttpMethod.Post, Inventory, "/api/inventory/items", null,
            new StockItemRequest(given, baseUnit, packSize is > 0 ? packSize : null, pack, autoSoldOut), flow.StepKey(CreateTool, requestId, "item"), ct);
        // A repeated confirm: Inventory says the request was already handled, without its id; the one by that name is it
        var id = created.IsOk ? (created.Value!.Id != 0 ? created.Value.Id : there?.Id ?? 0) : 0;
        flow.Audit(CreateTool, new { name = given.Display, unit = baseUnit, packSize, packName, autoSoldOut, requestId }, created.IsOk ? $"stock item {id}" : created.Error!);
        if (!created.IsOk) return ToolResults.Fail(created.Error!);
        return ToolResults.Ok(new { done = true, stockItemId = id == 0 ? (int?)null : id, name = given.Display, nameAr = given.Arabic, unit = baseUnit });
    }

    [McpServerTool(Name = UpdateTool, Title = "Change a stock item", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Changes a stock item: its English or Arabic name, its unit, its pack, whether dishes sell out when it runs out, or retires it (active=false) so it leaves the lists without losing its history; active=true brings it back. Nothing is deleted. " +
        "Use for 'rename Milk to Full cream milk', 'we stopped using vanilla syrup', 'beans now come in 250 g bags'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> UpdateStockItem(
        [Description("The stock item: its name in English or Arabic, or its id")] string stock,
        [Description("Its new English name")] string? name = null,
        [Description("Its new Arabic name")] string? nameAr = null,
        [Description("g, ml or pcs")] string? unit = null,
        [Description("How much one pack holds, in its unit; 0 for no pack")] decimal? packSize = null,
        [Description("What a pack is called, e.g. bag")] string? packName = null,
        [Description("true when the dishes that need it should sell out when it runs out")] bool? autoSoldOut = null,
        [Description("false to retire it, true to bring it back")] bool? active = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (name is null && nameAr is null && unit is null && packSize is null && packName is null && autoSoldOut is null && active is null)
            return ToolResults.Fail("Say what to change: a name, the unit, the pack, autoSoldOut, or active.");
        string? newUnit = null;
        if (unit is not null && (newUnit = BaseUnit(unit)) is null) return ToolResults.Fail("unit must be g, ml or pcs.");
        if (packSize is < 0) return ToolResults.Fail("The pack size cannot be negative.");

        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var shelf = await api.GetAsync<List<StockItemView>>(Inventory, "/api/inventory/items?includeInactive=true", null, ct);
        if (!shelf.IsOk) return ToolResults.Fail(shelf.Error!);
        var (item, error) = NameResolver.Pick(shelf.Value!, stock, s => s.Id, s => s.Name, "stock item");
        if (item is null) return ToolResults.Fail(error!);

        var old = item.Name ?? new LocalizedText(null, null);
        var renamed = new LocalizedText(MenuWriteTools.Clean(name) ?? old.En, MenuWriteTools.Clean(nameAr) ?? old.Ar);
        var oldUnit = item.Unit ?? "";
        newUnit ??= oldUnit;
        var newPack = packSize is null ? item.PackSize : packSize == 0 ? null : packSize;
        var newPackName = newPack is null ? null : packName is null ? item.PackName : MenuWriteTools.Clean(packName) is { } said ? MenuWriteTools.Localized(said) : null;
        var newAuto = autoSoldOut ?? item.AutoSoldOut;
        var newActive = active ?? item.IsActive;

        var changes = new List<string>();
        if (renamed != old) changes.Add($"renamed \"{renamed.Both}\"");
        if (newUnit != oldUnit) changes.Add($"counted in {newUnit} instead of {oldUnit} (quantities already recorded are not converted)");
        if (newPack != item.PackSize || newPackName != item.PackName) changes.Add(newPack is null ? "no pack" : $"packs of {Qty(newPack.Value, newUnit)}{(newPackName?.Display is { Length: > 0 } pn ? $" ({pn})" : "")}");
        if (newAuto != item.AutoSoldOut) changes.Add(newAuto ? "dishes that need it sell out when it runs out" : "dishes no longer sell out when it runs out");
        if (newActive != item.IsActive) changes.Add(newActive ? "brought back into use" : "retired: it leaves the lists, its history stays");
        if (changes.Count == 0) return ToolResults.Fail($"\"{old.Both}\" is already so; nothing would change.");

        var preview = $"Change the stock item \"{old.Both}\": {string.Join("; ", changes)}.";
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var result = await api.SendAsync<Unit>(HttpMethod.Put, Inventory, $"/api/inventory/items/{item.Id}", null,
            new StockItemRequest(renamed, newUnit, newPack, newPackName, newAuto, newActive), null, ct);
        flow.Audit(UpdateTool, new { stockItemId = item.Id, name = old.Display, changes, requestId }, result.IsOk ? "updated" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, stockItemId = item.Id, name = renamed.Display, nameAr = renamed.Arabic, changes });
    }

    [McpServerTool(Name = ReorderTool, Title = "Set a stock item's low-stock level", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Sets where a stock item's low-stock warning fires at one branch (it shows as low at or below this), or switches the warning off when no level is given. " +
        "Use for 'warn me when milk is under 5 litres', 'reorder beans at 2 kg in Maadi'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> SetReorderLevel(
        [Description("The stock item: its name in English or Arabic, or its id")] string stock,
        [Description("The level, in the item's unit or in unit; leave out to switch the warning off")] decimal? level = null,
        [Description(UnitDescription)] string? unit = null,
        [Description(BranchDescription)] string? branch = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (level is < 0) return ToolResults.Fail("A level cannot be negative.");
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var (at, shelf, error) = await ShelfAsync(snapshot.Value!, branch, ct);
        if (at is null) return ToolResults.Fail(error!);
        var (item, missing) = Pick(shelf!, stock);
        if (item is null) return ToolResults.Fail(missing!);
        decimal? newLevel = null;
        if (level is { } l)
        {
            var (factor, unitError) = Factor(unit, item.Unit);
            if (unitError is not null) return ToolResults.Fail(unitError);
            newLevel = l * factor;
        }
        if (newLevel == item.ReorderLevel) return ToolResults.Fail($"It is already so for \"{item.Name?.Both}\" at {at.BothNames}.");

        var u = item.Unit ?? "";
        var preview = (newLevel is { } n
                ? $"At {at.BothNames}, show \"{item.Name?.Both}\" as low at {Qty(n, u)} or below"
                : $"At {at.BothNames}, stop warning when \"{item.Name?.Both}\" runs low")
            + $" (now {Qty(item.OnHand, u)} on hand{(item.ReorderLevel is { } r ? $", warning at {Qty(r, u)}" : ", no warning set")}).";
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var result = await api.SendAsync<Unit>(HttpMethod.Put, Inventory, $"/api/inventory/items/{item.StockItemId}/reorder-level", at.Id, new ReorderLevelRequest(newLevel), null, ct);
        flow.Audit(ReorderTool, new { stockItemId = item.StockItemId, name = item.Name?.Display, level = newLevel, branch = at.Id, requestId }, result.IsOk ? "set" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, stockItemId = item.StockItemId, name = item.Name?.Display, nameAr = item.Name?.Arabic, branch = at.DisplayName, branchAr = at.NameAr, reorderLevel = newLevel, unit = u });
    }

    // --- The branch's ledger --------------------------------------------------

    [McpServerTool(Name = WasteTool, Title = "Record stock thrown away", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Records stock thrown away, spilled or expired at one branch, with the reason; it comes off what the branch has and shows in the waste report. " +
        "Use for 'we threw out 2 litres of milk, it went off', 'a tray of croissants burned'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> RecordWaste(
        [Description("The stock item: its name in English or Arabic, or its id")] string stock,
        [Description("How much was thrown away, in the item's unit or in unit")] decimal quantity,
        [Description("Why: expired, spilled, burned, ...")] string reason,
        [Description(UnitDescription)] string? unit = null,
        [Description(BranchDescription)] string? branch = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (quantity <= 0) return ToolResults.Fail("Say how much was thrown away.");
        return await MovementAsync(WasteTool, Waste, stock, quantity, reason, unit, null, branch, requestId, confirm, ct);
    }

    [McpServerTool(Name = AdjustTool, Title = "Correct a stock quantity", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Corrects what one branch has of a stock item by an amount, with the reason: opening stock (with what it cost), something returned to the shelf, a keying error. A positive quantity adds, a negative one takes off. For a full count use record_stock_count; for waste, record_waste. " +
        "Use for 'we started with 10 kg of sugar at 30 a kilo', 'add back 6 bottles of water that were returned'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> AdjustStock(
        [Description("The stock item: its name in English or Arabic, or its id")] string stock,
        [Description("How much to add (positive) or take off (negative), in the item's unit or in unit")] decimal quantity,
        [Description("Why: opening stock, returned, keying error, ...")] string reason,
        [Description(UnitDescription)] string? unit = null,
        [Description("What one unit cost (per unit when given), for stock added with a cost such as opening stock; optional")] decimal? unitCost = null,
        [Description(BranchDescription)] string? branch = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (quantity == 0) return ToolResults.Fail("Say how much to add or take off.");
        if (unitCost is < 0) return ToolResults.Fail("A cost cannot be negative.");
        return await MovementAsync(AdjustTool, Adjustment, stock, quantity, reason, unit, unitCost, branch, requestId, confirm, ct);
    }

    private async Task<CallToolResult> MovementAsync(string tool, int type, string stock, decimal quantity, string reason, string? unit, decimal? unitCost, string? branch, string? requestId, bool confirm, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(reason)) return ToolResults.Fail("Say why.");
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var (at, shelf, error) = await ShelfAsync(snapshot.Value!, branch, ct);
        if (at is null) return ToolResults.Fail(error!);
        var (item, missing) = Pick(shelf!, stock);
        if (item is null) return ToolResults.Fail(missing!);
        var (factor, unitError) = Factor(unit, item.Unit);
        if (unitError is not null) return ToolResults.Fail(unitError);

        var amount = quantity * factor;
        var cost = unitCost is { } c ? c / factor : (decimal?)null;
        var change = type == Waste ? -Math.Abs(amount) : amount;
        var u = item.Unit ?? "";
        var currency = snapshot.Value!.Currency;
        var preview = (type == Waste
                ? $"Record {Qty(Math.Abs(amount), u)} of \"{item.Name?.Both}\" thrown away at {at.BothNames}, because \"{reason.Trim()}\"" + (item.AvgUnitCost > 0 ? $" (about {currency} {ToolResults.Money(Math.Abs(amount) * item.AvgUnitCost)})" : "")
                : $"{(amount > 0 ? "Add" : "Take off")} {Qty(Math.Abs(amount), u)} of \"{item.Name?.Both}\" at {at.BothNames}, because \"{reason.Trim()}\"" + (cost is { } k ? $", at {currency} {ToolResults.Money(k)} per {u}" : ""))
            + $". On hand goes from {Qty(item.OnHand, u)} to {Qty(item.OnHand + change, u)}.";
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var result = await api.SendAsync<Unit>(HttpMethod.Post, Inventory, "/api/inventory/movements", at.Id,
            new AdjustmentRequest(item.StockItemId, type, type == Waste ? Math.Abs(amount) : amount, reason.Trim(), cost), flow.StepKey(tool, requestId, "movement"), ct);
        flow.Audit(tool, new { stockItemId = item.StockItemId, name = item.Name?.Display, quantity = amount, unit = u, reason, unitCost = cost, branch = at.Id, requestId }, result.IsOk ? "posted" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, stockItemId = item.StockItemId, name = item.Name?.Display, nameAr = item.Name?.Arabic, branch = at.DisplayName, branchAr = at.NameAr, preview });
    }

    [McpServerTool(Name = PurchaseTool, Title = "Receive a delivery into stock", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Receives a delivery into one branch's stock from a supplier's invoice: each line's stock item, quantity and price. It raises what the branch has, sets its average costs, and tells Finance what the supplier is owed. " +
        "Use for 'we got 10 kg of beans from Abu Auf at 600 a kilo and 20 litres of milk at 35', 'receive invoice 4471'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> RecordPurchase(
        [Description("The lines: each stock item (name or id), how much came, and its unit price or the line's total")] List<PurchaseLine> lines,
        [Description("The supplier: a supplier on the books (name or id) or just a name")] string? supplier = null,
        [Description("The invoice or delivery note number")] string? invoiceRef = null,
        [Description(BranchDescription)] string? branch = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (lines is not { Count: > 0 }) return ToolResults.Fail("Say what came: at least one line.");
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var currency = snapshot.Value!.Currency;
        var (at, shelf, error) = await ShelfAsync(snapshot.Value!, branch, ct);
        if (at is null) return ToolResults.Fail(error!);

        var posted = new List<PurchaseLineInput>();
        var described = new StringBuilder();
        foreach (var line in lines)
        {
            var (item, missing) = Pick(shelf!, line.Item);
            if (item is null) return ToolResults.Fail(missing!);
            if (line.Quantity <= 0) return ToolResults.Fail($"Say how much \"{item.Name?.Both}\" came.");
            var (factor, unitError) = Factor(line.Unit, item.Unit);
            if (unitError is not null) return ToolResults.Fail(unitError);
            var amount = line.Quantity * factor;
            var unitCost = line.Total is { } total ? total / amount : line.UnitCost is { } each ? each / factor : (decimal?)null;
            if (unitCost is not >= 0) return ToolResults.Fail($"Say what \"{item.Name?.Both}\" cost: its unit price or the line's total.");
            posted.Add(new PurchaseLineInput(item.StockItemId, amount, Math.Round(unitCost.Value, 6)));
            var u = item.Unit ?? "";
            described.AppendLine($"- {item.Name?.Both}: {(factor != 1 ? $"{line.Quantity:0.###} {line.Unit!.Trim()} = " : "")}{Qty(amount, u)}, {currency} {ToolResults.Money(amount * unitCost.Value)}" + (factor != 1 && line.UnitCost is { } said ? $" ({ToolResults.Money(said)} per {line.Unit!.Trim()})" : ""));
        }

        var warnings = new List<string>();
        string? supplierName = MenuWriteTools.Clean(supplier);
        int? supplierId = null;
        if (supplierName is not null)
        {
            var suppliers = await api.GetAsync<List<SupplierView>>("finance-api", "/api/finance/suppliers", at.Id, ct);
            if (suppliers.IsOk)
            {
                var (found, notFound) = NameResolver.Pick(suppliers.Value!.Where(s => s.IsActive).ToList(), supplierName, s => s.Id, s => new LocalizedText(s.Name, null), "supplier");
                if (found is not null) (supplierId, supplierName) = (found.Id, found.Name);
                else if (notFound!.StartsWith("Several", StringComparison.Ordinal) || int.TryParse(supplierName, out _)) return ToolResults.Fail(notFound);
                else warnings.Add($"\"{supplierName}\" is not a supplier on the books; the delivery is recorded under that name and Finance does not track what is owed to it.");
            }
            else warnings.Add($"The suppliers could not be read ({suppliers.Error}); the delivery is recorded under the name given.");
        }

        var totalCost = posted.Sum(p => p.Quantity * p.UnitCost);
        var preview = $"Receive at {at.BothNames}" + (supplierName is null ? "" : $" from {supplierName}") + (invoiceRef is null ? "" : $", invoice {invoiceRef.Trim()}")
            + $", {currency} {ToolResults.Money(totalCost)} in all:\n" + described.ToString().TrimEnd();
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, warnings, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var result = await api.SendAsync<CreatedResponse>(HttpMethod.Post, Inventory, "/api/inventory/purchases", at.Id,
            new PurchaseRequest(supplierName, MenuWriteTools.Clean(invoiceRef), posted, supplierId), flow.StepKey(PurchaseTool, requestId, "purchase"), ct);
        flow.Audit(PurchaseTool, new { branch = at.Id, supplier = supplierName, supplierId, invoiceRef, lines = posted, total = totalCost, requestId }, result.IsOk ? $"purchase {result.Value!.Id}" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(Posted(result.Value!.Id, "purchaseId", preview));
    }

    [McpServerTool(Name = CountTool, Title = "Record a stock count", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Records what was physically counted at one branch; each counted item's stock is corrected to what was found, and the difference shows in the variance report. Items not named are not touched. " +
        "Use for 'we counted 4.5 kg of beans and 12 litres of milk', 'tonight's count'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> RecordStockCount(
        [Description("What was found: each stock item (name or id) and the quantity counted")] List<StockLine> lines,
        [Description("A note, e.g. who counted or why")] string? note = null,
        [Description(BranchDescription)] string? branch = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (lines is not { Count: > 0 }) return ToolResults.Fail("Say what was counted: at least one line.");
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var (at, shelf, error) = await ShelfAsync(snapshot.Value!, branch, ct);
        if (at is null) return ToolResults.Fail(error!);

        var posted = new List<StockCountLineInput>();
        var described = new StringBuilder();
        foreach (var line in lines)
        {
            var (item, missing) = Pick(shelf!, line.Item);
            if (item is null) return ToolResults.Fail(missing!);
            if (line.Quantity < 0) return ToolResults.Fail("A count cannot be negative.");
            var (factor, unitError) = Factor(line.Unit, item.Unit);
            if (unitError is not null) return ToolResults.Fail(unitError);
            var counted = line.Quantity * factor;
            if (posted.Any(p => p.StockItemId == item.StockItemId)) return ToolResults.Fail($"\"{item.Name?.Both}\" is counted twice; give one total.");
            posted.Add(new StockCountLineInput(item.StockItemId, counted));
            var u = item.Unit ?? "";
            var variance = counted - item.OnHand;
            described.AppendLine($"- {item.Name?.Both}: counted {Qty(counted, u)}, the books say {Qty(item.OnHand, u)}" + (variance == 0 ? " (no difference)" : $" ({(variance > 0 ? "+" : "")}{Qty(variance, u)})"));
        }

        var preview = $"Record a count at {at.BothNames}" + (MenuWriteTools.Clean(note) is { } n ? $" (\"{n}\")" : "") + "; each line's stock is set to what was counted:\n" + described.ToString().TrimEnd();
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var result = await api.SendAsync<CreatedResponse>(HttpMethod.Post, Inventory, "/api/inventory/counts", at.Id,
            new StockCountRequest(MenuWriteTools.Clean(note), posted), flow.StepKey(CountTool, requestId, "count"), ct);
        flow.Audit(CountTool, new { branch = at.Id, note, lines = posted, requestId }, result.IsOk ? $"count {result.Value!.Id}" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(Posted(result.Value!.Id, "countId", preview));
    }

    [McpServerTool(Name = TransferTool, Title = "Send stock to another branch", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Sends stock from one branch to another: it comes off the sending branch and onto the receiving one at what it cost. " +
        "Use for 'send 5 kg of beans from Nasr City to Maadi', 'move 20 cups to the mall branch'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> TransferStock(
        [Description("The branch receiving it: id or name")] string to,
        [Description("What goes: each stock item (name or id) and how much")] List<StockLine> lines,
        [Description("The branch sending it: id or name; required when the business has more than one active branch")] string? from = null,
        [Description("A note, e.g. who carried it")] string? note = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (lines is not { Count: > 0 }) return ToolResults.Fail("Say what goes: at least one line.");
        if (string.IsNullOrWhiteSpace(to)) return ToolResults.Fail("Say which branch receives it.");
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var destination = BranchSelector.SelectOne(snapshot.Value!.Branches, to);
        if (!destination.IsOk) return ToolResults.Fail(destination.Error!);
        var target = destination.Value!;
        if (!target.IsActive) return ToolResults.Fail($"{target.BothNames} is not an active branch.");
        // With two branches, naming the receiving one is enough: the other sends
        if (string.IsNullOrWhiteSpace(from) && snapshot.Value.Branches.Count(b => b.IsActive && b.Id != target.Id) == 1)
            from = snapshot.Value.Branches.First(b => b.IsActive && b.Id != target.Id).Id.ToString(CultureInfo.InvariantCulture);
        var (at, shelf, error) = await ShelfAsync(snapshot.Value!, from, ct);
        if (at is null) return ToolResults.Fail(error!);
        if (at.Id == target.Id) return ToolResults.Fail("The sending and receiving branches are the same.");

        var posted = new List<TransferLineInput>();
        var described = new StringBuilder();
        var warnings = new List<string>();
        foreach (var line in lines)
        {
            var (item, missing) = Pick(shelf!, line.Item);
            if (item is null) return ToolResults.Fail(missing!);
            if (line.Quantity <= 0) return ToolResults.Fail($"Say how much \"{item.Name?.Both}\" goes.");
            var (factor, unitError) = Factor(line.Unit, item.Unit);
            if (unitError is not null) return ToolResults.Fail(unitError);
            var amount = line.Quantity * factor;
            posted.Add(new TransferLineInput(item.StockItemId, amount));
            var u = item.Unit ?? "";
            described.AppendLine($"- {item.Name?.Both}: {Qty(amount, u)}");
            if (amount > item.OnHand) warnings.Add($"{at.BothNames} has only {Qty(item.OnHand, u)} of \"{item.Name?.Both}\" on the books.");
        }

        var preview = $"Send from {at.BothNames} to {target.BothNames}" + (MenuWriteTools.Clean(note) is { } n ? $" (\"{n}\")" : "") + ":\n" + described.ToString().TrimEnd();
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, warnings, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var result = await api.SendAsync<CreatedResponse>(HttpMethod.Post, Inventory, $"/api/inventory/transfers/to/{target.Id}", at.Id,
            new TransferRequest(MenuWriteTools.Clean(note), posted), flow.StepKey(TransferTool, requestId, "transfer"), ct);
        flow.Audit(TransferTool, new { from = at.Id, to = target.Id, note, lines = posted, requestId }, result.IsOk ? $"transfer {result.Value!.Id}" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(Posted(result.Value!.Id, "transferId", preview));
    }

    // --- Pieces ---------------------------------------------------------------

    /// <summary>The branch's shelf: every active stock item with what it has, the names the owner's words are matched against</summary>
    private async Task<(BranchResponse? Branch, List<StockLevelView>? Shelf, string? Error)> ShelfAsync(TenantSnapshot snap, string? branch, CancellationToken ct)
    {
        var one = BranchSelector.SelectOne(snap.Branches, branch);
        if (!one.IsOk) return (null, null, one.Error);
        var levels = await api.GetAsync<List<StockLevelView>>(Inventory, "/api/inventory/levels", one.Value!.Id, ct);
        return levels.IsOk ? (one.Value, levels.Value, null) : (null, null, levels.Error);
    }

    private static (StockLevelView? Item, string? Error) Pick(List<StockLevelView> shelf, string text)
    {
        var (item, error) = NameResolver.Pick(shelf, text, s => s.StockItemId, s => s.Name, "stock item");
        return item is not null || error!.StartsWith("Several", StringComparison.Ordinal)
            ? (item, error)
            : (null, error + " create_stock_item adds a new one.");
    }

    /// <summary>An answer to a ledger post: Inventory answers id 0 when the request id was already handled</summary>
    private static object Posted(int id, string idName, string preview)
        => id == 0
            ? new Dictionary<string, object?> { ["done"] = true, [idName] = null, ["preview"] = preview, ["note"] = "This request had already been recorded; nothing was written twice." }
            : new Dictionary<string, object?> { ["done"] = true, [idName] = id, ["preview"] = preview };

    internal static string Qty(decimal quantity, string unit) => $"{quantity.ToString("0.###", CultureInfo.InvariantCulture)} {unit}".TrimEnd();

    /// <summary>g, ml or pcs: the units a stock item is counted in</summary>
    internal static string? BaseUnit(string? unit) => Scale(unit) is { Scale: 1 } s ? s.Unit : null;

    /// <summary>How many of the item's unit one of the given unit is: 1000 for kg of an item in g. Units of another kind are refused.</summary>
    internal static (decimal Factor, string? Error) Factor(string? given, string? itemUnit)
    {
        if (string.IsNullOrWhiteSpace(given)) return (1, null);
        var g = Scale(given);
        var i = Scale(itemUnit);
        if (g is null) return (0, $"'{given.Trim()}' is not a unit; use kg, g, l, ml or pcs.");
        if (i is null || g.Value.Kind != i.Value.Kind)
            return (0, $"That item is counted in {itemUnit}; give the quantity in {itemUnit}{(i?.Kind switch { "mass" => " or kg", "volume" => " or litres", _ => "" })}.");
        return (g.Value.Scale / i.Value.Scale, null);
    }

    private static (string Unit, string Kind, decimal Scale)? Scale(string? unit) => unit?.Trim().ToLowerInvariant() switch
    {
        "g" or "gm" or "gr" or "gram" or "grams" or "جم" or "جرام" => ("g", "mass", 1),
        "kg" or "kgs" or "kilo" or "kilos" or "kilogram" or "kilograms" or "كيلو" => ("kg", "mass", 1000),
        "ml" or "mls" or "milliliter" or "milliliters" or "millilitre" or "millilitres" or "مل" => ("ml", "volume", 1),
        "l" or "lt" or "ltr" or "liter" or "liters" or "litre" or "litres" or "لتر" => ("l", "volume", 1000),
        "pcs" or "pc" or "piece" or "pieces" or "unit" or "units" or "each" or "قطعة" => ("pcs", "count", 1),
        _ => null,
    };
}
