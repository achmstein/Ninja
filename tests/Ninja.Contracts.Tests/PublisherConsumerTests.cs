namespace Ninja.Contracts.Tests;

/// <summary>
/// The choreography as wired: an event somebody waits for must be produced
/// by somebody, and an event somebody produces must be waited for — with the
/// known dead ends listed exactly, so a revived or newly orphaned event fails.
/// </summary>
[TestClass]
public sealed class PublisherConsumerTests
{
    [TestMethod]
    public void Every_subscribed_event_has_a_publisher()
    {
        var tree = SourceTree.Current;
        var orphans = tree.Consumers.Keys
            .Where(name => !tree.Publishers.ContainsKey(name))
            .Except(Allowlist.DeadConsumers)
            .Order()
            .ToList();

        Assert.IsEmpty(orphans,
            $"Subscribed to but never published (add a publisher, or list under Allowlist.DeadConsumers):\n  {string.Join("\n  ", orphans.Select(n => $"{n} ← {string.Join(", ", tree.Consumers[n])}"))}");
    }

    [TestMethod]
    public void Every_published_event_has_a_consumer()
    {
        var tree = SourceTree.Current;
        var unheard = tree.Publishers.Keys
            .Where(name => !tree.Consumers.ContainsKey(name))
            .Except(Allowlist.DeadPublishers)
            .Order()
            .ToList();

        Assert.IsEmpty(unheard,
            $"Published but nobody subscribes (add a subscription, or list under Allowlist.DeadPublishers):\n  {string.Join("\n  ", unheard.Select(n => $"{n} ← {string.Join(", ", tree.Publishers[n])}"))}");
    }

    [TestMethod]
    public void The_allowlists_are_exact()
    {
        var tree = SourceTree.Current;

        var revivedConsumers = Allowlist.DeadConsumers.Where(n => tree.Publishers.ContainsKey(n) || !tree.Consumers.ContainsKey(n)).ToList();
        Assert.IsEmpty(revivedConsumers,
            $"No longer dead consumers (remove from Allowlist.DeadConsumers): {string.Join(", ", revivedConsumers)}");

        var revivedPublishers = Allowlist.DeadPublishers.Where(n => tree.Consumers.ContainsKey(n) || !tree.Publishers.ContainsKey(n)).ToList();
        Assert.IsEmpty(revivedPublishers,
            $"No longer dead publishers (remove from Allowlist.DeadPublishers): {string.Join(", ", revivedPublishers)}");
    }

    [TestMethod]
    public void Each_event_is_published_by_exactly_one_service()
    {
        var tree = SourceTree.Current;
        var shared = tree.Publishers.Where(kv => kv.Value.Count > 1).Select(kv => $"{kv.Key} ← {string.Join(", ", kv.Value)}").ToList();
        Assert.IsEmpty(shared, $"Events constructed in more than one service:\n  {string.Join("\n  ", shared)}");
    }

    [TestMethod]
    public void Every_event_a_service_subscribes_to_has_a_local_copy()
    {
        var tree = SourceTree.Current;
        var missing = new List<string>();
        foreach (var (name, services) in tree.Consumers)
        {
            foreach (var service in services)
            {
                if (!tree.Events.TryGetValue(name, out var copies) || copies.All(c => c.Service != service))
                    missing.Add($"{service} subscribes to {name} but declares no copy of it");
            }
        }
        Assert.IsEmpty(missing, string.Join("\n", missing));
    }
}
