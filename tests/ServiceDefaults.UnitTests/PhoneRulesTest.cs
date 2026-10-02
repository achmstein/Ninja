using Ninja.ServiceDefaults;

namespace ServiceDefaults.UnitTests;

[TestClass]
public class PhoneRulesTest
{
    [TestMethod]
    [DataRow("01012345678", "01012345678")]
    [DataRow("010 1234 5678", "01012345678")]
    [DataRow("010-1234-5678", "01012345678")]
    [DataRow("(010) 1234.5678", "01012345678")]
    [DataRow("+20 10 1234 5678", "01012345678")]
    [DataRow("+20 010 1234 5678", "01012345678")]
    [DataRow("0020 1012345678", "01012345678")]
    [DataRow("201012345678", "01012345678")]
    [DataRow("1012345678", "01012345678")]
    [DataRow("٠١٠١٢٣٤٥٦٧٨", "01012345678")]
    [DataRow("+٢٠ ١٠ ١٢٣٤ ٥٦٧٨", "01012345678")]
    [DataRow("۰۱۰۱۲۳۴۵۶۷۸", "01012345678")]
    public void An_Egyptian_mobile_is_one_number_however_it_is_typed(string typed, string expected)
    {
        Assert.AreEqual(expected, PhoneRules.Normalize(typed, "EG"));
        Assert.IsTrue(PhoneRules.IsValid(PhoneRules.Normalize(typed, "EG"), "EG"));
    }

    [TestMethod]
    public void A_Gulf_mobile_loses_its_country_code_for_its_own_trunk_zero()
    {
        Assert.AreEqual("0512345678", PhoneRules.Normalize("+966 51 234 5678", "SA"));
        Assert.AreEqual("0512345678", PhoneRules.Normalize("512345678", "SA"));
        Assert.AreEqual("0501234567", PhoneRules.Normalize("00971501234567", "AE"));
    }

    [TestMethod]
    public void Elsewhere_an_international_number_keeps_its_plus()
    {
        Assert.AreEqual("+447700900123", PhoneRules.Normalize("+44 7700 900123", "GB"));
        Assert.AreEqual("+447700900123", PhoneRules.Normalize("0044 7700 900123", "GB"));
        Assert.AreEqual("07700900123", PhoneRules.Normalize("07700 900123", "GB"));
    }

    [TestMethod]
    public void Nothing_number_like_is_empty_and_a_short_number_is_still_invalid()
    {
        Assert.AreEqual("", PhoneRules.Normalize("  ", "EG"));
        Assert.AreEqual("", PhoneRules.Normalize("ahmed", "EG"));
        Assert.AreEqual("0101", PhoneRules.Normalize("010-1", "EG"));
        Assert.IsFalse(PhoneRules.IsValid(PhoneRules.Normalize("010-1", "EG"), "EG"));
        Assert.IsFalse(PhoneRules.IsValid(PhoneRules.Normalize("+44 7700 900123", "EG"), "EG"), "a foreign number is not an Egyptian mobile");
    }

    [TestMethod]
    public void A_free_phone_field_takes_a_mobile_in_the_country_s_form_and_anything_else_as_it_is()
    {
        Assert.AreEqual("01012345678", PhoneRules.Tidy("1012345678", "EG"), "the trunk zero comes back");
        Assert.AreEqual("01012345678", PhoneRules.Tidy("+20 10 1234 5678", "EG"));
        Assert.AreEqual("0223456789", PhoneRules.Tidy("02 2345 6789", "EG"), "a Cairo landline stays a landline");
        Assert.AreEqual("0223456789", PhoneRules.Tidy("+20 2 2345 6789", "EG"));
        Assert.AreEqual("+447700900123", PhoneRules.Tidy("+44 7700 900123", "EG"), "abroad keeps its plus");
        Assert.AreEqual("ask Ahmed", PhoneRules.Tidy(" ask Ahmed ", "EG"), "a note is kept as typed");
        Assert.IsNull(PhoneRules.Tidy("  ", "EG"));
    }
}
