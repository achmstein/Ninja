namespace Chillax.Payroll.Domain.Exceptions;

/// <summary>
/// Exception thrown when a domain rule is violated
/// </summary>
public class PayrollDomainException : Exception
{
    public PayrollDomainException()
    { }

    public PayrollDomainException(string message)
        : base(message)
    { }

    public PayrollDomainException(string message, Exception innerException)
        : base(message, innerException)
    { }
}

