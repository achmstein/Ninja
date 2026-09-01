namespace Chillax.Ordering.UnitTests.Domain;

using Chillax.Ordering.Domain.AggregatesModel.OrderAggregate;
using Chillax.Ordering.Domain.Seedwork;

/// <summary>
/// Unit tests for Order aggregate.
/// Simplified for cafe - no address or payment details.
/// </summary>
[TestClass]
public class OrderAggregateTest
{
    public OrderAggregateTest()
    { }

    [TestMethod]
    public void Create_order_item_success()
    {
        // Arrange
        var productId = 1;
        var productName = new LocalizedText("FakeProductName");
        var unitPrice = 12;
        var discount = 15;
        var pictureUrl = "FakeUrl";
        var units = 5;

        // Act
        var fakeOrderItem = new OrderItem(productId, productName, unitPrice, discount, pictureUrl, units);

        // Assert
        Assert.IsNotNull(fakeOrderItem);
    }

    [TestMethod]
    public void Invalid_number_of_units()
    {
        // Arrange
        var productId = 1;
        var productName = new LocalizedText("FakeProductName");
        var unitPrice = 12;
        var discount = 15;
        var pictureUrl = "FakeUrl";
        var units = -1;

        // Act - Assert
        Assert.ThrowsExactly<OrderingDomainException>(() => new OrderItem(productId, productName, unitPrice, discount, pictureUrl, units));
    }

    [TestMethod]
    public void Invalid_total_of_order_item_lower_than_discount_applied()
    {
        // Arrange
        var productId = 1;
        var productName = new LocalizedText("FakeProductName");
        var unitPrice = 12;
        var discount = 15;
        var pictureUrl = "FakeUrl";
        var units = 1;

        // Act - Assert
        Assert.ThrowsExactly<OrderingDomainException>(() => new OrderItem(productId, productName, unitPrice, discount, pictureUrl, units));
    }

    [TestMethod]
    public void Invalid_discount_setting()
    {
        // Arrange
        var productId = 1;
        var productName = new LocalizedText("FakeProductName");
        var unitPrice = 12;
        var discount = 15;
        var pictureUrl = "FakeUrl";
        var units = 5;

        // Act
        var fakeOrderItem = new OrderItem(productId, productName, unitPrice, discount, pictureUrl, units);

        // Assert
        Assert.ThrowsExactly<OrderingDomainException>(() => fakeOrderItem.SetNewDiscount(-1));
    }

    [TestMethod]
    public void Invalid_units_setting()
    {
        // Arrange
        var productId = 1;
        var productName = new LocalizedText("FakeProductName");
        var unitPrice = 12;
        var discount = 15;
        var pictureUrl = "FakeUrl";
        var units = 5;

        // Act
        var fakeOrderItem = new OrderItem(productId, productName, unitPrice, discount, pictureUrl, units);

        // Assert
        Assert.ThrowsExactly<OrderingDomainException>(() => fakeOrderItem.AddUnits(-1));
    }

    [TestMethod]
    public void When_add_two_times_on_the_same_item_then_the_total_of_order_should_be_the_sum_of_the_two_items()
    {
        var order = new OrderBuilder()
            .AddOne(1, "cup", 10.0m, 0, string.Empty)
            .AddOne(1, "cup", 10.0m, 0, string.Empty)
            .Build();

        Assert.AreEqual(20.0m, order.GetTotal());
    }

    [TestMethod]
    public void Add_new_Order_raises_new_event()
    {
        // Arrange
        var userId = "1";
        var userName = "fakeName";
        var roomName = "VIP";
        var customerNote = "No sugar please";
        var expectedResult = 1;

        // Act
        var fakeOrder = new Order(userId, userName, 1, roomName, customerNote);

        // Assert
        Assert.HasCount(expectedResult, fakeOrder.DomainEvents);
    }

    [TestMethod]
    public void Add_event_Order_explicitly_raises_new_event()
    {
        // Arrange
        var userId = "1";
        var userName = "fakeName";
        var roomName = "VIP";
        var expectedResult = 2;

        // Act
        var fakeOrder = new Order(userId, userName, 1, roomName);
        fakeOrder.AddDomainEvent(new OrderStartedDomainEvent(fakeOrder, userId, userName));

        // Assert
        Assert.HasCount(expectedResult, fakeOrder.DomainEvents);
    }

    [TestMethod]
    public void Remove_event_Order_explicitly()
    {
        // Arrange
        var userId = "1";
        var userName = "fakeName";
        var fakeOrder = new Order(userId, userName, 1);
        var @fakeEvent = new OrderStartedDomainEvent(fakeOrder, userId, userName);
        var expectedResult = 1;

        // Act
        fakeOrder.AddDomainEvent(@fakeEvent);
        fakeOrder.RemoveDomainEvent(@fakeEvent);

        // Assert
        Assert.HasCount(expectedResult, fakeOrder.DomainEvents);
    }

