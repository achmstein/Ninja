namespace Ninja.Ordering.API.Application.Behaviors;

public class ValidatorBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse> where TRequest : IRequest<TResponse>
{
    private readonly ILogger<ValidatorBehavior<TRequest, TResponse>> _logger;
    private readonly IEnumerable<IValidator<TRequest>> _validators;

    public ValidatorBehavior(IEnumerable<IValidator<TRequest>> validators, ILogger<ValidatorBehavior<TRequest, TResponse>> logger)
    {
        _validators = validators;
        _logger = logger;
    }

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        var typeName = request.GetGenericTypeName();

        _logger.LogInformation("Validating command {CommandType}", typeName);

        var validationTasks = _validators.Select(v => v.ValidateAsync(request, cancellationToken));
        var validationResults = await Task.WhenAll(validationTasks);
        
        var failures = validationResults
            .SelectMany(result => result.Errors)
            .Where(error => error != null)
            .ToList();

        if (failures.Any())
        {
            _logger.LogWarning("Validation errors - {CommandType} - Errors: {ValidationErrors}", typeName, string.Join("; ", failures.Select(f => $"{f.PropertyName}: {f.ErrorMessage}")));

            // The reasons themselves are the message: the API answers a refused
            // order with it, and the app shows it ("A table or room is required
            // to order as a guest."), not the name of the command
            throw new OrderingDomainException(
                string.Join(" ", failures.Select(f => f.ErrorMessage).Distinct()),
                "order.validation",
                new ValidationException("Validation exception", failures));
        }

        return await next();
    }
}
