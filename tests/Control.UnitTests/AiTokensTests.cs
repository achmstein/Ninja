using System.Text.Json.Nodes;
using Ninja.Control.API.Platform;

namespace Control.UnitTests;

/// <summary>
/// What a call used, read from the provider's answer whichever way it says it: a picture drawn is
/// counted in tokens like a chat answer, where the provider reports them.
/// </summary>
[TestClass]
public class AiTokensTests
{
    [TestMethod]
    public void A_chat_completion_says_prompt_and_completion_tokens()
    {
        Assert.AreEqual((12L, 34L), AiTokens.Of("""{"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":34,"total_tokens":46}}"""));
    }

    [TestMethod]
    public void An_image_model_says_input_and_output_tokens()
    {
        // OpenAI's images/generations and images/edits
        var answer = """{"data":[{"b64_json":"AAAA"}],"usage":{"input_tokens":50,"output_tokens":4160,"total_tokens":4210,"input_tokens_details":{"text_tokens":50,"image_tokens":0}}}""";
        Assert.AreEqual((50L, 4160L), AiTokens.Of(answer));
    }

    [TestMethod]
    public void Gemini_s_own_answer_says_it_in_usage_metadata_thinking_included()
    {
        var drawn = """{"candidates":[{"content":{"parts":[{"inlineData":{"mimeType":"image/png","data":"AAAA"}}]}}],"usageMetadata":{"promptTokenCount":40,"candidatesTokenCount":1290,"totalTokenCount":1330}}""";
        Assert.AreEqual((40L, 1290L), AiTokens.Of(drawn));

        var thought = """{"usageMetadata":{"promptTokenCount":40,"candidatesTokenCount":1290,"thoughtsTokenCount":200,"totalTokenCount":1530}}""";
        Assert.AreEqual((40L, 1490L), AiTokens.Of(thought), "what it thought is paid for as output");

        Assert.AreEqual((40L, 1290L), AiTokens.Of("""{"usageMetadata":{"promptTokenCount":40,"candidatesTokenCount":1290}}"""), "no total: what it says of the answer");
    }

    [TestMethod]
    public void Only_a_total_leaves_the_rest_to_the_answer()
    {
        Assert.AreEqual((10L, 90L), AiTokens.Of("""{"usage":{"prompt_tokens":10,"total_tokens":100}}"""));
    }

    [TestMethod]
    public void Nothing_said_is_nothing_counted_and_never_an_error()
    {
        Assert.AreEqual((0L, 0L), AiTokens.Of("""{"data":[{"b64_json":"AAAA"}]}"""), "a model billed by the picture reports no tokens");
        Assert.AreEqual((0L, 0L), AiTokens.Of((string?)null));
        Assert.AreEqual((0L, 0L), AiTokens.Of(""));
        Assert.AreEqual((0L, 0L), AiTokens.Of("not json"));
        Assert.AreEqual((0L, 0L), AiTokens.Of("""{"usage":{"prompt_tokens":"many","completion_tokens":null}}"""));
        Assert.AreEqual((0L, 0L), AiTokens.Of((JsonNode?)null));
        Assert.AreEqual((0L, 0L), AiTokens.Of("""{"usage":"unknown"}"""));
    }
}