    [TestMethod]
    public void Order_status_transitions_correctly()
    {
        // Arrange
        var order = new Order("userId", "userName", 1, roomName: "Room 1");

        // Assert initial status
        Assert.AreEqual(OrderStatus.AwaitingValidation, order.OrderStatus);

        // Act - Move to submitted then confirm
        order.SetStockConfirmedStatus();
        order.SetConfirmedStatus();

        // Assert confirmed status
        Assert.AreEqual(OrderStatus.Confirmed, order.OrderStatus);
    }

    [TestMethod]
    public void Order_can_be_cancelled_when_submitted()
    {
        // Arrange
        var order = new Order("userId", "userName", 1, roomName: "Room 1");
        order.SetStockConfirmedStatus();

        // Act
        order.SetCancelledStatus();

        // Assert
        Assert.AreEqual(OrderStatus.Cancelled, order.OrderStatus);
    }

    [TestMethod]
    public void Order_cannot_be_cancelled_when_confirmed()
    {
        // Arrange
        var order = new Order("userId", "userName", 1, roomName: "Room 1");
        order.SetStockConfirmedStatus();
        order.SetConfirmedStatus();

        // Act - Assert
        Assert.ThrowsExactly<OrderingDomainException>(() => order.SetCancelledStatus());
    }

    [TestMethod]
    public void Order_cannot_be_confirmed_when_cancelled()
    {
        // Arrange
        var order = new Order("userId", "userName", 1, roomName: "Room 1");
        order.SetStockConfirmedStatus();
        order.SetCancelledStatus();

        // Act - Assert
        Assert.ThrowsExactly<OrderingDomainException>(() => order.SetConfirmedStatus());
    }

    [TestMethod]
    public void Order_keeps_the_table_it_was_placed_from()
    {
        // Arrange
        var tableName = new LocalizedText("Table 3", "ترابيزة 3");

        // Act
        var order = new Order("userId", "userName", 1, tableId: 3, tableName: tableName);

        // Assert
        Assert.AreEqual(3, order.TableId);
        Assert.AreEqual("Table 3", order.TableName?.En);
        Assert.AreEqual("ترابيزة 3", order.TableName?.Ar);
        Assert.IsNull(order.RoomName);
    }

    [TestMethod]
    public void Order_placed_from_a_room_has_no_table()
    {
        // Act
        var order = new Order("userId", "userName", 1, roomName: "Room 1");

        // Assert
        Assert.IsNull(order.TableId);
        Assert.IsNull(order.TableName);
        Assert.AreEqual("Room 1", order.RoomName?.En);
    }

    [TestMethod]
    public void Guest_order_at_a_table_is_valid()
    {
        // Act
        var order = NewGuestOrder(tableId: 3);

        // Assert
        Assert.IsTrue(order.IsGuestOrder);
        Assert.IsTrue(order.HasDestination);
        Assert.AreEqual("Nadia", order.GuestName);
        Assert.IsNull(order.BuyerId);
    }

    [TestMethod]
    public void Guest_order_in_a_room_is_valid()
    {
        // Act
        var order = NewGuestOrder(roomName: "Room 1");

        // Assert
        Assert.IsTrue(order.HasDestination);
    }

    [TestMethod]
    public void Guest_order_without_a_destination_is_refused()
    {
        // A guest order with nowhere to go is an order-ahead, and there is no
        // account behind it to hold anyone to collecting it
        Assert.ThrowsExactly<OrderingDomainException>(() => NewGuestOrder());
    }

    [TestMethod]
    public void Signed_in_order_without_a_destination_is_allowed()
    {
        // The gate is on guests only — an account holder stays accountable
        // wherever they order from, which is what takeaway will rest on
        var order = new Order("userId", "userName", 1);

        // Assert
        Assert.IsFalse(order.HasDestination);
        Assert.IsFalse(order.IsGuestOrder);
    }

    [TestMethod]
    public void Guest_order_without_contact_details_is_refused()
    {
        Assert.ThrowsExactly<OrderingDomainException>(
            () => NewGuestOrder(tableId: 3, guestName: null));
        Assert.ThrowsExactly<OrderingDomainException>(
            () => NewGuestOrder(tableId: 3, guestPhone: null));
        Assert.ThrowsExactly<OrderingDomainException>(
            () => NewGuestOrder(tableId: 3, guestId: null));
    }

    private static Order NewGuestOrder(
        int? tableId = null,
        LocalizedText? roomName = null,
        string? guestId = "guest-1",
        string? guestName = "Nadia",
        string? guestPhone = "01012345678") =>
        new(
            userId: string.Empty,
            userName: string.Empty,
            branchId: 1,
            roomName: roomName,
            tableId: tableId,
            tableName: tableId is null ? null : new LocalizedText("Table 3"),
            guestId: guestId,
            guestName: guestName,
            guestPhone: guestPhone);
}
