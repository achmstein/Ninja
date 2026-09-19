using Ninja.E2E.Actors;
using Ninja.E2E.Harness;
using Ninja.E2E.Manifest;
using Ninja.E2E.Support;

namespace Ninja.E2E.Fixtures;

/// <summary>
/// The master data a working day needs, created once per run through the
/// same admin screens a manager would use: pricing rules, a supplier, a
/// partner, the cashier on payroll (so ShiftOpened can mark attendance),
/// tracked stock behind two menu items, and a loyalty account for the
/// customer. Everything is named with the run id so reruns never collide.
/// </summary>
public sealed class DaySetup(NinjaApp app) : IAsyncLifetime
{
    public NinjaApp App { get; } = app;
    public string RunId { get; } = DateTime.UtcNow.ToString("MMddHHmmss", System.Globalization.CultureInfo.InvariantCulture);

    public const decimal VatRate = 0.14m;
    public const decimal ServiceRate = 0.10m;
    public const decimal CashierDailyRate = 200m;
    public const decimal BeansPerCoffeeGrams = 10m;
    public const decimal BeansUnitCost = 0.50m;    // per gram → a coffee costs 5.00 of goods
    public const decimal TeaBagUnitCost = 2.00m;   // per bag  → a tea costs 2.00 of goods
    public const decimal PartnerPercent = 50m;

    public CashierActor Cashier { get; private set; } = null!;
    public OwnerActor Owner { get; private set; } = null!;
    public KitchenActor Kitchen { get; private set; } = null!;
    public CustomerActor Customer { get; private set; } = null!;
    public MenuLookup Menu { get; private set; } = null!;

    public AccessToken CashierIdentity { get; private set; } = null!;
    public AccessToken CustomerIdentity { get; private set; } = null!;

    public int SupplierId { get; private set; }
    public int PartnerId { get; private set; }
    public int ElectricityCategoryId { get; private set; }
    public int CashierEmployeeId { get; private set; }
    public int BeansId { get; private set; }
    public int TeaBagsId { get; private set; }

    public string SupplierName => $"E2E Supplier {RunId}";
    public string PartnerName => $"E2E Partner {RunId}";
    public string CashierEmployeeName => $"E2E Cashier {RunId}";

    public async ValueTask InitializeAsync()
    {
        var ct = new CancellationTokenSource(TimeSpan.FromMinutes(3)).Token;

        CashierIdentity = await App.Tokens.GetAsync(Persona.Cashier, ct);
        CustomerIdentity = await App.Tokens.GetAsync(Persona.Tester, ct);

        Cashier = new CashierActor(App.Cashier);
        Owner = new OwnerActor(App.Admin);
        Kitchen = new KitchenActor(App.Cashier);
        Customer = new CustomerActor(App.Tester, CustomerIdentity, App.Cashier);

        var mark = App.Events.Mark();

        await Owner.SetPricingAsync(VatRate, false, ServiceRate, ct);

        SupplierId = await Owner.CreateSupplierAsync(SupplierName, ct);
        PartnerId = await Owner.CreatePartnerAsync(PartnerName, PartnerPercent, ct);
        ElectricityCategoryId = (await Owner.CategoriesAsync(ct)).First(c => c.Name.En == "Electricity").Id;

        // Payroll finds the cashier by Keycloak subject when a shift opens.
        CashierEmployeeId = await Owner.HireAsync(CashierEmployeeName, Money.BusinessDayNow().AddDays(-1), CashierDailyRate, ct, userId: CashierIdentity.Subject);

        Menu = await MenuLookup.LoadAsync(App.Cashier, ct);
        BeansId = await Owner.CreateStockItemAsync($"E2E Beans {RunId}", "g", autoSoldOut: false, ct);
        TeaBagsId = await Owner.CreateStockItemAsync($"E2E Tea Bags {RunId}", "pcs", autoSoldOut: false, ct);
        await Owner.SetRecipeAsync(Menu.Item(MenuLookup.TurkishCoffee).Id, [(BeansId, BeansPerCoffeeGrams)], ct);
        await Owner.SetRecipeAsync(Menu.Item(MenuLookup.Tea).Id, [(TeaBagsId, 1m)], ct);

        // No supplier on this receipt: it is stock, not a Finance invoice.
        await Owner.ReceivePurchaseAsync([(BeansId, 1000m, BeansUnitCost), (TeaBagsId, 50m, TeaBagUnitCost)], ct, invoiceRef: $"OPEN-{RunId}");

        await Owner.CreateLoyaltyAccountAsync(Customer.UserId, Customer.DisplayName, ct);

        // Let the setup's own events drain before any scenario starts counting.
        await App.Events.WaitForAsync(KnownEvents.Key("PurchaseReceived"), ct, mark);
        await App.Events.WaitForAsync(KnownEvents.Key("EmployeeEarningsChanged"), e => e.Int("EmployeeId") == CashierEmployeeId, ct, mark);
        await Task.Delay(1500, ct);

        await ObserveFirstShiftOfTheDayAsync(ct);
    }

    /// <summary>
    /// Whether the cashier's till-marked attendance (Payroll's ShiftOpened
    /// handler) refreshed the month's payslip and reached Finance as labour.
    /// Only the first shift of a business day marks attendance, so this is
    /// observed once, here, on the run's very first shift.
    /// </summary>
    public bool TillAttendanceRefreshedEarnings { get; private set; }

    private async Task ObserveFirstShiftOfTheDayAsync(CancellationToken ct)
    {
        var day = Money.BusinessDayNow();
        var mark = App.Events.Mark();
        var shiftId = await Cashier.OpenShiftAsync(0m, ct);
        await App.Events.WaitForAsync("ShiftOpened", e => e.Int("ShiftId") == shiftId, ct, mark);
        await Eventually.Async(async () =>
            (await Owner.AttendanceAsync(day, day, ct)).Any(m => m.EmployeeId == CashierEmployeeId), "the till to clock the cashier in", ct);

        try
        {
            await App.Events.WaitForAsync("EmployeeEarningsChanged", e => e.Int("EmployeeId") == CashierEmployeeId, TimeSpan.FromSeconds(8), ct, mark);
            TillAttendanceRefreshedEarnings = true;
        }
        catch (TimeoutException)
        {
            TillAttendanceRefreshedEarnings = false;
        }

        await Cashier.CloseShiftAsync(shiftId, 0m, ct);
        await App.Events.WaitForAsync("BranchSettingsChanged", e => e.Int("BranchId") == 1 && !e.Bool("IsOrderingEnabled"), ct, mark);
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}
