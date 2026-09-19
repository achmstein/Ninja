#nullable enable
namespace Ninja.Sales.API.Apis;

/// <summary>
/// Who did it, as the till and the back office print it: the signed-in user's
/// display name (Keycloak's name, else the username), falling back to the
/// subject id only for a token that carries no name at all. These strings
/// are audit labels on shifts, settles, voids, refunds and drawer movements,
/// read by a manager — a guid there says nothing.
/// </summary>
public static class ActorExtensions
{
    public static string GetActor(this HttpContext httpContext)
        => httpContext.User.GetUserName()
           ?? httpContext.User.GetUserId()
           ?? "unknown";
}
