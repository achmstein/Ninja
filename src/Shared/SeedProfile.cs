namespace Microsoft.Extensions.Configuration;

/// <summary>
/// What a fresh database is planted with. Read from <c>Seed:Profile</c>
/// (env <c>Seed__Profile</c>): <see cref="None"/> leaves the menu, places
/// and branches for the owner to create (a customer's stack); <see cref="Sample"/>
/// plants a small place of the stack's kind (<see cref="Business"/>) so a
/// demo looks alive; <see cref="Chillax"/>
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

    public const string CoffeeShop = "coffee_shop";
    public const string Restaurant = "restaurant";
    public const string GameStation = "game_station";
    public const string CloudKitchen = "cloud_kitchen";
    public const string Other = "other";

    /// <summary>
    /// The kind of place, as the control plane spells it on the stack
    /// (<c>Tenant:BusinessType</c>, env <c>Tenant__BusinessType</c>): what the
    /// <see cref="Sample"/> profile plants. Unknown or missing reads as
    /// <see cref="Other"/>, the generic café.
    /// </summary>
    public static string Business(IConfiguration configuration)
        => (configuration["Tenant:BusinessType"] ?? Other).Trim().ToLowerInvariant() switch
        {
            CoffeeShop => CoffeeShop,
            Restaurant => Restaurant,
            GameStation => GameStation,
            CloudKitchen => CloudKitchen,
            _ => Other,
        };
}
