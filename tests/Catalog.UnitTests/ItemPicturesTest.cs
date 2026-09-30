using Ninja.Catalog.API.Infrastructure;
using SkiaSharp;

namespace Catalog.UnitTests;

/// <summary>A menu item's picture: upright, within 1600 px, WebP, and smaller copies on demand.</summary>
[TestClass]
public class ItemPicturesTest
{
    private static byte[] Jpeg(int width, int height)
    {
        using var bitmap = new SKBitmap(width, height);
        bitmap.Erase(SKColors.Coral);
        using var image = SKImage.FromBitmap(bitmap);
        return image.Encode(SKEncodedImageFormat.Jpeg, 90).ToArray();
    }

    [TestMethod]
    public void A_big_photo_is_stored_as_webp_within_1600_px()
    {
        var (webp, error) = ItemPictures.Normalize(Jpeg(4000, 3000));

        Assert.IsNull(error);
        using var codec = SKCodec.Create(new SKMemoryStream(webp!));
        Assert.AreEqual(SKEncodedImageFormat.Webp, codec.EncodedFormat);
        Assert.AreEqual(1600, codec.Info.Width);
        Assert.AreEqual(1200, codec.Info.Height);
    }

    [TestMethod]
    public void What_is_not_an_image_is_refused()
    {
        var (webp, error) = ItemPictures.Normalize("not a picture"u8.ToArray());

        Assert.IsNull(webp);
        Assert.IsNotNull(error);
    }

    [TestMethod]
    public void A_photo_taken_sideways_is_turned_upright()
    {
        // Left red, right blue, as the sensor wrote it; the camera says "turn it 90° clockwise"
        using var sensor = new SKBitmap(2, 1);
        sensor.SetPixel(0, 0, SKColors.Red);
        sensor.SetPixel(1, 0, SKColors.Blue);

        using var upright = ItemPictures.Orient(sensor, SKEncodedOrigin.RightTop);

        Assert.AreEqual(1, upright.Width);
        Assert.AreEqual(2, upright.Height);
        Assert.AreEqual(SKColors.Red, upright.GetPixel(0, 0));
        Assert.AreEqual(SKColors.Blue, upright.GetPixel(0, 1));
    }

    [TestMethod]
    public void A_smaller_copy_is_cut_once_and_a_small_picture_is_its_own_copy()
    {
        var root = Path.Combine(Path.GetTempPath(), "pics-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            var big = Path.Combine(root, "1_1.webp");
            File.WriteAllBytes(big, ItemPictures.Normalize(Jpeg(1200, 900)).Webp!);

            var sized = ItemPictures.SizedPath(root, big, 320);
            Assert.AreNotEqual(big, sized);
            using (var codec = SKCodec.Create(sized))
            {
                Assert.AreEqual(320, codec.Info.Width);
                Assert.AreEqual(240, codec.Info.Height);
            }
            Assert.AreEqual(sized, ItemPictures.SizedPath(root, big, 320), "kept, not cut again");

            Assert.AreEqual(big, ItemPictures.SizedPath(root, big, 1280), "no wider copy than the picture");

            ItemPictures.DeleteSizes(root, "1_1.webp");
            Assert.IsFalse(File.Exists(sized));
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }
}
