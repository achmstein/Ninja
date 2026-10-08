using System.ComponentModel;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;
using static Ninja.Assistant.API.Tools.ToolSupport;

namespace Ninja.Assistant.API.Tools;

/// <summary>
/// The books' set-up from chat: expense categories, suppliers, a payment made
/// to a supplier and the monthly bills that post themselves. Each previews
/// first and writes only on the confirm. A payment is bookkeeping of money
/// already paid, like record_expense; nothing here moves money.
/// </summary>
[McpServerToolType]
public sealed class FinanceWriteTools(TenantContext tenant, NinjaApiClient api, WriteFlow flow, TimeProvider clock)
{
    internal const string CategoryTool = "create_expense_category";
    internal const string SupplierTool = "save_supplier";
    internal const string SupplierPaymentTool = "record_supplier_payment";
    internal const string RecurringTool = "set_recurring_expense";

    [McpServerTool(Name = CategoryTool, Title = "Add an expense category", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Adds an expense category (Rent, Electricity, Packaging, ...) that expenses and monthly bills are filed under, named in English, Arabic or both. " +
        "Use for 'add a Packaging expense category', 'I need a category for marketing'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> CreateExpenseCategory(
        [Description("The category's name, in English or Arabic")] string name,
        [Description("Its name in the other language, optional")] string? otherName = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(name)) return ToolResults.Fail("The category needs a name.");
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);

        var label = BusinessWrite.Names(name, otherName);
        var categories = await api.GetAsync<List<ExpenseCategoryView>>("finance-api", "/api/finance/categories?includeInactive=true", null, ct);
        if (!categories.IsOk) return ToolResults.Fail(categories.Error!);
        // Finance takes a second category of the same name; a retried confirm must not make one
        if (BusinessWrite.SameName(categories.Value!, c => c.Name, label) is { } existing)
            return confirm
                ? ToolResults.Ok(new { done = true, categoryId = existing.Id, note = $"\"{existing.Name?.Both}\" is already a category; nothing was added twice." })
                : ToolResults.Fail($"There is already a category \"{existing.Name?.Both}\" (id {existing.Id}{(existing.IsActive ? "" : ", switched off")}).");

