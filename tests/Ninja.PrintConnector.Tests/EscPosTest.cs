using System.Drawing;

namespace Ninja.PrintConnector.Tests;

[TestClass]
public sealed class EscPosTest
{
    private static readonly byte[] Kick = [0x1B, 0x70, 0x00, 0x19, 0xFA];

    [TestMethod]
    public void A_job_opens_the_drawer_right_after_the_reset_when_asked()
    {
        using var image = new Bitmap(16, 8);
        var job = EscPos.Job(image, kickDrawer: true);

        byte[] expected = [0x1B, 0x40, .. Kick, 0x1B, 0x61, 0x01];
        CollectionAssert.AreEqual(expected, job[..10]);
    }

    [TestMethod]
    public void A_job_leaves_the_drawer_shut_by_default()
    {
        using var image = new Bitmap(16, 8);
        var job = EscPos.Job(image);

        CollectionAssert.AreEqual(new byte[] { 0x1B, 0x40, 0x1B, 0x61, 0x01 }, job[..5]);
        Assert.AreEqual(-1, job.AsSpan().IndexOf(Kick));
    }

    [TestMethod]
    public void The_kick_alone_is_a_reset_and_the_pulse()
    {
        byte[] expected = [0x1B, 0x40, .. Kick];
        CollectionAssert.AreEqual(expected, EscPos.Kick());
    }

    [TestMethod]
    public void A_wider_picture_is_scaled_to_the_paper_keeping_its_shape()
    {
        using var image = new Bitmap(1152, 300);
        using var fitted = EscPos.FitToPaper(image);

        Assert.AreEqual(EscPos.PaperDots, fitted.Width);
        Assert.AreEqual(150, fitted.Height);
    }

    [TestMethod]
    public void A_picture_that_fits_is_left_as_it_is()
    {
        using var image = new Bitmap(300, 120);
        using var fitted = EscPos.FitToPaper(image);

        Assert.AreEqual(300, fitted.Width);
        Assert.AreEqual(120, fitted.Height);
    }
}
