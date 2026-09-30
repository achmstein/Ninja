using System.Text.Json;

namespace Catalog.UnitTests;

/// <summary>The café's own text: either language may be the only one, each side means what it says.</summary>
[TestClass]
public class LocalizedTextTest
{
    [TestMethod]
    public void A_blank_side_is_null_and_each_side_is_trimmed()
    {
        var text = new LocalizedText("  Latte ", "   ");

        Assert.AreEqual("Latte", text.En);
        Assert.IsNull(text.Ar);
        Assert.IsTrue(new LocalizedText("", " ").IsEmpty);
        Assert.IsNull(LocalizedText.From(" ", null));
        Assert.IsNull(LocalizedText.Optional(new LocalizedText(null, "")));
    }

    [TestMethod]
    public void Reading_falls_back_to_the_other_language_both_ways()
    {
        var arabicOnly = new LocalizedText(null, "لاتيه");
        var englishOnly = new LocalizedText("Latte", null);

        Assert.AreEqual("لاتيه", arabicOnly.Get("en"));
        Assert.AreEqual("لاتيه", arabicOnly.Get("ar-EG"));
        Assert.AreEqual("Latte", englishOnly.Get("ar"));
        Assert.AreEqual("", new LocalizedText().Get("en"));
    }

    [TestMethod]
    public void Primary_and_both_name_whichever_is_written()
    {
        Assert.AreEqual("Latte", new LocalizedText("Latte", "لاتيه").Primary);
        Assert.AreEqual("لاتيه", new LocalizedText(null, "لاتيه").Primary);
        Assert.AreEqual("Latte / لاتيه", new LocalizedText("Latte", "لاتيه").Both);
        Assert.AreEqual("لاتيه", new LocalizedText(null, "لاتيه").Both);
    }

    [TestMethod]
    public void A_text_of_unknown_language_goes_to_the_side_of_its_script()
    {
        Assert.AreEqual("شاي بالنعناع", LocalizedText.InScriptOf("شاي بالنعناع").Ar);
        Assert.IsNull(LocalizedText.InScriptOf("شاي بالنعناع").En);
        Assert.AreEqual("Mint tea", LocalizedText.InScriptOf("Mint tea").En);
    }

    [TestMethod]
    public void Matching_and_searching_look_at_both_sides()
    {
        var text = new LocalizedText("Mint Tea", "شاي بالنعناع");

        Assert.IsTrue(text.Matches(" mint tea"));
        Assert.IsTrue(text.Matches("شاي بالنعناع"));
        Assert.IsTrue(text.Contains("نعناع"));
        Assert.IsFalse(text.Contains("coffee"));
    }

    [TestMethod]
    public void On_the_wire_it_is_just_the_two_sides()
    {
        var web = new JsonSerializerOptions(JsonSerializerDefaults.Web);

        var json = JsonSerializer.Serialize(new LocalizedText(null, "لاتيه"), web);
        using var doc = JsonDocument.Parse(json);
        CollectionAssert.AreEquivalent(new[] { "en", "ar" }, doc.RootElement.EnumerateObject().Select(p => p.Name).ToArray());

        var read = JsonSerializer.Deserialize<LocalizedText>("""{ "en": "  ", "ar": " لاتيه " }""", web)!;
        Assert.IsNull(read.En);
        Assert.AreEqual("لاتيه", read.Ar);
    }
}
