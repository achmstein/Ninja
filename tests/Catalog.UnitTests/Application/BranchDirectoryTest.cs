using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Catalog.API.Application;
using Ninja.Catalog.API.Infrastructure;
using Ninja.Catalog.API.Model;

namespace Ninja.Catalog.UnitTests.Application;

/// <summary>
/// The business's branches as the catalog can tell: Tenant.API's list, and when it cannot be reached
/// the branches the catalog has seen. Not being reached includes not answering in time.
/// </summary>
[TestClass]
public class BranchDirectoryTest
{
    private sealed class Answers(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> answer) : HttpMessageHandler, IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(this, disposeHandler: false);

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => answer(request, cancellationToken);
    }

    private static async Task<CatalogContext> ContextWithBranchAsync(int branchId)
    {
        var context = new CatalogContext(
            new DbContextOptionsBuilder<CatalogContext>().UseInMemoryDatabase($"branch-directory-{Guid.NewGuid()}").Options,
            new ConfigurationBuilder().Build());
        var item = new CatalogItem(new LocalizedText("Brownie", null)) { Price = 30, CatalogTypeId = 1 };
        context.CatalogItems.Add(item);
        await context.SaveChangesAsync();
        context.BranchItemOverrides.Add(new BranchItemOverride { BranchId = branchId, CatalogItemId = item.Id, IsAvailable = false });
        await context.SaveChangesAsync();
        return context;
    }

    [TestMethod]
    public async Task Tenant_s_branches_and_the_ones_the_catalog_has_seen_are_the_branches()
    {
        await using var context = await ContextWithBranchAsync(7);
        var tenant = new Answers((_, _) => Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK)
        {
            Content = new StringContent("""[{"id":1},{"id":2}]""", System.Text.Encoding.UTF8, "application/json"),
        }));

        var ids = await BranchDirectory.KnownBranchIdsAsync(context, tenant, NullLogger.Instance);

        CollectionAssert.AreEquivalent(new[] { 1, 2, 7 }, ids.ToArray());
    }

    [TestMethod]
    public async Task A_tenant_api_that_does_not_answer_in_time_is_one_that_cannot_be_reached()
    {
        await using var context = await ContextWithBranchAsync(7);
        // What HttpClient's own timeout looks like to the caller: a cancellation nobody asked for
        var silent = new Answers((_, _) => throw new TaskCanceledException("The request was canceled due to the configured HttpClient.Timeout of 5 seconds elapsing.", new TimeoutException()));

        var ids = await BranchDirectory.KnownBranchIdsAsync(context, silent, NullLogger.Instance);

        CollectionAssert.AreEquivalent(new[] { 7 }, ids.ToArray(), "the branches the catalog knows stand in, as when the call fails outright");
    }

    [TestMethod]
    public async Task The_caller_giving_up_is_still_the_caller_giving_up()
    {
        await using var context = await ContextWithBranchAsync(7);
        using var gone = new CancellationTokenSource();
        var slow = new Answers((_, ct) =>
        {
            gone.Cancel();
            ct.ThrowIfCancellationRequested();
            return Task.FromResult(new HttpResponseMessage());
        });

        await Assert.ThrowsAsync<OperationCanceledException>(() => BranchDirectory.KnownBranchIdsAsync(context, slow, NullLogger.Instance, gone.Token));
    }
}
