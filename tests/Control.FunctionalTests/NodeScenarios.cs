using System.Net;
using Ninja.Control.API.Apis;
using Ninja.Control.API.Model;

namespace Ninja.Control.FunctionalTests;

/// <summary>The boxes tenants run on, as the platform sees them: one today, the box the control plane runs on.</summary>
[TestClass]
public sealed class NodeScenarios
{
    [TestMethod]
    public async Task The_box_the_control_plane_runs_on_is_node_1_and_a_new_tenant_lives_there()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("node");
        var created = await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);

        Assert.AreEqual(Node.HomeId, created.NodeId, "placed on the only node there is");
        var nodes = await api.NodesAsync();
        var home = nodes.Single(n => n.Id == Node.HomeId);
        Assert.AreEqual("node-1", home.Name);
        Assert.AreEqual(NodeKind.Local, home.Kind);
        Assert.AreEqual(NodeStatus.Active, home.Status);
        Assert.IsTrue(home.Tenants >= 1, "the tenant just made lives here");
        Assert.IsNull(home.StackFootprintMb, "its limits are the platform's");
        Assert.AreEqual(Node.HomeId, (await api.ListAsync()).Single(t => t.Slug == slug).NodeId);
    }

    [TestMethod]
    public async Task A_node_is_labelled_and_given_its_own_limits_but_not_drained_by_hand()
    {
        var api = Api.AsPlatformAdmin();
        try
        {
            Assert.AreEqual(HttpStatusCode.NoContent, await api.UpdateNodeAsync(Node.HomeId, new UpdateNodeRequest(Labels: [" Demo ", "demo", "customer"])));
            var home = (await api.NodesAsync()).Single(n => n.Id == Node.HomeId);
            CollectionAssert.AreEqual(new[] { "demo", "customer" }, home.Labels.ToArray(), "trimmed, lower-cased, once each");

            Assert.AreEqual(HttpStatusCode.BadRequest, await api.UpdateNodeAsync(Node.HomeId, new UpdateNodeRequest(Status: NodeStatus.Draining)), "draining moves tenants; it is not a switch");
            Assert.AreEqual(HttpStatusCode.BadRequest, await api.UpdateNodeAsync(Node.HomeId, new UpdateNodeRequest(StackFootprintMb: -1)));
            Assert.AreEqual(HttpStatusCode.NotFound, await api.UpdateNodeAsync(9999, new UpdateNodeRequest(Labels: [])));
        }
        finally
        {
            await api.UpdateNodeAsync(Node.HomeId, new UpdateNodeRequest(Labels: []));
        }
    }
}
