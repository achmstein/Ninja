using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.OpenAI;
using Chillax.AppHost;
using Microsoft.Extensions.Configuration;

namespace Chillax.AppHost.UnitTests;

[TestClass]
public class ChatModelConfigurationTests
{
    [TestMethod]
    public void The_chat_model_is_off_until_a_key_is_configured()
    {
        Assert.IsFalse(Extensions.IsChatModelEnabled(Config(), isPublishMode: false));
        Assert.IsFalse(Extensions.IsChatModelEnabled(Config(("Parameters:openai-openai-apikey", "  ")), isPublishMode: false));
    }

    [TestMethod]
    public void A_user_secret_or_the_environment_variable_turns_it_on()
    {
        Assert.IsTrue(Extensions.IsChatModelEnabled(Config(("Parameters:openai-openai-apikey", "AIza-test")), isPublishMode: false));
        Assert.IsTrue(Extensions.IsChatModelEnabled(Config(("OPENAI_API_KEY", "sk-test")), isPublishMode: false));
    }

    [TestMethod]
    public void Publishing_always_declares_the_model_so_the_key_becomes_a_deploy_parameter()
    {
        Assert.IsTrue(Extensions.IsChatModelEnabled(Config(), isPublishMode: true));
    }

    [TestMethod]
    public void AddChatModel_declares_the_provider_and_the_model_and_hands_the_model_to_the_projects()
    {
        var builder = CreateBuilder();
        builder.Configuration["Parameters:openai-openai-apikey"] = "AIza-test";
        var catalog = builder.AddProject("catalog-api", ProjectPath("Catalog.API", "Catalog.API.csproj"));
        var inventory = builder.AddProject("inventory-api", ProjectPath("Inventory.API", "Inventory.API.csproj"));

        builder.AddChatModel(catalog, inventory);

        var names = builder.Resources.Select(resource => resource.Name).ToArray();
        CollectionAssert.IsSubsetOf(new[] { "openai", "chatModel" }, names);

        var model = builder.Resources.Single(resource => resource.Name == "chatModel");
        foreach (var project in new[] { catalog.Resource, inventory.Resource })
        {
            var referenced = project.Annotations.OfType<ResourceRelationshipAnnotation>()
                .Any(relationship => ReferenceEquals(relationship.Resource, model) && relationship.Type == "Reference");
            Assert.IsTrue(referenced, $"{project.Name} should reference chatModel");
        }
    }

    [TestMethod]
    public void The_endpoint_and_model_come_from_the_AI_section_and_default_to_Gemini()
    {
        var defaults = CreateBuilder();
        defaults.Configuration["Parameters:openai-openai-apikey"] = "AIza-test";
        defaults.AddChatModel();
        Assert.AreEqual("gemini-2.5-flash", ModelName(defaults));
        Assert.AreEqual(Extensions.GeminiEndpoint, Endpoint(defaults));

        var custom = CreateBuilder();
        custom.Configuration["Parameters:openai-openai-apikey"] = "sk-test";
        custom.Configuration["AI:Endpoint"] = "https://example.test/v1/";
        custom.Configuration["AI:ChatModel"] = "my-model";
        custom.AddChatModel();
        Assert.AreEqual("my-model", ModelName(custom));
        Assert.AreEqual("https://example.test/v1/", Endpoint(custom));
    }

    private static string ModelName(IDistributedApplicationBuilder builder) =>
        ((OpenAIModelResource)builder.Resources.Single(resource => resource.Name == "chatModel")).Model;

    private static string Endpoint(IDistributedApplicationBuilder builder) =>
        ((OpenAIResource)builder.Resources.Single(resource => resource.Name == "openai")).Endpoint;

    private static IConfiguration Config(params (string Key, string? Value)[] values) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(values.ToDictionary(v => v.Key, v => v.Value))
            .Build();

    private static IDistributedApplicationBuilder CreateBuilder() =>
        DistributedApplication.CreateBuilder(new DistributedApplicationOptions
        {
            AssemblyName = typeof(ChatModelConfigurationTests).Assembly.FullName,
            DisableDashboard = true
        });

    private static string ProjectPath(string directory, string project) =>
        Path.Combine(FindRepositoryRoot(), "src", directory, project);

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "Chillax.slnx")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName
            ?? throw new DirectoryNotFoundException("Could not locate the Chillax repository root.");
    }
}
