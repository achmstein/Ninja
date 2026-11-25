namespace Identity.UnitTests.Directory;

/// <summary>
/// A customer merged into another is switched off with the account it went
/// into noted: the till leaves it out, and its number finds the kept one.
/// One switched off for another reason is still a person the till shows.
/// </summary>
[TestClass]
public class MergedCustomerTests
{
    private static DirectoryUser From(string id, string? phone, bool enabled = true, string? mergedInto = null, long created = 0) =>
        UserDirectory.FromKeycloak(new KeycloakUser
        {
            Id = id,
            Username = $"{id}@example.com",
            Email = $"{id}@example.com",
            FirstName = id,
            Enabled = enabled,
            CreatedTimestamp = created,
            Attributes = new Dictionary<string, string[]>
            {
                ["phoneNumber"] = phone is null ? [] : [phone],
                [UserAttributes.MergedInto] = mergedInto is null ? [] : [mergedInto],
            },
        }, [], "EG");

    [TestMethod]
    public void A_merged_account_is_known_by_its_note_and_a_disabled_one_is_not_merged()
    {
        var merged = From("old", null, enabled: false, mergedInto: "kept");
        var banned = From("banned", null, enabled: false);
        var backOn = From("back", null, enabled: true, mergedInto: "kept");

        Assert.IsTrue(merged.IsMerged);
        Assert.AreEqual("kept", merged.MergedInto);
        Assert.IsFalse(banned.IsMerged, "switched off by hand, not folded into anyone");
        Assert.IsFalse(backOn.IsMerged, "switched back on, it is a customer again");
    }

    [TestMethod]
    public void A_number_left_on_a_merged_account_finds_the_customer_it_went_into()
    {
        var snapshot = new DirectorySnapshot(
        [
            From("old", "01001112222", enabled: false, mergedInto: "kept", created: 1),
            From("kept", "01229998888", created: 2),
        ], DateTimeOffset.UtcNow);

        Assert.AreEqual("kept", snapshot.ByPhone("+201001112222", [])?.Id);
    }

    [TestMethod]
    public void A_merge_of_a_merge_is_followed_to_the_end()
    {
        var snapshot = new DirectorySnapshot(
        [
            From("a", "01001112222", enabled: false, mergedInto: "b"),
            From("b", null, enabled: false, mergedInto: "c"),
            From("c", null),
        ], DateTimeOffset.UtcNow);

        Assert.AreEqual("c", snapshot.ByPhone("+201001112222", [])?.Id);
    }

    [TestMethod]
    public void A_live_account_with_the_number_wins_over_a_merged_one()
    {
        var snapshot = new DirectorySnapshot(
        [
            From("old", "01001112222", enabled: false, mergedInto: "gone", created: 1),
            From("live", "01001112222", created: 2),
        ], DateTimeOffset.UtcNow);

        Assert.AreEqual("live", snapshot.ByPhone("+201001112222", [])?.Id);
    }
}
