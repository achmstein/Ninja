using System.ComponentModel;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Apis;

public sealed record FirebaseSettingsDto(
    bool Set,
    [property: Description("The service account, the one part shown again")] string? ClientEmail,
    [property: Description("The Firebase project it manages, from its key file")] string? ProjectId,
    DateTime? UpdatedAt);

/// <summary>A key file replaces the saved one; Clear takes it off.</summary>
public sealed record SaveFirebaseSettingsRequest(string? ServiceAccountJson = null, bool Clear = false);

public sealed record FirebaseTestResult(bool Ok, string Detail, IReadOnlyList<string> Apps);

public static partial class ControlApi
{
    private static void MapFirebaseApi(RouteGroupBuilder api)
    {
        api.MapGet("/firebase", GetFirebase).WithName("GetFirebaseSettings").WithSummary("The service account the businesses' own apps are made in Firebase with (shown by its email and project)").RequireAuthorization("Platform");
        api.MapPut("/firebase", SaveFirebase).WithName("SaveFirebaseSettings").WithSummary("Set or clear that service account: a Google key file with Firebase Admin on the platform's Firebase project").RequireAuthorization("Platform");
        api.MapPost("/firebase/test", TestFirebase).WithName("TestFirebase").WithSummary("List the project's apps with the saved service account: whether Firebase answers it").RequireAuthorization("Platform");
    }

    private static FirebaseSettingsDto FirebaseDto(FirebaseSettings? settings)
    {
        var account = GoogleServiceAccount.Parse(settings?.ServiceAccountJson, out _);
        return new FirebaseSettingsDto(account is not null, account?.ClientEmail, account?.ProjectId, settings?.UpdatedAt);
    }

    public static async Task<Ok<FirebaseSettingsDto>> GetFirebase(ControlContext context, CancellationToken ct)
        => TypedResults.Ok(FirebaseDto(await context.FirebaseSettings.AsNoTracking().SingleOrDefaultAsync(f => f.Id == FirebaseSettings.SingletonId, ct)));

    public static async Task<Results<Ok<FirebaseSettingsDto>, BadRequest<ProblemDetails>>> SaveFirebase(
        SaveFirebaseSettingsRequest request, ControlContext context, IAuditWriter audit, CancellationToken ct)
    {
        var settings = await context.FirebaseSettings.SingleOrDefaultAsync(f => f.Id == FirebaseSettings.SingletonId, ct);
        if (settings is null)
        {
            settings = new FirebaseSettings();
            context.FirebaseSettings.Add(settings);
        }

        if (!string.IsNullOrWhiteSpace(request.ServiceAccountJson))
        {
            if (request.Clear) return Problem("Give a key file or clear it, not both.");
            if (GoogleServiceAccount.Parse(request.ServiceAccountJson, out var error) is not { } account) return Problem(error!);
            if (account.ProjectId.Length == 0) return Problem("The key file names no project.");
            settings.ServiceAccountJson = request.ServiceAccountJson.Trim();
            settings.UpdatedAt = DateTime.UtcNow;
            await context.SaveChangesAsync(ct);
            await audit.WriteAsync("firebase.settings.saved", null, new { account.ClientEmail, account.ProjectId }, ct);
        }
        else if (request.Clear && settings.ServiceAccountJson is not null)
        {
            settings.ServiceAccountJson = null;
            settings.UpdatedAt = DateTime.UtcNow;
            await context.SaveChangesAsync(ct);
            await audit.WriteAsync("firebase.settings.cleared", null, null, ct);
        }
        return TypedResults.Ok(FirebaseDto(settings));
    }

    public static async Task<Ok<FirebaseTestResult>> TestFirebase(ControlContext context, IHttpClientFactory clients, CancellationToken ct)
    {
        if (await FirebaseAppsAsync(context, clients, ct) is not { } firebase)
            return TypedResults.Ok(new FirebaseTestResult(false, "No service account saved.", []));
        try
        {
            var apps = await firebase.ListAsync(ct);
            return TypedResults.Ok(new FirebaseTestResult(true, $"{firebase.Project} answers: {apps.Count} apps.", apps));
        }
        catch (Exception e) when (e is StoreKeyException or HttpRequestException or TaskCanceledException)
        {
            return TypedResults.Ok(new FirebaseTestResult(false, e.Message, []));
        }
    }
}
