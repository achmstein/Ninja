namespace Ninja.E2E.Support;

// Minimal mirrors of the services' response models: only what the scenarios
// read. Deserialised case-insensitively (JsonSerializerDefaults.Web).

public sealed record LocalizedText(string En, string? Ar = null);

// --- Sales -----------------------------------------------------------------

public sealed record ShiftView(
    int Id,
    int BranchId,
    string Status,
    DateTime OpenedAt,
    string OpenedBy,
    decimal OpeningFloat,
    DateTime? ClosedAt,
    decimal? ClosingCount,
    decimal? ExpectedCash,
    decimal? OverShort,
    List<CashMovementView> Movements,
    int TicketsSettled,
    decimal SalesTotal,
    List<TenderTotal> TenderTotals,
    decimal ChangeGiven,
    decimal RefundsTotal,
    decimal CashRefunds,
    decimal PayInsTotal,
    decimal PayOutsTotal,
    decimal TabPaymentsTotal,
    decimal CashTabPayments,
    List<TabPaymentView> TabPayments,
    decimal ExpectedInDrawer);

public sealed record CashMovementView(string Type, decimal Amount, string Reason, string RecordedBy, DateTime RecordedAt, string Kind,
    int? EmployeeId, string? EmployeeName, int? SupplierId, string? SupplierName, int? PartnerId, string? PartnerName, int? CategoryId);

public sealed record TenderTotal(string Tender, decimal Amount, int Count);

public sealed record TabPaymentView(int Id, int Number, int BranchId, string CustomerId, string? CustomerName, string Tender, decimal Amount, int? ShiftId);

public sealed record TicketSummary(int Id, string Type, string Status, LocalizedText? LocationName, int? SessionId, int? PlaceId, string? PlaceKind,
    string? Label, int LineCount, decimal Total, List<string> CustomerIds);

public sealed record TicketDetail(
    int Id,
    string Type,
    string Status,
    int BranchId,
    LocalizedText? LocationName,
    int? SessionId,
    DateTime? SessionEndedAt,
    int? PlaceId,
    string? PlaceKind,
    string? Label,
    DateTime? SettledAt,
    int? ShiftId,
    decimal ChangeGiven,
    DateTime? VoidedAt,
    string? VoidReason,
    List<TicketLineView> Lines,
    List<PaymentView> Payments,
    decimal Total,
    int? ReceiptNumber,
    decimal Subtotal,
    decimal ServiceCharge,
    decimal Vat,
    List<RefundView> Refunds,
    decimal RefundedTotal);

public sealed record TicketLineView(int Id, string Source, int? OrderId, LocalizedText Description, decimal Qty, decimal UnitPrice,
    decimal Discount, decimal Total, string? CustomerName, string? CustomerId);

public sealed record PaymentView(string Tender, decimal Amount, string? CustomerName, string? CustomerId);

public sealed record RefundView(int Id, int Number, decimal Amount, string Reason, string Tender, string? CustomerName, List<RefundLineView> Lines);

public sealed record RefundLineView(int TicketLineId, LocalizedText Description, decimal Qty, decimal Amount);

public sealed record PagedResult<T>(List<T> Items, int TotalCount);

public sealed record TicketHistoryRow(int Id, string Type, string Status, int? ReceiptNumber, decimal Total);

public sealed record SettledTicketSummary(int Id, int ReceiptNumber, string Type, decimal Total, decimal RefundedTotal);

public sealed record OpenShiftResponse(int ShiftId);
public sealed record OpenTicketResponse(int TicketId);
public sealed record SettleResult(int ReceiptNumber, decimal Change);
public sealed record RefundResult(int Number, decimal Amount);
public sealed record TabPaymentResult(int Id, int Number);
public sealed record PricingView(int BranchId, decimal VatRate, bool PricesIncludeVat, decimal ServiceChargeRate);

// --- Ordering ----------------------------------------------------------------

public sealed record PosOrderResponse(int OrderId);

