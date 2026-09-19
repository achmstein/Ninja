using Ninja.Catalog.API.Model;

namespace Catalog.UnitTests.Model;

[TestClass]
public class PromoCodeTest
{
    private static readonly DateTime Now = new(2026, 9, 18, 12, 0, 0, DateTimeKind.Utc);

    private static PromoCode Percent(decimal value = 10) => new() { Code = "SAVE", Kind = PromoKind.Percent, Value = value };

    [TestMethod]
    public void A_percentage_is_taken_off_the_subtotal_and_rounded()
    {
        var quote = Percent(15).Evaluate(33.33m, usedByThisCustomer: false, Now);

        Assert.IsTrue(quote.Valid);
        Assert.AreEqual(5.00m, quote.Discount);
    }

    [TestMethod]
    public void An_amount_never_exceeds_the_subtotal()
    {
        var promo = new PromoCode { Code = "TWENTY", Kind = PromoKind.Amount, Value = 20 };

        Assert.AreEqual(12m, promo.Evaluate(12m, false, Now).Discount);
        Assert.AreEqual(20m, promo.Evaluate(50m, false, Now).Discount);
    }

    [TestMethod]
    public void Each_rule_names_its_own_refusal()
    {
        Assert.AreEqual(PromoRefusal.Inactive, new PromoCode { Code = "A", IsActive = false, Value = 5 }.Evaluate(100, false, Now).Reason);
        Assert.AreEqual(PromoRefusal.NotStarted, new PromoCode { Code = "A", Value = 5, StartsAt = Now.AddDays(1) }.Evaluate(100, false, Now).Reason);
        Assert.AreEqual(PromoRefusal.Expired, new PromoCode { Code = "A", Value = 5, EndsAt = Now }.Evaluate(100, false, Now).Reason);
        Assert.AreEqual(PromoRefusal.UsedUp, new PromoCode { Code = "A", Value = 5, MaxUses = 3, Uses = 3 }.Evaluate(100, false, Now).Reason);
        Assert.AreEqual(PromoRefusal.AlreadyUsed, new PromoCode { Code = "A", Value = 5, OncePerCustomer = true }.Evaluate(100, usedByThisCustomer: true, Now).Reason);
        Assert.AreEqual(PromoRefusal.BelowMinimum, new PromoCode { Code = "A", Value = 5, MinSubtotal = 150 }.Evaluate(100, false, Now).Reason);
    }

    [TestMethod]
    public void A_reusable_code_ignores_earlier_use_by_the_same_customer()
    {
        var promo = new PromoCode { Code = "AGAIN", Kind = PromoKind.Percent, Value = 10, OncePerCustomer = false };

        Assert.IsTrue(promo.Evaluate(100, usedByThisCustomer: true, Now).Valid);
    }

    [TestMethod]
    public void Codes_are_normalized_and_checked_for_shape()
    {
        Assert.AreEqual("SUMMER-10", PromoCode.Normalize("  summer-10 "));
        Assert.IsTrue(PromoCode.IsWellFormed("SUMMER-10"));
        Assert.IsFalse(PromoCode.IsWellFormed("SUMMER 10"));
        Assert.IsFalse(PromoCode.IsWellFormed(""));
        Assert.IsFalse(PromoCode.IsWellFormed(new string('A', PromoCode.CodeMaxLength + 1)));
    }
}
