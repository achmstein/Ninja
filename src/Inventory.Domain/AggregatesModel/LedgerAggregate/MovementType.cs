namespace Chillax.Inventory.Domain.AggregatesModel.LedgerAggregate;

/// <summary>Why stock moved. Stored as text.</summary>
public enum MovementType
{
    /// <summary>Received from a supplier (a <see cref="PurchaseAggregate.Purchase"/> line).</summary>
    Purchase,
    /// <summary>Consumed by a confirmed order, through the item's recipe.</summary>
    Sale,
    /// <summary>Thrown away, spilled, expired.</summary>
    Waste,
    /// <summary>Corrected to a physical count (a <see cref="StockCountAggregate.StockCount"/> line).</summary>
    Count,
    /// <summary>Any other correction: opening stock, a return to the shelf, a keying error.</summary>
    Adjustment,
    /// <summary>Sent to another branch (a <see cref="TransferAggregate.Transfer"/> line, source side).</summary>
    TransferOut,
    /// <summary>Received from another branch (the same line, destination side).</summary>
    TransferIn,
}
