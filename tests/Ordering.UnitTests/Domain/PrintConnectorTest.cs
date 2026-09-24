namespace Ninja.Ordering.UnitTests.Domain;

using Ninja.Ordering.Domain.AggregatesModel.KitchenAggregate;
using Ninja.Ordering.Domain.Seedwork;

/// <summary>
/// A print connector is paired once with a short code an owner makes, and
/// from then on proves itself with the key it was handed.
/// </summary>
[TestClass]
public class PrintConnectorTest
{
    private static readonly DateTime Now = new(2026, 9, 24, 20, 0, 0, DateTimeKind.Utc);

    [TestMethod]
    public void A_code_is_eight_characters_nobody_misreads()
    {
        var pairing = ConnectorPairing.New(1, "ar", Now);

        Assert.AreEqual(8, pairing.Code.Length);
        Assert.IsFalse(pairing.Code.Any(c => "01OI".Contains(c)), pairing.Code);
        Assert.AreEqual(Now + ConnectorPairing.Lifetime, pairing.ExpiresAt);
    }

    [TestMethod]
    public void A_code_typed_with_dashes_and_lower_case_is_the_same_code()
    {
        Assert.AreEqual("ABCD2345", ConnectorPairing.Normalize("abcd-2345 "));
    }

    [TestMethod]
    public void Pairing_hands_out_a_key_that_only_its_connector_holds()
    {
        var (connector, key) = PrintConnector.Pair(ConnectorPairing.New(7, "en", Now), "COUNTER-PC", Now);

        Assert.AreEqual(7, connector.BranchId);
        Assert.AreEqual("COUNTER-PC", connector.Name);
        Assert.AreEqual("en", connector.Language);
        Assert.IsTrue(connector.Holds(key));
        Assert.IsFalse(connector.Holds(key + "0"));
        Assert.AreNotEqual(key, connector.KeyHash, "only the hash is kept");
    }

    [TestMethod]
    public void A_code_is_good_once()
    {
        var pairing = ConnectorPairing.New(1, "ar", Now);
        PrintConnector.Pair(pairing, "PC", Now);

        Assert.ThrowsExactly<OrderingDomainException>(() => PrintConnector.Pair(pairing, "Another PC", Now));
    }

    [TestMethod]
    public void A_code_is_good_for_ten_minutes()
    {
        var pairing = ConnectorPairing.New(1, "ar", Now);

        Assert.ThrowsExactly<OrderingDomainException>(() => PrintConnector.Pair(pairing, "PC", Now + TimeSpan.FromMinutes(11)));
    }

    [TestMethod]
    public void A_check_in_keeps_the_printers_windows_has()
    {
        var (connector, _) = PrintConnector.Pair(ConnectorPairing.New(1, "ar", Now), "PC", Now);

        connector.Seen(["XP-80C", " Kitchen ", "XP-80C", ""], Now);

        CollectionAssert.AreEqual(new[] { "Kitchen", "XP-80C" }, connector.Printers);
        Assert.AreEqual(Now, connector.LastSeenAt);
    }

    [TestMethod]
    public void A_station_prints_on_a_connector_s_printer_by_name_and_on_nothing_else()
    {
        var station = new KitchenStation(1, new LocalizedText("Shisha"), [], false, true, "10.0.0.9", null, false, 0,
            connectorId: 4, printerName: "XP-80C");

        Assert.AreEqual(4, station.ConnectorId);
        Assert.AreEqual("XP-80C", station.PrinterName);
        Assert.IsNull(station.PrinterHost, "one printer per station");
    }

    [TestMethod]
    public void A_connector_without_a_printer_picked_is_refused()
    {
        Assert.ThrowsExactly<OrderingDomainException>(() =>
            new KitchenStation(1, new LocalizedText("Shisha"), [], false, true, null, null, false, 0, connectorId: 4));
    }
}
