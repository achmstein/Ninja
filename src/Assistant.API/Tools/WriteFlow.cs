using System.Collections.Concurrent;
using System.Security.Claims;
using Ninja.Assistant.API.Auth;
using Ninja.ServiceDefaults;

namespace Ninja.Assistant.API.Tools;

/// <summary>
/// What every write tool shares: who is asking, the two-step preview and
/// confirm, an idempotency key per step of a confirm (so a confirm retried
/// after a failure part way redoes only what did not land), the signed draft
/// of a preview built with AI, the audit line, and a cap on how many writes
/// one person confirms in a while.
/// </summary>
public sealed class WriteFlow(AuditLog audit, IHttpContextAccessor httpContextAccessor, DraftSigner drafts, WriteLimiter limiter)
{
    public const string ConfirmDescription = "false (default) only previews what would happen and writes nothing. Show the preview to the person and call again with confirm=true and the same requestId only after they explicitly agree. Never set confirm=true without their go-ahead.";
    public const string RequestIdDescription = "Any id you choose for this request (e.g. a short random string). Reuse it on the confirm call so a retry cannot record the same thing twice.";
    public const string DraftDescription = "Only on confirm=true: the draft string the preview returned, passed back exactly as it came. To change anything, preview again with the change instead of editing it.";
    public const string NextStep = "Show this preview to the person. If they agree, call again with confirm=true and this requestId.";
    public const string NextStepWithDraft = "Show this preview to the person. If they agree, call again with the same arguments, confirm=true, this requestId and this draft exactly as given. To change something, preview again with the change.";

    public ClaimsPrincipal User => httpContextAccessor.HttpContext?.User ?? new ClaimsPrincipal();

    public string UserId => User.GetUserId() ?? "";

    public static string NewRequestId() => Guid.NewGuid().ToString("N");

    /// <summary>The idempotency key of one step of a confirm: the same person, tool, request and step always make the same key</summary>
    public Guid StepKey(string tool, string requestId, string step) => WriteTools.IdempotencyKey(UserId, tool, $"{requestId}|{step}");

    /// <summary>Null when this person may confirm another write now; else why not</summary>
    public string? Limit() => limiter.TryTake(UserId);

    public string Sign<T>(T draft, string tool, string requestId) => drafts.Sign(draft, UserId, tool, requestId);

    public (T? Draft, string? Error) Open<T>(string? token, string tool, string requestId) => drafts.Open<T>(token, UserId, tool, requestId);

    public void Audit(string tool, object arguments, string outcome) => audit.Write(User, tool, arguments, outcome);
}

/// <summary>
/// At most <see cref="MaxWrites"/> confirmed writes per person in any
/// <see cref="Window"/>: a chat app looping on a confirm, or a long list read
/// as "do all of these", stops and says so rather than writing on.
/// </summary>
public sealed class WriteLimiter(TimeProvider clock)
{
    public const int MaxWrites = 30;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(10);

    private readonly ConcurrentDictionary<string, Queue<DateTimeOffset>> _recent = new();

    public string? TryTake(string userId)
    {
        var now = clock.GetUtcNow();
        var queue = _recent.GetOrAdd(userId, _ => new Queue<DateTimeOffset>());
        lock (queue)
        {
            while (queue.Count > 0 && now - queue.Peek() >= Window) queue.Dequeue();
            if (queue.Count >= MaxWrites)
            {
                var wait = Window - (now - queue.Peek());
                return $"That is {MaxWrites} changes in {Window.TotalMinutes:0} minutes, the most the assistant makes in a row. Try again in about {Math.Max(1, (int)Math.Ceiling(wait.TotalMinutes))} minutes, or make the rest in the back office.";
            }
            queue.Enqueue(now);
            return null;
        }
    }
}
