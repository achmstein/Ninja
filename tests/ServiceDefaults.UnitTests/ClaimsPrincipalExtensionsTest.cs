using System.Security.Claims;
using Ninja.ServiceDefaults;

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
        Assert.IsFalse(WithBranches().HoldsAllBranches());
    }

    [TestMethod]
    public void A_star_holds_every_branch_even_one_made_later()
    {
        var all = WithBranches("*").GetBranchIds();

        Assert.IsTrue(WithBranches("*").HoldsAllBranches());
        Assert.IsTrue(WithBranches("2", "*").HoldsAllBranches(), "ids beside it change nothing");
        Assert.IsTrue(all.Contains(1));
        Assert.IsTrue(all.Contains(123456), "a branch the token never heard of");
        Assert.IsFalse(WithBranches("1", "2").HoldsAllBranches());
        Assert.IsFalse(WithBranches("1", "2").GetBranchIds().Contains(3));
    }

    private static ClaimsPrincipal User(string? sub, params string[] roles) =>
        new(new ClaimsIdentity(
            (sub is null ? [] : new[] { new Claim("sub", sub) })
                .Concat(roles.Select(r => new Claim("role", r))),
            "test"));

    [TestMethod]
    public void A_user_can_act_for_themself()
    {
        Assert.IsTrue(User("u1").CanActFor("u1"));
    }

    [TestMethod]
    public void A_user_cannot_act_for_someone_else()
    {
        Assert.IsFalse(User("u1").CanActFor("u2"));
    }

    [TestMethod]
    public void Till_staff_can_act_for_anyone()
    {
        foreach (var role in new[] { "Admin", "Owner", "Cashier", "cashier" })
        {
            Assert.IsTrue(User("staff", role).CanActFor("u2"), role);
        }
    }

    [TestMethod]
    public void A_customer_role_is_not_till_staff()
    {
        Assert.IsFalse(User("u1", "Customer").IsPosStaff());
        Assert.IsFalse(User("u1", "Customer").CanActFor("u2"));
    }

    [TestMethod]
    public void Without_a_subject_nobody_matches()
    {
        Assert.IsFalse(User(null).CanActFor("u1"));
        Assert.IsFalse(User("u1").CanActFor(null));
        Assert.IsFalse(User("u1").CanActFor(""));
    }
}
