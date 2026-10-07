using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Assistant.API;
using Ninja.Assistant.API.Auth;
using Ninja.Assistant.API.Tools;
using Ninja.Assistant.UnitTests.Support;

namespace Ninja.Assistant.UnitTests.Tools;

[TestClass]
public sealed class WriteFlowTests
{
    private sealed record Plan(string Dish, decimal Price, List<int> Options);

    private static DraftSigner Signer(FakeTimeProvider clock, string key = "a-key")
        => new(Microsoft.Extensions.Options.Options.Create(new AssistantOptions { DraftKey = key }), clock, NullLogger<DraftSigner>.Instance);

    [TestMethod]
    public void A_draft_comes_back_as_it_was_signed()
    {
        var signer = Signer(new FakeTimeProvider(DateTimeOffset.UnixEpoch.AddYears(56)));
        var token = signer.Sign(new Plan("لاتيه سبانش", 85, [900000001, 900000002]), "owner-1", "create_menu_item", "req-1");

        var (draft, error) = signer.Open<Plan>(token, "owner-1", "create_menu_item", "req-1");

        Assert.IsNull(error, error);
        Assert.AreEqual("لاتيه سبانش", draft!.Dish);
        Assert.AreEqual(85m, draft.Price);
        CollectionAssert.AreEqual(new[] { 900000001, 900000002 }, draft.Options);
    }

    [TestMethod]
    public void A_changed_or_borrowed_draft_is_refused()
    {
        var signer = Signer(new FakeTimeProvider(DateTimeOffset.UnixEpoch.AddYears(56)));
        var token = signer.Sign(new Plan("Latte", 85, []), "owner-1", "create_menu_item", "req-1");
        var parts = token.Split('.');
        var cheaper = signer.Sign(new Plan("Latte", 1, []), "owner-1", "create_menu_item", "req-1").Split('.')[0];

        Assert.IsNotNull(signer.Open<Plan>($"{cheaper}.{parts[1]}.{parts[2]}", "owner-1", "create_menu_item", "req-1").Error, "its plan swapped");
        Assert.IsNotNull(signer.Open<Plan>(token, "owner-2", "create_menu_item", "req-1").Error, "another person");
        Assert.IsNotNull(signer.Open<Plan>(token, "owner-1", "set_recipe", "req-1").Error, "another tool");
        Assert.IsNotNull(signer.Open<Plan>(token, "owner-1", "create_menu_item", "req-2").Error, "another request");
        Assert.IsNotNull(signer.Open<Plan>(null, "owner-1", "create_menu_item", "req-1").Error, "none at all");
        Assert.IsNotNull(Signer(new FakeTimeProvider(DateTimeOffset.UnixEpoch.AddYears(56)), "other-key")
            .Open<Plan>(token, "owner-1", "create_menu_item", "req-1").Error, "signed with another key");
    }

    [TestMethod]
    public void A_draft_expires()
    {
        var clock = new FakeTimeProvider(DateTimeOffset.UnixEpoch.AddYears(56));
        var signer = Signer(clock);
        var token = signer.Sign(new Plan("Latte", 85, []), "owner-1", "create_menu_item", "req-1");

        clock.Advance(DraftSigner.Lifetime - TimeSpan.FromMinutes(1));
        Assert.IsNull(signer.Open<Plan>(token, "owner-1", "create_menu_item", "req-1").Error);
        clock.Advance(TimeSpan.FromMinutes(2));
        StringAssert.Contains(signer.Open<Plan>(token, "owner-1", "create_menu_item", "req-1").Error, "expired");
    }

    [TestMethod]
    public void Writes_are_capped_per_person_in_a_window()
    {
        var clock = new FakeTimeProvider(DateTimeOffset.UnixEpoch.AddYears(56));
        var limiter = new WriteLimiter(clock);
        for (var i = 0; i < WriteLimiter.MaxWrites; i++)
            Assert.IsNull(limiter.TryTake("owner-1"));

        Assert.IsNotNull(limiter.TryTake("owner-1"), "one more in the window");
        Assert.IsNull(limiter.TryTake("owner-2"), "another person has their own");
        clock.Advance(WriteLimiter.Window);
        Assert.IsNull(limiter.TryTake("owner-1"), "the window moved on");
    }

    [TestMethod]
    public void Each_step_of_a_confirm_has_its_own_stable_key()
    {
        var a = WriteTools.IdempotencyKey("owner-1", "create_menu_item", "req-1|item");
        Assert.AreEqual(a, WriteTools.IdempotencyKey("owner-1", "create_menu_item", "req-1|item"));
        Assert.AreNotEqual(a, WriteTools.IdempotencyKey("owner-1", "create_menu_item", "req-1|stock:milk"));
    }
}
