using System.Security.Claims;
using Chillax.ServiceDefaults;

namespace ServiceDefaults.UnitTests;

[TestClass]
public class ClaimsPrincipalExtensionsTest
{
    private static ClaimsPrincipal WithBranches(params string[] values) =>
        new(new ClaimsIdentity(values.Select(v => new Claim(ClaimsPrincipalExtensions.BranchClaimType, v)), "test"));

    [TestMethod]
    public void Reads_the_multivalued_claim_as_ids()
    {
        CollectionAssert.AreEquivalent(new[] { 1, 2 }, WithBranches("1", "2").GetBranchIds().ToArray());
    }

    [TestMethod]
    public void Ignores_values_that_are_not_ids_and_duplicates()
    {
        CollectionAssert.AreEquivalent(new[] { 3 }, WithBranches("3", "x", "3", "").GetBranchIds().ToArray());
    }

    [TestMethod]
    public void Is_empty_without_the_claim()
    {
        Assert.AreEqual(0, WithBranches().GetBranchIds().Count);
    }
}
