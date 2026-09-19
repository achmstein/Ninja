using Ninja.AI.Images;
using Microsoft.AspNetCore.Http;

namespace Ninja.AI.UnitTests;

[TestClass]
public class ImageValidationTest
{
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0];
    private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0];
    private static readonly byte[] Webp = [(byte)'R', (byte)'I', (byte)'F', (byte)'F', 0, 0, 0, 0, (byte)'W', (byte)'E', (byte)'B', (byte)'P'];

    private static IFormFile File(byte[] bytes, string contentType, string name = "receipt.bin")
        => new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", name) { Headers = new HeaderDictionary(), ContentType = contentType };

    [TestMethod]
    public void Sniffs_the_three_allowed_types()
    {
        Assert.AreEqual("image/png", ImageValidation.SniffMediaType(Png));
        Assert.AreEqual("image/jpeg", ImageValidation.SniffMediaType(Jpeg));
        Assert.AreEqual("image/webp", ImageValidation.SniffMediaType(Webp));
        Assert.IsNull(ImageValidation.SniffMediaType("%PDF-1.4"u8));
        Assert.IsNull(ImageValidation.SniffMediaType([]));
    }

    [TestMethod]
    public async Task Accepts_a_png_and_returns_its_bytes_as_image_content()
    {
        var (image, error) = await ImageValidation.ReadAsync(File(Png, "image/png"), 1024, CancellationToken.None);

        Assert.IsNull(error);
        Assert.AreEqual("image/png", image!.MediaType);
        CollectionAssert.AreEqual(Png, image.Data.ToArray());
    }

    [TestMethod]
    public async Task The_bytes_win_over_the_declared_type()
    {
        var (_, error) = await ImageValidation.ReadAsync(File(Jpeg, "image/png"), 1024, CancellationToken.None);

        Assert.Contains("image/jpeg", error!);
    }

    [TestMethod]
    public async Task Rejects_empty_oversized_and_non_images()
    {
        var (_, empty) = await ImageValidation.ReadAsync(File([], "image/png"), 1024, CancellationToken.None);
        Assert.Contains("empty", empty!);

        var (_, big) = await ImageValidation.ReadAsync(File(Png, "image/png"), 4, CancellationToken.None);
        Assert.Contains("too large", big!);

        var (_, pdf) = await ImageValidation.ReadAsync(File("%PDF-1.4 hello"u8.ToArray(), "application/pdf"), 1024, CancellationToken.None);
        Assert.Contains("jpeg, png or webp", pdf!);

        var (_, none) = await ImageValidation.ReadAsync(null, 1024, CancellationToken.None);
        Assert.Contains("empty", none!);
    }
}
