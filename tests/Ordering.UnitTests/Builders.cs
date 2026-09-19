using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using Ninja.Ordering.Domain.Seedwork;

namespace Ninja.Ordering.UnitTests.Domain;

/// <summary>
/// Builder for creating Order instances in tests.
/// Simplified for cafe ordering - no address or payment details.
/// </summary>
public class OrderBuilder
{
    private readonly Order order;

    public OrderBuilder()
    {
        order = new Order(
            "userId",
            "fakeName",
            branchId: 1,
            roomName: "Room 1",
            customerNote: "Test note");
    }

    public OrderBuilder(string? roomName = null, string? customerNote = null)
    {
        order = new Order(
            "userId",
            "fakeName",
            branchId: 1,
            roomName: roomName,
            customerNote: customerNote);
    }

    public OrderBuilder AddOne(
        int productId,
        string productName,
        decimal unitPrice,
        decimal discount,
        string pictureUrl,
        int units = 1)
    {
        order.AddOrderItem(productId, new LocalizedText(productName), unitPrice, discount, pictureUrl, units);
        return this;
    }

    public Order Build()
    {
        return order;
    }
}
