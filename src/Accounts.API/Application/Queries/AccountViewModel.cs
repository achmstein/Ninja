namespace Chillax.Accounts.API.Application.Queries;

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
    /// <summary>manual, posReceipt or posCreditNote.</summary>
    public string Source { get; set; } = "manual";
    /// <summary>The till's receipt or credit note number when the source is the till.</summary>
    public int? SourceNumber { get; set; }
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
