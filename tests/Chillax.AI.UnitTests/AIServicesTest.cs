using Chillax.AI;
using Chillax.AI.Agents;
using Chillax.AI.Fake;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Chillax.AI.UnitTests;

[TestClass]
public class AIServicesTest
{
    private static IServiceProvider Build(params (string Key, string? Value)[] settings)
    {
        var builder = Host.CreateEmptyApplicationBuilder(new HostApplicationBuilderSettings { DisableDefaults = true });
        builder.Configuration.AddInMemoryCollection(settings.Select(s => new KeyValuePair<string, string?>(s.Key, s.Value)));
        builder.Services.AddLogging();
        builder.AddAIServices();
        builder.Services.AddFakeAgentScript("echo", r => $"{{\"text\":\"{r.UserText}\"}}");
        return builder.Build().Services;
    }

    [TestMethod]
    public void Without_a_connection_string_nothing_is_registered_and_the_factory_is_off()
    {
        var services = Build();

        Assert.IsNull(services.GetService<IChatClient>());
        Assert.IsFalse(services.GetRequiredService<IChillaxAgentFactory>().IsEnabled);
    }

    [TestMethod]
    public void UseFake_registers_the_scripted_client()
    {
        var services = Build(("AI:UseFake", "true"));

        var client = services.GetRequiredService<IChatClient>();
        Assert.IsNotNull(client.GetService<FakeChatClient>());
        Assert.IsTrue(services.GetRequiredService<IChillaxAgentFactory>().IsEnabled);
    }

    [TestMethod]
    public void A_chatModel_connection_string_registers_an_openai_backed_client()
    {
        var services = Build(("ConnectionStrings:chatModel", "Endpoint=https://example.test/v1/;Key=secret;Model=test-model"));

        var client = services.GetRequiredService<IChatClient>();
        var metadata = client.GetService<ChatClientMetadata>();
        Assert.IsNotNull(metadata);
        Assert.AreEqual("test-model", metadata.DefaultModelId);
        Assert.IsTrue(services.GetRequiredService<IChillaxAgentFactory>().IsEnabled);
    }

    [TestMethod]
    public void Options_bind_from_the_AI_section()
    {
        var services = Build(("AI:RequestsPerMinute", "9"), ("AI:StructuredOutput", "JsonObject"), ("AI:VisionModel", "gemini-vision"));

        var options = services.GetRequiredService<Microsoft.Extensions.Options.IOptions<AIOptions>>().Value;
        Assert.AreEqual(9, options.RequestsPerMinute);
        Assert.AreEqual(StructuredOutputMode.JsonObject, options.StructuredOutput);
        Assert.AreEqual("gemini-vision", options.VisionModel);
        Assert.AreEqual(5 * 1024 * 1024, options.MaxImageBytes);
    }
}
