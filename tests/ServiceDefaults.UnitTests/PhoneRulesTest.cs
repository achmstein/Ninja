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
}
