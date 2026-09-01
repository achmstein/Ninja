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

    public CreateReservationCommand(
        int roomId,
        string? customerId,
        string? customerName,
        string? notes = null,
        bool isAdmin = false)
    {
        RoomId = roomId;
        CustomerId = customerId;
        CustomerName = customerName;
        Notes = notes;
        IsAdmin = isAdmin;
    }
}
