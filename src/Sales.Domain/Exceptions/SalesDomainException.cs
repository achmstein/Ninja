namespace Ninja.Sales.Domain.Exceptions;

/// <summary>
/// Exception thrown when a domain rule is violated
/// </summary>
public class SalesDomainException : Exception
{
    public SalesDomainException()
    { }

    public SalesDomainException(string message)
        : base(message)
    { }

    public SalesDomainException(string message, Exception innerException)
        : base(message, innerException)
    { }
}

