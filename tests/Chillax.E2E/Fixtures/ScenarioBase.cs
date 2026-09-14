using Chillax.E2E.Actors;
using Chillax.E2E.Harness;
using Chillax.E2E.Manifest;
using Chillax.E2E.Support;

namespace Chillax.E2E.Fixtures;

/// <summary>
/// A workflow scenario: the floor is reset, a shift is opened with
/// <see cref="OpeningFloat"/>, the steps run, and the floor is reset again.
/// Assertion helpers wrap the recorders with the scenario's own markers so
/// each step only sees what happened after it began.
/// </summary>
public abstract class ScenarioBase(ChillaxApp app, DaySetup day) : ScenarioTest(app)
{
    protected DaySetup Day { get; } = day;
    protected CashierActor Cashier => Day.Cashier;
    protected OwnerActor Owner => Day.Owner;
    protected KitchenActor Kitchen => Day.Kitchen;
    protected CustomerActor Customer => Day.Customer;
    protected MenuLookup Menu => Day.Menu;
    protected EventRecorder Events => App.Events;
    protected HubRecorder Hub => App.Hub;

    protected virtual decimal OpeningFloat => 500m;
    protected virtual bool OpensShift => true;

    protected int ShiftId { get; private set; }

    /// <summary>Recorders' position just before the scenario's shift was opened.</summary>
    protected Checkpoint BeforeShift { get; private set; } = null!;

    /// <summary>The business day the scenario started on; Finance and Payroll date everything by it.</summary>
    protected DateOnly BusinessDay { get; private set; }

    public override async ValueTask InitializeAsync()
    {
        await base.InitializeAsync();
        await Housekeeping.ResetAsync(Day, Ct);
        BusinessDay = Money.BusinessDayNow();
        BeforeShift = App.Checkpoint();

        if (OpensShift)
        {
            ShiftId = await Cashier.OpenShiftAsync(OpeningFloat, Ct);
            // Ordering only takes customer orders once Branch's flag has landed on it.
            await Events.WaitForAsync("BranchSettingsChanged", e => e.Int("BranchId") == 1 && e.Bool("IsOrderingEnabled"), Ct, BeforeShift.Events);
        }
    }

    public override async ValueTask DisposeAsync()
    {
        try
        {
            await Housekeeping.ResetAsync(Day, CancellationToken.None);
        }
        finally
        {
            await base.DisposeAsync();
        }
    }

    // --- Step helpers ----------------------------------------------------------

    /// <summary>Marks the recorders and logs the step so the output reads like the script.</summary>
    protected Checkpoint Step(string description)
    {
        TestContext.Current.TestOutputHelper?.WriteLine($"[{DateTime.UtcNow:HH:mm:ss}] {description}");
        return App.Checkpoint();
    }

    /// <summary>Fails if the 06:00 Cairo cutoff was crossed since the scenario started; date-keyed assertions would be meaningless.</summary>
    protected void AssertSameBusinessDay()
    {
        var now = Money.BusinessDayNow();
        Assert.True(now == BusinessDay, $"The business day rolled over from {BusinessDay} to {now} during the scenario; rerun it.");
    }

    protected Task<RecordedEvent> ExpectEventAsync(Checkpoint since, string name, Func<RecordedEvent, bool>? where = null)
        => Events.WaitForAsync(name, where, null, Ct, since.Events);

    protected Task ExpectNoEventAsync(Checkpoint since, string name)
        => Events.AssertNoneAsync(name, since.Events, Ct);

    protected Task<HubMessage> ExpectHubAsync(Checkpoint since, string method, Func<HubMessage, bool>? where = null)
        => Hub.WaitForAsync(method, where, null, Ct, since.Hub);

    protected Task<HubMessage> ExpectOrderStatusAsync(Checkpoint since, string type, int? orderId = null)
        => Hub.WaitForOrderStatusAsync(type, Ct, since.Hub, orderId is null ? null : m => m.Int("orderId") == orderId);

    protected Task<HubMessage> ExpectRoomStatusAsync(Checkpoint since, string type, int? roomId = null)
        => Hub.WaitForRoomStatusAsync(type, Ct, since.Hub, roomId is null ? null : m => m.Int("roomId") == roomId);

    /// <summary>Polls a GET until the assertion holds; the default 20 s covers a RabbitMQ hop and a handler.</summary>
    protected Task ExpectAsync(string because, Func<Task> assertion, TimeSpan? timeout = null)
        => Eventually.Async(assertion, because, Ct, timeout);

    protected Task<T> ExpectValueAsync<T>(string because, Func<Task<T?>> probe, TimeSpan? timeout = null) where T : class
        => Eventually.ValueAsync(probe, because, Ct, timeout);

    protected async Task<TicketDetail> TicketAsync(int ticketId)
        => await Cashier.TicketAsync(ticketId, Ct) ?? throw new Xunit.Sdk.XunitException($"ticket {ticketId} not found");

    protected async Task<ShiftView> CurrentShiftAsync()
        => await Cashier.CurrentShiftAsync(Ct) ?? throw new Xunit.Sdk.XunitException("no open shift");

    protected static SaleLine[] Lines(params (string Item, int Qty)[] lines) => lines.Select(l => new SaleLine(l.Item, l.Qty)).ToArray();

    protected static string Key(string shortName) => KnownEvents.Key(shortName);
}
