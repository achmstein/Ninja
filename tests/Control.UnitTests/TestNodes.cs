using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Extensions;
using Ninja.Control.API.Platform;
using Ninja.Control.API.Platform.Nodes;

namespace Ninja.Control.UnitTests;

/// <summary>
/// The one box the tests run tenants on: docker through the shell given (a
/// recording, or one told to fail), the databases and the broker the dry run's
/// unless a test watches its own.
/// </summary>
internal static class TestNodes
{
    public static SingleNode Over(IShell shell, IOptions<PlatformOptions> options, IDatabaseAdmin? databases = null, IBrokerAdmin? broker = null)
        => new(new LocalNodeClient(shell, options,
            databases ?? new DryRunDatabaseAdmin(NullLogger<DryRunDatabaseAdmin>.Instance),
            broker ?? new DryRunBrokerAdmin(NullLogger<DryRunBrokerAdmin>.Instance),
            new ProcHostCapacity(shell, new PlatformNodeSettings(options), NullLogger<ProcHostCapacity>.Instance)));
}
