using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;

namespace Ninja.Assistant.UnitTests.Context;

[TestClass]
public class NameMatchTests
{
    private static NameMatch.Result? Compare(string said, string saved) => NameMatch.Compare(NameMatch.Words(said), NameMatch.Words(saved));

    private static DirectoryUserView User(string id, string name, string? phone = null)
    {
        var parts = name.Split(' ', 2);
        return new(id, null, null, parts[0], parts.Length > 1 ? parts[1] : null, true, null, null, phone);
    }

    private static CustomerSearch Find(string said, params string[] names) =>
        CustomerFinder.Pick([.. names.Select((n, i) => User($"u{i}", n))], CustomerFinder.Spellings(said), CustomerWhereabouts.None, said);

    [TestMethod]
    [DataRow("محمد الامين", "Mohammed ElAmeen")]
    [DataRow("محمد الأمين", "Mohammed El Ameen")]
    [DataRow("محمد الامين", "Mohamed Al-Amin")]
    [DataRow("Mohamed Al-Amin", "Mohammed ElAmeen")]
    [DataRow("Muhammad Elamin", "محمد الأمين")]
    [DataRow("أحمد حسن", "Ahmed Hassan")]
    [DataRow("Ahmad Hasan", "Ahmed Hassan")]
    [DataRow("عبدالرحمن", "Abd El Rahman")]
    [DataRow("عبد الرحمن", "Abdelrahman")]
    [DataRow("عبدالله", "Abdullah")]
    [DataRow("Abdalla", "عبد الله")]
    [DataRow("مصطفي", "Mostafa")]
    [DataRow("مصطفى", "Mustafa")]
    [DataRow("فاطمة", "Fatma")]
    [DataRow("فاطمه", "Fatima")]
    [DataRow("شريف", "Sherif")]
    [DataRow("كريم", "Kareem")]
    [DataRow("منى", "Mona")]
    [DataRow("جمال", "Gamal")]
    [DataRow("خالد", "Khaled")]
    [DataRow("يوسف", "Youssef")]
    [DataRow("يوسف", "Yusuf")]
    [DataRow("حسين", "Hussein")]
    [DataRow("حسين", "Hussain")]
    [DataRow("اسماعيل", "Ismail")]
    [DataRow("فتحي", "Fathy")]
    [DataRow("مدحت", "Medhat")]
    [DataRow("ثروت", "Sarwat")]
    [DataRow("ثروت", "Tharwat")]
    [DataRow("نور الدين", "Noureldin")]
    [DataRow("عمرو", "Amr")]
    [DataRow("وليد", "Waleed")]
    [DataRow("هاني", "Hany")]
    [DataRow("صلاح", "Salah")]
    [DataRow("سارة", "Sarah")]
    [DataRow("7assan", "حسن")]
    public void The_same_name_is_the_same_in_any_spelling_or_script(string said, string saved)
    {
        var how = Compare(said, saved);
        Assert.IsNotNull(how, $"{said} should be {saved}");
        Assert.IsTrue(how.Value.Sure, $"{said} ~ {saved}: weakest word {how.Value.Weakest:0.00}");
        Assert.IsTrue(how.Value.WholeName, $"{said} ~ {saved}: {how.Value.Closeness:0.00}, covered {how.Value.Covered:0.00}");
    }

    [TestMethod]
    [DataRow("محمد", "Mahmoud")]
    [DataRow("محمود", "Mohamed")]
    [DataRow("Mohamed", "Mahmoud")]
    [DataRow("حسن", "Hussein")]
    [DataRow("حسين", "Hassan")]
    [DataRow("Hassan", "Hussein")]
    [DataRow("Ali", "Ola")]
    [DataRow("علي", "علا")]
    [DataRow("Karim", "Kamal")]
    [DataRow("سمير", "Samar")]
    [DataRow("Mona", "Mina")]
    [DataRow("Mohamed", "Mohannad")]
    public void A_different_name_is_never_taken_for_it(string said, string saved)
    {
        var how = Compare(said, saved);
        Assert.IsFalse(how is { Sure: true }, $"{said} is not {saved} ({how?.Weakest:0.00})");
    }

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
