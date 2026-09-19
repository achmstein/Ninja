namespace Microsoft.Extensions.Configuration;

/// <summary>
/// What a fresh database is planted with. Read from <c>Seed:Profile</c>
/// (env <c>Seed__Profile</c>): <see cref="None"/> leaves the menu, places
/// and branches for the owner to create (a customer's stack); <see cref="Sample"/>
/// plants a small generic café so a demo looks alive; <see cref="Chillax"/>
/// is tenant one's own data, used by the dev AppHost and the E2E suite.
/// A profile only ever fills an empty table; it never touches data that exists.
/// </summary>
internal static class SeedProfile
{
    public const string None = "none";
    public const string Sample = "sample";
    public const string Chillax = "chillax";

    public static string Of(IConfiguration configuration)
        => (configuration["Seed:Profile"] ?? None).Trim().ToLowerInvariant() switch
        {
            Sample => Sample,
            Chillax => Chillax,
            _ => None,
        };
}
