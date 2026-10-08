using System.ComponentModel;
using System.Globalization;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;

namespace Ninja.Assistant.API.Tools;

/// <summary>
/// The business's own set-up from chat: a branch's details and switches, its
/// VAT and service charge, and an announcement to the customers' phones.
/// Each previews first and writes only on the confirm; an edit reads what is
/// there first and keeps every field the owner did not name.
/// </summary>
[McpServerToolType]
public sealed class BusinessWriteTools(TenantContext tenant, NinjaApiClient api, WriteFlow flow, TimeProvider clock)
{
    internal const string BranchTool = "update_branch";
    internal const string PricingTool = "set_pricing_rules";
    internal const string AnnouncementTool = "send_announcement";

    /// <summary>The same announcement again within this long is taken for a retried confirm, not a second send</summary>
    internal static readonly TimeSpan RepeatWindow = TimeSpan.FromMinutes(30);

    [McpServerTool(Name = BranchTool, Title = "Change a branch's details", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Changes a branch's address, phone, when its business day starts, its delivery radius, fee and minimum order, and switches online ordering, reservations and delivery on or off. Everything not given stays as it is. " +
        "Use for 'our Maadi phone is now 0225551234', 'deliver up to 5 km for 20 pounds', 'our day starts at 4 pm', 'turn reservations off at Nasr City'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> UpdateBranch(
        [Description("Branch id or name; required when the business has more than one active branch")] string? branch = null,
        [Description("The address, in English or Arabic")] string? address = null,
        [Description("The address in the other language, optional")] string? addressOtherLanguage = null,
        [Description("The branch's phone number")] string? phone = null,
        [Description("When the business day starts, HH:mm (e.g. 16:00 for a place open past midnight)")] string? dayStartTime = null,
        [Description("How far it delivers, in km (0 to 100)")] decimal? deliveryRadiusKm = null,
        [Description("The delivery fee")] decimal? deliveryFee = null,
        [Description("The smallest order it delivers")] decimal? deliveryMinimumOrder = null,
        [Description("true to deliver, false to stop delivering")] bool? delivery = null,
        [Description("true to take orders from the app and table QR codes, false to pause them")] bool? onlineOrdering = null,
        [Description("true to take reservations, false to stop")] bool? reservations = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (deliveryRadiusKm is < 0 or > 100) return ToolResults.Fail("The delivery radius is 0 to 100 km.");
        if (deliveryFee < 0 || deliveryMinimumOrder < 0) return ToolResults.Fail("The delivery fee and minimum order cannot be below zero.");
        string? dayStart = null;
        if (dayStartTime is not null)
        {
            if (!TimeOnly.TryParseExact(dayStartTime.Trim(), ["HH:mm", "H:mm"], CultureInfo.InvariantCulture, DateTimeStyles.None, out var t))
                return ToolResults.Fail("dayStartTime must be HH:mm, e.g. 16:00.");
            dayStart = t.ToString("HH:mm", CultureInfo.InvariantCulture);
        }

        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var one = BranchSelector.SelectOne(snap.Branches, branch);
        if (!one.IsOk) return ToolResults.Fail(one.Error!);
        var target = one.Value!;

        var all = await api.GetAsync<List<BranchDetails>>("tenant-api", "/api/branches/all", null, ct);
        if (!all.IsOk) return ToolResults.Fail(all.Error!);
        var now = all.Value!.FirstOrDefault(b => b.Id == target.Id);
        if (now is null) return ToolResults.Fail($"Branch {target.Id} was not found.");

        // The address is written whole; the side the owner gave replaces that side, the other is kept unless given too
        LocalizedText? newAddress = null;
        if (!string.IsNullOrWhiteSpace(address))
        {
            var given = BusinessWrite.Names(address, addressOtherLanguage);
            newAddress = new LocalizedText(given.En ?? now.Address?.En, given.Ar ?? now.Address?.Ar);
        }

        string Money(decimal a) => $"{snap.Currency} {ToolResults.Money(a)}";
        static string OnOff(bool on) => on ? "on" : "off";
        var changes = new List<string>();
        if (newAddress is not null) changes.Add($"address \"{now.Address?.Both ?? "none"}\" → \"{newAddress.Both}\"");
        if (phone is not null) changes.Add($"phone {now.Phone ?? "none"} → {phone.Trim()}");
        if (dayStart is not null) changes.Add($"business day starts {now.DayStartTime ?? "00:00"} → {dayStart}");
        if (deliveryRadiusKm is { } r) changes.Add($"delivery radius {(now.DeliveryRadiusKm is { } nr ? $"{nr:0.##} km" : "none")} → {(r == 0 ? "none" : $"{r:0.##} km")}");
        if (deliveryFee is { } f) changes.Add($"delivery fee {Money(now.DeliveryFee)} → {Money(f)}");
        if (deliveryMinimumOrder is { } m) changes.Add($"minimum delivery order {Money(now.DeliveryMinimumOrder)} → {Money(m)}");
        if (delivery is { } d) changes.Add($"delivery {OnOff(now.IsDeliveryEnabled)} → {OnOff(d)}");
        if (onlineOrdering is { } o) changes.Add($"online ordering {OnOff(now.IsOrderingEnabled)} → {OnOff(o)}");
        if (reservations is { } res) changes.Add($"reservations {OnOff(now.IsReservationsEnabled)} → {OnOff(res)}");
        if (changes.Count == 0)
            return ToolResults.Fail("Say what to change: the address, phone, day start, delivery radius, fee or minimum, or switch ordering, reservations or delivery.");

        var preview = $"At {target.BothNames}: {string.Join("; ", changes)}."
            + (dayStart is not null ? " Reports and the till's day follow the new start from the next day on." : "");
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var body = new UpdateBranchRequest(
            now.Name ?? new LocalizedText(target.DisplayName, null),
            newAddress ?? now.Address,
            phone is null ? now.Phone : BusinessWrite.Clean(phone),
            now.IsActive,
            now.DisplayOrder,
            now.TaxNumber,
            now.ReceiptFooter,
            dayStart,
            onlineOrdering,
            reservations,
            IsDeliveryEnabled: delivery,
            DeliveryRadiusKm: deliveryRadiusKm,
            DeliveryFee: deliveryFee,
            DeliveryMinimumOrder: deliveryMinimumOrder);
        var result = await api.SendAsync<BranchDetails>(HttpMethod.Put, "tenant-api", $"/api/branches/{target.Id}", target.Id, body, null, ct);
        flow.Audit(BranchTool, new { branch = target.Id, address = newAddress?.Display, phone, dayStart, deliveryRadiusKm, deliveryFee, deliveryMinimumOrder, delivery, onlineOrdering, reservations, requestId },
            result.IsOk ? "branch updated" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, branch = target.DisplayName, branchAr = target.NameAr, preview });
    }

    [McpServerTool(Name = PricingTool, Title = "Set VAT and service charge", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Sets how a branch's menu prices become the bill: the VAT rate, whether menu prices already include VAT, the service charge (on what is ordered at tables and rooms, never counter sales) and the largest discount a cashier may give. Values not given stay as they are; it applies to bills settled from now on. " +
        "Use for 'add 12% service', 'our prices include 14% VAT', 'cashiers can give up to 20% off'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> SetPricingRules(
        [Description("Branch id or name; required when the business has more than one active branch")] string? branch = null,
        [Description("VAT as a percent, e.g. 14")] decimal? vatPercent = null,
        [Description("true when menu prices already include VAT, false when it is added on top")] bool? pricesIncludeVat = null,
        [Description("Service charge as a percent, e.g. 12; 0 for none")] decimal? serviceChargePercent = null,
        [Description("The largest discount a cashier may give, as a percent, e.g. 10")] decimal? maxCashierDiscountPercent = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        foreach (var (value, what) in new[] { (vatPercent, "VAT"), (serviceChargePercent, "The service charge"), (maxCashierDiscountPercent, "The cashier discount cap") })
            if (value is < 0 or > 100) return ToolResults.Fail($"{what} is a percent from 0 to 100.");
        if (vatPercent is null && pricesIncludeVat is null && serviceChargePercent is null && maxCashierDiscountPercent is null)
            return ToolResults.Fail("Say what to change: VAT, whether prices include it, the service charge or the cashier discount cap.");

        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var one = BranchSelector.SelectOne(snapshot.Value!.Branches, branch);
        if (!one.IsOk) return ToolResults.Fail(one.Error!);
        var target = one.Value!;

        var current = await api.GetAsync<PricingView>("sales-api", $"/api/tickets/pricing/{target.Id}", target.Id, ct);
        if (!current.IsOk) return ToolResults.Fail(current.Error!);
        var now = current.Value!;
        // The owner speaks in percents; Sales keeps fractions (0.14 is 14%)
        var body = new PricingRequest(
            vatPercent is { } v ? v / 100m : now.VatRate,
            pricesIncludeVat ?? now.PricesIncludeVat,
            serviceChargePercent is { } s ? s / 100m : now.ServiceChargeRate,
            maxCashierDiscountPercent is { } c ? c / 100m : now.MaxCashierDiscountRate);

        static string Pct(decimal rate) => $"{rate * 100m:0.##}%";
        var changes = new List<string>();
        if (vatPercent is not null) changes.Add($"VAT {Pct(now.VatRate)} → {Pct(body.VatRate)}");
        if (pricesIncludeVat is not null) changes.Add($"menu prices {(now.PricesIncludeVat ? "include" : "exclude")} VAT → {(body.PricesIncludeVat ? "include" : "exclude")} it");
        if (serviceChargePercent is not null) changes.Add($"service charge {Pct(now.ServiceChargeRate)} → {Pct(body.ServiceChargeRate)}");
        if (maxCashierDiscountPercent is not null) changes.Add($"cashier discount cap {Pct(now.MaxCashierDiscountRate)} → {Pct(body.MaxCashierDiscountRate)}");
        var preview = $"At {target.BothNames}: {string.Join("; ", changes)}. Bills settled from now on follow it; printed receipts keep their figures.";

        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var result = await api.SendAsync<Unit>(HttpMethod.Put, "sales-api", $"/api/tickets/pricing/{target.Id}", target.Id, body, null, ct);
        flow.Audit(PricingTool, new { branch = target.Id, body.VatRate, body.PricesIncludeVat, body.ServiceChargeRate, body.MaxCashierDiscountRate, requestId },
            result.IsOk ? "pricing set" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, preview });
    }

    [McpServerTool(Name = AnnouncementTool, Title = "Send an announcement to customers", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = true)]
    [Description("Sends a push notification to the phones of every customer who has the business's app and has not turned off offers: a new dish, a holiday opening, a match night. It cannot be taken back once sent. " +
        "Use for 'tell our customers we open at 2 on Friday', 'announce the new summer menu'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> SendAnnouncement(
        [Description("The title, a few words")] string title,
        [Description("The message, one or two short sentences")] string body,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(body)) return ToolResults.Fail("An announcement needs a title and a message.");
        title = title.Trim();
        body = body.Trim();
        if (title.Length > 100) return ToolResults.Fail("Keep the title under 100 characters; a phone cuts it off.");
        if (body.Length > 500) return ToolResults.Fail("Keep the message under 500 characters; a phone shows only the start.");

        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);

        var preview = $"Send this to every customer with the app who has not turned off offers:\n{title}\n{body}\nIt cannot be taken back once sent.";
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        // Notification takes no request id: the same words sent a moment ago are a retried confirm, and a customer's phone rings once
        var recent = await api.GetAsync<List<AnnouncementResponse>>("notification-api", "/api/notifications/announcements?limit=20", null, ct);
        if (!recent.IsOk) return ToolResults.Fail(recent.Error!);
        var since = clock.GetUtcNow().UtcDateTime - RepeatWindow;
        if (recent.Value!.FirstOrDefault(a => a.Title == title && a.Body == body && DateTime.SpecifyKind(a.SentAt, DateTimeKind.Utc) >= since) is { } sent)
            return ToolResults.Ok(new { done = true, announcementId = sent.Id, recipients = sent.RecipientCount, note = "This announcement was already sent; it was not sent twice." });

        var result = await api.SendAsync<AnnouncementResponse>(HttpMethod.Post, "notification-api", "/api/notifications/announcements", null,
            new SendAnnouncementRequest(title, body), null, ct);
        flow.Audit(AnnouncementTool, new { title, body, requestId }, result.IsOk ? $"announcement {result.Value!.Id} to {result.Value.RecipientCount}" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, announcementId = result.Value!.Id, recipients = result.Value.RecipientCount });
    }
}

