using System.Net;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.AcceptanceTests;

/// <summary>
/// A throwaway café stamped on this box, taken up a plan and back down: the
/// containers that run, the queues on its vhost and what its gateway
/// answers are read from the box itself, not from the control plane's word
/// for it. Then it is destroyed and forgotten, so the box is as it was.
/// </summary>
[TestClass]
public sealed class PlanShapeAcceptance : AcceptanceTest
{
    private static readonly TimeSpan Patience = TimeSpan.FromMinutes(10);
    private static readonly string[] Always = ["branch", "catalog", "gateway", "identity", "notification", "ordering", "sales", "spaces"];
    private static readonly string[] StarterServices = [.. Always, "accounts", "loyalty"];
    private static readonly string[] ProServices = [.. StarterServices, "finance", "inventory", "payroll"];

    private static string[] QueuesFor(params string[] services)
        => services.Where(s => s != "gateway").Select(TenantNaming.Queue).Order().ToArray();

    [TestMethod]
    public async Task A_cafe_runs_what_its_plan_includes_up_a_plan_down_a_plan_and_through_a_stop()
    {
        var api = new ControlApi();
        var slug = $"acc-{Guid.NewGuid():N}"[..12];

        try
        {
            Step($"Stamping {slug} on Starter");
            await api.CreateAsync(slug, TenantPlan.Starter);
            var tenant = await api.SettledAsync(slug, Patience, Step);
            Assert.AreEqual(TenantStatus.Running, tenant.Status, tenant.LastError);

            // 1. Starter: ten containers, nine queues, the three modules blocked at the edge
            CollectionAssert.AreEqual(StarterServices.Order().ToArray(), Box.Containers(slug).ToArray(), "the containers a Starter café runs");
            CollectionAssert.AreEqual(QueuesFor(StarterServices), Box.Queues(slug).ToArray(), "a service that is not stamped has no queue");
            CollectionAssert.AreEqual(StarterServices.Where(s => s != "gateway").Order().ToArray(), tenant.Services.Order().ToArray(), "the control plane names the same nine");
            Assert.AreEqual(HttpStatusCode.PaymentRequired, await Box.GatewayAsync(slug, "/api/inventory/items?api-version=1.0"), "inventory is not in the plan");
            Assert.AreEqual(HttpStatusCode.NotFound, await Box.GatewayAsync(slug, "/health/inventory"), "a service that is not there has no probe");
            Assert.AreEqual(HttpStatusCode.OK, await Box.GatewayAsync(slug, "/health/loyalty"), "loyalty is in Starter and answers");
            Assert.IsTrue((await api.HealthAsync(slug)).All(h => h.Ok), "every stamped service answers through the gateway");

            // 2. Up to Pro: the three come up and their queues are declared by the consumers themselves
            Step("Up to Pro");
            await api.SetPlanAsync(slug, TenantPlan.Pro);
            await api.SettledAsync(slug, Patience, Step);
            CollectionAssert.AreEqual(ProServices.Order().ToArray(), Box.Containers(slug).ToArray(), "a module bought brings its service up");
            await Eventually(() => Box.Queues(slug).Contains("Inventory"), "the bought module's consumer declares its queue again");
            Assert.AreNotEqual(HttpStatusCode.PaymentRequired, await Box.GatewayAsync(slug, "/api/inventory/items?api-version=1.0"), "the route is open now");
            Assert.AreEqual(HttpStatusCode.OK, await Box.GatewayAsync(slug, "/health/inventory"));

            // 3. Back down: the containers go as orphans and the queues with them
            Step("Back down to Starter");
            await api.SetPlanAsync(slug, TenantPlan.Starter);
            await api.SettledAsync(slug, Patience, Step);
            CollectionAssert.AreEqual(StarterServices.Order().ToArray(), Box.Containers(slug).ToArray(), "what left the plan left the box");
            CollectionAssert.AreEqual(QueuesFor(StarterServices), Box.Queues(slug).ToArray(), "and its queue is not filling with orders it will never read");
            Assert.AreEqual(HttpStatusCode.PaymentRequired, await Box.GatewayAsync(slug, "/api/inventory/items?api-version=1.0"));

            // 4. Stop and start: the shape holds
            Step("Stop");
            await api.StopAsync(slug);
            var stopped = await api.SettledAsync(slug, Patience, Step);
            Assert.AreEqual(TenantStatus.Stopped, stopped.Status);
            Assert.IsEmpty(Box.Containers(slug), "a stopped café runs nothing");

            Step("Start");
            await api.StartAsync(slug);
            var started = await api.SettledAsync(slug, Patience, Step);
            Assert.AreEqual(TenantStatus.Running, started.Status, started.LastError);
            CollectionAssert.AreEqual(StarterServices.Order().ToArray(), Box.Containers(slug).ToArray(), "it comes back in its plan's shape");
            Assert.AreEqual(HttpStatusCode.OK, await Box.GatewayAsync(slug, "/health/loyalty"));
        }
        finally
        {
            Step($"Destroying {slug}");
            await CleanUpAsync(api, slug);
        }
    }

    private async Task CleanUpAsync(ControlApi api, string slug)
    {
        try
        {
            await api.DestroyAsync(slug);
            var destroyed = await api.SettledAsync(slug, Patience, Step);
            Assert.AreEqual(TenantStatus.Destroyed, destroyed.Status, destroyed.LastError);
            Assert.IsEmpty(Box.Containers(slug), "nothing of it is left running");
            Assert.IsFalse(Box.VHostExists(slug), "its vhost went with it");
            await api.ForgetAsync(slug);
        }
        catch (Exception ex)
        {
            TestContext.WriteLine($"Could not clean up {slug}: {ex.Message}. Destroy it from the control app.");
            throw;
        }
    }

    /// <summary>A consumer takes a moment to reconnect and declare its queue; the box is asked again until it has.</summary>
    private static async Task Eventually(Func<bool> condition, string because, int seconds = 60)
    {
        for (var i = 0; i < seconds * 2; i++)
        {
            if (condition()) return;
            await Task.Delay(500);
        }
        Assert.Fail($"Still not true after {seconds}s: {because}");
    }
}
