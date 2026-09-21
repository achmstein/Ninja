using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

/// <summary>Who is behind: the arithmetic on its own, then the cache over a scripted docker and registry.</summary>
[TestClass]
public sealed class UpdateTests
{
    [TestMethod]
    public void Releases_are_version_tags_newest_first()
    {
        var ordered = UpdateMath.OrderReleases(["latest", "v2026.9.30", "abc1234", "v2026.10.1", "v2026.9.30", "v2025.12.31"]);
        CollectionAssert.AreEqual(new[] { "v2026.10.1", "v2026.9.30", "v2025.12.31" }, ordered.ToArray());
    }

    [TestMethod]
    public void A_service_on_another_image_than_its_tag_points_to_is_behind()
    {
        var running = new Dictionary<string, string> { ["catalog"] = "sha256:old", ["branch"] = "sha256:same" };
        var newest = new Dictionary<string, string?> { ["catalog"] = "sha256:new", ["branch"] = "sha256:same", ["sales"] = "sha256:x" };

        var update = UpdateMath.Assess("latest", running, s => newest.GetValueOrDefault(s), null);

        Assert.IsTrue(update.Behind);
        CollectionAssert.AreEqual(new[] { "catalog" }, update.Services.ToArray());
        Assert.IsNull(update.NewerTag);
    }

    [TestMethod]
    public void Nothing_to_compare_counts_as_current()
    {
        // No container for the service, or nothing known about the tag: no claim is made
        var running = new Dictionary<string, string> { ["catalog"] = "sha256:a" };
        var update = UpdateMath.Assess("latest", running, _ => null, null);
        Assert.AreSame(TenantUpdate.Current, update);
    }

    [TestMethod]
    public void A_release_older_than_the_newest_is_behind_on_the_tag()
    {
        var running = new Dictionary<string, string> { ["catalog"] = "sha256:a" };
        var update = UpdateMath.Assess("v2026.9.1", running, _ => "sha256:a", "v2026.9.21");
        Assert.IsTrue(update.Behind);
        Assert.AreEqual(0, update.Services.Count);
        Assert.AreEqual("v2026.9.21", update.NewerTag);

        // latest and a build tag are not releases: only the images say whether they are behind
        Assert.IsFalse(UpdateMath.Assess("latest", running, _ => "sha256:a", "v2026.9.21").Behind);
        Assert.IsFalse(UpdateMath.Assess("abc1234", running, _ => "sha256:a", "v2026.9.21").Behind);
        Assert.IsFalse(UpdateMath.Assess("v2026.9.21", running, _ => "sha256:a", "v2026.9.21").Behind);
    }

    /// <summary>Answers docker ps, docker inspect and docker images with what a box would say.</summary>
    private sealed class ScriptedShell(string inspect, string images) : IShell
    {
        public List<string> Commands { get; } = [];

        public Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, CancellationToken ct)
        {
            Commands.Add($"{file} {string.Join(' ', args)}");
            var stdout = args[0] switch
            {
                "ps" => "c1\nc2\nc3\nc4\n",
                "inspect" => inspect,
                "images" => images,
                _ => "",
            };
            return Task.FromResult(new ShellResult(0, stdout, stdout));
        }

