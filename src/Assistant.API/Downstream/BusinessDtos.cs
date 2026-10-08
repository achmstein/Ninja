namespace Ninja.Assistant.API.Downstream;

// Mirrors of the set-up and day-to-day contracts the business write tools
// use: Finance's categories, suppliers and recurring bills, Payroll's people
// and attendance, Spaces' places, Tenant's branch, Sales' pricing and
// Notification's announcements. Enums travel as the services' numbers.

// --- Finance -----------------------------------------------------------------

/// <summary>Finance's CategoryRequest: no id adds a category, an id edits one.</summary>
public sealed record CategoryRequest(int? Id, LocalizedText Name, int DisplayOrder, bool? IsActive = null);

/// <summary>A supplier as Finance lists them, with what they were saved with, so an edit keeps what it does not change.</summary>
public sealed record SupplierDetails(int Id, string? Name, string? Phone, string? Notes, bool IsActive, decimal Balance)
{
    /// <summary>Suppliers have one name; it goes through <see cref="Context.NameResolver"/> as the English side.</summary>
    public LocalizedText Named => new(Name, null);
}

public sealed record SupplierRequest(int? Id, string Name, string? Phone, string? Notes, bool? IsActive = null);

/// <summary>Finance's SupplierEntryRequest; Type is the numeric enum (Invoice 0, Payment 1, Credit 2).</summary>
public sealed record SupplierEntryRequest(int Type, decimal Amount, DateOnly Date, string? Note);

public sealed record RecurringExpenseView(
    int Id,
    int BranchId,
    int CategoryId,
    LocalizedText? CategoryName,
    decimal Amount,
    int DayOfMonth,
    int PaidFrom,
    int? PartnerId,
    string? PartnerName,
    string? Vendor,
    string? Note,
    bool IsActive);

/// <summary>Finance's RecurringExpenseRequest; PaidFrom as in <see cref="ExpenseRequest"/>.</summary>
public sealed record RecurringExpenseRequest(int? Id, int CategoryId, decimal Amount, int DayOfMonth, int PaidFrom, int? PartnerId, string? Vendor, string? Note, bool? IsActive = null);

// --- Payroll -----------------------------------------------------------------

/// <summary>An employee as Payroll lists them; the pay terms are left out on purpose, the assistant never changes them after the hire.</summary>
public sealed record EmployeeDetails(
    int Id,
    string? Name,
    string? JobTitle,
    string? Phone,
    int BranchId,
    string? UserId,
    DateOnly StartedOn,
    DateOnly? EndedOn,
    bool IsActive,
    int PaidDaysOff)
{
    public LocalizedText Named => new(Name, null);
}

/// <summary>Payroll's HireEmployeeRequest; Scheme is the numeric enum (Daily 0, Monthly 1).</summary>
public sealed record HireEmployeeRequest(string Name, string? JobTitle, string? Phone, int BranchId, string? UserId, DateOnly StartedOn, int Scheme, decimal Rate, int? PaidDaysOff = null);

public sealed record UpdateEmployeeRequest(string Name, string? JobTitle, string? Phone, int BranchId, string? UserId, int? PaidDaysOff = null);

/// <summary>One cell of the attendance grid; Status is the numeric enum (Present 0, HalfDay 1, Absent 2, DayOff 3). A null status clears the day, which the assistant never sends.</summary>
public sealed record AttendanceMark(int EmployeeId, int? Status, string? Note = null, decimal? OvertimeHours = null);

public sealed record MarkAttendanceRequest(List<AttendanceMark> Marks);

// --- Spaces ------------------------------------------------------------------

public sealed record RateOptionDto(string Code, LocalizedText Name, decimal HourlyRate);

public sealed record TariffDto(List<RateOptionDto> Options, int RoundingMinutes = 15);

/// <summary>A place as Spaces lists it; Kind is the numeric enum (Room 1, Table 2, Station 3).</summary>
public sealed record PlaceDto(int Id, int Kind, LocalizedText? Name, LocalizedText? Description, int BranchId, bool IsActive, TariffDto? Tariff, bool IsTimed, bool Reservable);

public sealed record CreatePlaceRequest(int Kind, LocalizedText Name, LocalizedText? Description = null, TariffDto? Tariff = null, bool? Reservable = null);

public sealed record UpdatePlaceRequest(LocalizedText Name, LocalizedText? Description = null);

/// <summary>A null tariff takes the clock off: the place only takes orders.</summary>
public sealed record SetPlaceTariffRequest(TariffDto? Tariff);

public sealed record SetPlaceReservableRequest(bool Reservable);

public sealed record SetPlaceActiveRequest(bool IsActive);

// --- Tenant ------------------------------------------------------------------

/// <summary>A branch with everything its edit form saves, so a change to one field keeps the rest.</summary>
public sealed record BranchDetails(
    int Id,
    LocalizedText? Name,
    LocalizedText? Address,
    string? Phone,
    string? TaxNumber,
    LocalizedText? ReceiptFooter,
    bool IsActive,
    int DisplayOrder,
    string? DayStartTime,
    bool IsOrderingEnabled,
    bool IsReservationsEnabled,
    bool IsDeliveryEnabled,
    decimal? DeliveryRadiusKm,
    decimal DeliveryFee,
    decimal DeliveryMinimumOrder);

/// <summary>
/// Tenant's UpdateBranchRequest. The name, address, phone, tax number, footer,
/// active flag and order are always written; the rest leave what is there
/// when null.
/// </summary>
public sealed record UpdateBranchRequest(
    LocalizedText Name,
    LocalizedText? Address,
    string? Phone,
    bool IsActive,
    int DisplayOrder,
    string? TaxNumber = null,
    LocalizedText? ReceiptFooter = null,
    string? DayStartTime = null,
    bool? IsOrderingEnabled = null,
    bool? IsReservationsEnabled = null,
    bool? RequireSignInForTableOrders = null,
    string? Location = null,
    bool? IsDeliveryEnabled = null,
    decimal? DeliveryRadiusKm = null,
    decimal? DeliveryFee = null,
    decimal? DeliveryMinimumOrder = null,
    bool? RequireSignInForDelivery = null);

// --- Sales -------------------------------------------------------------------

/// <summary>A branch's pricing; rates are fractions (0.14 is 14%).</summary>
public sealed record PricingView(int BranchId, decimal VatRate, bool PricesIncludeVat, decimal ServiceChargeRate, decimal MaxCashierDiscountRate);

public sealed record PricingRequest(decimal VatRate, bool PricesIncludeVat, decimal ServiceChargeRate, decimal MaxCashierDiscountRate);

// --- Notification ------------------------------------------------------------

public sealed record SendAnnouncementRequest(string Title, string Body);

public sealed record AnnouncementResponse(int Id, string? Title, string? Body, string? SentBy, DateTime SentAt, int RecipientCount);
