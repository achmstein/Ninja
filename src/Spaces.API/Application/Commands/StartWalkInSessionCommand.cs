using System.Runtime.Serialization;
using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;
using MediatR;

namespace Chillax.Spaces.API.Application.Commands;

/// <summary>
/// Command to start a walk-in session without an assigned customer.
/// The first customer to join via QR scan becomes the owner.
/// </summary>
[DataContract]
public class StartWalkInSessionCommand : IRequest<StartWalkInSessionResult>
{
    [DataMember]
    public int RoomId { get; private set; }

    [DataMember]
    public string? Notes { get; private set; }

    [DataMember]
    public PlayerMode InitialPlayerMode { get; private set; }

    public StartWalkInSessionCommand(int roomId, string? notes = null, PlayerMode initialPlayerMode = PlayerMode.Single)
    {
        RoomId = roomId;
        Notes = notes;
        InitialPlayerMode = initialPlayerMode;
    }
}

public record StartWalkInSessionResult(int ReservationId);
