namespace Ninja.Inventory.Domain.Exceptions;

/// <summary>
/// Exception thrown when a domain rule is violated
/// </summary>
public class InventoryDomainException : Exception
{
    public InventoryDomainException()
    { }

    public InventoryDomainException(string message)
        : base(message)
    { }

    public InventoryDomainException(string message, Exception innerException)
        : base(message, innerException)
    { }
}

