using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Ninja.Control.API.Platform;
using Ninja.ServiceDefaults;

namespace Ninja.Control.API.Apis;

/// <summary>
/// The people who run the platform: who they are, a new one in, one shut out,
/// and a colleague's lost password or phone. Your own account is not managed
/// here: your password and authenticator change through Keycloak's own pages,
/// which ask for you again first.
/// </summary>
public static partial class ControlApi
{
    private static void MapOperatorsApi(RouteGroupBuilder api)
    {
        api.MapGet("/operators", ListOperators).WithName("ListOperators").WithSummary("Everyone who can sign in to the control app").RequireAuthorization("Platform");
        api.MapPost("/operators", InviteOperator).WithName("InviteOperator").WithSummary("A new operator with a temporary password, shown once; they choose their own and set up an authenticator on first sign-in").RequireAuthorization("Platform");
        api.MapPost("/operators/{id}/disable", DisableOperator).WithName("DisableOperator").WithSummary("Shut an operator out and end their sessions").RequireAuthorization("Platform");
        api.MapPost("/operators/{id}/enable", EnableOperator).WithName("EnableOperator").WithSummary("Let a disabled operator back in").RequireAuthorization("Platform");
        api.MapPost("/operators/{id}/password", ResetOperatorPassword).WithName("ResetOperatorPassword").WithSummary("A new temporary password, shown once, for an operator who lost theirs; their sessions end").RequireAuthorization("Platform");
        api.MapPost("/operators/{id}/authenticator", ResetOperatorAuthenticator).WithName("ResetOperatorAuthenticator").WithSummary("Forget an operator's authenticator app (a lost phone); they set up a new one on the next sign-in").RequireAuthorization("Platform");
        api.MapPost("/operators/{id}/sign-out", SignOutOperator).WithName("SignOutOperator").WithSummary("End every session an operator has").RequireAuthorization("Platform");
    }

    public static async Task<Ok<List<OperatorResponse>>> ListOperators(IOperatorDirectory directory, ClaimsPrincipal user, CancellationToken ct)
    {
        var me = user.GetUserId();
        var operators = await directory.ListAsync(ct);
        return TypedResults.Ok(operators.Select(o => OperatorResponse.From(o, me)).ToList());
    }

    public static async Task<Results<Created<OperatorInvitedResponse>, ValidationProblem, Conflict<ProblemDetails>>> InviteOperator(
        IOperatorDirectory directory, IAuditWriter audit, InviteOperatorRequest request, CancellationToken ct)
    {
        var email = request.Email?.Trim().ToLowerInvariant() ?? "";
        if (!new EmailAddressAttribute().IsValid(email) || !email.Contains('@'))
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["email"] = ["An email address is required."] });

        var password = TenantNaming.NewPassword();
        var id = await directory.InviteAsync(email, Clean(request.FirstName), Clean(request.LastName), password, ct);
        if (id is null) return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{email} already has an account." });
        await audit.WriteAsync("operator.invited", null, new { id, email }, ct);
        return TypedResults.Created($"/api/control/operators/{id}", new OperatorInvitedResponse(id, email, password));
    }

    public static Task<Results<NoContent, NotFound, Conflict<ProblemDetails>>> DisableOperator(IOperatorDirectory directory, IAuditWriter audit, ClaimsPrincipal user, string id, CancellationToken ct)
        => OnColleagueAsync(directory, audit, user, id, "operator.disabled", "You cannot disable yourself.", op => directory.SetEnabledAsync(op.Id, false, ct), ct);

    public static Task<Results<NoContent, NotFound, Conflict<ProblemDetails>>> EnableOperator(IOperatorDirectory directory, IAuditWriter audit, ClaimsPrincipal user, string id, CancellationToken ct)
        => OnColleagueAsync(directory, audit, user, id, "operator.enabled", "You are already in.", op => directory.SetEnabledAsync(op.Id, true, ct), ct);

    public static Task<Results<NoContent, NotFound, Conflict<ProblemDetails>>> ResetOperatorAuthenticator(IOperatorDirectory directory, IAuditWriter audit, ClaimsPrincipal user, string id, CancellationToken ct)
        => OnColleagueAsync(directory, audit, user, id, "operator.authenticator.reset", "Change your own authenticator from your account menu.", op => directory.ResetAuthenticatorAsync(op.Id, ct), ct);

    public static Task<Results<NoContent, NotFound, Conflict<ProblemDetails>>> SignOutOperator(IOperatorDirectory directory, IAuditWriter audit, ClaimsPrincipal user, string id, CancellationToken ct)
        => OnColleagueAsync(directory, audit, user, id, "operator.signed-out", "Sign yourself out from your account menu.", op => directory.SignOutAsync(op.Id, ct), ct);

    public static async Task<Results<Ok<OperatorPasswordResponse>, NotFound, Conflict<ProblemDetails>>> ResetOperatorPassword(
        IOperatorDirectory directory, IAuditWriter audit, ClaimsPrincipal user, string id, CancellationToken ct)
    {
        var password = TenantNaming.NewPassword();
        var result = await OnColleagueAsync(directory, audit, user, id, "operator.password.reset", "Change your own password from your account menu.", op => directory.ResetPasswordAsync(op.Id, password, ct), ct);
        return result.Result switch
        {
            NotFound notFound => notFound,
            Conflict<ProblemDetails> conflict => conflict,
            _ => TypedResults.Ok(new OperatorPasswordResponse(password)),
        };
    }

    /// <summary>
    /// Acts on another operator, never on yourself: your own password and
    /// authenticator go through Keycloak, which asks for you again first, and
    /// disabling yourself would leave nobody to let you back in.
    /// </summary>
    private static async Task<Results<NoContent, NotFound, Conflict<ProblemDetails>>> OnColleagueAsync(
        IOperatorDirectory directory, IAuditWriter audit, ClaimsPrincipal user, string id, string action, string selfRefusal, Func<PlatformOperator, Task> act, CancellationToken ct)
    {
        var op = await directory.FindAsync(id, ct);
        if (op is null) return TypedResults.NotFound();
        if (op.Id == user.GetUserId()) return TypedResults.Conflict<ProblemDetails>(new() { Detail = selfRefusal });
        await act(op);
        await audit.WriteAsync(action, null, new { id = op.Id, email = op.Email }, ct);
        return TypedResults.NoContent();
    }
}

public record InviteOperatorRequest(string? Email, string? FirstName, string? LastName);

/// <param name="IsYou">The operator asking.</param>
/// <param name="HasAuthenticator">An authenticator app is set up; false until their first sign-in is finished.</param>
/// <param name="PendingSetup">Keycloak still asks them for a new password or an authenticator on their next sign-in.</param>
public record OperatorResponse(string Id, string Email, string? FirstName, string? LastName, bool Enabled, DateTimeOffset? CreatedAt, bool HasAuthenticator, bool PendingSetup, bool IsYou)
{
    public static OperatorResponse From(PlatformOperator o, string? me)
        => new(o.Id, o.Email, o.FirstName, o.LastName, o.Enabled, o.CreatedAt, o.HasAuthenticator, o.PendingSetup, o.Id == me);
}

/// <param name="TemporaryPassword">Shown this once; the operator changes it on first sign-in.</param>
public record OperatorInvitedResponse(string Id, string Email, string TemporaryPassword);

/// <param name="TemporaryPassword">Shown this once; the operator changes it on the next sign-in.</param>
public record OperatorPasswordResponse(string TemporaryPassword);
