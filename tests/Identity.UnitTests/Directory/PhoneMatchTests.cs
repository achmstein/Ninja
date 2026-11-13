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

        Assert.AreEqual("spaced", snapshot.ByPhone("+201001112222", [])?.Id);
        Assert.AreEqual("arabic", snapshot.ByPhone("+201223334444", [])?.Id);
        Assert.IsNull(snapshot.ByPhone("", []), "no number matches nobody, not everybody without one");
        Assert.IsNull(snapshot.ByPhone("+201000000000", []));
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

        Assert.AreEqual("signed-up", snapshot.ByPhone("+201001112222", ["Cashier"])?.Id);
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

    [TestMethod]
    public void A_number_kept_in_the_international_form_is_found_by_its_digits_as_people_here_say_them()
    {
        var snapshot = new DirectorySnapshot([From("kept", "+201001112222"), From("old", "01223334444")], DateTimeOffset.UtcNow);

        Assert.AreEqual("kept", snapshot.Search("0100111", [], []).Single().Id);
        Assert.AreEqual("kept", snapshot.Search("20100111", [], []).Single().Id);
        Assert.AreEqual("kept", snapshot.Search("2222", [], []).Single().Id);
        Assert.AreEqual("old", snapshot.Search("0122", [], []).Single().Id, "one not yet rewritten reads the same");
        Assert.AreEqual("old", snapshot.Search("+20 122", [], []).Single().Id);
    }

    [TestMethod]
    public void A_number_kept_the_old_way_is_rewritten_once_and_a_counter_customer_s_address_with_it()
    {
        var signedUp = Stored("a@example.com", "01001112222");
        Assert.AreEqual(("+201001112222", (string?)null), UserDirectory.PhoneToKeep(signedUp, "EG"));

        // Typed on Keycloak's own sign-up page, which keeps what it is given
        Assert.AreEqual("+201001112222", UserDirectory.PhoneToKeep(Stored("a@example.com", "100 111 2222"), "EG")?.Phone);

        var counter = Stored("01001112222@counter.invalid", "01001112222");
        Assert.AreEqual(("+201001112222", "201001112222@counter.invalid"), UserDirectory.PhoneToKeep(counter, "EG"));

        Assert.IsNull(UserDirectory.PhoneToKeep(Stored("a@example.com", "+201001112222"), "EG"), "already in the form");
        Assert.IsNull(UserDirectory.PhoneToKeep(Stored("201001112222@counter.invalid", "+201001112222"), "EG"));
        Assert.IsNull(UserDirectory.PhoneToKeep(Stored("a@example.com", "12345"), "EG"), "not a number here: left as it is");
        Assert.IsNull(UserDirectory.PhoneToKeep(Stored("a@example.com", null), "EG"));
    }

    private static KeycloakUser Stored(string email, string? phone) => new()
    {
        Id = "u",
        Username = email,
        Email = email,
        Attributes = new Dictionary<string, string[]> { ["phoneNumber"] = phone is null ? [] : [phone] },
    };
}
