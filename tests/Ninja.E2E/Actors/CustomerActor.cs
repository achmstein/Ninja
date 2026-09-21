using Ninja.E2E.Harness;
using Ninja.E2E.Support;

namespace Ninja.E2E.Actors;

/// <summary>
/// A signed-in customer on client_web (src/client_web/src/routes/*).
/// <paramref name="staff"/> is a till token used only to look up the order
/// number after placing: POST /api/orders answers a bare 200.
/// </summary>
public sealed class CustomerActor(ApiClient api, AccessToken identity, ApiClient staff)
{
    public ApiClient Api { get; } = api;

    /// <summary>The Keycloak subject: what Loyalty, Accounts and Spaces key this customer on.</summary>
    public string UserId { get; } = identity.Subject;

    public string DisplayName { get; } = identity.Name ?? identity.PreferredUsername;

    /// <summary>
    /// cart.tsx "Place order". Ordering gates customer orders on the branch's
    /// IsOrderingEnabled projection, which lands a moment after the shift
    /// opens, so a "not taking orders" 400 is retried for a while.
    /// </summary>
    public async Task<int> PlaceOrderAsync(MenuLookup menu, SaleLine[] lines, CancellationToken ct, int? placeId = null, string? placeNameEn = null,
        int pointsToRedeem = 0, bool retryWhileClosed = true)
    {
        var before = DateTime.UtcNow.AddSeconds(-5);
        var body = new
        {
            userId = "",
            userName = DisplayName,
            customerNote = (string?)null,
            pointsToRedeem,
            loyaltyDiscount = 0.0,
            items = lines.Select(l =>
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
            }).ToArray(),
            placeId,
            placeKind = placeId is null ? null : "Table",
            placeName = placeNameEn is null ? null : new { en = placeNameEn, ar = placeNameEn },
            guestName = (string?)null,
            guestPhone = (string?)null,
            sessionId = (int?)null,
        };

        if (retryWhileClosed)
        {
            await Eventually.Async(async () =>
            {
                using var r = await Api.PostAsync("/api/orders", body, ct, ensureSuccess: false);
                if (r.IsSuccessStatusCode)
                    return true;
                var text = await r.Content.ReadAsStringAsync(ct);
                if (r.StatusCode == HttpStatusCode.BadRequest && text.Contains("not taking orders", StringComparison.OrdinalIgnoreCase))
                    return false;
                throw new ApiException(HttpMethod.Post, r.RequestMessage?.RequestUri, r.StatusCode, text, null);
            }, "the branch to take customer orders", ct);
        }
        else
        {
            using var r = await Api.PostAsync("/api/orders", body, ct);
        }

        // The response carries no id; the pending queue does.
        var number = await Eventually.ValueAsync<int?>(async () =>
        {
            var pending = await staff.GetAsync<List<OrderSummary>>("/api/orders/pending", ct);
            var mine = pending
                .Where(o => o.UserId == UserId && o.Date >= before && (placeId is null || o.PlaceId == placeId))
                .OrderByDescending(o => o.OrderNumber)
                .FirstOrDefault();
            return mine?.OrderNumber;
        }, "the customer's order in the pending queue", ct);
        return number!.Value;
    }

    public Task<HttpResponseMessage> TryPlaceOrderAsync(MenuLookup menu, SaleLine[] lines, CancellationToken ct, int? placeId = null, string? placeNameEn = null)
    {
        var m = menu.Item(lines[0].Item);
        return Api.PostAsync("/api/orders", new
        {
            userId = "",
            userName = DisplayName,
            roomName = (object?)null,
            customerNote = (string?)null,
            pointsToRedeem = 0,
            loyaltyDiscount = 0.0,
            items = lines.Select(l => new
            {
                id = Guid.NewGuid().ToString(),
                productId = menu.Item(l.Item).Id,
                productName = new { en = menu.Item(l.Item).Name.En, ar = menu.Item(l.Item).Name.Ar ?? menu.Item(l.Item).Name.En },
                unitPrice = menu.Item(l.Item).EffectivePrice,
                quantity = l.Qty,
                pictureUrl = (string?)null,
                specialInstructions = (string?)null,
                selectedCustomizations = Array.Empty<object>(),
            }).ToArray(),
            placeId,
            placeKind = placeId is null ? null : "Table",
            placeName = placeNameEn is null ? null : new { en = placeNameEn, ar = placeNameEn },
            guestName = (string?)null,
            guestPhone = (string?)null,
            sessionId = (int?)null,
        }, ct, ensureSuccess: false);
    }

    /// <summary>routes/loyalty.tsx</summary>
    public Task<LoyaltyAccount?> MyLoyaltyAsync(CancellationToken ct)
        => Api.GetOrDefaultAsync<LoyaltyAccount>($"/api/loyalty/accounts/{UserId}", ct);

    public Task<List<LoyaltyTransaction>> MyLoyaltyTransactionsAsync(CancellationToken ct)
        => Api.GetAsync<List<LoyaltyTransaction>>($"/api/loyalty/transactions/{UserId}", ct);

    /// <summary>routes/account.tsx</summary>
    public Task<AccountView?> MyTabAsync(CancellationToken ct)
        => Api.GetOrDefaultAsync<AccountView>("/api/accounts/my", ct);

    // --- Reservations -------------------------------------------------------------

    /// <summary>hold-sheet.tsx: the customer reserves a place for now, with ten minutes to arrive.</summary>
    public Task<int> ReserveAsync(int placeId, CancellationToken ct, bool startOnConfirm = false, string? optionCode = null)
        => Api.PostAsync<int>("/api/reservations", new { placeId, startOnConfirm, optionCode }, ct);

    public Task<HttpResponseMessage> TryReserveAsync(int placeId, CancellationToken ct)
        => Api.PostAsync("/api/reservations", new { placeId }, ct, ensureSuccess: false);

    /// <summary>The customer's reservations, newest first: the one they are on their way to, and history.</summary>
    public Task<List<ReservationView>> MyReservationsAsync(CancellationToken ct)
        => Api.GetAsync<List<ReservationView>>("/api/reservations/my", ct);

    /// <summary>held-banner.tsx: give up one's own reservation; refused once seated.</summary>
    public Task<HttpResponseMessage> TryCancelMyReservationAsync(int reservationId, CancellationToken ct)
        => Api.PostAsync($"/api/reservations/my/{reservationId}/cancel", null, ct, ensureSuccess: false);

    /// <summary>In-room "call the waiter" (lib/services/notifications.ts).</summary>
    public Task<ServiceRequestResponse> RequestServiceAsync(int stayId, int placeId, string placeNameEn, int requestType, CancellationToken ct)
        => Api.PostAsync<ServiceRequestResponse>("/api/notifications/service-requests", new
        {
            sessionId = stayId,
            placeId,
            placeKind = "Room",
            placeName = new { en = placeNameEn, ar = placeNameEn },
            requestType,
        }, ct);
}
