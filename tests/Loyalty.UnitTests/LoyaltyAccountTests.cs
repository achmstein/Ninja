using Ninja.Loyalty.API.Apis;
using Ninja.Loyalty.API.Model;

namespace Ninja.Loyalty.UnitTests;

/// <summary>What a card is worth: points earned, spent, taken back after a refund, and the tier they carry the member to.</summary>
[TestClass]
public sealed class LoyaltyAccountTests
{
    private static LoyaltyAccount Card(int balance = 0, int lifetime = 0) => new()
    {
        Id = 1,
        UserId = "customer-1",
        PointsBalance = balance,
        LifetimePoints = lifetime,
        CurrentTier = LoyaltyTier.Bronze,
    };

    [TestMethod]
    public void Points_earned_raise_the_balance_the_lifetime_and_the_tier()
    {
        var card = Card();

        card.AddPoints(400, TransactionType.Purchase, "order-1", "First order");

        Assert.AreEqual(400, card.PointsBalance);
        Assert.AreEqual(400, card.LifetimePoints);
        Assert.AreEqual(LoyaltyTier.Bronze, card.CurrentTier);
        var entry = card.Transactions.Single();
        Assert.AreEqual(400, entry.Points);
        Assert.AreEqual(TransactionType.Purchase, entry.Type);
        Assert.AreEqual("order-1", entry.ReferenceId);
    }

    [TestMethod]
    public void The_tier_follows_what_was_ever_earned_not_what_is_left()
    {
        var card = Card();

        card.AddPoints(999, TransactionType.Purchase);
        Assert.AreEqual(LoyaltyTier.Bronze, card.CurrentTier);
        card.AddPoints(1, TransactionType.Purchase);
        Assert.AreEqual(LoyaltyTier.Silver, card.CurrentTier, "a thousand earned is Silver");
        card.AddPoints(4000, TransactionType.Purchase);
        Assert.AreEqual(LoyaltyTier.Gold, card.CurrentTier);
        card.AddPoints(5000, TransactionType.Purchase);
        Assert.AreEqual(LoyaltyTier.Platinum, card.CurrentTier);

        card.RedeemPoints(card.PointsBalance);
        Assert.AreEqual(0, card.PointsBalance);
        Assert.AreEqual(LoyaltyTier.Platinum, card.CurrentTier, "spending what was earned does not take the tier back");
    }

    [TestMethod]
    public void A_redemption_spends_the_balance_alone_and_never_more_than_there_is()
    {
        var card = Card(balance: 500, lifetime: 500);

        card.RedeemPoints(300, "ticket-9");

        Assert.AreEqual(200, card.PointsBalance);
        Assert.AreEqual(500, card.LifetimePoints, "what was earned stays earned");
        var entry = card.Transactions.Single();
        Assert.AreEqual(-300, entry.Points, "a redemption is negative on the statement");
        Assert.AreEqual(TransactionType.Redemption, entry.Type);

        Assert.ThrowsExactly<InvalidOperationException>(() => card.RedeemPoints(201));
        Assert.ThrowsExactly<ArgumentException>(() => card.RedeemPoints(0));
    }

    [TestMethod]
    public void A_refund_takes_back_what_it_can_and_points_already_spent_are_not_a_debt()
    {
        var card = Card(balance: 50, lifetime: 500);

        var taken = card.DeductPoints(200, "order-1", "Refunded");

        Assert.AreEqual(50, taken, "only what was there to take");
        Assert.AreEqual(0, card.PointsBalance);
        Assert.IsTrue(card.PointsBalance >= 0, "a card never owes points");
        Assert.AreEqual(-50, card.Transactions.Single().Points);
    }

    [TestMethod]
    public void Nothing_is_earned_from_nothing()
    {
        var card = Card();
        Assert.ThrowsExactly<ArgumentException>(() => card.AddPoints(0, TransactionType.Purchase));
        Assert.ThrowsExactly<ArgumentException>(() => card.AddPoints(-10, TransactionType.Purchase));
        Assert.IsEmpty(card.Transactions);
    }

    [TestMethod]
    public void A_hundred_points_are_worth_one_of_the_cafes_money()
    {
        Assert.AreEqual(100, LoyaltyApi.RedemptionPointsPerUnit);
    }
}
