#nullable enable
namespace Ninja.Ordering.Domain.Exceptions;

/// <summary>
/// Exception type for domain exceptions. <see cref="Code"/>, when set, is
/// the stable name of the rule that was broken ("delivery.already_out"):
/// the API answers with it and the apps say it in their own language.
/// </summary>
public class OrderingDomainException : Exception
{
    public OrderingDomainException()
    { }

    public OrderingDomainException(string message)
        : base(message)
    { }

    public OrderingDomainException(string message, string code)
        : base(message)
    {
        Code = code;
    }

    public OrderingDomainException(string message, Exception innerException)
        : base(message, innerException)
    { }

    public OrderingDomainException(string message, string code, Exception innerException)
        : base(message, innerException)
    {
        Code = code;
    }

    /// <summary>The rule broken, as the API and the apps name it; null for one with no name of its own.</summary>
    public string? Code { get; }
}