        public Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, Stream? stdin, Stream stdout, CancellationToken ct)
            => throw new NotSupportedException();
    }

    /// <summary>Three tenants on one tag (one of them destroyed) over an in-memory record, a scripted box and an empty registry.</summary>
    private static (UpdateCache Cache, DryRunImageRegistry Registry, ScriptedShell Shell) Cache(PlatformOptions platform, string tag, string inspect, string images)
    {
        var dbName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();
        services.AddDbContext<ControlContext>(o => o.UseInMemoryDatabase(dbName));
        var provider = services.BuildServiceProvider();
        using (var scope = provider.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
            context.Tenants.Add(new Tenant { Slug = "blue", NameEn = "Blue", OwnerEmail = "b@x", Status = TenantStatus.Running, ImageTag = tag });
            context.Tenants.Add(new Tenant { Slug = "red", NameEn = "Red", OwnerEmail = "r@x", Status = TenantStatus.Running, ImageTag = tag });
            context.Tenants.Add(new Tenant { Slug = "gone", NameEn = "Gone", OwnerEmail = "g@x", Status = TenantStatus.Destroyed, ImageTag = tag });
            context.SaveChanges();
        }
        var shell = new ScriptedShell(inspect, images);
        var registry = new DryRunImageRegistry();
        var cache = new UpdateCache(provider.GetRequiredService<IServiceScopeFactory>(), shell, registry, Options.Create(platform), NullLogger<UpdateCache>.Instance);
        return (cache, registry, shell);
    }

    // blue's catalog runs an older image than the box's catalog:local; red runs what the box has; the gateway is not ours to version
    private const string Inspect =
        "ninja-blue\tblue-catalog-api\tsha256:catalog-old\n" +
        "ninja-blue\tblue-branch-api\tsha256:branch-1\n" +
        "ninja-blue\tblue-gateway\tsha256:yarp\n" +
        "ninja-red\tred-catalog-api\tsha256:catalog-1\n";

    private const string Images =
        "ninja-catalog:local\tsha256:catalog-1\n" +
        "ninja-branch:local\tsha256:branch-1\n";

    [TestMethod]
    public async Task Images_built_on_the_box_are_compared_to_what_the_containers_run()
    {
        // A laptop: the images are built here and tagged local, nothing is pulled
        var (cache, _, shell) = Cache(new PlatformOptions { PullImages = false, ImageRegistry = "ninja", DefaultImageTag = "local" }, "local", Inspect, Images);

        var snapshot = await cache.RefreshAsync(CancellationToken.None);

        Assert.IsTrue(snapshot.Tenants["blue"].Behind);
        CollectionAssert.AreEqual(new[] { "catalog" }, snapshot.Tenants["blue"].Services.ToArray());
        Assert.IsFalse(snapshot.Tenants["red"].Behind);
        Assert.IsFalse(snapshot.Tenants.ContainsKey("gone"));
        Assert.AreEqual(0, snapshot.Releases.Count);
        Assert.IsFalse(cache.Stale);
        // Nothing was pulled, and the registry was not asked
        Assert.IsTrue(shell.Commands.All(c => c.StartsWith("docker ps") || c.StartsWith("docker inspect") || c.StartsWith("docker images")), string.Join("\n", shell.Commands));
    }

    [TestMethod]
    public async Task The_registry_wins_over_the_box_and_a_release_is_a_tag_all_twelve_carry()
    {
        var registryImages =
            "ghcr.io/x/ninja-catalog:latest\tsha256:catalog-1\n" +
            "ghcr.io/x/ninja-branch:latest\tsha256:branch-1\n";
        var (cache, registry, _) = Cache(new PlatformOptions { PullImages = true, ImageRegistry = "ghcr.io/x/ninja" }, "latest", Inspect, registryImages);
        foreach (var service in TenantNaming.Services)
            registry.Images[service] = new() { ["latest"] = service == "branch" ? "sha256:branch-2" : "sha256:catalog-1", ["v2026.9.21"] = "sha256:r" };
        // One service missed the older release build: it is not a release of the platform
        registry.Images["sales"]["v2026.9.1"] = "sha256:s";
        registry.Images["catalog"]["v2026.9.1"] = "sha256:s";

        var snapshot = await cache.RefreshAsync(CancellationToken.None);

        // red's catalog matches the registry; blue's catalog is old and its branch is behind the registry although it matches the box
        Assert.IsFalse(snapshot.Tenants["red"].Behind);
        CollectionAssert.AreEqual(new[] { "catalog", "branch" }, snapshot.Tenants["blue"].Services.ToArray());
        CollectionAssert.AreEqual(new[] { "v2026.9.21" }, snapshot.Releases.ToArray());
        Assert.AreEqual("v2026.9.21", snapshot.NewestRelease);
    }

    [TestMethod]
    public async Task A_stale_cache_is_read_again_on_the_next_get()
    {
        var (cache, _, shell) = Cache(new PlatformOptions { PullImages = false, ImageRegistry = "ninja" }, "local", Inspect, Images);
        await cache.GetAsync(refresh: false, CancellationToken.None);
        var reads = shell.Commands.Count;
        await cache.GetAsync(refresh: false, CancellationToken.None);
        Assert.AreEqual(reads, shell.Commands.Count, "answered from the cache");

        cache.Invalidate();
        Assert.IsTrue(cache.Stale);
        await cache.GetAsync(refresh: false, CancellationToken.None);
        Assert.IsTrue(shell.Commands.Count > reads, "read again");
        Assert.IsFalse(cache.Stale);
    }
}
