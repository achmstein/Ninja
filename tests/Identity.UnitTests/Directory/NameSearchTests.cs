using Ninja.ServiceDefaults.Names;

namespace Identity.UnitTests.Directory;

[TestClass]
public class NameSearchTests
{
    [TestMethod]
    public void Normalize_unifies_case_accents_hyphens_and_arabic_variants()
    {
        Assert.AreEqual("ahmed el hady", NameSearch.Normalize("Ahmed El-Hady"));
        Assert.AreEqual("rene", NameSearch.Normalize("René"));
        Assert.AreEqual("احمد", NameSearch.Normalize("أحمد"));
        Assert.AreEqual("فاطمه", NameSearch.Normalize("فاطمة"));
        Assert.AreEqual("مصطفي", NameSearch.Normalize("مصطفى"));
        Assert.AreEqual("محمد", NameSearch.Normalize("مُحَمَّد"));
        Assert.AreEqual("abd el rahman", NameSearch.Normalize("  Abd   El-Rahman "));
    }

    [TestMethod]
    public void A_typed_word_matches_the_start_of_any_word_of_the_name()
    {
        const string name = "Ahmed El-Hady";
        Assert.IsTrue(Score("ahm", name) > 0);
        Assert.IsTrue(Score("hady", name) > 0);
        Assert.IsTrue(Score("Ahmed El", name) > 0);
        Assert.IsTrue(Score("el ahmed", name) > 0, "word order does not matter");
        Assert.IsTrue(Score("hmed", name) < Score("ahme", name), "a dropped first letter is a typo, ranked below a real prefix");
        Assert.AreEqual(0, Score("khaled", name), "a different name is no match");
        Assert.AreEqual(0, Score("ahmed samir", name), "every typed word must match");
    }

    [TestMethod]
    public void The_run_together_form_matches_too()
    {
        Assert.IsTrue(Score("elhady", "Ahmed El Hady") > 0);
        Assert.IsTrue(Score("ahmedel", "Ahmed El Hady") > 0);
        Assert.IsTrue(Score("abdelrahman", "Abd El Rahman") > 0);
    }

    [TestMethod]
    public void A_typo_in_a_longer_word_still_finds_the_name()
    {
        Assert.IsTrue(Score("mohamd", "Mohamed Samir") > 0, "a dropped letter");
        Assert.IsTrue(Score("mohmaed", "Mohamed Samir") > 0, "two letters swapped");
        Assert.IsTrue(Score("muhamed", "Mohamed Samir") > 0, "one wrong letter");
        Assert.AreEqual(0, Score("moh1", "Mona"), "short words are not fuzzed");
    }

    [TestMethod]
    public void The_first_word_of_the_name_ranks_above_a_later_word_and_a_typo()
    {
        var first = Score("ahmed", "Ahmed Samir");
        var later = Score("ahmed", "Samir Ahmed");
        var typo = Score("ahmde", "Ahmed Samir");
        Assert.IsTrue(first > later);
        Assert.IsTrue(later > typo);
        Assert.IsTrue(typo > 0);
    }

    [TestMethod]
    public void Either_script_finds_a_name_saved_in_the_other_and_never_another_name()
    {
        Assert.IsTrue(Score("محمد", "Mohamed Samir") > 0);
        Assert.IsTrue(Score("مح", "Mohamed Samir") > 0, "while it is being typed");
        Assert.IsTrue(Score("mohamed", "محمد سمير") > 0);
        Assert.IsTrue(Score("محمد الامين", "Mohammed ElAmeen") > 0);
        Assert.IsTrue(Score("محمود", "Mahmoud Samir") > Score("محمود", "Mohamed Samir"), "Mahmoud is ahead of the near name Mohamed");
        Assert.IsTrue(Score("mohamed", "Mohamed Samir") > Score("mohamed", "محمد سمير"), "the script typed in is ahead");
    }

    [TestMethod]
    public void Digits_match_the_phone_number_anywhere()
    {
        var phone = NameSearch.Digits("+20 100-123-4567");
        Assert.AreEqual("201001234567", phone);
        Assert.IsTrue(NameSearch.Score("0100", PreparedName.Empty, phone, "", "") > 0);
        Assert.IsTrue(NameSearch.Score("4567", PreparedName.Empty, phone, "", "") > 0);
        Assert.IsTrue(NameSearch.Score("+20 100", PreparedName.Empty, phone, "", "") > 0);
        Assert.AreEqual(0, NameSearch.Score("0199", PreparedName.Empty, phone, "", ""));
        Assert.IsTrue(NameSearch.Score("ahmed 4567", PreparedName.Of("Ahmed Samir"), phone, "", "") > 0, "a name and digits narrow together");
        Assert.AreEqual(0, NameSearch.Score("ahmed 9999", PreparedName.Of("Ahmed Samir"), phone, "", ""));
    }

    [TestMethod]
    public void Email_and_username_are_the_last_resort()
    {
        var name = PreparedName.Of("Ahmed Samir");
        Assert.IsTrue(NameSearch.Score("a.samir77", name, "", "a.samir77@example.com", "a.samir77") > 0);
        Assert.IsTrue(NameSearch.Score("a.samir77", name, "", "a.samir77@example.com", "a.samir77") < NameSearch.Score("ahmed", name, "", "", ""));
        Assert.AreEqual(0, NameSearch.Score("nobody", name, "", "a.samir77@example.com", "a.samir77"));
    }

    private static double Score(string query, string name) => NameSearch.Score(query, PreparedName.Of(name), "", "", "");
}
