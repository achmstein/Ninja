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

    [TestMethod]
    public async Task The_box_the_control_plane_runs_on_answers_a_ping()
    {
        var (status, body) = await Api.AsPlatformAdmin().PingNodeAsync(Node.HomeId);
        Assert.AreEqual(HttpStatusCode.OK, status, body);
        StringAssert.Contains(body, "\"docker\":true");
        Assert.IsNotNull((await Api.AsPlatformAdmin().NodesAsync()).Single(n => n.Id == Node.HomeId).LastSeenAt);
    }

    [TestMethod]
    public async Task A_node_elsewhere_goes_on_the_record_cordoned_and_says_plainly_when_it_does_not_answer()
    {
        var api = Api.AsPlatformAdmin();
        var name = $"node-{Guid.NewGuid():N}"[..14];
        var pin = new string('A', 64);
        var request = new RegisterNodeRequest(name, "https://10.66.0.9:7443", "http://10.66.0.9:8088", pin, Labels: ["Demo"], KeycloakInternalUrl: "http://10.66.0.1:8090");

        Assert.AreEqual(HttpStatusCode.BadRequest, (await api.RegisterNodeAsync(request with { AgentUrl = "http://10.66.0.9:7443" })).Status, "the agent speaks TLS");
        Assert.AreEqual(HttpStatusCode.BadRequest, (await api.RegisterNodeAsync(request with { CertThumbprint = "abc" })).Status, "a pin is a SHA-256");
        Assert.AreEqual(HttpStatusCode.BadRequest, (await api.RegisterNodeAsync(request with { Name = "Node Two" })).Status);

        var (status, body) = await api.RegisterNodeAsync(request);
        Assert.AreEqual(HttpStatusCode.Created, status, body);
        Assert.AreEqual(HttpStatusCode.Conflict, (await api.RegisterNodeAsync(request)).Status, "one node a name");

        var node = (await api.NodesAsync()).Single(n => n.Name == name);
        Assert.AreEqual(NodeKind.Agent, node.Kind);
        Assert.AreEqual(NodeStatus.Cordoned, node.Status, "no tenant lands on a node nobody has seen work");
        CollectionAssert.AreEqual(new[] { "demo" }, node.Labels.ToArray());

        // The test box has no client certificate for agents, and nothing listens there anyway
        var ping = await api.PingNodeAsync(node.Id);
        Assert.AreEqual(HttpStatusCode.BadGateway, ping.Status);
        StringAssert.Contains(ping.Body, "does not answer");
        Assert.IsNotNull((await api.NodesAsync()).Single(n => n.Id == node.Id).LastError);

        // A cordoned node takes no new tenant, even one placed there by name, unless forced
        await api.UpdateNodeAsync(node.Id, new UpdateNodeRequest(Status: NodeStatus.Cordoned));
    }
}
