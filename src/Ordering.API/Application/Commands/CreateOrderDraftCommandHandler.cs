#nullable enable
namespace Ninja.Ordering.API.Application.Commands;

using Ninja.Ordering.API.Extensions;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using Ninja.Ordering.Domain.Seedwork;

// Regular CommandHandler
public class CreateOrderDraftCommandHandler
    : IRequestHandler<CreateOrderDraftCommand, OrderDraftDTO>
{
    public Task<OrderDraftDTO> Handle(CreateOrderDraftCommand message, CancellationToken cancellationToken)
    {
        var order = Order.NewDraft();
        var orderItems = message.Items.Select(i => i.ToOrderItemDTO());
        foreach (var item in orderItems)
        {
            order.AddOrderItem(item.ProductId, item.ProductName, item.UnitPrice, item.Discount, item.PictureUrl, item.Units);
        }

        return Task.FromResult(OrderDraftDTO.FromOrder(order));
    }
}

public record OrderDraftDTO
{
    public IEnumerable<OrderItemDTO> OrderItems { get; init; } = Enumerable.Empty<OrderItemDTO>();
    public decimal Total { get; init; }

    public static OrderDraftDTO FromOrder(Order order)
    {
        return new OrderDraftDTO()
        {
            OrderItems = order.OrderItems.Select(oi => new OrderItemDTO
            {
                Discount = oi.Discount,
                ProductId = oi.ProductId,
                UnitPrice = oi.UnitPrice,
                PictureUrl = oi.PictureUrl,
                Units = oi.Units,
                ProductName = oi.ProductName
            }),
            Total = order.GetTotal()
        };
    }
}

public record OrderItemDTO
{
    public int ProductId { get; init; }

    public LocalizedText ProductName { get; init; } = new();

    public decimal UnitPrice { get; init; }

    public decimal Discount { get; init; }

    public int Units { get; init; }

    public string? PictureUrl { get; init; }

    /// <summary>
    /// Special instructions for this item (e.g., "extra hot", "no ice")
    /// </summary>
    public string? SpecialInstructions { get; init; }

    /// <summary>
    /// Localized description of selected customizations for display
    /// </summary>
    public LocalizedText? CustomizationsDescription { get; init; }

    /// <summary>
    /// The chosen customization options by id, for Inventory's recipes
    /// </summary>
    public List<int>? OptionIds { get; init; }
}