/// <summary>What the business write tools share: names in two languages, dates, and tidying what the owner typed.</summary>
internal static class BusinessWrite
{
    /// <summary>A name the owner gave, on the side of its script, with the other language beside it when given too</summary>
    public static LocalizedText Names(string name, string? other)
    {
        var first = MenuWriteTools.Localized(name);
        if (string.IsNullOrWhiteSpace(other)) return first;
        var second = MenuWriteTools.Localized(other);
        return new LocalizedText(first.En ?? second.En, first.Ar ?? second.Ar);
    }

    /// <summary>The record already named exactly so, in either language</summary>
    public static T? SameName<T>(IEnumerable<T> items, Func<T, LocalizedText?> name, LocalizedText wanted) where T : class
    {
        static bool Eq(string? a, string? b) => !string.IsNullOrWhiteSpace(a) && !string.IsNullOrWhiteSpace(b) && a.Trim().Equals(b.Trim(), StringComparison.OrdinalIgnoreCase);
        return items.FirstOrDefault(i => Eq(name(i)?.En, wanted.En) || Eq(name(i)?.Ar, wanted.Ar));
    }

    public static string? Clean(string? text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();

    /// <summary>Finance's PaidFrom: drawer 0, bank 1; -1 for anything else (a partner's pocket is the back office's)</summary>
    public static int PaidFrom(string text) => text.Trim().ToLowerInvariant() switch
    {
        "drawer" or "cash" or "till" => 0,
        "bank" or "transfer" or "card" => 1,
        _ => -1,
    };

    /// <summary>The date the owner gave, or the branch's business today</summary>
    public static (DateOnly Day, string? Error) Day(string? date, TenantSnapshot snap, BranchResponse branch, TimeProvider clock)
    {
        if (string.IsNullOrWhiteSpace(date))
            return (PeriodResolver.BusinessToday(snap.Zone, branch.DayStart, clock.GetUtcNow()), null);
        return DateOnly.TryParseExact(date.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var day)
            ? (day, null)
            : (default, "date must be yyyy-MM-dd.");
    }
}
