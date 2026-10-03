using Ninja.Tenant.API.Services;

namespace Ninja.Tenant.UnitTests;

/// <summary>Where a branch is, read from what an owner pastes.</summary>
[TestClass]
public sealed class MapLocationTests
{
    [TestMethod]
    public void Reads_plain_coordinates()
    {
        Assert.AreEqual(new GeoPoint(30.0444, 31.2357), MapLocation.Parse("30.0444, 31.2357"));
    }

    [TestMethod]
    public void Reads_a_place_pin_before_the_map_centre()
    {
        var link = "https://www.google.com/maps/place/Chillax/@30.05,31.20,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d29.9603!4d31.2591";

        Assert.AreEqual(new GeoPoint(29.9603, 31.2591), MapLocation.Parse(link));
    }

    [TestMethod]
    public void Reads_the_map_centre()
    {
        Assert.AreEqual(new GeoPoint(30.05, 31.2), MapLocation.Parse("https://www.google.com/maps/@30.05,31.20,15z"));
    }

    [TestMethod]
    public void Reads_a_query_point()
    {
        Assert.AreEqual(new GeoPoint(30.0444, 31.2357), MapLocation.Parse("https://maps.google.com/?q=30.0444,31.2357"));
        Assert.AreEqual(new GeoPoint(30.0444, 31.2357), MapLocation.Parse("https://www.google.com/maps/search/?api=1&query=30.0444%2C31.2357"));
    }

    [TestMethod]
    public void Refuses_what_names_no_point()
    {
        Assert.IsNull(MapLocation.Parse("Maadi, road 9"));
        Assert.IsNull(MapLocation.Parse("95.0, 31.0"), "no latitude beyond the poles");
        Assert.IsNull(MapLocation.Parse("0, 0"), "the empty point is a missing one");
        Assert.IsNull(MapLocation.Parse(""));
    }

    [TestMethod]
    public void Knows_a_short_link()
    {
        Assert.IsTrue(MapLocation.IsShortLink("https://maps.app.goo.gl/AbCdEf123"));
        Assert.IsTrue(MapLocation.IsShortLink("https://goo.gl/maps/AbCdEf"));
        Assert.IsFalse(MapLocation.IsShortLink("https://example.com/maps/x"));
    }
}
