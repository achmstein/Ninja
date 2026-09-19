namespace Ninja.Ordering.UnitTests.Domain;

/// <summary>
/// Unit tests for Buyer aggregate.
/// Simplified for cafe - no payment methods.
/// </summary>
[TestClass]
public class BuyerAggregateTest
{
    public BuyerAggregateTest()
    { }

    [TestMethod]
    public void Create_buyer_item_success()
    {
        // Arrange
        var identity = Guid.NewGuid().ToString();
        var name = "fakeUser";

        // Act
        var fakeBuyerItem = new Buyer(identity, name);

        // Assert
        Assert.IsNotNull(fakeBuyerItem);
        Assert.AreEqual(identity, fakeBuyerItem.IdentityGuid);
        Assert.AreEqual(name, fakeBuyerItem.Name);
    }

    [TestMethod]
    public void Create_buyer_item_fail_empty_identity()
    {
        // Arrange
        var identity = string.Empty;
        var name = "fakeUser";

        // Act - Assert
        Assert.ThrowsExactly<ArgumentNullException>(() => new Buyer(identity, name));
    }

    [TestMethod]
    public void Create_buyer_item_fail_null_identity()
    {
        // Arrange
        string? identity = null;
        var name = "fakeUser";

        // Act - Assert
        Assert.ThrowsExactly<ArgumentNullException>(() => new Buyer(identity!, name));
    }
}