public sealed record OrderSummary(int OrderNumber, DateTime Date, string Status, double Total, string Source, int? PlaceId, int? SessionId,
    string? UserName, string? UserId, List<OrderItemView>? Items);

public sealed record OrderItemView(LocalizedText ProductName, int Units, double UnitPrice);

public sealed record OrderView(int OrderNumber, string Status, string Source, int? PlaceId, int? SessionId, List<OrderItemView> OrderItems, decimal Total);

public sealed record KitchenOrder(int OrderNumber, DateTime? ConfirmedAt, DateTime? ReadyAt, string Source, string? CustomerName, List<KitchenOrderItem> Items,
    List<KitchenOrderPart>? Parts = null);

public sealed record KitchenOrderItem(LocalizedText ProductName, int Units, int? StationId = null);

/// <summary>One station's share of an order, as the pass shows it.</summary>
public sealed record KitchenOrderPart(int StationId, LocalizedText StationName, bool ShowsOnScreen, bool PrintsTickets, DateTime? ReadyAt);

public sealed record KitchenStation(int Id, LocalizedText Name, List<int> CategoryIds, bool ShowsOnScreen, bool PrintsTickets,
    string? PrinterHost, int PrinterPort, bool IsDefault);

/// <summary>A ticket waiting for a kitchen printer, with the station's lines of its order.</summary>
public sealed record KitchenTicket(int JobId, int StationId, LocalizedText StationName, string? PrinterHost, int PrinterPort,
    bool IsReprint, bool IsTest, int? OrderNumber, DateTime? ClaimedAt, int Attempts, List<KitchenOrderItem> Items);

// --- Spaces ------------------------------------------------------------------

public sealed record StartWalkInStayResult(int StayId);

/// <summary>What seating a reservation answers: whether the party was seated, and the stay that took over at a timed place.</summary>
public sealed record SeatResult(bool Seated, int? StayId);

public sealed record ReservationView(int Id, int PlaceId, LocalizedText PlaceName, bool PlaceIsTimed, string? CustomerId, string? CustomerName,
    int? PartySize, DateTime? For, DateTime CreatedAt, DateTime? ExpiresAt, bool StartOnConfirm, string? RequestedOptionCode,
    int Status, bool IsHolding, int? StayId, DateTime? SeatedAt, DateTime? ClosedAt);

/// <summary>ReservationStatus as Spaces serialises it.</summary>
public static class ReservationStatuses
{
    public const int Requested = 1, Confirmed = 2, Seated = 3, Cancelled = 4, Expired = 5, Completed = 6;
}

public sealed record RateOptionView(string Code, LocalizedText Name, decimal HourlyRate);

public sealed record TariffView(List<RateOptionView> Options, int RoundingMinutes);

public sealed record PlaceView(int Id, LocalizedText Name, int BranchId, int Status, bool IsActive, bool IsTimed, TariffView? Tariff, bool Reservable = false, bool CanReserve = false)
{
    /// <summary>The hourly rate of one option of the tariff ("single", "multi").</summary>
    public decimal Rate(string optionCode)
        => Tariff?.Options.FirstOrDefault(o => o.Code == optionCode)?.HourlyRate
           ?? throw new InvalidOperationException($"{Name.En} has no {optionCode} rate");
}

public sealed record StayView(int Id, int PlaceId, LocalizedText PlaceName, string? CustomerId, string? CustomerName,
    DateTime? StartedAt, DateTime? EndedAt, decimal? TotalCost, string? CurrentOptionCode, int Status, List<StayMemberView> Members,
    int? ReservationId = null);

public sealed record StayMemberView(string CustomerId, string? CustomerName, string Role);

// --- Inventory ---------------------------------------------------------------

public sealed record CreatedResponse(int Id);

public sealed record StockItemView(int Id, LocalizedText Name, string Unit, decimal? PackSize, string? PackName, bool AutoSoldOut, bool IsActive);

// The assistant's receipt proposal (Inventory.API Application/Assist/ReceiptContracts.cs)
public sealed record ReceiptProposal(string? Supplier, string? InvoiceRef, string? Date, string Currency, decimal? PrintedTotal,
    decimal ComputedTotal, List<ProposedLine> Lines, List<string> Warnings, string? Notes);

