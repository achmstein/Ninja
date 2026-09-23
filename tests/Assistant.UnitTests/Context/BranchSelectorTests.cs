using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;

namespace Ninja.Assistant.UnitTests.Context;

[TestClass]
public sealed class BranchSelectorTests
{
    private static readonly List<BranchResponse> Branches =
    [
        new(1, new LocalizedText("Nasr City", "مدينة نصر"), true, 1, "17:00", "05:00", true, true),
        new(2, new LocalizedText("Maadi", "المعادي"), true, 2, "00:00", "23:59", false, true),
        new(3, new LocalizedText("Old Zamalek", "الزمالك"), false, 3, "00:00", "23:59", false, false),
    ];

    [TestMethod]
    public void Nothing_or_all_means_every_active_branch_in_display_order()
    {
        CollectionAssert.AreEqual(new[] { 1, 2 }, BranchSelector.Select(Branches, null).Value!.Select(b => b.Id).ToArray());
        CollectionAssert.AreEqual(new[] { 1, 2 }, BranchSelector.Select(Branches, " ALL ").Value!.Select(b => b.Id).ToArray());
    }

    [TestMethod]
    public void A_number_is_an_id_even_for_an_inactive_branch()
    {
        Assert.AreEqual(3, BranchSelector.Select(Branches, "3").Value!.Single().Id);
    }

    [TestMethod]
    public void A_name_matches_in_either_language_ignoring_case()
    {
        Assert.AreEqual(2, BranchSelector.Select(Branches, "maadi").Value!.Single().Id);
        Assert.AreEqual(1, BranchSelector.Select(Branches, "مدينة نصر").Value!.Single().Id);
        Assert.AreEqual(1, BranchSelector.Select(Branches, "nasr").Value!.Single().Id);
    }

    [TestMethod]
    public void A_miss_lists_the_branches()
    {
        var r = BranchSelector.Select(Branches, "Heliopolis");
        Assert.IsFalse(r.IsOk);
        StringAssert.Contains(r.Error, "Nasr City (id 1)");
        StringAssert.Contains(r.Error, "Old Zamalek (id 3, inactive)");
    }

    [TestMethod]
    public void One_branch_needs_naming_only_when_several_are_active()
    {
        var single = Branches.Where(b => b.Id != 2).ToList();
        Assert.AreEqual(1, BranchSelector.SelectOne(single, null).Value!.Id);

        var r = BranchSelector.SelectOne(Branches, null);
        Assert.IsFalse(r.IsOk);
        StringAssert.Contains(r.Error, "Say which branch");
        Assert.AreEqual(2, BranchSelector.SelectOne(Branches, "Maadi").Value!.Id);
    }

    [TestMethod]
    public void The_day_start_is_read_from_the_branch()
    {
        Assert.AreEqual(new TimeOnly(17, 0), Branches[0].DayStart);
        Assert.AreEqual(TimeOnly.MinValue, new BranchResponse(9, null, true, 0, null, null, true, true).DayStart);
        Assert.AreEqual("Branch 9", new BranchResponse(9, null, true, 0, null, null, true, true).DisplayName);
    }
}
