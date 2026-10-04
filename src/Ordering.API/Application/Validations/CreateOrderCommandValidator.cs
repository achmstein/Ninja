namespace Ninja.Ordering.API.Application.Validations;

/// <summary>
/// Simplified validator for business orders.
/// No address or payment validation needed.
/// </summary>
public class CreateOrderCommandValidator : AbstractValidator<CreateOrderCommand>
{
    public CreateOrderCommandValidator(TenantCountry country, ILogger<CreateOrderCommandValidator> logger)
    {
        // A guest's phone is read the way this business's country writes one
        var guestPhonePattern = PhoneRules.For(country.Code).Pattern;

        // A signed-in order is identified by its user; a guest order stands on
        // the contact details left at checkout instead. A counter sale is
        // neither: staff keyed it in, the cashier's identity rides the request,
        // and a walk-in may have no customer at all — attaching one is
        // optional, for loyalty and tabs. Requiring an identity here rejected
        // every anonymous POS order. A delivery platform's order has nobody
        // here either: the platform holds the customer.
        When(command => !command.IsGuestOrder && command.Source is not (OrderSource.Pos or OrderSource.Talabat), () =>
        {
            RuleFor(command => command.UserId).NotEmpty();
            RuleFor(command => command.UserName).NotEmpty();
        });

        When(command => command.IsGuestOrder, () =>
        {
            RuleFor(command => command.GuestId).NotEmpty();
            RuleFor(command => command.GuestName).NotEmpty();
            RuleFor(command => command.GuestPhone)
                .NotEmpty()
                .Matches(guestPhonePattern)
                .WithMessage("A valid phone number is required to order as a guest.");

            // Loyalty is account-only: there is nothing to redeem against
            RuleFor(command => command.PointsToRedeem).Equal(0)
                .WithMessage("Loyalty points cannot be redeemed on a guest order.");

            // A guest order has to be going somewhere: a table or room in the
            // building, or a door the rider takes it to. Ordering ahead to
            // collect is for account holders, who can be held to it — unless
            // the business takes guests' orders from anywhere.
            RuleFor(command => command.HasDestination).Equal(true)
                .Unless(command => command.GuestOrdersAnywhere || command.Delivery is not null)
                .WithMessage("A table or room is required to order as a guest.");
        });

        // Negative points would become a negative discount — a surcharge
        RuleFor(command => command.PointsToRedeem).GreaterThanOrEqualTo(0);

        RuleFor(command => command.OrderItems).Must(ContainOrderItems).WithMessage("No order items found");

        RuleFor(command => command.Platform).NotNull()
            .When(command => command.Source == OrderSource.Talabat)
            .WithMessage("A Talabat order needs Talabat's details.");

        if (logger.IsEnabled(LogLevel.Trace))
        {
            logger.LogTrace("INSTANCE CREATED - {ClassName}", GetType().Name);
        }
    }

    private bool ContainOrderItems(IEnumerable<OrderItemDTO> orderItems)
    {
        return orderItems.Any();
    }
}
