using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;
using Ninja.Control.API.Platform.Nodes;

namespace Ninja.Control.UnitTests;

/// <summary>The box the control plane runs on, as a node: what it answers with is what the platform did before nodes.</summary>
[TestClass]
public sealed class NodesTests
{
    private static readonly PlatformOptions Platform = new() { TenantsRoot = "/opt/ninja/tenants" };

    private static SingleNode Nodes() => TestNodes.Over(new RecordingShell(NullLogger<RecordingShell>.Instance), Options.Create(Platform));

    [TestMethod]
    public void Every_tenant_lives_on_the_box_the_control_plane_runs_on()
    {
        var nodes = Nodes();
        var blue = nodes.For(new Tenant { Slug = "blue" });
        Assert.AreSame(nodes.Home, blue);
        Assert.AreSame(blue, nodes.For(new Tenant { Slug = "red" }));
        Assert.AreEqual(new NodeRef(1, "node-1"), blue.Node);
    }

    [TestMethod]
    public void A_stack_is_reached_at_its_gateway_by_container_name_with_no_tenant_to_name()
    {
        var route = Nodes().Home.RouteTo("blue");

        Assert.AreEqual("http://blue-gateway:5000/api/tenant/brand?x=1", new Uri(route.BaseAddress, "/api/tenant/brand?x=1").ToString());
        Assert.IsNull(route.Tenant);
    }

    [TestMethod]
    public void The_box_hands_its_stacks_the_platforms_own_addresses()
    {
        var endpoints = Nodes().Home.Endpoints;

        Assert.AreEqual(NodeEndpoints.From(Platform), endpoints);
        Assert.AreEqual("postgres", endpoints.PostgresHost);
        Assert.AreEqual("aspire", endpoints.Network);
    }

    [TestMethod]
    public void The_control_planes_own_folder_is_the_tenants_folder_until_it_is_set()
    {
        var platform = new PlatformOptions { TenantsRoot = "/data/tenants" };
        Assert.AreEqual("/data/tenants", platform.ControlRoot);

        platform.ControlRoot = "/data/control";
        Assert.AreEqual("/data/control", platform.ControlRoot);
        Assert.AreEqual("/data/tenants", platform.TenantsRoot);
    }
}

/// <summary>The edge's map of tenants on other nodes: who is listed, and how.</summary>
[TestClass]
public sealed class TenantRoutesTests
{
    [TestMethod]
    public void Only_a_tenant_on_a_node_with_an_ingress_is_listed_by_slug_and_host_port()
    {
        var routes = Templates.TenantRoutes([("red", null), ("blue", "http://10.66.0.2:8088"), ("amber", "http://10.66.0.3:8088/")]);
        var lines = routes.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Where(l => !l.StartsWith('#')).ToList();

        CollectionAssert.AreEqual(new[] { "amber 10.66.0.3:8088", "blue 10.66.0.2:8088" }, lines, "sorted, red on this box is not listed");
    }

    [TestMethod]
    public void Everyone_on_this_box_leaves_the_comment_alone()
    {
        var routes = Templates.TenantRoutes([("red", null), ("blue", null)]);
        Assert.IsTrue(routes.Split('\n', StringSplitOptions.RemoveEmptyEntries).All(l => l.StartsWith('#')));
    }

    [TestMethod]
    public void The_routes_file_sits_beside_the_custom_domains_unless_set()
    {
        var platform = new PlatformOptions { EdgeSnippetPath = "/opt/ninja/platform/custom-domains.caddy" };
        Assert.AreEqual(Path.Combine(Path.GetDirectoryName(platform.EdgeSnippetPath)!, "tenant-routes.caddy"), platform.EdgeRoutesPath);
        platform.EdgeRoutesPath = "/elsewhere/routes.caddy";
        Assert.AreEqual("/elsewhere/routes.caddy", platform.EdgeRoutesPath);
    }
}
