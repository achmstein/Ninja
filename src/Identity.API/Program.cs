using Ninja.Identity.API;
using Ninja.Identity.API.Directory;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Ninja.EventBus.Abstractions;
using Ninja.Identity.API.IntegrationEvents;
using Ninja.ServiceDefaults;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.AddDefaultAuthentication();

// Add HttpClient for Keycloak Admin API
builder.Services.AddHttpClient("KeycloakAdmin", client =>
{
    client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
});
builder.Services.AddSingleton<KeycloakAdmin>();
builder.Services.AddSingleton<StaffAccounts>();
// Says every staff account once at start, so a service that keeps its own copy (riders, their phones) backfills
builder.Services.AddHostedService<StaffAnnouncer>();
builder.Services.AddSingleton<TenantCountry>();
builder.Services.AddCounterCustomerRateLimits(builder.Configuration);

// The customer index the till and the admin search from: Keycloak's own
// search matches name and email as plain substrings and costs a role call
// per user, which is neither the lookup a cashier needs nor one that
// survives a thousand customers
builder.Services.AddSingleton<UserDirectory>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<UserDirectory>());

// Add RabbitMQ event bus for publishing profile update events
builder.AddRabbitMqEventBus("eventbus")
    .ConfigureJsonOptions(options =>
        options.TypeInfoResolverChain.Add(IdentityIntegrationEventContext.Default));

var app = builder.Build();

app.MapDefaultEndpoints();

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// Any write that goes through this service (a registration, a profile or
// role or branch change) rebuilds the directory shortly after, so the till
// finds a customer who signed up in the app straight away
app.Use(async (context, next) =>
{
    await next(context);
    if (!HttpMethods.IsGet(context.Request.Method)
        && context.Response.StatusCode is >= 200 and < 300
        && context.Request.Path.StartsWithSegments("/api/identity"))
    {
        context.RequestServices.GetRequiredService<UserDirectory>().ScheduleRefresh();
    }
});

// Registration endpoint
app.MapPost("/api/identity/register", async (RegisterRequest request, IHttpClientFactory httpClientFactory, IConfiguration config, TenantCountry country) =>
{
    if (!PhoneInput.TryRead(request.PhoneNumber, country, out var phone, out var phoneProblem))
    {
        return phoneProblem;
    }

    var keycloakUrl = config["Identity:Url"] ?? throw new InvalidOperationException("Identity:Url not configured");
    var realm = config["Keycloak:Realm"] ?? "chillax";
    var adminClientId = config["Keycloak:AdminClientId"] ?? "admin-cli";
    var adminClientSecret = config["Keycloak:AdminClientSecret"];

    // The counter's stand-in addresses are nobody's to sign up with
    if (CounterCustomer.IsStandInEmail(request.Email))
    {
        return Results.BadRequest(new { message = "Enter a valid email" });
    }

    var client = httpClientFactory.CreateClient("KeycloakAdmin");

    // Get admin token using client credentials
    var tokenEndpoint = $"{keycloakUrl}/protocol/openid-connect/token";
    var tokenRequest = new FormUrlEncodedContent(new Dictionary<string, string>
    {
        ["grant_type"] = "client_credentials",
        ["client_id"] = adminClientId,
        ["client_secret"] = adminClientSecret ?? ""
    });

    var tokenResponse = await client.PostAsync(tokenEndpoint, tokenRequest);
    if (!tokenResponse.IsSuccessStatusCode)
    {
        return Results.Problem("Failed to authenticate with identity provider", statusCode: 500);
    }

    var tokenJson = await tokenResponse.Content.ReadFromJsonAsync<JsonElement>();
    var accessToken = tokenJson.GetProperty("access_token").GetString();

    // Create user via Admin REST API
    var adminUrl = keycloakUrl.Replace($"/realms/{realm}", "");
    var usersEndpoint = $"{adminUrl}/admin/realms/{realm}/users";

    // First and last as the app asks for them (an older app's one name, split)
    var (firstName, lastName) = PersonName.Of(request.FirstName, request.LastName, request.Name);

    var userPayload = new
    {
        username = request.Email,  // Use email as username
        email = request.Email,
        firstName = firstName,
        lastName = lastName,
        enabled = true,
        emailVerified = true,
        requiredActions = Array.Empty<string>(),
        attributes = new Dictionary<string, string[]>
        {
            ["phoneNumber"] = phone is null ? [] : [phone]
        },
        credentials = new[]
        {
            new
            {
                type = "password",
                value = request.Password,
                temporary = false
            }
        }
    };

    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
    var createResponse = await client.PostAsJsonAsync(usersEndpoint, userPayload);

    if (createResponse.IsSuccessStatusCode || createResponse.StatusCode == System.Net.HttpStatusCode.Created)
    {
        return Results.Ok(new { message = "User registered successfully" });
    }

    if (createResponse.StatusCode == System.Net.HttpStatusCode.Conflict)
    {
        return Results.Conflict(new { message = "Username or email already exists" });
    }

    var errorContent = await createResponse.Content.ReadAsStringAsync();
    return Results.Problem($"Registration failed: {errorContent}", statusCode: (int)createResponse.StatusCode);
});

