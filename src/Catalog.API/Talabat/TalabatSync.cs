using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace Ninja.Catalog.API.Talabat;

/// <summary>
/// How this stack reaches Talabat: through the platform's relay, which holds
/// Ninja's Talabat account and the café's chain there. Stamped by the control
/// plane; without it nothing is sent.
/// </summary>
public sealed class TalabatOptions
{
    public const string Section = "Talabat";

    public string? RelayUrl { get; set; }

    public string? Tenant { get; set; }

    public string? RelayKey { get; set; }

    public bool Configured => !string.IsNullOrWhiteSpace(RelayUrl) && !string.IsNullOrWhiteSpace(Tenant) && !string.IsNullOrWhiteSpace(RelayKey);
}

/// <summary>
/// Notices, as the catalog saves, what Talabat should hear: a change to the
/// menu (a dish, a price, a question, a category) marks it for a push; an
/// item or option sold out or back at a branch on Talabat queues that at once.
/// Runs inside the same save, so nothing is noticed that was not saved.
/// </summary>
public static class TalabatChanges
{
    private static readonly Type[] MenuTypes = [typeof(CatalogItem), typeof(CatalogType), typeof(ItemCustomization), typeof(CustomizationOption), typeof(BranchItemOverride)];

    public static async Task CaptureAsync(CatalogContext context, CancellationToken ct)
    {
        context.ChangeTracker.DetectChanges();
        var changed = context.ChangeTracker.Entries()
            .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .ToList();
        if (changed.Count == 0 || changed.All(e => e.Entity is TalabatSettings or TalabatTask))
            return;

        var menuChanged = changed.Any(e => MenuTypes.Contains(e.Entity.GetType()) && IsMenuChange(e));
        var availability = Availability(changed).ToList();
        if (!menuChanged && availability.Count == 0)
            return;

        var settings = await context.TalabatSettings.FirstOrDefaultAsync(ct);
        if (settings is null || settings.BranchIds.Length == 0)
            return;

        var now = DateTime.UtcNow;
        if (menuChanged)
            settings.MenuChangedAt = now;

        foreach (var (branchId, code) in availability)
        {
            foreach (var branch in branchId is int one ? (settings.IsOn(one) ? [one] : []) : settings.BranchIds)
            {
                context.TalabatTasks.Add(new TalabatTask
                {
                    Kind = TalabatTaskKind.Availability,
                    BranchId = branch,
                    Code = code,
                    CreatedAt = now,
                    NextAttemptAt = now,
                });
            }
        }
    }

    /// <summary>A stock-out alone is availability, sent on its own; anything else about a dish is the menu.</summary>
    private static bool IsMenuChange(EntityEntry entry)
    {
        if (entry.State != EntityState.Modified) return true;
        var availabilityOnly = entry.Entity switch
        {
            CatalogItem => new[] { nameof(CatalogItem.IsAvailable), nameof(CatalogItem.IsPopular) },
            BranchItemOverride => [nameof(BranchItemOverride.IsAvailable), nameof(BranchItemOverride.IsOutOfStock)],
            _ => [],
        };
        return entry.Properties.Any(p => p.IsModified && !availabilityOnly.Contains(p.Metadata.Name));
    }

    /// <summary>What went on or off where: a null branch is every branch on Talabat.</summary>
    private static IEnumerable<(int? BranchId, string Code)> Availability(IEnumerable<EntityEntry> changed)
    {
        foreach (var entry in changed)
        {
            switch (entry.Entity)
            {
                case CatalogItem item when entry.State == EntityState.Modified && entry.Property(nameof(CatalogItem.IsAvailable)).IsModified:
                    yield return (null, TalabatCatalogBuilder.ItemCode(item.Id));
                    break;
                case BranchItemOverride o when entry.State != EntityState.Modified
                    || entry.Property(nameof(BranchItemOverride.IsAvailable)).IsModified
                    || entry.Property(nameof(BranchItemOverride.IsOutOfStock)).IsModified:
                    yield return (o.BranchId, TalabatCatalogBuilder.ItemCode(o.CatalogItemId));
                    break;
                case BranchOptionStockOut s when entry.State is EntityState.Added or EntityState.Deleted:
                    yield return (s.BranchId, TalabatCatalogBuilder.OptionCode(s.CustomizationOptionId));
                    break;
            }
        }
    }
}

