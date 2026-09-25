using Ninja.Identity.API;

namespace Identity.UnitTests;

[TestClass]
public class CounterCustomerTests
{
    [TestMethod]
    public void A_token_carries_the_user_and_a_secret_of_which_only_a_hash_is_kept()
    {
        var userId = Guid.NewGuid().ToString();
        var (token, hash) = CounterCustomer.NewClaimToken(userId);

        Assert.IsTrue(CounterCustomer.TryParse(token, out var parsedId, out var secret));
        Assert.AreEqual(userId, parsedId, "the id travels compact and comes back as Keycloak writes it");
        Assert.IsTrue(CounterCustomer.Matches(secret, hash));
        Assert.DoesNotContain(secret, hash);
        Assert.IsFalse(CounterCustomer.Matches(secret + "x", hash), "a wrong secret");
        Assert.IsFalse(CounterCustomer.Matches(secret, null), "a user with no link out");
        Assert.AreNotEqual(token, CounterCustomer.NewClaimToken(userId).Token, "every link is new");
        Assert.IsLessThan(90, token.Length, "short enough for a QR a phone reads at arm's length");
    }

    [TestMethod]
    [DataRow(null)]
    [DataRow("")]
    [DataRow("no-dot-at-all")]
    [DataRow(".secret-without-id")]
    [DataRow("id-without-secret.")]
    public void Anything_else_is_not_a_token(string? token)
    {
        Assert.IsFalse(CounterCustomer.TryParse(token, out _, out _));
    }

    [TestMethod]
    public void The_stand_in_email_is_the_numbers_digits_and_never_shown()
    {
        Assert.AreEqual("01012345678@counter.invalid", CounterCustomer.StandInEmail("01012345678"));
        Assert.AreEqual("447700900123@counter.invalid", CounterCustomer.StandInEmail("+447700900123"));
        Assert.IsTrue(CounterCustomer.IsStandInEmail("01012345678@COUNTER.invalid"));
        Assert.IsNull(CounterCustomer.VisibleEmail("01012345678@counter.invalid"));
        Assert.AreEqual("a@b.com", CounterCustomer.VisibleEmail("a@b.com"));
    }

    [TestMethod]
    public void Only_a_counter_customer_still_on_the_stand_in_address_can_be_claimed()
    {
        var counter = new Dictionary<string, string[]> { ["origin"] = ["counter"] };
        Assert.IsTrue(CounterCustomer.IsClaimable(counter, "01012345678@counter.invalid"));
        Assert.IsFalse(CounterCustomer.IsClaimable(counter, "their@own.com"), "claimed already");
        Assert.IsFalse(CounterCustomer.IsClaimable(new Dictionary<string, string[]>(), "01012345678@counter.invalid"), "not added at the counter");
        Assert.IsFalse(CounterCustomer.IsClaimable(null, null));
    }
}
