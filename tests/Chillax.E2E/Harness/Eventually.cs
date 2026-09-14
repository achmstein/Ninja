namespace Chillax.E2E.Harness;

/// <summary>
/// Polls until a condition holds. Every cross-service effect in Chillax is
/// eventually consistent (RabbitMQ hop + handler), so projection assertions
/// go through here rather than reading once and hoping.
/// </summary>
public static class Eventually
{
    public static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(20);
    public static readonly TimeSpan DefaultInterval = TimeSpan.FromMilliseconds(250);

    /// <summary>Retries <paramref name="condition"/> until it returns true.</summary>
    public static async Task Async(Func<Task<bool>> condition, string because, CancellationToken ct,
        TimeSpan? timeout = null, TimeSpan? interval = null)
    {
        var limit = timeout ?? DefaultTimeout;
        var deadline = DateTime.UtcNow + limit;
        Exception? last = null;
        while (true)
        {
            try
            {
                if (await condition())
                    return;
                last = null;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                last = ex;
            }

            if (DateTime.UtcNow >= deadline)
                throw new TimeoutException($"Timed out after {limit} waiting for: {because}", last);

            await Task.Delay(interval ?? DefaultInterval, ct);
        }
    }

    /// <summary>Retries <paramref name="assertion"/> until it stops throwing, for xunit asserts over a GET.</summary>
    public static Task Async(Func<Task> assertion, string because, CancellationToken ct,
        TimeSpan? timeout = null, TimeSpan? interval = null)
        => Async(async () => { await assertion(); return true; }, because, ct, timeout, interval);

    /// <summary>Retries <paramref name="probe"/> until it yields a non-null value.</summary>
    public static async Task<T> ValueAsync<T>(Func<Task<T?>> probe, string because, CancellationToken ct,
        TimeSpan? timeout = null, TimeSpan? interval = null)
    {
        T? value = default;
        await Async(async () => (value = await probe()) is not null, because, ct, timeout, interval);
        return value!;
    }
}
