using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using ModelContextProtocol;
using ModelContextProtocol.AspNetCore.Authentication;
using ModelContextProtocol.Authentication;
using Ninja.Assistant.API;
using Ninja.Assistant.API.Auth;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;
using Ninja.ServiceDefaults;

// The owner's MCP server. A chat app (Claude, ChatGPT, Claude Code) reaches
// it at api.<tenant>/mcp through the BFF, signs the owner in at the realm
// (RFC 9728 metadata below says where), and calls tools that read and, on
// the owner's say-so, write through the other services. Every request needs
// a token minted for this endpoint; the services never see that token, only
// the one this service exchanges it for.

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.AddDefaultAuthentication();
builder.Services.AddProblemDetails();
builder.Services.AddHttpContextAccessor();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton(TimeProvider.System);

builder.Services.AddOptions<AssistantOptions>()
    .Bind(builder.Configuration.GetSection(AssistantOptions.SectionName))
    .Validate(o => Uri.TryCreate(o.PublicUrl, UriKind.Absolute, out _), "Assistant:PublicUrl must be an absolute URL, e.g. https://api.chillax.site/mcp")
    .Validate(o => Uri.TryCreate(o.Issuer, UriKind.Absolute, out _), "Assistant:Issuer must be the realm's public issuer URL")
    .Validate(o => !o.TokenExchange.Enabled || !string.IsNullOrWhiteSpace(o.TokenExchange.ClientSecret), "Assistant:TokenExchange:ClientSecret is required while token exchange is on")
    .ValidateOnStart();

var assistant = builder.Configuration.GetSection(AssistantOptions.SectionName).Get<AssistantOptions>() ?? new AssistantOptions();
var identityConfigured = !string.IsNullOrEmpty(builder.Configuration["Identity:Url"]);

// Behind the BFF (and Caddy in front of it) the public scheme and host arrive
// as X-Forwarded-*; the challenge header and the metadata document carry them.
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});

if (identityConfigured)
{
    // Unlike the other services, this one insists the token was minted for
    // it: the realm's "mcp" client scope puts the public URL and the exchange
    // client in aud, so a till or admin-panel token is refused here.
    builder.Services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, o =>
    {
        o.TokenValidationParameters.ValidateAudience = true;
        o.TokenValidationParameters.ValidAudiences = [assistant.PublicUrl, assistant.TokenExchange.ClientId];
    });

    // Authenticate with JwtBearer (the default scheme AddDefaultAuthentication
    // set); challenge with the MCP handler, which answers 401 with
    // WWW-Authenticate: Bearer resource_metadata="..." so a chat app finds the realm.
    builder.Services.AddAuthentication(o =>
        {
            o.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            o.DefaultChallengeScheme = McpAuthenticationDefaults.AuthenticationScheme;
        })
        .AddMcp(o =>
        {
            o.ResourceMetadataUri = assistant.ResourceMetadataUri;
            o.ResourceMetadata = ProtectedResource(assistant);
        });
}

builder.Services.AddHttpClient(NinjaApiClient.HttpClientName);
builder.Services.AddHttpClient(TokenExchanger.HttpClientName);
builder.Services.AddScoped<TokenExchanger>();
builder.Services.AddScoped<NinjaApiClient>();
builder.Services.AddSingleton<Ninja.Assistant.API.Context.Persona>();
builder.Services.AddScoped<TenantContext>();
builder.Services.AddSingleton<AuditLog>();

builder.Services.AddMcpServer(o =>
    {
        o.ServerInfo = new() { Name = "ninja", Version = "1.0" };
        // The brief as the platform writes it; each connecting chat gets the café's own (Persona)
        o.ServerInstructions = Ninja.Assistant.API.Context.Persona.Write(null, null);
    })
    .WithHttpTransport(o =>
    {
        o.Stateless = true;
        // The café's name and the owner's settings for their assistant, as each chat connects
        o.ConfigureSessionOptions = async (http, options, ct) =>
            options.ServerInstructions = await http.RequestServices.GetRequiredService<Ninja.Assistant.API.Context.Persona>().InstructionsAsync(ct);
    })
    .WithToolsFromAssembly()
    .WithPromptsFromAssembly();

var app = builder.Build();

app.UseForwardedHeaders();
app.MapDefaultEndpoints();
app.UseAuthentication();
app.UseAuthorization();

// RFC 9728: the document a chat app reads to learn which realm signs owners
// in. The MCP handler serves it too; this route answers whatever the request
// looked like on its way through the proxies.
app.MapGet("/.well-known/oauth-protected-resource/{**path}", () => Results.Json(ProtectedResource(assistant), McpJsonUtilities.DefaultOptions))
    .AllowAnonymous();

var mcp = app.MapMcp("/mcp");
if (identityConfigured)
    mcp.RequireAuthorization("Owner");

app.Run();

static ProtectedResourceMetadata ProtectedResource(AssistantOptions assistant) => new()
{
    Resource = assistant.PublicUri.ToString().TrimEnd('/'),
    AuthorizationServers = { new Uri(assistant.Issuer, UriKind.Absolute).ToString().TrimEnd('/') },
    ScopesSupported = [.. assistant.ScopesSupported],
    BearerMethodsSupported = ["header"],
    ResourceName = "Ninja cafe back office",
};
