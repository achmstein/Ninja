using Ninja.ServiceDefaults;
using Microsoft.AspNetCore.Http;

namespace ServiceDefaults.UnitTests;

[TestClass]
public class BranchHeaderExtensionsTest
{
    [TestMethod]
    public void Reads_a_numeric_header()
    {
        var http = new DefaultHttpContext();
        http.Request.Headers[BranchHeaderExtensions.HeaderName] = "12";
        Assert.AreEqual(12, http.GetBranchId());
        Assert.AreEqual(12, http.GetRequiredBranchId());
    }

    [TestMethod]
    public void A_missing_or_malformed_header_is_a_bad_request()
    {
        var missing = new DefaultHttpContext();
        Assert.IsNull(missing.GetBranchId());
        var thrown = Assert.ThrowsExactly<BadHttpRequestException>(() => missing.GetRequiredBranchId());
        Assert.AreEqual(StatusCodes.Status400BadRequest, thrown.StatusCode);

        var malformed = new DefaultHttpContext();
        malformed.Request.Headers[BranchHeaderExtensions.HeaderName] = "abc";
        Assert.IsNull(malformed.GetBranchId());
    }
}
