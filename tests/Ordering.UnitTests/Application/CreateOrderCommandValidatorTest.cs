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
    public void Guest_order_without_a_place_is_valid_where_the_cafe_takes_them_from_anywhere()
    {
        var result = Validator.Validate(GuestCommand(guestOrdersAnywhere: true));

        Assert.IsTrue(result.IsValid, string.Join("; ", result.Errors));
    }

    private static CreateOrderCommand GuestCommand(bool guestOrdersAnywhere) =>
        new(
            [new BasketItem { Id = "1", ProductId = 1, ProductName = new("Latte"), UnitPrice = 50, Quantity = 1 }],
            userId: string.Empty,
            userName: string.Empty,
            branchId: 1,
            guestId: "guest-1",
            guestName: "Nadia",
            guestPhone: "01012345678",
            guestOrdersAnywhere: guestOrdersAnywhere);
}