// Register admin endpoint (owner only - protected)
app.MapPost("/api/identity/register-admin", async (RegisterAdminRequest request, StaffAccounts staff, CancellationToken ct) =>
{
    // A staff account is an Admin (back office), a Cashier (till, kitchen) or
    // a Kitchen display's own account (the board and its printers only), or
    // a Rider (the deliveries given to them, in the rider app); only an Admin
    // can also be an Owner
    var role = string.IsNullOrWhiteSpace(request.Role) ? RoleNames.Admin : request.Role.Trim();
    if (!RoleNames.Creatable.Contains(role))
    {
        return Results.BadRequest(new { message = $"role must be {string.Join(", ", RoleNames.Creatable[..^1])} or {RoleNames.Creatable[^1]}" });
    }
    if (request.IsOwner && role != RoleNames.Admin)
    {
        return Results.BadRequest(new { message = "only an Admin can be made Owner" });
    }
    var branches = (request.BranchIds ?? []).Where(id => id > 0).Distinct().Order().ToList();

    // Made whole or not at all: see StaffAccounts.CreateAsync
    return await staff.CreateAsync(request.Email, request.Password, request.Name, role, request.IsOwner, branches, ct) switch
    {
        StaffCreation.Created created => Results.Ok(new { message = "Staff account registered successfully", userId = created.UserId }),
        StaffCreation.Taken => Results.Conflict(new { message = "Username or email already exists" }),
        StaffCreation.Failed failed => Results.Problem(failed.Message, statusCode: failed.Status),
        _ => Results.Problem("The staff account was not made", statusCode: 500),
    };
}).RequireAuthorization("Owner");

// List users endpoint (admin only)
// Supports filtering: role=Admin (only admins), excludeRole=Admin (exclude admins, i.e. customers only)
app.MapGet("/api/identity/users", async (UserDirectory directory, int? first, int? max, string? search, string? role, string? excludeRole, CancellationToken ct) =>
{
    // Either filter takes one role or a comma-separated list
    var include = SplitRoles(role);
    var exclude = SplitRoles(excludeRole);

    var snapshot = await directory.GetAsync(ct);
    var matches = snapshot.Search(search, include, exclude).ToList();

    // Nothing found and the index is not fresh: the person may have signed up
    // on Keycloak's own page a minute ago. Rebuild once and look again.
    if (matches.Count == 0 && !string.IsNullOrWhiteSpace(search))
    {
        snapshot = await directory.RefreshIfStaleAsync(ct);
        matches = snapshot.Search(search, include, exclude).ToList();
    }

    var result = matches
        .Skip(first ?? 0)
        .Take(max ?? 50)
        .Select(UserDto.From)
        .ToList();

    return Results.Ok(result);
    // "Pos" (Admin/Owner/Cashier): the till searches customers to attach a
    // sale for loyalty — the one identity read a cashier needs
}).RequireAuthorization("Pos");

// Get user by ID endpoint (admin only)
app.MapGet("/api/identity/users/{userId}", async (string userId, IHttpClientFactory httpClientFactory, IConfiguration config, TenantCountry country) =>
{
    var keycloakUrl = config["Identity:Url"] ?? throw new InvalidOperationException("Identity:Url not configured");
    var realm = config["Keycloak:Realm"] ?? "chillax";
    var adminClientId = config["Keycloak:AdminClientId"] ?? "admin-cli";
    var adminClientSecret = config["Keycloak:AdminClientSecret"];

    var client = httpClientFactory.CreateClient("KeycloakAdmin");

    // Get admin token
    var tokenEndpoint = $"{keycloakUrl}/protocol/openid-connect/token";
    var tokenRequest = new FormUrlEncodedContent(new Dictionary<string, string>
    {
        ["grant_type"] = "client_credentials",
        ["client_id"] = adminClientId,
        ["client_secret"] = adminClientSecret ?? ""
    });

    var tokenResponse = await client.PostAsync(tokenEndpoint, tokenRequest);
    if (!tokenResponse.IsSuccessStatusCode)
    {
        return Results.Problem("Failed to authenticate with identity provider", statusCode: 500);
    }

    var tokenJson = await tokenResponse.Content.ReadFromJsonAsync<JsonElement>();
    var accessToken = tokenJson.GetProperty("access_token").GetString();

    // Fetch user from Keycloak Admin API
    var adminUrl = keycloakUrl.Replace($"/realms/{realm}", "");
    var userEndpoint = $"{adminUrl}/admin/realms/{realm}/users/{userId}";

    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
    var userResponse = await client.GetAsync(userEndpoint);

    if (userResponse.StatusCode == System.Net.HttpStatusCode.NotFound)
    {
        return Results.NotFound();
    }

    if (!userResponse.IsSuccessStatusCode)
    {
        return Results.Problem("Failed to fetch user", statusCode: (int)userResponse.StatusCode);
    }

    var user = await userResponse.Content.ReadFromJsonAsync<KeycloakUser>();
    if (user == null)
    {
        return Results.NotFound();
    }

    // Fetch user's realm roles
    var rolesEndpoint = $"{adminUrl}/admin/realms/{realm}/users/{userId}/role-mappings/realm";
    var rolesResponse = await client.GetAsync(rolesEndpoint);
    var realmRoles = new List<string>();

    if (rolesResponse.IsSuccessStatusCode)
    {
        var roles = await rolesResponse.Content.ReadFromJsonAsync<List<KeycloakRole>>();
        realmRoles = roles?.Select(r => r.Name).Where(n => n != null).Cast<string>().ToList() ?? [];
    }

    return Results.Ok(UserDto.From(UserDirectory.FromKeycloak(user, realmRoles, country.Code)));
}).RequireAuthorization("Admin");

// Get user count endpoint
app.MapGet("/api/identity/users/count", async (UserDirectory directory, string? search, string? role, string? excludeRole, CancellationToken ct) =>
{
    var snapshot = await directory.GetAsync(ct);
    var count = snapshot.Search(search, SplitRoles(role), SplitRoles(excludeRole)).Count();
    return Results.Ok(new { count });
}).RequireAuthorization("Admin");

