using System.ComponentModel;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Apis;

public sealed record AppBuildSettingsDto(
    [property: Description("Whether a GitHub token is saved")] bool Set,
    [property: Description("Its last four characters, the only part shown again")] string Hint,
    string Repository,
    string Workflow,
    string Ref,
    DateTime? UpdatedAt);

/// <summary>A token left out keeps the saved one; ClearToken takes it off. The rest left out stays as it is.</summary>
public sealed record SaveAppBuildSettingsRequest(string? GitHubToken = null, bool ClearToken = false, string? Repository = null, string? Workflow = null, string? Ref = null);

public sealed record AppBuildTestResult(bool Ok, string Detail);

/// <param name="Platform">all, android or ios</param>
/// <param name="Track">Play's track: internal, alpha, beta or production; iOS always lands in TestFlight</param>
public sealed record StartAppBuildRequest(string Platform = "all", string Track = "internal");

public sealed record AppBuildStatus(
    [property: Description("Whether the Platform page has a GitHub token, without which no build starts from here")] bool CanBuild,
    string? Platform,
    string? Track,
    DateTime? RequestedAt,
    [property: Description("The run on GitHub once it is found; null just after starting, or when GitHub has not listed it yet")] BuildRun? Run,
    [property: Description("Why the run could not be read, when it could not")] string? Problem);

public sealed record BuildAllResult(IReadOnlyList<string> Started, IReadOnlyList<BuildAllRefusal> Refused);

public sealed record BuildAllRefusal(string Slug, string Reason);

/// <summary>What one press of Set up did, step by step, and where the app stands after.</summary>
public sealed record AppSetupStep(string Step, bool Ok, string Detail);

public sealed record AppSetupResponse(TenantAppStatus App, IReadOnlyList<AppSetupStep> Steps);

/// <summary>
/// A business's own app built from the control app (mobile-deploy.yml through GitHub's API, with the
/// Platform page's token), one business or every one at once; and Set up, which does in one press
/// everything the server can: the upload key, the Apple App IDs, Firebase, then the checks.
/// </summary>
public static partial class ControlApi
{
    private static readonly string[] BuildPlatforms = ["all", "android", "ios"];
    private static readonly string[] BuildTracks = ["internal", "alpha", "beta", "production"];

