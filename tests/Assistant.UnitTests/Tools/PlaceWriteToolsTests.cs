using System.Net;
using System.Text.Json;
using Ninja.Assistant.API.Tools;
using Ninja.Assistant.UnitTests.Support;
using static Ninja.Assistant.UnitTests.Tools.FinanceWriteToolsTests;

namespace Ninja.Assistant.UnitTests.Tools;

[TestClass]
public sealed class PlaceWriteToolsTests
{
    private static PlaceWriteTools Tools(Bench bench) => new(bench.Tenant, bench.Api, Flow(bench));

    private static HttpResponseMessage Ok(HttpRequestMessage _) => new(HttpStatusCode.OK);

    /// <summary>Table 1 and a two-rate VIP room at Nasr City; a one-rate pool table at Maadi</summary>
    private static Bench Floor()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "spaces-api/api/places", r => r.Headers.GetValues("X-Branch-Id").First() == "1"
            ? new object[]
            {
                new { id = 1, kind = 2, name = new { en = "Table 1", ar = "طاولة ١" }, description = (object?)null, branchId = 1, isActive = true, tariff = (object?)null, isTimed = false, reservable = false },
                new
                {
                    id = 2, kind = 1, name = new { en = "VIP Room", ar = "غرفة VIP" }, description = new { en = "Big screen", ar = (string?)null }, branchId = 1, isActive = true,
                    tariff = new { options = new object[] { new { code = "single", name = new { en = "Single", ar = "سنجل" }, hourlyRate = 80 }, new { code = "multi", name = new { en = "Multi", ar = "ملتي" }, hourlyRate = 120 } }, roundingMinutes = 15 },
                    isTimed = true, reservable = true,
                },
            }
            : new object[]
            {
                new
                {
                    id = 7, kind = 3, name = new { en = "Pool table", ar = "بلياردو" }, description = (object?)null, branchId = 2, isActive = true,
                    tariff = new { options = new object[] { new { code = "standard", name = new { en = "Standard", ar = "عادي" }, hourlyRate = 60 } }, roundingMinutes = 15 },
                    isTimed = true, reservable = false,
                },
            });
        return bench;
    }

    [TestMethod]
    public async Task A_room_is_previewed_with_its_rates_then_posted_to_its_branch()
    {
        var bench = Floor();
        bench.Handler.On("POST", "spaces-api/api/places", _ => FakeHandler.Json(15, HttpStatusCode.Created));
        var tools = Tools(bench);
        List<PlaceWriteTools.RateInput> rates = [new("Single", 90), new("Multi", 140)];

        var preview = await tools.CreatePlace("Room 3", "room", "غرفة ٣", branch: "Nasr City", rates: rates, requestId: "r1");
        Assert.AreNotEqual(true, preview.IsError, Bench.TextOf(preview));
        var text = Bench.JsonOf(preview).GetProperty("preview").GetString()!;
        StringAssert.Contains(text, "Add the room \"Room 3 / غرفة ٣\" at Nasr City");
        StringAssert.Contains(text, "Single EGP 90 an hour, Multi EGP 140 an hour, rounded to 15 min");
        Assert.IsFalse(Writes(bench).Any());

        var done = await tools.CreatePlace("Room 3", "room", "غرفة ٣", branch: "Nasr City", rates: rates, requestId: "r1", confirm: true);
        Assert.AreEqual(15, Bench.JsonOf(done).GetProperty("placeId").GetInt32());
        var post = Writes(bench).Single();
        Assert.AreEqual("1", post.Branch);
        using var body = JsonDocument.Parse(post.Body!);
        Assert.AreEqual(1, body.RootElement.GetProperty("kind").GetInt32());
        var options = body.RootElement.GetProperty("tariff").GetProperty("options");
        Assert.AreEqual("single", options[0].GetProperty("code").GetString());
        Assert.AreEqual(140m, options[1].GetProperty("hourlyRate").GetDecimal());
    }

    [TestMethod]
    public async Task A_place_of_the_same_name_is_not_added_twice()
    {
        var bench = Floor();
        var preview = await Tools(bench).CreatePlace("table 1", branch: "1");
        Assert.IsTrue(preview.IsError);
        var retried = await Tools(bench).CreatePlace("Table 1", branch: "1", requestId: "r1", confirm: true);
        Assert.AreNotEqual(true, retried.IsError);
        Assert.IsFalse(Writes(bench).Any());
    }

    [TestMethod]
    public async Task A_rename_keeps_the_other_language_and_the_description()
    {
        var bench = Floor();
        bench.Handler.On("PUT", "spaces-api/api/places/2", Ok);
        var tools = Tools(bench);

        var preview = await tools.UpdatePlace("vip", newName: "Gold Room", requestId: "r1");
        StringAssert.Contains(Bench.JsonOf(preview).GetProperty("preview").GetString(), "name \"VIP Room / غرفة VIP\" → \"Gold Room / غرفة VIP\"");
        Assert.IsFalse(Writes(bench).Any());

        await tools.UpdatePlace("vip", newName: "Gold Room", requestId: "r1", confirm: true);
        var put = Writes(bench).Single();
        Assert.AreEqual("1", put.Branch);
        using var body = JsonDocument.Parse(put.Body!);
        Assert.AreEqual("Gold Room", body.RootElement.GetProperty("name").GetProperty("en").GetString());
        Assert.AreEqual("غرفة VIP", body.RootElement.GetProperty("name").GetProperty("ar").GetString());
        Assert.AreEqual("Big screen", body.RootElement.GetProperty("description").GetProperty("en").GetString());
    }

    [TestMethod]
    public async Task A_new_rate_keeps_the_codes_running_bills_refer_to()
    {
        var bench = Floor();
        bench.Handler.On("PUT", "spaces-api/api/places/7/tariff", Ok);
        var tools = Tools(bench);

        var preview = await tools.SetPlaceTariff("Pool table", hourlyRate: 70, requestId: "r1");
        StringAssert.Contains(Bench.JsonOf(preview).GetProperty("preview").GetString(), "EGP 60 an hour, rounded to 15 min → Standard / عادي EGP 70 an hour");
        Assert.IsFalse(Writes(bench).Any());

        await tools.SetPlaceTariff("Pool table", hourlyRate: 70, requestId: "r1", confirm: true);
        var put = Writes(bench).Single();
        Assert.AreEqual("2", put.Branch, "found across the branches, sent to its own");
        using var body = JsonDocument.Parse(put.Body!);
        var option = body.RootElement.GetProperty("tariff").GetProperty("options")[0];
        Assert.AreEqual("standard", option.GetProperty("code").GetString());
        Assert.AreEqual(70m, option.GetProperty("hourlyRate").GetDecimal());
    }

    [TestMethod]
    public async Task One_rate_for_a_two_rate_room_is_refused_and_remove_sends_no_tariff()
    {
        var bench = Floor();
        bench.Handler.On("PUT", "spaces-api/api/places/2/tariff", Ok);
        var one = await Tools(bench).SetPlaceTariff("VIP Room", hourlyRate: 100);
        Assert.IsTrue(one.IsError);
        StringAssert.Contains(Bench.TextOf(one), "give each one in rates");

        await Tools(bench).SetPlaceTariff("VIP Room", remove: true, requestId: "r1", confirm: true);
        using var body = JsonDocument.Parse(Writes(bench).Single().Body!);
        Assert.AreEqual(JsonValueKind.Null, body.RootElement.GetProperty("tariff").ValueKind);
    }

    [TestMethod]
    public async Task Reservable_and_active_put_their_switch()
    {
        var bench = Floor();
        bench.Handler.On("PUT", "spaces-api/api/places/1/reservable", Ok);
        bench.Handler.On("PUT", "spaces-api/api/places/1/active", Ok);
        var tools = Tools(bench);

        var preview = await tools.SetPlaceReservable("طاولة ١", true, requestId: "r1");
        StringAssert.Contains(Bench.JsonOf(preview).GetProperty("preview").GetString(), "Open table \"Table 1 / طاولة ١\" at Nasr City / مدينة نصر to reservations");
        var off = await tools.SetPlaceActive("Table 1", false, requestId: "r2");
        StringAssert.Contains(Bench.JsonOf(off).GetProperty("preview").GetString(), "out of use");
        Assert.IsFalse(Writes(bench).Any());

        await tools.SetPlaceReservable("1", true, requestId: "r1", confirm: true);
        await tools.SetPlaceActive("1", false, requestId: "r2", confirm: true);
        var writes = Writes(bench).ToList();
        Assert.AreEqual(2, writes.Count);
        Assert.AreEqual("/api/places/1/reservable", writes[0].Url.AbsolutePath);
        Assert.IsTrue(JsonDocument.Parse(writes[0].Body!).RootElement.GetProperty("reservable").GetBoolean());
        Assert.AreEqual("/api/places/1/active", writes[1].Url.AbsolutePath);
        Assert.IsFalse(JsonDocument.Parse(writes[1].Body!).RootElement.GetProperty("isActive").GetBoolean());
    }
}
