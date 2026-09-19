namespace Ninja.Accounts.API.Application.Queries;

public class AccountViewModel
{
    public int Id { get; set; }
    public string CustomerId { get; set; } = string.Empty;
    public string? CustomerName { get; set; }
    public decimal Balance { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<TransactionViewModel> Transactions { get; set; } = new();
}

public class TransactionViewModel
{
    public int Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? Description { get; set; }
    /// <summary>manual, posReceipt, posCreditNote or posTabPayment.</summary>
    public string Source { get; set; } = "manual";
    /// <summary>The till's receipt, credit note or tab payment number when the source is the till.</summary>
    public int? SourceNumber { get; set; }
    /// <summary>The Sales ticket a receipt charge settled — what the customer's receipt page is keyed by. Null for every other source.</summary>
    public int? TicketId { get; set; }
    public string RecordedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class AccountSummaryViewModel
{
    public int Id { get; set; }
    public string CustomerId { get; set; } = string.Empty;
    public string? CustomerName { get; set; }
    public decimal Balance { get; set; }
    public DateTime UpdatedAt { get; set; }
}
