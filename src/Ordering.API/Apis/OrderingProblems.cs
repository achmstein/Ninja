#nullable enable
using Microsoft.AspNetCore.Http.HttpResults;

/// <summary>
/// How Ordering says no: always ProblemDetails, with a stable <c>code</c>
/// (also its <c>type</c>) the apps translate, and an English <c>detail</c>
/// for logs and for an app that does not know the code yet. A rule broken by
/// where an order stands is a 409; one broken by what was sent, a 400.
/// </summary>
public static class OrderingProblems
{
    /// <summary>A validator turned the command down; the detail joins its reasons.</summary>
    public const string Validation = "order.validation";

    /// <summary>A domain rule with no name of its own.</summary>
    public const string Invalid = "order.invalid";

    public const string Paused = "order.paused";

    public const string ModuleOff = "module.off";

    private static readonly Dictionary<string, int> Statuses = new()
    {
        [ModuleOff] = StatusCodes.Status402PaymentRequired,
        [AddressErrors.NotFound] = StatusCodes.Status404NotFound,
        ["delivery.not_found"] = StatusCodes.Status404NotFound,
        [DeliveryErrors.RiderNotYours] = StatusCodes.Status403Forbidden,
        ["order.guest_waiting"] = StatusCodes.Status409Conflict,
    };

    public static int StatusFor(string code) =>
        Statuses.TryGetValue(code, out var status) ? status
        : DeliveryErrors.StateConflicts.Contains(code) ? StatusCodes.Status409Conflict
        : StatusCodes.Status400BadRequest;

    public static ProblemHttpResult Of(string code, string detail)
    {
        var extensions = new Dictionary<string, object?> { ["code"] = code };
        // The gateway's 402 names the module; so does this one
        if (code == ModuleOff)
        {
            extensions["module"] = "delivery";
        }

        return TypedResults.Problem(detail: detail, statusCode: StatusFor(code), type: code, extensions: extensions);
    }

    public static ProblemHttpResult From(OrderingDomainException ex) => Of(ex.Code ?? Invalid, ex.Message);

    /// <summary>Two people moved the same delivery at once; this one lost and should look again.</summary>
    public static ProblemHttpResult Conflict() =>
        Of(DeliveryErrors.Conflict, "Someone else moved this delivery just now. Look again and try once more.");
}
