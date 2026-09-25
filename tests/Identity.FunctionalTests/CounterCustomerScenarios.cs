using System.Net;
using System.Text.Json.Nodes;
using Ninja.Testing;

namespace Ninja.Identity.FunctionalTests;

public record CustomerView(string Id, string? Username, string? Email, string? FirstName, string? LastName, List<string> RealmRoles, string? PhoneNumber, bool AddedAtCounter);
public record LookupView(string Phone, bool PhoneValid, CustomerView? Match, List<CustomerView> Similar);
public record ExistsView(string Message, CustomerView Existing);
public record ClaimLinkView(string Token, DateTimeOffset ExpiresAt);
public record ClaimPreviewView(string Name, string? PhoneNumber, DateTimeOffset? ExpiresAt);
public record ClaimRefusalView(string Reason);
public record ClaimedView(string Email);

/// <summary>
/// A customer the till adds by name and phone, found again by that phone
/// however it is typed, and the one-time link that hands the account to
/// them: the same Keycloak user, now with their own email and password.
/// </summary>
[TestClass]
public sealed class CounterCustomerScenarios
{
    private static int _number = 100000;

    /// <summary>An Egyptian mobile no other scenario uses.</summary>
    private static string APhone() => $"0102{Interlocked.Increment(ref _number):D7}";

    private static string? Attribute(JsonObject user, string name)
        => (user["attributes"] as JsonObject)?[name]?.AsArray().FirstOrDefault()?.GetValue<string>();

    private static async Task<CustomerView> AddAsync(string name, string phone)
    {
        var (status, body) = await Suite.Till.RefusedAsync(HttpMethod.Post, Suite.Url("/customers"), new { name, phoneNumber = phone });
        Assert.AreEqual(HttpStatusCode.Created, status, body);
        return System.Text.Json.JsonSerializer.Deserialize<CustomerView>(body, System.Text.Json.JsonSerializerOptions.Web)!;
    }

    [TestMethod]
    public async Task The_till_adds_a_customer_by_name_and_phone_and_the_number_is_stored_the_one_way()
    {
        var phone = APhone();
        var typed = $"+20 {phone[1..4]} {phone[4..8]} {phone[8..]}";

        var added = await AddAsync("Karim Adel", typed);

        Assert.AreEqual(phone, added.PhoneNumber, "+20 and spaces come off: the number is kept the way the realm's pattern expects");
        Assert.IsTrue(added.AddedAtCounter);
        Assert.IsNull(added.Email, "the stand-in address Keycloak needs is nobody's email and is never shown");

        var user = Suite.Keycloak.User(added.Id)!;
        Assert.AreEqual("Karim", user["firstName"]!.GetValue<string>());
        Assert.AreEqual("Adel", user["lastName"]!.GetValue<string>());
        Assert.IsTrue(user["enabled"]!.GetValue<bool>());
        Assert.AreEqual($"{phone}@counter.invalid", user["email"]!.GetValue<string>(), "a realm that signs in by email will not keep a user without one");
        Assert.IsFalse(user["emailVerified"]!.GetValue<bool>());
        Assert.AreEqual(phone, Attribute(user, "phoneNumber"));
        Assert.AreEqual("counter", Attribute(user, "origin"));
        Assert.AreEqual(Persona.Cashier().UserId, Attribute(user, "originBy"), "who added them");
        Assert.IsNotNull(Attribute(user, "originAt"), "and when");
        Assert.IsFalse(Suite.Keycloak.PasswordsSet.ContainsKey(added.Id), "no password: nobody signs in as them until they claim it");
        Assert.IsEmpty(Suite.Keycloak.RolesOf(added.Id), "no staff role; Customer comes from the realm's default roles like anyone's");
    }

