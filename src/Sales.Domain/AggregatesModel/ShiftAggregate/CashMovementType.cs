namespace Ninja.Sales.Domain.AggregatesModel.ShiftAggregate;

public enum CashMovementType
{
    /// <summary>Cash added to the drawer outside a sale (e.g. topping up change).</summary>
    PayIn = 0,

    /// <summary>Cash taken out of the drawer (e.g. paying a supplier).</summary>
    PayOut = 1,
}
