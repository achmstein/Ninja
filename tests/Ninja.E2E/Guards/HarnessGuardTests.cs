using System.Text.RegularExpressions;
using Ninja.E2E.Harness;
using Ninja.E2E.Manifest;
using Microsoft.Extensions.DependencyInjection;

namespace Ninja.E2E.Guards;

/// <summary>
/// Keeps the harness's static knowledge (event names, hub methods, queues,
/// resources) in step with the source tree, so a new event or service cannot
/// slip past the recorders unnoticed.
/// </summary>
public sealed partial class HarnessGuardTests(NinjaApp app) : ScenarioTest(app)
{
    private static string Src => Path.Combine(RepoRoot.Path, "src");

    private static IEnumerable<string> SourceFiles(string under, string pattern = "*.cs")
        => Directory.EnumerateFiles(under, pattern, SearchOption.AllDirectories)
            .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}")
                     && !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}")
                     && !f.Contains($"{Path.DirectorySeparatorChar}node_modules{Path.DirectorySeparatorChar}"));

    [Fact]
    public void KnownEvents_lists_every_integration_event_declared_in_src()
    {
        // Declarations, not file names: OrderStatusChangedTosubmittedIntegrationEvent.cs is
        // misnamed and Finance's ProfitFeedEvents.cs declares four records in one file.
        var declared = SourceFiles(Src)
            .SelectMany(f => EventDeclaration().Matches(File.ReadAllText(f)).Select(m => m.Groups[1].Value))
            .Where(n => n != "IntegrationEvent")
            .ToHashSet(StringComparer.Ordinal);

        var listed = KnownEvents.All.ToHashSet(StringComparer.Ordinal);

        var missing = declared.Except(listed).Order().ToArray();
        var extra = listed.Except(declared).Order().ToArray();
        Assert.True(missing.Length == 0 && extra.Length == 0,
            $"KnownEvents.Catalog is out of step with src/.\nDeclared but not listed: {string.Join(", ", missing)}\nListed but not declared: {string.Join(", ", extra)}");
    }

    [Fact]
    public void HubRecorder_knows_every_method_notification_api_pushes()
    {
        var pushed = SourceFiles(Path.Combine(Src, "Notification.API"))
            .Where(f => !f.EndsWith("FcmService.cs", StringComparison.Ordinal))
            .SelectMany(f => HubSend().Matches(File.ReadAllText(f)).Select(m => m.Groups[1].Value))
            .ToHashSet(StringComparer.Ordinal);

        Assert.Equal(pushed.Order(), HubRecorder.KnownMethods.Order());
    }

    [Fact]
    public void KnownResources_queues_match_every_service_subscription_client_name()
    {
        var names = Directory.EnumerateFiles(Src, "appsettings.json", SearchOption.AllDirectories)
            .Where(f => !f.Contains("node_modules", StringComparison.Ordinal))
            .Select(f => SubscriptionClientName().Match(File.ReadAllText(f)))
            .Where(m => m.Success)
            .Select(m => m.Groups[1].Value)
            .ToHashSet(StringComparer.Ordinal);

        Assert.Equal(names.Order(), KnownResources.Queues.Order());
    }

    [Fact]
    public void KnownResources_match_the_booted_application_model()
    {
        var model = App.App.Services.GetRequiredService<DistributedApplicationModel>();

        var projects = model.Resources.OfType<ProjectResource>().Select(r => r.Name).Order();
        Assert.Equal(KnownResources.Apis.Order(), projects);

        var databases = model.Resources.Where(r => r.GetType().Name == "PostgresDatabaseResource").Select(r => r.Name).Order();
        Assert.Equal(KnownResources.Databases.Order(), databases);

        // Test mode must not start the dev-only resources.
        Assert.DoesNotContain(model.Resources, r => r.Name is "pgadmin" or "admin-web" or "pos-web" or "kds-web" or "client-web");
    }

    [GeneratedRegex(@"\b(?:record|class)\s+(\w+IntegrationEvent)\b")]
    private static partial Regex EventDeclaration();

    [GeneratedRegex(@"SendAsync\(""(\w+)""")]
    private static partial Regex HubSend();

    [GeneratedRegex(@"""SubscriptionClientName""\s*:\s*""(\w+)""")]
    private static partial Regex SubscriptionClientName();
}
