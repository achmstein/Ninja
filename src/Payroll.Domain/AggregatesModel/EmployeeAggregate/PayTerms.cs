#nullable enable
namespace Ninja.Payroll.Domain.AggregatesModel.EmployeeAggregate;

/// <summary>
/// What an employee earns from a given day: the rate per day worked, or the
/// salary per month. Kept as dated history on the employee so a raise never
/// rewrites an earlier period's pay.
/// </summary>
public class PayTerms : Entity
{
    public DateOnly EffectiveFrom { get; private set; }

    public PayScheme Scheme { get; private set; }

    /// <summary>Per day worked (Daily) or per month (Monthly).</summary>
    public decimal Rate { get; private set; }

    protected PayTerms() { }

    public PayTerms(PayScheme scheme, decimal rate, DateOnly effectiveFrom)
    {
        if (rate <= 0)
            throw new PayrollDomainException("Pay must be a positive amount.");

        Scheme = scheme;
        Rate = rate;
        EffectiveFrom = effectiveFrom;
    }
}
