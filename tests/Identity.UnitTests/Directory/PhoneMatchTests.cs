namespace Identity.UnitTests.Directory;

[TestClass]
public class PhoneMatchTests
{
    private static DirectoryUser From(string id, string? phone, string? email = null, bool counter = false, long created = 0) =>
        UserDirectory.FromKeycloak(new KeycloakUser
        {
            Id = id,
            Username = email ?? $"{id}@example.com",
            Email = email ?? $"{id}@example.com",
            FirstName = id,
            Enabled = true,
            CreatedTimestamp = created,
            Attributes = new Dictionary<string, string[]>
            {
                ["phoneNumber"] = phone is null ? [] : [phone],
                ["origin"] = counter ? ["counter"] : [],
            },
        }, [], "EG");

    [TestMethod]
    public void A_number_stored_however_it_was_typed_is_found_by_its_normalized_form()
    {
        var snapshot = new DirectorySnapshot(
        [
            From("spaced", "+20 100 111 2222"),
            From("arabic", "٠١٢٢٣٣٣٤٤٤٤"),
            From("none", null),
        ], DateTimeOffset.UtcNow);

        Assert.AreEqual("spaced", snapshot.ByPhone("01001112222", [])?.Id);
        Assert.AreEqual("arabic", snapshot.ByPhone("01223334444", [])?.Id);
        Assert.IsNull(snapshot.ByPhone("", []), "no number matches nobody, not everybody without one");
        Assert.IsNull(snapshot.ByPhone("01000000000", []));
    }

    [TestMethod]
    public void Staff_are_not_matched_and_a_self_signed_customer_wins_over_a_counter_one()
    {
        var staff = From("staff", "01001112222") with { RealmRoles = ["Cashier"] };
        var snapshot = new DirectorySnapshot(
        [
            staff,
            From("counter", "01001112222", "01001112222@counter.invalid", counter: true, created: 1),
            From("signed-up", "01001112222", created: 2),
        ], DateTimeOffset.UtcNow);

        Assert.AreEqual("signed-up", snapshot.ByPhone("01001112222", ["Cashier"])?.Id);
    }

    [TestMethod]
    public void A_counter_customer_shows_no_email_and_their_number_as_username()
    {
        var user = From("c", "01001112222", "01001112222@counter.invalid", counter: true);

        Assert.IsTrue(user.AddedAtCounter);
        Assert.IsNull(user.Email);
        Assert.AreEqual("01001112222", user.Username);
        Assert.AreEqual("", user.EmailNormalized, "so searching 'counter' finds nobody by it");
    }
}
