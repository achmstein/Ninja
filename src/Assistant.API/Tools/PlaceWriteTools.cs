using System.ComponentModel;
using System.Text;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;

namespace Ninja.Assistant.API.Tools;

/// <summary>
/// The floor from chat: tables, rooms and stations, what their time costs,
/// whether they take bookings and whether they are in use. A place is found by
/// its name in either language or its id, in one branch or across them all.
/// Taking a place away for good stays with the back office.
/// </summary>
[McpServerToolType]
public sealed class PlaceWriteTools(TenantContext tenant, NinjaApiClient api, WriteFlow flow)
{
    internal const string CreateTool = "create_place";
    internal const string UpdateTool = "update_place";
    internal const string TariffTool = "set_place_tariff";
    internal const string ReservableTool = "set_place_reservable";
    internal const string ActiveTool = "set_place_active";

    public sealed record RateInput(
        [property: Description("The rate's name, e.g. Single, Multi, VIP")] string Name,
        [property: Description("What an hour costs at this rate")] decimal HourlyRate,
        [property: Description("The rate's name in the other language, optional")] string? NameOtherLanguage = null);

    [McpServerTool(Name = CreateTool, Title = "Add a table or room", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Adds a place to a branch's floor: a table (takes orders), a room (a PlayStation room, charged by the hour) or a station (pool, ping pong), optionally with what an hour costs, so it gets its QR code and shows on the till. " +
        "Use for 'add Table 12', 'add a VIP room at 80 an hour single and 120 multi', 'we got a pool table, 60 an hour'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> CreatePlace(
        [Description("The place's name, in English or Arabic")] string name,
        [Description("table, room or station")] string kind = "table",
        [Description("Its name in the other language, optional")] string? nameOtherLanguage = null,
        [Description("A short description, optional")] string? description = null,
        [Description("Branch id or name; required when the business has more than one active branch")] string? branch = null,
        [Description("One hourly rate, for a place charged by time; leave out (and rates) for a place that only takes orders")] decimal? hourlyRate = null,
        [Description("Several hourly rates to choose from (a room's single and multi player); in place of hourlyRate")] List<RateInput>? rates = null,
        [Description("Time is billed to the nearest this many minutes, 1-60; default 15")] int? roundingMinutes = null,
        [Description("true to take reservations for it, false not to; leave out for the usual (on for a timed place)")] bool? reservable = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(name)) return ToolResults.Fail("The place needs a name.");
        var kindCode = kind.Trim().ToLowerInvariant() switch
        {
            "room" or "ps" or "playstation" => 1,
            "table" => 2,
            "station" or "pool" or "game" => 3,
            _ => 0,
        };
        if (kindCode == 0) return ToolResults.Fail("kind must be table, room or station.");

        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var one = BranchSelector.SelectOne(snap.Branches, branch);
        if (!one.IsOk) return ToolResults.Fail(one.Error!);
        var target = one.Value!;

        var (tariff, tariffError) = Tariff(rates, hourlyRate, roundingMinutes, null);
        if (tariffError is not null) return ToolResults.Fail(tariffError);
        var label = BusinessWrite.Names(name, nameOtherLanguage);

        var places = await api.GetAsync<List<PlaceDto>>("spaces-api", "/api/places", target.Id, ct);
        if (!places.IsOk) return ToolResults.Fail(places.Error!);
        // Spaces takes a second place of the same name; a retried confirm must not make one
        if (BusinessWrite.SameName(places.Value!, p => p.Name, label) is { } existing)
            return confirm
                ? ToolResults.Ok(new { done = true, placeId = existing.Id, note = $"\"{existing.Name?.Both}\" is already at {target.BothNames}; nothing was added twice." })
                : ToolResults.Fail($"{target.BothNames} already has \"{existing.Name?.Both}\" (id {existing.Id}). Give the new one another name, or change that one with update_place.");

        var preview = $"Add the {Kind(kindCode)} \"{label.Both}\" at {target.BothNames}"
            + (string.IsNullOrWhiteSpace(description) ? "" : $", described \"{description.Trim()}\"")
            + (tariff is null ? ", taking orders only (no time charge)" : $", charged by time: {Rates(tariff, snap.Currency)}")
            + (reservable is { } r ? (r ? ", taking reservations" : ", not taking reservations") : "") + ".";
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var body = new CreatePlaceRequest(kindCode, label, string.IsNullOrWhiteSpace(description) ? null : MenuWriteTools.Localized(description), tariff, reservable);
        var result = await api.SendAsync<int>(HttpMethod.Post, "spaces-api", "/api/places", target.Id, body, null, ct);
        flow.Audit(CreateTool, new { name = label.Display, kind = kindCode, branch = target.Id, timed = tariff is not null, reservable, requestId }, result.IsOk ? $"place {result.Value}" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, placeId = result.Value, preview });
    }

    [McpServerTool(Name = UpdateTool, Title = "Rename a table or room", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Changes a place's name or description; what is not given stays as it is. " +
        "Use for 'rename Table 3 to Window table', 'describe the VIP room as having a 75 inch screen'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> UpdatePlace(
        [Description("The place's name (English or Arabic) or id")] string place,
        [Description("Branch id or name to look in; leave out to look in every active branch")] string? branch = null,
        [Description("Its new name, in English or Arabic")] string? newName = null,
        [Description("Its new name in the other language, optional")] string? newNameOtherLanguage = null,
        [Description("Its new description")] string? description = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(newName) && description is null && string.IsNullOrWhiteSpace(newNameOtherLanguage))
            return ToolResults.Fail("Say what to change: its name or description.");
        var found = await FindAsync(place, branch, ct);
        if (found.Error is not null) return ToolResults.Fail(found.Error);
        var (p, at) = (found.Place!, found.Branch!);

        // A side the owner names replaces that side; the other keeps what it had
        var given = string.IsNullOrWhiteSpace(newName)
            ? BusinessWrite.Names(newNameOtherLanguage!, null)
            : BusinessWrite.Names(newName, newNameOtherLanguage);
        var name = new LocalizedText(given.En ?? p.Name?.En, given.Ar ?? p.Name?.Ar);
        var newDescription = description is null ? p.Description
            : string.IsNullOrWhiteSpace(description) ? null
            : Merge(MenuWriteTools.Localized(description), p.Description);

        var changes = new List<string>();
        if (name.Both != p.Name?.Both) changes.Add($"name \"{p.Name?.Both}\" → \"{name.Both}\"");
        if (description is not null) changes.Add($"description → \"{newDescription?.Both ?? "none"}\"");
        if (changes.Count == 0) return ToolResults.Fail($"\"{p.Name?.Both}\" already has that name.");
        var preview = $"At {at.BothNames}, {Kind(p.Kind)} \"{p.Name?.Both}\" (id {p.Id}): {string.Join("; ", changes)}.";

        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var result = await api.SendAsync<Unit>(HttpMethod.Put, "spaces-api", $"/api/places/{p.Id}", at.Id, new UpdatePlaceRequest(name, newDescription), null, ct);
        flow.Audit(UpdateTool, new { placeId = p.Id, name = name.Display, nameAr = name.Ar, description = newDescription?.Display, requestId }, result.IsOk ? "place updated" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, placeId = p.Id, preview });
    }

    [McpServerTool(Name = TariffTool, Title = "Set what an hour costs at a place", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Sets the hourly rate (or the rates to choose from) a room, station or timed table is charged, and how the time is rounded; or takes the time charge off so it only takes orders. Applies to time from now on. " +
        "Use for 'Room 2 is now 70 an hour', 'make the VIP room 90 single and 140 multi', 'stop charging time on Table 5'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> SetPlaceTariff(
        [Description("The place's name (English or Arabic) or id")] string place,
        [Description("Branch id or name to look in; leave out to look in every active branch")] string? branch = null,
        [Description("One hourly rate")] decimal? hourlyRate = null,
        [Description("Several hourly rates to choose from, in place of hourlyRate; a rate keeps its place on running bills when its name stays")] List<RateInput>? rates = null,
        [Description("Time is billed to the nearest this many minutes, 1-60; leave out to keep it")] int? roundingMinutes = null,
        [Description("true to take the time charge off: the place only takes orders")] bool remove = false,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (!remove && hourlyRate is null && rates is not { Count: > 0 } && roundingMinutes is null)
            return ToolResults.Fail("Give the hourly rate (or the rates), the rounding, or remove=true to stop charging time.");
        var found = await FindAsync(place, branch, ct);
        if (found.Error is not null) return ToolResults.Fail(found.Error);
        var (p, at, currency) = (found.Place!, found.Branch!, found.Currency);

        TariffDto? tariff = null;
        if (!remove)
        {
            if (hourlyRate is null && rates is not { Count: > 0 } && p.Tariff is null)
                return ToolResults.Fail($"\"{p.Name?.Both}\" is not charged by time; give its hourly rate.");
            string? error;
            (tariff, error) = hourlyRate is null && rates is not { Count: > 0 }
                ? (p.Tariff! with { RoundingMinutes = roundingMinutes ?? p.Tariff!.RoundingMinutes }, Rounding(roundingMinutes))
                : Tariff(rates, hourlyRate, roundingMinutes, p.Tariff);
            if (error is not null) return ToolResults.Fail(error);
        }
        else if (p.Tariff is null) return ToolResults.Fail($"\"{p.Name?.Both}\" is not charged by time already.");

        var preview = $"At {at.BothNames}, {Kind(p.Kind)} \"{p.Name?.Both}\": "
            + (p.Tariff is null ? "no time charge" : Rates(p.Tariff, currency))
            + " → " + (tariff is null ? "no time charge; it only takes orders" : Rates(tariff, currency)) + ". Time already on a running bill keeps its rate up to now.";
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var result = await api.SendAsync<Unit>(HttpMethod.Put, "spaces-api", $"/api/places/{p.Id}/tariff", at.Id, new SetPlaceTariffRequest(tariff), null, ct);
        flow.Audit(TariffTool, new { placeId = p.Id, rates = tariff?.Options.Select(o => new { o.Code, o.HourlyRate }), rounding = tariff?.RoundingMinutes, requestId },
            result.IsOk ? (tariff is null ? "tariff removed" : "tariff set") : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, placeId = p.Id, preview });
    }

    [McpServerTool(Name = ReservableTool, Title = "Open or close a place to reservations", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Lets customers reserve a place (reservable=true) or stops new reservations for it (false). " +
        "Use for 'let people book the VIP room', 'Table 1 is walk-in only'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> SetPlaceReservable(
        [Description("The place's name (English or Arabic) or id")] string place,
        [Description("true = takes reservations, false = does not")] bool reservable,
        [Description("Branch id or name to look in; leave out to look in every active branch")] string? branch = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        var found = await FindAsync(place, branch, ct);
        if (found.Error is not null) return ToolResults.Fail(found.Error);
        var (p, at) = (found.Place!, found.Branch!);

        var preview = $"{(reservable ? "Open" : "Close")} {Kind(p.Kind)} \"{p.Name?.Both}\" at {at.BothNames} {(reservable ? "to" : "for")} reservations"
            + $" (it {(p.Reservable ? "takes" : "does not take")} them now)."
            + (reservable ? "" : " Reservations already made for it must be seated or cancelled first.");
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var result = await api.SendAsync<Unit>(HttpMethod.Put, "spaces-api", $"/api/places/{p.Id}/reservable", at.Id, new SetPlaceReservableRequest(reservable), null, ct);
        flow.Audit(ReservableTool, new { placeId = p.Id, reservable, requestId }, result.IsOk ? $"reservable={reservable}" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, placeId = p.Id, reservable, preview });
    }

    [McpServerTool(Name = ActiveTool, Title = "Put a place in or out of use", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Takes a place out of use (active=false: it leaves the till, the floor and the customer app, its history kept) or puts it back (true). " +
        "Use for 'we removed Table 9 for the summer', 'bring Room 3 back'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> SetPlaceActive(
        [Description("The place's name (English or Arabic) or id")] string place,
        [Description("true = in use, false = out of use")] bool active,
        [Description("Branch id or name to look in; leave out to look in every active branch")] string? branch = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        var found = await FindAsync(place, branch, ct);
        if (found.Error is not null) return ToolResults.Fail(found.Error);
        var (p, at) = (found.Place!, found.Branch!);

        var preview = active
            ? $"Put {Kind(p.Kind)} \"{p.Name?.Both}\" at {at.BothNames} back in use (it is {(p.IsActive ? "already in use" : "out of use")} now)."
            : $"Take {Kind(p.Kind)} \"{p.Name?.Both}\" at {at.BothNames} out of use: it leaves the till and the app until put back (it is {(p.IsActive ? "in use" : "already out of use")} now).";
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var result = await api.SendAsync<Unit>(HttpMethod.Put, "spaces-api", $"/api/places/{p.Id}/active", at.Id, new SetPlaceActiveRequest(active), null, ct);
        flow.Audit(ActiveTool, new { placeId = p.Id, active, requestId }, result.IsOk ? $"active={active}" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, placeId = p.Id, active, preview });
    }

    // --- Pieces --------------------------------------------------------------

    /// <summary>A place and the branch it stands in</summary>
    private sealed record Spot(PlaceDto Place, BranchResponse Branch);

    /// <summary>The place the owner named, in the branch they named or across every active branch</summary>
    private async Task<(PlaceDto? Place, BranchResponse? Branch, string Currency, string? Error)> FindAsync(string place, string? branch, CancellationToken ct)
    {
        var currency = TenantLocaleDto.Default.Currency!;
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return (null, null, currency, snapshot.Error);
        currency = snapshot.Value!.Currency;
        var where = BranchSelector.Select(snapshot.Value.Branches, branch);
        if (!where.IsOk) return (null, null, currency, where.Error);

        var all = new List<Spot>();
        foreach (var b in where.Value!)
        {
            var places = await api.GetAsync<List<PlaceDto>>("spaces-api", "/api/places", b.Id, ct);
            if (!places.IsOk) return (null, null, currency, places.Error);
            all.AddRange(places.Value!.Where(p => all.All(a => a.Place.Id != p.Id)).Select(p => new Spot(p, b)));
        }
        var (match, error) = NameResolver.Pick(all, place, a => a.Place.Id, a => a.Place.Name, "place");
        return match is null ? (null, null, currency, error) : (match.Place, match.Branch, currency, null);
    }

    /// <summary>
    /// The tariff the owner described. A rate keeps the code it had when its
    /// name stays, so a running bill's segments still find it; a single new
    /// rate on a one-rate place keeps that rate's code and name.
    /// </summary>
    internal static (TariffDto? Tariff, string? Error) Tariff(List<RateInput>? rates, decimal? hourlyRate, int? roundingMinutes, TariffDto? current)
    {
        if (Rounding(roundingMinutes) is { } roundingError) return (null, roundingError);
        var rounding = roundingMinutes ?? current?.RoundingMinutes ?? 15;

        if (rates is { Count: > 0 })
        {
            var options = new List<RateOptionDto>();
            for (var i = 0; i < rates.Count; i++)
            {
                var r = rates[i];
                if (string.IsNullOrWhiteSpace(r.Name)) return (null, "Every rate needs a name.");
                if (r.HourlyRate <= 0) return (null, "An hourly rate must be more than zero.");
                var name = BusinessWrite.Names(r.Name, r.NameOtherLanguage);
                var kept = current?.Options.FirstOrDefault(o => BusinessWrite.SameName([o], x => x.Name, name) is not null);
                var code = kept?.Code ?? Code(name.Display, i);
                while (options.Any(o => o.Code == code)) code = $"{code}-{i + 1}";
                options.Add(new RateOptionDto(code, kept is null ? name : new LocalizedText(name.En ?? kept.Name.En, name.Ar ?? kept.Name.Ar), r.HourlyRate));
            }
            return (new TariffDto(options, rounding), null);
        }

        if (hourlyRate is { } rate)
        {
            if (rate <= 0) return (null, "An hourly rate must be more than zero.");
            if (current is { Options.Count: > 1 })
                return (null, $"It has {current.Options.Count} rates ({string.Join(", ", current.Options.Select(o => o.Name.Display))}); give each one in rates.");
            var only = current?.Options.FirstOrDefault();
            return (new TariffDto([only is null ? new RateOptionDto("standard", new LocalizedText("Standard", "عادي"), rate) : only with { HourlyRate = rate }], rounding), null);
        }

        return (null, null);
    }

    private static string? Rounding(int? minutes) => minutes is <= 0 or > 60 ? "Rounding is 1 to 60 minutes." : null;

    private static string Code(string name, int index)
    {
        var sb = new StringBuilder();
        foreach (var c in name.Trim().ToLowerInvariant())
            if (c is >= 'a' and <= 'z' or >= '0' and <= '9') sb.Append(c);
            else if (sb.Length > 0 && sb[^1] != '-') sb.Append('-');
        var code = sb.ToString().Trim('-');
        return code.Length > 0 ? code : $"rate-{index + 1}";
    }

    private static LocalizedText Merge(LocalizedText given, LocalizedText? current)
        => new(given.En ?? current?.En, given.Ar ?? current?.Ar);

    private static string Rates(TariffDto tariff, string currency)
        => string.Join(", ", tariff.Options.Select(o => $"{o.Name.Both} {currency} {ToolResults.Money(o.HourlyRate)} an hour")) + $", rounded to {tariff.RoundingMinutes} min";

    internal static string Kind(int kind) => kind switch
    {
        1 => "room",
        2 => "table",
        3 => "station",
        _ => "place",
    };
}
