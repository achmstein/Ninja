namespace Ninja.Ordering.API.Application.Validations;

public class CancelOrderCommandValidator : AbstractValidator<CancelOrderCommand>
{
    public CancelOrderCommandValidator(ILogger<CancelOrderCommandValidator> logger)
    {
        RuleFor(order => order.OrderNumber).NotEmpty().WithMessage("No orderId found");

        // Only the platform's own reasons reach the platform
        RuleFor(order => order.PlatformReason)
            .Must(reason => PlatformRejectReasons.ForStaff.Contains(reason))
            .When(order => order.PlatformReason is not null)
            .WithMessage($"A delivery platform's order is turned down for one of: {string.Join(", ", PlatformRejectReasons.ForStaff)}.");

        if (logger.IsEnabled(LogLevel.Trace))
        {
            logger.LogTrace("INSTANCE CREATED - {ClassName}", GetType().Name);
        }
    }
}
