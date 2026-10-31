using System.Text.Json.Nodes;
using Ninja.Identity.API.IntegrationEvents;

namespace Identity.UnitTests;

/// <summary>
/// What the other services hear when a profile changes is the name and phone
/// as Keycloak now holds them, whatever the app sent to change them.
/// </summary>
[TestClass]
public class ProfileEventTests
{
    [TestMethod]
    public void The_event_carries_the_saved_name_whole_and_in_parts_with_the_phone()
    {
        var user = new JsonObject
        {
            ["firstName"] = "Mostafa",
            ["lastName"] = "Kamel",
            ["attributes"] = new JsonObject { ["phoneNumber"] = new JsonArray("+201000000000") },
        };

        var e = UserProfileUpdatedIntegrationEvent.From("u1", user);

        Assert.AreEqual("u1", e.UserId);
        Assert.AreEqual("Mostafa Kamel", e.DisplayName);
        Assert.AreEqual("Mostafa", e.FirstName);
        Assert.AreEqual("Kamel", e.LastName);
        Assert.AreEqual("+201000000000", e.PhoneNumber);
    }

    [TestMethod]
    public void A_first_name_alone_and_no_phone_reads_as_just_that()
    {
        var e = UserProfileUpdatedIntegrationEvent.From("u1", new JsonObject { ["firstName"] = "Mona", ["lastName"] = "" });

        Assert.AreEqual("Mona", e.DisplayName);
        Assert.IsNull(e.LastName);
        Assert.IsNull(e.PhoneNumber);
    }
}