    private static void MapAppBuildApi(RouteGroupBuilder api)
    {
        api.MapGet("/apps/builds/settings", GetAppBuildSettings).WithName("GetAppBuildSettings").WithSummary("The GitHub token (shown by its last four characters), repository, workflow and branch the own apps are built with").RequireAuthorization("Platform");
        api.MapPut("/apps/builds/settings", SaveAppBuildSettings).WithName("SaveAppBuildSettings").WithSummary("Set the GitHub token (Actions read and write on the repository), or the repository, workflow or branch").RequireAuthorization("Platform");
        api.MapPost("/apps/builds/settings/test", TestAppBuildSettings).WithName("TestAppBuildSettings").WithSummary("Read the workflow with the saved token: whether a build could start").RequireAuthorization("Platform");
        api.MapPost("/apps/build-all", BuildAllApps).WithName("BuildAllOwnApps").WithSummary("Start a build of every business's own app, one run each").RequireAuthorization("Platform");
        api.MapGet("/tenants/{slug}/app/build", GetAppBuild).WithName("GetAppBuild").WithSummary("The business's last build started from here, as GitHub has it now").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/app/build", StartAppBuild).WithName("StartAppBuild").WithSummary("Build the business's own app: Android to Play's track, iOS to TestFlight").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/app/setup", SetUpApp).WithName("SetUpTenantApp").WithSummary("Everything the server can do for the app in one go: an upload key if it has none, its Apple App IDs (with the App Store Connect key), Firebase, then the checks").RequireAuthorization("Platform");
    }

    private static async Task<AppBuildSettings> BuildSettingsAsync(ControlContext context, CancellationToken ct)
        => await context.AppBuildSettings.AsNoTracking().SingleOrDefaultAsync(s => s.Id == AppBuildSettings.SingletonId, ct) ?? new AppBuildSettings();

    private static AppBuildSettingsDto BuildSettingsDto(AppBuildSettings s)
        => new(!string.IsNullOrEmpty(s.GitHubToken), s.GitHubToken is { Length: >= 4 } t ? t[^4..] : "", s.Repository, s.Workflow, s.Ref, s.UpdatedAt == default ? null : s.UpdatedAt);

    private static GitHubBuilds? Builds(AppBuildSettings settings, IHttpClientFactory clients)
        => string.IsNullOrEmpty(settings.GitHubToken) ? null : new GitHubBuilds(clients.CreateClient(GitHubBuilds.ClientName), settings);

    public static async Task<Ok<AppBuildSettingsDto>> GetAppBuildSettings(ControlContext context, CancellationToken ct)
        => TypedResults.Ok(BuildSettingsDto(await BuildSettingsAsync(context, ct)));

    public static async Task<Results<Ok<AppBuildSettingsDto>, BadRequest<ProblemDetails>>> SaveAppBuildSettings(
        SaveAppBuildSettingsRequest request, ControlContext context, IAuditWriter audit, CancellationToken ct)
    {
        var settings = await context.AppBuildSettings.SingleOrDefaultAsync(s => s.Id == AppBuildSettings.SingletonId, ct);
        if (settings is null)
        {
            settings = new AppBuildSettings();
            context.AppBuildSettings.Add(settings);
        }
        var token = request.GitHubToken?.Trim();
        if (!string.IsNullOrEmpty(token) && (token.Length > 300 || token.Any(char.IsWhiteSpace)))
            return Problem("That does not look like a GitHub token (github_pat_… or ghp_…).");
        if (request.Repository is { } repo && !RepositoryPattern().IsMatch(repo.Trim()))
            return Problem("The repository is owner/name.");
        if (request.Workflow is { } workflow && !WorkflowPattern().IsMatch(workflow.Trim()))
            return Problem("The workflow is its file's name, like mobile-deploy.yml.");

        var changes = new Dictionary<string, string>();
        settings.GitHubToken = ApplyKey("token", settings.GitHubToken, token, request.ClearToken, changes);
        if (!string.IsNullOrWhiteSpace(request.Repository)) settings.Repository = request.Repository.Trim();
        if (!string.IsNullOrWhiteSpace(request.Workflow)) settings.Workflow = request.Workflow.Trim();
        if (!string.IsNullOrWhiteSpace(request.Ref)) settings.Ref = request.Ref.Trim();
        settings.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("apps.builds.settings.saved", null, new { changes, settings.Repository, settings.Workflow, settings.Ref }, ct);
        return TypedResults.Ok(BuildSettingsDto(settings));
    }

    public static async Task<Ok<AppBuildTestResult>> TestAppBuildSettings(ControlContext context, IHttpClientFactory clients, CancellationToken ct)
    {
        if (Builds(await BuildSettingsAsync(context, ct), clients) is not { } builds)
            return TypedResults.Ok(new AppBuildTestResult(false, "No GitHub token saved."));
        try
        {
            return TypedResults.Ok(new AppBuildTestResult(true, await builds.TestAsync(ct)));
        }
        catch (Exception e) when (e is StoreKeyException or HttpRequestException or TaskCanceledException)
        {
            return TypedResults.Ok(new AppBuildTestResult(false, e.Message));
        }
    }

    public static async Task<Results<Ok<AppBuildStatus>, NotFound, BadRequest<ProblemDetails>>> StartAppBuild(
        ControlContext context, IAuditWriter audit, IHttpClientFactory clients, string slug, StartAppBuildRequest? request, CancellationToken ct)
    {
        request ??= new StartAppBuildRequest();
        if (!BuildPlatforms.Contains(request.Platform)) return Problem("The platform is all, android or ios.");
        if (!BuildTracks.Contains(request.Track)) return Problem("Play's track is internal, alpha, beta or production.");
        if (await OwnAppAsync(context, slug, ct) is not { } found) return TypedResults.NotFound();
        var (tenant, app) = found;
        if (Refuse(tenant) is { } refused) return refused;
        if (Builds(await BuildSettingsAsync(context, ct), clients) is not { } builds)
            return Problem("Save a GitHub token on the Platform page's Own apps tab first.");

        try
        {
            app.BuildRunId = await builds.StartAsync(slug, request.Platform, request.Track, ct);
        }
        catch (Exception e) when (e is StoreKeyException or HttpRequestException or TaskCanceledException)
        {
            return Problem(e.Message);
        }
        app.BuildRequestedAt = DateTime.UtcNow;
        app.BuildPlatform = request.Platform;
        app.BuildTrack = request.Track;
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.app.build", slug, new { request.Platform, request.Track, run = app.BuildRunId }, ct);
        return TypedResults.Ok(new AppBuildStatus(true, app.BuildPlatform, app.BuildTrack, app.BuildRequestedAt, null, null));
    }

    public static async Task<Results<Ok<AppBuildStatus>, NotFound>> GetAppBuild(ControlContext context, IHttpClientFactory clients, string slug, CancellationToken ct)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        var app = await context.TenantApps.SingleOrDefaultAsync(a => a.TenantId == tenant.Id, ct);
        var builds = Builds(await BuildSettingsAsync(context, ct), clients);
        if (app?.BuildRequestedAt is not { } requested || builds is null)
            return TypedResults.Ok(new AppBuildStatus(builds is not null, app?.BuildPlatform, app?.BuildTrack, app?.BuildRequestedAt, null, null));

        try
        {
            var run = await builds.FindAsync(slug, app.BuildRunId, requested, ct);
            // Found by its name: kept, so the next read asks for it straight
            if (run is not null && app.BuildRunId != run.Id)
            {
                app.BuildRunId = run.Id;
                await context.SaveChangesAsync(ct);
            }
            return TypedResults.Ok(new AppBuildStatus(true, app.BuildPlatform, app.BuildTrack, requested, run, null));
        }
        catch (Exception e) when (e is StoreKeyException or HttpRequestException or TaskCanceledException)
        {
            return TypedResults.Ok(new AppBuildStatus(true, app.BuildPlatform, app.BuildTrack, requested, null, e.Message));
        }
    }

    public static async Task<Results<Ok<BuildAllResult>, BadRequest<ProblemDetails>>> BuildAllApps(
        ControlContext context, IAuditWriter audit, IHttpClientFactory clients, StartAppBuildRequest? request, CancellationToken ct)
    {
        request ??= new StartAppBuildRequest();
        if (!BuildPlatforms.Contains(request.Platform)) return Problem("The platform is all, android or ios.");
        if (!BuildTracks.Contains(request.Track)) return Problem("Play's track is internal, alpha, beta or production.");
        if (Builds(await BuildSettingsAsync(context, ct), clients) is not { } builds)
            return Problem("Save a GitHub token first.");

        var tenants = await context.Tenants.Where(t => t.AppId != null && t.Status != TenantStatus.Destroyed && t.Status != TenantStatus.Destroying).OrderBy(t => t.Slug).ToListAsync(ct);
        var started = new List<string>();
        var refused = new List<BuildAllRefusal>();
        foreach (var tenant in tenants)
        {
            var app = await context.TenantApps.SingleOrDefaultAsync(a => a.TenantId == tenant.Id, ct);
            if (app is null)
            {
                app = new TenantApp { TenantId = tenant.Id, UpdatedAt = DateTime.UtcNow };
                context.TenantApps.Add(app);
            }
            try
            {
                app.BuildRunId = await builds.StartAsync(tenant.Slug, request.Platform, request.Track, ct);
                app.BuildRequestedAt = DateTime.UtcNow;
                app.BuildPlatform = request.Platform;
                app.BuildTrack = request.Track;
                started.Add(tenant.Slug);
            }
            catch (Exception e) when (e is StoreKeyException or HttpRequestException or TaskCanceledException)
            {
                refused.Add(new BuildAllRefusal(tenant.Slug, e.Message));
            }
        }
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("apps.build-all", null, new { request.Platform, request.Track, started, refused = refused.Select(r => r.Slug) }, ct);
        return TypedResults.Ok(new BuildAllResult(started, refused));
    }

    public static async Task<Results<Ok<AppSetupResponse>, NotFound, BadRequest<ProblemDetails>>> SetUpApp(
        ControlContext context, IOptions<PlatformOptions> options, IAuditWriter audit, IHttpClientFactory clients, IStackProxy stack, string slug, CancellationToken ct)
    {
        if (await OwnAppAsync(context, slug, ct) is not { } found) return TypedResults.NotFound();
        var (tenant, app) = found;
        if (Refuse(tenant) is { } refused) return refused;
        var steps = new List<AppSetupStep>();
        var name = tenant.NameEn ?? tenant.NameAr ?? tenant.Slug;

        // 1. An upload key, made only when there is none: an imported or carried one is never replaced
        if (app.UploadKeystore is null)
        {
            SetUploadKey(tenant, app, UploadKeys.Generate(name));
            steps.Add(new("android-key", true, $"Made an upload key ({app.UploadKeySha256![..11]}…)"));
        }
        else steps.Add(new("android-key", true, "The upload key is there"));

        // The icons from the brand's logo, unless the app already has its own
        if (app.Icon is null)
            steps.Add(await IconsFromBrandAsync(stack, tenant, app, ct) is { } iconError
                ? new("icon", false, iconError)
                : new("icon", true, "Made the icons from the brand logo"));
        else steps.Add(new("icon", true, "The icons are there"));
        await context.SaveChangesAsync(ct);

        // 2. The App IDs in the business's developer account, with its App Store Connect key
        if (app.AscKeyId is null || app.AscIssuerId is null || app.AscPrivateKey is null)
            steps.Add(new("apple", false, "Add the App Store Connect key, then press Set up again"));
        else
        {
            try
            {
                var done = await StoreKeys.RegisterAppIdsAsync(clients.CreateClient(StoreClient), app.AscKeyId, app.AscIssuerId, app.AscPrivateKey, tenant.AppId!, name, ct);
                steps.Add(new("apple", true, string.Join(" · ", done)));
            }
            catch (Exception e) when (e is StoreKeyException or HttpRequestException or TaskCanceledException)
            {
                steps.Add(new("apple", false, e.Message));
            }
        }

        // Play's app signing key, which installed apps are signed with: its SHA-256 joins the record's App Links
        // fingerprints (and so Firebase's), read off the newest release once Play has one
        if (GoogleServiceAccount.Parse(app.PlayServiceAccountJson, out _) is { } play)
        {
            try
            {
                var signing = await StoreKeys.PlaySigningSha256Async(clients.CreateClient(StoreClient), play, tenant.AppId!, ct);
                if (signing is null) steps.Add(new("play-signing", true, "Play has no release yet: its app signing key is read after the first upload"));
                else if (AppLinks.Fingerprints(tenant.AndroidCertFingerprints).Contains(signing))
                    steps.Add(new("play-signing", true, $"Play's app signing key ({signing[..11]}…) is on the record"));
                else
                {
                    tenant.AndroidCertFingerprints = MergeFingerprints(tenant.AndroidCertFingerprints, add: signing, remove: null);
                    await context.SaveChangesAsync(ct);
                    steps.Add(new("play-signing", true, $"Added Play's app signing key ({signing[..11]}…) to the fingerprints"));
                }
            }
            catch (Exception e) when (e is StoreKeyException or HttpRequestException or TaskCanceledException)
            {
                steps.Add(new("play-signing", false, e.Message));
            }
        }

        // 3. Firebase: the apps found or made, the certificates given, both files kept
        if (await FirebaseAppsAsync(context, clients, ct) is not { } firebase)
            steps.Add(new("firebase", false, "Save the Firebase service account on the Platform page's Own apps tab, then press Set up again"));
        else
        {
            var sha256 = AppLinks.Fingerprints(tenant.AndroidCertFingerprints).ToList();
            if (app.UploadKeySha256 is { } upload && !sha256.Contains(upload)) sha256.Add(upload);
            try
            {
                var linked = await firebase.LinkAsync(tenant.AppId!, name, tenant.AppleTeamId, Sha1sFor(app), sha256, ct);
                app.FirebaseAndroidAppId = linked.Android?.AppId;
                app.GoogleServicesJson = linked.Android?.ConfigFile;
                app.FirebaseIosAppId = linked.Ios?.AppId;
                app.GoogleServiceInfoPlist = linked.Ios?.ConfigFile;
                app.UpdatedAt = DateTime.UtcNow;
                await context.SaveChangesAsync(ct);
                steps.Add(new("firebase", true, string.Join(" · ", linked.Done)));
            }
            catch (Exception e) when (e is StoreKeyException or HttpRequestException or TaskCanceledException)
            {
                steps.Add(new("firebase", false, e.Message));
            }
        }

        await audit.WriteAsync("tenant.app.setup", slug, new { steps = steps.Select(s => new { s.Step, s.Ok }) }, ct);

        // 4. The checks, as Check all runs them
        var checkedApp = await CheckApp(context, audit, clients, options, slug, ct);
        var status = checkedApp.Result is Ok<TenantAppStatus> ok ? ok.Value! : await AppStatusAsync(context, tenant, app, ct, options.Value);
        return TypedResults.Ok(new AppSetupResponse(status, steps));
    }

    [System.Text.RegularExpressions.GeneratedRegex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")]
    private static partial System.Text.RegularExpressions.Regex RepositoryPattern();

    [System.Text.RegularExpressions.GeneratedRegex(@"^[A-Za-z0-9_.-]+\.ya?ml$")]
    private static partial System.Text.RegularExpressions.Regex WorkflowPattern();
}
