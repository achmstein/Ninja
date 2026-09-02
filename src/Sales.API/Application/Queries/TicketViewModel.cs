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
    public string? CustomerName { get; init; }
    public DateTime OpenedAt { get; init; }
    /// <summary>When the last line landed — the floor shows this as idle time.</summary>
    public DateTime LastActivityAt { get; init; }
    public int LineCount { get; init; }
    public decimal Total { get; init; }
}

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
    public string? CustomerId { get; init; }
    public string? CustomerName { get; init; }
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
}

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
}

public record PaymentView
{
    public string Tender { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public string RecordedBy { get; init; } = string.Empty;
    public DateTime RecordedAt { get; init; }
}
