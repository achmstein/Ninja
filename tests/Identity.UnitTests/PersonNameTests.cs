using Ninja.Identity.API;

namespace Ninja.Identity.UnitTests;

/// <summary>First and last name from what a client sends: the two fields, or an older app's one name.</summary>
[TestClass]
public sealed class PersonNameTests
{
    [TestMethod]
    public void The_two_fields_are_taken_as_given_trimmed()
    {
        Assert.AreEqual(("Mona", "El Sayed"), PersonName.Of("  Mona ", "El Sayed ", "ignored name"));
        Assert.AreEqual(("Mona", null), PersonName.Of("Mona", " ", null));
    }

    [TestMethod]
    public void An_older_apps_one_name_is_split_at_its_first_space()
    {
        Assert.AreEqual(("Ahmed", "Nabil Hassan"), PersonName.Of(null, null, "Ahmed Nabil Hassan"));
        Assert.AreEqual(("Cher", null), PersonName.Of(null, null, " Cher "));
    }

    [TestMethod]
    public void Nothing_sent_is_no_name()
    {
        Assert.AreEqual((null, null), PersonName.Of(null, "", "  "));
        Assert.IsFalse(PersonName.Given(null, null, null));
        Assert.IsTrue(PersonName.Given(null, "Nabil", null));
    }

    [TestMethod]
    public void The_whole_name_reads_first_then_last()
    {
        Assert.AreEqual("Mona El Sayed", PersonName.Display("Mona", "El Sayed"));
        Assert.AreEqual("Mona", PersonName.Display("Mona", null));
    }

    [TestMethod]
    public void A_name_is_complete_only_with_both_parts()
    {
        Assert.IsTrue(PersonName.Complete("Mona", "El Sayed"));
        Assert.IsFalse(PersonName.Complete("Mona", null));
        Assert.IsFalse(PersonName.Complete(" ", "El Sayed"));
        Assert.IsFalse(PersonName.Complete(null, null));
    }
}
