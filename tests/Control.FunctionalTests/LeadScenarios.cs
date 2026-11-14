using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Ninja.Control.API.Apis;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.FunctionalTests;

/// <summary>A request for a demo: anyone leaves one from the site, only the platform reads it, and it stamps nothing.</summary>
[TestClass]
public sealed class LeadScenarios
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    // The smallest PNG there is: one transparent pixel
    private static readonly byte[] Png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");

    private static MultipartFormDataContent Form(string business, Action<MultipartFormDataContent>? more = null, int photos = 0, string phone = "+20 111 097 0097")
    {
        var form = new MultipartFormDataContent
        {
            { new StringContent("Mona"), "name" },
            { new StringContent(business), "business" },
            { new StringContent(phone), "phone" },
            { new StringContent("GameStation"), "businessType" },
            { new StringContent("ar"), "language" },
        };
        for (var i = 0; i < photos; i++)
        {
            var photo = new ByteArrayContent(Png);
            photo.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            form.Add(photo, "photos", $"menu-{i}.png");
        }
        more?.Invoke(form);
        return form;
    }

    /// <summary>Each visitor from an address of their own, the way the edge passes it on.</summary>
    private static HttpClient Visitor()
    {
        var client = Api.AsPlatformAdmin().Anonymous();
        client.DefaultRequestHeaders.Add("X-Forwarded-For", $"203.0.{Random.Shared.Next(1, 250)}.{Random.Shared.Next(1, 250)}, 10.0.0.1");
        return client;
    }

    private static async Task<List<LeadDto>> LeadsAsync(HttpClient admin)
        => (await admin.GetFromJsonAsync<List<LeadDto>>("/api/control/leads", Json))!;

    [TestMethod]
    public async Task A_visitor_asks_for_a_demo_and_the_platform_reads_it_with_its_photos_and_where_it_came_from()
    {
        var api = Api.AsPlatformAdmin();
        var admin = ControlPlane.Factory.CreateClient();
        var business = $"Level Up {Guid.NewGuid():N}"[..20];

        var sent = await Visitor().PostAsync("/api/control/leads", Form(business, photos: 2, more: f =>
        {
            f.Add(new StringContent("facebook"), "source");
            f.Add(new StringContent("reel"), "medium");
            f.Add(new StringContent("Chillax"), "ref");
        }));
        Assert.AreEqual(HttpStatusCode.Accepted, sent.StatusCode);

        var lead = (await LeadsAsync(admin)).Single(l => l.Business == business);
        Assert.AreEqual("Mona", lead.Name);
        Assert.AreEqual("+201110970097", lead.Phone);
        Assert.AreEqual(BusinessType.GameStation, lead.BusinessType);
        Assert.AreEqual("ar", lead.Language);
        Assert.AreEqual("facebook", lead.Source);
        Assert.AreEqual("reel", lead.Medium);
        Assert.AreEqual("chillax", lead.Ref);
        Assert.AreEqual(LeadStatus.New, lead.Status);
        Assert.HasCount(2, lead.Photos);

        var photo = await admin.GetAsync($"/api/control/leads/{lead.Id}/photos/{lead.Photos[0]}");
        Assert.AreEqual(HttpStatusCode.OK, photo.StatusCode);
        Assert.AreEqual("image/png", photo.Content.Headers.ContentType?.MediaType);
        CollectionAssert.AreEqual(Png, await photo.Content.ReadAsByteArrayAsync());

        // The demo made for it: the request says which, and lets its photos go
        var slug = Api.Slug("lead");
        await api.CreateAsync(slug);
        var updated = await admin.PutAsJsonAsync($"/api/control/leads/{lead.Id}", new UpdateLeadRequest(LeadStatus.DemoCreated, "called", slug), Json);
        Assert.AreEqual(HttpStatusCode.OK, updated.StatusCode);
        var after = (await LeadsAsync(admin)).Single(l => l.Id == lead.Id);
        Assert.AreEqual(LeadStatus.DemoCreated, after.Status);
        Assert.AreEqual(slug, after.TenantSlug);
        Assert.IsEmpty(after.Photos);

        Assert.AreEqual(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/control/leads/{lead.Id}")).StatusCode);
        Assert.IsFalse((await LeadsAsync(admin)).Any(l => l.Id == lead.Id));
    }

    [TestMethod]
    public async Task A_request_without_a_reachable_phone_or_with_a_file_that_is_no_photo_is_refused()
    {
        Assert.AreEqual(HttpStatusCode.BadRequest, (await Visitor().PostAsync("/api/control/leads", Form("No Phone", phone: "abc"))).StatusCode);

        var notAPhoto = Form("Not A Photo", f =>
        {
            var file = new ByteArrayContent("<html>"u8.ToArray());
            file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            f.Add(file, "photos", "menu.png");
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, (await Visitor().PostAsync("/api/control/leads", notAPhoto)).StatusCode);
        Assert.AreEqual(HttpStatusCode.BadRequest, (await Visitor().PostAsync("/api/control/leads", Form("Too Many", photos: ControlApi.LeadMaxPhotos + 1))).StatusCode);
    }

    [TestMethod]
    public async Task A_robot_that_fills_the_hidden_field_is_told_yes_and_nothing_is_kept()
    {
        var business = $"Robot {Guid.NewGuid():N}"[..18];
        var sent = await Visitor().PostAsync("/api/control/leads", Form(business, f => f.Add(new StringContent("http://spam.example"), "website")));
        Assert.AreEqual(HttpStatusCode.Accepted, sent.StatusCode);
        Assert.IsFalse((await LeadsAsync(ControlPlane.Factory.CreateClient())).Any(l => l.Business == business));
    }

    [TestMethod]
    public async Task One_visitor_may_ask_a_handful_of_times_and_then_waits()
    {
        var visitor = Api.AsPlatformAdmin().Anonymous();
        visitor.DefaultRequestHeaders.Add("X-Forwarded-For", "198.51.100.7");
        for (var i = 0; i < 5; i++)
            Assert.AreEqual(HttpStatusCode.Accepted, (await visitor.PostAsync("/api/control/leads", Form($"Again {i}"))).StatusCode);
        Assert.AreEqual(HttpStatusCode.TooManyRequests, (await visitor.PostAsync("/api/control/leads", Form("Again 6"))).StatusCode);
    }

    [TestMethod]
    public async Task Nobody_but_the_platform_reads_or_changes_the_requests()
    {
        var anonymous = Api.AsPlatformAdmin().Anonymous();
        Assert.AreEqual(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/control/leads")).StatusCode);
        Assert.AreEqual(HttpStatusCode.Unauthorized, (await anonymous.DeleteAsync("/api/control/leads/1")).StatusCode);
        Assert.AreEqual(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/control/leads/1/photos/1")).StatusCode);
    }
}
