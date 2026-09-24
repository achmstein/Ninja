#nullable enable
namespace Ninja.Ordering.Domain.AggregatesModel.KitchenAggregate;

public interface IKitchenStationRepository : IRepository<KitchenStation>
{
    /// <summary>
    /// The branch's stations in display order. A branch that has none gets
    /// its default station here (added, not yet saved), so every branch
    /// routes as it did before stations existed.
    /// </summary>
    Task<List<KitchenStation>> GetForBranchAsync(int branchId);

    Task<KitchenStation?> GetAsync(int stationId);

    void Add(KitchenStation station);

    void Remove(KitchenStation station);

    /// <summary>Whether any order still on a kitchen screen has a part at this station waiting.</summary>
    Task<bool> HasOpenPartsAsync(int stationId);
}

public interface IKitchenPrintJobRepository : IRepository<KitchenPrintJob>
{
    Task<KitchenPrintJob?> GetAsync(int jobId);

    void Add(KitchenPrintJob job);

    /// <summary>
    /// Takes the job for <paramref name="deviceId"/> in one statement: only
    /// when nobody printed it and nobody holds a live claim. Two devices
    /// asking at once, exactly one gets true.
    /// </summary>
    Task<bool> TryClaimAsync(int jobId, string deviceId, DateTime now);

    /// <summary>The station is gone: its unprinted tickets have nowhere to print, so they go too.</summary>
    Task DropUnprintedAsync(int stationId);
}

public interface IPrintConnectorRepository : IRepository<PrintConnector>
{
    Task<PrintConnector?> GetAsync(int connectorId);

    Task<List<PrintConnector>> GetForBranchAsync(int branchId);

    void Add(PrintConnector connector);

    void Remove(PrintConnector connector);

    void AddPairing(ConnectorPairing pairing);

    /// <summary>The live code, normalized; null when none matches.</summary>
    Task<ConnectorPairing?> GetPairingAsync(string code);
}
