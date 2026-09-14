using Chillax.AI;
using Chillax.AI.Agents;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Catalog.UnitTests.Assist;

/// <summary>
/// The real provider for the opt-in live tests: the same AddAIServices the
/// service runs, fed the connection string the AppHost would hand out.
/// Needs GEMINI_API_KEY (or OPENAI_API_KEY) in the environment; the tests
/// are inconclusive without one, so the normal run never touches the network.
/// </summary>
internal static class LiveProvider
{
    public static IChillaxAgentFactory FactoryOrInconclusive()
    {
        var key = Environment.GetEnvironmentVariable("GEMINI_API_KEY") ?? Environment.GetEnvironmentVariable("OPENAI_API_KEY");
        if (string.IsNullOrWhiteSpace(key))
            Assert.Inconclusive("Set GEMINI_API_KEY to run the live provider tests.");

        var endpoint = Environment.GetEnvironmentVariable("AI_ENDPOINT") ?? "https://generativelanguage.googleapis.com/v1beta/openai/";
        var model = Environment.GetEnvironmentVariable("AI_CHAT_MODEL") ?? "gemini-2.5-flash";

        var builder = Host.CreateEmptyApplicationBuilder(new HostApplicationBuilderSettings { DisableDefaults = true });
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:chatModel"] = $"Endpoint={endpoint};Key={key};Model={model}",
            ["AI:StructuredOutput"] = Environment.GetEnvironmentVariable("AI_STRUCTURED_OUTPUT"),
        });
        builder.Services.AddLogging();
        builder.AddAIServices();
        return builder.Build().Services.GetRequiredService<IChillaxAgentFactory>();
    }
}