// Change password endpoint (authenticated user)
app.MapPost("/api/identity/change-password", async (ChangePasswordRequest request, HttpContext httpContext, IHttpClientFactory httpClientFactory, IConfiguration config) =>
{
    var userId = httpContext.User.GetUserId();
    if (string.IsNullOrEmpty(userId))
    {
        return Results.Unauthorized();
    }

    var keycloakUrl = config["Identity:Url"] ?? throw new InvalidOperationException("Identity:Url not configured");
    var realm = config["Keycloak:Realm"] ?? "chillax";
    var adminClientId = config["Keycloak:AdminClientId"] ?? "admin-cli";
    var adminClientSecret = config["Keycloak:AdminClientSecret"];

    var client = httpClientFactory.CreateClient("KeycloakAdmin");

    // Get admin token
    var tokenEndpoint = $"{keycloakUrl}/protocol/openid-connect/token";
    var tokenRequest = new FormUrlEncodedContent(new Dictionary<string, string>
    {
        ["grant_type"] = "client_credentials",
        ["client_id"] = adminClientId,
        ["client_secret"] = adminClientSecret ?? ""
    });

    var tokenResponse = await client.PostAsync(tokenEndpoint, tokenRequest);
    if (!tokenResponse.IsSuccessStatusCode)
    {
        return Results.Problem("Failed to authenticate with identity provider", statusCode: 500);
    }

    var tokenJson = await tokenResponse.Content.ReadFromJsonAsync<JsonElement>();
    var accessToken = tokenJson.GetProperty("access_token").GetString();

    // Reset password via Admin API
    var adminUrl = keycloakUrl.Replace($"/realms/{realm}", "");
    var passwordEndpoint = $"{adminUrl}/admin/realms/{realm}/users/{userId}/reset-password";

    var passwordPayload = new
    {
        type = "password",
        value = request.NewPassword,
        temporary = false
    };

    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
    var resetResponse = await client.PutAsJsonAsync(passwordEndpoint, passwordPayload);

    if (resetResponse.IsSuccessStatusCode || resetResponse.StatusCode == System.Net.HttpStatusCode.NoContent)
    {
        return Results.Ok(new { message = "Password changed successfully" });
    }

    if (resetResponse.StatusCode == System.Net.HttpStatusCode.NotFound)
    {
        return Results.NotFound(new { message = "User not found" });
    }

    var errorContent = await resetResponse.Content.ReadAsStringAsync();
    return Results.Problem($"Failed to change password: {errorContent}", statusCode: (int)resetResponse.StatusCode);
}).RequireAuthorization();

// Update email endpoint (authenticated user)
app.MapPost("/api/identity/update-email", async (UpdateEmailRequest request, HttpContext httpContext, IHttpClientFactory httpClientFactory, IConfiguration config) =>
{
    var userId = httpContext.User.GetUserId();
    if (string.IsNullOrEmpty(userId))
    {
        return Results.Unauthorized();
    }

    var keycloakUrl = config["Identity:Url"] ?? throw new InvalidOperationException("Identity:Url not configured");
    var realm = config["Keycloak:Realm"] ?? "chillax";
    var adminClientId = config["Keycloak:AdminClientId"] ?? "admin-cli";
    var adminClientSecret = config["Keycloak:AdminClientSecret"];

    var client = httpClientFactory.CreateClient("KeycloakAdmin");

    // Get admin token
    var tokenEndpoint = $"{keycloakUrl}/protocol/openid-connect/token";
    var tokenRequest = new FormUrlEncodedContent(new Dictionary<string, string>
    {
        ["grant_type"] = "client_credentials",
        ["client_id"] = adminClientId,
        ["client_secret"] = adminClientSecret ?? ""
    });

    var tokenResponse = await client.PostAsync(tokenEndpoint, tokenRequest);
    if (!tokenResponse.IsSuccessStatusCode)
    {
        return Results.Problem("Failed to authenticate with identity provider", statusCode: 500);
    }

    var tokenJson = await tokenResponse.Content.ReadFromJsonAsync<JsonElement>();
    var accessToken = tokenJson.GetProperty("access_token").GetString();

    // Update user email via Admin API
    var adminUrl = keycloakUrl.Replace($"/realms/{realm}", "");
    var userEndpoint = $"{adminUrl}/admin/realms/{realm}/users/{userId}";

    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

    // PUT the full representation: Keycloak's declarative user profile
    // removes any profile field missing from the payload
    var getResponse = await client.GetAsync(userEndpoint);
    if (!getResponse.IsSuccessStatusCode)
    {
        if (getResponse.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return Results.NotFound(new { message = "User not found" });
        }
        return Results.Problem("Failed to fetch user", statusCode: (int)getResponse.StatusCode);
    }

    var userJson = await getResponse.Content.ReadFromJsonAsync<JsonObject>();
    if (userJson == null)
    {
        return Results.NotFound(new { message = "User not found" });
    }

    if (CounterCustomer.IsStandInEmail(request.NewEmail))
    {
        return Results.BadRequest(new { message = "Enter a valid email" });
    }
    userJson["email"] = request.NewEmail;
    userJson["emailVerified"] = false;

    var updateResponse = await client.PutAsJsonAsync(userEndpoint, userJson);

    if (updateResponse.IsSuccessStatusCode || updateResponse.StatusCode == System.Net.HttpStatusCode.NoContent)
    {
        return Results.Ok(new { message = "Email updated successfully" });
    }

    if (updateResponse.StatusCode == System.Net.HttpStatusCode.NotFound)
    {
        return Results.NotFound(new { message = "User not found" });
    }

    if (updateResponse.StatusCode == System.Net.HttpStatusCode.Conflict)
    {
        return Results.Conflict(new { message = "Email already in use" });
    }

    var errorContent = await updateResponse.Content.ReadAsStringAsync();
    return Results.Problem($"Failed to update email: {errorContent}", statusCode: (int)updateResponse.StatusCode);
}).RequireAuthorization();

