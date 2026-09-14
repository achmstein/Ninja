using Chillax.E2E.Harness;
using Chillax.E2E.Support;

namespace Chillax.E2E.Actors;

/// <summary>
/// The back office and the owner-only moves at the till (refund, void,
/// pricing, partners, P&amp;L). Each method sends what admin_web sends
/// (src/admin_web/src/features/*). Signed in as the seeded admin, who is
/// Admin + Owner.
/// </summary>
public sealed class OwnerActor(ApiClient api)
{
    public ApiClient Api { get; } = api;

    // --- Till (owner-only) --------------------------------------------------

    /// <summary>branches: VAT and service rates as fractions (0.14 = 14 %).</summary>
    public async Task SetPricingAsync(decimal vatRate, bool pricesIncludeVat, decimal serviceChargeRate, CancellationToken ct)
    {
        using var r = await Api.PutAsync("/api/tickets/pricing/1", new { vatRate, pricesIncludeVat, serviceChargeRate }, ct);
    }

    /// <summary>refund-dialog.tsx</summary>
    public Task<RefundResult> RefundAsync(int ticketId, (int LineId, decimal Qty)[] lines, string reason, CancellationToken ct,
        int tender = Codes.Tender.Cash, string? customerId = null, string? customerName = null)
        => Api.PostAsync<RefundResult>($"/api/tickets/{ticketId}/refunds", new
        {
            lines = lines.Select(l => new { lineId = l.LineId, qty = l.Qty }).ToArray(),
            reason,
            tender,
            customerId,
            customerName,
        }, ct);

    /// <summary>void-dialog.tsx</summary>
    public async Task VoidAsync(int ticketId, string reason, CancellationToken ct)
    {
        using var r = await Api.PostAsync($"/api/tickets/{ticketId}/void", new { reason }, ct);
    }

    public Task<TicketDetail?> TicketAsync(int ticketId, CancellationToken ct)
        => Api.GetOrDefaultAsync<TicketDetail>($"/api/tickets/{ticketId}", ct);

    // --- Finance ---------------------------------------------------------------

    public async Task<int> CreateSupplierAsync(string name, CancellationToken ct)
        => (await Api.PostAsync<CreatedResponse>("/api/finance/suppliers", new { id = (int?)null, name, phone = (string?)null, notes = (string?)null }, ct)).Id;

    public Task<SupplierLedgerView> SupplierLedgerAsync(int supplierId, CancellationToken ct)
        => Api.GetAsync<SupplierLedgerView>($"/api/finance/suppliers/{supplierId}/ledger", ct);

    public async Task<int> CreatePartnerAsync(string name, decimal percentOfBranch1, CancellationToken ct)
        => (await Api.PostAsync<CreatedResponse>("/api/finance/partners", new
        {
            id = (int?)null,
            name,
            phone = (string?)null,
            userId = (string?)null,
            shares = new[] { new { branchId = 1, percent = percentOfBranch1 } },
        }, ct)).Id;

    public Task<PartnerLedgerView> PartnerLedgerAsync(int partnerId, CancellationToken ct)
        => Api.GetAsync<PartnerLedgerView>($"/api/finance/partners/{partnerId}/ledger", ct);

    public Task<List<ExpenseCategoryView>> CategoriesAsync(CancellationToken ct)
        => Api.GetAsync<List<ExpenseCategoryView>>("/api/finance/categories", ct);

    public Task<ExpensesView> ExpensesAsync(DateOnly from, DateOnly to, CancellationToken ct)
        => Api.GetAsync<ExpensesView>($"/api/finance/expenses?from={from:yyyy-MM-dd}&to={to:yyyy-MM-dd}", ct);

    /// <summary>profit.tsx: the month's P&amp;L, entirely fed by events.</summary>
    public Task<ProfitView> ProfitAsync(int year, int month, CancellationToken ct)
        => Api.GetAsync<ProfitView>($"/api/finance/profit?year={year}&month={month}", ct);

    // --- Payroll ---------------------------------------------------------------

