#nullable enable
using Microsoft.AspNetCore.Http.HttpResults;

/// <summary>The signed-in customer's own saved delivery addresses.</summary>
public static partial class DeliveryApi
{
    public static async Task<Results<Ok<List<CustomerAddressView>>, UnauthorizedHttpResult>> GetAddressesAsync(
        IIdentityService identity,
        OrderingContext context)
    {
        var userId = identity.GetUserIdentity();
        if (string.IsNullOrEmpty(userId))
        {
            return TypedResults.Unauthorized();
        }

        var addresses = await context.CustomerAddresses
            .AsNoTracking()
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.LastUsedAt)
            .Select(a => CustomerAddressView.From(a))
            .ToListAsync();

        return TypedResults.Ok(addresses);
    }

    public static Task<Results<Ok<CustomerAddressView>, ProblemHttpResult, UnauthorizedHttpResult>> SaveAddressAsync(
        CustomerAddressRequest request, IIdentityService identity, IMediator mediator) =>
        SaveAsync(null, request, identity, mediator);

    public static Task<Results<Ok<CustomerAddressView>, ProblemHttpResult, UnauthorizedHttpResult>> UpdateAddressAsync(
        int addressId, CustomerAddressRequest request, IIdentityService identity, IMediator mediator) =>
        SaveAsync(addressId, request, identity, mediator);

    private static async Task<Results<Ok<CustomerAddressView>, ProblemHttpResult, UnauthorizedHttpResult>> SaveAsync(
        int? addressId, CustomerAddressRequest request, IIdentityService identity, IMediator mediator)
    {
        var userId = identity.GetUserIdentity();
        if (string.IsNullOrEmpty(userId))
        {
            return TypedResults.Unauthorized();
        }

        try
        {
            return TypedResults.Ok(await mediator.Send(new SaveCustomerAddressCommand(userId, addressId, request)));
        }
        catch (OrderingDomainException ex)
        {
            return OrderingProblems.From(ex);
        }
    }

    public static async Task<Results<NoContent, ProblemHttpResult, UnauthorizedHttpResult>> DeleteAddressAsync(
        int addressId,
        IIdentityService identity,
        IMediator mediator)
    {
        var userId = identity.GetUserIdentity();
        if (string.IsNullOrEmpty(userId))
        {
            return TypedResults.Unauthorized();
        }

        return await mediator.Send(new DeleteCustomerAddressCommand(userId, addressId))
            ? TypedResults.NoContent()
            : OrderingProblems.Of(AddressErrors.NotFound, "That address isn't one of yours.");
    }
}
