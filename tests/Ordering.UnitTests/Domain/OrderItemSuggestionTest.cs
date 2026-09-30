namespace Ninja.Ordering.UnitTests.Domain;

using Ninja.Ordering.API.Application.Models;
using Ninja.Ordering.API.Extensions;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using Ninja.Ordering.Domain.Seedwork;

/// <summary>
/// A line added from a suggestion ("goes well with") says so from the basket
/// to the order, so what suggestions sell can be told apart.
/// </summary>
[TestClass]
public class OrderItemSuggestionTest
{
    [TestMethod]
    public void A_basket_line_from_a_suggestion_carries_it_to_the_order_line()
    {
        var dto = new BasketItem { ProductId = 2, ProductName = new LocalizedText("Waffle", null), UnitPrice = 70, Quantity = 1, Suggestion = SuggestionSource.Pairing }.ToOrderItemDTO();
        Assert.AreEqual(SuggestionSource.Pairing, dto.Suggestion);

        var order = new OrderBuilder().Build();
        order.AddOrderItem(dto.ProductId, dto.ProductName, dto.UnitPrice, dto.Discount, dto.PictureUrl, dto.Units, dto.CustomizationsDescription, dto.SpecialInstructions, dto.OptionIds, dto.Suggestion);

        Assert.AreEqual(SuggestionSource.Pairing, order.OrderItems.Single().Suggestion);
    }

    [TestMethod]
    public void A_line_picked_from_the_menu_was_not_suggested()
    {
        var dto = new BasketItem { ProductId = 1, ProductName = new LocalizedText("Latte", null), UnitPrice = 50, Quantity = 1 }.ToOrderItemDTO();

        Assert.AreEqual(SuggestionSource.None, dto.Suggestion);
        Assert.AreEqual(SuggestionSource.None, new OrderItem(1, new LocalizedText("Latte", null), 50, 0, null).Suggestion);
    }

    [TestMethod]
    public void A_suggested_line_is_not_folded_into_the_same_item_picked_by_hand()
    {
        var order = new OrderBuilder().Build();

        order.AddOrderItem(2, new LocalizedText("Waffle", null), 70, 0, null, 1);
        order.AddOrderItem(2, new LocalizedText("Waffle", null), 70, 0, null, 1, suggestion: SuggestionSource.CartNudge);
        order.AddOrderItem(2, new LocalizedText("Waffle", null), 70, 0, null, 2, suggestion: SuggestionSource.CartNudge);

        var lines = order.OrderItems.ToList();
        Assert.AreEqual(2, lines.Count, "the suggested waffles stand apart from the one picked by hand");
        Assert.AreEqual((SuggestionSource.None, 1), (lines[0].Suggestion, lines[0].Units));
        Assert.AreEqual((SuggestionSource.CartNudge, 3), (lines[1].Suggestion, lines[1].Units), "suggested lines of one kind still merge");
    }
}