// Update name endpoint (authenticated user)
app.MapPost("/api/identity/update-name", async (UpdateNameRequest request, HttpContext httpContext, IHttpClientFactory httpClientFactory, IConfiguration config, IEventBus eventBus, StaffAccounts staff) =>
{
    var userId = httpContext.User.GetUserId();
    if (string.IsNullOrEmpty(userId))
    {
        return Results.Unauthorized();
    }

    var keycloakUrl = config["Identity:Url"] ?? throw new InvalidOperationException("Identity:Url not configured");
    var realm = config["Keycloak:Realm"] ?? "chillax";
    var adminClientId = config["Keycloak:AdminClientId"] ?? "admin-cli";
    var adminClientSecret = config["Keycloak:AdminClientSecret"];

    var client = httpClientFactory.CreateClient("KeycloakAdmin");

    // Get admin token
    var tokenEndpoint = $"{keycloakUrl}/protocol/openid-connect/token";
    var tokenRequest = new FormUrlEncodedContent(new Dictionary<string, string>
    {
        ["grant_type"] = "client_credentials",
        ["client_id"] = adminClientId,
        ["client_secret"] = adminClientSecret ?? ""
    });

    var tokenResponse = await client.PostAsync(tokenEndpoint, tokenRequest);
    if (!tokenResponse.IsSuccessStatusCode)
    {
        return Results.Problem("Failed to authenticate with identity provider", statusCode: 500);
    }

    var tokenJson = await tokenResponse.Content.ReadFromJsonAsync<JsonElement>();
    var accessToken = tokenJson.GetProperty("access_token").GetString();

    // Update user name via Admin API
    var adminUrl = keycloakUrl.Replace($"/realms/{realm}", "");
    var userEndpoint = $"{adminUrl}/admin/realms/{realm}/users/{userId}";

    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

    // PUT the full representation: Keycloak's declarative user profile
    // removes any profile field missing from the payload
    var getResponse = await client.GetAsync(userEndpoint);
    if (!getResponse.IsSuccessStatusCode)
    {
        if (getResponse.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return Results.NotFound(new { message = "User not found" });
        }
        return Results.Problem("Failed to fetch user", statusCode: (int)getResponse.StatusCode);
    }

    var userJson = await getResponse.Content.ReadFromJsonAsync<JsonObject>();
    if (userJson == null)
    {
        return Results.NotFound(new { message = "User not found" });
    }

    var (firstName, lastName) = PersonName.Of(request.FirstName, request.LastName, request.NewName);

    userJson["firstName"] = firstName;
    userJson["lastName"] = lastName ?? "";

    var updateResponse = await client.PutAsJsonAsync(userEndpoint, userJson);

    if (updateResponse.IsSuccessStatusCode || updateResponse.StatusCode == System.Net.HttpStatusCode.NoContent)
    {
        await eventBus.PublishAsync(new UserProfileUpdatedIntegrationEvent(userId, request.NewName!));
        if (httpContext.User.GetRoles().Any(r => RoleNames.Staff.Contains(r))) await staff.AnnounceAsync(userId);
        return Results.Ok(new { message = "Name updated successfully" });
    }

    if (updateResponse.StatusCode == System.Net.HttpStatusCode.NotFound)
    {
        return Results.NotFound(new { message = "User not found" });
    }

    var errorContent = await updateResponse.Content.ReadAsStringAsync();
    return Results.Problem($"Failed to update name: {errorContent}", statusCode: (int)updateResponse.StatusCode);
}).RequireAuthorization();

// Update profile (name + phone) - used from settings
app.MapPost("/api/identity/update-profile", async (UpdateProfileRequest request, HttpContext httpContext, IHttpClientFactory httpClientFactory, IConfiguration config, IEventBus eventBus, TenantCountry country) =>
{
    if (!PhoneInput.TryRead(request.PhoneNumber, country, out var phone, out var phoneProblem))
    {
        return phoneProblem;
    }

    var userId = httpContext.User.GetUserId();
    if (string.IsNullOrEmpty(userId))
    {
        return Results.Unauthorized();
    }

    if (!PersonName.Given(request.FirstName, request.LastName, request.Name) && string.IsNullOrWhiteSpace(request.PhoneNumber))
    {
        return Results.BadRequest(new { message = "At least name or phone number is required" });
    }

    var keycloakUrl = config["Identity:Url"] ?? throw new InvalidOperationException("Identity:Url not configured");
    var realm = config["Keycloak:Realm"] ?? "chillax";
    var adminClientId = config["Keycloak:AdminClientId"] ?? "admin-cli";
    var adminClientSecret = config["Keycloak:AdminClientSecret"];

    var client = httpClientFactory.CreateClient("KeycloakAdmin");

    // Get admin token
    var tokenEndpoint = $"{keycloakUrl}/protocol/openid-connect/token";
    var tokenRequest = new FormUrlEncodedContent(new Dictionary<string, string>
    {
        ["grant_type"] = "client_credentials",
        ["client_id"] = adminClientId,
        ["client_secret"] = adminClientSecret ?? ""
    });

    var tokenResponse = await client.PostAsync(tokenEndpoint, tokenRequest);
    if (!tokenResponse.IsSuccessStatusCode)
    {
        return Results.Problem("Failed to authenticate with identity provider", statusCode: 500);
    }

    var tokenJson = await tokenResponse.Content.ReadFromJsonAsync<JsonElement>();
    var accessToken = tokenJson.GetProperty("access_token").GetString();

    var adminUrl = keycloakUrl.Replace($"/realms/{realm}", "");
    var userEndpoint = $"{adminUrl}/admin/realms/{realm}/users/{userId}";

    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

    // GET the full representation and mutate only what changes: Keycloak's
    // declarative user profile removes any profile field missing from the PUT
    var getResponse = await client.GetAsync(userEndpoint);
    if (!getResponse.IsSuccessStatusCode)
    {
        return Results.Problem("Failed to fetch user", statusCode: (int)getResponse.StatusCode);
    }

    var userJson = await getResponse.Content.ReadFromJsonAsync<JsonObject>();
    if (userJson == null)
    {
        return Results.NotFound();
    }

    // Merge attributes — only update phone if provided
    if (phone is not null)
    {
        if (userJson["attributes"] is not JsonObject attributes)
        {
            attributes = new JsonObject();
            userJson["attributes"] = attributes;
        }
        attributes["phoneNumber"] = new JsonArray(phone);
    }

    // The name only if given, otherwise kept as it is
    var firstName = (string?)userJson["firstName"];
    var lastName = (string?)userJson["lastName"];
    if (PersonName.Given(request.FirstName, request.LastName, request.Name))
    {
        (firstName, lastName) = PersonName.Of(request.FirstName, request.LastName, request.Name);
        userJson["firstName"] = firstName;
        userJson["lastName"] = lastName ?? "";
    }

    var updateResponse = await client.PutAsJsonAsync(userEndpoint, userJson);

    if (updateResponse.IsSuccessStatusCode || updateResponse.StatusCode == System.Net.HttpStatusCode.NoContent)
    {
        var displayName = string.IsNullOrEmpty(lastName) ? firstName : $"{firstName} {lastName}";
        if (!string.IsNullOrWhiteSpace(displayName))
        {
            await eventBus.PublishAsync(new UserProfileUpdatedIntegrationEvent(userId, displayName));
        }
        return Results.Ok(new { message = "Profile updated successfully" });
    }

    var errorContent = await updateResponse.Content.ReadAsStringAsync();
    return Results.Problem($"Failed to update profile: {errorContent}", statusCode: (int)updateResponse.StatusCode);
}).RequireAuthorization();

