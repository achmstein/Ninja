using Ninja.E2E.Harness;
using Ninja.E2E.Support;

namespace Ninja.E2E.Actors;

/// <summary>A line to ring up: a menu item by English name and a quantity.</summary>
public sealed record SaleLine(string Item, int Qty);

/// <summary>A payment in a settle: the tender code and the amount, plus the tab holder for Account.</summary>
public sealed record Tender(int Code, decimal Amount, string? CustomerId = null, string? CustomerName = null)
{
    public static Tender Cash(decimal amount) => new(Codes.Tender.Cash, amount);
    public static Tender Card(decimal amount) => new(Codes.Tender.Card, amount);
    public static Tender InstaPay(decimal amount) => new(Codes.Tender.InstaPay, amount);
    public static Tender Account(decimal amount, string customerId, string customerName) => new(Codes.Tender.Account, amount, customerId, customerName);
}

public sealed record RingUpResult(int OrderId, int TicketId);

/// <summary>
/// What a cashier does at the till, each method sending exactly what pos_web
/// sends (src/pos_web/src/features/*). Signed in as the seeded cashier
/// (role Cashier, branch 1) unless another client is handed in.
/// </summary>
public sealed class CashierActor(ApiClient api)
{
    public ApiClient Api { get; } = api;

    // --- Shift ---------------------------------------------------------------

    /// <summary>open-shift-dialog.tsx</summary>
    public async Task<int> OpenShiftAsync(decimal openingFloat, CancellationToken ct)
        => (await Api.PostAsync<OpenShiftResponse>("/api/shifts/open", new { openingFloat }, ct)).ShiftId;

    public Task<HttpResponseMessage> TryOpenShiftAsync(decimal openingFloat, CancellationToken ct)
        => Api.PostAsync("/api/shifts/open", new { openingFloat }, ct, ensureSuccess: false);

    /// <summary>use-current-shift.ts: null when no shift is open.</summary>
    public Task<ShiftView?> CurrentShiftAsync(CancellationToken ct)
        => Api.GetOrDefaultAsync<ShiftView>("/api/shifts/current", ct);

    public Task<ShiftView> ShiftAsync(int shiftId, CancellationToken ct)
        => Api.GetAsync<ShiftView>($"/api/shifts/{shiftId}", ct);

    /// <summary>movement-dialog.tsx: money into the drawer.</summary>
    public Task<HttpResponseMessage> PayInAsync(int shiftId, decimal amount, string reason, CancellationToken ct,
        int kind = Codes.MovementKind.Other, int? supplierId = null, string? supplierName = null, int? partnerId = null, string? partnerName = null,
        int? employeeId = null, string? employeeName = null, int? categoryId = null)
        => MovementAsync(shiftId, Codes.MovementType.PayIn, amount, reason, kind, employeeId, employeeName, supplierId, supplierName, partnerId, partnerName, categoryId, ct);

    /// <summary>movement-dialog.tsx: money out of the drawer, typed by what it was for.</summary>
    public Task<HttpResponseMessage> PayOutAsync(int shiftId, decimal amount, string reason, CancellationToken ct,
        int kind = Codes.MovementKind.Other, int? employeeId = null, string? employeeName = null, int? supplierId = null, string? supplierName = null,
        int? partnerId = null, string? partnerName = null, int? categoryId = null)
        => MovementAsync(shiftId, Codes.MovementType.PayOut, amount, reason, kind, employeeId, employeeName, supplierId, supplierName, partnerId, partnerName, categoryId, ct);

    private Task<HttpResponseMessage> MovementAsync(int shiftId, int type, decimal amount, string reason, int kind, int? employeeId, string? employeeName,
        int? supplierId, string? supplierName, int? partnerId, string? partnerName, int? categoryId, CancellationToken ct)
        => Api.PostAsync($"/api/shifts/{shiftId}/movements",
            new { type, amount, reason, kind, employeeId, employeeName, supplierId, supplierName, partnerId, partnerName, categoryId },
            ct, ensureSuccess: false);

    /// <summary>close-shift-dialog.tsx: count the drawer; the Z report comes back.</summary>
    public Task<ShiftView> CloseShiftAsync(int shiftId, decimal closingCount, CancellationToken ct)
        => Api.PostAsync<ShiftView>($"/api/shifts/{shiftId}/close", new { closingCount }, ct);

    // --- Selling -------------------------------------------------------------

