using System.Text.Json.Serialization;

namespace Ninja.Assistant.API.Downstream;

// What the read tools take from the services: mirrors of their view models,
// only the fields an answer uses. The services write most enums as numbers
// and a few as names; the enums below read either, and the answers write
// them as names, which is what the chat app can show.

// --- Catalog -----------------------------------------------------------------

/// <summary>A menu item as one branch sells it: overrides applied, with the chain's own values in <see cref="Base"/>.</summary>
public sealed record MenuItemView(
    int Id,
    LocalizedText? Name,
    LocalizedText? Description,
    decimal Price,
    int CatalogTypeId,
    LocalizedText? CatalogTypeName,
    bool IsAvailable,
    bool IsOutOfStock,
    bool IsOnOffer,
    decimal? OfferPrice,
    decimal EffectivePrice,
    int? OfferWeekdays,
    string? OfferFrom,
    string? OfferTo,
    bool IsPopular,
    int? PreparationTimeMinutes,
    int DisplayOrder,
    List<MenuGroupView>? Customizations,
    MenuItemBaseView? Base);

public sealed record MenuItemBaseView(decimal Price, decimal? OfferPrice, bool IsOnOffer, bool IsAvailable);

public sealed record MenuGroupView(int Id, LocalizedText? Name, bool IsRequired, bool AllowMultiple, int DisplayOrder, List<MenuOptionView>? Options);

public sealed record MenuOptionView(int Id, LocalizedText? Name, decimal PriceAdjustment, bool IsDefault, int DisplayOrder, bool IsOutOfStock);

public sealed record BranchOverrideView(int Id, int BranchId, int CatalogItemId, bool IsAvailable, bool IsOutOfStock, decimal? PriceOverride, decimal? OfferPriceOverride, bool? IsOnOfferOverride);

[JsonConverter(typeof(JsonStringEnumConverter<PromoKind>))]
public enum PromoKind { Percent = 0, Amount = 1 }

public sealed record PromoCodeView(
    int Id,
    string Code,
    PromoKind Kind,
    decimal Value,
    decimal? MinSubtotal,
    DateTime? StartsAt,
    DateTime? EndsAt,
    int? MaxUses,
    bool OncePerCustomer,
    bool IsActive,
    int Uses);

// --- Inventory ---------------------------------------------------------------

public sealed record RecipeLineView(int Id, int StockItemId, LocalizedText? Name, string? Unit, decimal Quantity, List<int>? OptionIds, int Slot, bool IsNone);

public sealed record RecipeView(int CatalogItemId, List<RecipeLineView>? Lines);

public sealed record RecipeCostLineView(int StockItemId, LocalizedText? Name, string? Unit, decimal Quantity, List<int>? OptionIds, decimal UnitCost, decimal Cost, int Slot, bool IsNone);

public sealed record RecipeCostView(int CatalogItemId, decimal BaseCost, List<RecipeCostLineView>? Lines, List<int>? Uncosted);

public sealed record MovementView(
    int Id,
    int StockItemId,
    LocalizedText? StockItemName,
    string? Unit,
    string? Type,
    decimal Quantity,
    decimal UnitCost,
    string? Reference,
    string? Reason,
    string? RecordedBy,
    DateTime RecordedAt);

public sealed record PurchaseLineView(int StockItemId, LocalizedText? Name, string? Unit, decimal Quantity, decimal UnitCost, decimal Total);

public sealed record PurchaseView(
    int Id,
    int BranchId,
    string? Supplier,
    string? InvoiceRef,
    string? ReceivedBy,
    DateTime ReceivedAt,
    decimal Total,
    List<PurchaseLineView>? Lines);

public sealed record StockCountLineView(int StockItemId, LocalizedText? Name, string? Unit, decimal Expected, decimal Counted, decimal Variance);

public sealed record StockCountView(
    int Id,
    int BranchId,
    string? Note,
    string? CountedBy,
    DateTime CountedAt,
    int LinesCounted,
    int LinesOff,
    List<StockCountLineView>? Lines);

public sealed record TransferLineView(int StockItemId, LocalizedText? Name, string? Unit, decimal Quantity);

public sealed record TransferView(int Id, int FromBranchId, int ToBranchId, string? Note, string? SentBy, DateTime SentAt, List<TransferLineView>? Lines);

// --- Ordering ----------------------------------------------------------------

public sealed record OrderDeliveryView(string? Address, decimal Fee, string? Stage, string? RiderName);

public sealed record OrderSummaryView(
    int OrderNumber,
    DateTime Date,
    string? Status,
    decimal Total,
    string? PromoCode,
    decimal PromoDiscount,
    decimal LoyaltyDiscount,
    bool PaysOnline,
    DateTime? PaidAt,
    int? ReceiptNumber,
    string? PaidWith,
    decimal RefundedAmount,
    DateTime? VoidedAt,
    string? PlaceKind,
    LocalizedText? PlaceName,
    string? Source,
    OrderDeliveryView? Delivery,
    string? UserName,
    int? RatingValue);

public sealed record RiderOverviewView(
    string? UserId,
    string? Name,
    bool Enabled,
    string? Status,
    bool OnDuty,
    DateTime? LastSeenAt,
    int Out,
    int DeliveredToday,
    int FailedToday,
    decimal CashCollectedToday);

