using Ninja.ServiceDefaults.Names;

namespace Ninja.ServiceDefaults.UnitTests.Names;

[TestClass]
public class NameMatchTests
{
    [TestMethod]
    // One name across the two scripts, in the spellings of several countries
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
    [DataRow("جمال", "Jamal")]
    [DataRow("جمال", "Djamel")]
    [DataRow("خالد", "Khaled")]
    [DataRow("خالد", "Khalid")]
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
    [DataRow("قاسم", "Qasim")]
    [DataRow("قاسم", "Kassem")]
    [DataRow("شادي", "Chadi")]
    [DataRow("رشيد", "Rachid")]
    [DataRow("7assan", "حسن")]
    [DataRow("ﻣﺤﻤﺪ", "Mohamed")]
    // Names from elsewhere said in Arabic letters
    [DataRow("بيتر", "Peter")]
    [DataRow("فيكتور", "Victor")]
    [DataRow("ماريا", "Maria")]
    // One script, spelled as different people spell it
    [DataRow("Catherine", "Katherine")]
    [DataRow("Stephen", "Stefan")]
    [DataRow("Schmidt", "Shmidt")]
    [DataRow("Francois Dupont", "François Dupont")]
    [DataRow("Jose Garcia", "José García")]
    [DataRow("Müller", "Muller")]
    [DataRow("Иван Петров", "иван петров")]
    [DataRow("王伟", "王伟")]
    public void The_same_name_is_the_same_in_any_spelling_or_script(string said, string saved)
    {
        var how = NameMatch.Compare(said, saved);
        Assert.IsNotNull(how, $"{said} should be {saved}");
        Assert.IsTrue(how.Value.WholeName, $"{said} ~ {saved}: weakest word {how.Value.Weakest:0.00}, covered {how.Value.Covered:0.00}");
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
    [DataRow("Paul", "Ball")]
    [DataRow("John", "Joan")]
    [DataRow("Maria", "Mario")]
    [DataRow("Иван", "Илья")]
    [DataRow("王伟", "王芳")]
    public void A_different_name_is_never_taken_for_it(string said, string saved)
    {
        var how = NameMatch.Compare(said, saved);
        Assert.IsFalse(how is { Sure: true }, $"{said} is not {saved} ({how?.Weakest:0.00})");
    }

    [TestMethod]
    public void A_whole_name_ranks_above_the_same_words_in_a_longer_one_and_any_order_is_the_name()
    {
        var whole = NameMatch.Compare("Ahmed Hassan", "Ahmed Hassan")!.Value;
        var longer = NameMatch.Compare("Ahmed Hassan", "Ahmed Hassan Ali")!.Value;
        Assert.IsTrue(whole.WholeName);
        Assert.IsFalse(longer.WholeName);
        Assert.IsTrue(whole.Score > longer.Score);
        Assert.IsTrue(longer.Sure);

        Assert.IsTrue(NameMatch.Compare("Hassan Ahmed", "Ahmed Hassan")!.Value.WholeName);
        Assert.IsTrue(NameMatch.Compare("Ahmed", "Ahmed Hassan")!.Value.Leading);
        Assert.IsFalse(NameMatch.Compare("Hassan", "Ahmed Hassan")!.Value.Leading);
        Assert.IsNull(NameMatch.Compare("Ahmed Samir", "Ahmed Hassan"), "every word said must be in the name");
        Assert.IsNull(NameMatch.Compare("Ahmed Ahmed", "Ahmed Hassan"), "a word of the name is used once");
    }

    [TestMethod]
    [DataRow("moh", "Mohamed Samir")]
    [DataRow("moh sa", "Mohamed Samir")]
    [DataRow("sam", "Mohamed Samir")]
    [DataRow("مح", "Mohamed Samir")]
    [DataRow("محمد سم", "Mohamed Samir")]
    [DataRow("moh", "محمد سمير")]
    [DataRow("elha", "Ahmed El Hady")]
    [DataRow("abdelr", "Abd El Rahman")]
    public void A_name_being_typed_is_found_from_its_start_in_either_script(string typed, string saved)
    {
        Assert.IsNotNull(NameMatch.Compare(typed, saved, typing: true), $"{typed} should find {saved}");
        Assert.IsFalse(NameMatch.Compare(typed, saved) is { Sure: true }, "said, and not typed, part of a word is not the name");
    }

    [TestMethod]
    public void Typing_ranks_the_whole_word_above_its_start_and_matches_no_other_name()
    {
        var whole = NameMatch.Compare("ali", "Ali Hassan", typing: true)!.Value;
        var start = NameMatch.Compare("ali", "Alia Hassan", typing: true)!.Value;
        Assert.IsTrue(whole.Closeness > start.Closeness);

        Assert.IsNull(NameMatch.Compare("kha", "Mohamed Samir", typing: true));
        Assert.IsNull(NameMatch.Compare("a", "محمد سمير", typing: true), "a vowel alone says nothing across scripts");
    }

    [TestMethod]
    public void Sounds_read_letters_the_way_names_are_spelled()
    {
        Assert.AreEqual(NameSounds.Sounds("shady"), NameSounds.Sounds("chady"));
        Assert.AreEqual(NameSounds.Sounds("schmidt"), NameSounds.Sounds("shmidt"));
        Assert.AreEqual("sesil", NameSounds.Sounds("cecil"));
        Assert.AreEqual("karl", NameSounds.Sounds("carl"));
        Assert.AreEqual("mhmd", NameSounds.Sounds("محمد"));
        Assert.AreEqual("mhmWd", NameSounds.Sounds("محمود"));
        Assert.AreEqual(2, NameSounds.Words("  Abd-Allah ").Length);
        Assert.AreEqual(0, NameSounds.Words(" - ").Length);
    }
}