    public async Task<int> HireAsync(string name, DateOnly startedOn, decimal dailyRate, CancellationToken ct, string? userId = null)
        => (await Api.PostAsync<CreatedResponse>("/api/payroll/employees", new
        {
            name,
            jobTitle = "Barista",
            phone = (string?)null,
            branchId = 1,
            userId,
            startedOn,
            scheme = Codes.PayScheme.Daily,
            rate = dailyRate,
            paidDaysOff = (int?)null,
        }, ct)).Id;

    public Task<List<EmployeeView>> EmployeesAsync(CancellationToken ct)
        => Api.GetAsync<List<EmployeeView>>("/api/payroll/employees", ct);

    public Task<List<AttendanceView>> AttendanceAsync(DateOnly from, DateOnly to, CancellationToken ct)
        => Api.GetAsync<List<AttendanceView>>($"/api/payroll/attendance?from={from:yyyy-MM-dd}&to={to:yyyy-MM-dd}", ct);

    public async Task MarkPresentAsync(DateOnly day, int employeeId, CancellationToken ct)
    {
        using var r = await Api.PutAsync($"/api/payroll/attendance/{day:yyyy-MM-dd}", new
        {
            marks = new[] { new { employeeId, status = (int?)Codes.Attendance.Present, note = (string?)null, overtimeHours = (decimal?)null } },
        }, ct);
    }

    public Task<LedgerView> LedgerAsync(int employeeId, CancellationToken ct)
        => Api.GetAsync<LedgerView>($"/api/payroll/employees/{employeeId}/ledger", ct);

    public async Task<List<int>> GeneratePayslipsAsync(int? employeeId, DateOnly periodStart, DateOnly periodEnd, CancellationToken ct)
        => (await Api.PostAsync<GeneratedResponse>("/api/payroll/payslips", new { employeeId, periodStart, periodEnd }, ct)).Ids;

    public Task<PayslipView> PayslipAsync(int id, CancellationToken ct)
        => Api.GetAsync<PayslipView>($"/api/payroll/payslips/{id}", ct);

    public async Task PayPayslipAsync(int id, decimal? amount, string? note, CancellationToken ct)
    {
        using var r = await Api.PostAsync($"/api/payroll/payslips/{id}/pay", new { amount, note }, ct);
    }

    // --- Inventory -------------------------------------------------------------

    public Task<int> CreateStockItemAsync(string nameEn, string unit, bool autoSoldOut, CancellationToken ct)
        => CreateStockItemAsync(new LocalizedText(nameEn, nameEn), unit, null, null, autoSoldOut, ct);

    /// <summary>stock-item-dialog.tsx / the receipt review sheet: the whole item.</summary>
    public async Task<int> CreateStockItemAsync(LocalizedText name, string unit, decimal? packSize, string? packName, bool autoSoldOut, CancellationToken ct)
        => (await Api.PostAsync<CreatedResponse>("/api/inventory/items", new
        {
            name = new { en = name.En, ar = name.Ar },
            unit,
            packSize,
            packName,
            autoSoldOut,
            isActive = (bool?)null,
        }, ct)).Id;

    public Task<List<StockItemView>> StockItemsAsync(CancellationToken ct)
        => Api.GetAsync<List<StockItemView>>("/api/inventory/items", ct);

    /// <summary>receive-dialog.tsx "Scan receipt": a photo in, a proposal out, nothing posted.</summary>
    public Task<ReceiptProposal> ScanReceiptAsync(byte[] image, CancellationToken ct)
        => Api.PostFileAsync<ReceiptProposal>("/api/inventory/purchases/scan", image, "receipt.png", "image/png", ct);

    /// <summary>The sparkle on a bilingual field: the assistant fills in what is missing.</summary>
    public Task<LocalizeResponse> LocalizeAsync(int kind, LocalizedText name, CancellationToken ct,
        LocalizedText? description = null, int? catalogTypeId = null, bool suggestCategory = false, bool suggestDescription = false)
        => Api.PostAsync<LocalizeResponse>("/api/catalog/assist/localize", new
        {
            kind,
            name = new { en = name.En, ar = name.Ar },
            description = description is null ? null : new { en = description.En, ar = description.Ar },
            catalogTypeId,
            suggestCategory,
            suggestDescription,
        }, ct);

