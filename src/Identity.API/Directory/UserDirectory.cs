namespace Ninja.Identity.API.Directory;

/// <summary>One user as the directory holds it: what Keycloak knows plus the normalized forms search runs on.</summary>
public sealed record DirectoryUser(
    string Id,
    string? Username,
    string? Email,
    string? FirstName,
    string? LastName,
    bool Enabled,
    long? CreatedTimestamp,
    IReadOnlyList<string> RealmRoles,
    string? PhoneNumber,
    IReadOnlyList<int> Branches)
{
    public string DisplayName => string.Join(' ', new[] { FirstName, LastName }.Where(s => !string.IsNullOrWhiteSpace(s))) is { Length: > 0 } full ? full : Username ?? "";

    // Search runs over these, computed once per load
    public string[] NameTokens { get; } = NameSearch.Tokenize(
        string.IsNullOrWhiteSpace(FirstName) && string.IsNullOrWhiteSpace(LastName) ? Username : $"{FirstName} {LastName}");
    public string PhoneDigits { get; } = NameSearch.Digits(PhoneNumber);
    public string EmailNormalized { get; } = (Email ?? "").ToLowerInvariant();
    public string UsernameNormalized { get; } = (Username ?? "").ToLowerInvariant();
}

/// <summary>
/// An immutable view of every user at one moment. Search never touches
/// Keycloak: with the list in memory, ten thousand names rank in well under
/// a millisecond, which is what lets the cashier's dialog feel instant.
/// </summary>
public sealed class DirectorySnapshot(IReadOnlyList<DirectoryUser> users, DateTimeOffset loadedAt)
{
    public static readonly DirectorySnapshot Empty = new([], DateTimeOffset.MinValue);

    public IReadOnlyList<DirectoryUser> Users { get; } = users;
    public DateTimeOffset LoadedAt { get; } = loadedAt;

    /// <summary>
    /// The users matching the query and role filters, ranked. Without a
    /// query the list is in username order, as Keycloak returned it.
    /// </summary>
    public IEnumerable<DirectoryUser> Search(string? query, string[] includeRoles, string[] excludeRoles)
    {
        IEnumerable<DirectoryUser> candidates = Users;
        if (includeRoles.Length > 0)
        {
            candidates = candidates.Where(u => u.RealmRoles.Any(includeRoles.Contains));
        }
        if (excludeRoles.Length > 0)
        {
            candidates = candidates.Where(u => !u.RealmRoles.Any(excludeRoles.Contains));
        }

        var term = (query ?? "").Trim();
        if (term.Length == 0)
        {
            return candidates;
        }

        return candidates
            .Select(u => (User: u, Score: NameSearch.Score(term, u.NameTokens, u.PhoneDigits, u.EmailNormalized, u.UsernameNormalized)))
            .Where(m => m.Score > 0)
            .OrderByDescending(m => m.Score)
            .ThenBy(m => m.User.DisplayName, StringComparer.OrdinalIgnoreCase)
            .Select(m => m.User);
    }
}

/// <summary>
/// The in-memory customer index Identity.API serves search from. Keycloak
/// stays the source of truth; this is a cache of it, rebuilt whole: every
/// user paged out of the admin API, plus the members of each realm role so
/// roles come in a handful of calls instead of one per user.
///
/// Kept fresh three ways: a timer (sign-ups made on Keycloak's own page
/// never pass through this service), a rebuild shortly after any write that
/// does pass through it, and a rebuild when a search finds nothing and the
/// index is older than a short cooldown — so a customer who signed up a
/// minute ago is found on the cashier's first try.
/// </summary>
public sealed class UserDirectory(KeycloakAdmin keycloak, IConfiguration config, ILogger<UserDirectory> logger) : BackgroundService
{
    private static readonly string[] SystemRolePrefixes = ["default-roles-", "offline_access", "uma_authorization"];

    private readonly TimeSpan _refreshInterval = TimeSpan.FromSeconds(config.GetValue("Directory:RefreshIntervalSeconds", 120));
    private readonly TimeSpan _emptySearchCooldown = TimeSpan.FromSeconds(config.GetValue("Directory:EmptySearchRefreshCooldownSeconds", 30));
    private readonly TimeSpan _writeDebounce = TimeSpan.FromSeconds(config.GetValue("Directory:WriteRefreshDelaySeconds", 1));
    private readonly int _pageSize = config.GetValue("Directory:PageSize", 500);

    private readonly TaskCompletionSource _firstLoad = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly SemaphoreSlim _refreshLock = new(1, 1);
    private readonly object _scheduleLock = new();
    private volatile DirectorySnapshot _snapshot = DirectorySnapshot.Empty;
    private Task? _pendingWriteRefresh;

    public DirectorySnapshot Snapshot => _snapshot;

    /// <summary>The current index, waiting for the first load if the service has only just started.</summary>
    public async Task<DirectorySnapshot> GetAsync(CancellationToken ct = default)
    {
        if (!_firstLoad.Task.IsCompleted)
        {
            await _firstLoad.Task.WaitAsync(ct);
        }
        return _snapshot;
    }