    /// <summary>
    /// features/sale/index.tsx "Charge": POST /api/orders/pos with the cart,
    /// then poll GET /api/tickets/by-order/{orderId} until Sales has put the
    /// lines on a ticket (the POS does this every 600 ms for 12 s).
    /// </summary>
    public async Task<RingUpResult> RingUpAsync(MenuLookup menu, SaleLine[] lines, CancellationToken ct,
        string? customerUserId = null, string? customerName = null, int? ticketId = null, int pointsToRedeem = 0)
    {
        var orderId = await PlacePosOrderAsync(menu, lines, ct, customerUserId, customerName, ticketId, pointsToRedeem);
        var ticket = await Eventually.ValueAsync(
            () => Api.GetOrDefaultAsync<OpenTicketResponse>($"/api/tickets/by-order/{orderId}", ct),
            $"order {orderId} to land on a ticket", ct);
        return new RingUpResult(orderId, ticket.TicketId);
    }

    /// <summary>Same as RingUpAsync but tolerates the order never reaching a ticket (a stock-rejected sale).</summary>
    public async Task<(int OrderId, int? TicketId)> TryRingUpAsync(MenuLookup menu, SaleLine[] lines, CancellationToken ct, TimeSpan? wait = null)
    {
        var orderId = await PlacePosOrderAsync(menu, lines, ct, null, null, null, 0);
        OpenTicketResponse? ticket = null;
        try
        {
            ticket = await Eventually.ValueAsync(
                () => Api.GetOrDefaultAsync<OpenTicketResponse>($"/api/tickets/by-order/{orderId}", ct),
                $"order {orderId} to land on a ticket", ct, wait ?? TimeSpan.FromSeconds(8));
        }
        catch (TimeoutException)
        {
            // expected for a rejected order
        }
        return (orderId, ticket?.TicketId);
    }

    private async Task<int> PlacePosOrderAsync(MenuLookup menu, SaleLine[] lines, CancellationToken ct,
        string? customerUserId, string? customerName, int? ticketId, int pointsToRedeem)
    {
        var items = lines.Select(l =>
        {
            var m = menu.Item(l.Item);
            return new
            {
                id = Guid.NewGuid().ToString(),
                productId = m.Id,
                productName = new { en = m.Name.En, ar = m.Name.Ar ?? m.Name.En },
                unitPrice = m.EffectivePrice,
                quantity = l.Qty,
                pictureUrl = (string?)null,
                specialInstructions = (string?)null,
                selectedCustomizations = Array.Empty<object>(),
            };
        }).ToArray();

        var response = await Api.PostAsync<PosOrderResponse>("/api/orders/pos", new
        {
            items,
            customerNote = (string?)null,
            ticketId,
            customerUserId,
            // Ordering refuses an account without a display name
            customerUserName = customerUserId is null ? null : customerName,
            customerName,
            pointsToRedeem,
        }, ct);

        if (response.OrderId == 0)
            throw new InvalidOperationException("POS order was deduplicated (orderId 0) - an x-requestid was reused");
        return response.OrderId;
    }

    // --- Tickets -------------------------------------------------------------

    public Task<TicketDetail?> TicketAsync(int ticketId, CancellationToken ct)
        => Api.GetOrDefaultAsync<TicketDetail>($"/api/tickets/{ticketId}", ct);

    public Task<List<TicketSummary>> OpenTicketsAsync(CancellationToken ct)
        => Api.GetAsync<List<TicketSummary>>("/api/tickets/open", ct);

    public Task<List<SettledTicketSummary>> SettledTicketsAsync(CancellationToken ct)
        => Api.GetAsync<List<SettledTicketSummary>>("/api/tickets/settled?pageIndex=0&pageSize=50", ct);

    /// <summary>status: 1 Settled, 2 Voided.</summary>
    public Task<PagedResult<TicketHistoryRow>> HistoryAsync(int status, CancellationToken ct)
        => Api.GetAsync<PagedResult<TicketHistoryRow>>($"/api/tickets/history?status={status}&pageIndex=0&pageSize=50", ct);

    /// <summary>floor: open a table bill or a labelled counter tab before any order lands on it.</summary>
    public async Task<int> OpenTicketAsync(int type, CancellationToken ct, int? placeId = null, string? placeNameEn = null, string? label = null)
        => (await Api.PostAsync<OpenTicketResponse>("/api/tickets", new
        {
            type,
            placeId,
            placeName = placeNameEn is null ? null : new { en = placeNameEn, ar = placeNameEn },
            label,
        }, ct)).TicketId;

    /// <summary>settle-dialog.tsx</summary>
    public Task<SettleResult> SettleAsync(int ticketId, CancellationToken ct, params Tender[] tenders)
        => Api.PostAsync<SettleResult>($"/api/tickets/{ticketId}/settle", SettleBody(tenders), ct);

