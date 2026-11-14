using Ninja.Control.API.Apis;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

/// <summary>What a request from the site is cleaned into before it is kept.</summary>
[TestClass]
public sealed class LeadTests
{
    [TestMethod]
    [DataRow("01110970097", "01110970097")]
    [DataRow("+20 111 097 0097", "+201110970097")]
    [DataRow("(011) 1097-0097", "01110970097")]
    [DataRow("٠١١١٠٩٧٠٠٩٧", "01110970097")]
    public void A_phone_is_kept_as_its_digits_with_the_plus(string typed, string kept)
        => Assert.AreEqual(kept, ControlApi.LeadPhone(typed));

    [TestMethod]
    [DataRow(null)]
    [DataRow("")]
    [DataRow("12345")]
    [DataRow("call me")]
    [DataRow("0111097009700000000")]
    [DataRow("0111 <script>")]
    public void What_is_not_a_phone_is_refused(string? typed)
        => Assert.IsNull(ControlApi.LeadPhone(typed));

    [TestMethod]
    public void A_tag_is_trimmed_cut_to_its_column_and_empty_is_nothing()
    {
        Assert.IsNull(ControlApi.Tag("  ", 60));
        Assert.AreEqual("facebook", ControlApi.Tag(" face\nbook ", 60));
        Assert.AreEqual(new string('a', 60), ControlApi.Tag(new string('a', 200), 60));
    }

    [TestMethod]
    public void Where_a_lead_came_from_names_the_business_that_sent_it_first()
    {
        Assert.IsNull(MailTemplates.LeadOrigin(new Lead()));
        Assert.AreEqual("google.com", MailTemplates.LeadOrigin(new Lead { Referrer = "google.com" }));
        Assert.AreEqual("facebook / reel / gaming", MailTemplates.LeadOrigin(new Lead { Source = "facebook", Medium = "reel", Campaign = "gaming", Referrer = "l.facebook.com" }));
        Assert.AreEqual("recommended by chillax", MailTemplates.LeadOrigin(new Lead { Ref = "chillax", Referrer = "chillax.ninjapp.net" }));
    }
}