// Admin: Update customer profile (name + phone) endpoint
app.MapPut("/api/identity/users/{userId}/profile", async (string userId, UpdateProfileRequest request, IHttpClientFactory httpClientFactory, IConfiguration config, IEventBus eventBus, TenantCountry country, StaffAccounts staff) =>
{
    if (!PhoneInput.TryRead(request.PhoneNumber, country, out var phone, out var phoneProblem))
    {
        return phoneProblem;
    }

    if (!PersonName.Given(request.FirstName, request.LastName, request.Name))
    {
        return Results.BadRequest(new { message = "Name is required" });
    }

    var keycloakUrl = config["Identity:Url"] ?? throw new InvalidOperationException("Identity:Url not configured");
    var realm = config["Keycloak:Realm"] ?? "chillax";
    var adminClientId = config["Keycloak:AdminClientId"] ?? "admin-cli";
    var adminClientSecret = config["Keycloak:AdminClientSecret"];

    var client = httpClientFactory.CreateClient("KeycloakAdmin");

    // Get admin token
    var tokenEndpoint = $"{keycloakUrl}/protocol/openid-connect/token";
    var tokenRequest = new FormUrlEncodedContent(new Dictionary<string, string>
    {
        ["grant_type"] = "client_credentials",
        ["client_id"] = adminClientId,
        ["client_secret"] = adminClientSecret ?? ""
    });

    var tokenResponse = await client.PostAsync(tokenEndpoint, tokenRequest);
    if (!tokenResponse.IsSuccessStatusCode)
    {
        return Results.Problem("Failed to authenticate with identity provider", statusCode: 500);
    }

    var tokenJson = await tokenResponse.Content.ReadFromJsonAsync<JsonElement>();
    var accessToken = tokenJson.GetProperty("access_token").GetString();

    var adminUrl = keycloakUrl.Replace($"/realms/{realm}", "");
    var userEndpoint = $"{adminUrl}/admin/realms/{realm}/users/{userId}";

    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

    // GET current user to preserve existing attributes
    var getResponse = await client.GetAsync(userEndpoint);
    if (!getResponse.IsSuccessStatusCode)
    {
        if (getResponse.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return Results.NotFound(new { message = "User not found" });
        }
        return Results.Problem("Failed to fetch user", statusCode: (int)getResponse.StatusCode);
    }

    // PUT the full representation: Keycloak's declarative user profile
    // removes any profile field missing from the payload
    var userJson = await getResponse.Content.ReadFromJsonAsync<JsonObject>();
    if (userJson == null)
    {
        return Results.NotFound(new { message = "User not found" });
    }

    // Merge attributes
    if (phone is not null)
    {
        if (userJson["attributes"] is not JsonObject attributes)
        {
            attributes = new JsonObject();
            userJson["attributes"] = attributes;
        }
        attributes["phoneNumber"] = new JsonArray(phone);
    }

    var (firstName, lastName) = PersonName.Of(request.FirstName, request.LastName, request.Name);
    userJson["firstName"] = firstName;
    userJson["lastName"] = lastName ?? "";

    var updateResponse = await client.PutAsJsonAsync(userEndpoint, userJson);

    if (updateResponse.IsSuccessStatusCode || updateResponse.StatusCode == System.Net.HttpStatusCode.NoContent)
    {
        await eventBus.PublishAsync(new UserProfileUpdatedIntegrationEvent(userId, PersonName.Display(firstName, lastName)));
        // A member of staff renamed: the riders' list and the like say the new name
        await staff.AnnounceAsync(userId);
        return Results.Ok(new { message = "Profile updated successfully" });
    }

    var errorContent = await updateResponse.Content.ReadAsStringAsync();
    return Results.Problem($"Failed to update profile: {errorContent}", statusCode: (int)updateResponse.StatusCode);
}).RequireAuthorization("Admin");

