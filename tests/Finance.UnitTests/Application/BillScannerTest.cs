#nullable enable
using Chillax.AI;
using Chillax.AI.Agents;
using Chillax.AI.Fake;
using Chillax.Finance.API.Application.Assist;
using Chillax.Finance.API.Application.Queries;
using Chillax.Finance.Domain.SeedWork;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Finance.UnitTests.Application;

/// <summary>The scanner end to end over the scripted client: image, categories and vendors in, proposal out.</summary>
[TestClass]
public class BillScannerTest
{
    private static readonly List<ExpenseCategoryView> Categories =
    [
        new(1, new LocalizedText("Electricity", "كهرباء"), 1, true),
        new(2, new LocalizedText("Rent", "إيجار"), 2, true),
    ];

    private static readonly DataContent Png = new(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }, "image/png");

    private static BillScanner Scanner(IChatClient? client)
    {
        var services = new ServiceCollection().BuildServiceProvider();
        var factory = new ChillaxAgentFactory(Options.Create(new AIOptions()), NullLoggerFactory.Instance, services, client);
        return new BillScanner(factory, new FixedClock(new DateTimeOffset(2026, 9, 15, 10, 0, 0, TimeSpan.Zero)));
    }

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
        public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;
    }

    private static FakeChatClient Fake() => new([new FakeAgentScriptRegistration(BillScanner.AgentKey, BillScannerFake.Respond)]);

    [TestMethod]
    public async Task The_fake_proposes_todays_bill_under_the_first_category_from_the_first_vendor()
    {
        var proposal = await Scanner(Fake()).ScanAsync(Png, Categories, ["North Cairo Electricity", "Vodafone"], CancellationToken.None);

        Assert.AreEqual("2026-09-15", proposal.Date);
        Assert.AreEqual(BillScannerFake.Amount, proposal.Amount);
        Assert.AreEqual(1, proposal.CategoryId);
        Assert.AreEqual(0.9, proposal.CategoryConfidence);
        Assert.AreEqual("North Cairo Electricity", proposal.Vendor);
        Assert.AreEqual(BillScannerFake.Note, proposal.Note);
        Assert.AreEqual("EGP", proposal.Currency);
        Assert.IsEmpty(proposal.Warnings);
    }

    [TestMethod]
    public async Task With_nothing_on_file_the_fake_makes_a_vendor_up_and_no_category_is_a_warning()
    {
        var proposal = await Scanner(Fake()).ScanAsync(Png, [], [], CancellationToken.None);

        Assert.AreEqual(BillScannerFake.Vendor, proposal.Vendor);
        Assert.IsNull(proposal.CategoryId);
        CollectionAssert.Contains(proposal.Warnings.ToList(), "No category fitted the bill; pick one.");
    }

    [TestMethod]
    public async Task Only_the_first_vendors_are_offered_but_all_of_them_match()
    {
        var many = Enumerable.Range(1, BillScanner.MaxVendors + 5).Select(i => $"Vendor {i}").ToList();

        var proposal = await Scanner(Fake()).ScanAsync(Png, Categories, many, CancellationToken.None);

        Assert.AreEqual("Vendor 1", proposal.Vendor);
    }

    [TestMethod]
    public void Off_without_a_chat_client()
    {
        Assert.IsFalse(Scanner(null).IsEnabled);
        Assert.IsTrue(Scanner(Fake()).IsEnabled);
    }
}
