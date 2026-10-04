#nullable enable
using Microsoft.Extensions.Options;

namespace Ninja.Ordering.API.Deliveries;

public static class AddressErrors
{
    public const string Limit = "address.limit";
    public const string NotFound = "address.not_found";
}

/// <summary>Save a delivery address for a customer, or change one of theirs (<paramref name="AddressId"/>).</summary>
public record SaveCustomerAddressCommand(string UserId, int? AddressId, CustomerAddressRequest Request) : IRequest<CustomerAddressView>;

/// <summary>Forget one of a customer's saved addresses; false when it is not theirs or not there.</summary>
public record DeleteCustomerAddressCommand(string UserId, int AddressId) : IRequest<bool>;

/// <summary>
/// The customer's own address book: the rules an address is held to (a pin,
/// the area and street, a number that can be called, the words' lengths) and
/// the cap on how many are kept. Two saves at once cannot pass the cap: the
/// customer's book is locked for the length of the save.
/// </summary>
public class SaveCustomerAddressCommandHandler(
    OrderingContext context,
    TenantCountry country,
    IOptions<DeliveryOptions> options) : IRequestHandler<SaveCustomerAddressCommand, CustomerAddressView>
{
    public async Task<CustomerAddressView> Handle(SaveCustomerAddressCommand command, CancellationToken cancellationToken)
    {
        await CustomerAddressBook.LockAsync(context, command.UserId, cancellationToken);

        CustomerAddress address;
        if (command.AddressId is int id)
        {
            address = await context.CustomerAddresses.FirstOrDefaultAsync(a => a.Id == id && a.UserId == command.UserId, cancellationToken)
                ?? throw new OrderingDomainException("That address isn't one of yours.", AddressErrors.NotFound);
        }
        else
        {
            if (await context.CustomerAddresses.CountAsync(a => a.UserId == command.UserId, cancellationToken) >= options.Value.MaxSavedAddresses)
            {
                throw new OrderingDomainException("That's as many addresses as can be kept. Remove one first.", AddressErrors.Limit);
            }

            address = new CustomerAddress { UserId = command.UserId };
            context.CustomerAddresses.Add(address);
        }

        Apply(address, command.Request, country);
        await context.SaveChangesAsync(cancellationToken);
        return CustomerAddressView.From(address);
    }

    /// <summary>Copies the request onto the address, holding it to the rules a delivery is held to.</summary>
    internal static void Apply(CustomerAddress address, CustomerAddressRequest request, TenantCountry country)
    {
        if (request.Latitude is < -90 or > 90 || request.Longitude is < -180 or > 180
            || double.IsNaN(request.Latitude) || double.IsNaN(request.Longitude))
        {
            throw new OrderingDomainException("Pin the address on the map.", DeliveryErrors.PinInvalid);
        }

        if (string.IsNullOrWhiteSpace(request.Address))
        {
            throw new OrderingDomainException("Say the area and street.", DeliveryErrors.AddressRequired);
        }

        string? phone = null;
        if (!string.IsNullOrWhiteSpace(request.Phone))
        {
            phone = PhoneRules.Normalize(request.Phone, country.Code);
            if (!PhoneRules.IsValid(phone, country.Code))
            {
                throw new OrderingDomainException("That phone number doesn't look right.", DeliveryErrors.PhoneInvalid);
            }
        }

        address.Label = Tidy(request.Label, DeliveryLimits.Label, "name");
        address.Latitude = request.Latitude;
        address.Longitude = request.Longitude;
        address.Address = Tidy(request.Address, DeliveryLimits.Address, "area and street")!;
        address.Building = Tidy(request.Building, DeliveryLimits.Building, "building");
        address.Floor = Tidy(request.Floor, DeliveryLimits.Floor, "floor");
        address.Apartment = Tidy(request.Apartment, DeliveryLimits.Apartment, "apartment");
        address.Directions = Tidy(request.Directions, DeliveryLimits.Directions, "directions");
        address.Phone = phone;
        address.LastUsedAt = DateTime.UtcNow;
    }

    private static string? Tidy(string? value, int max, string what)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        return trimmed.Length <= max
            ? trimmed
            : throw new OrderingDomainException($"The {what} is longer than {max} characters.", DeliveryErrors.TooLong);
    }
}

public class DeleteCustomerAddressCommandHandler(OrderingContext context) : IRequestHandler<DeleteCustomerAddressCommand, bool>
{
    public async Task<bool> Handle(DeleteCustomerAddressCommand command, CancellationToken cancellationToken)
    {
        var address = await context.CustomerAddresses.FirstOrDefaultAsync(a => a.Id == command.AddressId && a.UserId == command.UserId, cancellationToken);
        if (address is null)
        {
            return false;
        }

        context.CustomerAddresses.Remove(address);
        await context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

/// <summary>What placing an order does to the customer's own book: the address used comes first next time.</summary>
public interface ICustomerAddressBook
{
    Task MarkUsedAsync(string userId, DeliveryDraft used);
}

public class CustomerAddressBook(OrderingContext context) : ICustomerAddressBook
{
    public async Task MarkUsedAsync(string userId, DeliveryDraft used)
    {
        var address = used.Address.Trim();
        var saved = await context.CustomerAddresses
            .Where(a => a.UserId == userId && a.Address == address
                && a.Latitude == used.Latitude && a.Longitude == used.Longitude)
            .ToListAsync();

        foreach (var row in saved)
        {
            row.LastUsedAt = DateTime.UtcNow;
        }
    }

    /// <summary>
    /// Holds the customer's book for the rest of the transaction, so two saves
    /// at once count one after the other. On Postgres only: the in-memory
    /// store the unit tests use has neither transactions nor locks.
    /// </summary>
    internal static async Task LockAsync(OrderingContext context, string userId, CancellationToken cancellationToken)
    {
        if (context.Database.IsRelational() && context.Database.CurrentTransaction is not null)
        {
            await context.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtext({"address:" + userId}))", cancellationToken);
        }
    }
}
