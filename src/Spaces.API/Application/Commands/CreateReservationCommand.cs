using System.Runtime.Serialization;
using MediatR;

namespace Chillax.Spaces.API.Application.Commands;

[DataContract]
public class CreateReservationCommand : IRequest<int>
{
    [DataMember]
    public int RoomId { get; private set; }

    [DataMember]
    public string? CustomerId { get; private set; }

    [DataMember]
    public string? CustomerName { get; private set; }

    [DataMember]
    public string? Notes { get; private set; }

    [DataMember]
    public bool IsAdmin { get; private set; }

    /// <summary>
    /// The caller is staff (Admin, Owner or Cashier): a walk-in booked from the
    /// till or the admin app goes through even while the branch has
    /// reservations paused. Distinct from <see cref="IsAdmin"/>, which also
    /// changes whose reservation it is.
    /// </summary>
    [DataMember]
    public bool IsStaff { get; private set; }

    public CreateReservationCommand(
        int roomId,
        string? customerId,
        string? customerName,
        string? notes = null,
        bool isAdmin = false,
        bool isStaff = false)
    {
        RoomId = roomId;
        CustomerId = customerId;
        CustomerName = customerName;
        Notes = notes;
        IsAdmin = isAdmin;
        IsStaff = isStaff;
    }
}
