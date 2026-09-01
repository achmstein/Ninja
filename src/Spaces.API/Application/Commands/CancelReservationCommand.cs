using System.Runtime.Serialization;
using MediatR;

namespace Chillax.Spaces.API.Application.Commands;

[DataContract]
public class CancelReservationCommand : IRequest<bool>
{
    [DataMember]
    public int ReservationId { get; private set; }

    public CancelReservationCommand(int reservationId)
    {
        ReservationId = reservationId;
    }
}