public sealed record DeliveryStageView(string? Address, string? Stage, string? RiderName, DateTime? OutAt, string? FailureReason);

public sealed record DeliveryOrderView(
    int OrderNumber,
    DateTime Date,
    DateTime? ReadyAt,
    DateTime? PaidAt,
    string? CustomerName,
    decimal Total,
    bool PaidOnline,
    decimal ToCollect,
    decimal? CashDifference,
    DeliveryStageView? Delivery);

// --- Sales -------------------------------------------------------------------

public sealed record OpenTicketView(
    int Id,
    string? Type,
    string? Status,
    LocalizedText? LocationName,
    string? PlaceKind,
    string? Label,
    DateTime OpenedAt,
    DateTime LastActivityAt,
    int LineCount,
    decimal Total);

public sealed record PricingView(int BranchId, decimal VatRate, bool PricesIncludeVat, decimal ServiceChargeRate, decimal MaxCashierDiscountRate);

// --- Spaces ------------------------------------------------------------------

[JsonConverter(typeof(JsonStringEnumConverter<PlaceKind>))]
public enum PlaceKind { Room = 1, Table = 2, Station = 3 }

[JsonConverter(typeof(JsonStringEnumConverter<ReservationStatus>))]
public enum ReservationStatus { Requested = 1, Confirmed = 2, Seated = 3, Cancelled = 4, Expired = 5, Completed = 6 }

[JsonConverter(typeof(JsonStringEnumConverter<StayStatus>))]
public enum StayStatus { Running = 2, Ended = 3, Cancelled = 4 }

public sealed record ReservationView(
    int Id,
    int PlaceId,
    PlaceKind PlaceKind,
    LocalizedText? PlaceName,
    string? CustomerName,
    int? PartySize,
    DateTime? For,
    DateTime CreatedAt,
    ReservationStatus Status,
    bool IsHolding,
    string? Notes,
    DateTime? SeatedAt,
    DateTime? ClosedAt);

public sealed record StayView(
    int Id,
    int PlaceId,
    PlaceKind PlaceKind,
    LocalizedText? PlaceName,
    string? CustomerName,
    DateTime StartedAt,
    DateTime? EndedAt,
    LocalizedText? CurrentOptionName,
    decimal? TotalCost,
    StayStatus Status);

public sealed record StayStatsDayView(string? Date, int Stays, decimal Hours, decimal Revenue);

public sealed record StayStatsPlaceView(int PlaceId, PlaceKind PlaceKind, LocalizedText? PlaceName, int Stays, decimal Hours, decimal Revenue);

public sealed record StayStatsView(List<StayStatsDayView>? Days, List<StayStatsPlaceView>? Places);

// --- Loyalty and tabs --------------------------------------------------------

public sealed record LoyaltyAccountView(int Id, string? UserId, string? UserDisplayName, int PointsBalance, int LifetimePoints, string? CurrentTier, DateTime UpdatedAt);

public sealed record LoyaltyStatsView(int TotalAccounts, Dictionary<string, int>? AccountsByTier, int PointsIssuedToday, int PointsIssuedThisWeek, int PointsIssuedThisMonth);

public sealed record TabAccountView(int Id, string? CustomerId, string? CustomerName, decimal Balance, DateTime UpdatedAt);

// --- Payroll -----------------------------------------------------------------

[JsonConverter(typeof(JsonStringEnumConverter<PayScheme>))]
public enum PayScheme { Daily = 0, Monthly = 1 }

[JsonConverter(typeof(JsonStringEnumConverter<PayslipStatus>))]
public enum PayslipStatus { Draft = 0, Paid = 1 }

public sealed record PayslipView(
    int Id,
    int EmployeeId,
    string? EmployeeName,
    int BranchId,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    PayScheme Scheme,
    decimal Rate,
    decimal DaysWorked,
    decimal Earned,
    decimal OvertimeHours,
    decimal OvertimePay,
    decimal AbsentDays,
    decimal AbsenceDeduction,
    decimal Bonuses,
    decimal Deductions,
    decimal Advances,
    decimal Payments,
    decimal CarriedOver,
    decimal AmountDue,
    decimal Remaining,
    PayslipStatus Status,
    decimal? PaidAmount,
    DateTime? PaidAt,
    string? PaidBy);

// --- Tenant ------------------------------------------------------------------

/// <summary>A branch with everything the owner set on it, as Tenant.API's branch list gives it.</summary>
public sealed record BranchSettingsView(
    int Id,
    LocalizedText? Name,
    LocalizedText? Address,
    string? Phone,
    string? TaxNumber,
    bool IsActive,
    int DisplayOrder,
    string? DayStartTime,
    string? DayEndTime,
    bool IsOrderingEnabled,
    bool IsReservationsEnabled,
    bool RequireSignInForTableOrders,
    double? Latitude,
    double? Longitude,
    bool IsDeliveryEnabled,
    decimal? DeliveryRadiusKm,
    decimal DeliveryFee,
    decimal DeliveryMinimumOrder,
    bool RequireSignInForDelivery);

// --- Notification ------------------------------------------------------------

public sealed record AnnouncementView(int Id, string? Title, string? Body, string? SentBy, DateTime SentAt, int RecipientCount);