// Admin: Reset customer password endpoint
app.MapPut("/api/identity/users/{userId}/password", async (string userId, ChangePasswordRequest request, IHttpClientFactory httpClientFactory, IConfiguration config) =>
{
    var keycloakUrl = config["Identity:Url"] ?? throw new InvalidOperationException("Identity:Url not configured");
    var realm = config["Keycloak:Realm"] ?? "chillax";
    var adminClientId = config["Keycloak:AdminClientId"] ?? "admin-cli";
    var adminClientSecret = config["Keycloak:AdminClientSecret"];

    var client = httpClientFactory.CreateClient("KeycloakAdmin");

    // Get admin token
    var tokenEndpoint = $"{keycloakUrl}/protocol/openid-connect/token";
    var tokenRequest = new FormUrlEncodedContent(new Dictionary<string, string>
    {
        ["grant_type"] = "client_credentials",
        ["client_id"] = adminClientId,
        ["client_secret"] = adminClientSecret ?? ""
    });

    var tokenResponse = await client.PostAsync(tokenEndpoint, tokenRequest);
    if (!tokenResponse.IsSuccessStatusCode)
    {
        return Results.Problem("Failed to authenticate with identity provider", statusCode: 500);
    }

    var tokenJson = await tokenResponse.Content.ReadFromJsonAsync<JsonElement>();
    var accessToken = tokenJson.GetProperty("access_token").GetString();

    // Reset password via Admin API
    var adminUrl = keycloakUrl.Replace($"/realms/{realm}", "");
    var passwordEndpoint = $"{adminUrl}/admin/realms/{realm}/users/{userId}/reset-password";

    var passwordPayload = new
    {
        type = "password",
        value = request.NewPassword,
        temporary = false
    };

    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
    var resetResponse = await client.PutAsJsonAsync(passwordEndpoint, passwordPayload);

    if (resetResponse.IsSuccessStatusCode || resetResponse.StatusCode == System.Net.HttpStatusCode.NoContent)
    {
        return Results.Ok(new { message = "Password reset successfully" });
    }

    if (resetResponse.StatusCode == System.Net.HttpStatusCode.NotFound)
    {
        return Results.NotFound(new { message = "User not found" });
    }

    var errorContent = await resetResponse.Content.ReadAsStringAsync();
    return Results.Problem($"Failed to reset password: {errorContent}", statusCode: (int)resetResponse.StatusCode);
}).RequireAuthorization("Admin");

// Delete account endpoint (authenticated user - soft delete by disabling)
app.MapDelete("/api/identity/delete-account", async (HttpContext httpContext, IHttpClientFactory httpClientFactory, IConfiguration config, StaffAccounts staff) =>
{
    var userId = httpContext.User.GetUserId();
    if (string.IsNullOrEmpty(userId))
    {
        return Results.Unauthorized();
    }

    var keycloakUrl = config["Identity:Url"] ?? throw new InvalidOperationException("Identity:Url not configured");
    var realm = config["Keycloak:Realm"] ?? "chillax";
    var adminClientId = config["Keycloak:AdminClientId"] ?? "admin-cli";
    var adminClientSecret = config["Keycloak:AdminClientSecret"];

    var client = httpClientFactory.CreateClient("KeycloakAdmin");

    // Get admin token
    var tokenEndpoint = $"{keycloakUrl}/protocol/openid-connect/token";
    var tokenRequest = new FormUrlEncodedContent(new Dictionary<string, string>
    {
        ["grant_type"] = "client_credentials",
        ["client_id"] = adminClientId,
        ["client_secret"] = adminClientSecret ?? ""
    });

    var tokenResponse = await client.PostAsync(tokenEndpoint, tokenRequest);
    if (!tokenResponse.IsSuccessStatusCode)
    {
        return Results.Problem("Failed to authenticate with identity provider", statusCode: 500);
    }

    var tokenJson = await tokenResponse.Content.ReadFromJsonAsync<JsonElement>();
    var accessToken = tokenJson.GetProperty("access_token").GetString();

    // Disable the user (soft delete). GET the full representation and PUT it
    // back with enabled=false: Keycloak's declarative user profile removes any
    // field missing from the payload, attributes included
    var adminUrl = keycloakUrl.Replace($"/realms/{realm}", "");
    var userEndpoint = $"{adminUrl}/admin/realms/{realm}/users/{userId}";

    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
    var getResponse = await client.GetAsync(userEndpoint);
    if (getResponse.StatusCode == System.Net.HttpStatusCode.NotFound)
    {
        return Results.NotFound(new { message = "User not found" });
    }
    if (!getResponse.IsSuccessStatusCode)
    {
        return Results.Problem("Failed to fetch user", statusCode: (int)getResponse.StatusCode);
    }
    var userJson = await getResponse.Content.ReadFromJsonAsync<JsonObject>();
    if (userJson == null)
    {
        return Results.NotFound(new { message = "User not found" });
    }
    userJson["enabled"] = false;

    var updateResponse = await client.PutAsJsonAsync(userEndpoint, userJson);

    if (updateResponse.IsSuccessStatusCode || updateResponse.StatusCode == System.Net.HttpStatusCode.NoContent)
    {
        // Revoke the sessions too, so existing tokens stop working now
        await client.PostAsync($"{userEndpoint}/logout", null);
        // A member of staff gone: no more deliveries given to them, no more pushes to their phone
        if (httpContext.User.GetRoles().Any(r => RoleNames.Staff.Contains(r))) await staff.AnnounceGoneAsync(userId);
        return Results.Ok(new { message = "Account deleted successfully" });
    }

    if (updateResponse.StatusCode == System.Net.HttpStatusCode.NotFound)
    {
        return Results.NotFound(new { message = "User not found" });
    }

    var errorContent = await updateResponse.Content.ReadAsStringAsync();
    return Results.Problem($"Failed to delete account: {errorContent}", statusCode: (int)updateResponse.StatusCode);
}).RequireAuthorization();

