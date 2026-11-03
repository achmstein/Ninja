using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>One job of a build run: Android or iOS, and how it went.</summary>
public sealed record BuildJob(string Name, string Status, string? Conclusion);

/// <summary>A build run as GitHub has it.</summary>
public sealed record BuildRun(long Id, string Status, string? Conclusion, string Url, DateTime CreatedAt, IReadOnlyList<BuildJob> Jobs);

/// <summary>
/// The businesses' own app builds, started and followed from the control app through GitHub's API:
/// mobile-deploy.yml run for the customer app and one business (its run-name names the business, so
/// a run is found again when GitHub does not say which it started), and its jobs read back.
/// </summary>
public sealed class GitHubBuilds(HttpClient http, AppBuildSettings settings)
{
    public const string ClientName = "github";

    /// <summary>What mobile-deploy.yml's run-name says for a business's customer app; the run is found by it.</summary>
    public static string RunName(string slug) => $"Customer app for {slug}";

    /// <summary>Starts the build; the run's id when GitHub says it, null when it must be found by its name.</summary>
    public async Task<long?> StartAsync(string slug, string platform, string track, CancellationToken ct)
    {
        var body = new JsonObject
        {
            ["ref"] = settings.Ref,
            ["inputs"] = new JsonObject { ["app"] = "client_app", ["platform"] = platform, ["track"] = track, ["tenant"] = slug },
            ["return_run_details"] = true,
        };
        using var response = await SendAsync(HttpMethod.Post, $"actions/workflows/{settings.Workflow}/dispatches", body, ct);
        if (response.StatusCode == HttpStatusCode.NoContent) return null;
        var text = await response.Content.ReadAsStringAsync(ct);
        return JsonNode.Parse(text)?["workflow_run_id"]?.GetValue<long>();
    }

    /// <summary>The run: by its id, or the newest one named for the business since the build was asked for.</summary>
    public async Task<BuildRun?> FindAsync(string slug, long? runId, DateTime since, CancellationToken ct)
    {
        JsonNode? run;
        if (runId is { } id) run = await GetAsync($"actions/runs/{id}", ct);
        else
        {
            var created = since.AddMinutes(-1).ToString("yyyy-MM-ddTHH:mm:ssZ");
            var runs = await GetAsync($"actions/workflows/{settings.Workflow}/runs?event=workflow_dispatch&per_page=50&created=%3E%3D{created}", ct);
            run = runs["workflow_runs"]?.AsArray().FirstOrDefault(r => r?["display_title"]?.GetValue<string>() == RunName(slug));
        }
        if (run is null) return null;

        var runIdFound = run["id"]!.GetValue<long>();
        var jobs = (await GetAsync($"actions/runs/{runIdFound}/jobs?per_page=50", ct))["jobs"]?.AsArray()
            .Where(j => j?["name"]?.GetValue<string>()?.EndsWith("-client", StringComparison.Ordinal) == true)
            .Select(j => new BuildJob(
                j!["name"]!.GetValue<string>() == "build-ios-client" ? "iOS" : "Android",
                j["status"]!.GetValue<string>(),
                j["conclusion"]?.GetValue<string>()))
            .ToList() ?? [];
        return new BuildRun(runIdFound, run["status"]!.GetValue<string>(), run["conclusion"]?.GetValue<string>(),
            run["html_url"]!.GetValue<string>(), run["created_at"]!.GetValue<DateTime>(), jobs);
    }

    /// <summary>Whether the token reaches the workflow: what the Platform page's test says.</summary>
    public async Task<string> TestAsync(CancellationToken ct)
    {
        var workflow = await GetAsync($"actions/workflows/{settings.Workflow}", ct);
        return $"{settings.Repository}: {workflow["name"]?.GetValue<string>() ?? settings.Workflow} ({workflow["state"]?.GetValue<string>()})";
    }

    private async Task<JsonNode> GetAsync(string path, CancellationToken ct)
    {
        using var response = await SendAsync(HttpMethod.Get, path, null, ct);
        return JsonNode.Parse(await response.Content.ReadAsStringAsync(ct)) ?? new JsonObject();
    }

    private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, JsonObject? body, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(method, $"https://api.github.com/repos/{settings.Repository}/{path}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.GitHubToken);
        request.Headers.UserAgent.ParseAdd("ninja-control");
        request.Headers.Accept.ParseAdd("application/vnd.github+json");
        request.Headers.Add("X-GitHub-Api-Version", "2022-11-28");
        if (body is not null) request.Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");
        var response = await http.SendAsync(request, ct);
        // An older API takes no return_run_details: asked again without it
        if (response.StatusCode == HttpStatusCode.UnprocessableEntity && body?.ContainsKey("return_run_details") == true)
        {
            response.Dispose();
            body.Remove("return_run_details");
            return await SendAsync(method, path, body, ct);
        }
        if (response.IsSuccessStatusCode) return response;
        var text = await response.Content.ReadAsStringAsync(ct);
        response.Dispose();
        throw new StoreKeyException(response.StatusCode switch
        {
            HttpStatusCode.Unauthorized => "GitHub refused the token: it is wrong or expired. Make a new one and save it on the Platform page's Own apps tab.",
            HttpStatusCode.Forbidden or HttpStatusCode.NotFound => $"The token cannot reach {settings.Repository}'s {settings.Workflow}: give it Actions read and write on that repository. ({StoreKeys.ErrorOf(text)})",
            _ => $"GitHub answered {(int)response.StatusCode}: {StoreKeys.ErrorOf(text)}",
        });
    }
}
