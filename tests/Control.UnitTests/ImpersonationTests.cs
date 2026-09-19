using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

[TestClass]
public sealed class ImpersonationTests
{
    [TestMethod]
    public void A_ticket_works_once()
    {
        var tickets = new ImpersonationTickets();
        var id = tickets.Issue("blue", ["KEYCLOAK_IDENTITY=x; Path=/realms/blue/"], "https://admin.blue.ninja.app");

        var first = tickets.Redeem(id);
        Assert.IsNotNull(first);
        Assert.AreEqual("blue", first.Slug);
        Assert.AreEqual("https://admin.blue.ninja.app", first.RedirectUrl);
        Assert.AreEqual(1, first.SetCookies.Count);

        Assert.IsNull(tickets.Redeem(id), "the second opening gets nothing");
        Assert.IsNull(tickets.Redeem("not-a-ticket"));
    }

    [TestMethod]
    public void A_ticket_dies_after_its_minute()
    {
        var now = new DateTimeOffset(2026, 9, 19, 12, 0, 0, TimeSpan.Zero);
        var tickets = new ImpersonationTickets { Now = () => now };
        var id = tickets.Issue("blue", [], "https://admin.blue.ninja.app");

        now += ImpersonationTickets.Lifetime + TimeSpan.FromSeconds(1);
        Assert.IsNull(tickets.Redeem(id));
    }

    [TestMethod]
    public void Ticket_ids_are_long_random_and_unique()
    {
        var tickets = new ImpersonationTickets();
        var a = tickets.Issue("a", [], "x");
        var b = tickets.Issue("a", [], "x");
        Assert.AreEqual(48, a.Length);
        Assert.AreNotEqual(a, b);
    }
}
