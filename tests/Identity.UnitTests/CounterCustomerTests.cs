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
        Assert.AreEqual("201012345678@counter.invalid", CounterCustomer.StandInEmail("+201012345678"));
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

    [TestMethod]
    public void Only_the_account_a_sign_in_just_made_is_new_enough_to_fold_in()
    {
        var now = new DateTimeOffset(2026, 11, 20, 12, 0, 0, TimeSpan.Zero);
        Assert.IsTrue(CounterCustomer.IsFreshAccount(now.AddMinutes(-2).ToUnixTimeMilliseconds(), now));
        Assert.IsTrue(CounterCustomer.IsFreshAccount(now.AddMinutes(-29).ToUnixTimeMilliseconds(), now));
        Assert.IsFalse(CounterCustomer.IsFreshAccount(now.AddMinutes(-31).ToUnixTimeMilliseconds(), now), "a customer's own account from before");
        Assert.IsFalse(CounterCustomer.IsFreshAccount(now.AddDays(-40).ToUnixTimeMilliseconds(), now));
        Assert.IsFalse(CounterCustomer.IsFreshAccount(null, now), "no date to go by");
        Assert.IsFalse(CounterCustomer.IsFreshAccount(now.AddHours(3).ToUnixTimeMilliseconds(), now), "a date from the future");
    }
}
