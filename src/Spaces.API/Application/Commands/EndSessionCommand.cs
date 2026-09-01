using System.Runtime.Serialization;
using MediatR;

namespace Chillax.Spaces.API.Application.Commands;

[DataContract]
public class EndSessionCommand : IRequest<bool>
{
    [DataMember]
    public int ReservationId { get; private set; }

    public EndSessionCommand(int reservationId)
    {
        ReservationId = reservationId;
    }
}
