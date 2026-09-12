namespace Chillax.Inventory.UnitTests.Domain;

using Chillax.Inventory.Domain.AggregatesModel.TransferAggregate;
using Chillax.Inventory.Domain.Exceptions;

[TestClass]
public class TransferTest
{
    [TestMethod]
    public void A_transfer_goes_between_two_different_branches_with_each_item_once()
    {
        var transfer = Transfer.Send(1, 2, " to the new place ", [new TransferLine(5, 24), new TransferLine(6, 1000)], "owner");

        Assert.AreEqual(1, transfer.FromBranchId);
        Assert.AreEqual(2, transfer.ToBranchId);
        Assert.AreEqual("to the new place", transfer.Note);
        Assert.AreEqual(2, transfer.Lines.Count);

        Assert.ThrowsExactly<InventoryDomainException>(() => Transfer.Send(1, 1, null, [new TransferLine(5, 1)], "owner"));
        Assert.ThrowsExactly<InventoryDomainException>(() => Transfer.Send(1, 2, null, [], "owner"));
        Assert.ThrowsExactly<InventoryDomainException>(() => Transfer.Send(1, 2, null, [new TransferLine(5, 1), new TransferLine(5, 2)], "owner"));
        Assert.ThrowsExactly<InventoryDomainException>(() => new TransferLine(5, 0));
    }
}
