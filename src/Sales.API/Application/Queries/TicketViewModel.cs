#nullable enable
namespace Ninja.Sales.API.Application.Queries;

/// <summary>
/// A ticket as the POS floor lists it.
/// </summary>
public record TicketSummary
{
    public int Id { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public LocalizedText? LocationName { get; init; }
    public int? SessionId { get; init; }
    /// <summary>The Spaces place the bill is for; null on a counter sale.</summary>
    public int? PlaceId { get; init; }
    /// <summary>"Room", "Table" or "Station".</summary>
    public string? PlaceKind { get; init; }

    /// <summary>What the bill is called: a counter tab's name, a room's session owner. Not a customer.</summary>
    public string? Label { get; init; }

    public DateTime OpenedAt { get; init; }
    /// <summary>When the last line landed — the floor shows this as idle time.</summary>
    public DateTime LastActivityAt { get; init; }
    public int LineCount { get; init; }
    public decimal Total { get; init; }

    /// <summary>
    /// The accounts already on this bill's lines, each once. The till uses
    /// the union across open bills to keep one person from ending up with
    /// two tabs at the same time.
    /// </summary>
    public IReadOnlyCollection<string> CustomerIds { get; init; } = [];
}

/// <summary>A settled bill as the receipts screen lists it.</summary>
public record SettledTicketSummary(
    int Id,
    int ReceiptNumber,
    string Type,
    LocalizedText? LocationName,
    string? Label,
    DateTime SettledAt,
    decimal Total,
    decimal RefundedTotal,
    string? ProvisionalReceiptNumber = null);

public record TicketDetail
{
    public int Id { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public int BranchId { get; init; }
    public LocalizedText? LocationName { get; init; }
    public int? SessionId { get; init; }
    /// <summary>When the room session ended (time landed or was cancelled). Null while it runs or for non-room tickets — an empty room ticket is discardable only once this is set.</summary>
    public DateTime? SessionEndedAt { get; init; }
    public int? PlaceId { get; init; }
    public string? PlaceKind { get; init; }
    /// <summary>What the bill is called: a counter tab's name, a room's session owner. Not a customer.</summary>
    public string? Label { get; init; }
    public string? GuestPhone { get; init; }
    public DateTime OpenedAt { get; init; }
    public DateTime LastActivityAt { get; init; }
    public DateTime? SettledAt { get; init; }
    public string? SettledBy { get; init; }
    public int? ShiftId { get; init; }
    public decimal ChangeGiven { get; init; }
    public DateTime? VoidedAt { get; init; }
    public string? VoidedBy { get; init; }
    public string? VoidReason { get; init; }
    public List<TicketLineView> Lines { get; init; } = [];
    public List<PaymentView> Payments { get; init; } = [];
    public decimal Total { get; init; }
    /// <summary>Set once settled.</summary>
    public int? ReceiptNumber { get; init; }

    /// <summary>What the till printed while offline, when the sale was replayed.</summary>
    public string? ProvisionalReceiptNumber { get; init; }

    /// <summary>Menu money — the lines before the bill discount, service charge and VAT.</summary>
    public decimal Subtotal { get; init; }
    /// <summary>The bill discount as money; zero when none.</summary>
    public decimal Discount { get; init; }
    /// <summary>The rate behind it as a fraction; null for a fixed amount or none.</summary>
    public decimal? DiscountRate { get; init; }
    public string? DiscountReason { get; init; }
    public string? DiscountBy { get; init; }
    public decimal ServiceCharge { get; init; }
    public decimal Vat { get; init; }
    /// <summary>The VAT sits inside the menu prices: shown on the receipt, not added to it.</summary>
    public bool VatIncluded { get; init; }
    public decimal VatRate { get; init; }
    public decimal ServiceChargeRate { get; init; }

    /// <summary>Credit notes issued against this ticket, oldest first.</summary>
    public List<RefundView> Refunds { get; init; } = [];
    public decimal RefundedTotal { get; init; }
}

/// <summary>A credit note as the ticket screen lists it.</summary>
/// <summary>
/// A settled bill as the customer who was on it may read it: the receipt the
/// till printed, without the till's own fields (who rang it up, the shift,
/// the audit trail).
/// </summary>
/// <summary>
/// A bill as the customer sees it — the till's arithmetic, none of the
/// till's names: who added a line, who settled, who discounted stay on the
/// staff side. One per ticket the customer is on, open or settled.
/// </summary>
public record BillView
{
    public int Id { get; init; }
    /// <summary>"Room" or "Cafe".</summary>
    public string Type { get; init; } = string.Empty;
    /// <summary>"Open", "Settled" or "Voided".</summary>
    public string Status { get; init; } = string.Empty;
    public int BranchId { get; init; }
    public int? PlaceId { get; init; }
    public string? PlaceKind { get; init; }
    public LocalizedText? LocationName { get; init; }
    /// <summary>The stay this bill charges the time of, when it is a room's.</summary>
    public int? SessionId { get; init; }
    /// <summary>Set once the clock stopped and its time landed as a line; null while it runs.</summary>
    public DateTime? SessionEndedAt { get; init; }
    public DateTime OpenedAt { get; init; }
    public DateTime LastActivityAt { get; init; }
    public DateTime? SettledAt { get; init; }
    public DateTime? VoidedAt { get; init; }
    public int? ReceiptNumber { get; init; }
    /// <summary>"Cash", "Card", "InstaPay", "Account" or "Mixed" once settled.</summary>
    public string? PaidWith { get; init; }
    public List<BillLineView> Lines { get; init; } = [];
    public decimal Subtotal { get; init; }
    public decimal Discount { get; init; }
    public decimal? DiscountRate { get; init; }
    public decimal ServiceCharge { get; init; }
    public decimal ServiceChargeRate { get; init; }
    public decimal Vat { get; init; }
    public decimal VatRate { get; init; }
    public bool VatIncluded { get; init; }
    public decimal Total { get; init; }
    public decimal RefundedTotal { get; init; }
}

public record BillLineView
{
    public int Id { get; init; }
    /// <summary>"Order", "SessionTime" or "Manual".</summary>
    public string Source { get; init; } = string.Empty;
    public int? OrderId { get; init; }
    public LocalizedText Description { get; init; } = new();
    public LocalizedText? Details { get; init; }
    public decimal Qty { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal Discount { get; init; }
    public decimal Total { get; init; }
    /// <summary>Who the line is for, by the name they gave; null for the place's own lines.</summary>
    public string? CustomerName { get; init; }
    /// <summary>The caller's own line: ordered by them, or their guest device.</summary>
    public bool IsMine { get; init; }
}

public record ReceiptView(
    int TicketId,
    int ReceiptNumber,
    int BranchId,
    string Type,
    LocalizedText? LocationName,
    DateTime SettledAt,
    List<ReceiptLineView> Lines,
    decimal Subtotal,
    decimal Discount,
    decimal? DiscountRate,
    decimal ServiceCharge,
    decimal ServiceChargeRate,
    decimal Vat,
    decimal VatRate,
    bool VatIncluded,
    decimal Total,
    decimal ChangeGiven,
    List<ReceiptPaymentView> Payments,
    List<ReceiptRefundView> Refunds,
    decimal RefundedTotal);

public record ReceiptLineView(
    LocalizedText Description,
    LocalizedText? Details,
    decimal Qty,
    decimal UnitPrice,
    decimal Discount,
    decimal Total,
    string? CustomerName);

public record ReceiptPaymentView(string Tender, decimal Amount, string? CustomerName);

public record ReceiptRefundView(int Number, decimal Amount, string Reason, string Tender, DateTime RefundedAt);

public record RefundView(
    int Id,
    int Number,
    decimal Amount,
    string Reason,
    string Tender,
    string? CustomerName,
    string RefundedBy,
    DateTime RefundedAt,
    List<RefundLineView> Lines);

public record RefundLineView(int TicketLineId, LocalizedText Description, decimal Qty, decimal Amount);

/// <summary>A branch's pricing rules; rates are fractions (0.14 is 14%). MaxCashierDiscountRate caps what a cashier may take off a bill alone.</summary>
public record PricingView(int BranchId, decimal VatRate, bool PricesIncludeVat, decimal ServiceChargeRate, decimal MaxCashierDiscountRate);

public record TicketLineView
{
    public int Id { get; init; }
    public string Source { get; init; } = string.Empty;
    public int? OrderId { get; init; }
    public LocalizedText Description { get; init; } = new();
    public LocalizedText? Details { get; init; }
    public decimal Qty { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal Discount { get; init; }
    public decimal Total { get; init; }
    public string? AddedBy { get; init; }

    /// <summary>Whose items these are on a shared bill; null when unattributed.</summary>
    public string? CustomerName { get; init; }

    /// <summary>
    /// The account behind that name, when the customer was attached rather
    /// than just named. Settle offers a tab only for these.
    /// </summary>
    public string? CustomerId { get; init; }

    /// <summary>
    /// The guest id behind the name when there is no account — the key that
    /// groups one guest's lines together. Never a tab to charge.
    /// </summary>
    public string? GuestId { get; init; }
}

public record PaymentView
{
    public string Tender { get; init; } = string.Empty;
    public decimal Amount { get; init; }

