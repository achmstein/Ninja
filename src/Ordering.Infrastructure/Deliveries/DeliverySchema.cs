namespace Ninja.Ordering.Infrastructure.Deliveries;

/// <summary>
/// The delivery module's own tables (its riders, their check-ins, the
/// customers' saved addresses) sit in a schema of their own, beside
/// Ordering's: the module's edge in the database as in the code.
/// </summary>
public static class DeliverySchema
{
    public const string Name = "delivery";
}