public sealed record ProposedLine(int Index, string RawText, decimal Quantity, decimal? Packs, decimal UnitCost, decimal LineTotal,
    int? StockItemId, double Confidence, List<int> Suggestions, ProposedNewItem? NewItem);

public sealed record ProposedNewItem(LocalizedText Name, string Unit, decimal? PackSize, string? PackName);

// The assistant's localize answer (Catalog.API Assist/LocalizeContracts.cs)
public sealed record LocalizeResponse(LocalizedText Name, LocalizedText? Description, int? SuggestedCatalogTypeId, List<string> Filled, List<string> Warnings);

// The assistant's customization proposals (Catalog.API Assist/CustomizationContracts.cs)
public sealed record SuggestCustomizationsResponse(List<ProposedCustomization> Groups, List<string> Warnings);

public sealed record ProposedCustomization(LocalizedText Name, bool IsRequired, bool AllowMultiple, List<ProposedOption> Options);

public sealed record ProposedOption(LocalizedText Name, decimal PriceAdjustment, bool IsDefault);

public sealed record ItemCustomizationView(int Id, LocalizedText Name, bool IsRequired, bool AllowMultiple, int DisplayOrder, List<CustomizationOptionView> Options);

// The assistant's menu-photo proposal (Catalog.API Assist/MenuScanContracts.cs)
public sealed record MenuProposal(List<ProposedCategory> Categories, List<string> Warnings, string? Notes);

public sealed record ProposedCategory(LocalizedText Name, int? CatalogTypeId, List<ProposedItem> Items);

public sealed record ProposedItem(string RawText, LocalizedText Name, LocalizedText Description, decimal Price, int? ExistingItemId);

public sealed record CatalogTypeView(int Id, LocalizedText Name, int DisplayOrder);

public sealed record CustomizationOptionView(int Id, LocalizedText Name, decimal PriceAdjustment, bool IsDefault, int DisplayOrder);

public sealed record StockLevelView(int StockItemId, LocalizedText Name, string Unit, bool AutoSoldOut, bool IsActive, decimal OnHand,
    decimal? ReorderLevel, decimal AvgUnitCost, bool IsLow, decimal Value, decimal? LastCost = null, DateTime? LastCostAt = null);

public sealed record CostHistoryView(DateTime At, int? PurchaseId, string? Supplier, decimal Quantity, decimal UnitCost);

public sealed record RecipeLineView(int Id, int StockItemId, decimal Quantity, List<int> OptionIds, int Slot, bool IsNone);

public sealed record RecipeView(int CatalogItemId, List<RecipeLineView> Lines);

// The assistant's stock rules for a batch of menu items (Inventory.API Application/Assist/RecipeContracts.cs)
public sealed record RecipesProposal(List<ProposedIngredient> NewItems, List<ProposedRecipe> Recipes, List<string> Warnings, string? Notes);

public sealed record ProposedIngredient(string Key, LocalizedText Name, string Unit, decimal? PackSize, string? PackName, bool AutoSoldOut);

public sealed record ProposedRecipe(int CatalogItemId, string Kind, List<ProposedRecipeLine> Lines, List<string> Warnings);

public sealed record ProposedRecipeLine(int? StockItemId, string? NewItemKey, decimal Quantity, List<int> OptionIds, int Slot);

// What one sale costs (Inventory.API RecipeCostView); the SPA joins Catalog's price for the margin
public sealed record RecipeOptionCostView(List<int> OptionIds, decimal Cost);

public sealed record RecipeCostView(int CatalogItemId, decimal BaseCost, List<int> Uncosted);

public sealed record MovementView(int Id, int StockItemId, string Type, decimal Quantity, decimal UnitCost, string? Reference, string? Reason);

