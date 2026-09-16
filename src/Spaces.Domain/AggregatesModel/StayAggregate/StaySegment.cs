namespace Chillax.Spaces.Domain.AggregatesModel.StayAggregate;

/// <summary>A stretch of a stay charged at one rate option. A new segment opens whenever the option changes.</summary>
public class StaySegment : Entity
{
    public int StayId { get; private set; }
    public string OptionCode { get; private set; } = string.Empty;
    public decimal HourlyRate { get; private set; }
    public DateTime StartTime { get; private set; }
    public DateTime? EndTime { get; private set; }

    protected StaySegment() { }

    internal StaySegment(int stayId, string optionCode, decimal hourlyRate, DateTime startTime)
    {
        StayId = stayId;
        OptionCode = optionCode;
        HourlyRate = hourlyRate;
        StartTime = startTime;
    }

    internal void End(DateTime endTime)
    {
        EndTime = endTime;
    }

    public double Minutes => ((EndTime ?? DateTime.UtcNow) - StartTime).TotalMinutes;
}
