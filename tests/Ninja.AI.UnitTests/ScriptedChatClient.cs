using System.Runtime.CompilerServices;
using Microsoft.Extensions.AI;

namespace Ninja.AI.UnitTests;

/// <summary>Plays a model that answers a fixed sequence of texts, optionally slowly.</summary>
public sealed class ScriptedChatClient(IEnumerable<string> answers, TimeSpan? delay = null) : IChatClient
{
    private readonly Queue<string> _answers = new(answers);

    public List<IList<ChatMessage>> Calls { get; } = [];

    public List<ChatOptions?> Options { get; } = [];

    public async Task<ChatResponse> GetResponseAsync(IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default)
    {
        Calls.Add(messages.ToList());
        Options.Add(options);
        if (delay is { } d)
            await Task.Delay(d, cancellationToken);
        var text = _answers.Count > 0 ? _answers.Dequeue() : string.Empty;
        return new ChatResponse(new ChatMessage(ChatRole.Assistant, text))
        {
            ModelId = "scripted",
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
