#nullable enable
namespace Ninja.Finance.Domain.AggregatesModel.ExpenseAggregate;

/// <summary>
/// The photo (or PDF) of the bill behind an expense, kept with the
/// expense so the month can be audited from the page. One per expense;
/// uploading again replaces it.
/// </summary>
public class ExpenseReceipt
{
    public int ExpenseId { get; private set; }

    public string ContentType { get; private set; } = string.Empty;

    public string FileName { get; private set; } = string.Empty;

    public byte[] Data { get; private set; } = [];

    public DateTime UploadedAt { get; private set; }

    public string UploadedBy { get; private set; } = string.Empty;

    protected ExpenseReceipt() { }

    public ExpenseReceipt(int expenseId, string contentType, string fileName, byte[] data, string uploadedBy)
    {
        if (expenseId <= 0)
            throw new FinanceDomainException("A receipt needs the expense it belongs to.");

        ExpenseId = expenseId;
        Replace(contentType, fileName, data, uploadedBy);
    }

    public void Replace(string contentType, string fileName, byte[] data, string uploadedBy)
    {
        if (data.Length == 0)
            throw new FinanceDomainException("The receipt file is empty.");

        if (data.Length > MaxBytes)
            throw new FinanceDomainException("The receipt file is too large; 5 MB at most.");

        if (!Allowed.Contains(contentType))
            throw new FinanceDomainException("A receipt is a photo (JPEG, PNG, WebP) or a PDF.");

        ContentType = contentType;
        FileName = string.IsNullOrWhiteSpace(fileName) ? "receipt" : fileName.Trim();
        Data = data;
        UploadedAt = DateTime.UtcNow;
        UploadedBy = uploadedBy;
    }

    public const int MaxBytes = 5 * 1024 * 1024;

    public static readonly IReadOnlySet<string> Allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp", "application/pdf",
    };
}
