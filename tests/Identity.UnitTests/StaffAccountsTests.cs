using System.Net;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.EventBus.Abstractions;
using Ninja.EventBus.Events;
using Ninja.Identity.API;
using Ninja.Identity.API.IntegrationEvents;

namespace Ninja.Identity.UnitTests;

/// <summary>
/// A staff account is made whole or not at all: a realm without the role
/// refuses before anything exists, and a user whose role cannot be given is
/// deleted again, so its email does not block the retry.
/// </summary>
[TestClass]
public sealed class StaffAccountsTests
{
    private const string Realm = "https://auth.test/realms/shop";
    private const string Admin = "https://auth.test/admin/realms/shop";

    [TestMethod]
    public async Task A_realm_without_the_role_refuses_before_making_anyone()
    {
        var keycloak = new FakeKeycloak { Roles = { "Admin", "Owner", "Cashier" } };
        var (staff, bus) = Make(keycloak);

        var result = await staff.CreateAsync("rider@x.test", "Secret123!", "Amr Ali", "Rider", false, [3]);

        Assert.IsInstanceOfType<StaffCreation.Failed>(result);
        Assert.IsFalse(keycloak.Calls.Any(c => c.StartsWith($"POST {Admin}/users")), "nobody is made");
        Assert.IsEmpty(bus.Published);
    }

    [TestMethod]
    public async Task A_user_whose_role_cannot_be_given_is_deleted_again()
    {
        var keycloak = new FakeKeycloak { Roles = { "Rider" }, FailRoleMapping = true };
        var (staff, bus) = Make(keycloak);

        var result = await staff.CreateAsync("rider@x.test", "Secret123!", "Amr Ali", "Rider", false, [3]);

        Assert.IsInstanceOfType<StaffCreation.Failed>(result);
        Assert.Contains($"DELETE {Admin}/users/u-1", keycloak.Calls);
        Assert.IsEmpty(bus.Published, "nothing to say about an account that is not there");
    }

    [TestMethod]
    public async Task A_made_account_is_said_with_its_roles_and_branches()
    {
        var keycloak = new FakeKeycloak { Roles = { "Admin", "Owner" } };
        var (staff, bus) = Make(keycloak);

        var result = await staff.CreateAsync("boss@x.test", "Secret123!", "Mona Samir", "Admin", true, [1, 2]);

        Assert.AreEqual("u-1", (result as StaffCreation.Created)?.UserId);
        var said = (StaffAccountChangedIntegrationEvent)bus.Published.Single();
        CollectionAssert.AreEqual(new[] { "Admin", "Owner" }, said.Roles);
        CollectionAssert.AreEqual(new[] { 1, 2 }, said.Branches);
        Assert.AreEqual("Mona Samir", said.Name);
        Assert.IsTrue(said.Enabled);
    }

    [TestMethod]
    public async Task A_taken_email_is_said_as_taken()
    {
        var keycloak = new FakeKeycloak { Roles = { "Cashier" }, EmailTaken = true };
        var (staff, _) = Make(keycloak);

        Assert.IsInstanceOfType<StaffCreation.Taken>(await staff.CreateAsync("c@x.test", "Secret123!", "C", "Cashier", false, []));
    }

    [TestMethod]
    public void Every_staff_account_is_said_at_start_and_customers_are_not()
    {
        var users = new[]
        {
            new DirectoryUser("r1", "r1", null, "Amr", "Ali", true, null, ["Rider"], null, [3]),
            new DirectoryUser("c1", "c1", null, "Nadia", null, true, null, [], "0100", []),
            new DirectoryUser("k1", "k1", null, "Kitchen", null, false, null, ["Kitchen"], null, [1]),
        };

        var said = StaffAnnouncer.Staff(users).ToList();

        CollectionAssert.AreEqual(new[] { "r1", "k1" }, said.Select(s => s.UserId).ToArray());
        Assert.IsFalse(said[1].Enabled);
        CollectionAssert.AreEqual(new[] { 3 }, said[0].Branches);
    }

    private static (StaffAccounts, RecordingBus) Make(FakeKeycloak keycloak)
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Identity:Url"] = Realm,
            ["Keycloak:Realm"] = "shop",
        }).Build();
        var bus = new RecordingBus();
        return (new StaffAccounts(new KeycloakAdmin(new Factory(keycloak), config), bus, NullLogger<StaffAccounts>.Instance), bus);
    }

    private sealed class Factory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }

    private sealed class RecordingBus : IEventBus
    {
        public List<IntegrationEvent> Published { get; } = [];

        public Task PublishAsync(IntegrationEvent @event)
        {
            Published.Add(@event);
            return Task.CompletedTask;
        }
    }

    /// <summary>Keycloak's admin REST, as far as making a staff account goes.</summary>
    private sealed class FakeKeycloak : HttpMessageHandler
    {
        public HashSet<string> Roles { get; } = [];
        public bool FailRoleMapping { get; init; }
        public bool EmailTaken { get; init; }
        public List<string> Calls { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var url = request.RequestUri!.ToString();
            Calls.Add($"{request.Method} {url}");
            HttpResponseMessage Json(JsonNode body) => new(HttpStatusCode.OK) { Content = new StringContent(body.ToJsonString(), System.Text.Encoding.UTF8, "application/json") };

            if (url.EndsWith("/protocol/openid-connect/token"))
                return Task.FromResult(Json(new JsonObject { ["access_token"] = "t" }));
            if (request.Method == HttpMethod.Get && url.StartsWith($"{Admin}/roles/"))
            {
                var role = Uri.UnescapeDataString(url[($"{Admin}/roles/").Length..]);
                return Task.FromResult(Roles.Contains(role) ? Json(new JsonObject { ["id"] = $"id-{role}", ["name"] = role }) : new HttpResponseMessage(HttpStatusCode.NotFound));
            }
            if (request.Method == HttpMethod.Post && url == $"{Admin}/users")
            {
                if (EmailTaken) return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Conflict));
                var created = new HttpResponseMessage(HttpStatusCode.Created);
                created.Headers.Location = new Uri($"{Admin}/users/u-1");
                return Task.FromResult(created);
            }
            if (request.Method == HttpMethod.Post && url.EndsWith("/role-mappings/realm"))
                return Task.FromResult(new HttpResponseMessage(FailRoleMapping ? HttpStatusCode.InternalServerError : HttpStatusCode.NoContent));
            if (request.Method == HttpMethod.Delete)
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NoContent));
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
        }
    }
}