    public Task<HttpResponseMessage> TrySettleAsync(int ticketId, CancellationToken ct, params Tender[] tenders)
        => Api.PostAsync($"/api/tickets/{ticketId}/settle", SettleBody(tenders), ct, ensureSuccess: false);

    private static object SettleBody(Tender[] tenders) => new
    {
        payments = tenders.Select(t => new { tender = t.Code, amount = t.Amount, customerId = t.CustomerId, customerName = t.CustomerName }).ToArray(),
        settledAt = (DateTime?)null,
        provisionalReceiptNumber = (string?)null,
    };

    /// <summary>move-target-dialog.tsx: split lines off onto a brand-new counter tab.</summary>
    public async Task<int> MoveLinesToNewCounterAsync(int ticketId, int[] lineIds, string? label, CancellationToken ct)
        => (await Api.PostAsync<OpenTicketResponse>($"/api/tickets/{ticketId}/move-lines", new
        {
            lineIds,
            targetTicketId = (int?)null,
            newTicket = new { type = Codes.TicketType.Counter, placeId = (int?)null, placeName = (object?)null, label },
        }, ct)).TicketId;

    public async Task<int> MoveLinesToAsync(int ticketId, int[] lineIds, int targetTicketId, CancellationToken ct)
        => (await Api.PostAsync<OpenTicketResponse>($"/api/tickets/{ticketId}/move-lines", new
        {
            lineIds,
            targetTicketId,
            newTicket = (object?)null,
        }, ct)).TicketId;

    /// <summary>ticket screen: put a name (and optionally an account) on some lines of a shared bill.</summary>
    public async Task NameLinesAsync(int ticketId, int[] lineIds, string? customerId, string customerName, CancellationToken ct)
    {
        using var r = await Api.PostAsync($"/api/tickets/{ticketId}/lines/customer", new { lineIds, customerId, customerName }, ct);
    }

    /// <summary>discard-dialog.tsx: an empty ticket goes away.</summary>
    public async Task DiscardAsync(int ticketId, CancellationToken ct)
    {
        using var r = await Api.DeleteAsync($"/api/tickets/{ticketId}", ct);
    }

    /// <summary>pay-tab-dialog.tsx: a customer hands the till money against their tab.</summary>
    public Task<TabPaymentResult> TakeTabPaymentAsync(string customerId, string customerName, int tender, decimal amount, CancellationToken ct)
        => Api.PostAsync<TabPaymentResult>("/api/tickets/tab-payments", new { customerId, customerName, tender, amount }, ct);

    // --- Orders from customers ------------------------------------------------

    public Task<List<OrderSummary>> PendingAsync(CancellationToken ct)
        => Api.GetAsync<List<OrderSummary>>("/api/orders/pending", ct);

    /// <summary>use-order-actions.ts confirm: staff accept a customer's order.</summary>
    public async Task ConfirmAsync(int orderNumber, CancellationToken ct)
    {
        using var r = await Api.PutAsync("/api/orders/confirm", new { orderNumber }, ct);
    }

    public async Task CancelOrderAsync(int orderNumber, CancellationToken ct)
    {
        using var r = await Api.PutAsync("/api/orders/cancel", new { orderNumber }, ct);
    }

    /// <summary>ticket screen: attach a customer to a whole order after the fact.</summary>
    public async Task AssignOrderCustomerAsync(int orderId, string? customerUserId, string customerName, CancellationToken ct)
    {
        using var r = await Api.PutAsync($"/api/orders/{orderId}/customer", new { customerUserId, customerName }, ct);
    }

    // --- Places and stays -------------------------------------------------------

    public Task<List<PlaceView>> PlacesAsync(CancellationToken ct) => Api.GetAsync<List<PlaceView>>("/api/places", ct);

    /// <summary>The seeded place with this English name on branch 1 ("Room 1", "Table 1").</summary>
    public async Task<PlaceView> PlaceAsync(string nameEn, CancellationToken ct)
        => (await PlacesAsync(ct)).FirstOrDefault(p => p.Name.En == nameEn)
           ?? throw new InvalidOperationException($"no place named {nameEn} on branch 1");

    /// <summary>features/places: a walk-in starts the clock straight away.</summary>
    public async Task<int> StartWalkInAsync(int placeId, CancellationToken ct, string optionCode = Codes.RateOption.Single)
        => (await Api.PostAsync<StartWalkInStayResult>($"/api/places/{placeId}/walk-in", new { notes = (string?)null, optionCode }, ct)).StayId;

