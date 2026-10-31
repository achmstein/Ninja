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
    public void A_stack_is_reached_at_its_gateway_by_container_name_with_no_host_to_ask_for()
    {
        var route = Nodes().Home.RouteTo("blue");

        Assert.AreEqual("http://blue-gateway:5000/api/tenant/brand?x=1", new Uri(route.BaseAddress, "/api/tenant/brand?x=1").ToString());
        Assert.IsNull(route.Host);
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