/// <summary>
/// Sends what the catalog queued to Talabat through the platform's relay:
/// a branch's menu a little after the last edit settles (so a morning of
/// edits is one import, not fifty), availability as it happens, a branch's
/// open/closed as its switch moves. Retries until Talabat takes it; gives up
/// on what Talabat refuses outright, or after an hour.
/// </summary>
public sealed class TalabatSyncService(
    IServiceScopeFactory scopes,
    IHttpClientFactory http,
    IOptions<TalabatOptions> options,
    IOptions<CatalogOptions> catalog,
    ILogger<TalabatSyncService> logger) : BackgroundService
{
    public const string HttpClientName = "talabat-relay";

    /// <summary>How long the menu must sit still after an edit before it goes.</summary>
    public static readonly TimeSpan MenuQuiet = TimeSpan.FromSeconds(45);

    private static readonly TimeSpan GiveUpAfter = TimeSpan.FromHours(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (options.Value.Configured)
                    await RunOnceAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Talabat sync failed; trying again shortly");
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }

    public async Task RunOnceAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<CatalogContext>();
        var now = DateTime.UtcNow;

        var settings = await context.TalabatSettings.FirstOrDefaultAsync(ct);
        if (settings is null || settings.BranchIds.Length == 0)
            return;

        // The menu settled after an edit: one push per branch on Talabat
        if (settings.MenuChangedAt is { } changedAt
            && (settings.MenuQueuedAt is null || changedAt > settings.MenuQueuedAt)
            && now - changedAt >= MenuQuiet)
        {
            QueueMenu(context, settings, settings.BranchIds, now);
        }

        var due = await context.TalabatTasks
            .Where(t => t.SentAt == null && t.AbandonedAt == null && t.NextAttemptAt <= now)
            .OrderBy(t => t.Id)
            .Take(50)
            .ToListAsync(ct);

        foreach (var task in due)
        {
            if (task.SentAt is not null || task.AbandonedAt is not null) continue;
            if (!settings.IsOn(task.BranchId))
            {
                Settle(task, now, abandoned: "The branch is no longer on Talabat.");
                continue;
            }
            if (now - task.CreatedAt > GiveUpAfter)
            {
                Settle(task, now, abandoned: task.LastError ?? "Never reached Talabat within the hour.");
                continue;
            }

            try
            {
                switch (task.Kind)
                {
                    case TalabatTaskKind.Menu:
                        // A newer push for the branch makes this one pointless
                        if (due.Any(t => t.Kind == TalabatTaskKind.Menu && t.BranchId == task.BranchId && t.Id > task.Id))
                        {
                            Settle(task, now, abandoned: "Superseded by a newer menu.");
                            break;
                        }
                        await SendMenuAsync(context, settings, task, now, ct);
                        break;

                    case TalabatTaskKind.Availability:
                        // Everything due for the branch at once, each as it stands now
                        var batch = due.Where(t => t.Kind == TalabatTaskKind.Availability && t.BranchId == task.BranchId && t.SentAt == null && t.AbandonedAt == null).ToList();
                        await SendAvailabilityAsync(context, batch, now, ct);
                        break;

                    case TalabatTaskKind.Store:
                        if (due.Any(t => t.Kind == TalabatTaskKind.Store && t.BranchId == task.BranchId && t.Id > task.Id))
                        {
                            Settle(task, now, abandoned: "Superseded by a newer switch.");
                            break;
                        }
                        var (status, body) = await PostAsync("store", new { branchId = task.BranchId, open = task.Open ?? true }, ct);
                        Outcome(task, now, status, body, retryOn: [HttpStatusCode.ServiceUnavailable]);
                        break;
                }
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
            {
                Retry(task, now, ex.Message);
            }
        }

        await context.SaveChangesAsync(ct);
    }

    /// <summary>Queues a push of the whole menu for the branches given (all of them after an edit; one when Talabat asks).</summary>
    public static void QueueMenu(CatalogContext context, TalabatSettings settings, IEnumerable<int> branchIds, DateTime now)
    {
        foreach (var branchId in branchIds.Where(settings.IsOn).Distinct())
        {
            context.TalabatTasks.Add(new TalabatTask { Kind = TalabatTaskKind.Menu, BranchId = branchId, CreatedAt = now, NextAttemptAt = now });
        }
        settings.MenuQueuedAt = now;
    }

    public static async Task<JsonObject> BuildMenuAsync(CatalogContext context, int branchId, string? picBaseUrl, CancellationToken ct)
    {
        var items = await context.CatalogItems.AsNoTracking()
            .Include(i => i.CatalogType)
            .Include(i => i.Customizations).ThenInclude(c => c.Options)
            .AsSplitQuery()
            .ToListAsync(ct);
        var overrides = await context.BranchItemOverrides.AsNoTracking().Where(o => o.BranchId == branchId).ToListAsync(ct);
        var stockOuts = (await context.BranchOptionStockOuts.AsNoTracking().Where(s => s.BranchId == branchId).Select(s => s.CustomizationOptionId).ToListAsync(ct)).ToHashSet();
        return TalabatCatalogBuilder.Build(items, overrides, stockOuts, picBaseUrl);
    }

    private async Task SendMenuAsync(CatalogContext context, TalabatSettings settings, TalabatTask task, DateTime now, CancellationToken ct)
    {
        var menu = await BuildMenuAsync(context, task.BranchId, catalog.Value.PicBaseUrl, ct);
        var (status, body) = await PostAsync("catalog", new { branchId = task.BranchId, catalog = menu }, ct);
        Outcome(task, now, status, body);
        if (task.SentAt is not null)
        {
            settings.MenuSentAt = now;
            settings.LastMenuResult = "submitted";
        }
        else
        {
            settings.LastMenuResult = $"{status}: {Trim(body, 900)}";
        }
        settings.LastMenuResultAt = now;
    }

    private async Task SendAvailabilityAsync(CatalogContext context, List<TalabatTask> batch, DateTime now, CancellationToken ct)
    {
        var branchId = batch[0].BranchId;
        var itemIds = batch.Select(t => t.Code).OfType<string>().Where(c => c.StartsWith("item-")).Select(c => int.Parse(c[5..])).Distinct().ToList();
        var optionIds = batch.Select(t => t.Code).OfType<string>().Where(c => c.StartsWith("option-")).Select(c => int.Parse(c[7..])).Distinct().ToList();

        var items = await context.CatalogItems.AsNoTracking().Where(i => itemIds.Contains(i.Id)).ToListAsync(ct);
        var overrides = await context.BranchItemOverrides.AsNoTracking().Where(o => o.BranchId == branchId && itemIds.Contains(o.CatalogItemId)).ToDictionaryAsync(o => o.CatalogItemId, ct);
        var outOptions = await context.BranchOptionStockOuts.AsNoTracking().Where(s => s.BranchId == branchId && optionIds.Contains(s.CustomizationOptionId)).Select(s => s.CustomizationOptionId).ToListAsync(ct);

        var groups = new List<(string Type, bool Available, List<string> Codes)>
        {
            ("ITEM", true, items.Where(i => TalabatCatalogBuilder.ItemAvailable(i, overrides.GetValueOrDefault(i.Id))).Select(i => TalabatCatalogBuilder.ItemCode(i.Id)).ToList()),
            ("ITEM", false, items.Where(i => !TalabatCatalogBuilder.ItemAvailable(i, overrides.GetValueOrDefault(i.Id))).Select(i => TalabatCatalogBuilder.ItemCode(i.Id)).ToList()),
            ("TOPPING", true, optionIds.Except(outOptions).Select(TalabatCatalogBuilder.OptionCode).ToList()),
            ("TOPPING", false, outOptions.Select(TalabatCatalogBuilder.OptionCode).ToList()),
        };

        var worst = (Status: 204, Body: "");
        foreach (var (type, available, codes) in groups.Where(g => g.Codes.Count > 0))
        {
            var (status, body) = await PostAsync("items", new { branchId, type, items = codes, isAvailable = available }, ct);
            if (status is < 200 or >= 300) worst = (status, body);
        }
        foreach (var task in batch)
            Outcome(task, now, worst.Status, worst.Body);
    }

    private async Task<(int Status, string Body)> PostAsync(string what, object body, CancellationToken ct)
    {
        var relay = options.Value;
        var client = http.CreateClient(HttpClientName);
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{relay.RelayUrl!.TrimEnd('/')}/api/talabat/relay/{what}")
        {
            Content = JsonContent.Create(body),
        };
        request.Headers.Add("X-Ninja-Tenant", relay.Tenant);
        request.Headers.Add("X-Ninja-Relay-Key", relay.RelayKey);
        using var response = await client.SendAsync(request, ct);
        return ((int)response.StatusCode, await response.Content.ReadAsStringAsync(ct));
    }

    private void Outcome(TalabatTask task, DateTime now, int status, string body, HttpStatusCode[]? retryOn = null)
    {
        if (status is >= 200 and < 300)
        {
            Settle(task, now);
        }
        else if (retryOn?.Contains((HttpStatusCode)status) == true || status is 408 or 429 or >= 500)
        {
            Retry(task, now, $"{status}: {Trim(body, 500)}");
        }
        else
        {
            Settle(task, now, abandoned: $"{status}: {Trim(body, 500)}");
            logger.LogWarning("Talabat refused {Kind} for branch {BranchId}: {Status} {Body}", task.Kind, task.BranchId, status, Trim(body, 500));
        }
    }

    private static void Settle(TalabatTask task, DateTime now, string? abandoned = null)
    {
        task.Attempts++;
        if (abandoned is null)
        {
            task.SentAt = now;
            task.LastError = null;
        }
        else
        {
            task.AbandonedAt = now;
            task.LastError = abandoned;
        }
    }

    private static void Retry(TalabatTask task, DateTime now, string error)
    {
        task.Attempts++;
        task.LastError = Trim(error, 1000);
        task.NextAttemptAt = now + TimeSpan.FromSeconds(Math.Min(120, 5 * Math.Pow(2, Math.Min(task.Attempts - 1, 5))));
    }

    private static string Trim(string s, int max) => s.Length > max ? s[..max] : s;
}
