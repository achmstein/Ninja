using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using Ninja.ServiceDefaults;

namespace Ninja.Assistant.API.Auth;

/// <summary>
/// Every confirmed write a chat app makes, as one structured log line: who,
/// which tool, with what, and how it ended. The services record the actor on
/// the rows they own (Finance, Inventory); this is the trail for the ones that
/// do not (Catalog, Branch) and the one place to search for "what did the
/// assistant change".
/// </summary>
public sealed class AuditLog(ILogger<AuditLog> logger)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public void Write(ClaimsPrincipal user, string tool, object arguments, string outcome)
    {
        logger.LogInformation("MCP write {Tool} by {UserId} ({UserName}): {Arguments} -> {Outcome}",
            tool, user.GetUserId(), user.GetUserName(), JsonSerializer.Serialize(arguments, Json), outcome);
    }
}
