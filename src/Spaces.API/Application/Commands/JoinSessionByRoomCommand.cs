using System.Runtime.Serialization;
using Chillax.Spaces.Domain.SeedWork;
using MediatR;

namespace Chillax.Spaces.API.Application.Commands;

/// <summary>
/// Command for a customer to join the active session of a room (via QR scan).
/// </summary>
[DataContract]
public class JoinSessionByRoomCommand : IRequest<JoinSessionResult>
{
    [DataMember]
    public int RoomId { get; private set; }

    [DataMember]
    public string CustomerId { get; private set; }

    [DataMember]
    public string? CustomerName { get; private set; }

    public JoinSessionByRoomCommand(int roomId, string customerId, string? customerName)
    {
        RoomId = roomId;
        CustomerId = customerId;
        CustomerName = customerName;
    }
}

public record JoinSessionResult(
    int ReservationId,
    int RoomId,
    LocalizedText RoomName,
    bool IsOwner,
    DateTime StartTime);