    [TestMethod]
    public async Task A_number_already_a_customer_is_a_conflict_that_names_the_customer()
    {
        var phone = APhone();
        var registered = Suite.Keycloak.Given($"hoda-{Guid.NewGuid():N}@ninja.test", "Hoda", "Samy", phone: phone);

        var arabicDigits = string.Concat(phone.Select(c => (char)('٠' + (c - '0'))));
        var (status, body) = await Suite.Till.RefusedAsync(HttpMethod.Post, Suite.Url("/customers"), new { name = "Hoda S", phoneNumber = arabicDigits });
        Assert.AreEqual(HttpStatusCode.Conflict, status, body);
        var exists = System.Text.Json.JsonSerializer.Deserialize<ExistsView>(body, System.Text.Json.JsonSerializerOptions.Web)!;
        Assert.AreEqual(registered, exists.Existing.Id, "the till is offered the customer it already has, typed in Arabic digits or not");

        var counterPhone = APhone();
        var first = await AddAsync("Walid", counterPhone);
        var (again, told) = await Suite.Till.RefusedAsync(HttpMethod.Post, Suite.Url("/customers"), new { name = "Walid Again", phoneNumber = $"0020{counterPhone[1..]}" });
        Assert.AreEqual(HttpStatusCode.Conflict, again, told);
        Assert.Contains(first.Id, told, "a customer the counter added a moment ago is the same customer");

        // A staff member's number is not a customer's
        var staffPhone = APhone();
        Suite.Keycloak.Given($"staff-{Guid.NewGuid():N}@ninja.test", "Staff", "Member", phone: staffPhone, role: "Cashier");
        await AddAsync("Staff Member's Brother", staffPhone);
    }

    [TestMethod]
    public async Task A_name_or_a_number_that_is_not_one_is_refused()
    {
        var (noName, _) = await Suite.Till.RefusedAsync(HttpMethod.Post, Suite.Url("/customers"), new { name = "  ", phoneNumber = APhone() });
        Assert.AreEqual(HttpStatusCode.BadRequest, noName);

        var (shortNumber, why) = await Suite.Till.RefusedAsync(HttpMethod.Post, Suite.Url("/customers"), new { name = "Nour", phoneNumber = "0101" });
        Assert.AreEqual(HttpStatusCode.BadRequest, shortNumber);
        Assert.Contains("phoneNumber", why);

        var (byCustomer, _) = await Suite.Signed("a-customer").RefusedAsync(HttpMethod.Post, Suite.Url("/customers"), new { name = "Nour", phoneNumber = APhone() });
        Assert.AreEqual(HttpStatusCode.Forbidden, byCustomer, "adding customers is the till's");
        var (byNobody, _) = await Suite.Anyone.RefusedAsync(HttpMethod.Post, Suite.Url("/customers"), new { name = "Nour", phoneNumber = APhone() });
        Assert.AreEqual(HttpStatusCode.Unauthorized, byNobody);
    }

    [TestMethod]
    public async Task The_lookup_finds_the_number_however_it_is_typed_and_names_that_look_alike()
    {
        var phone = APhone();
        var id = Suite.Keycloak.Given($"ahmed-{Guid.NewGuid():N}@ninja.test", "أحمد", "الهادي", phone: phone);
        Suite.Keycloak.Given($"staff-{Guid.NewGuid():N}@ninja.test", "احمد", "Staff", role: "Admin");

        await ServiceUnderTest<Program>.EventuallyAsync(
            async () => (await Suite.Till.GetAsync<LookupView>(Suite.Url($"/customers/lookup?phone={Uri.EscapeDataString(phone)}"))).Match is not null,
            "the directory has caught up");

        var byPhone = await Suite.Till.GetAsync<LookupView>(Suite.Url($"/customers/lookup?phone={Uri.EscapeDataString("+20 " + phone[1..])}"));
        Assert.AreEqual(phone, byPhone.Phone);
        Assert.IsTrue(byPhone.PhoneValid);
        Assert.AreEqual(id, byPhone.Match?.Id);

        var byName = await Suite.Till.GetAsync<LookupView>(Suite.Url($"/customers/lookup?name={Uri.EscapeDataString("إحمد الهادى")}"));
        Assert.IsNull(byName.Match);
        Assert.IsTrue(byName.Similar.Any(u => u.Id == id), "hamza and alef maqsura variants still find him");
        Assert.IsFalse(byName.Similar.Any(u => u.LastName == "Staff"), "staff are never offered as customers");
        Assert.IsTrue(byName.Similar.Count <= 3, "a few, not the whole list");

        var partial = await Suite.Till.GetAsync<LookupView>(Suite.Url("/customers/lookup?phone=0102"));
        Assert.IsFalse(partial.PhoneValid);
        Assert.IsNull(partial.Match, "a number half typed matches nobody");

        var (byCustomer, _) = await Suite.Signed("a-customer").RefusedAsync(HttpMethod.Get, Suite.Url("/customers/lookup?phone=" + phone));
        Assert.AreEqual(HttpStatusCode.Forbidden, byCustomer);
    }

