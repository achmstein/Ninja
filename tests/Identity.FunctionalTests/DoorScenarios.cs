using System.Net;
using System.Text.Json.Nodes;
using Ninja.Testing;

namespace Ninja.Identity.FunctionalTests;

/// <summary>The service and the Keycloak it talks to, once for the suite.</summary>
[TestClass]
public static class Suite
{
    public const int Branch = 1;

    public static FakeKeycloak Keycloak { get; private set; } = null!;

    public static ServiceUnderTest<Program> Identity { get; private set; } = null!;

    [AssemblyInitialize]
    public static async Task StartAsync(TestContext context)
    {
        await SharedServices.StartAsync();
        Keycloak = await FakeKeycloak.StartAsync();
        Identity = new ServiceUnderTest<Program>("identitydb", new Dictionary<string, string?>
        {
            ["Identity:Url"] = Keycloak.RealmUrl,
            ["Keycloak:Realm"] = FakeKeycloak.Realm,
            ["Keycloak:AdminClientId"] = "admin-cli",
            ["Keycloak:AdminClientSecret"] = "a-secret",
            // The directory is a cache of Keycloak: rebuilt straight after a write, and
            // paged small here so the paging is exercised by a handful of users
            ["Directory:WriteRefreshDelaySeconds"] = "0",
            ["Directory:EmptySearchRefreshCooldownSeconds"] = "0",
            ["Directory:PageSize"] = "2",
        });
        _ = Identity.CreateClient();
    }

    [AssemblyCleanup]
    public static async Task StopAsync()
    {
        await Identity.DisposeAsync();
        await Keycloak.DisposeAsync();
        await SharedServices.StopAsync();
    }

    public static Caller BackOffice => Identity.As(Persona.Admin(Branch), Branch);

    public static Caller Owner => Identity.As(Persona.Owner(Branch), Branch);

    public static Caller Till => Identity.As(Persona.Cashier(Branch), Branch);

    public static Caller Signed(string userId) => Identity.As(Persona.Customer(userId));

    public static Caller Anyone => Identity.AsAnonymous();

    public static string Url(string tail) => $"/api/identity{tail}";
}

/// <summary>What the apps read off the wire; named here so a change in the API's shape fails a test.</summary>
public record UserView(string Id, string? Username, string? Email, string? FirstName, string? LastName, bool Enabled, List<string> RealmRoles, string? PhoneNumber, List<int> Branches);
/// <summary>A person's own page reads a whole name, not a first and a last.</summary>
public record MyProfileView(string Name, string? Email, string? PhoneNumber, List<int> Branches, bool IsProfileComplete);
public record CountView(int Count);
public record StaffCreatedView(string Message, string UserId);
public record BranchesView(List<int> Branches);

/// <summary>
/// Identity is the door onto Keycloak: signing up, the staff accounts an
/// owner makes, the branches they work in, and what a person may change
/// about themselves. The scenarios drive the door and then read the
/// Keycloak behind it (<see cref="FakeKeycloak"/>) to see what was written
/// — the payload the real one would have stored.
/// </summary>
[TestClass]
public sealed class DoorScenarios
{
    private static string AnEmail(string who) => $"{who}-{Guid.NewGuid():N}@ninja.test";

    private static string? Attribute(JsonObject user, string name)
        => (user["attributes"] as JsonObject)?[name]?.AsArray().FirstOrDefault()?.GetValue<string>();

