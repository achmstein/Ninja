using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Ninja.Branch.API.Services;
using SkiaSharp;

namespace Ninja.Branch.UnitTests;

/// <summary>
/// One upload gives the logo, trimmed, and every icon the manifests point at;
/// without an upload the icons are still there, as a tile in the brand color.
/// </summary>
[TestClass]
public sealed class TenantBrandStoreTests
{
    private string _root = null!;
    private TenantBrandStore _store = null!;

    [TestInitialize]
    public void Setup()
    {
        _root = Path.Combine(Path.GetTempPath(), "ninja-brand-tests", Guid.NewGuid().ToString("N"));
        _store = new TenantBrandStore(new FakeEnvironment(_root), Options.Create(new TenantStorageOptions { Path = _root }));
    }

    [TestCleanup]
    public void Cleanup()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }

    [TestMethod]
    public async Task Upload_trims_the_transparent_margins_and_cuts_every_icon()
    {
        // A 400×200 canvas with a 200×100 red mark in the middle and nothing around it
        var error = await _store.SaveLogoAsync(PngFile(400, 200, SKRect.Create(100, 50, 200, 100)), CancellationToken.None);

        Assert.IsNull(error);

        using var logo = SKBitmap.Decode(_store.PathOf(TenantBrandStore.LogoFile));
        Assert.AreEqual(200, logo.Width);
        Assert.AreEqual(100, logo.Height);

        foreach (var (name, spec) in TenantBrandStore.Icons)
        {
            Assert.IsTrue(_store.Exists(name), $"{name} was not written");
            using var icon = SKBitmap.Decode(_store.PathOf(name));
            Assert.AreEqual(spec.Size, icon.Width, name);
            Assert.AreEqual(spec.Size, icon.Height, name);
            // Opaque white behind the mark: the corner is never part of a logo
            Assert.AreEqual(SKColors.White, icon.GetPixel(1, 1), $"{name} corner");
            // And the mark is in the middle
            var centre = icon.GetPixel(spec.Size / 2, spec.Size / 2);
            Assert.IsTrue(centre.Red > 200 && centre.Green < 60 && centre.Blue < 60, $"{name} centre was {centre}");
        }
    }

    [TestMethod]
    public async Task Upload_keeps_the_logo_within_the_size_cap()
    {
        var error = await _store.SaveLogoAsync(PngFile(3000, 1500, SKRect.Create(0, 0, 3000, 1500)), CancellationToken.None);

        Assert.IsNull(error);
        using var logo = SKBitmap.Decode(_store.PathOf(TenantBrandStore.LogoFile));
        Assert.AreEqual(1024, logo.Width);
        Assert.AreEqual(512, logo.Height);
    }

    [TestMethod]
    public async Task Upload_rejects_what_is_not_an_image()
    {
        var bytes = "<svg xmlns='http://www.w3.org/2000/svg'/>"u8.ToArray();
        var file = new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", "logo.svg");

        var error = await _store.SaveLogoAsync(file, CancellationToken.None);

        Assert.IsNotNull(error);
        Assert.IsFalse(_store.Exists(TenantBrandStore.LogoFile));
    }

    [TestMethod]
    public async Task Delete_removes_the_logo_and_the_icons()
    {
        await _store.SaveLogoAsync(PngFile(64, 64, SKRect.Create(0, 0, 64, 64)), CancellationToken.None);

        _store.DeleteLogo();

        Assert.IsFalse(_store.Exists(TenantBrandStore.LogoFile));
        foreach (var name in TenantBrandStore.Icons.Keys)
            Assert.IsFalse(_store.Exists(name), name);
    }

    [TestMethod]
    public void Placeholder_is_a_tile_in_the_brand_color()
    {
        var spec = TenantBrandStore.Icons["icon-192.png"];

        using var icon = SKBitmap.Decode(TenantBrandStore.RenderPlaceholder(spec, "#ff6600"));

        Assert.AreEqual(192, icon.Width);
        Assert.AreEqual(new SKColor(0xff, 0x66, 0x00), icon.GetPixel(2, 2));
    }

    [TestMethod]
    public void Placeholder_falls_back_to_the_neutral_color_for_a_bad_value()
    {
        var spec = TenantBrandStore.Icons["favicon.png"];

        using var icon = SKBitmap.Decode(TenantBrandStore.RenderPlaceholder(spec, "not-a-color"));

        Assert.AreEqual(new SKColor(0x18, 0x18, 0x1b), icon.GetPixel(1, 1));
    }

    private static IFormFile PngFile(int width, int height, SKRect mark)
    {
        using var surface = SKSurface.Create(new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Premul));
        surface.Canvas.Clear(SKColors.Transparent);
        using var paint = new SKPaint { Color = SKColors.Red };
        surface.Canvas.DrawRect(mark, paint);
        using var image = surface.Snapshot();
        using var data = image.Encode(SKEncodedImageFormat.Png, 100);
        var bytes = data.ToArray();
        return new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", "logo.png") { Headers = new HeaderDictionary(), ContentType = "image/png" };
    }

    private sealed class FakeEnvironment(string root) : IWebHostEnvironment
    {
        public string ContentRootPath { get; set; } = root;
        public string WebRootPath { get; set; } = root;
        public string EnvironmentName { get; set; } = "Test";
        public string ApplicationName { get; set; } = "Branch.UnitTests";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
