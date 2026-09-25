using Ninja.Spaces.API.Infrastructure;
using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;

namespace Ninja.Spaces.UnitTests.Infrastructure;

/// <summary>
/// A sample stack's floor is its kind of place's: a coffee shop's few
/// tables and a room, a restaurant's dining room, a game station's rooms on
/// the clock, and nothing for a cloud kitchen, whose guests collect.
/// </summary>
[TestClass]
public sealed class SamplePlacesTests
{
    [TestMethod]
    public void A_cloud_kitchen_plants_no_places()
    {
        Assert.IsEmpty(SpacesContextSeed.SamplePlaces("cloud_kitchen"));
    }

    [TestMethod]
    [DataRow("coffee_shop")]
    [DataRow("other")]
    public void A_coffee_shop_plants_four_tables_and_a_room(string business)
    {
        var places = SpacesContextSeed.SamplePlaces(business);

        Assert.AreEqual(4, places.Count(p => p.Kind == PlaceKind.Table));
        Assert.AreEqual(1, places.Count(p => p.Kind == PlaceKind.Room));
    }

    [TestMethod]
    public void A_restaurant_plants_a_dining_room_of_tables_and_nothing_on_a_clock()
    {
        var places = SpacesContextSeed.SamplePlaces("restaurant");

        Assert.IsGreaterThanOrEqualTo(8, places.Count);
        Assert.IsTrue(places.All(p => p.Kind == PlaceKind.Table && !p.IsTimed));
    }

    [TestMethod]
    public void A_game_station_plants_rooms_by_the_hour()
    {
        var places = SpacesContextSeed.SamplePlaces("game_station");
        var rooms = places.Where(p => p.Kind == PlaceKind.Room).ToList();

        Assert.IsGreaterThanOrEqualTo(4, rooms.Count);
        Assert.IsTrue(rooms.All(r => r.IsTimed), "every room has a tariff");
        Assert.IsGreaterThan(places.Count(p => p.Kind == PlaceKind.Table), rooms.Count);
    }

    [TestMethod]
    [DataRow("coffee_shop")]
    [DataRow("restaurant")]
    [DataRow("game_station")]
    public void Every_sample_place_is_named_in_both_languages_in_branch_one(string business)
    {
        foreach (var place in SpacesContextSeed.SamplePlaces(business))
        {
            Assert.IsFalse(string.IsNullOrWhiteSpace(place.Name.En));
            Assert.IsFalse(string.IsNullOrWhiteSpace(place.Name.Ar));
            Assert.AreEqual(1, place.BranchId);
        }
    }
}
