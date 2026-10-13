namespace Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>Distances on the map, as the crow flies — how a branch's delivery radius is measured — and whether a point is inside a drawn area.</summary>
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

    /// <summary>
    /// Whether a point is inside a drawn area: a ring of [lat, lng] points, closed or
    /// not (the last back to the first is implied). A point on its edge or a corner is
    /// inside, so a street drawn along is delivered to. Ray casting on the degrees as
    /// they are: across a branch's few kilometres the map is flat enough. Fewer than
    /// three points enclose nothing.
    /// </summary>
    public static bool Contains(IReadOnlyList<double[]> ring, double latitude, double longitude)
    {
        if (ring.Count < 3) return false;

        // y is the latitude, x the longitude
        var inside = false;
        for (int i = 0, j = ring.Count - 1; i < ring.Count; j = i++)
        {
            double yi = ring[i][0], xi = ring[i][1];
            double yj = ring[j][0], xj = ring[j][1];

            if (OnSegment(yi, xi, yj, xj, latitude, longitude)) return true;

            // The edge crosses the point's latitude, and the crossing lies east of it
            if ((yi > latitude) != (yj > latitude)
                && longitude < (xj - xi) * (latitude - yi) / (yj - yi) + xi)
            {
                inside = !inside;
            }
        }

        return inside;
    }

    /// <summary>About a centimetre, in degrees: a point this close to an edge is on it.</summary>
    private const double OnEdgeDegrees = 1e-7;

    private static bool OnSegment(double y1, double x1, double y2, double x2, double y, double x)
    {
        if (x < Math.Min(x1, x2) - OnEdgeDegrees || x > Math.Max(x1, x2) + OnEdgeDegrees
            || y < Math.Min(y1, y2) - OnEdgeDegrees || y > Math.Max(y1, y2) + OnEdgeDegrees)
        {
            return false;
        }

        var length = Math.Sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
        if (length == 0) return Math.Abs(x - x1) <= OnEdgeDegrees && Math.Abs(y - y1) <= OnEdgeDegrees;

        // The point's distance from the edge's line
        var cross = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
        return Math.Abs(cross) / length <= OnEdgeDegrees;
    }
}
