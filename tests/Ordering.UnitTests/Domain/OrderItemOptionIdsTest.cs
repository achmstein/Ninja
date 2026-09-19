namespace Ninja.Ordering.UnitTests.Domain;

using Ninja.Ordering.API.Application.Models;
using Ninja.Ordering.API.Extensions;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using Ninja.Ordering.Domain.Seedwork;

[TestClass]
public class OrderItemOptionIdsTest
{
    [TestMethod]
    public void Basket_customizations_keep_their_option_ids_beside_the_description()
    {
        var item = new BasketItem
        {
            ProductId = 1,
            ProductName = new LocalizedText("Latte"),
            UnitPrice = 50,
            Quantity = 2,
            SelectedCustomizations =
            [
                new BasketItemCustomization { CustomizationId = 10, OptionId = 77, OptionName = new LocalizedText("Oat milk", "لبن شوفان"), PriceAdjustment = 5 },
                new BasketItemCustomization { CustomizationId = 11, OptionId = 78, OptionName = new LocalizedText("Large"), PriceAdjustment = 10 },
            ],
        };

        var dto = item.ToOrderItemDTO();

        CollectionAssert.AreEqual(new[] { 77, 78 }, dto.OptionIds);
        Assert.AreEqual("Oat milk, Large", dto.CustomizationsDescription!.En);
        Assert.AreEqual(65, dto.UnitPrice);
    }

    [TestMethod]
    public void A_plain_basket_item_carries_no_option_ids()
    {
        var dto = new BasketItem { ProductId = 1, ProductName = new LocalizedText("Water"), UnitPrice = 10, Quantity = 1 }.ToOrderItemDTO();

        Assert.IsNull(dto.OptionIds);
        Assert.IsNull(dto.CustomizationsDescription);
    }

    [TestMethod]
    public void An_order_line_stores_distinct_positive_option_ids_or_nothing()
    {
        var withOptions = new OrderItem(1, new LocalizedText("Latte"), 55, 0, null, 1, new LocalizedText("Oat milk"), null, [77, 77, 0]);
        CollectionAssert.AreEqual(new[] { 77 }, withOptions.OptionIds);

        var plain = new OrderItem(1, new LocalizedText("Latte"), 50, 0, null, 1, null, null, []);
        Assert.IsNull(plain.OptionIds);
    }

    [TestMethod]
    public void Customized_lines_of_one_product_stay_separate_and_keep_their_own_options()
    {
        var order = new OrderBuilder().Build();

        order.AddOrderItem(1, new LocalizedText("Latte"), 50, 0, null, 1);
        order.AddOrderItem(1, new LocalizedText("Latte"), 55, 0, null, 2, new LocalizedText("Oat milk"), null, [77]);
        order.AddOrderItem(1, new LocalizedText("Latte"), 50, 0, null, 1);

        var lines = order.OrderItems.ToList();

        Assert.AreEqual(2, lines.Count, "plain lines merge, the customized one stands alone");
        Assert.IsNull(lines[0].OptionIds);
        Assert.AreEqual(2, lines[0].Units);
        CollectionAssert.AreEqual(new[] { 77 }, lines[1].OptionIds);
    }
}
