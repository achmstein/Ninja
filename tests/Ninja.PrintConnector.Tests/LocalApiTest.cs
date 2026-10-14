using System.Drawing;
using System.Drawing.Imaging;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.TestHost;

namespace Ninja.PrintConnector.Tests;

[TestClass]
public sealed class LocalApiTest
{
    private const string Server = "https://api.chillax.ninjapp.net";
    private const string Till = "https://pos.chillax.ninjapp.net";

    private sealed class FakeSink : IPrinterSink
    {
        public List<(string Where, byte[] Bytes)> Sent { get; } = [];
        public Exception? Fails { get; init; }

        public IReadOnlyList<string> Installed() => ["EPSON TM-T20", "Kitchen"];

        public void SendToWindows(string printerName, byte[] bytes)
        {
            if (Fails is not null) throw Fails;
            Sent.Add((printerName, bytes));
        }

        public Task SendToNetworkAsync(string host, int port, byte[] bytes, CancellationToken ct)
        {
            if (Fails is not null) throw Fails;
            Sent.Add(($"{host}:{port}", bytes));
            return Task.CompletedTask;
        }
    }

    public TestContext TestContext { get; set; } = null!;

    private Task<HttpResponseMessage> Send(HttpClient client, HttpRequestMessage request) =>
        client.SendAsync(request, TestContext.CancellationToken);

    private async Task<(WebApplication App, HttpClient Client)> StartAsync(FakeSink sink)
    {
        var app = LocalApi.Build(Server, sink, builder => builder.WebHost.UseTestServer());
        await app.StartAsync(TestContext.CancellationToken);
        return (app, app.GetTestClient());
    }

    private static HttpRequestMessage Request(HttpMethod method, string path, string? origin = Till, object? json = null)
    {
        var request = new HttpRequestMessage(method, path);
        if (origin is not null) request.Headers.Add("Origin", origin);
        if (json is not null) request.Content = JsonContent.Create(json);
        return request;
    }

    private static string Png(int width = 40, int height = 20)
    {
        using var image = new Bitmap(width, height);
        using (var graphics = Graphics.FromImage(image))
        {
            graphics.Clear(Color.White);
            graphics.FillRectangle(Brushes.Black, 0, 0, width / 2, height / 2);
        }
        using var stream = new MemoryStream();
        image.Save(stream, ImageFormat.Png);
        return Convert.ToBase64String(stream.ToArray());
    }