    /// <summary>menu customizations-section.tsx "Suggest": the assistant proposes the item's option groups.</summary>
    public Task<SuggestCustomizationsResponse> SuggestCustomizationsAsync(int itemId, CancellationToken ct)
        => Api.PostAsync<SuggestCustomizationsResponse>("/api/catalog/assist/customizations", new { itemId }, ct);

    /// <summary>menu customizations-section.tsx "Add" on a proposal: the group goes up as it came back.</summary>
    public Task<ItemCustomizationView> AddCustomizationAsync(int itemId, ProposedCustomization group, int displayOrder, CancellationToken ct)
        => Api.PostAsync<ItemCustomizationView>($"/api/catalog/items/{itemId}/customizations", new
        {
            catalogItemId = itemId,
            name = new { en = group.Name.En, ar = group.Name.Ar },
            isRequired = group.IsRequired,
            allowMultiple = group.AllowMultiple,
            displayOrder,
            options = group.Options.Select((o, i) => new
            {
                name = new { en = o.Name.En, ar = o.Name.Ar },
                priceAdjustment = o.PriceAdjustment,
                isDefault = o.IsDefault,
                displayOrder = i,
            }).ToList(),
        }, ct);

    public Task<List<ItemCustomizationView>> CustomizationsAsync(int itemId, CancellationToken ct)
        => Api.GetAsync<List<ItemCustomizationView>>($"/api/catalog/items/{itemId}/customizations", ct);

    public async Task SetReorderLevelAsync(int stockItemId, decimal? reorderLevel, CancellationToken ct)
    {
        using var r = await Api.PutAsync($"/api/inventory/items/{stockItemId}/reorder-level", new { reorderLevel }, ct);
    }

    /// <summary>menu stock-rule-section.tsx: what a menu item consumes per unit sold.</summary>
    public async Task SetRecipeAsync(int catalogItemId, (int StockItemId, decimal Quantity)[] lines, CancellationToken ct)
    {
        using var r = await Api.PutAsync($"/api/inventory/recipes/{catalogItemId}", new
        {
            lines = lines.Select(l => new { stockItemId = l.StockItemId, quantity = l.Quantity, optionIds = (int[]?)null }).ToArray(),
        }, ct);
    }

    /// <summary>inventory purchases: stock received from a supplier.</summary>
    public async Task<int> ReceivePurchaseAsync((int StockItemId, decimal Quantity, decimal UnitCost)[] lines, CancellationToken ct,
        int? supplierId = null, string? supplier = null, string? invoiceRef = null)
    {
        var id = (await Api.PostAsync<CreatedResponse>("/api/inventory/purchases", new
        {
            supplier,
            invoiceRef,
            supplierId,
            lines = lines.Select(l => new { stockItemId = l.StockItemId, quantity = l.Quantity, unitCost = l.UnitCost }).ToArray(),
        }, ct)).Id;
        if (id == 0)
            throw new InvalidOperationException("purchase was deduplicated (id 0)");
        return id;
    }

    public async Task PostWasteAsync(int stockItemId, decimal quantity, string reason, CancellationToken ct)
    {
        using var r = await Api.PostAsync("/api/inventory/movements", new { stockItemId, type = Codes.StockMovement.Waste, quantity, reason, unitCost = (decimal?)null }, ct);
    }

    public async Task PostAdjustmentAsync(int stockItemId, decimal quantity, string reason, CancellationToken ct)
    {
        using var r = await Api.PostAsync("/api/inventory/movements", new { stockItemId, type = Codes.StockMovement.Adjustment, quantity, reason, unitCost = (decimal?)null }, ct);
    }