    /// <summary>Whose tab an account payment charged.</summary>
    public string? CustomerName { get; init; }
    /// <summary>The account behind that name — the tab a refund can go back onto.</summary>
    public string? CustomerId { get; init; }
    public string RecordedBy { get; init; } = string.Empty;
    public DateTime RecordedAt { get; init; }
}

/// <summary>One page of a back-office listing, with the count behind it.</summary>
public record PagedResult<T>(List<T> Items, int TotalCount, int PageIndex, int PageSize);

/// <summary>
/// A closed ticket — settled or voided — as the back office lists it.
/// <see cref="ClosedAt"/> and <see cref="ClosedBy"/> are the settle or the
/// void, whichever ended it.
/// </summary>
public record TicketHistoryRow(
    int Id,
    int? ReceiptNumber,
    string Status,
    string Type,
    LocalizedText? LocationName,
    string? Label,
    DateTime ClosedAt,
    string? ClosedBy,
    decimal Total,
    decimal RefundedTotal);

/// <summary>One payment taken on a settled ticket, with the bill it paid.</summary>
public record PaymentRow(
    int TicketId,
    int? ReceiptNumber,
    string Type,
    LocalizedText? LocationName,
    string? Label,
    string Tender,
    decimal Amount,
    string? CustomerId,
    string? CustomerName,
    string RecordedBy,
    DateTime RecordedAt,
    DateTime SettledAt);

/// <summary>A credit note as the back office lists it — the ticket screen has the lines.</summary>
public record RefundSummary(
    int Id,
    int Number,
    int TicketId,
    int ReceiptNumber,
    decimal Amount,
    string Tender,
    string Reason,
    string? CustomerName,
    string RefundedBy,
    DateTime RefundedAt,
    int? ShiftId,
    int LineCount);
