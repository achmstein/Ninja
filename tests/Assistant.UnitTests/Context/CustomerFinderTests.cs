using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;

namespace Ninja.Assistant.UnitTests.Context;

[TestClass]
public class CustomerFinderTests
{
    private static DirectoryUserView User(string id, string name, string? phone = null)
    {
        var parts = name.Split(' ', 2);
        return new(id, null, null, parts[0], parts.Length > 1 ? parts[1] : null, true, null, null, phone);
    }

    private static CustomerSearch Find(string said, params string[] names) =>
        CustomerFinder.Pick([.. names.Select((n, i) => User($"u{i}", n))], CustomerFinder.Spellings(said), CustomerWhereabouts.None, said);

    [TestMethod]
    public void The_account_saved_in_English_is_found_from_the_Arabic_said()
    {
        var found = Find("محمد الامين", "Mohamed Amin", "Mohammed ElAmeen", "Mahmoud ElAmeen", "Mohamed Ali", "محمد امين");
        Assert.AreEqual("Mohammed ElAmeen", found.Match?.Name, found.Why);

        // The model's own respelling beside it changes nothing
        found = Find("محمد الامين / Mohamed Al-Amin", "Mohamed Amin", "Mohammed ElAmeen", "Mahmoud ElAmeen");
        Assert.AreEqual("Mohammed ElAmeen", found.Match?.Name, found.Why);
    }

    [TestMethod]
    public void The_whole_name_wins_and_part_of_a_name_asks_among_those_who_share_it()
    {
        Assert.AreEqual("Ahmed Hassan", Find("احمد حسن", "Ahmed Hassan", "Ahmed Hassan Ali", "Ahmed Ali").Match?.Name);

        var ahmeds = Find("أحمد", "Ahmed Hassan", "Ahmed Ali", "Mona Said");
        Assert.IsTrue(ahmeds.Ambiguous);
        Assert.HasCount(2, ahmeds.Candidates);

        Assert.AreEqual("Mona Said Ibrahim", Find("منى", "Ahmed Hassan", "Mona Said Ibrahim").Match?.Name, "the only Mona, however long her name");
    }

    [TestMethod]
    public void A_name_that_is_only_close_is_asked_about_and_not_acted_on()
    {
        var found = Find("Mohamed Sami", "Mohannad Sami", "Karim Adel");
        Assert.IsNull(found.Match);
        Assert.IsTrue(found.Ambiguous);
        Assert.AreEqual("Mohannad Sami", found.Candidates.Single().Name);
        StringAssert.Contains(found.Why, "closest");

        Assert.HasCount(0, Find("Tamer", "Karim Adel", "Mona Said").Candidates);
    }

    [TestMethod]
    public void A_phone_finds_its_account_with_or_without_the_country_code()
    {
        DirectoryUserView[] users = [User("a", "Ahmed Hassan", "+201001112233"), User("b", "Ahmed Ali", "01009998877")];
        Assert.AreEqual("a", CustomerFinder.Pick(users, ["0100 111 2233"], CustomerWhereabouts.None, "x").Match?.Id);
        Assert.AreEqual("b", CustomerFinder.Pick(users, ["+20 100 999 8877"], CustomerWhereabouts.None, "x").Match?.Id);
        Assert.AreEqual("b", CustomerFinder.Pick(users, ["8877"], CustomerWhereabouts.None, "x").Match?.Id);
        Assert.IsTrue(CustomerFinder.Pick(users, ["0100"], CustomerWhereabouts.None, "x").Ambiguous);
    }
}
