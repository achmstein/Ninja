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
        Assert.AreEqual(502, AIProblems.From(new AIProviderException(401, "bad key", null, null), http).StatusCode);
        Assert.AreEqual(502, AIProblems.From(new AIProviderException(503, "overloaded", null, null), http).StatusCode);

        var busy = AIProblems.From(new AIProviderException(429, "slow down", TimeSpan.FromSeconds(17), null), http);
        Assert.AreEqual(429, busy.StatusCode);
        Assert.AreEqual("17", http.Response.Headers.RetryAfter.ToString());
    }
}
