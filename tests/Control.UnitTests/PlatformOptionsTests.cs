using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

[TestClass]
public sealed class PlatformOptionsTests
{
    [TestMethod]
    public void Stack_limit_is_the_sum_of_the_service_caps()
    {
        var options = new PlatformOptions();
        Assert.AreEqual(384, options.MemoryFor("catalog"));
        Assert.AreEqual(256, options.MemoryFor("sales"));
        Assert.AreEqual(9 * 256 + 3 * 384 + 128, options.StackLimitMb);
        Assert.IsLessThanOrEqualTo(options.StackLimitMb, options.StackFootprintMb, "the typical footprint must fit under the caps");
    }
}
