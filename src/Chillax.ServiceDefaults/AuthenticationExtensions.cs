using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Chillax.ServiceDefaults;

public static class AuthenticationExtensions
{
    /// <summary>
    /// Adds Keycloak JWT Bearer authentication using Aspire service discovery.
    /// Requires Keycloak to have a "User Realm Role" mapper that maps roles to "role" claim.
    /// </summary>
    public static IServiceCollection AddDefaultAuthentication(this IHostApplicationBuilder builder)
    {
        var services = builder.Services;
        var configuration = builder.Configuration;

        // Get Keycloak configuration from environment variables (set by Aspire)
        // Note: env vars with __ are converted to : by ASP.NET Core configuration
        var identitySection = configuration.GetSection("Identity");
        var keycloakRealmUrl = identitySection["Url"];
        var realm = configuration.GetSection("Keycloak")["Realm"] ?? "chillax";

        // Check if Keycloak is configured
        if (string.IsNullOrEmpty(keycloakRealmUrl))
        {
            // No Keycloak URL, but still register auth/authorization services
            // so UseAuthorization() doesn't fail (e.g. during Docker build)
            services.AddAuthentication();
            services.AddAuthorization();
            return services;
        }

        // Prevent mapping "sub" claim to nameidentifier
        JsonWebTokenHandler.DefaultInboundClaimTypeMap.Remove("sub");

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.Authority = keycloakRealmUrl;
                options.RequireHttpsMetadata = false;

                // Don't remap claim names - keep original JWT claim names
                options.MapInboundClaims = false;

                // Validate issuer by checking it ends with the expected realm path.
                // The token signature (via JWKS) already proves it came from our Keycloak,
                // so we just verify the realm matches regardless of hostname/IP.
                var expectedRealmSuffix = $"/realms/{realm}";

                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    IssuerValidator = (issuer, _, _) =>
                    {
                        if (issuer.EndsWith(expectedRealmSuffix, StringComparison.OrdinalIgnoreCase))
                            return issuer;
                        throw new SecurityTokenInvalidIssuerException($"Invalid issuer: {issuer}");
                    },

                    // Disable audience validation for flexibility
                    // Keycloak uses client_id as audience
                    ValidateAudience = false,

                    // Use "role" claim for roles (requires Keycloak mapper)
                    RoleClaimType = "role"
                };

                // Browser SignalR transports (WebSocket/SSE) cannot send an
                // Authorization header — the JS client passes the token in the
                // query string for hub endpoints. Native clients still use the
                // header, which takes precedence when present.
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];
                        if (!string.IsNullOrEmpty(accessToken) &&
                            context.HttpContext.Request.Path.StartsWithSegments("/hub"))
                        {
                            context.Token = accessToken;
                        }
                        return Task.CompletedTask;
                    }
                };
            });

        services.AddAuthorization(options =>
        {
            // Admin policy requires the "Admin" role
            options.AddPolicy("Admin", policy => policy.RequireRole("Admin"));
            // Owner policy requires the "Owner" role (branch management, admin creation)
            options.AddPolicy("Owner", policy => policy.RequireRole("Owner"));
            // Pos policy: what the till needs. Cashiers run sales, tickets and
            // shifts without carrying the full back-office Admin role.
            options.AddPolicy("Pos", policy => policy.RequireRole("Admin", "Owner", "Cashier"));
        });

        return services;
    }
}
