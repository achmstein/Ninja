using Ninja.ServiceDefaults;

namespace ServiceDefaults.UnitTests;

/// <summary>
/// The same cases as the apps' own phone tests (phone.test.ts, phone_test.dart): one rule, four places.
/// </summary>
[TestClass]
public class PhoneRulesTest
{
    [TestMethod]
    [DataRow("01012345678")]
    [DataRow("010 1234 5678")]
    [DataRow("010-1234-5678")]
    [DataRow("(010) 1234.5678")]
    [DataRow("+20 10 1234 5678")]
    [DataRow("+20 010 1234 5678")]
    [DataRow("0020 1012345678")]
    [DataRow("201012345678")]
    [DataRow("1012345678")]
    [DataRow("+0201012345678")]
    [DataRow("+201012345678")]
    [DataRow("٠١٠١٢٣٤٥٦٧٨")]
    [DataRow("+٢٠ ١٠ ١٢٣٤ ٥٦٧٨")]
    [DataRow("۰۱۰۱۲۳۴۵۶۷۸")]
    public void An_Egyptian_mobile_is_one_number_however_it_is_typed(string typed)
    {
        Assert.AreEqual("+201012345678", PhoneRules.Normalize(typed, "EG"));
        Assert.IsTrue(PhoneRules.IsValid(typed, "EG"));
    }

    [TestMethod]
    [DataRow("1110970097")]
    [DataRow("01110970097")]
    [DataRow("+20 111 097 0097")]
    [DataRow("+0201110970097")]
    public void What_a_phone_s_autofill_hands_over_is_the_number_it_saved(string filled)
    {
        Assert.AreEqual("+201110970097", PhoneRules.Normalize(filled, "EG"));
    }

    [TestMethod]
    public void A_Gulf_mobile_is_read_against_its_own_country()
    {
        Assert.AreEqual("+966512345678", PhoneRules.Normalize("+966 51 234 5678", "SA"));
        Assert.AreEqual("+966512345678", PhoneRules.Normalize("512345678", "SA"));
        Assert.AreEqual("+966512345678", PhoneRules.Normalize("051 234 5678", "SA"));
        Assert.AreEqual("+971501234567", PhoneRules.Normalize("00971501234567", "AE"));
        Assert.AreEqual("+447400123456", PhoneRules.Normalize("07400 123456", "GB"));
        Assert.AreEqual("+447400123456", PhoneRules.Normalize("0044 7400 123456", "GB"));
    }

    [TestMethod]
    public void A_customer_s_number_is_a_mobile_of_the_business_s_country()
    {
        Assert.IsFalse(PhoneRules.IsValid("+44 7400 123456", "EG"), "a foreign number is not an Egyptian mobile");
        Assert.IsFalse(PhoneRules.IsValid("0512345678", "EG"));
        Assert.IsFalse(PhoneRules.IsValid("01012345678", "SA"));
        Assert.IsFalse(PhoneRules.IsValid("02 2345 6789", "EG"), "a Cairo landline is not a customer's phone");
        Assert.IsFalse(PhoneRules.IsValid("02012345678", "EG"));
        Assert.IsFalse(PhoneRules.IsValid("0100", "EG"));
        Assert.IsFalse(PhoneRules.IsValid("not-a-number", "EG"));
        Assert.IsFalse(PhoneRules.IsValid("", "EG"));
        Assert.IsFalse(PhoneRules.IsValid(null, "EG"));
    }

    [TestMethod]
    public void What_is_not_a_number_here_comes_back_as_typed_without_its_separators()
    {
        Assert.AreEqual("", PhoneRules.Normalize("  ", "EG"));
        Assert.AreEqual("", PhoneRules.Normalize("ahmed", "EG"));
        Assert.AreEqual("0101", PhoneRules.Normalize("010-1", "EG"));
        Assert.AreEqual("+447400123456", PhoneRules.Normalize("+44 7400 123456", "EG"));
        Assert.IsFalse(PhoneRules.IsValid(PhoneRules.Normalize("010-1", "EG"), "EG"));
    }

    [TestMethod]
    public void A_free_phone_field_takes_any_real_number_and_anything_else_as_it_is()
    {
        Assert.AreEqual("+201012345678", PhoneRules.Tidy("1012345678", "EG"));
        Assert.AreEqual("+201012345678", PhoneRules.Tidy("+20 10 1234 5678", "EG"));
        Assert.AreEqual("+20223456789", PhoneRules.Tidy("02 2345 6789", "EG"), "a Cairo landline is a phone");
        Assert.AreEqual("+20223456789", PhoneRules.Tidy("+20 2 2345 6789", "EG"));
        Assert.AreEqual("+447400123456", PhoneRules.Tidy("+44 7400 123456", "EG"), "so is one from abroad");
        Assert.AreEqual("19019", PhoneRules.Tidy("19019", "EG"), "a hotline's short number is kept");
        Assert.AreEqual("ask Ahmed", PhoneRules.Tidy(" ask Ahmed ", "EG"), "a note is kept as typed");
        Assert.IsNull(PhoneRules.Tidy("  ", "EG"));
    }

    [TestMethod]
    public void A_stored_number_is_shown_the_way_the_country_writes_it()
    {
        Assert.AreEqual("010 12345678", PhoneRules.National("+201012345678", "EG"));
        Assert.AreEqual("010 12345678", PhoneRules.National("01012345678", "EG"), "one kept the old way reads the same");
        Assert.AreEqual("+44 7400 123456", PhoneRules.National("+447400123456", "EG"));
        Assert.AreEqual("19019", PhoneRules.National("19019", "EG"));
        Assert.IsNull(PhoneRules.National(null, "EG"));
    }

    [TestMethod]
    public void A_search_finds_a_number_by_its_local_or_its_international_digits()
    {
        var digits = PhoneRules.SearchDigits("+201012345678", "EG");
        StringAssert.Contains(digits, "0101234");
        StringAssert.Contains(digits, "20101234");
        StringAssert.Contains(digits, "5678");
        Assert.AreEqual(digits, PhoneRules.SearchDigits("010 1234 5678", "EG"), "however it was kept");
        Assert.AreEqual("19019", PhoneRules.SearchDigits("19019", "EG"));
        Assert.AreEqual("", PhoneRules.SearchDigits(null, "EG"));
    }

    [TestMethod]
    public void The_field_shows_a_mobile_of_the_country_and_the_pattern_only_keeps_nonsense_out()
    {
        var (pattern, placeholder) = PhoneRules.For("EG");
        Assert.IsTrue(PhoneRules.IsValid(placeholder, "EG"), placeholder);
        foreach (var typed in new[] { "01012345678", "+20 10 1234 5678", "1012345678", "٠١٠١٢٣٤٥٦٧٨", "(010) 1234-5678", "+201012345678" })
        {
            Assert.IsTrue(System.Text.RegularExpressions.Regex.IsMatch(typed, pattern), typed);
        }
        Assert.IsFalse(System.Text.RegularExpressions.Regex.IsMatch("ahmed", pattern));
        Assert.IsFalse(System.Text.RegularExpressions.Regex.IsMatch("0100", pattern));

        foreach (var country in new[] { "SA", "AE", "KW", "GB", "US", "TR" })
        {
            Assert.IsTrue(PhoneRules.IsValid(PhoneRules.For(country).Placeholder, country), country);
        }
        Assert.AreEqual("+xxxxxxxxxxx", PhoneRules.For("ZZ").Placeholder, "a country the library does not know");
        Assert.AreEqual("+447400123456", PhoneRules.Normalize("+44 7400 123456", "ZZ"), "takes any real mobile with its code");
    }
}
