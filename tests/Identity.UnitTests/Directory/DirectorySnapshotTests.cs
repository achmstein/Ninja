namespace Identity.UnitTests.Directory;

[TestClass]
public class DirectorySnapshotTests
{
    private static DirectoryUser User(string id, string first, string last, string? phone = null, params string[] roles) =>
        new(id, $"{first}.{last}".ToLowerInvariant(), $"{first}.{last}@example.com".ToLowerInvariant(), first, last, true, null, roles, phone, []);

    private static readonly DirectorySnapshot Snapshot = new(
    [
        User("1", "Ahmed", "El-Hady", "01001234567"),
        User("2", "Ahmed", "Samir", "01109876543"),
        User("3", "Samir", "Ahmed"),
        User("4", "Mohamed", "Ali", "01223334444"),
        User("5", "Owner", "Person", null, "Owner"),
        User("6", "Till", "Person", null, "Cashier"),
        User("7", "أحمد", "الهادي", "01555555555"),
    ], DateTimeOffset.UtcNow);

    [TestMethod]
    public void Ranks_the_best_name_match_first_and_drops_non_matches()
    {
        var ids = Snapshot.Search("ahmed", [], []).Select(u => u.Id).ToList();
        CollectionAssert.AreEqual(new[] { "1", "2", "3" }, ids, "first-name hits before the surname hit, then alphabetical");
    }

    [TestMethod]
    public void Two_words_narrow_it_to_one_person()
    {
        var ids = Snapshot.Search("ahmed hady", [], []).Select(u => u.Id).ToList();
        CollectionAssert.AreEqual(new[] { "1" }, ids);
        Assert.AreEqual("1", Snapshot.Search("elhady", [], []).Single().Id);
    }

    [TestMethod]
    public void Arabic_input_finds_an_arabic_name_whatever_the_letter_variant()
    {
        Assert.AreEqual("7", Snapshot.Search("احمد", [], []).First().Id);
        Assert.AreEqual("7", Snapshot.Search("أحمد الهادى", [], []).Single().Id);
    }

    [TestMethod]
    public void A_phone_fragment_finds_the_customer()
    {
        Assert.AreEqual("4", Snapshot.Search("0122", [], []).Single().Id);
        Assert.AreEqual("2", Snapshot.Search("6543", [], []).Single().Id);
    }

    [TestMethod]
    public void Role_filters_apply_before_matching()
    {
        var staff = Snapshot.Search("person", ["Owner", "Cashier"], []).Select(u => u.Id).ToList();
        CollectionAssert.AreEquivalent(new[] { "5", "6" }, staff);

        var customers = Snapshot.Search("", [], ["Admin", "Owner", "Cashier"]).Select(u => u.Id).ToList();
        CollectionAssert.AreEquivalent(new[] { "1", "2", "3", "4", "7" }, customers);

        Assert.AreEqual(0, Snapshot.Search("person", [], ["Owner", "Cashier"]).Count());
    }

    [TestMethod]
    public void Without_a_query_the_list_keeps_its_load_order()
    {
        var ids = Snapshot.Search(null, [], []).Select(u => u.Id).ToList();
        CollectionAssert.AreEqual(new[] { "1", "2", "3", "4", "5", "6", "7" }, ids);
    }
}
