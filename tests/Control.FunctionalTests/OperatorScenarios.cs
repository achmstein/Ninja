using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Ninja.Control.API.Apis;
using Ninja.Control.API.Platform;

namespace Ninja.Control.FunctionalTests;

/// <summary>The Team tab: operators invited, shut out and helped, never the one asking.</summary>
[TestClass]
public sealed class OperatorScenarios
{
    private static DryRunOperatorDirectory Directory => ControlPlane.Factory.Services.GetRequiredService<DryRunOperatorDirectory>();

    [TestMethod]
    public async Task An_invited_operator_gets_a_temporary_password_once_and_is_listed_until_set_up()
    {
        var http = ControlPlane.Factory.CreateClient();
        var email = $"ops-{Guid.NewGuid():N}@ninja.test";

        var invited = await http.PostAsJsonAsync("/api/control/operators", new InviteOperatorRequest($"  {email.ToUpperInvariant()} ", "Mona", null));
        Assert.AreEqual(HttpStatusCode.Created, invited.StatusCode);
        var body = (await invited.Content.ReadFromJsonAsync<OperatorInvitedResponse>())!;
        Assert.AreEqual(email, body.Email, "the address is kept the way Keycloak matches it");
        Assert.AreEqual(12, body.TemporaryPassword.Length);

        var listed = (await http.GetFromJsonAsync<List<OperatorResponse>>("/api/control/operators"))!.Single(o => o.Id == body.Id);
        Assert.IsTrue(listed.Enabled);
        Assert.IsTrue(listed.PendingSetup);
        Assert.IsFalse(listed.IsYou);

        var again = await http.PostAsJsonAsync("/api/control/operators", new InviteOperatorRequest(email, null, null));
        Assert.AreEqual(HttpStatusCode.Conflict, again.StatusCode);

        var nonsense = await http.PostAsJsonAsync("/api/control/operators", new InviteOperatorRequest("not an address", null, null));
        Assert.AreEqual(HttpStatusCode.BadRequest, nonsense.StatusCode);
    }

    [TestMethod]
    public async Task A_colleague_can_be_disabled_reset_and_signed_out_and_each_is_audited()
    {
        var http = ControlPlane.Factory.CreateClient();
        var email = $"ops-{Guid.NewGuid():N}@ninja.test";
        var id = (await (await http.PostAsJsonAsync("/api/control/operators", new InviteOperatorRequest(email, null, null))).Content.ReadFromJsonAsync<OperatorInvitedResponse>())!.Id;

        Assert.AreEqual(HttpStatusCode.NoContent, (await http.PostAsync($"/api/control/operators/{id}/disable", null)).StatusCode);
        Assert.IsFalse((await Directory.FindAsync(id, default))!.Enabled);
        CollectionAssert.Contains(Directory.SignedOut, id, "a disabled operator's sessions end with it");
        Assert.AreEqual(HttpStatusCode.NoContent, (await http.PostAsync($"/api/control/operators/{id}/enable", null)).StatusCode);
        Assert.IsTrue((await Directory.FindAsync(id, default))!.Enabled);

        var reset = await http.PostAsync($"/api/control/operators/{id}/password", null);
        Assert.AreEqual(HttpStatusCode.OK, reset.StatusCode);
        Assert.AreEqual(12, (await reset.Content.ReadFromJsonAsync<OperatorPasswordResponse>())!.TemporaryPassword.Length);

        Assert.AreEqual(HttpStatusCode.NoContent, (await http.PostAsync($"/api/control/operators/{id}/authenticator", null)).StatusCode);
        Assert.IsFalse((await Directory.FindAsync(id, default))!.HasAuthenticator);
        Assert.AreEqual(HttpStatusCode.NoContent, (await http.PostAsync($"/api/control/operators/{id}/sign-out", null)).StatusCode);

        Assert.AreEqual(HttpStatusCode.NotFound, (await http.PostAsync($"/api/control/operators/{Guid.NewGuid()}/disable", null)).StatusCode);

        var audit = (await http.GetFromJsonAsync<List<AuditEntry>>("/api/control/audit?take=500"))!
            .Where(a => a.Details?.Contains(id) == true).Select(a => a.Action).ToList();
        CollectionAssert.IsSubsetOf(new[] { "operator.invited", "operator.disabled", "operator.enabled", "operator.password.reset", "operator.authenticator.reset", "operator.signed-out" }, audit);
    }

    [TestMethod]
    public async Task Nobody_manages_their_own_account_here()
    {
        Directory.Seed(new PlatformOperator(TestAuth.UserId, TestAuth.Email, null, null, true, null, true, false));
        var http = ControlPlane.Factory.CreateClient();

        var me = (await http.GetFromJsonAsync<List<OperatorResponse>>("/api/control/operators"))!.Single(o => o.Id == TestAuth.UserId);
        Assert.IsTrue(me.IsYou);

        foreach (var action in new[] { "disable", "password", "authenticator", "sign-out" })
            Assert.AreEqual(HttpStatusCode.Conflict, (await http.PostAsync($"/api/control/operators/{TestAuth.UserId}/{action}", null)).StatusCode, action);
        Assert.IsTrue((await Directory.FindAsync(TestAuth.UserId, default))!.Enabled);
    }

    [TestMethod]
    public async Task The_team_is_closed_to_anyone_not_signed_in()
    {
        var anonymous = Api.AsPlatformAdmin().Anonymous();
        Assert.AreEqual(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/control/operators")).StatusCode);
        Assert.AreEqual(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/api/control/operators", new InviteOperatorRequest("x@ninja.test", null, null))).StatusCode);
    }
}
