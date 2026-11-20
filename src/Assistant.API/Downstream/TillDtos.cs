using System.Text.Json.Serialization;

namespace Ninja.Assistant.API.Downstream;

// --- Identity: the customer directory ----------------------------------------

/// <summary>An account as Identity's directory lists it (UserDto).</summary>
public sealed record DirectoryUserView(
    string Id,
    string? Username,
    string? Email,
    string? FirstName,
    string? LastName,
    bool Enabled,
    long? CreatedTimestamp,
    List<string>? RealmRoles,
    string? PhoneNumber,
    bool AddedAtCounter = false)
{
    public string Name => string.Join(' ', new[] { FirstName, LastName }.Where(s => !string.IsNullOrWhiteSpace(s))) is { Length: > 0 } full ? full : Username ?? "";
}

// --- Sales: an open bill with who is on it -----------------------------------

/// <summary>Sales' TicketSummary: an open bill, its place or session, and the accounts on its lines.</summary>
public sealed record OpenBillView(
    int Id,
    string? Type,
    LocalizedText? LocationName,
    int? SessionId,
    int? PlaceId,
    string? PlaceKind,
    string? Label,
    DateTime OpenedAt,
    int LineCount,
    decimal Total,
    List<string>? CustomerIds)
{
    /// <summary>"Room 2", "Table 4", or a counter tab's name.</summary>
    public string Where => LocationName?.Both ?? (string.IsNullOrWhiteSpace(Label) ? $"counter bill {Id}" : $"counter bill \"{Label}\"");
}

// --- Spaces: a running stay with its party -----------------------------------

public sealed record StayMemberView(string CustomerId, string? CustomerName, string? Role);

/// <summary>Spaces' StayViewModel, the part the till tools read.</summary>
public sealed record RunningStayView(
    int Id,
    int PlaceId,
    PlaceKind PlaceKind,
    LocalizedText? PlaceName,
    string? CustomerId,
    string? CustomerName,
    DateTime StartedAt,
    int? TicketId,
    StayStatus Status,
    List<StayMemberView>? Members)
{
    public bool Has(string customerId) => CustomerId == customerId || (Members ?? []).Any(m => m.CustomerId == customerId);
}

/// <summary>Spaces' Assign/AddMember request.</summary>
public sealed record StayCustomerRequest(string CustomerId, string? CustomerName);

// --- Catalog: pricing a cart at a branch -------------------------------------

public sealed record PriceCheckLine(int ItemId, List<int>? OptionIds, decimal UnitPrice);

public sealed record PriceCheckRequest(int BranchId, List<PriceCheckLine> Lines);

public sealed record PriceCheckResult(int ItemId, decimal Price, decimal BasePrice, bool Available, bool OutOfStock, List<int>? SoldOutOptionIds);

public sealed record PriceCheckResponse(int BranchId, List<PriceCheckResult>? Lines);

// --- Ordering: a till order --------------------------------------------------

public sealed record BasketCustomization(int CustomizationId, LocalizedText CustomizationName, int OptionId, LocalizedText OptionName, decimal PriceAdjustment);

/// <summary>Ordering's BasketItem: the line's price is UnitPrice plus its options' adjustments.</summary>
public sealed record BasketLine(
    string Id,
    int ProductId,
    LocalizedText ProductName,
    decimal UnitPrice,
    int Quantity,
    string? SpecialInstructions,
    List<BasketCustomization> SelectedCustomizations);

/// <summary>Ordering's PosOrderRequest, the fields a till order from chat sets.</summary>
public sealed record PosOrderRequest(
    List<BasketLine> Items,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? CustomerNote = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? CustomerUserId = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? CustomerUserName = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? TicketId = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? CustomerName = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? PlaceId = null);

public sealed record PosOrderResponse(int OrderId);

// --- A customer's details ----------------------------------------------------

public sealed record TabTransactionView(string? Type, decimal Amount, string? Description, string? Source, int? SourceNumber, DateTime CreatedAt);

/// <summary>Accounts' AccountViewModel: the tab, positive when the customer owes.</summary>
public sealed record CustomerTabView(string? CustomerId, decimal Balance, DateTime UpdatedAt, List<TabTransactionView>? Transactions);
