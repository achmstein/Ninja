namespace Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>Distances on the map, as the crow flies — how a branch's delivery radius is measured.</summary>
public static class Geo
{
    private const double EarthRadiusMeters = 6_371_000;

    /// <summary>The great-circle distance between two points, in metres (haversine).</summary>
    public static int DistanceMeters(double lat1, double lng1, double lat2, double lng2)
    {
        static double Rad(double degrees) => degrees * Math.PI / 180;

        var dLat = Rad(lat2 - lat1);
        var dLng = Rad(lng2 - lng1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                + Math.Cos(Rad(lat1)) * Math.Cos(Rad(lat2)) * Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        return (int)Math.Round(EarthRadiusMeters * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a)));
    }
}
