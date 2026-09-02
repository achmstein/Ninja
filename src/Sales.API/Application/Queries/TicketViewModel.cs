#nullable enable
namespace Chillax.Sales.API.Application.Queries;

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
    public int? RoomId { get; init; }
    public int? TableId { get; init; }

    /// <summary>What the bill is called: a counter tab's name, a room's session owner. Not a customer.</summary>
    public string? Label { get; init; }

    public DateTime OpenedAt { get; init; }
    /// <summary>When the last line landed — the floor shows this as idle time.</summary>
    public DateTime LastActivityAt { get; init; }
    public int LineCount { get; init; }
    public decimal Total { get; init; }
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
    decimal RefundedTotal);

public record TicketDetail
{
    public int Id { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public int BranchId { get; init; }
    public LocalizedText? LocationName { get; init; }
    public int? SessionId { get; init; }
    public int? RoomId { get; init; }
    public int? TableId { get; init; }
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

    /// <summary>Menu money — the lines before service charge and VAT.</summary>
    public decimal Subtotal { get; init; }
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

/// <summary>A branch's pricing rules; rates are fractions (0.14 is 14%).</summary>
public record PricingView(int BranchId, decimal VatRate, bool PricesIncludeVat, decimal ServiceChargeRate);

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
