using System.Security.Claims;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

[TestClass]
public sealed class AuditTests
{
    [TestMethod]
    public void A_signed_in_admin_is_the_actor_and_the_api_the_source()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", "u-1"), new Claim("email", "ops@ninja.app")], "test"));

        var (actor, email, source) = AuditWriter.Attribute(user, null);

        Assert.AreEqual("u-1", actor);
        Assert.AreEqual("ops@ninja.app", email);
        Assert.AreEqual("api", source);
    }

    [TestMethod]
    public void Work_nobody_asked_for_is_the_systems_from_the_source_that_did_it()
    {
        Assert.AreEqual((AuditWriter.System, (string?)null, "provisioner"), AuditWriter.Attribute(null, "provisioner"));
        Assert.AreEqual((AuditWriter.System, (string?)null, AuditWriter.System), AuditWriter.Attribute(null, null));
        // An anonymous principal (no subject) is nobody too
        Assert.AreEqual((AuditWriter.System, (string?)null, "expiry"), AuditWriter.Attribute(new ClaimsPrincipal(new ClaimsIdentity()), "expiry"));
    }

    [TestMethod]
    public void A_job_started_by_an_admin_keeps_its_own_source()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", "u-1")], "test"));
        var (actor, _, source) = AuditWriter.Attribute(user, "backup");
        Assert.AreEqual("u-1", actor);
        Assert.AreEqual("backup", source);
    }
}
