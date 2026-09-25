namespace Ninja.Ordering.API.Application.Validations;

/// <summary>
/// Simplified validator for cafe orders.
/// No address or payment validation needed.
/// </summary>
public class CreateOrderCommandValidator : AbstractValidator<CreateOrderCommand>
{
    public CreateOrderCommandValidator(TenantCountry country, ILogger<CreateOrderCommandValidator> logger)
    {
        // A guest's phone is read the way this café's country writes one
        var guestPhonePattern = PhoneRules.For(country.Code).Pattern;

        // A signed-in order is identified by its user; a guest order stands on
        // the contact details left at checkout instead. A counter sale is
        // neither: staff keyed it in, the cashier's identity rides the request,
        // and a walk-in may have no customer at all — attaching one is
        // optional, for loyalty and tabs. Requiring an identity here rejected
        // every anonymous POS order.
        When(command => !command.IsGuestOrder && command.Source != OrderSource.Pos, () =>
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

            // A guest order has to be going somewhere in the building. Ordering
            // ahead to collect is for account holders, who can be held to it —
            // unless the café takes guests' orders from anywhere.
            RuleFor(command => command.HasDestination).Equal(true)
                .Unless(command => command.GuestOrdersAnywhere)
                .WithMessage("A table or room is required to order as a guest.");
        });

        // Negative points would become a negative discount — a surcharge
        RuleFor(command => command.PointsToRedeem).GreaterThanOrEqualTo(0);

        RuleFor(command => command.OrderItems).Must(ContainOrderItems).WithMessage("No order items found");

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
