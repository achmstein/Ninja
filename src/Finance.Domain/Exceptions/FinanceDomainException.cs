namespace Chillax.Finance.Domain.Exceptions;

/// <summary>
/// Exception thrown when a domain rule is violated
/// </summary>
public class FinanceDomainException : Exception
{
    public FinanceDomainException()
    { }

    public FinanceDomainException(string message)
        : base(message)
    { }

    public FinanceDomainException(string message, Exception innerException)
        : base(message, innerException)
    { }
}

