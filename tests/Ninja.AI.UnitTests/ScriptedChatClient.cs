using System.Runtime.CompilerServices;
using Microsoft.Extensions.AI;

namespace Ninja.AI.UnitTests;

/// <summary>
/// Plays a model that answers a fixed sequence, optionally slowly: a text is
/// the answer, a <see cref="ChatResponse"/> is returned as it is, an
/// exception is thrown (a provider error).
/// </summary>
public sealed class ScriptedChatClient(IEnumerable<object> answers, TimeSpan? delay = null) : IChatClient
{
    private readonly Queue<object> _answers = new(answers);

    public List<IList<ChatMessage>> Calls { get; } = [];

    public List<ChatOptions?> Options { get; } = [];

    public async Task<ChatResponse> GetResponseAsync(IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default)
    {
        Calls.Add(messages.ToList());
        Options.Add(options);
        if (delay is { } d)
            await Task.Delay(d, cancellationToken);
        var next = _answers.Count > 0 ? _answers.Dequeue() : string.Empty;
        if (next is Exception exception)
            throw exception;
        if (next is ChatResponse response)
            return response;
        return new ChatResponse(new ChatMessage(ChatRole.Assistant, (string)next))
        {
            ModelId = options?.ModelId ?? "scripted",
            Usage = new UsageDetails { InputTokenCount = 10, OutputTokenCount = 5, TotalTokenCount = 15 },
        };
    }

    public async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(IEnumerable<ChatMessage> messages, ChatOptions? options = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var response = await GetResponseAsync(messages, options, cancellationToken);
        foreach (var update in response.ToChatResponseUpdates())
            yield return update;
    }

    public object? GetService(Type serviceType, object? serviceKey = null) => serviceKey is null && serviceType.IsInstanceOfType(this) ? this : null;

    public void Dispose()
    {
    }
}

/// <summary>A bare provider response with a status, for a <see cref="System.ClientModel.ClientResultException"/>.</summary>
public sealed class StatusResponse(int status) : System.ClientModel.Primitives.PipelineResponse
{
    public override int Status => status;

    public override string ReasonPhrase => string.Empty;

    public override Stream? ContentStream { get; set; }

    public override BinaryData Content => BinaryData.Empty;

    protected override System.ClientModel.Primitives.PipelineResponseHeaders HeadersCore { get; } = new NoHeaders();

    public override BinaryData BufferContent(CancellationToken cancellationToken = default) => BinaryData.Empty;

    public override ValueTask<BinaryData> BufferContentAsync(CancellationToken cancellationToken = default) => ValueTask.FromResult(BinaryData.Empty);

    public override void Dispose()
    {
    }

    private sealed class NoHeaders : System.ClientModel.Primitives.PipelineResponseHeaders
    {
        public override bool TryGetValue(string name, out string? value)
        {
            value = null;
            return false;
        }

        public override bool TryGetValues(string name, out IEnumerable<string>? values)
        {
            values = null;
            return false;
        }

        public override IEnumerator<KeyValuePair<string, string>> GetEnumerator() => Enumerable.Empty<KeyValuePair<string, string>>().GetEnumerator();
    }

    public static System.ClientModel.ClientResultException Error(int status) => new($"Service request failed. Status: {status}", new StatusResponse(status));
}
