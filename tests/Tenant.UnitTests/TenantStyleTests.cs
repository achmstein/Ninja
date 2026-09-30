using Ninja.Tenant.API.Model;

namespace Ninja.Tenant.UnitTests;

/// <summary>The styles a business may wear: Ninja, the platform's signature style, first.</summary>
[TestClass]
public sealed class TenantStyleTests
{
    [TestMethod]
    public void Ninja_is_listed_first()
    {
        Assert.AreEqual("ninja", TenantTheme.Styles[0]);
        CollectionAssert.IsSubsetOf(new[] { "classic", "minimal", "bold", "cozy", "night" }, TenantTheme.Styles, "the first five stay");
    }

    [TestMethod]
    public void A_business_that_never_chose_is_still_classic()
    {
        Assert.IsNull(new TenantTheme().Style, "no style is classic; only provisioning gives a new business Ninja");
    }
}
