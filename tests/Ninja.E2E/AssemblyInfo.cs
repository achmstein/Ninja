using Ninja.E2E.Harness;

// One AppHost boot for the whole assembly; scenarios share Branch 1 and its
// single open shift, so they run one at a time.
[assembly: AssemblyFixture(typeof(NinjaApp))]
[assembly: CollectionBehavior(DisableTestParallelization = true)]
