using Ninja.Tenant.API.Apis;

namespace Ninja.Tenant.UnitTests;

/// <summary>What the apps are told about signing in with Google and Apple, from the stack's Tenant:SocialSignIn.</summary>
[TestClass]
public sealed class TenantAuthTests
{
    [TestMethod]
    public void Each_provider_comes_with_the_hint_the_browser_sends()
    {
        var social = TenantAuth.SocialOf("google=ninja-google, apple=ninja-apple");
        CollectionAssert.AreEqual(
            new[] { new TenantSocialProvider("google", "ninja-google"), new TenantSocialProvider("apple", "ninja-apple") },
            social.ToArray());
    }

    [TestMethod]
    public void Off_or_unset_is_nothing_to_offer()
    {
        Assert.AreEqual(0, TenantAuth.SocialOf(null).Count);
        Assert.AreEqual(0, TenantAuth.SocialOf("  ").Count);
    }

    [TestMethod]
    public void What_is_not_a_known_provider_with_a_hint_is_left_out()
    {
        var social = TenantAuth.SocialOf("google=,facebook=fb,apple,apple=ninja-apple");
        CollectionAssert.AreEqual(new[] { new TenantSocialProvider("apple", "ninja-apple") }, social.ToArray());
    }
}