    [TestMethod]
    public async Task Signing_up_is_open_to_anyone_and_makes_a_user_with_the_email_as_the_username()
    {
        var email = AnEmail("laila");

        var (signedUp, detail) = await Suite.Anyone.RefusedAsync(HttpMethod.Post, Suite.Url("/register"), new
        {
            name = "Laila Mansour", email, password = "a-good-password", phoneNumber = "01000000000",
        });
        Assert.AreEqual(HttpStatusCode.OK, signedUp, detail);

        var user = Suite.Keycloak.UserByEmail(email)!;
        Assert.IsNotNull(user, "the sign-up reached Keycloak");
        Assert.AreEqual(email, user["username"]!.GetValue<string>(), "the email is the username: there is no second name to remember");
        Assert.AreEqual("Laila", user["firstName"]!.GetValue<string>());
        Assert.AreEqual("Mansour", user["lastName"]!.GetValue<string>(), "a name with a space is a first and a last");
        Assert.IsTrue(user["enabled"]!.GetValue<bool>());
        Assert.IsTrue(user["emailVerified"]!.GetValue<bool>(), "a café does not send a customer looking for a verification mail before their coffee");
        Assert.AreEqual("01000000000", Attribute(user, "phoneNumber"));
        Assert.AreEqual("a-good-password", Suite.Keycloak.PasswordsSet[user["id"]!.GetValue<string>()].Single());
        Assert.IsEmpty(Suite.Keycloak.RolesOf(user["id"]!.GetValue<string>()), "a customer carries no staff role");

        var (again, _) = await Suite.Anyone.RefusedAsync(HttpMethod.Post, Suite.Url("/register"), new
        {
            name = "Laila Someone Else", email, password = "another-password",
        });
        Assert.AreEqual(HttpStatusCode.Conflict, again, "an email that has already signed up is a conflict, not a second account");
    }

    [TestMethod]
    public async Task A_sign_up_fails_plainly_when_the_identity_provider_will_not_answer()
    {
        Suite.Keycloak.TokenWorks = false;
        try
        {
            var (refused, why) = await Suite.Anyone.RefusedAsync(HttpMethod.Post, Suite.Url("/register"), new
            {
                name = "Nobody", email = AnEmail("nobody"), password = "a-good-password",
            });
            Assert.AreEqual(HttpStatusCode.InternalServerError, refused);
            Assert.Contains("identity provider", why, "the app is told the door is shut, not that the password was wrong");
        }
        finally
        {
            Suite.Keycloak.TokenWorks = true;
        }
    }