public sealed record UsageReportRow(int StockItemId, decimal Purchased, decimal PurchasedValue, decimal Sold, decimal SoldValue,
    decimal Wasted, decimal WastedValue, decimal Adjusted, decimal AdjustedValue, decimal CountVariance, decimal CountVarianceValue);

public sealed record UsageReport(List<UsageReportRow> Rows, decimal PurchasedValue, decimal SoldValue, decimal WastedValue, decimal CountVarianceValue);

public sealed record VarianceRow(int StockItemId, decimal Opening, decimal OpeningValue, decimal Received, decimal ReceivedValue,
    decimal Theoretical, decimal TheoreticalValue, decimal Wasted, decimal WastedValue, decimal CountVariance, decimal CountVarianceValue,
    decimal Closing, decimal ClosingValue, decimal? VariancePercent);

public sealed record VarianceReport(List<VarianceRow> Rows, decimal OpeningValue, decimal ReceivedValue, decimal TheoreticalValue,
    decimal WastedValue, decimal CountVarianceValue, decimal ClosingValue);

public sealed record RebuildResponse(int Changed);

// --- Finance -----------------------------------------------------------------

public sealed record ExpenseCategoryView(int Id, LocalizedText Name, int DisplayOrder, bool IsActive);

public sealed record ExpenseView(int Id, DateOnly Date, int CategoryId, decimal Amount, int PaidFrom, int? PartnerId, string? Vendor,
    string? Note, string? Reference, int Source, DateTime? VoidedAt);

public sealed record CategoryTotal(int CategoryId, LocalizedText CategoryName, decimal Total);

public sealed record ExpensesView(decimal Total, List<CategoryTotal> ByCategory, List<ExpenseView> Expenses);

// The assistant's bill proposal (Finance.API Application/Assist/BillContracts.cs)
public sealed record BillProposal(string? Date, decimal? Amount, int? CategoryId, double CategoryConfidence, string? Vendor, string? Note,
    string Currency, List<string> Warnings, string? Notes);

public sealed record SupplierView(int Id, string Name, bool IsActive, decimal Balance);

public sealed record SupplierEntryView(int Id, int SupplierId, int Type, decimal Amount, decimal Signed, DateOnly Date, string? Note, string? Reference, int Source);

public sealed record SupplierLedgerView(int SupplierId, decimal Balance, List<SupplierEntryView> Entries);

public sealed record PartnerEntryView(int Id, int PartnerId, int Type, decimal Amount, decimal Signed, DateOnly Date, string? Note, string? Reference, int Source);

public sealed record PartnerLedgerView(int PartnerId, decimal Balance, List<PartnerEntryView> Entries);

public sealed record TillSupplierView(int Id, string Name, decimal Balance);

public sealed record TillPickView(int Id, string Name);

public sealed record TillCategoryView(int Id, LocalizedText Name);

public sealed record PartnerProfitShareView(int PartnerId, string Name, decimal Percent, decimal Amount);

public sealed record ProfitView(
    int Year,
    int Month,
    decimal Sales,
    decimal Refunds,
    decimal NetSales,
    decimal Vat,
    decimal Goods,
    decimal Waste,
    decimal Labour,
    List<CategoryTotal> ExpensesByCategory,
    decimal Expenses,
    decimal Profit,
    List<PartnerProfitShareView>? PartnerShares)
{
    public decimal ByCategory(int categoryId) => ExpensesByCategory.FirstOrDefault(c => c.CategoryId == categoryId)?.Total ?? 0m;

    /// <summary>Component-wise change between two readings of the same month.</summary>
    public ProfitDelta Since(ProfitView before) => new(
        Sales - before.Sales,
        Refunds - before.Refunds,
        NetSales - before.NetSales,
        Vat - before.Vat,
        Goods - before.Goods,
        Waste - before.Waste,
        Labour - before.Labour,
        Expenses - before.Expenses,
        Profit - before.Profit,
        ExpensesByCategory.Select(c => c.CategoryId).Union(before.ExpensesByCategory.Select(c => c.CategoryId))
            .ToDictionary(id => id, id => ByCategory(id) - before.ByCategory(id)));
}