    [TestMethod]
    public async Task A_counter_customer_claims_their_account_once_with_the_link_the_till_gave_them()
    {
        var phone = APhone();
        var added = await AddAsync("Salma Nabil", phone);

        var (byCustomer, _) = await Suite.Signed("a-customer").RefusedAsync(HttpMethod.Post, Suite.Url($"/customers/{added.Id}/claim-link"));
        Assert.AreEqual(HttpStatusCode.Forbidden, byCustomer, "only the till hands out links");

        var link = await Suite.Till.PostAsync<ClaimLinkView>(Suite.Url($"/customers/{added.Id}/claim-link"), new { });
        Assert.IsTrue(link.ExpiresAt > DateTimeOffset.UtcNow.AddMinutes(25) && link.ExpiresAt <= DateTimeOffset.UtcNow.AddMinutes(31), "good for half an hour");

        var stored = Suite.Keycloak.User(added.Id)!;
        Assert.IsFalse((Attribute(stored, "claimTokenHash") ?? "").Length == 0);
        Assert.DoesNotContain(link.Token.Split('.')[1], stored.ToJsonString(), "only a hash of the secret is kept");
        Assert.AreEqual(Persona.Cashier().UserId, Attribute(stored, "claimIssuedBy"), "who issued it");

        var preview = await Suite.Anyone.PostAsync<ClaimPreviewView>(Suite.Url("/claim/preview"), new { token = link.Token });
        Assert.AreEqual("Salma Nabil", preview.Name);
        Assert.AreEqual(phone, preview.PhoneNumber);

        var (wrong, wrongWhy) = await Suite.Anyone.RefusedAsync(HttpMethod.Post, Suite.Url("/claim/preview"), new { token = link.Token[..^2] + "xx" });
        Assert.AreEqual(HttpStatusCode.NotFound, wrong);
        Assert.Contains("invalid", wrongWhy);
        var (garbage, _) = await Suite.Anyone.RefusedAsync(HttpMethod.Post, Suite.Url("/claim/preview"), new { token = "not-a-token" });
        Assert.AreEqual(HttpStatusCode.NotFound, garbage);

        var (weak, _) = await Suite.Anyone.RefusedAsync(HttpMethod.Post, Suite.Url("/claim"), new { token = link.Token, email = "salma@ninja.test", password = "short" });
        Assert.AreEqual(HttpStatusCode.BadRequest, weak);
        var (standIn, _) = await Suite.Anyone.RefusedAsync(HttpMethod.Post, Suite.Url("/claim"), new { token = link.Token, email = "0100@counter.invalid", password = "a-good-password" });
        Assert.AreEqual(HttpStatusCode.BadRequest, standIn, "the stand-in domain is nobody's email");

        var takenEmail = $"taken-{Guid.NewGuid():N}@ninja.test";
        Suite.Keycloak.Given(takenEmail, "Someone", "Else");
        var (taken, _) = await Suite.Anyone.RefusedAsync(HttpMethod.Post, Suite.Url("/claim"), new { token = link.Token, email = takenEmail, password = "a-good-password" });
        Assert.AreEqual(HttpStatusCode.Conflict, taken, "an email with an account already is not taken over");

        var email = $"salma-{Guid.NewGuid():N}@ninja.test";
        var claimed = await Suite.Anyone.PostAsync<ClaimedView>(Suite.Url("/claim"), new { token = link.Token, email, password = "a-good-password" });
        Assert.AreEqual(email, claimed.Email);

        var user = Suite.Keycloak.User(added.Id)!;
        Assert.AreEqual(email, user["email"]!.GetValue<string>(), "the same user, now with their own email");
        Assert.AreEqual(email, user["username"]!.GetValue<string>());
        Assert.IsTrue(user["emailVerified"]!.GetValue<bool>());
        Assert.AreEqual("a-good-password", Suite.Keycloak.PasswordsSet[added.Id].Single());
        Assert.IsNull(Attribute(user, "origin"), "no longer the counter's to hand over");
        Assert.IsNotNull(Attribute(user, "claimedAt"));
        Assert.AreEqual(phone, Attribute(user, "phoneNumber"), "and nothing else about them is lost");

        var (twice, why) = await Suite.Anyone.RefusedAsync(HttpMethod.Post, Suite.Url("/claim"), new { token = link.Token, email = $"other-{Guid.NewGuid():N}@ninja.test", password = "another-password" });
        Assert.AreEqual(HttpStatusCode.Gone, twice, "a link works once");
        Assert.Contains("used", why);
        Assert.AreEqual(email, Suite.Keycloak.User(added.Id)!["email"]!.GetValue<string>());

        var (noMoreLinks, _) = await Suite.Till.RefusedAsync(HttpMethod.Post, Suite.Url($"/customers/{added.Id}/claim-link"));
        Assert.AreEqual(HttpStatusCode.Conflict, noMoreLinks, "a customer with their own account gets no link that could take it over");
    }