    [TestMethod]
    public async Task Status_names_the_pc_and_its_printers_to_the_till()
    {
        var (app, client) = await StartAsync(new FakeSink());
        await using var _ = app;

        var response = await Send(client, Request(HttpMethod.Get, "/v1/status"));

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        Assert.AreEqual(Till, response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        Assert.AreEqual("Origin", response.Headers.Vary.Single());
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.CancellationToken));
        Assert.AreEqual(Environment.MachineName, json.RootElement.GetProperty("name").GetString());
        Assert.IsFalse(string.IsNullOrEmpty(json.RootElement.GetProperty("version").GetString()));
        CollectionAssert.AreEqual(
            new[] { "EPSON TM-T20", "Kitchen" },
            json.RootElement.GetProperty("printers").EnumerateArray().Select(p => p.GetString()).ToArray());
    }

    [TestMethod]
    [DataRow(null)]
    [DataRow("https://evil.example.com")]
    public async Task Another_site_or_no_site_is_refused(string? origin)
    {
        var sink = new FakeSink();
        var (app, client) = await StartAsync(sink);
        await using var _ = app;

        var status = await Send(client, Request(HttpMethod.Get, "/v1/status", origin));
        var print = await Send(client, Request(HttpMethod.Post, "/v1/print", origin,
            new { printer = new { name = "Kitchen" }, image = Png(), kickDrawer = true }));

        Assert.AreEqual(HttpStatusCode.Forbidden, status.StatusCode);
        Assert.AreEqual(HttpStatusCode.Forbidden, print.StatusCode);
        Assert.IsFalse(status.Headers.Contains("Access-Control-Allow-Origin"));
        Assert.IsEmpty(sink.Sent);
    }

    [TestMethod]
    public async Task The_preflight_says_yes_to_the_till_on_the_private_network()
    {
        var (app, client) = await StartAsync(new FakeSink());
        await using var _ = app;

        var request = Request(HttpMethod.Options, "/v1/print");
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Private-Network", "true");
        var response = await Send(client, request);

        Assert.AreEqual(HttpStatusCode.NoContent, response.StatusCode);
        Assert.AreEqual(Till, response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        Assert.AreEqual("GET, POST", response.Headers.GetValues("Access-Control-Allow-Methods").Single());
        Assert.AreEqual("Content-Type", response.Headers.GetValues("Access-Control-Allow-Headers").Single());
        Assert.AreEqual("true", response.Headers.GetValues("Access-Control-Allow-Private-Network").Single());
        Assert.AreEqual("600", response.Headers.GetValues("Access-Control-Max-Age").Single());
    }

    [TestMethod]
    public async Task The_preflight_from_another_site_is_refused()
    {
        var (app, client) = await StartAsync(new FakeSink());
        await using var _ = app;

        var response = await Send(client, Request(HttpMethod.Options, "/v1/print", "https://evil.example.com"));

        Assert.AreEqual(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [TestMethod]
    public async Task A_post_that_is_not_json_is_refused()
    {
        var sink = new FakeSink();
        var (app, client) = await StartAsync(sink);
        await using var _ = app;

        var request = Request(HttpMethod.Post, "/v1/drawer");
        request.Content = new StringContent("printer=Kitchen", Encoding.UTF8, "text/plain");
        var response = await Send(client, request);

        Assert.AreEqual(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
        Assert.IsEmpty(sink.Sent);
    }

    [TestMethod]
    public async Task A_receipt_prints_on_the_windows_printer_and_opens_the_drawer()
    {
        var sink = new FakeSink();
        var (app, client) = await StartAsync(sink);
        await using var _ = app;

        var response = await Send(client, Request(HttpMethod.Post, "/v1/print",
            json: new { printer = new { name = "EPSON TM-T20" }, image = Png(), kickDrawer = true }));

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        Assert.AreEqual("{\"ok\":true}", await response.Content.ReadAsStringAsync(TestContext.CancellationToken));
        var (where, bytes) = sink.Sent.Single();
        Assert.AreEqual("EPSON TM-T20", where);
        CollectionAssert.AreEqual(new byte[] { 0x1B, 0x40, 0x1B, 0x70, 0x00, 0x19, 0xFA }, bytes[..7]);
        CollectionAssert.AreEqual(new byte[] { 0x1D, 0x56, 0x01 }, bytes[^3..]);
    }

    [TestMethod]
    public async Task A_wide_picture_comes_out_as_wide_as_the_paper()
    {
        var sink = new FakeSink();
        var (app, client) = await StartAsync(sink);
        await using var _ = app;

        await Send(client, Request(HttpMethod.Post, "/v1/print",
            json: new { printer = new { name = "Kitchen" }, image = Png(1152, 40), kickDrawer = false }));

        // GS v 0 m xL xH: bytes across = 576 dots / 8
        var bytes = sink.Sent.Single().Bytes;
        var band = bytes.AsSpan().IndexOf(new byte[] { 0x1D, 0x76, 0x30, 0x00 });
        Assert.AreEqual(EscPos.PaperDots / 8, bytes[band + 4] | (bytes[band + 5] << 8));
    }

    [TestMethod]
    public async Task A_network_printer_is_reached_on_9100_unless_told()
    {
        var sink = new FakeSink();
        var (app, client) = await StartAsync(sink);
        await using var _ = app;

        await Send(client, Request(HttpMethod.Post, "/v1/print",
            json: new { printer = new { host = "192.168.1.50" }, image = Png(), kickDrawer = false }));
        await Send(client, Request(HttpMethod.Post, "/v1/print",
            json: new { printer = new { host = "192.168.1.51", port = 9101 }, image = Png(), kickDrawer = false }));

        CollectionAssert.AreEqual(new[] { "192.168.1.50:9100", "192.168.1.51:9101" }, sink.Sent.Select(s => s.Where).ToArray());
    }

    [TestMethod]
    public async Task The_drawer_alone_is_the_reset_and_the_kick()
    {
        var sink = new FakeSink();
        var (app, client) = await StartAsync(sink);
        await using var _ = app;

        var response = await Send(client, Request(HttpMethod.Post, "/v1/drawer",
            json: new { printer = new { name = "EPSON TM-T20" } }));

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        CollectionAssert.AreEqual(EscPos.Kick(), sink.Sent.Single().Bytes);
    }

    [TestMethod]
    [DataRow("{\"image\":\"AAAA\",\"kickDrawer\":false}")]
    [DataRow("{\"printer\":{},\"image\":\"AAAA\"}")]
    [DataRow("{\"printer\":{\"host\":\"10.0.0.9\",\"port\":70000},\"image\":\"AAAA\"}")]
    [DataRow("{\"printer\":{\"name\":\"Kitchen\"}}")]
    [DataRow("{\"printer\":{\"name\":\"Kitchen\"},\"image\":\"not base64!\"}")]
    [DataRow("{\"printer\":{\"name\":\"Kitchen\"},\"image\":\"AAAA\"}")]
    [DataRow("{not json")]
    public async Task A_bad_request_says_why_and_prints_nothing(string body)
    {
        var sink = new FakeSink();
        var (app, client) = await StartAsync(sink);
        await using var _ = app;

        var request = Request(HttpMethod.Post, "/v1/print");
        request.Content = new StringContent(body, Encoding.UTF8, "application/json");
        var response = await Send(client, request);

        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.CancellationToken));
        Assert.IsFalse(string.IsNullOrEmpty(json.RootElement.GetProperty("error").GetString()));
        Assert.IsEmpty(sink.Sent);
    }

    [TestMethod]
    public async Task A_printer_that_fails_is_a_bad_gateway_with_the_reason()
    {
        var sink = new FakeSink { Fails = new IOException("Windows has no printer named \"Gone\"") };
        var (app, client) = await StartAsync(sink);
        await using var _ = app;

        var response = await Send(client, Request(HttpMethod.Post, "/v1/print",
            json: new { printer = new { name = "Gone" }, image = Png(), kickDrawer = false }));

        Assert.AreEqual(HttpStatusCode.BadGateway, response.StatusCode);
        Assert.AreEqual(Till, response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.CancellationToken));
        Assert.AreEqual("Windows has no printer named \"Gone\"", json.RootElement.GetProperty("error").GetString());
    }
}
