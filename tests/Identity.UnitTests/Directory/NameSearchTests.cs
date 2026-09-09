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
        var tokens = NameSearch.Tokenize("Ahmed El-Hady");
        Assert.IsTrue(Score("ahm", tokens) > 0);
        Assert.IsTrue(Score("hady", tokens) > 0);
        Assert.IsTrue(Score("Ahmed El", tokens) > 0);
        Assert.IsTrue(Score("el ahmed", tokens) > 0, "word order does not matter");
        Assert.IsTrue(Score("hmed", tokens) < Score("ahme", tokens), "a dropped first letter is a typo, ranked below a real prefix");
        Assert.AreEqual(0, Score("khaled", tokens), "a different name is no match");
        Assert.AreEqual(0, Score("ahmed samir", tokens), "every typed word must match");
    }

    [TestMethod]
    public void The_run_together_form_matches_too()
    {
        var tokens = NameSearch.Tokenize("Ahmed El Hady");
        Assert.IsTrue(Score("elhady", tokens) > 0);
        Assert.IsTrue(Score("ahmedel", tokens) > 0);
        Assert.IsTrue(Score("abdelrahman", NameSearch.Tokenize("Abd El Rahman")) > 0);
    }

    [TestMethod]
    public void A_typo_in_a_longer_word_still_finds_the_name()
    {
        var tokens = NameSearch.Tokenize("Mohamed Samir");
        Assert.IsTrue(Score("mohamd", tokens) > 0, "a dropped letter");
        Assert.IsTrue(Score("mohmaed", tokens) > 0, "two letters swapped");
        Assert.IsTrue(Score("muhamed", tokens) > 0, "one wrong letter");
        Assert.AreEqual(0, Score("moh1", NameSearch.Tokenize("Mona")), "short words are not fuzzed");
    }

    [TestMethod]
    public void The_first_word_of_the_name_ranks_above_a_later_word_and_a_typo()
    {
        var first = Score("ahmed", NameSearch.Tokenize("Ahmed Samir"));
        var later = Score("ahmed", NameSearch.Tokenize("Samir Ahmed"));
        var typo = Score("ahmde", NameSearch.Tokenize("Ahmed Samir"));
        Assert.IsTrue(first > later);
        Assert.IsTrue(later > typo);
    }

    [TestMethod]
    public void Digits_match_the_phone_number_anywhere()
    {
        var phone = NameSearch.Digits("+20 100-123-4567");
        Assert.AreEqual("201001234567", phone);
        Assert.IsTrue(NameSearch.Score("0100", [], phone, "", "") > 0);
        Assert.IsTrue(NameSearch.Score("4567", [], phone, "", "") > 0);
        Assert.IsTrue(NameSearch.Score("+20 100", [], phone, "", "") > 0);
        Assert.AreEqual(0, NameSearch.Score("0199", [], phone, "", ""));
    }

    [TestMethod]
    public void Email_and_username_are_the_last_resort()
    {
        var tokens = NameSearch.Tokenize("Ahmed Samir");
        Assert.IsTrue(NameSearch.Score("ahmed.s", tokens, "", "ahmed.s@example.com", "ahmed.s") > 0);
        Assert.AreEqual(0, NameSearch.Score("nobody", tokens, "", "ahmed.s@example.com", "ahmed.s"));
    }

    private static int Score(string query, string[] tokens) => NameSearch.Score(query, tokens, "", "", "");
}
