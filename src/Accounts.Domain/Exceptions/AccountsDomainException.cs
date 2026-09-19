namespace Ninja.Accounts.Domain.Exceptions;

public class AccountsDomainException : Exception
{
    public AccountsDomainException()
    { }

    public AccountsDomainException(string message)
        : base(message)
    { }

    public AccountsDomainException(string message, Exception innerException)
        : base(message, innerException)
    { }
}
