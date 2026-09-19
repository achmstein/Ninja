#nullable enable
using Ninja.Finance.Domain.AggregatesModel.ExpenseAggregate;

namespace Ninja.Finance.Domain.AggregatesModel.PartnerAggregate;

/// <summary>
/// An owner. Two at one branch, one at another: the branches they hold
/// are listed on them with their share of each, and their account is per
/// branch. Money they take or put in is theirs, never the café's cost or
/// income; their share only says how a month's profit is theirs to read.
/// </summary>
public class Partner : Entity, IAggregateRoot
{
    public string Name { get; private set; } = string.Empty;

    public string? Phone { get; private set; }

    /// <summary>Their login, if they have one.</summary>
    public string? UserId { get; private set; }

    private readonly List<PartnerShare> _shares = new();
    public IReadOnlyCollection<PartnerShare> Shares => _shares.AsReadOnly();

    /// <summary>The branches this partner holds a share of.</summary>
    public IEnumerable<int> BranchIds => _shares.Select(s => s.BranchId);

    public bool IsActive { get; private set; } = true;

    protected Partner() { }

    public Partner(string name, string? phone, string? userId, IEnumerable<(int BranchId, decimal Percent)> shares)
    {
        Update(name, phone, userId, shares, true);
    }

    public void Update(string name, string? phone, string? userId, IEnumerable<(int BranchId, decimal Percent)> shares, bool isActive)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new FinanceDomainException("A partner needs a name.");

        var list = shares
            .Where(s => s.BranchId > 0)
            .GroupBy(s => s.BranchId)
            .Select(g => new PartnerShare(g.Key, g.Last().Percent))
            .OrderBy(s => s.BranchId)
            .ToList();

        if (list.Count == 0)
            throw new FinanceDomainException("A partner needs at least one branch.");

        Name = name.Trim();
        Phone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();
        UserId = string.IsNullOrWhiteSpace(userId) ? null : userId.Trim();
        _shares.Clear();
        _shares.AddRange(list);
        IsActive = isActive;
    }

    public bool Owns(int branchId) => _shares.Any(s => s.BranchId == branchId);

    /// <summary>The partner's share of a branch's profit, as a percentage; 0 where they hold none.</summary>
    public decimal ShareAt(int branchId) => _shares.FirstOrDefault(s => s.BranchId == branchId)?.Percent ?? 0m;
}

/// <summary>A partner's share of one branch, in percent.</summary>
public class PartnerShare : Entity
{
    public int BranchId { get; private set; }

    public decimal Percent { get; private set; }

    protected PartnerShare() { }

    public PartnerShare(int branchId, decimal percent)
    {
        if (branchId <= 0)
            throw new FinanceDomainException("A share needs the branch.");

        if (percent is < 0 or > 100)
            throw new FinanceDomainException("A share is between 0 and 100 percent.");

        BranchId = branchId;
        Percent = percent;
    }
}

/// <summary>A drawing is money taken out; a contribution is money put in (or an expense paid from their own pocket).</summary>
public enum PartnerEntryType
{
    Drawing = 0,
    Contribution = 1,
}

public class PartnerEntry : Entity, IAggregateRoot
{
    public int PartnerId { get; private set; }

    public int BranchId { get; private set; }

    public PartnerEntryType Type { get; private set; }

    /// <summary>Always positive; the type says which way it goes.</summary>
    public decimal Amount { get; private set; }

    public DateOnly Date { get; private set; }

    public string? Note { get; private set; }

    /// <summary>What produced it (shift:{id}:movement:{id}, expense:{id}); unique, so nothing posts twice.</summary>
    public string? Reference { get; private set; }

    public FinanceSource Source { get; private set; }

    public string RecordedBy { get; private set; } = string.Empty;

    public DateTime RecordedAt { get; private set; }

    protected PartnerEntry() { }

    public PartnerEntry(int partnerId, int branchId, PartnerEntryType type, decimal amount, DateOnly date, string? note, string recordedBy,
        FinanceSource source = FinanceSource.Manual, string? reference = null)
    {
        if (partnerId <= 0)
            throw new FinanceDomainException("A partner line needs the partner.");

        if (branchId <= 0)
            throw new FinanceDomainException("A partner line needs the branch.");

        if (amount <= 0)
            throw new FinanceDomainException("A partner line needs a positive amount.");

        PartnerId = partnerId;
        BranchId = branchId;
        Type = type;
        Amount = amount;
        Date = date;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        Reference = reference;
        Source = source;
        RecordedBy = recordedBy;
        RecordedAt = DateTime.UtcNow;
    }

    /// <summary>The line's effect on what the café holds of theirs: a contribution raises it, a drawing lowers it.</summary>
    public decimal Signed => Type == PartnerEntryType.Contribution ? Amount : -Amount;
}

public interface IPartnerRepository : IRepository<Partner>
{
    Partner Add(Partner partner);

    Task<Partner?> GetAsync(int id);

    Task<List<Partner>> GetAllAsync();

    PartnerEntry AddEntry(PartnerEntry entry);

    Task<PartnerEntry?> FindEntryByReferenceAsync(string reference);
}