public sealed record ProfitDelta(decimal Sales, decimal Refunds, decimal NetSales, decimal Vat, decimal Goods, decimal Waste, decimal Labour,
    decimal Expenses, decimal Profit, Dictionary<int, decimal> ByCategory)
{
    public decimal Category(int id) => ByCategory.GetValueOrDefault(id);
}

// --- Payroll -----------------------------------------------------------------

public sealed record GeneratedResponse(List<int> Ids);

public sealed record EmployeeView(int Id, string Name, int BranchId, string? UserId, DateOnly StartedOn, bool IsActive, decimal Balance);

public sealed record AttendanceView(int EmployeeId, DateOnly Date, int BranchId, int Status, decimal OvertimeHours, string? Note, string MarkedBy);

public sealed record LedgerEntryView(int Id, int EmployeeId, int Type, decimal Amount, decimal Signed, DateOnly Date, string? Note, string? Reference, int Source);

public sealed record LedgerView(int EmployeeId, decimal Balance, List<LedgerEntryView> Entries);

public sealed record PayslipView(int Id, int EmployeeId, DateOnly PeriodStart, DateOnly PeriodEnd, int Scheme, decimal Rate, decimal DaysWorked,
    decimal Earned, decimal Advances, decimal Payments, decimal AmountDue, decimal Remaining, int Status, decimal? PaidAmount);

public sealed record TillEmployeeView(int Id, string Name, int Scheme, decimal? Balance);

// --- Loyalty -----------------------------------------------------------------

public sealed record LoyaltyAccount(int Id, string UserId, string? UserDisplayName, int PointsBalance, int LifetimePoints, string CurrentTier);

public sealed record LoyaltyTransaction(int Id, int Points, string Type, string? ReferenceId, string? Description, DateTime CreatedAt);

// --- Accounts ----------------------------------------------------------------

public sealed record AccountSummary(int Id, string CustomerId, string? CustomerName, decimal Balance);

public sealed record AccountView(int Id, string CustomerId, string? CustomerName, decimal Balance, List<AccountTransaction> Transactions);

public sealed record AccountTransaction(int Id, string Type, decimal Amount, string? Description, string Source, int? SourceNumber);

// --- Catalog -----------------------------------------------------------------

public sealed record CatalogItem(int Id, LocalizedText Name, decimal Price, int CatalogTypeId, bool IsAvailable, bool IsOutOfStock, bool IsOnOffer,
    decimal? OfferPrice, decimal EffectivePrice, int DisplayOrder);

// --- Branch / Notification --------------------------------------------------

public sealed record BranchView(int Id, LocalizedText Name, bool IsActive, bool IsOrderingEnabled, bool IsReservationsEnabled);

/// <summary>The café's switches, as every surface reads them at boot (Tenant.API's TenantFeatures).</summary>
public sealed record FeatureSwitches(bool Reservations, bool TimeBilling, bool Loyalty, bool Tabs, bool Inventory, bool Finance, bool Payroll, bool Kds, bool OnlinePayments = false)
{
    public FeatureSwitches With(bool? reservations = null, bool? timeBilling = null, bool? loyalty = null, bool? tabs = null,
        bool? inventory = null, bool? finance = null, bool? payroll = null, bool? kds = null, bool? onlinePayments = null)
        => new(reservations ?? Reservations, timeBilling ?? TimeBilling, loyalty ?? Loyalty, tabs ?? Tabs,
            inventory ?? Inventory, finance ?? Finance, payroll ?? Payroll, kds ?? Kds, onlinePayments ?? OnlinePayments);
}

/// <summary>
/// The brand every app reads at boot. <see cref="Features"/> are the
/// switches in force; <see cref="Entitlements"/> are what the plan allows,
/// and a switch is only ever on where both are.
/// </summary>
public sealed record TenantView(LocalizedText Name, string? PrimaryColor, FeatureSwitches Features, FeatureSwitches Entitlements);

public sealed record ServiceRequestResponse(int Id, int? PlaceId, int RequestType, int Status);
