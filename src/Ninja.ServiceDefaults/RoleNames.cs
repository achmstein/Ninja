namespace Ninja.ServiceDefaults;

/// <summary>
/// The realm roles the platform's services, the control plane and the realm
/// templates speak of: one spelling for every policy, every check and every
/// realm that is brought up to date.
/// </summary>
public static class RoleNames
{
    /// <summary>The back office.</summary>
    public const string Admin = "Admin";

    /// <summary>An Admin who owns the business: branches, staff, money.</summary>
    public const string Owner = "Owner";

    /// <summary>Runs the till: sales, tickets, shifts, without the back office.</summary>
    public const string Cashier = "Cashier";

    /// <summary>A kitchen display's own account: the board and its printers.</summary>
    public const string Kitchen = "Kitchen";

    /// <summary>Delivers the branch's own orders: the deliveries given to them, nothing else.</summary>
    public const string Rider = "Rider";

    /// <summary>Every role a staff account may hold.</summary>
    public static readonly string[] Staff = [Admin, Owner, Cashier, Kitchen, Rider];

    /// <summary>The roles a staff account is created with (an Owner is an Admin made one).</summary>
    public static readonly string[] Creatable = [Admin, Cashier, Kitchen, Rider];

    /// <summary>
    /// The staff roles every tenant realm carries beyond Keycloak's own, with
    /// the description an operator sees in the admin console. Admin and Owner
    /// come with the realm template; these are the ones added since, which a
    /// realm made before them gains when it is brought up to date.
    /// </summary>
    public static readonly IReadOnlyList<(string Name, string Description)> RealmStaffRoles =
    [
        (Cashier, "Cashier role - runs the POS (sales, tickets, shifts) without back-office access"),
        (Kitchen, "Kitchen role - a kitchen display or print host: the board, ready, and the kitchen's printers, nothing else"),
        (Rider, "Rider role - delivers the branch's own orders: the deliveries assigned to them, on the way and delivered, nothing else"),
    ];
}
