#nullable enable
namespace Ninja.Payroll.Domain.AggregatesModel.EmployeeAggregate;

/// <summary>
/// Someone who works at the café. Its own record with its own name: a login
/// is optional (<see cref="UserId"/>), because a runner or a cleaner never
/// touches a screen. Leaving is an end date, never a delete — the ledger and
/// old payslips stay under the name they were issued to.
/// </summary>
public class Employee : Entity, IAggregateRoot
{
    public string Name { get; private set; } = string.Empty;

    public string? JobTitle { get; private set; }

    public string? Phone { get; private set; }

    /// <summary>Home branch: where the person is listed for attendance and payslips.</summary>
    public int BranchId { get; private set; }

    /// <summary>The Keycloak subject, for the ones who also sign in. Unique when set.</summary>
    public string? UserId { get; private set; }

    public DateOnly StartedOn { get; private set; }

    public DateOnly? EndedOn { get; private set; }

    /// <summary>
    /// Days off a month the person is paid for (one a week by default). A
    /// daily worker's agreed day off within it is paid like a worked day;
    /// a monthly employee's days off and absences beyond it cost a day's
    /// pay each. 0 means no paid rest; 31 means absence never costs.
    /// </summary>
    public int PaidDaysOff { get; private set; } = DefaultPaidDaysOff;

    public const int DefaultPaidDaysOff = 4;

    public bool IsActive => EndedOn is null;

    private readonly List<PayTerms> _terms = new();
    public IReadOnlyCollection<PayTerms> Terms => _terms.AsReadOnly();

    protected Employee() { }

    public static Employee Hire(
        string name, string? jobTitle, string? phone, int branchId, string? userId,
        DateOnly startedOn, PayScheme scheme, decimal rate, int paidDaysOff = DefaultPaidDaysOff)
    {
        var employee = new Employee { StartedOn = startedOn };
        employee.Update(name, jobTitle, phone, branchId, userId, paidDaysOff);
        employee.SetPayTerms(scheme, rate, startedOn);
        return employee;
    }

    public void Update(string name, string? jobTitle, string? phone, int branchId, string? userId, int paidDaysOff = DefaultPaidDaysOff)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new PayrollDomainException("An employee needs a name.");

        if (branchId <= 0)
            throw new PayrollDomainException("An employee needs a home branch.");

        if (paidDaysOff is < 0 or > 31)
            throw new PayrollDomainException("Paid days off must be between 0 and 31 a month.");

        Name = name.Trim();
        JobTitle = string.IsNullOrWhiteSpace(jobTitle) ? null : jobTitle.Trim();
        Phone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();
        BranchId = branchId;
        UserId = string.IsNullOrWhiteSpace(userId) ? null : userId.Trim();
        PaidDaysOff = paidDaysOff;
    }

    /// <summary>
    /// New terms from a date; terms already starting that day are replaced,
    /// so a typo is corrected in place rather than stacked.
    /// </summary>
    public void SetPayTerms(PayScheme scheme, decimal rate, DateOnly effectiveFrom)
    {
        _terms.RemoveAll(t => t.EffectiveFrom == effectiveFrom);
        _terms.Add(new PayTerms(scheme, rate, effectiveFrom));
        _terms.Sort((a, b) => a.EffectiveFrom.CompareTo(b.EffectiveFrom));
    }

    /// <summary>The terms in force on a day: the latest that had started by then.</summary>
    public PayTerms? TermsOn(DateOnly date)
        => _terms.Where(t => t.EffectiveFrom <= date).MaxBy(t => t.EffectiveFrom);

    /// <summary>The terms in force today, for lists.</summary>
    public PayTerms? CurrentTerms => TermsOn(DateOnly.FromDateTime(DateTime.UtcNow));

    public void Leave(DateOnly endedOn)
    {
        if (endedOn < StartedOn)
            throw new PayrollDomainException("Someone cannot leave before they started.");

        EndedOn = endedOn;
    }

    public void Rehire(DateOnly startedOn)
    {
        StartedOn = startedOn;
        EndedOn = null;
    }

    /// <summary>Whether the person was employed on a day, for attendance and proration.</summary>
    public bool EmployedOn(DateOnly date)
        => date >= StartedOn && (EndedOn is null || date <= EndedOn);

    /// <summary>How many days of a period the person was employed for.</summary>
    public int DaysEmployed(DateOnly start, DateOnly end)
    {
        var from = start > StartedOn ? start : StartedOn;
        var to = EndedOn is { } ended && ended < end ? ended : end;
        return to < from ? 0 : to.DayNumber - from.DayNumber + 1;
    }
}