    public async Task<int> PostCountAsync((int StockItemId, decimal Counted)[] lines, string? note, CancellationToken ct)
        => (await Api.PostAsync<CreatedResponse>("/api/inventory/counts", new
        {
            note,
            lines = lines.Select(l => new { stockItemId = l.StockItemId, counted = l.Counted }).ToArray(),
        }, ct)).Id;

    public Task<List<StockLevelView>> LevelsAsync(CancellationToken ct)
        => Api.GetAsync<List<StockLevelView>>("/api/inventory/levels", ct);

    public async Task<StockLevelView> LevelAsync(int stockItemId, CancellationToken ct)
        => (await LevelsAsync(ct)).FirstOrDefault(l => l.StockItemId == stockItemId)
           ?? throw new InvalidOperationException($"stock item {stockItemId} has no level row");

    public Task<PagedResult<MovementView>> MovementsAsync(int stockItemId, CancellationToken ct)
        => Api.GetAsync<PagedResult<MovementView>>($"/api/inventory/movements?stockItemId={stockItemId}&pageSize=100", ct);

    public Task<UsageReport> UsageAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct)
        => Api.GetAsync<UsageReport>($"/api/inventory/reports/usage?from={fromUtc:O}&to={toUtc:O}", ct);

    public Task<RebuildResponse> RebuildLevelsAsync(CancellationToken ct)
        => Api.PostAsync<RebuildResponse>("/api/inventory/levels/rebuild", null, ct);

    // --- Catalog ---------------------------------------------------------------

    /// <summary>menu item-details-form.tsx: the whole CatalogItem model goes up.</summary>
    public Task<CatalogItem> CreateMenuItemAsync(string nameEn, decimal price, int catalogTypeId, CancellationToken ct)
        => Api.PostAsync<CatalogItem>("/api/catalog/items", new
        {
            name = new { en = nameEn, ar = nameEn },
            description = new { en = nameEn, ar = nameEn },
            price,
            catalogTypeId,
            isAvailable = true,
            isOnOffer = false,
            offerPrice = (decimal?)null,
            isPopular = false,
            preparationTimeMinutes = (int?)null,
            displayOrder = 99,
            pictureFileName = (string?)null,
        }, ct);

    /// <summary>availability screen: sold out / back on at this branch.</summary>
    public async Task SetAvailabilityAsync(int itemId, bool isAvailable, CancellationToken ct)
    {
        using var r = await Api.PatchAsync($"/api/catalog/items/{itemId}/availability", new { isAvailable }, ct);
    }

    // --- Customers -------------------------------------------------------------

    /// <summary>Loyalty accounts are opened by the customer or an Admin; 409 = already joined.</summary>
    public async Task CreateLoyaltyAccountAsync(string userId, string displayName, CancellationToken ct)
    {
        using var r = await Api.PostAsync("/api/loyalty/accounts", new { userId, userDisplayName = displayName }, ct, ensureSuccess: false);
        if (r.StatusCode != HttpStatusCode.Conflict)
            await ApiClient.EnsureSuccessAsync(r, ct);
    }

    public Task<LoyaltyAccount?> LoyaltyAsync(string userId, CancellationToken ct)
        => Api.GetOrDefaultAsync<LoyaltyAccount>($"/api/loyalty/accounts/{userId}", ct);

    public Task<List<LoyaltyTransaction>> LoyaltyTransactionsAsync(string userId, CancellationToken ct)
        => Api.GetAsync<List<LoyaltyTransaction>>($"/api/loyalty/transactions/{userId}", ct);

    public Task<AccountView?> AccountAsync(string customerId, CancellationToken ct)
        => Api.GetOrDefaultAsync<AccountView>($"/api/accounts/{customerId}", ct);

    public Task<List<BranchView>> BranchesAsync(CancellationToken ct) => Api.GetAsync<List<BranchView>>("/api/branches", ct);

    public Task<OrderView?> OrderAsync(int orderId, CancellationToken ct)
        => Api.GetOrDefaultAsync<OrderView>($"/api/orders/{orderId}", ct);
}