    [TestMethod]
    public async Task A_link_past_its_half_hour_or_replaced_by_a_newer_one_does_nothing()
    {
        var added = await AddAsync("Rana Fathy", APhone());

        var first = await Suite.Till.PostAsync<ClaimLinkView>(Suite.Url($"/customers/{added.Id}/claim-link"), new { });
        var second = await Suite.Till.PostAsync<ClaimLinkView>(Suite.Url($"/customers/{added.Id}/claim-link"), new { });
        var (replaced, _) = await Suite.Anyone.RefusedAsync(HttpMethod.Post, Suite.Url("/claim/preview"), new { token = first.Token });
        Assert.AreEqual(HttpStatusCode.NotFound, replaced, "only the newest link works");

        // Half an hour on: the expiry as Keycloak holds it, wound back
        var user = Suite.Keycloak.User(added.Id)!;
        user["attributes"]!["claimTokenExpires"] = new JsonArray(DateTimeOffset.UtcNow.AddMinutes(-1).ToUnixTimeSeconds().ToString());

        var (expired, why) = await Suite.Anyone.RefusedAsync(HttpMethod.Post, Suite.Url("/claim"), new { token = second.Token, email = $"rana-{Guid.NewGuid():N}@ninja.test", password = "a-good-password" });
        Assert.AreEqual(HttpStatusCode.Gone, expired);
        Assert.Contains("expired", why);
        Assert.IsFalse(Suite.Keycloak.PasswordsSet.ContainsKey(added.Id), "nothing was set");

        var (nobody, _) = await Suite.Till.RefusedAsync(HttpMethod.Post, Suite.Url($"/customers/{Guid.NewGuid()}/claim-link"));
        Assert.AreEqual(HttpStatusCode.NotFound, nobody);

        var registered = Suite.Keycloak.Given($"reg-{Guid.NewGuid():N}@ninja.test", "Signed", "Up", phone: APhone());
        var (notCounter, _) = await Suite.Till.RefusedAsync(HttpMethod.Post, Suite.Url($"/customers/{registered}/claim-link"));
        Assert.AreEqual(HttpStatusCode.Conflict, notCounter, "someone who signed up themselves has nothing to claim");
    }

    [TestMethod]
    public async Task The_list_shows_who_was_added_at_the_counter_and_no_stand_in_email()
    {
        var phone = APhone();
        var added = await AddAsync("Mariam Counter", phone);

        await ServiceUnderTest<Program>.EventuallyAsync(
            async () => (await Suite.Till.GetAsync<List<CustomerView>>(Suite.Url("/users") + "?search=Mariam Counter")).Count > 0,
            "the directory has caught up");

        var listed = (await Suite.Till.GetAsync<List<CustomerView>>(Suite.Url("/users") + "?search=Mariam Counter")).Single();
        Assert.AreEqual(added.Id, listed.Id);
        Assert.IsTrue(listed.AddedAtCounter, "the admin marks them 'Added at the counter'");
        Assert.IsNull(listed.Email);
        Assert.AreEqual(phone, listed.Username, "the stand-in address is not their username either");

        Assert.IsEmpty(await Suite.Till.GetAsync<List<CustomerView>>(Suite.Url("/users") + "?search=counter.invalid"),
            "and nobody is found by it");

        var read = await Suite.BackOffice.GetAsync<CustomerView>(Suite.Url($"/users/{added.Id}"));
        Assert.IsTrue(read.AddedAtCounter);
        Assert.IsNull(read.Email);
    }

    [TestMethod]
    public async Task Nobody_signs_up_or_moves_their_email_onto_the_stand_in_domain()
    {
        var (signUp, _) = await Suite.Anyone.RefusedAsync(HttpMethod.Post, Suite.Url("/register"), new
        {
            name = "Squatter", email = "01099999999@counter.invalid", password = "a-good-password",
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, signUp);

        var id = Suite.Keycloak.Given($"mover-{Guid.NewGuid():N}@ninja.test", "Mover", "M");
        var (move, _) = await Suite.Signed(id).RefusedAsync(HttpMethod.Post, Suite.Url("/update-email"), new { newEmail = "01099999999@counter.invalid" });
        Assert.AreEqual(HttpStatusCode.BadRequest, move);
    }
}