    [TestMethod]
    public async Task A_staff_account_is_an_Admin_a_Cashier_or_a_Kitchen_and_only_an_Admin_can_be_an_Owner()
    {
        var (byManager, _) = await Suite.BackOffice.RefusedAsync(HttpMethod.Post, Suite.Url("/register-admin"), new
        {
            name = "Someone New", email = AnEmail("someone"), password = "a-good-password",
        });
        Assert.AreEqual(HttpStatusCode.Forbidden, byManager, "a manager does not make another manager");

        var (barista, why) = await Suite.Owner.RefusedAsync(HttpMethod.Post, Suite.Url("/register-admin"), new
        {
            name = "Omar", email = AnEmail("omar"), password = "a-good-password", role = "Barista",
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, barista);
        Assert.Contains("Admin, Cashier or Kitchen", why);

        var (cashierOwner, told) = await Suite.Owner.RefusedAsync(HttpMethod.Post, Suite.Url("/register-admin"), new
        {
            name = "Omar", email = AnEmail("omar"), password = "a-good-password", role = "Cashier", isOwner = true,
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, cashierOwner);
        Assert.Contains("only an Admin can be made Owner", told);

        var email = AnEmail("mona");
        var cashier = await Suite.Owner.PostAsync<StaffCreatedView>(Suite.Url("/register-admin"), new
        {
            name = "Mona Fahmy", email, password = "a-good-password", role = "Cashier", branchIds = new[] { 3, 1, 1, 0 },
        });

        var made = Suite.Keycloak.User(cashier.UserId)!;
        Assert.AreEqual(email, made["username"]!.GetValue<string>());
        CollectionAssert.AreEqual(new[] { "Cashier" }, Suite.Keycloak.RolesOf(cashier.UserId).ToArray(), "the role they were hired into");
        CollectionAssert.AreEqual(
            new[] { "1", "3" },
            (made["attributes"]!["branches"]!).AsArray().Select(b => b!.GetValue<string>()).ToArray(),
            "the branches they work in, tidied: no zero, no repeat, in order");

        var owner = await Suite.Owner.PostAsync<StaffCreatedView>(Suite.Url("/register-admin"), new
        {
            name = "Hany Aziz", email = AnEmail("hany"), password = "a-good-password", role = "Admin", isOwner = true,
        });
        CollectionAssert.AreEquivalent(new[] { "Admin", "Owner" }, Suite.Keycloak.RolesOf(owner.UserId).ToArray(),
            "an owner is an admin who also owns the place");
    }

    [TestMethod]
    public async Task Which_branches_someone_works_at_is_the_owners_to_set()
    {
        var id = Suite.Keycloak.Given(AnEmail("tarek"), "Tarek", "Selim", phone: "01111111111", role: "Cashier", branches: [1]);

        var (byManager, _) = await Suite.BackOffice.RefusedAsync(HttpMethod.Put, Suite.Url($"/users/{id}/branches"), new { branchIds = new[] { 2 } });
        Assert.AreEqual(HttpStatusCode.Forbidden, byManager, "who works where is the owner's call");

        var set = await Suite.Owner.PutAsync<BranchesView>(Suite.Url($"/users/{id}/branches"), new { branchIds = new[] { 2, 1 } });
        CollectionAssert.AreEqual(new[] { 1, 2 }, set.Branches.ToArray());

        var user = Suite.Keycloak.User(id)!;
        CollectionAssert.AreEqual(new[] { "1", "2" }, user["attributes"]!["branches"]!.AsArray().Select(b => b!.GetValue<string>()).ToArray());
        Assert.AreEqual("01111111111", Attribute(user, "phoneNumber"), "the whole person goes back, so nothing else about them is lost");
        Assert.AreEqual("Tarek", user["firstName"]!.GetValue<string>());

        var (nonsense, why) = await Suite.Owner.RefusedAsync(HttpMethod.Put, Suite.Url($"/users/{id}/branches"), new { branchIds = new[] { 0 } });
        Assert.AreEqual(HttpStatusCode.BadRequest, nonsense);
        Assert.Contains("positive", why);

        var (nobody, _) = await Suite.Owner.RefusedAsync(HttpMethod.Put, Suite.Url($"/users/{Guid.NewGuid()}/branches"), new { branchIds = new[] { 1 } });
        Assert.AreEqual(HttpStatusCode.NotFound, nobody, "a login nobody has is not moved anywhere");
    }

    [TestMethod]
    public async Task A_person_changes_their_own_name_and_the_whole_person_goes_back()
    {
        var id = Suite.Keycloak.Given(AnEmail("mostafa"), "Mostafa", "K", phone: "01222222222");

        var (changed, detail) = await Suite.Signed(id).RefusedAsync(HttpMethod.Post, Suite.Url("/update-name"), new { newName = "Mostafa Kamel" });
        Assert.AreEqual(HttpStatusCode.OK, changed, detail);

        var user = Suite.Keycloak.User(id)!;
        Assert.AreEqual("Mostafa", user["firstName"]!.GetValue<string>());
        Assert.AreEqual("Kamel", user["lastName"]!.GetValue<string>());
        Assert.AreEqual("01222222222", Attribute(user, "phoneNumber"), "Keycloak drops what a write leaves out, so the write leaves nothing out");

        // The name the rest of the café knows them by follows: Accounts' suite reads the other end of that event

        var profile = await Suite.Signed(id).GetAsync<MyProfileView>(Suite.Url("/my-profile"));
        Assert.AreEqual("Mostafa Kamel", profile.Name, "their own page says the name they just gave");
        Assert.AreEqual("01222222222", profile.PhoneNumber);
        Assert.IsTrue(profile.IsProfileComplete, "a name and a number is all a café needs of a customer");

        var (aStranger, _) = await Suite.Signed(Guid.NewGuid().ToString()).RefusedAsync(HttpMethod.Post, Suite.Url("/update-name"), new { newName = "Nobody" });
        Assert.AreEqual(HttpStatusCode.NotFound, aStranger, "a token for a login Keycloak does not have changes nothing");

        // A password is set on the strength of the token alone: the old one is never asked for
        var (password, why) = await Suite.Signed(id).RefusedAsync(HttpMethod.Post, Suite.Url("/change-password"), new { newPassword = "a-newer-password" });
        Assert.AreEqual(HttpStatusCode.OK, password, why);
        Assert.AreEqual("a-newer-password", Suite.Keycloak.PasswordsSet[id].Last());
    }

    [TestMethod]
    public async Task The_till_searches_the_directory_and_a_customer_may_not()
    {
        var email = AnEmail("dina");
        Suite.Keycloak.Given(email, "Dina", "Rashed", phone: "01033334444");
        Suite.Keycloak.Given(AnEmail("sherif"), "Sherif", "Nabil", role: "Cashier");

        await ServiceUnderTest<Program>.EventuallyAsync(
            async () => (await Suite.Till.GetAsync<List<UserView>>(Suite.Url("/users") + "?search=Dina Rashed")).Count > 0,
            "a customer the café signed up is on the cashier's next search");

        var found = (await Suite.Till.GetAsync<List<UserView>>(Suite.Url("/users") + "?search=Dina Rashed")).First();
        Assert.AreEqual(email, found.Email);
        Assert.AreEqual("01033334444", found.PhoneNumber, "so the cashier can tell two Dinas apart");
        Assert.IsEmpty(found.RealmRoles, "a customer holds no staff role");

        var staff = await Suite.Till.GetAsync<List<UserView>>(Suite.Url("/users") + "?role=Cashier");
        Assert.IsTrue(staff.All(u => u.RealmRoles.Contains("Cashier")), "the register of who works here is a filter on the same list");
        Assert.IsTrue(staff.Any(u => u.FirstName == "Sherif"));

        var customers = await Suite.Till.GetAsync<List<UserView>>(Suite.Url("/users") + "?excludeRole=Admin,Cashier,Owner&max=500");
        Assert.IsFalse(customers.Any(u => u.RealmRoles.Count > 0), "and the other way round for customers");

        var counted = await Suite.BackOffice.GetAsync<CountView>(Suite.Url("/users/count") + "?search=Dina Rashed");
        Assert.AreEqual(1, counted.Count, "the count is the same search, without the page");

        Assert.IsEmpty(await Suite.Till.GetAsync<List<UserView>>(Suite.Url("/users") + "?search=nobody-of-that-name"),
            "somebody who is not there is an empty answer");

        var (byCustomer, _) = await Suite.Signed("a-customer").RefusedAsync(HttpMethod.Get, Suite.Url("/users"));
        Assert.AreEqual(HttpStatusCode.Forbidden, byCustomer, "the café's customer list is not a customer's to read");
    }

    [TestMethod]
    public async Task Reading_or_changing_somebody_else_is_the_back_offices()
    {
        var id = Suite.Keycloak.Given(AnEmail("nadia"), "Nadia", "Fouad", phone: "01044445555");

        foreach (var (method, path, body) in new (HttpMethod, string, object?)[]
        {
            (HttpMethod.Get, Suite.Url($"/users/{id}"), null),
            (HttpMethod.Get, Suite.Url("/users/count"), null),
            (HttpMethod.Put, Suite.Url($"/users/{id}/profile"), new { name = "Not Nadia", phoneNumber = "01000000000" }),
            (HttpMethod.Put, Suite.Url($"/users/{id}/password"), new { newPassword = "not-theirs-to-set" }),
            (HttpMethod.Put, Suite.Url($"/users/{id}/toggle-enabled"), null),
        })
        {
            var (byTill, _) = await Suite.Till.RefusedAsync(method, path, body);
            Assert.AreEqual(HttpStatusCode.Forbidden, byTill, $"{method} {path} is the back office's");

            var (byCustomer, _) = await Suite.Signed("a-customer").RefusedAsync(method, path, body);
            Assert.AreEqual(HttpStatusCode.Forbidden, byCustomer, $"{method} {path} is not a customer's");
        }

        var read = await Suite.BackOffice.GetAsync<UserView>(Suite.Url($"/users/{id}"));
        Assert.AreEqual("Nadia", read.FirstName);
        Assert.AreEqual("01044445555", read.PhoneNumber);

        var (renamed, detail) = await Suite.BackOffice.RefusedAsync(HttpMethod.Put, Suite.Url($"/users/{id}/profile"), new
        {
            name = "Nadia Fouad Ali", phoneNumber = "01055556666",
        });
        Assert.AreEqual(HttpStatusCode.OK, renamed, detail);
        var edited = Suite.Keycloak.User(id)!;
        Assert.AreEqual("Nadia", edited["firstName"]!.GetValue<string>());
        Assert.AreEqual("Fouad Ali", edited["lastName"]!.GetValue<string>());
        Assert.AreEqual("01055556666", Attribute(edited, "phoneNumber"));

        var (reset, _) = await Suite.BackOffice.RefusedAsync(HttpMethod.Put, Suite.Url($"/users/{id}/password"), new { newPassword = "the-new-one" });
        Assert.AreEqual(HttpStatusCode.OK, reset);
        Assert.AreEqual("the-new-one", Suite.Keycloak.PasswordsSet[id].Last(), "a manager sets a new one; nobody reads the old");

        var (off, _) = await Suite.BackOffice.RefusedAsync(HttpMethod.Put, Suite.Url($"/users/{id}/toggle-enabled"));
        Assert.AreEqual(HttpStatusCode.OK, off);
        Assert.IsFalse(Suite.Keycloak.User(id)!["enabled"]!.GetValue<bool>(), "a login switched off cannot sign in");

        await Suite.BackOffice.RefusedAsync(HttpMethod.Put, Suite.Url($"/users/{id}/toggle-enabled"));
        Assert.IsTrue(Suite.Keycloak.User(id)!["enabled"]!.GetValue<bool>(), "and switching it again puts them back");
    }

    [TestMethod]
    public async Task Everything_but_signing_up_needs_a_token()
    {
        var id = Suite.Keycloak.Given(AnEmail("stranger"), "A", "Stranger");

        foreach (var (method, path) in new (HttpMethod, string)[]
        {
            (HttpMethod.Get, Suite.Url("/users")),
            (HttpMethod.Get, Suite.Url("/users/count")),
            (HttpMethod.Get, Suite.Url($"/users/{id}")),
            (HttpMethod.Get, Suite.Url("/my-profile")),
            (HttpMethod.Post, Suite.Url("/register-admin")),
            (HttpMethod.Post, Suite.Url("/change-password")),
            (HttpMethod.Post, Suite.Url("/update-name")),
            (HttpMethod.Post, Suite.Url("/update-email")),
            (HttpMethod.Post, Suite.Url("/update-profile")),
            (HttpMethod.Put, Suite.Url($"/users/{id}/profile")),
            (HttpMethod.Put, Suite.Url($"/users/{id}/password")),
            (HttpMethod.Put, Suite.Url($"/users/{id}/toggle-enabled")),
            (HttpMethod.Put, Suite.Url($"/users/{id}/branches")),
            (HttpMethod.Delete, Suite.Url("/delete-account")),
        })
        {
            var (status, _) = await Suite.Anyone.RefusedAsync(method, path, body: new { });
            Assert.AreEqual(HttpStatusCode.Unauthorized, status, $"{method} {path} is nobody's without a token");
        }

        Assert.IsTrue(Suite.Keycloak.User(id)!["enabled"]!.GetValue<bool>(), "and nothing of it touched anyone");
    }
}