    /// <summary>
    /// A search came back empty: if the index is older than the cooldown,
    /// rebuild it now so a brand-new customer is found on this attempt.
    /// Returns the (possibly fresher) snapshot.
    /// </summary>
    public async Task<DirectorySnapshot> RefreshIfStaleAsync(CancellationToken ct = default)
    {
        if (DateTimeOffset.UtcNow - _snapshot.LoadedAt < _emptySearchCooldown)
        {
            return _snapshot;
        }
        await RefreshAsync(ct);
        return _snapshot;
    }

    /// <summary>
    /// Something changed through this service (a registration, a profile
    /// edit, a role or branch change): rebuild shortly, coalescing a burst of
    /// writes into one reload.
    /// </summary>
    public void ScheduleRefresh()
    {
        lock (_scheduleLock)
        {
            if (_pendingWriteRefresh is { IsCompleted: false }) return;
            _pendingWriteRefresh = Task.Run(async () =>
            {
                await Task.Delay(_writeDebounce);
                try
                {
                    await RefreshAsync(CancellationToken.None);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Directory refresh after a write failed; the timer will retry");
                }
            });
        }
    }

    /// <summary>Rebuild the whole index from Keycloak. Single-flight: a second caller waits for the run in progress.</summary>
    public async Task RefreshAsync(CancellationToken ct)
    {
        if (!await _refreshLock.WaitAsync(0, ct))
        {
            // One is running — wait for it rather than start another
            await _refreshLock.WaitAsync(ct);
            _refreshLock.Release();
            return;
        }
        try
        {
            var started = DateTimeOffset.UtcNow;
            var users = await LoadAsync(ct);
            _snapshot = new DirectorySnapshot(users, started);
            _firstLoad.TrySetResult();
            logger.LogInformation("Directory loaded: {Count} users in {Elapsed} ms", users.Count, (DateTimeOffset.UtcNow - started).TotalMilliseconds);
        }
        finally
        {
            _refreshLock.Release();
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Keycloak may still be booting alongside us: keep trying until the
        // first load lands, then settle into the timer
        var attempt = 0;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RefreshAsync(stoppingToken);
                attempt = 0;
                await Task.Delay(_refreshInterval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                attempt++;
                var wait = TimeSpan.FromSeconds(Math.Min(60, 5 * attempt));
                logger.LogWarning(ex, "Directory load failed (attempt {Attempt}); retrying in {Wait}", attempt, wait);
                await Task.Delay(wait, stoppingToken);
            }
        }
    }

    private async Task<IReadOnlyList<DirectoryUser>> LoadAsync(CancellationToken ct)
    {
        var client = await keycloak.AuthorizedClientAsync();
        var users = await PageAsync<KeycloakUser>(client, $"{keycloak.AdminUrl}/users?briefRepresentation=false", ct);

        // Roles by member: one paged listing per realm role, skipping the
        // realm's built-in roles nobody filters on
        var rolesByUser = new Dictionary<string, List<string>>();
        var roles = await client.GetFromJsonAsync<List<KeycloakRole>>($"{keycloak.AdminUrl}/roles", ct) ?? [];
        foreach (var role in roles)
        {
            if (role.Name is null || SystemRolePrefixes.Any(p => role.Name.StartsWith(p, StringComparison.Ordinal))) continue;
            var members = await PageAsync<KeycloakUser>(client, $"{keycloak.AdminUrl}/roles/{Uri.EscapeDataString(role.Name)}/users?briefRepresentation=true", ct);
            foreach (var member in members)
            {
                if (!rolesByUser.TryGetValue(member.Id, out var list))
                {
                    rolesByUser[member.Id] = list = [];
                }
                list.Add(role.Name);
            }
        }

        return users
            .Select(u => new DirectoryUser(
                u.Id,
                u.Username,
                u.Email,
                u.FirstName,
                u.LastName,
                u.Enabled,
                u.CreatedTimestamp,
                rolesByUser.GetValueOrDefault(u.Id) ?? [],
                u.Attributes?.GetValueOrDefault("phoneNumber")?.FirstOrDefault(),
                UserAttributes.BranchesOf(u.Attributes)))
            .ToList();
    }

    private async Task<List<T>> PageAsync<T>(HttpClient client, string url, CancellationToken ct)
    {
        var all = new List<T>();
        for (var first = 0; ; first += _pageSize)
        {
            var page = await client.GetFromJsonAsync<List<T>>($"{url}&first={first}&max={_pageSize}", ct) ?? [];
            all.AddRange(page);
            if (page.Count < _pageSize) return all;
        }
    }
}

/// <summary>The Keycloak user attributes the apps read.</summary>
public static class UserAttributes
{
    /// <summary>The branch ids a staff account may work in, from its `branches` attribute.</summary>
    public static List<int> BranchesOf(Dictionary<string, string[]>? attributes) =>
        (attributes?.GetValueOrDefault("branches") ?? [])
            .Select(v => int.TryParse(v, out var id) ? id : (int?)null)
            .OfType<int>()
            .Order()
            .ToList();
}
