using System.Net;
using System.Net.Mail;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Ninja.EventBus.Abstractions;
using Ninja.Identity.API.Directory;
using Ninja.Identity.API.IntegrationEvents;
using Ninja.ServiceDefaults;

namespace Ninja.Identity.API;

/// <summary>
/// Customers the till adds by name and phone, the lookup that finds them
/// before a second one is made, and the one-time link that hands such an
/// account to its customer (see <see cref="CounterCustomer"/> for why the
/// link is Ninja's and the email is a stand-in).
/// </summary>
public static class CounterCustomersApi
{
    public const string LinkIssuePolicy = "claim-link-issue";
    public const string ClaimPolicy = "claim";

    /// <summary>Everyone who works here: never a customer, never matched as one.</summary>
    public static readonly string[] StaffRoles = ["Admin", "Owner", "Cashier", "Kitchen"];

    private const int MinPasswordLength = 8;

    // One Identity container per tenant: a process-wide gate is enough to make
    // a token single-use when two browsers race to spend it
    private static readonly SemaphoreSlim ClaimGate = new(1, 1);

    public static IServiceCollection AddCounterCustomerRateLimits(this IServiceCollection services, IConfiguration config)
    {
        var linksPerMinute = config.GetValue("CounterCustomers:LinksPerStaffPerMinute", 10);
        var claimsPerMinute = config.GetValue("CounterCustomers:ClaimAttemptsPerAddressPerMinute", 20);
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            // A cashier sends a link now and then; a burst is a script
            options.AddPolicy(LinkIssuePolicy, context => RateLimitPartition.GetFixedWindowLimiter(
                $"link:{context.User.GetUserId() ?? "anonymous"}",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = linksPerMinute, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
            // The claim page is anonymous: guessing is slowed per address, on top
            // of the 256-bit secret that makes it pointless anyway
            options.AddPolicy(ClaimPolicy, context => RateLimitPartition.GetFixedWindowLimiter(
                $"claim:{context.Connection.RemoteIpAddress?.ToString() ?? "unknown"}",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = claimsPerMinute, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
        });
        return services;
    }

    public static void MapCounterCustomers(this WebApplication app)
    {
        // The customer picker's live check, as the cashier types: the one
        // customer with this number, and a few whose names look like this one
        app.MapGet("/api/identity/customers/lookup", async (string? phone, string? name, UserDirectory directory, TenantCountry country, CancellationToken ct) =>
        {
            var normalized = PhoneRules.Normalize(phone, country.Code);
            var valid = PhoneRules.IsValid(normalized, country.Code);

            var snapshot = await directory.GetAsync(ct);
            var match = snapshot.ByPhone(normalized, StaffRoles);
            if (match is null && valid)
            {
                // Signed up on Keycloak's own page a minute ago, perhaps
                snapshot = await directory.RefreshIfStaleAsync(ct);
                match = snapshot.ByPhone(normalized, StaffRoles);
            }

            var similar = NameSearch.Normalize(name).Length >= 2
                ? snapshot.Search(name, [], StaffRoles).Where(u => u.Id != match?.Id).Take(3).Select(UserDto.From).ToList()
                : [];

            return Results.Ok(new CustomerLookupResponse(normalized, valid, match is null ? null : UserDto.From(match), similar));
        }).RequireAuthorization("Pos");

        // A customer by name and phone, made at the counter: no email of their
        // own, no password, a customer like any other, and a note of who added
        // them when
        app.MapPost("/api/identity/customers", async (NewCounterCustomerRequest request, HttpContext http, UserDirectory directory, TenantCountry country, KeycloakAdmin keycloak, IEventBus eventBus, ILogger<CounterCustomerLog> logger, CancellationToken ct) =>
        {
            var name = (request.Name ?? "").Trim();
            if (name.Length is 0 or > 200)
            {
                return Results.BadRequest(new { message = "A name is required", field = "name" });
            }
            var phone = PhoneRules.Normalize(request.PhoneNumber, country.Code);
            if (!PhoneRules.IsValid(phone, country.Code))
            {
                return Results.BadRequest(new { message = "That is not a phone number here", field = "phoneNumber", placeholder = PhoneRules.For(country.Code).Placeholder });
            }

            // The number is the customer: a second account for it would split their points
            var snapshot = await directory.GetAsync(ct);
            var existing = snapshot.ByPhone(phone, StaffRoles) ?? (await directory.RefreshIfStaleAsync(ct)).ByPhone(phone, StaffRoles);
            if (existing is not null)
            {
                return Results.Conflict(new CustomerExistsResponse("A customer with this phone number already exists", UserDto.From(existing)));
            }

            HttpClient client;
            try
            {
                client = await keycloak.AuthorizedClientAsync();
            }
            catch (InvalidOperationException e)
            {
                return Results.Problem(e.Message, statusCode: 500);
            }

            var parts = name.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var staffId = http.User.GetUserId() ?? "";
            var email = CounterCustomer.StandInEmail(phone);
            var payload = new JsonObject
            {
                ["username"] = email,
                ["email"] = email,
                ["emailVerified"] = false,
                ["firstName"] = parts[0],
                ["lastName"] = parts.Length > 1 ? parts[1] : "",
                ["enabled"] = true,
                ["requiredActions"] = new JsonArray(),
                ["attributes"] = new JsonObject
                {
                    ["phoneNumber"] = new JsonArray(phone),
                    [CounterCustomer.OriginAttribute] = new JsonArray(CounterCustomer.OriginCounter),
                    [CounterCustomer.AddedByAttribute] = new JsonArray(staffId),
                    [CounterCustomer.AddedByNameAttribute] = new JsonArray(http.User.GetUserName() ?? ""),
                    [CounterCustomer.AddedAtAttribute] = new JsonArray(DateTimeOffset.UtcNow.ToString("O")),
                },
            };

            var created = await client.PostAsJsonAsync($"{keycloak.AdminUrl}/users", payload, ct);
            if (created.StatusCode == HttpStatusCode.Conflict)
            {
                // The stand-in address is taken: this number was added a moment
                // ago, before the directory caught up. Offer that one.
                var same = await client.GetFromJsonAsync<List<KeycloakUser>>(
                    $"{keycloak.AdminUrl}/users?email={Uri.EscapeDataString(email)}&exact=true&briefRepresentation=false", ct);
                return same?.FirstOrDefault() is { } found
                    ? Results.Conflict(new CustomerExistsResponse("A customer with this phone number already exists", UserDto.From(UserDirectory.FromKeycloak(found, [], country.Code))))
                    : Results.Conflict(new { message = "A customer with this phone number already exists" });
            }
            if (!created.IsSuccessStatusCode)
            {
                var error = await created.Content.ReadAsStringAsync(ct);
                return Results.Problem($"Could not add the customer: {error}", statusCode: (int)created.StatusCode);
            }

            var userId = created.Headers.Location?.ToString().Split('/').LastOrDefault();
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Problem("Customer added but its id was not returned", statusCode: 500);
            }

            // The Customer role comes the way it comes to everyone who signs up:
            // the realm's default roles (default-roles-{realm} holds Customer),
            // so a counter customer's token reads exactly like any other's

            var user = await keycloak.GetUserAsync(client, userId);
            var added = user?.Deserialize<KeycloakUser>(JsonSerializerOptions.Web);
            if (added is null)
            {
                return Results.Problem("Customer added but could not be read back", statusCode: 500);
            }

            await eventBus.PublishAsync(new UserProfileUpdatedIntegrationEvent(userId, name));
            logger.LogInformation("Counter customer {UserId} added by {StaffId}", userId, staffId);

            return Results.Created($"/api/identity/users/{userId}", UserDto.From(UserDirectory.FromKeycloak(added, [], country.Code)));
        }).RequireAuthorization("Pos");

        // A one-time link for a counter customer to take their account over in
        // the app. The apps build the URL on the café's customer host
        app.MapPost("/api/identity/customers/{userId}/claim-link", async (string userId, HttpContext http, KeycloakAdmin keycloak, ILogger<CounterCustomerLog> logger) =>
        {
            HttpClient client;
            try
            {
                client = await keycloak.AuthorizedClientAsync();
            }
            catch (InvalidOperationException e)
            {
                return Results.Problem(e.Message, statusCode: 500);
            }

            var user = await keycloak.GetUserAsync(client, userId);
            if (user is null)
            {
                return Results.NotFound(new { message = "Customer not found" });
            }
            var current = user.Deserialize<KeycloakUser>(JsonSerializerOptions.Web)!;
            if (!CounterCustomer.IsClaimable(current.Attributes, current.Email))
            {
                return Results.Conflict(new { message = "This customer already signs in with their own account" });
            }

            var (token, hash) = CounterCustomer.NewClaimToken(current.Id);
            var now = DateTimeOffset.UtcNow;
            var expiresAt = now + CounterCustomer.LinkLifetime;
            var staffId = http.User.GetUserId() ?? "";
            var attributes = Attributes(user);
            attributes[CounterCustomer.ClaimHashAttribute] = new JsonArray(hash);
            attributes[CounterCustomer.ClaimExpiresAttribute] = new JsonArray(expiresAt.ToUnixTimeSeconds().ToString());
            attributes[CounterCustomer.ClaimIssuedByAttribute] = new JsonArray(staffId);
            attributes[CounterCustomer.ClaimIssuedAtAttribute] = new JsonArray(now.ToString("O"));

            var saved = await keycloak.PutUserAsync(client, userId, user);
            if (!saved.IsSuccessStatusCode)
            {
                var error = await saved.Content.ReadAsStringAsync();
                return Results.Problem($"Could not issue the link: {error}", statusCode: (int)saved.StatusCode);
            }

            logger.LogInformation("Claim link for counter customer {UserId} issued by {StaffId}, good until {ExpiresAt:O}", userId, staffId, expiresAt);
            return Results.Ok(new ClaimLinkResponse(token, expiresAt));
        }).RequireAuthorization("Pos").RequireRateLimiting(LinkIssuePolicy);

        // The claim page opens: whose account is this, and is the link still good?
        app.MapPost("/api/identity/claim/preview", async (ClaimPreviewRequest request, KeycloakAdmin keycloak, TenantCountry country) =>
        {
            var (client, user, refusal) = await ResolveAsync(request.Token, keycloak);
            if (refusal is not null) return refusal;
            var current = user!.Deserialize<KeycloakUser>(JsonSerializerOptions.Web)!;
            return Results.Ok(new ClaimPreviewResponse(
                $"{current.FirstName} {current.LastName}".Trim(),
                current.Attributes?.GetValueOrDefault("phoneNumber")?.FirstOrDefault(),
                ExpiresAt(current.Attributes)));
        }).AllowAnonymous().RequireRateLimiting(ClaimPolicy);

        // The customer gives their email and a password: the same account,
        // now theirs to sign in to, with the points and orders it already has
        app.MapPost("/api/identity/claim", async (ClaimRequest request, KeycloakAdmin keycloak, IEventBus eventBus, ILogger<CounterCustomerLog> logger) =>
        {
            var email = (request.Email ?? "").Trim();
            if (!IsEmail(email) || CounterCustomer.IsStandInEmail(email))
            {
                return Results.BadRequest(new { message = "Enter a valid email", field = "email" });
            }
            if ((request.Password ?? "").Length < MinPasswordLength)
            {
                return Results.BadRequest(new { message = $"The password needs at least {MinPasswordLength} characters", field = "password" });
            }

            await ClaimGate.WaitAsync();
            try
            {
                var (resolved, user, refusal) = await ResolveAsync(request.Token, keycloak);
                if (refusal is not null) return refusal;
                var client = resolved!;
                var userId = user!["id"]!.GetValue<string>();

                var taken = await client.GetFromJsonAsync<List<KeycloakUser>>(
                    $"{keycloak.AdminUrl}/users?email={Uri.EscapeDataString(email)}&exact=true");
                if (taken is { Count: > 0 })
                {
                    return Results.Conflict(new { message = "That email already has an account", field = "email" });
                }

                // The password first: if the realm's policy refuses it, nothing
                // has changed and the link still works for a second try
                var password = await client.PutAsJsonAsync($"{keycloak.AdminUrl}/users/{userId}/reset-password",
                    new { type = "password", value = request.Password, temporary = false });
                if (!password.IsSuccessStatusCode)
                {
                    var why = await password.Content.ReadAsStringAsync();
                    return Results.BadRequest(new { message = $"That password is not accepted: {why}", field = "password" });
                }

                user["email"] = email;
                user["emailVerified"] = true;
                var attributes = Attributes(user);
                attributes.Remove(CounterCustomer.OriginAttribute);
                attributes.Remove(CounterCustomer.ClaimExpiresAttribute);
                attributes[CounterCustomer.ClaimedAtAttribute] = new JsonArray(DateTimeOffset.UtcNow.ToString("O"));

                var saved = await keycloak.PutUserAsync(client, userId, user);
                if (saved.StatusCode == HttpStatusCode.Conflict)
                {
                    return Results.Conflict(new { message = "That email already has an account", field = "email" });
                }
                if (!saved.IsSuccessStatusCode)
                {
                    var error = await saved.Content.ReadAsStringAsync();
                    return Results.Problem($"Could not claim the account: {error}", statusCode: (int)saved.StatusCode);
                }

                var displayName = $"{user["firstName"]?.GetValue<string>()} {user["lastName"]?.GetValue<string>()}".Trim();
                if (displayName.Length > 0)
                {
                    await eventBus.PublishAsync(new UserProfileUpdatedIntegrationEvent(userId, displayName));
                }
                logger.LogInformation("Counter customer {UserId} claimed their account", userId);
                return Results.Ok(new ClaimedResponse(email));
            }
            finally
            {
                ClaimGate.Release();
            }
        }).AllowAnonymous().RequireRateLimiting(ClaimPolicy);
    }

    /// <summary>
    /// The user a token names, if it is theirs and still good. Refusals say
    /// why in a word the page can show: invalid (not a link we made, or one
    /// replaced by a newer one), used, expired.
    /// </summary>
    private static async Task<(HttpClient? Client, JsonObject? User, IResult? Refusal)> ResolveAsync(string? token, KeycloakAdmin keycloak)
    {
        var invalid = Results.NotFound(new ClaimRefusal("invalid"));
        if (!CounterCustomer.TryParse(token, out var userId, out var secret))
        {
            return (null, null, invalid);
        }

        HttpClient client;
        try
        {
            client = await keycloak.AuthorizedClientAsync();
        }
        catch (InvalidOperationException e)
        {
            return (null, null, Results.Problem(e.Message, statusCode: 500));
        }

        JsonObject? user;
        try
        {
            user = await keycloak.GetUserAsync(client, Uri.EscapeDataString(userId));
        }
        catch (HttpRequestException)
        {
            // An id Keycloak cannot even parse
            return (null, null, invalid);
        }
        if (user is null)
        {
            return (null, null, invalid);
        }

        var current = user.Deserialize<KeycloakUser>(JsonSerializerOptions.Web)!;
        if (!CounterCustomer.Matches(secret, current.Attributes?.GetValueOrDefault(CounterCustomer.ClaimHashAttribute)?.FirstOrDefault()))
        {
            return (null, null, invalid);
        }
        if (!CounterCustomer.IsClaimable(current.Attributes, current.Email))
        {
            return (null, null, Results.Json(new ClaimRefusal("used"), statusCode: StatusCodes.Status410Gone));
        }
        if (ExpiresAt(current.Attributes) is not { } expires || expires <= DateTimeOffset.UtcNow)
        {
            return (null, null, Results.Json(new ClaimRefusal("expired"), statusCode: StatusCodes.Status410Gone));
        }
        return (client, user, null);
    }

    private static DateTimeOffset? ExpiresAt(Dictionary<string, string[]>? attributes) =>
        long.TryParse(attributes?.GetValueOrDefault(CounterCustomer.ClaimExpiresAttribute)?.FirstOrDefault(), out var seconds)
            ? DateTimeOffset.FromUnixTimeSeconds(seconds)
            : null;

    private static JsonObject Attributes(JsonObject user)
    {
        if (user["attributes"] is not JsonObject attributes)
        {
            attributes = new JsonObject();
            user["attributes"] = attributes;
        }
        return attributes;
    }

    private static bool IsEmail(string email)
    {
        if (email.Length is < 3 or > 254 || email.Contains(' ')) return false;
        return MailAddress.TryCreate(email, out var parsed) && parsed.Address == email && parsed.Host.Contains('.');
    }
}

/// <summary>The category the counter customer endpoints log under.</summary>
public sealed class CounterCustomerLog;

record NewCounterCustomerRequest(string? Name, string? PhoneNumber);
record CustomerLookupResponse(string Phone, bool PhoneValid, UserDto? Match, List<UserDto> Similar);
record CustomerExistsResponse(string Message, UserDto Existing);
record ClaimLinkResponse(string Token, DateTimeOffset ExpiresAt);
record ClaimPreviewRequest(string? Token);
record ClaimPreviewResponse(string Name, string? PhoneNumber, DateTimeOffset? ExpiresAt);
record ClaimRequest(string? Token, string? Email, string? Password);
record ClaimedResponse(string Email);
record ClaimRefusal(string Reason);