// Admin: Toggle customer enabled/disabled
app.MapPut("/api/identity/users/{userId}/toggle-enabled", async (string userId, IHttpClientFactory httpClientFactory, IConfiguration config, StaffAccounts staff) =>
{
    var keycloakUrl = config["Identity:Url"] ?? throw new InvalidOperationException("Identity:Url not configured");
    var realm = config["Keycloak:Realm"] ?? "chillax";
    var adminClientId = config["Keycloak:AdminClientId"] ?? "admin-cli";
    var adminClientSecret = config["Keycloak:AdminClientSecret"];

    var client = httpClientFactory.CreateClient("KeycloakAdmin");

    // Get admin token
    var tokenEndpoint = $"{keycloakUrl}/protocol/openid-connect/token";
    var tokenRequest = new FormUrlEncodedContent(new Dictionary<string, string>
    {
        ["grant_type"] = "client_credentials",
        ["client_id"] = adminClientId,
        ["client_secret"] = adminClientSecret ?? ""
    });

    var tokenResponse = await client.PostAsync(tokenEndpoint, tokenRequest);
    if (!tokenResponse.IsSuccessStatusCode)
    {
        return Results.Problem("Failed to authenticate with identity provider", statusCode: 500);
    }

    var tokenJson = await tokenResponse.Content.ReadFromJsonAsync<JsonElement>();
    var accessToken = tokenJson.GetProperty("access_token").GetString();

    var adminUrl = keycloakUrl.Replace($"/realms/{realm}", "");
    var userEndpoint = $"{adminUrl}/admin/realms/{realm}/users/{userId}";

    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

    // GET current user to read enabled state
    var getResponse = await client.GetAsync(userEndpoint);
    if (getResponse.StatusCode == System.Net.HttpStatusCode.NotFound)
    {
        return Results.NotFound(new { message = "User not found" });
    }
    if (!getResponse.IsSuccessStatusCode)
    {
        return Results.Problem("Failed to fetch user", statusCode: (int)getResponse.StatusCode);
    }

    // PUT the full representation: Keycloak's declarative user profile
    // removes any profile field missing from the payload
    var userJson = await getResponse.Content.ReadFromJsonAsync<JsonObject>();
    if (userJson == null)
    {
        return Results.NotFound(new { message = "User not found" });
    }

    var newEnabled = !(userJson["enabled"]?.GetValue<bool>() ?? false);
    userJson["enabled"] = newEnabled;

    var updateResponse = await client.PutAsJsonAsync(userEndpoint, userJson);

    if (updateResponse.IsSuccessStatusCode || updateResponse.StatusCode == System.Net.HttpStatusCode.NoContent)
    {
        // When blocking, revoke all active sessions so existing tokens stop working
        if (!newEnabled)
        {
            var logoutEndpoint = $"{adminUrl}/admin/realms/{realm}/users/{userId}/logout";
            await client.PostAsync(logoutEndpoint, null);
        }

        // A rider switched off stops being given deliveries, and their phone stops ringing
        await staff.AnnounceAsync(userId);
        return Results.Ok(new { enabled = newEnabled });
    }

    var errorContent = await updateResponse.Content.ReadAsStringAsync();
    return Results.Problem($"Failed to toggle user enabled state: {errorContent}", statusCode: (int)updateResponse.StatusCode);
}).RequireAuthorization("Admin");

