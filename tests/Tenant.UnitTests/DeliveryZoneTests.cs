using Ninja.Tenant.API.Services;

namespace Ninja.Tenant.UnitTests;

/// <summary>
/// A branch's named delivery areas ("Maadi Degla, 25"): what the list must be to be kept. A name and
/// a fee are enough; a shape, when one is drawn, is held to the rules of the branch's own area.
/// </summary>
[TestClass]
public sealed class DeliveryZoneTests
{
    // Downtown Cairo, and a square of streets round it
    private const double Lat = 30.0444, Lng = 31.2357;
    private static readonly double[][] Square = [[30.035, 31.225], [30.055, 31.225], [30.055, 31.245], [30.035, 31.245]];

    private static DeliveryZoneRequest Zone(string en, string? ar = null, decimal fee = 25, decimal? minimum = null, int? minutes = null, double[][]? shape = null, int? id = null) =>
        new(id, new LocalizedText(en, ar), fee, minimum, minutes, true, shape);

    [TestMethod]
    public void A_name_and_a_fee_are_an_area_and_the_list_keeps_its_order()
    {
        var (zones, problem) = DeliveryZoneRules.Check([Zone("Maadi Degla", "دجلة المعادي", 25, 100, 45), Zone("Zahraa", fee: 35)], Lat, Lng);

        Assert.IsNull(problem);
        CollectionAssert.AreEqual(new[] { "Maadi Degla", "Zahraa" }, zones!.Select(z => z.Name!.En).ToArray());
        Assert.AreEqual(100m, zones[0].MinimumOrder);
        Assert.IsNull(zones[1].MinimumOrder, "none said: the branch's own minimum holds");
        Assert.IsNull(zones[1].Shape, "only a name: picked by staff");
    }

    [TestMethod]
    public void A_drawn_area_is_held_to_the_rules_of_the_branch_s_own()
    {
        double[][] closed = [.. Square, Square[0]];
        var (zones, problem) = DeliveryZoneRules.Check([Zone("Drawn", shape: closed)], Lat, Lng);
        Assert.IsNull(problem);
        Assert.HasCount(4, zones![0].Shape!, "the repeated closing point is dropped");

        var (_, crossed) = DeliveryZoneRules.Check([Zone("Bow tie", shape: [Square[0], Square[2], Square[1], Square[3]])], Lat, Lng);
        StringAssert.Contains(crossed, "cross");
        StringAssert.Contains(crossed, "Bow tie", "the owner is told which area");

        var (_, unplaced) = DeliveryZoneRules.Check([Zone("Drawn", shape: Square)], null, null);
        StringAssert.Contains(unplaced, "location", "a branch with no place on the map has nowhere to draw round");

        var (named, _) = DeliveryZoneRules.Check([Zone("Only a name")], null, null);
        Assert.HasCount(1, named!, "but a name needs no map");
    }

    [TestMethod]
    public void What_is_not_an_area_is_refused_and_said()
    {
        string? Refused(params DeliveryZoneRequest[] zones) => DeliveryZoneRules.Check(zones, Lat, Lng).Problem;

        StringAssert.Contains(Refused(new DeliveryZoneRequest(null, new LocalizedText(" ", null), 10)), "needs a name");
        StringAssert.Contains(Refused(new DeliveryZoneRequest(null, null, 10)), "needs a name");
        StringAssert.Contains(Refused(Zone(new string('a', 81))), "80 characters");
        StringAssert.Contains(Refused(Zone("Free?", fee: -1)), "fee");
        StringAssert.Contains(Refused(Zone("Small", minimum: -5)), "minimum");
        StringAssert.Contains(Refused(Zone("Fast", minutes: 2)), "between 5 and 240");
        StringAssert.Contains(Refused(Zone("Slow", minutes: 500)), "between 5 and 240");
        StringAssert.Contains(Refused(Zone("Maadi"), Zone("maadi")), "Two delivery areas", "one name, one fee: an agent typing it must land on one");
        StringAssert.Contains(Refused(Zone("A", "المعادي"), Zone("B", "المعادي")), "Two delivery areas");
        StringAssert.Contains(Refused(Zone("A", id: 7), Zone("B", id: 7)), "twice");
        StringAssert.Contains(
            DeliveryZoneRules.Check([.. Enumerable.Range(0, 101).Select(i => Zone($"Area {i}"))], Lat, Lng).Problem,
            "up to 100");
    }

    [TestMethod]
    public void No_list_is_an_empty_one_and_a_free_area_is_an_area()
    {
        Assert.IsEmpty(DeliveryZoneRules.Check(null, Lat, Lng).Zones!);
        Assert.IsNull(DeliveryZoneRules.Check([Zone("Maadi", "Maadi")], Lat, Lng).Problem, "written the same in both languages: one name, not two areas");
        Assert.IsNull(DeliveryZoneRules.Check([Zone("Next door", fee: 0)], Lat, Lng).Problem);
    }
}
