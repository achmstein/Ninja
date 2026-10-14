namespace Ninja.PrintConnector.Tests;

[TestClass]
public sealed class LocalAccessTest
{
    private const string Server = "https://api.chillax.ninjapp.net";

    [TestMethod]
    [DataRow("https://pos.chillax.ninjapp.net")]
    [DataRow("https://POS.Chillax.NinjApp.net")]
    [DataRow("https://admin.chillax.ninjapp.net")]
    public void The_paired_business_s_own_sites_may_print(string origin) =>
        Assert.IsTrue(LocalAccess.Allows(origin, Server));

    [TestMethod]
    [DataRow(null)]
    [DataRow("")]
    [DataRow("null")]
    [DataRow("http://pos.chillax.ninjapp.net")]
    [DataRow("https://pos.other.ninjapp.net")]
    [DataRow("https://evil.example.com")]
    [DataRow("https://chillax.ninjapp.net.evil.com")]
    [DataRow("http://localhost:5175")]
    public void Anyone_else_may_not(string? origin) =>
        Assert.IsFalse(LocalAccess.Allows(origin, Server));

    [TestMethod]
    public void Two_sites_under_a_bare_top_level_domain_are_not_one_business() =>
        Assert.IsFalse(LocalAccess.Allows("https://pos.net", "https://api.net"));

    [TestMethod]
    public void Addresses_have_no_parent_domain_to_share() =>
        Assert.IsFalse(LocalAccess.Allows("https://10.168.1.5", "https://192.168.1.5"));

    [TestMethod]
    [DataRow("http://localhost:5175")]
    [DataRow("http://127.0.0.1:5175")]
    public void A_development_stack_lets_its_local_till_print(string origin)
    {
        Assert.IsTrue(LocalAccess.Allows(origin, "http://localhost:5000"));
        Assert.IsTrue(LocalAccess.Allows(origin, "http://127.0.0.1:5000"));
    }

    [TestMethod]
    public void A_development_stack_still_refuses_the_internet() =>
        Assert.IsFalse(LocalAccess.Allows("https://pos.chillax.ninjapp.net", "http://localhost:5000"));
}
