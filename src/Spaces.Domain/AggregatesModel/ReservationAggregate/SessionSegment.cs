using Chillax.Spaces.Domain.SeedWork;

namespace Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;

public class SessionSegment : Entity
{
    public int ReservationId { get; private set; }
    public PlayerMode PlayerMode { get; private set; }
    public decimal HourlyRate { get; private set; }
    public DateTime StartTime { get; private set; }
    public DateTime? EndTime { get; private set; }

    protected SessionSegment() { }

    internal SessionSegment(int reservationId, PlayerMode playerMode, decimal hourlyRate, DateTime startTime)
    {
        ReservationId = reservationId;
        PlayerMode = playerMode;
        HourlyRate = hourlyRate;
        StartTime = startTime;
    }

    internal void End(DateTime endTime)
    {
        EndTime = endTime;
    }
}