        var preview = $"Add the expense category \"{label.Both}\".";
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        // Last on the list, where the back office puts a new one
        var result = await api.SendAsync<CreatedResponse>(HttpMethod.Post, "finance-api", "/api/finance/categories", null,
            new ExpenseCategoryRequest(null, label, categories.Value!.Count + 1, true), null, ct);
        flow.Audit(CategoryTool, new { name = label.En, nameAr = label.Ar, requestId }, result.IsOk ? $"category {result.Value!.Id}" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, categoryId = result.Value!.Id, preview });
    }

    [McpServerTool(Name = SupplierTool, Title = "Add or edit a supplier", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Adds a supplier, or edits one already on the list (named or by id): its name, phone and notes. Fields left out keep what the supplier has. " +
        "Use for 'add Nile Dairy as a supplier, 01001234567', 'change Al Ahram's phone', 'note that the bakery delivers on Sundays'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> SaveSupplier(
        [Description("The supplier's name; for an edit, the name (or id) it has now")] string supplier,
        [Description("For an edit: the new name")] string? newName = null,
        [Description("Phone number")] string? phone = null,
        [Description("Notes: what they supply, delivery days, account number")] string? notes = null,
        [Description("true to add a new supplier even though one with a similar name exists")] bool addNew = false,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(supplier)) return ToolResults.Fail("Say the supplier's name.");
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        // Suppliers are the business's, not a branch's; the list is read through any branch (balances are per branch)
        var anyBranch = snapshot.Value!.Branches.FirstOrDefault(b => b.IsActive) ?? snapshot.Value.Branches.FirstOrDefault();

        var list = await api.GetAsync<List<SupplierDetails>>("finance-api", "/api/finance/suppliers?includeInactive=true", anyBranch?.Id, ct);
        if (!list.IsOk) return ToolResults.Fail(list.Error!);
        // An id or the exact name edits that supplier; a name no supplier has adds one. A near match is
        // never taken for either: the owner says which they meant, or addNew to add one anyway
        var (found, error) = NameResolver.Pick(list.Value!, supplier, s => s.Id, s => s.Named, "supplier");
        var text = supplier.Trim();
        var byId = int.TryParse(text, System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture, out _);
        if (byId && found is null) return ToolResults.Fail(error!);
        var exact = byId || (found is not null && string.Equals(found.Name?.Trim(), text, StringComparison.OrdinalIgnoreCase));
        if (!exact && !addNew)
        {
            if (found is not null)
                return ToolResults.Fail($"\"{text}\" is close to the supplier \"{found.Name}\" (id {found.Id}). To edit that one, name it exactly or by id; to add a new supplier anyway, set addNew=true.");
            if (error!.StartsWith("Several", StringComparison.Ordinal))
                return ToolResults.Fail($"{error} To add a new supplier named \"{text}\" anyway, set addNew=true.");
        }
        if (!exact) found = null;

        string preview;
        SupplierRequest body;
        if (found is null)
        {
            body = new SupplierRequest(null, supplier.Trim(), BusinessWrite.Clean(phone), BusinessWrite.Clean(notes), true);
            preview = $"Add the supplier \"{body.Name}\"" + (body.Phone is null ? "" : $", phone {body.Phone}") + (body.Notes is null ? "" : $", notes \"{body.Notes}\"") + ".";
        }
        else
        {
            // A confirm retried after it added the supplier lands here too, and has nothing left to do
            if (newName is null && phone is null && notes is null)
                return confirm
                    ? ToolResults.Ok(new { done = true, supplierId = found.Id, note = $"\"{found.Name}\" is already a supplier; nothing was added twice." })
                    : ToolResults.Fail($"\"{found.Name}\" is already a supplier. Say what to change: its name, phone or notes.");
            body = new SupplierRequest(found.Id, BusinessWrite.Clean(newName) ?? found.Name ?? "", phone is null ? found.Phone : BusinessWrite.Clean(phone),
                notes is null ? found.Notes : BusinessWrite.Clean(notes), found.IsActive);
            var changes = new List<string>();
            if (newName is not null) changes.Add($"name \"{found.Name}\" → \"{body.Name}\"");
            if (phone is not null) changes.Add($"phone {found.Phone ?? "none"} → {body.Phone ?? "none"}");
            if (notes is not null) changes.Add($"notes → \"{body.Notes ?? ""}\"");
            preview = $"Edit the supplier \"{found.Name}\" (id {found.Id}): {string.Join(", ", changes)}.";
        }

        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var result = await api.SendAsync<CreatedResponse>(HttpMethod.Post, "finance-api", "/api/finance/suppliers", null, body, null, ct);
        flow.Audit(SupplierTool, new { supplierId = body.Id, body.Name, body.Phone, body.Notes, requestId }, result.IsOk ? $"supplier {result.Value!.Id}" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, supplierId = result.Value!.Id, preview });
    }

    [McpServerTool(Name = SupplierPaymentTool, Title = "Record a payment to a supplier", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Records on a supplier's account a payment the business already made to them outside the drawer (bank transfer, the owner's cash), so what the branch owes them goes down; it books what was paid and sends no money. " +
        "Use for 'I paid Nile Dairy 5,000 today', 'we transferred 12k to the bakery yesterday'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> RecordSupplierPayment(
        [Description("The supplier's name or id")] string supplier,
        [Description("Amount paid, in the business's currency")] decimal amount,
        [Description("The business date, yyyy-MM-dd; default today")] string? date = null,
        [Description("Branch id or name whose account it settles; required when the business has more than one active branch")] string? branch = null,
        [Description("A short note: transfer reference, invoice it settles")] string? note = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (amount <= 0) return ToolResults.Fail("A payment needs a positive amount.");
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var one = BranchSelector.SelectOne(snap.Branches, branch);
        if (!one.IsOk) return ToolResults.Fail(one.Error!);
        var target = one.Value!;

        var list = await api.GetAsync<List<SupplierDetails>>("finance-api", "/api/finance/suppliers", target.Id, ct);
        if (!list.IsOk) return ToolResults.Fail(list.Error!);
        var (found, error) = NameResolver.Pick(list.Value!, supplier, s => s.Id, s => s.Named, "supplier");
        if (found is null) return ToolResults.Fail(error!);
        var (day, dayError) = BusinessWrite.Day(date, snap, target, clock);
        if (dayError is not null) return ToolResults.Fail(dayError);

        var preview = $"Record a payment of {snap.Currency} {ToolResults.Money(amount)} to \"{found.Name}\" on {Day(day)} at {target.BothNames}"
            + (string.IsNullOrWhiteSpace(note) ? "" : $", note \"{note.Trim()}\"")
            + $". The branch owes them {snap.Currency} {ToolResults.Money(found.Balance)} now, {snap.Currency} {ToolResults.Money(found.Balance - amount)} after.";
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var key = flow.StepKey(SupplierPaymentTool, requestId, "payment");
        var result = await api.SendAsync<CreatedResponse>(HttpMethod.Post, "finance-api", $"/api/finance/suppliers/{found.Id}/ledger", target.Id,
            new SupplierEntryRequest(1, amount, day, BusinessWrite.Clean(note)), key, ct);
        flow.Audit(SupplierPaymentTool, new { supplierId = found.Id, amount, day = Day(day), branch = target.Id, note, requestId, key },
            result.IsOk ? $"supplier entry {result.Value!.Id}" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(result.Value!.Id == 0
            ? new { recorded = true, preview, note = (string?)"This payment had already been recorded; nothing was written twice." }
            : new { recorded = true, preview, note = (string?)null });
    }

    [McpServerTool(Name = RecurringTool, Title = "Set up a monthly bill", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Sets up a bill that records itself as an expense every month on the same day (rent, internet, a salary-like retainer), or changes or pauses one already set up for that category. " +
        "Use for 'rent is 20,000 on the 1st every month', 'internet is now 650', 'stop the cleaning bill'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> SetRecurringExpense(
        [Description("Expense category name or id (e.g. Rent); ask get_expenses to see the categories in use")] string category,
        [Description("Amount each month; leave out to keep it when editing")] decimal? amount = null,
        [Description("Day of the month it is recorded, 1-28; leave out to keep it when editing")] int? dayOfMonth = null,
        [Description("Branch id or name; required when the business has more than one active branch")] string? branch = null,
        [Description("drawer (cash from the till) or bank; leave out for bank on a new bill or to keep it when editing")] string? paidFrom = null,
        [Description("Who is paid, e.g. the landlord")] string? vendor = null,
        [Description("A short note")] string? note = null,
        [Description("false to pause the bill, true to run it again; leave out to keep it")] bool? active = null,
        [Description("true to add a second bill under a category that already has one, instead of editing it")] bool addAnother = false,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (amount is <= 0) return ToolResults.Fail("The amount must be positive.");
        if (dayOfMonth is < 1 or > 28) return ToolResults.Fail("The day of the month is 1 to 28, so every month has it.");
        int? paidFromCode = paidFrom is null ? null : BusinessWrite.PaidFrom(paidFrom);
        if (paidFromCode < 0) return ToolResults.Fail("paidFrom must be drawer or bank.");

        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var one = BranchSelector.SelectOne(snap.Branches, branch);
        if (!one.IsOk) return ToolResults.Fail(one.Error!);
        var target = one.Value!;

        var categories = await api.GetAsync<List<ExpenseCategoryView>>("finance-api", "/api/finance/categories", null, ct);
        if (!categories.IsOk) return ToolResults.Fail(categories.Error!);
        var (match, error) = NameResolver.Pick(categories.Value!, category, c => c.Id, c => c.Name, "expense category");
        if (match is null) return ToolResults.Fail($"{error} The categories are: {string.Join(", ", categories.Value!.Where(c => c.IsActive).Select(c => c.Name?.Both))}.");

        var bills = await api.GetAsync<List<RecurringExpenseView>>("finance-api", "/api/finance/recurring", target.Id, ct);
        if (!bills.IsOk) return ToolResults.Fail(bills.Error!);
        var same = bills.Value!.Where(b => b.CategoryId == match.Id).ToList();
        if (same.Count > 1 && !addAnother)
            return ToolResults.Fail($"{match.Name?.Both} has {same.Count} monthly bills at {target.BothNames}: {string.Join("; ", same.Select(Bill))}. Edit them in the back office, or set addAnother=true to add one more.");
        var existing = addAnother ? null : same.FirstOrDefault();

        RecurringExpenseRequest body;
        string preview;
        string Money(decimal a) => $"{snap.Currency} {ToolResults.Money(a)}";
        static string From(int code) => code == 0 ? "drawer" : code == 1 ? "bank" : "a partner";
        if (existing is null)
        {
            if (amount is null || dayOfMonth is null) return ToolResults.Fail("A new monthly bill needs its amount and the day of the month.");
            body = new RecurringExpenseRequest(null, match.Id, amount.Value, dayOfMonth.Value, paidFromCode ?? 1, null, BusinessWrite.Clean(vendor), BusinessWrite.Clean(note), active ?? true);
            preview = $"Record {Money(body.Amount)} under {match.Name?.Both} at {target.BothNames} on day {body.DayOfMonth} of every month, paid from the {From(body.PaidFrom)}"
                + (body.Vendor is null ? "" : $", to {body.Vendor}") + (body.Note is null ? "" : $", note \"{body.Note}\"")
                + (body.IsActive == false ? " (set up paused)" : "") + ".";
        }
        else
        {
            body = new RecurringExpenseRequest(existing.Id, match.Id, amount ?? existing.Amount, dayOfMonth ?? existing.DayOfMonth, paidFromCode ?? existing.PaidFrom,
                existing.PartnerId, vendor is null ? existing.Vendor : BusinessWrite.Clean(vendor), note is null ? existing.Note : BusinessWrite.Clean(note), active ?? existing.IsActive);
            preview = $"Change the monthly {match.Name?.Both} bill at {target.BothNames} from {Bill(existing)} to {Money(body.Amount)} on day {body.DayOfMonth}, paid from the {From(body.PaidFrom)}"
                + (body.Vendor is null ? "" : $", to {body.Vendor}") + (body.IsActive == false ? ", paused" : "") + ".";
        }

        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var result = await api.SendAsync<CreatedResponse>(HttpMethod.Post, "finance-api", "/api/finance/recurring", target.Id, body, null, ct);
        flow.Audit(RecurringTool, new { recurringId = body.Id, category = match.Name?.Display, body.Amount, body.DayOfMonth, body.PaidFrom, body.IsActive, branch = target.Id, requestId },
            result.IsOk ? $"recurring {result.Value!.Id}" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, recurringId = result.Value!.Id, preview });

        string Bill(RecurringExpenseView b) => $"{snap.Currency} {ToolResults.Money(b.Amount)} on day {b.DayOfMonth}{(b.IsActive ? "" : " (paused)")}";
    }
}
