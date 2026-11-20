using System.ComponentModel;
using System.Text;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;

namespace Ninja.Assistant.API.Tools;

/// <summary>
/// The till from chat: find a customer the way the cashier's search does,
/// ring items up as a till order (to a new bill, a table or room, an open
/// bill, or the bill the customer already has open), and put a customer on a
/// running room. An order goes the till's own way: Catalog checks every
/// price and the kitchen gets it as it gets the cashier's. Taking payment and
/// closing a bill stay at the till.
/// </summary>
[McpServerToolType]
public sealed class TillTools(TenantContext tenant, NinjaApiClient api, WriteFlow flow)
{
    private const string Catalog = "catalog-api";
    private const string Sales = "sales-api";
    private const string Spaces = "spaces-api";
    private const string Ordering = "ordering-api";

    internal const string FindCustomerTool = "find_customer";
    internal const string RingUpTool = "ring_up_order";
    internal const string RoomCustomerTool = "assign_room_customer";

    private static readonly string[] CounterWords = ["counter", "takeaway", "take away", "new", "new bill", "walk in", "walk-in", "كاونتر", "تيك اواي"];

    public sealed record OrderLineInput(
        [property: Description("The menu item: its name in English or Arabic, or its id")] string Item,
        [property: Description("How many; default 1")] int Quantity = 1,
        [property: Description("The chosen options by name, e.g. [\"Large\", \"Oat milk\"]; a must-pick choice left out takes its default")] List<string>? Options = null,
        [property: Description("A note for the kitchen on this line, e.g. 'no ice'")] string? Note = null);

    /// <summary>What the preview resolved, signed, so the confirm rings up exactly what the owner saw.</summary>
    public sealed record TillDraft(int BranchId, List<BasketLine> Lines, string? CustomerId, string? CustomerName, int? TicketId, int? PlaceId, string? Note, decimal Total);

    /// <summary>Who is where, at the branches looked at.</summary>
    private sealed record Floor(CustomerWhereabouts Here, Dictionary<int, BranchResponse> BillBranch, Dictionary<int, BranchResponse> StayBranch, List<string> Errors);

    // --- Find a customer ---------------------------------------------------------

