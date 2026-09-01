using System.Runtime.Serialization;
using MediatR;

namespace Chillax.Spaces.API.Application.Commands;

/// <summary>
/// Command for a member (non-owner) to leave a session.
/// </summary>
[DataContract]
public class LeaveSessionCommand : IRequest<bool>
{
    [DataMember]
    public int ReservationId { get; private set; }

    [DataMember]
    public string CustomerId { get; private set; }

    public LeaveSessionCommand(int reservationId, string customerId)
    {
        ReservationId = reservationId;
        CustomerId = customerId;
    }
}
