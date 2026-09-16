namespace Chillax.Spaces.Domain.AggregatesModel.PlaceAggregate;

/// <summary>
/// One way time at a place can be charged: a code the segments refer to,
/// a name the screens show, an hourly rate. A room has "single" and
/// "multi"; a timed table or a station usually has one.
/// </summary>
public class RateOption
{
    public string Code { get; private set; } = string.Empty;
    public LocalizedText Name { get; private set; } = new();
    public decimal HourlyRate { get; private set; }

    protected RateOption() { }

    public RateOption(string code, LocalizedText name, decimal hourlyRate)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new SpacesDomainException("A rate option needs a code");
        if (string.IsNullOrWhiteSpace(name.En))
            throw new SpacesDomainException("A rate option needs a name");
        if (hourlyRate <= 0)
            throw new SpacesDomainException("An hourly rate must be greater than zero");
        Code = code.Trim().ToLowerInvariant();
        Name = name;
        HourlyRate = hourlyRate;
    }
}

/// <summary>
/// How time at a place is charged: its rate options and the rounding every
/// segment gets. A place with a tariff is timed; one without only receives
/// orders. The options are data, so a third one (VR, per player) is a row.
/// </summary>
public class Tariff
{
    public const string SingleCode = "single";
    public const string MultiCode = "multi";
    public const string StandardCode = "standard";

    public List<RateOption> Options { get; private set; } = [];
    public int RoundingMinutes { get; private set; } = 15;

    protected Tariff() { }

    public Tariff(IEnumerable<RateOption> options, int roundingMinutes = 15)
    {
        var list = options.ToList();
        if (list.Count == 0)
            throw new SpacesDomainException("A tariff needs at least one rate option");
        if (list.Select(o => o.Code).Distinct().Count() != list.Count)
            throw new SpacesDomainException("Rate option codes must be unique");
        if (roundingMinutes is <= 0 or > 60)
            throw new SpacesDomainException("Rounding is between 1 and 60 minutes");
        Options = list;
        RoundingMinutes = roundingMinutes;
    }

    /// <summary>A room's tariff as it has always been: single and multi player rates.</summary>
    public static Tariff Room(decimal singleRate, decimal multiRate) => new([
        new RateOption(SingleCode, new LocalizedText("Single", "سنجل"), singleRate),
        new RateOption(MultiCode, new LocalizedText("Multi", "ملتي"), multiRate),
    ]);

    /// <summary>One rate, no choice to make: a timed table, a pool table.</summary>
    public static Tariff Flat(decimal hourlyRate) => new([
        new RateOption(StandardCode, new LocalizedText("Standard", "عادي"), hourlyRate),
    ]);

    public bool HasOptions => Options.Count > 1;

    public RateOption Default => Options[0];

    public RateOption? Find(string? code)
        => code is null ? null : Options.FirstOrDefault(o => o.Code.Equals(code.Trim(), StringComparison.OrdinalIgnoreCase));

    public RateOption Require(string? code)
        => Find(code) ?? throw new SpacesDomainException($"This place has no '{code}' rate");

    /// <summary>Minutes on the clock → hours billed, to the nearest rounding step.</summary>
    public decimal RoundHours(double minutes)
    {
        if (minutes <= 0) return 0;
        var steps = Math.Round(minutes / RoundingMinutes, MidpointRounding.AwayFromZero);
        return (decimal)steps * RoundingMinutes / 60m;
    }

    /// <summary>A copy for a stay to keep: the rates as they were when it began.</summary>
    public Tariff Snapshot() => new(Options.Select(o => new RateOption(o.Code, o.Name, o.HourlyRate)), RoundingMinutes);
}