    [McpServerTool(Name = FindCustomerTool, Title = "Find a customer", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("Finds a customer account by name (either language, a typo forgiven), phone or part of it, and tells about them: phone, email, since when, what they owe on their tab (or their credit) with its last moves, loyalty points and tier, the bills they have open now and where they are, how many orders and the latest ones. Picks the one meant when it can (an exact full name, or the only match who is here now); otherwise lists them to choose from. " +
        "Use for 'how much does Ahmed owe', 'Mona's points', 'is Karim here', 'when did 0100 123 last come', and before anything done for a customer. ring_up_order and assign_room_customer find the customer themselves.")]
    public async Task<CallToolResult> FindCustomer(
        [Description(CustomerFinder.SpellingDescription)] string customer,
        [Description("Branch id or name to look for them on the floor; leave out for every branch")] string? branch = null,
        CancellationToken ct = default)
    {
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var branches = BranchSelector.Select(snap.Branches, branch);
        if (!branches.IsOk) return ToolResults.Fail(branches.Error!);

        var floor = await FloorAsync(branches.Value!, ct);
        var found = await CustomerFinder.FindAsync(api, branches.Value![0].Id, customer, floor.Here, ct);
        if (found.Match is null && found.Candidates.Count == 0) return ToolResults.Fail(found.Why!);

        var details = found.Match is { } one ? await DetailsAsync(snap, branches.Value!, one, floor.Here, ct) : null;
        return ToolResults.Ok(new
        {
            match = found.Match is { } m ? CustomerFinder.Row(m, floor.Here, snap) : null,
            details,
            candidates = found.Match is null ? found.Candidates.Take(8).Select(u => CustomerFinder.Row(u, floor.Here, snap)) : null,
            others = found.Match is not null && found.Candidates.Count > 1 ? found.Candidates.Count - 1 : (int?)null,
            note = found.Why ?? (found.Candidates.Count > 1 ? "Picked as the exact name or the only one here now; say so if it is someone else." : null),
            errors = floor.Errors.Count > 0 ? floor.Errors : null,
        });
    }

    /// <summary>What the owner asks about a customer: what they owe, their points, their bills now, their orders.</summary>
    private async Task<object> DetailsAsync(TenantSnapshot snap, IReadOnlyList<BranchResponse> branches, DirectoryUserView user, CustomerWhereabouts here, CancellationToken ct)
    {
        var id = Uri.EscapeDataString(user.Id);
        var tab = await api.GetAsync<CustomerTabView>("accounts-api", $"/api/accounts/{id}", null, ct);
        var points = await api.GetAsync<LoyaltyAccountView>("loyalty-api", $"/api/loyalty/accounts/{id}", null, ct);
        var orders = await FanOut.PerBranchAsync(branches, b => api.GetAsync<PagedResult<OrderSummaryView>>(Ordering, $"/api/orders/all?pageIndex=0&pageSize=5&buyerId={id}", b.Id, ct));
        var recent = orders.Ok.SelectMany(x => (x.Value.Items ?? []).Select(o => (x.Branch, o))).OrderByDescending(x => x.o.Date).Take(5).ToList();
        var openBills = here.BillsOf(user);

        // 404 is "no tab yet" and "no loyalty account yet": nothing owed, no points
        var balance = tab.IsOk ? tab.Value!.Balance : 0;
        return new
        {
            currency = snap.Currency,
            tabBalance = balance,
            tab = balance > 0 ? $"owes {snap.Currency} {ToolResults.Money(balance)}" : balance < 0 ? $"has {snap.Currency} {ToolResults.Money(-balance)} in credit" : "owes nothing",
            tabMoves = tab.IsOk ? (tab.Value!.Transactions ?? []).OrderByDescending(t => t.CreatedAt).Take(5).Select(t => new
            {
                at = ReadSupport.Local(snap, t.CreatedAt),
                t.Type,
                t.Amount,
                t.Description,
                receipt = t.SourceNumber,
            }) : null,
            points = points.IsOk ? points.Value!.PointsBalance : (int?)null,
            lifetimePoints = points.IsOk ? points.Value!.LifetimePoints : (int?)null,
            tier = points.IsOk ? points.Value!.CurrentTier : null,
            openBills = openBills.Select(b => new { b.Id, where = b.Where, b.Total, lines = b.LineCount }),
            openBillsTotal = openBills.Sum(b => b.Total),
            orders = orders.Ok.Sum(x => x.Value.TotalCount),
            lastOrder = recent.Count > 0 ? ReadSupport.Local(snap, recent[0].o.Date) : null,
            recentOrders = recent.Select(x => new { number = x.o.OrderNumber, at = ReadSupport.Local(snap, x.o.Date), branch = x.Branch.DisplayName, x.o.Status, x.o.Total, where = x.o.PlaceName?.Display }),
            errors = ReadSupport.Errors(orders.Errors) is { } e ? e : null,
        };
    }

    // --- Ring up an order ------------------------------------------------------------

    [McpServerTool(Name = RingUpTool, Title = "Ring up an order", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Rings items up as a till order: Catalog prices them at the branch and the kitchen gets them as it gets the cashier's. They go to the bill the owner names (bill), to a table or room (where; its open bill, or a new one), or to a new counter bill. " +
        "With a customer and no bill or place, the customer's own open bill is found first (the bill they are on, the room they are in) and the items go there; newBill=true keeps them apart. On a shared bill the lines are the customer's, for splitting. A name no account has goes on the lines as a bare name. " +
        "Use for 'ring up 2 lattes for Ahmed', 'add a club sandwich to table 4', 'add a large Pepsi to Mona's bill', 'a croissant to room 2 for Karim'. It does not take payment or close the bill. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> RingUpOrder(
        [Description("The lines: each item, how many, its options and a note")] List<OrderLineInput> items,
        [Description("Who it is for, optional. " + CustomerFinder.SpellingDescription)] string? customer = null,
        [Description("A table or room by name, or \"counter\" for a new counter bill; optional")] string? where = null,
        [Description("An open bill to add to: its id (get_open_tickets), its name, or its table or room; optional")] string? bill = null,
        [Description("true to start a new bill even when the customer already has one open")] bool newBill = false,
        [Description("A note on the whole order for the kitchen")] string? note = null,
        [Description("Branch id or name; found from the bill, place or customer when the business has several")] string? branch = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        [Description(WriteFlow.DraftDescription)] string? draft = null,
        CancellationToken ct = default)
    {
        requestId ??= WriteFlow.NewRequestId();
        if (confirm)
        {
            var (plan, error) = flow.Open<TillDraft>(draft, RingUpTool, requestId);
            if (plan is null) return ToolResults.Fail(error!);
            if (flow.Limit() is { } limited) return ToolResults.Fail(limited);
            return await SendAsync(plan, requestId, ct);
        }

        if (items is not { Count: > 0 }) return ToolResults.Fail("Say what to ring up.");
        if (items.Any(i => i.Quantity is < 1 or > 99)) return ToolResults.Fail("Each line's quantity must be between 1 and 99.");

        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var scope = BranchSelector.Select(snap.Branches, branch);
        if (!scope.IsOk) return ToolResults.Fail(scope.Error!);
        var floor = await FloorAsync(scope.Value!, ct);

        // Who: an account, several to choose from, or a bare name
        DirectoryUserView? account = null;
        string? bareName = null;
        string? customerNote = null;
        if (!string.IsNullOrWhiteSpace(customer))
        {
            var found = await CustomerFinder.FindAsync(api, scope.Value![0].Id, customer, floor.Here, ct);
            if (found.Ambiguous)
                return ToolResults.Ok(new { needsChoice = true, question = found.Why, candidates = found.Candidates.Take(8).Select(u => CustomerFinder.Row(u, floor.Here, snap)), nextStep = "Ask which one, then call again with their id as customer." });
            account = found.Match;
            if (account is null)
            {
                if (found.Why is { } why && !why.StartsWith("No customer", StringComparison.Ordinal)) return ToolResults.Fail(why);
                bareName = CustomerFinder.Spellings(customer)[0];
                customerNote = $"No account matches \"{customer}\": the lines will just say \"{bareName}\" (no points).";
            }
            else if (found.Candidates.Count > 1)
            {
                customerNote = $"{found.Candidates.Count - 1} other customer{(found.Candidates.Count == 2 ? "" : "s")} matched; this is the {(CustomerFinder.Spellings(customer).Any(s => CustomerFinder.Normalize(s) == CustomerFinder.Normalize(account.Name)) ? "exact name" : "one here now")}.";
            }
        }

        // Where: the bill named, the place named, the customer's own open bill, or a new counter bill
        var (target, targetError) = await TargetAsync(snap, scope.Value!, floor, bill, where, account, bareName, newBill, ct);
        if (targetError is not null) return ToolResults.Fail(targetError);
        var at = target!.Branch;

        // What: the items, their options, priced at the branch
        var menu = await api.GetAsync<List<CatalogItemDetail>>(Catalog, "/api/catalog/items", at.Id, ct);
        if (!menu.IsOk) return ToolResults.Fail(menu.Error!);
        var resolved = new List<(CatalogItemDetail Item, OrderLineInput Input, List<(CustomizationDto Group, CustomizationOptionDto Option)> Chosen)>();
        foreach (var line in items)
        {
            var (menuItem, missing) = NameResolver.Pick(menu.Value!, line.Item, i => i.Id, i => i.Name, "menu item");
            if (menuItem is null) return ToolResults.Fail(missing!);
            var groups = await api.GetAsync<List<CustomizationDto>>(Catalog, $"/api/catalog/items/{menuItem.Id}/customizations", null, ct);
            if (!groups.IsOk) return ToolResults.Fail(groups.Error!);
            var (chosen, optionError) = ChooseOptions(menuItem, groups.Value!, line.Options);
            if (optionError is not null) return ToolResults.Fail(optionError);
            resolved.Add((menuItem, line, chosen!));
        }

        var priced = await api.SendAsync<PriceCheckResponse>(HttpMethod.Post, Catalog, "/api/catalog/price-check", at.Id,
            new PriceCheckRequest(at.Id, [.. resolved.Select(r => new PriceCheckLine(r.Item.Id, r.Chosen.Select(c => c.Option.Id).ToList(), 0))]), null, ct);
        if (!priced.IsOk) return ToolResults.Fail(priced.Error!);
        var prices = priced.Value!.Lines ?? [];
        if (prices.Count != resolved.Count) return ToolResults.Fail("The menu did not price every line; try again.");

        var lines = new List<BasketLine>();
        var sb = new StringBuilder($"Ring up at {at.BothNames}, {target.Description}:\n");
        decimal total = 0;
        for (var i = 0; i < resolved.Count; i++)
        {
            var (menuItem, input, chosen) = resolved[i];
            var price = prices[i];
            var name = menuItem.Name ?? new LocalizedText(null, null);
            if (!price.Available) return ToolResults.Fail($"\"{name.Both}\" is not on the menu at {at.DisplayName} right now.");
            if (price.OutOfStock) return ToolResults.Fail($"{at.DisplayName} is out of \"{name.Both}\".");
            if (price.SoldOutOptionIds is { Count: > 0 } soldOut)
                return ToolResults.Fail($"{at.DisplayName} is out of {string.Join(", ", chosen.Where(c => soldOut.Contains(c.Option.Id)).Select(c => c.Option.Name?.Both))} for \"{name.Both}\".");

            var adjustments = chosen.Sum(c => c.Option.PriceAdjustment);
            lines.Add(new BasketLine(Guid.NewGuid().ToString("N"), menuItem.Id, name, price.Price - adjustments, input.Quantity, MenuWriteTools.Clean(input.Note),
                [.. chosen.Select(c => new BasketCustomization(c.Group.Id, c.Group.Name ?? new LocalizedText(null, null), c.Option.Id, c.Option.Name ?? new LocalizedText(null, null), c.Option.PriceAdjustment))]));
            total += price.Price * input.Quantity;
            var options = chosen.Count == 0 ? "" : $" ({string.Join(", ", chosen.Select(c => c.Option.Name?.Display))})";
            var lineNote = MenuWriteTools.Clean(input.Note) is { } n ? $" — \"{n}\"" : "";
            sb.AppendLine($"{input.Quantity} × {name.Both}{options}{lineNote}: {snap.Currency} {ToolResults.Money(price.Price * input.Quantity)}");
        }

        var who = account is not null ? $"{account.Name}{(account.PhoneNumber is { } p ? $" ({p})" : "")}" : bareName;
        sb.Append($"Total {snap.Currency} {ToolResults.Money(total)}");
        sb.Append(who is null ? "." : $", for {who}.");
        sb.Append(" It goes to the kitchen like a till order.");
        var orderNote = MenuWriteTools.Clean(note);
        if (orderNote is not null) sb.Append($" Note: \"{orderNote}\".");

        var plan2 = new TillDraft(at.Id, lines, account?.Id, account?.Name ?? bareName, target.TicketId, target.PlaceId, orderNote, total);
        return ToolResults.Ok(new
        {
            preview = sb.ToString(),
            customerNote,
            billNote = target.Note,
            requestId,
            draft = flow.Sign(plan2, RingUpTool, requestId),
            nextStep = WriteFlow.NextStepWithDraft,
        });
    }

    private async Task<CallToolResult> SendAsync(TillDraft plan, string requestId, CancellationToken ct)
    {
        var account = plan.CustomerId is not null;
        var body = new PosOrderRequest(
            plan.Lines,
            CustomerNote: plan.Note,
            CustomerUserId: account ? plan.CustomerId : null,
            CustomerUserName: account ? plan.CustomerName : null,
            TicketId: plan.TicketId,
            CustomerName: account ? null : plan.CustomerName,
            PlaceId: plan.TicketId is null ? plan.PlaceId : null);

        // One key per confirm: a retry is answered with the order it made the first time
        var made = await api.SendAsync<PosOrderResponse>(HttpMethod.Post, Ordering, "/api/orders/pos", plan.BranchId, body, flow.StepKey(RingUpTool, requestId, "order"), ct);
        flow.Audit(RingUpTool, new { plan.BranchId, plan.TicketId, plan.PlaceId, plan.CustomerId, plan.CustomerName, lines = plan.Lines.Count, plan.Total, requestId },
            made.IsOk ? $"order {made.Value?.OrderId}" : made.Error!);
        if (!made.IsOk) return ToolResults.Fail($"Nothing was rung up: {made.Error}");

        return ToolResults.Ok(new
        {
            done = true,
            orderId = made.Value?.OrderId is > 0 ? made.Value.OrderId : (int?)null,
            total = plan.Total,
            note = "Sent like a till order: it lands on the bill and in the kitchen once the menu's check passes, in a few seconds. A refused line (sold out since) shows on the till.",
        });
    }

    // --- A customer on a room ------------------------------------------------------

    [McpServerTool(Name = RoomCustomerTool, Title = "Put a customer on a room", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Puts a customer on a running room or station session: as its owner when nobody has claimed it (a walk-in), otherwise into its party, so their share of the time can go on their tab and the session shows on their phone. " +
        "Use for 'room 2 is Ahmed's', 'Karim is in room 3 too', 'put Mona on the pool table'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> AssignRoomCustomer(
        [Description("The room or station with a session running: its name in either language")] string room,
        [Description(CustomerFinder.SpellingDescription)] string customer,
        [Description("Branch id or name; found from the room when the business has several")] string? branch = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var scope = BranchSelector.Select(snap.Branches, branch);
        if (!scope.IsOk) return ToolResults.Fail(scope.Error!);
        var floor = await FloorAsync(scope.Value!, ct);

        var running = floor.Here.Stays.Where(s => s.Status == StayStatus.Running).ToList();
        if (running.Count == 0) return ToolResults.Fail("No room or station has a session running" + (scope.Value!.Count == 1 ? $" at {scope.Value[0].DisplayName}." : "."));
        var (stay, missing) = NameResolver.Pick(running, room, s => s.PlaceId, s => s.PlaceName, "running room");
        if (stay is null) return ToolResults.Fail(missing + $" Running now: {string.Join(", ", running.Select(s => s.PlaceName?.Both))}.");
        var at = floor.StayBranch[stay.Id];

        var found = await CustomerFinder.FindAsync(api, at.Id, customer, floor.Here, ct);
        if (found.Ambiguous)
            return ToolResults.Ok(new { needsChoice = true, question = found.Why, candidates = found.Candidates.Take(8).Select(u => CustomerFinder.Row(u, floor.Here, snap)), nextStep = "Ask which one, then call again with their id as customer." });
        if (found.Match is not { } user) return ToolResults.Fail(found.Why! + " A room takes a customer with an account; add them first from the till.");

        var placeName = stay.PlaceName?.Both ?? "the room";
        if (stay.Has(user.Id)) return ToolResults.Fail($"{user.Name} is already in {placeName}.");
        var asOwner = stay.CustomerId is null;
        var preview = asOwner
            ? $"Make {user.Name}{(user.PhoneNumber is { } p ? $" ({p})" : "")} the customer of {placeName} at {at.DisplayName}: the session shows on their phone and its time is theirs."
            : $"Add {user.Name}{(user.PhoneNumber is { } p2 ? $" ({p2})" : "")} to the party in {placeName} at {at.DisplayName} (it is {stay.CustomerName}'s), so their share can go on their tab.";
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var path = asOwner ? $"/api/stays/{stay.Id}/assign-customer" : $"/api/stays/{stay.Id}/members";
        var done = await api.SendAsync<Unit>(HttpMethod.Post, Spaces, path, at.Id, new StayCustomerRequest(user.Id, user.Name), null, ct);
        flow.Audit(RoomCustomerTool, new { stayId = stay.Id, customerId = user.Id, asOwner, requestId }, done.IsOk ? "done" : done.Error!);
        if (!done.IsOk) return ToolResults.Fail($"{user.Name} was not put on {placeName}: {done.Error}");
        return ToolResults.Ok(new { done = true, room = placeName, customer = user.Name, role = asOwner ? "owner" : "member" });
    }

    // --- Helpers ---------------------------------------------------------------------

    /// <summary>The open bills and running rooms at the branches, each kept with its branch.</summary>
    private async Task<Floor> FloorAsync(IReadOnlyList<BranchResponse> branches, CancellationToken ct)
    {
        var bills = await FanOut.PerBranchAsync(branches, b => api.GetAsync<List<OpenBillView>>(Sales, "/api/tickets/open", b.Id, ct));
        var stays = await FanOut.PerBranchAsync(branches, b => api.GetAsync<List<RunningStayView>>(Spaces, "/api/stays/open", b.Id, ct));
        var billBranch = new Dictionary<int, BranchResponse>();
        var stayBranch = new Dictionary<int, BranchResponse>();
        foreach (var (b, list) in bills.Ok) foreach (var t in list) billBranch[t.Id] = b;
        foreach (var (b, list) in stays.Ok) foreach (var s in list) stayBranch[s.Id] = b;
        return new(
            new CustomerWhereabouts([.. bills.Ok.SelectMany(x => x.Value)], [.. stays.Ok.SelectMany(x => x.Value)]),
            billBranch, stayBranch, [.. bills.Errors.Concat(stays.Errors).Distinct()]);
    }

    private sealed record Target(BranchResponse Branch, int? TicketId, int? PlaceId, string Description, string? Note = null);

    private async Task<(Target? Target, string? Error)> TargetAsync(
        TenantSnapshot snap, IReadOnlyList<BranchResponse> scope, Floor floor, string? bill, string? where, DirectoryUserView? account, string? bareName, bool newBill, CancellationToken ct)
    {
        var bills = floor.Here.Bills;

        // A bill named outright
        if (!string.IsNullOrWhiteSpace(bill))
        {
            var text = bill.Trim().TrimStart('#');
            OpenBillView? picked = null;
            if (int.TryParse(text, out var id)) picked = bills.FirstOrDefault(b => b.Id == id);
            if (picked is null)
            {
                var wanted = CustomerFinder.Normalize(text);
                var named = bills.Where(b => CustomerFinder.Normalize(b.Label) == wanted
                    || CustomerFinder.Normalize(b.LocationName?.En) == wanted || CustomerFinder.Normalize(b.LocationName?.Ar) == wanted).ToList();
                if (named.Count == 0)
                    named = [.. bills.Where(b => CustomerFinder.Normalize($"{b.Label} {b.LocationName?.En} {b.LocationName?.Ar}").Contains(wanted, StringComparison.Ordinal))];
                if (named.Count > 1) return (null, $"Several open bills match \"{bill}\": {string.Join(", ", named.Take(8).Select(b => $"{b.Where} (bill {b.Id})"))}. Say which.");
                picked = named.FirstOrDefault();
            }
            if (picked is null) return (null, $"No open bill matches \"{bill}\"; get_open_tickets lists them.");
            return (new Target(floor.BillBranch[picked.Id], picked.Id, null, $"on the open bill at {picked.Where}"), null);
        }

        // A place named, or the counter
        if (!string.IsNullOrWhiteSpace(where))
        {
            if (CounterWords.Contains(where.Trim().ToLowerInvariant()))
            {
                var one = BranchSelector.SelectOne(snap.Branches.Where(b => scope.Contains(b)).ToList(), null);
                return one.IsOk ? (new Target(one.Value!, null, null, "on a new counter bill"), null) : (null, one.Error);
            }

            var places = await FanOut.PerBranchAsync(scope, b => api.GetAsync<List<PlaceDto>>(Spaces, "/api/places", b.Id, ct));
            if (!places.AnyOk) return (null, string.Join("\n", places.Errors));
            var all = places.Ok.SelectMany(x => x.Value.Where(p => p.IsActive).Select(p => (x.Branch, Place: p))).ToList();
            var (hit, missing) = NameResolver.Pick(all.Select(x => x.Place).ToList(), where, p => p.Id, p => p.Name, "table or room");
            if (hit is null) return (null, missing + " Say \"counter\" for a new counter bill.");
            var branchOf = all.First(x => x.Place.Id == hit.Id).Branch;
            var open = bills.Where(b => b.PlaceId == hit.Id).ToList();
            var placeName = hit.Name?.Both ?? $"place {hit.Id}";
            return open.Count switch
            {
                0 => (new Target(branchOf, null, hit.Id, $"on a new bill for {placeName}"), null),
                1 => (new Target(branchOf, open[0].Id, null, $"on the open bill at {placeName}"), null),
                _ => (null, $"{placeName} has {open.Count} open bills: {string.Join(", ", open.Select(b => $"bill {b.Id} ({ToolResults.Money(b.Total)}, {b.LineCount} lines)"))}. Say which with bill."),
            };
        }

        // The customer's own open bill: the one they are on, or the room they are in
        if (!newBill && (account is not null || bareName is not null))
        {
            var theirs = account is not null
                ? floor.Here.BillsOf(account).ToList()
                : [.. bills.Where(b => CustomerFinder.Normalize(b.Label) == CustomerFinder.Normalize(bareName))];
            var name = account?.Name ?? bareName;
            if (theirs.Count == 1)
                return (new Target(floor.BillBranch[theirs[0].Id], theirs[0].Id, null, $"on the bill {name} already has open at {theirs[0].Where}",
                    "Found their open bill; say newBill=true to start a separate one."), null);
            if (theirs.Count > 1)
                return (null, $"{name} has {theirs.Count} open bills: {string.Join(", ", theirs.Select(b => $"{b.Where} (bill {b.Id}, {ToolResults.Money(b.Total)})"))}. Say which with bill, or newBill=true.");

            if (account is not null && floor.Here.StaysOf(account).Where(s => s.Status == StayStatus.Running).ToList() is [var stay])
                return (new Target(floor.StayBranch[stay.Id], stay.TicketId, stay.TicketId is null ? stay.PlaceId : null, $"on the bill of {stay.PlaceName?.Both ?? "their room"}, where {name} is",
                    "They are in this room; say newBill=true to start a separate bill."), null);
        }

        // Nothing named: a new counter bill
        var single = BranchSelector.SelectOne(snap.Branches.Where(b => scope.Contains(b)).ToList(), null);
        return single.IsOk ? (new Target(single.Value!, null, null, "on a new counter bill"), null) : (null, single.Error);
    }

    /// <summary>
    /// The options the owner named, each found among the item's choices by
    /// name (exact in either language, then a name inside the other: "oat
    /// milk" finds Oat). A must-pick choice left out takes its default.
    /// </summary>
    internal static (List<(CustomizationDto Group, CustomizationOptionDto Option)>? Chosen, string? Error) ChooseOptions(CatalogItemDetail item, IReadOnlyList<CustomizationDto> groups, List<string>? said)
    {
        var itemName = item.Name?.Both ?? $"item {item.Id}";
        var all = groups.SelectMany(g => (g.Options ?? []).Select(o => (Group: g, Option: o))).ToList();
        var chosen = new List<(CustomizationDto Group, CustomizationOptionDto Option)>();

        foreach (var raw in said ?? [])
        {
            var text = raw?.Trim();
            if (string.IsNullOrEmpty(text)) continue;
            // "Size: Large" names the group too
            var groupText = (string?)null;
            if (text.IndexOf(':') is var colon and > 0)
            {
                groupText = CustomerFinder.Normalize(text[..colon]);
                text = text[(colon + 1)..].Trim();
            }
            var wanted = CustomerFinder.Normalize(text);
            var pool = groupText is null ? all : all.Where(x => CustomerFinder.Normalize(x.Group.Name?.En) == groupText || CustomerFinder.Normalize(x.Group.Name?.Ar) == groupText).ToList();

            bool Exact((CustomizationDto Group, CustomizationOptionDto Option) x) =>
                CustomerFinder.Normalize(x.Option.Name?.En) == wanted || CustomerFinder.Normalize(x.Option.Name?.Ar) == wanted;
            bool Loose((CustomizationDto Group, CustomizationOptionDto Option) x) =>
                new[] { x.Option.Name?.En, x.Option.Name?.Ar }.Select(CustomerFinder.Normalize).Any(n => n.Length > 0 && (n.Contains(wanted, StringComparison.Ordinal) || wanted.Contains(n, StringComparison.Ordinal)));

            var hits = pool.Where(Exact).ToList();
            if (hits.Count == 0) hits = [.. pool.Where(Loose)];
            if (hits.Count == 0)
                return (null, $"\"{itemName}\" has no option \"{raw}\". Its choices: {Describe(groups)}.");
            if (hits.Count > 1)
                return (null, $"\"{raw}\" fits several options of \"{itemName}\": {string.Join(", ", hits.Select(h => $"{h.Group.Name?.Display}: {h.Option.Name?.Display}"))}. Say which, e.g. \"{hits[0].Group.Name?.Display}: {hits[0].Option.Name?.Display}\".");
            if (chosen.All(c => c.Option.Id != hits[0].Option.Id)) chosen.Add(hits[0]);
        }

        foreach (var g in groups)
        {
            var inGroup = chosen.Where(c => c.Group.Id == g.Id).ToList();
            if (!g.AllowMultiple && inGroup.Count > 1)
                return (null, $"\"{itemName}\" takes one {g.Name?.Display}: {string.Join(" or ", inGroup.Select(c => c.Option.Name?.Display))}?");
            if (g.IsRequired && inGroup.Count == 0)
            {
                if ((g.Options ?? []).FirstOrDefault(o => o.IsDefault) is { } fallback) chosen.Add((g, fallback));
                else return (null, $"\"{itemName}\" needs a {g.Name?.Display}: {string.Join(", ", (g.Options ?? []).Select(o => o.Name?.Display))}.");
            }
        }

        // In the item's own order, as the till lists them
        return ([.. chosen.OrderBy(c => c.Group.DisplayOrder).ThenBy(c => c.Option.DisplayOrder)], null);
    }

    private static string Describe(IReadOnlyList<CustomizationDto> groups) => groups.Count == 0
        ? "none"
        : string.Join("; ", groups.Select(g => $"{g.Name?.Display}: {string.Join(", ", (g.Options ?? []).Select(o => o.Name?.Display))}"));
}
