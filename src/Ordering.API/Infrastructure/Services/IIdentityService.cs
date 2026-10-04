#nullable enable
namespace Ninja.Ordering.API.Infrastructure.Services;

public interface IIdentityService
{
    string GetUserIdentity();

    string GetUserName();

    /// <summary>Whether the caller holds the realm role.</summary>
    bool IsInRole(string role);

    /// <summary>
    /// The caller runs a till (an admin, owner or cashier), so may move any
    /// delivery at its branch; otherwise they are a rider, and move only their own.
    /// </summary>
    bool RunsTheTill();
}
