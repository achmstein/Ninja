namespace Ninja.Tenant.API.Services;

/// <summary>
/// What makes a delivery area drawn on the map one a branch can deliver to: a ring
/// of [lat, lng] points round the streets it reaches, that does not cross itself and
/// stays near the branch. Ordering asks whether a pin is inside it; this is where it
/// is held to being a shape that question has an answer for.
/// </summary>
public static class DeliveryAreaRules
{
    /// <summary>The fewest points a ring has: a triangle.</summary>
    public const int MinPoints = 3;

    /// <summary>The most: enough for a neighbourhood's streets, few enough to check every order against.</summary>
    public const int MaxPoints = 200;

    /// <summary>How far from the branch any point of the area may be: riders go no further.</summary>
    public const double MaxKmFromBranch = 50;

    /// <summary>
    /// The area tidied (a closing point that repeats the first one dropped, as are
    /// points that repeat the one before), or why it cannot be used. Null in, null out.
    /// </summary>
    public static (double[][]? Area, string? Problem) Check(double[][]? area, double? branchLatitude, double? branchLongitude)
    {
        if (area is null) return (null, null);

        var ring = new List<double[]>(area.Length);
        foreach (var point in area)
        {
            if (point is not { Length: 2 }
                || !double.IsFinite(point[0]) || !double.IsFinite(point[1])
                || point[0] is < -90 or > 90 || point[1] is < -180 or > 180)
            {
                return (null, "Each point of the delivery area is a latitude and a longitude.");
            }

            if (ring.Count > 0 && Same(ring[^1], point)) continue;
            ring.Add([point[0], point[1]]);
        }

        // Drawn closed, the last point is the first again
        if (ring.Count > 1 && Same(ring[0], ring[^1])) ring.RemoveAt(ring.Count - 1);

        if (ring.Count < MinPoints)
            return (null, $"Draw the delivery area with at least {MinPoints} points.");
        if (ring.Count > MaxPoints)
            return (null, $"The delivery area can have up to {MaxPoints} points.");

        if (branchLatitude is not { } lat || branchLongitude is not { } lng)
            return (null, "Set the branch's location before drawing its delivery area.");
        if (ring.Any(p => DistanceKm(lat, lng, p[0], p[1]) > MaxKmFromBranch))
            return (null, $"The delivery area must stay within {MaxKmFromBranch:0} km of the branch.");

        if (ring.All(p => Orientation(ring[0], ring[1], p) == 0))
            return (null, "The delivery area has no inside: its points lie on one line.");
        // A bow tie crosses itself and, its halves cancelling out, can even enclose nothing
        if (CrossesItself(ring) || Math.Abs(TwiceArea(ring)) < 1e-12)
            return (null, "The delivery area's edges cross each other. Draw it round without crossing.");

        return (ring.ToArray(), null);
    }

    private static bool Same(double[] a, double[] b) => a[0] == b[0] && a[1] == b[1];

    /// <summary>The shoelace sum, in square degrees: zero for points on one line.</summary>
    private static double TwiceArea(IReadOnlyList<double[]> ring)
    {
        var sum = 0d;
        for (int i = 0, j = ring.Count - 1; i < ring.Count; j = i++)
            sum += (ring[j][1] * ring[i][0]) - (ring[i][1] * ring[j][0]);
        return sum;
    }

    /// <summary>Whether two edges that are not neighbours touch or cross; neighbours share only their corner.</summary>
    public static bool CrossesItself(IReadOnlyList<double[]> ring)
    {
        var n = ring.Count;
        for (var i = 0; i < n; i++)
        {
            var a1 = ring[i];
            var a2 = ring[(i + 1) % n];
            for (var j = i + 1; j < n; j++)
            {
                // A neighbour, sharing a corner with it
                if ((j + 1) % n == i || (i + 1) % n == j) continue;
                if (SegmentsMeet(a1, a2, ring[j], ring[(j + 1) % n])) return true;
            }

            // The next edge folding back along this one (a spike) shares more than its corner
            var next = ring[(i + 2) % n];
            if (Orientation(a1, a2, next) == 0 && !OnSegment(a1, a2, next)) return true;
        }

        return false;
    }

    private static int Orientation(double[] p, double[] q, double[] r)
    {
        var value = ((q[0] - p[0]) * (r[1] - q[1])) - ((q[1] - p[1]) * (r[0] - q[0]));
        return Math.Abs(value) < 1e-15 ? 0 : value > 0 ? 1 : 2;
    }

    /// <summary>Whether q lies on the segment p–r, given the three are on one line.</summary>
    private static bool OnSegment(double[] p, double[] q, double[] r) =>
        q[0] <= Math.Max(p[0], r[0]) && q[0] >= Math.Min(p[0], r[0])
        && q[1] <= Math.Max(p[1], r[1]) && q[1] >= Math.Min(p[1], r[1]);

    private static bool SegmentsMeet(double[] p1, double[] q1, double[] p2, double[] q2)
    {
        var o1 = Orientation(p1, q1, p2);
        var o2 = Orientation(p1, q1, q2);
        var o3 = Orientation(p2, q2, p1);
        var o4 = Orientation(p2, q2, q1);

        if (o1 != o2 && o3 != o4) return true;

        return (o1 == 0 && OnSegment(p1, p2, q1))
            || (o2 == 0 && OnSegment(p1, q2, q1))
            || (o3 == 0 && OnSegment(p2, p1, q2))
            || (o4 == 0 && OnSegment(p2, q1, q2));
    }

    private static double DistanceKm(double lat1, double lng1, double lat2, double lng2)
    {
        static double Rad(double degrees) => degrees * Math.PI / 180;
        var dLat = Rad(lat2 - lat1);
        var dLng = Rad(lng2 - lng1);
        var a = (Math.Sin(dLat / 2) * Math.Sin(dLat / 2))
                + (Math.Cos(Rad(lat1)) * Math.Cos(Rad(lat2)) * Math.Sin(dLng / 2) * Math.Sin(dLng / 2));
        return 6371.0088 * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }
}
