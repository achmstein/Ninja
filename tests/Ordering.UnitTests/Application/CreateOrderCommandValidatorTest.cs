namespace Ninja.Ordering.UnitTests.Application;

using Microsoft.Extensions.Configuration;
using Ninja.Ordering.API.Application.Validations;
using Ninja.ServiceDefaults;

[TestClass]
public class CreateOrderCommandValidatorTest
{
    private static readonly CreateOrderCommandValidator Validator = new(
        new TenantCountry(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Tenant:Country"] = "EG" })
            .Build()),
        Substitute.For<ILogger<CreateOrderCommandValidator>>());

    [TestMethod]
    public void Guest_order_without_a_place_is_invalid()
    {
        var result = Validator.Validate(GuestCommand(guestOrdersAnywhere: false));

        Assert.IsFalse(result.IsValid);
    }

    [TestMethod]
    public void Guest_order_without_a_place_is_valid_where_the_business_takes_them_from_anywhere()
    {
        var result = Validator.Validate(GuestCommand(guestOrdersAnywhere: true));

        Assert.IsTrue(result.IsValid, string.Join("; ", result.Errors));
    }

    [TestMethod]
    public void Guest_order_delivered_to_their_door_is_valid_without_a_place()
    {
        var delivery = new DeliveryDraft(30.06, 31.47, "Tahrir St", "12", Phone: "01012345678");

        var result = Validator.Validate(GuestCommand(guestOrdersAnywhere: false, delivery));

        Assert.IsTrue(result.IsValid, string.Join("; ", result.Errors));
    }

    private static CreateOrderCommand GuestCommand(bool guestOrdersAnywhere, DeliveryDraft? delivery = null) =>
        new(
            [new BasketItem { Id = "1", ProductId = 1, ProductName = new("Latte", null), UnitPrice = 50, Quantity = 1 }],
            userId: string.Empty,
            userName: string.Empty,
            branchId: 1,
            guestId: "guest-1",
            guestName: "Nadia",
            guestPhone: "01012345678",
            guestOrdersAnywhere: guestOrdersAnywhere,
            delivery: delivery);
}
