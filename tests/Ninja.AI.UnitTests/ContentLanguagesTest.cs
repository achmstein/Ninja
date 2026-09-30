namespace Ninja.AI.UnitTests;

/// <summary>Which languages a business writes its own text in, and what the assistant keeps of a name for it.</summary>
[TestClass]
public class ContentLanguagesTest
{
    [TestMethod]
    public void Anything_but_ar_or_en_reads_as_both()
    {
        Assert.AreEqual("ar", ContentLanguages.Normalize(" AR "));
        Assert.AreEqual("en", ContentLanguages.Normalize("en"));
        Assert.AreEqual("both", ContentLanguages.Normalize(null));
        Assert.AreEqual("both", ContentLanguages.Normalize("fr"));
        Assert.IsTrue(ContentLanguages.Writes("both", "ar"));
        Assert.IsFalse(ContentLanguages.Writes("en", "ar"));
    }

    [TestMethod]
    public void A_one_language_business_opens_its_apps_in_that_language()
    {
        Assert.AreEqual("ar", ContentLanguages.Opening("ar", defaultLanguage: "en"));
        Assert.AreEqual("en", ContentLanguages.Opening("both", defaultLanguage: "en"));
    }

    [TestMethod]
    public void Both_keeps_both_sides_as_written()
    {
        Assert.AreEqual(("Latte", "لاتيه"), ContentLanguages.Keep("Latte", "لاتيه", "both"));
        Assert.AreEqual(("Latte", (string?)null), ContentLanguages.Keep("Latte", " ", "both"));
    }

    [TestMethod]
    public void One_language_keeps_its_side_and_drops_the_other()
    {
        Assert.AreEqual(((string?)null, "لاتيه"), ContentLanguages.Keep("Latte", "لاتيه", "ar"));
        Assert.AreEqual(("Latte", (string?)null), ContentLanguages.Keep("Latte", "لاتيه", "en"));
    }

    [TestMethod]
    public void A_name_on_the_wrong_side_moves_over_when_its_script_is_the_business_and_stays_otherwise()
    {
        Assert.AreEqual(((string?)null, "شاي"), ContentLanguages.Keep("شاي", "", "ar"), "Arabic written on the English side");
        Assert.AreEqual(("Tea", (string?)null), ContentLanguages.Keep(null, "Tea", "en"), "English written on the Arabic side");
        Assert.AreEqual(("Tea", (string?)null), ContentLanguages.Keep("Tea", null, "ar"), "no Arabic at all: the English is kept rather than lost");
        Assert.AreEqual(((string?)null, "شاي"), ContentLanguages.Keep(null, "شاي", "en"), "no English at all: the Arabic is kept rather than lost");
    }
}
