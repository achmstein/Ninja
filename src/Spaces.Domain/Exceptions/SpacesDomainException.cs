namespace Ninja.Spaces.Domain.Exceptions;

/// <summary>
/// Exception thrown when a domain rule is violated
/// </summary>
public class SpacesDomainException : Exception
{
    public SpacesDomainException()
    { }

    public SpacesDomainException(string message)
        : base(message)
    { }

    public SpacesDomainException(string message, Exception innerException)
        : base(message, innerException)
    { }
}
