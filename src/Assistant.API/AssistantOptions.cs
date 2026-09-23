namespace Ninja.Assistant.API;

/// <summary>
/// What the MCP server tells chat apps about itself, and how it turns their
/// token into one of its own. The two URLs are the PUBLIC ones a chat app
/// sees: the endpoint exactly as an owner types it into a connector, and the
/// realm's issuer as it appears in the token's <c>iss</c> claim. Identity:Url
/// (in-network) stays what the JWT handler and the token exchange call.
/// </summary>
public sealed class AssistantOptions
{
    public const string SectionName = "Assistant";

    /// <summary>The canonical MCP URL, e.g. https://api.chillax.site/mcp. Protected resource metadata names it, and every token must carry it (or the exchange client) as an audience.</summary>
    public string PublicUrl { get; set; } = "";

    /// <summary>The realm's public issuer, e.g. https://auth.chillax.site/realms/chillax: where a chat app sends the owner to sign in.</summary>
    public string Issuer { get; set; } = "";

    /// <summary>The scope a chat app asks for; the realm's "mcp" client scope carries the audience.</summary>
    public string[] ScopesSupported { get; set; } = ["mcp"];

    public TokenExchangeOptions TokenExchange { get; set; } = new();

    public Uri PublicUri => new(PublicUrl, UriKind.Absolute);

    /// <summary>RFC 9728's path-aware document: https://api.chillax.site/.well-known/oauth-protected-resource/mcp.</summary>
    public Uri ResourceMetadataUri
    {
        get
        {
            var u = PublicUri;
            return new Uri($"{u.GetLeftPart(UriPartial.Authority)}/.well-known/oauth-protected-resource{u.AbsolutePath.TrimEnd('/')}", UriKind.Absolute);
        }
    }
}

/// <summary>RFC 8693 standard token exchange against the realm: the chat app's token (audience: this client) becomes the service's own token for the same owner.</summary>
public sealed class TokenExchangeOptions
{
    /// <summary>Off only for a bench without Keycloak; a stamp always exchanges.</summary>
    public bool Enabled { get; set; } = true;

    public string ClientId { get; set; } = "assistant-api";

    public string ClientSecret { get; set; } = "";
}
