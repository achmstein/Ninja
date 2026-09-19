using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.OpenAI;
using Ninja.AppHost;
using Microsoft.Extensions.Configuration;

namespace Ninja.AppHost.UnitTests;

[TestClass]
public class ChatModelConfigurationTests
{
    [TestMethod]
    public void The_assistant_is_on_unless_switched_off_in_configuration()
    {
        Assert.IsTrue(Extensions.IsAssistantEnabled(Config()));
        Assert.IsTrue(Extensions.IsAssistantEnabled(Config(("AI:Enabled", "true"))));
        Assert.IsFalse(Extensions.IsAssistantEnabled(Config(("AI:Enabled", "false"))));
    }

    [TestMethod]
    public void The_key_comes_from_user_secrets_or_the_environment()
    {
        Assert.IsNull(Extensions.ChatModelKey(Config()));
        Assert.IsNull(Extensions.ChatModelKey(Config(("Parameters:gemini-api-key", "  "))));
        Assert.AreEqual("AIza-secret", Extensions.ChatModelKey(Config(("Parameters:gemini-api-key", "AIza-secret"))));
        Assert.AreEqual("AIza-env-style", Extensions.ChatModelKey(Config(("Parameters:gemini_api_key", "AIza-env-style"))), "the spelling an environment variable gives the parameter");
        Assert.AreEqual("AIza-env", Extensions.ChatModelKey(Config(("GEMINI_API_KEY", "AIza-env"))));
        Assert.AreEqual("sk-env", Extensions.ChatModelKey(Config(("OPENAI_API_KEY", "sk-env"))));
    }

    [TestMethod]
    public void AddChatModel_declares_the_key_parameter_the_provider_and_the_model_and_hands_the_model_to_the_projects()
    {
        var builder = CreateBuilder();
        var catalog = builder.AddProject("catalog-api", ProjectPath("Catalog.API", "Catalog.API.csproj"));
        var inventory = builder.AddProject("inventory-api", ProjectPath("Inventory.API", "Inventory.API.csproj"));
        var finance = builder.AddProject("finance-api", ProjectPath("Finance.API", "Finance.API.csproj"));

        builder.AddChatModel(catalog, inventory, finance);

        var names = builder.Resources.Select(resource => resource.Name).ToArray();
        CollectionAssert.IsSubsetOf(new[] { Extensions.ApiKeyParameterName, "openai", "chatModel" }, names);
        Assert.DoesNotContain("openai-openai-apikey", names, "the provider's default key parameter gives way to ours");

        var parameter = (ParameterResource)builder.Resources.Single(resource => resource.Name == Extensions.ApiKeyParameterName);
        Assert.IsTrue(parameter.Secret);
        Assert.AreSame(parameter, ((OpenAIResource)builder.Resources.Single(resource => resource.Name == "openai")).Key);

        var model = builder.Resources.Single(resource => resource.Name == "chatModel");
        foreach (var project in new[] { catalog.Resource, inventory.Resource, finance.Resource })
        {
            var referenced = project.Annotations.OfType<ResourceRelationshipAnnotation>()
                .Any(relationship => ReferenceEquals(relationship.Resource, model) && relationship.Type == "Reference");
            Assert.IsTrue(referenced, $"{project.Name} should reference chatModel");
        }
    }

    [TestMethod]
    public void Without_a_key_the_parameter_is_unresolved_so_the_dashboard_asks_for_it()
    {
        var builder = CreateBuilder();
        builder.AddChatModel();

        var parameter = (ParameterResource)builder.Resources.Single(resource => resource.Name == Extensions.ApiKeyParameterName);

        // MissingParameterValueException is what Aspire's parameter processor turns into the dashboard prompt
        Assert.ThrowsExactly<MissingParameterValueException>(() => _ = parameter.Value);
    }

    [TestMethod]
    public async Task A_key_from_the_environment_reaches_the_connection_string()
    {
        var builder = CreateBuilder();
        builder.Configuration["GEMINI_API_KEY"] = "AIza-from-env";
        builder.AddChatModel();

        var model = (OpenAIModelResource)builder.Resources.Single(resource => resource.Name == "chatModel");
        var connectionString = await model.ConnectionStringExpression.GetValueAsync(CancellationToken.None);

        Assert.Contains("Key=AIza-from-env", connectionString!);
        Assert.Contains("Model=gemini-3.8-flash", connectionString);
        Assert.Contains($"Endpoint={Extensions.GeminiEndpoint}", connectionString);
    }

    [TestMethod]
    public void The_endpoint_and_model_come_from_the_AI_section_and_default_to_Gemini()
    {
        var defaults = CreateBuilder();
        defaults.AddChatModel();
        Assert.AreEqual("gemini-3.8-flash", ModelName(defaults));
        Assert.AreEqual(Extensions.GeminiEndpoint, Endpoint(defaults));

        var custom = CreateBuilder();
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
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "Ninja.slnx")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName
            ?? throw new DirectoryNotFoundException("Could not locate the Chillax repository root.");
    }
}
