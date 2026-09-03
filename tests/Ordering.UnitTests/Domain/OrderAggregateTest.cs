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

    [TestMethod]
    public void Total_is_net_of_line_discounts_and_loyalty_discount()
    {
        // 2 × 50 − 10 line discount = 90, minus 25 EGP loyalty = 65
        var order = new Order("user-1", "Nadia", branchId: 1, pointsToRedeem: 2500, loyaltyDiscount: 25);
        order.AddOrderItem(1, new LocalizedText("Latte"), unitPrice: 50, discount: 10, pictureUrl: null, units: 2);

        Assert.AreEqual(90m, order.GetItemsTotal());
        Assert.AreEqual(65m, order.GetTotal());
    }

    [TestMethod]
    public void Total_never_goes_negative()
    {
        var order = new Order("user-1", "Nadia", branchId: 1, loyaltyDiscount: 500);
        order.AddOrderItem(1, new LocalizedText("Latte"), unitPrice: 50, discount: 0, pictureUrl: null, units: 1);

        Assert.AreEqual(0m, order.GetTotal());
    }

    [TestMethod]
    public void Loyalty_discount_derives_from_points_at_the_fixed_rate()
    {
        // 100 points = 1 EGP
        Assert.AreEqual(25d, Order.GetLoyaltyDiscountFor(pointsToRedeem: 2500, itemsTotal: 90m));
    }

    [TestMethod]
    public void Loyalty_discount_is_capped_at_the_items_total()
    {
        Assert.AreEqual(90d, Order.GetLoyaltyDiscountFor(pointsToRedeem: 100_000, itemsTotal: 90m));
    }

    [TestMethod]
    public void Loyalty_discount_ignores_negative_points()
    {
        Assert.AreEqual(0d, Order.GetLoyaltyDiscountFor(pointsToRedeem: -500, itemsTotal: 90m));
    }

    [TestMethod]
    public void Source_derives_from_identity_when_not_stated()
    {
        var customerOrder = new Order("user-1", "Nadia", branchId: 1);
        var guestOrder = NewGuestOrder(tableId: 3);

        Assert.AreEqual(OrderSource.Customer, customerOrder.Source);
        Assert.AreEqual(OrderSource.Guest, guestOrder.Source);
    }

    [TestMethod]
    public void Pos_order_needs_no_identity_contact_or_destination()
    {
        // A walk-in counter sale: nobody signed in, nothing to deliver to —
        // the cashier keying it in is the contact
        var order = new Order(string.Empty, string.Empty, branchId: 1, source: OrderSource.Pos);

        Assert.AreEqual(OrderSource.Pos, order.Source);
        Assert.IsFalse(order.IsGuestOrder);
        Assert.IsNull(order.GuestId);
    }

    [TestMethod]
    public void Order_carries_its_session_and_room_ids()
    {
        var order = new Order("user-1", "Nadia", branchId: 1,
            roomName: new LocalizedText("VIP"), sessionId: 42, roomId: 7);

        Assert.AreEqual(42, order.SessionId);
        Assert.AreEqual(7, order.RoomId);
    }

    [TestMethod]
    public void Assigning_a_customer_after_the_fact_names_the_order_and_raises_the_event()
    {
        // Arrange - a walk-in the till forgot to attach anyone to
        var order = new Order(string.Empty, string.Empty, branchId: 1, source: OrderSource.Pos);
        order.ClearDomainEvents();
        var buyer = new Buyer("u1", "Nadia");

        // Act
        order.AssignCustomer(" Nadia ", buyer);

        // Assert - the name travels like the POS constructor's, the account becomes the buyer
        Assert.AreEqual("Nadia", order.GuestName);
        Assert.AreEqual(buyer.Id, order.BuyerId);
        var raised = order.DomainEvents.OfType<OrderCustomerAssignedDomainEvent>().Single();
        Assert.AreEqual("u1", raised.BuyerIdentityGuid);
    }

    [TestMethod]
    public void Moving_an_order_to_another_account_names_the_account_it_left()
    {
        // Arrange - a regular's order rung up on the wrong regular
        var order = new Order(string.Empty, string.Empty, branchId: 1, source: OrderSource.Pos);
        order.SetBuyerId(7);
        order.ClearDomainEvents();
        var sara = new Buyer("u2", "Sara");

        // Act - the caller resolves the identity behind the row id
        order.AssignCustomer("Sara", sara, previousBuyerIdentityGuid: "u1");

        // Assert - Loyalty hears who lost the points as well as who gained them
        Assert.AreEqual("Sara", order.GuestName);
        Assert.AreEqual(sara.Id, order.BuyerId);
        var raised = order.DomainEvents.OfType<OrderCustomerAssignedDomainEvent>().Single();
        Assert.AreEqual("u2", raised.BuyerIdentityGuid);
        Assert.AreEqual("u1", raised.PreviousBuyerIdentityGuid);
    }

    [TestMethod]
    public void An_order_is_not_moved_to_the_account_it_already_has_or_stripped_to_a_bare_name()
    {
        var owned = new Order(string.Empty, string.Empty, branchId: 1, source: OrderSource.Pos);
        owned.SetBuyerId(7);
        owned.ClearDomainEvents();

        // The same account again is a no-op dressed up as a change
        Assert.ThrowsExactly<OrderingDomainException>(() =>
            owned.AssignCustomer("Nadia", new Buyer("u1", "Nadia"), previousBuyerIdentityGuid: "u1"));

        // An account moves to another account, never off: the points would have nowhere to go
        Assert.ThrowsExactly<OrderingDomainException>(() => owned.AssignCustomer("Nadia"));

        Assert.AreEqual(7, owned.BuyerId);
        Assert.IsFalse(owned.DomainEvents.OfType<OrderCustomerAssignedDomainEvent>().Any());
    }

    [TestMethod]
    public void A_customer_cannot_be_assigned_to_a_cancelled_order_or_without_a_name()
    {
        var cancelled = new Order(string.Empty, string.Empty, branchId: 1, source: OrderSource.Pos);
        cancelled.SetCancelledStatus();
        Assert.ThrowsExactly<OrderingDomainException>(() => cancelled.AssignCustomer("Nadia"));

        var nameless = new Order(string.Empty, string.Empty, branchId: 1, source: OrderSource.Pos);
        Assert.ThrowsExactly<OrderingDomainException>(() => nameless.AssignCustomer(" "));
        Assert.IsNull(nameless.GuestName);
    }
}