    /// <summary>features/places: the till reserves a place for a party at the counter (or on the phone, for later); the reservation id comes back.</summary>
    public async Task<int> ReserveAsync(int placeId, CancellationToken ct, string? customerName = null, DateTime? @for = null, int? partySize = null)
        => await Api.PostAsync<int>("/api/reservations", new { placeId, customerName, @for, partySize, startOnConfirm = false }, ct);

    /// <summary>The party arrived: at a timed place the clock starts and the stay id comes back; at a plain table there is no stay.</summary>
    public async Task<int?> SeatReservationAsync(int reservationId, CancellationToken ct, string? optionCode = Codes.RateOption.Single)
        => (await Api.PostAsync<SeatResult>($"/api/reservations/{reservationId}/seat", new { optionCode }, ct)).StayId;

    /// <summary>The till acknowledges a reservation; one that asked for the clock on confirm is seated too.</summary>
    public Task<SeatResult> ConfirmReservationAsync(int reservationId, CancellationToken ct)
        => Api.PostAsync<SeatResult>($"/api/reservations/{reservationId}/confirm", new { }, ct);

    public async Task CancelReservationAsync(int reservationId, CancellationToken ct)
    {
        using var r = await Api.PostAsync($"/api/reservations/{reservationId}/cancel", null, ct);
    }

    public Task<List<ReservationView>> OpenReservationsAsync(CancellationToken ct)
        => Api.GetAsync<List<ReservationView>>("/api/reservations/open", ct);

    /// <summary>A walk-in the till may be refused (a reserved place); the caller reads the answer.</summary>
    public Task<HttpResponseMessage> TryStartWalkInAsync(int placeId, CancellationToken ct, string optionCode = Codes.RateOption.Single)
        => Api.PostAsync($"/api/places/{placeId}/walk-in", new { notes = (string?)null, optionCode }, ct, ensureSuccess: false);

    public async Task EndStayAsync(int stayId, CancellationToken ct)
    {
        using var r = await Api.PostAsync($"/api/stays/{stayId}/end", null, ct);
    }

    public async Task CancelStayAsync(int stayId, CancellationToken ct)
    {
        using var r = await Api.PostAsync($"/api/stays/{stayId}/cancel", null, ct);
    }

    public async Task ChangeStayOptionAsync(int stayId, string optionCode, CancellationToken ct)
    {
        using var r = await Api.PutAsync($"/api/stays/{stayId}/option", new { optionCode }, ct);
    }

    public async Task AddMemberAsync(int stayId, string customerId, string? customerName, CancellationToken ct)
    {
        using var r = await Api.PostAsync($"/api/stays/{stayId}/members", new { customerId, customerName }, ct);
    }

    public Task<StayView?> StayAsync(int stayId, CancellationToken ct)
        => Api.GetOrDefaultAsync<StayView>($"/api/stays/{stayId}", ct);

    public Task<List<StayView>> OpenStaysAsync(CancellationToken ct)
        => Api.GetAsync<List<StayView>>("/api/stays/open", ct);

    // --- Customer card ---------------------------------------------------------

    public Task<AccountSummary?> AccountBalanceAsync(string customerId, CancellationToken ct)
        => Api.GetOrDefaultAsync<AccountSummary>($"/api/accounts/{customerId}/balance", ct);

    public Task<LoyaltyAccount?> LoyaltyAsync(string userId, CancellationToken ct)
        => Api.GetOrDefaultAsync<LoyaltyAccount>($"/api/loyalty/accounts/{userId}", ct);

    // --- Till pickers ----------------------------------------------------------

    public Task<List<TillEmployeeView>> TillEmployeesAsync(CancellationToken ct) => Api.GetAsync<List<TillEmployeeView>>("/api/payroll/till/employees", ct);
    public Task<List<TillSupplierView>> TillSuppliersAsync(CancellationToken ct) => Api.GetAsync<List<TillSupplierView>>("/api/finance/till/suppliers", ct);
    public Task<List<TillPickView>> TillPartnersAsync(CancellationToken ct) => Api.GetAsync<List<TillPickView>>("/api/finance/till/partners", ct);
    public Task<List<TillCategoryView>> TillCategoriesAsync(CancellationToken ct) => Api.GetAsync<List<TillCategoryView>>("/api/finance/till/categories", ct);

    public Task<List<BranchView>> BranchesAsync(CancellationToken ct) => Api.GetAsync<List<BranchView>>("/api/branches", ct);

    public Task<PricingView> PricingAsync(CancellationToken ct) => Api.GetAsync<PricingView>("/api/tickets/pricing/1", ct);
}