// Get current user's profile (authenticated user)
// Owner: replace a staff account's whole branch set. Stored on the Keycloak
// user attribute `branches` and issued as the `branches` claim; it reaches
// the user's token on its next refresh (the access token lives 2 h), so no
// forced logout. Ids are not validated against Tenant.API (services never
// call each other): clients pick from the branch list, and an id that is no
// branch never matches anything.
app.MapPut("/api/identity/users/{userId}/branches", async (string userId, SetBranchesRequest request, KeycloakAdmin keycloak, StaffAccounts staff) =>
{
    if (request.BranchIds is null || request.BranchIds.Any(id => id <= 0))
    {
        return Results.BadRequest(new { message = "branchIds must be positive integers" });
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

    var user = await keycloak.GetUserAsync(client, userId);
    if (user is null)
    {
        return Results.NotFound(new { message = "User not found" });
    }

    if (user["attributes"] is not JsonObject attributes)
    {
        attributes = new JsonObject();
        user["attributes"] = attributes;
    }
    // An empty set removes the attribute: no claim, no branch
    var branchIds = request.BranchIds.Distinct().Order().ToList();
    attributes["branches"] = new JsonArray(branchIds.Select(id => (JsonNode)id.ToString()).ToArray());

    var response = await keycloak.PutUserAsync(client, userId, user);
    if (!response.IsSuccessStatusCode)
    {
        var error = await response.Content.ReadAsStringAsync();
        return Results.Problem($"Failed to update branches: {error}", statusCode: (int)response.StatusCode);
    }

    await staff.AnnounceAsync(userId);
    return Results.Ok(new { branches = branchIds });
}).RequireAuthorization("Owner");

app.MapGet("/api/identity/my-profile", async (HttpContext httpContext, IHttpClientFactory httpClientFactory, IConfiguration config, TenantCountry country) =>
{
    var userId = httpContext.User.GetUserId();
    if (string.IsNullOrEmpty(userId))
    {
        return Results.Unauthorized();
    }

    var keycloakUrl = config["Identity:Url"] ?? throw new InvalidOperationException("Identity:Url not configured");
    var realm = config["Keycloak:Realm"] ?? "chillax";
    var adminClientId = config["Keycloak:AdminClientId"] ?? "admin-cli";
    var adminClientSecret = config["Keycloak:AdminClientSecret"];

    var client = httpClientFactory.CreateClient("KeycloakAdmin");

    // Get admin token
    var tokenEndpoint = $"{keycloakUrl}/protocol/openid-connect/token";
    var tokenRequest = new FormUrlEncodedContent(new Dictionary<string, string>
    {
        ["grant_type"] = "client_credentials",
        ["client_id"] = adminClientId,
        ["client_secret"] = adminClientSecret ?? ""
    });

    var tokenResponse = await client.PostAsync(tokenEndpoint, tokenRequest);
    if (!tokenResponse.IsSuccessStatusCode)
    {
        return Results.Problem("Failed to authenticate with identity provider", statusCode: 500);
    }

    var tokenJson = await tokenResponse.Content.ReadFromJsonAsync<JsonElement>();
    var accessToken = tokenJson.GetProperty("access_token").GetString();

    var adminUrl = keycloakUrl.Replace($"/realms/{realm}", "");
    var userEndpoint = $"{adminUrl}/admin/realms/{realm}/users/{userId}";

    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
    var userResponse = await client.GetAsync(userEndpoint);

    if (!userResponse.IsSuccessStatusCode)
    {
        return Results.Problem("Failed to fetch user profile", statusCode: (int)userResponse.StatusCode);
    }

    var user = await userResponse.Content.ReadFromJsonAsync<KeycloakUser>();
    if (user == null)
    {
        return Results.NotFound();
    }

    var fullName = $"{user.FirstName} {user.LastName}".Trim();
    // Shown as the country writes it, whatever shape an older version stored it in
    var stored = user.Attributes?.GetValueOrDefault("phoneNumber")?.FirstOrDefault();
    var phoneNumber = string.IsNullOrWhiteSpace(stored) ? stored : PhoneRules.Normalize(stored, country.Code);
    // First and last name both, and a phone that is one here: an Apple account (a name only on the very first
    // sign-in, none through the browser) is asked for what it lacks, and a customer whose number is not a
    // number here is asked for it again
    var isProfileComplete = PersonName.Complete(user.FirstName, user.LastName) && PhoneRules.IsValid(phoneNumber, country.Code);

    return Results.Ok(new
    {
        name = fullName,
        firstName = user.FirstName,
        lastName = user.LastName,
        email = CounterCustomer.VisibleEmail(user.Email),
        phoneNumber = phoneNumber,
        branches = BranchesOf(user.Attributes),
        isProfileComplete = isProfileComplete
    });
}).RequireAuthorization();

// Branch ids from the `branches` user attribute (strings on the wire)
static List<int> BranchesOf(Dictionary<string, string[]>? attributes) => UserAttributes.BranchesOf(attributes);

// "Admin" or "Admin,Owner,Cashier"
static string[] SplitRoles(string? roles) =>
    (roles ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

app.MapCounterCustomers();

app.Run();

/// <summary>A phone a customer or a cashier sent, read the one way the country writes it.</summary>
static class PhoneInput
{
    /// <summary>
    /// Nothing sent reads as no phone; anything else is normalized (+20 10…, 10…, ٠١٠… → 010…) and must
    /// then be a number here, or the request is answered with why.
    /// </summary>
    public static bool TryRead(string? sent, TenantCountry country, out string? phone, out IResult problem)
    {
        problem = Results.Empty;
        phone = null;
        if (string.IsNullOrWhiteSpace(sent)) return true;
        phone = PhoneRules.Normalize(sent, country.Code);
        if (PhoneRules.IsValid(phone, country.Code)) return true;
        problem = Results.BadRequest(new { message = "That is not a phone number here", field = "phoneNumber", placeholder = PhoneRules.For(country.Code).Placeholder });
        return false;
    }
}

/// <param name="Name">An older app's one name; FirstName and LastName win when given.</param>
record RegisterRequest(string? Name, string Email, string Password, string? PhoneNumber, string? FirstName = null, string? LastName = null);
record RegisterAdminRequest(string? Name, string Email, string Password, bool IsOwner = false, string? Role = "Admin", List<int>? BranchIds = null);
record SetBranchesRequest(List<int> BranchIds);
record ChangePasswordRequest(string NewPassword);
record UpdateEmailRequest(string NewEmail);
record UpdateNameRequest(string? NewName, string? FirstName = null, string? LastName = null);
/// <param name="Name">An older app's one name; FirstName and LastName win when given.</param>
record UpdateProfileRequest(string? Name, string? PhoneNumber, string? FirstName = null, string? LastName = null);

/// <param name="AddedAtCounter">Added at the till by name and phone and not yet claimed by its customer: no email, no password, a "Send app link" away from being theirs.</param>
record UserDto(
    string Id,
    string? Username,
    string? Email,
    string? FirstName,
    string? LastName,
    bool Enabled,
    long? CreatedTimestamp,
    List<string> RealmRoles,
    string? PhoneNumber,
    List<int> Branches,
    bool AddedAtCounter = false
)
{
    public static UserDto From(DirectoryUser user) => new(
        user.Id,
        user.Username,
        user.Email,
        user.FirstName,
        user.LastName,
        user.Enabled,
        user.CreatedTimestamp,
        user.RealmRoles.ToList(),
        user.PhoneNumber,
        user.Branches.ToList(),
        user.AddedAtCounter);
}

// Keycloak user model for deserialization
class KeycloakUser
{
    public string Id { get; set; } = "";
    public string? Username { get; set; }
    public string? Email { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public bool Enabled { get; set; }
    public long? CreatedTimestamp { get; set; }
    public Dictionary<string, string[]>? Attributes { get; set; }
}

// Keycloak role model for deserialization
class KeycloakRole
{
    public string? Id { get; set; }
    public string? Name { get; set; }
}

// JSON serialization context for integration events
[JsonSerializable(typeof(UserProfileUpdatedIntegrationEvent))]
[JsonSerializable(typeof(StaffAccountChangedIntegrationEvent))]
partial class IdentityIntegrationEventContext : JsonSerializerContext
{
}
