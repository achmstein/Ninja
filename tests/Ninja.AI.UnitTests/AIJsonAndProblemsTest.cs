using System.Text.Json;
using Ninja.AI.Agents;
using Ninja.AI.Http;
using Ninja.AI.Json;
using Microsoft.AspNetCore.Http;

namespace Ninja.AI.UnitTests;

[TestClass]
public class AIJsonAndProblemsTest
{
    [TestMethod]
    public void Strips_json_code_fences_and_leaves_plain_json_alone()
    {
        Assert.AreEqual("{\"a\":1}", AIJson.StripCodeFence("```json\n{\"a\":1}\n```"));
        Assert.AreEqual("{\"a\":1}", AIJson.StripCodeFence("```\n{\"a\":1}\n```"));
        Assert.AreEqual("{\"a\":1}", AIJson.StripCodeFence("  {\"a\":1}  "));
    }

    [TestMethod]
    public void Clean_collapses_whitespace_drops_controls_and_caps()
    {
        Assert.AreEqual("قهوة تركي", AIJson.Clean("  قهوة \n\t تركي ", 50));
        Assert.AreEqual("abcde", AIJson.Clean("abcdefgh", 5));
        Assert.AreEqual(string.Empty, AIJson.Clean(null, 5));
    }

    [TestMethod]
    public void Options_write_arabic_literally_and_enums_as_strings()
    {
        var json = JsonSerializer.Serialize(new { Name = "قهوة", Mode = StructuredOutputMode.JsonObject }, AIJson.Options);

        Assert.Contains("قهوة", json);
        Assert.Contains("\"JsonObject\"", json);
        Assert.Contains("\"name\"", json);
    }

    [TestMethod]
    public void Problems_map_each_failure_to_its_status()
    {
        var http = new DefaultHttpContext();

        Assert.AreEqual(503, AIProblems.From(new AIUnavailableException(), http).StatusCode);
        Assert.AreEqual(504, AIProblems.From(new AITimeoutException("x", TimeSpan.FromSeconds(1)), http).StatusCode);
        Assert.AreEqual(502, AIProblems.From(new AIResponseException("x", "junk", null), http).StatusCode);
        Assert.AreEqual(502, AIProblems.From(new AITruncatedException("x", 1024), http).StatusCode);
        Assert.AreEqual(502, AIProblems.From(new AIProviderException(401, "bad key", null, null), http).StatusCode);
        Assert.AreEqual(502, AIProblems.From(new AIProviderException(503, "overloaded", null, null), http).StatusCode);

        var busy = AIProblems.From(new AIProviderException(429, "slow down", TimeSpan.FromSeconds(17), null), http);
        Assert.AreEqual(429, busy.StatusCode);
        Assert.AreEqual("17", http.Response.Headers.RetryAfter.ToString());
    }

    [TestMethod]
    public void A_spent_allowance_says_so_and_when_it_comes_back_rather_than_try_in_a_minute()
    {
        // What Gemini answered production on 2026-10-02 once a free tier's 20 a day were gone
        const string gemini = "HTTP 429 (RESOURCE_EXHAUSTED) You exceeded your current quota, please check your plan and billing details. "
            + "* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.5-flash "
            + "Please retry in 2h47m56.584147483s.";
        var http = new DefaultHttpContext();
        var spent = AIProblems.From(new AIProviderException(429, gemini, TimeSpan.FromSeconds(10076), null), http);

        Assert.AreEqual(429, spent.StatusCode);
        Assert.AreEqual(AIProblems.QuotaTitle, spent.ProblemDetails.Title);
        Assert.AreEqual("The AI's allowance is used up; it comes back in about 2h 47m.", spent.ProblemDetails.Detail);
        Assert.AreEqual("10077", http.Response.Headers.RetryAfter.ToString(), "2h 47m 57s, the provider's own wait");

        // A quota with no wait in its words falls back on the header's
        var other = new DefaultHttpContext();
        AIProblems.From(new AIProviderException(429, "Quota exceeded.", TimeSpan.FromMinutes(5), null), other);
        Assert.AreEqual("300", other.Response.Headers.RetryAfter.ToString());

        // An ordinary rate limit is still a minute's wait
        var burst = AIProblems.From(new AIProviderException(429, "Too many requests", null, null), new DefaultHttpContext());
        Assert.AreEqual("AI assistant busy", burst.ProblemDetails.Title);
    }
}
