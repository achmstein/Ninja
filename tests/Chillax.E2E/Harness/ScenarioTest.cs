using Chillax.E2E.Fixtures;

namespace Chillax.E2E.Harness;

/// <summary>
/// Every test that touches the booted system lives in this collection: one
/// branch, one drawer, so scenarios run one at a time and share DaySetup.
/// </summary>
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class E2ECollection : ICollectionFixture<DaySetup>
{
    public const string Name = "chillax-e2e";
}

/// <summary>
/// Base for anything that talks to the booted system: takes a checkpoint
/// before the test and, when the test fails, writes everything the recorders
/// saw since then to the test output so the failure explains itself.
/// </summary>
[Collection(E2ECollection.Name)]
public abstract class ScenarioTest(ChillaxApp app) : IAsyncLifetime
{
    protected ChillaxApp App { get; } = app;
    protected Checkpoint Checkpoint { get; private set; } = null!;
    protected static CancellationToken Ct => TestContext.Current.CancellationToken;

    public virtual ValueTask InitializeAsync()
    {
        Checkpoint = App.Checkpoint();
        return ValueTask.CompletedTask;
    }

    public virtual ValueTask DisposeAsync()
    {
        if (TestContext.Current.TestState?.Result == TestResult.Failed)
            TestContext.Current.TestOutputHelper?.WriteLine(App.Dump(Checkpoint));
        return ValueTask.CompletedTask;
    }
}
