using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Ninja.Control.API.Apis;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

/// <summary>A destroyed tenant can be taken off the list; a live one cannot be forgotten by mistake.</summary>
[TestClass]
public sealed class ForgetTenantTests
{
    private static ControlContext Db() => new(new DbContextOptionsBuilder<ControlContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static Tenant Tenant(string slug, TenantStatus status) => new()
    {
        Slug = slug,
        NameEn = slug,
        Kind = TenantKind.Customer,
        Plan = TenantPlan.Starter,
        Status = status,
        OwnerEmail = $"owner@{slug}.test",
        IdentitySecret = "identity-secret-1234567890123456",
        ControlSecret = "control-secret-12345678901234567",
        Steps = [new ProvisioningStep { Name = "stack-down", Status = StepStatus.Done }],
        Payments = [new Payment { Amount = 100m, Currency = "EGP", At = DateTimeOffset.UtcNow }],
    };

    private sealed class CollectingAudit : IAuditWriter
    {
        public readonly List<(string Action, string? Slug)> Rows = [];
        public Task WriteAsync(string action, string? slug, object? details, CancellationToken ct, string? source = null)
        {
            Rows.Add((action, slug));
            return Task.CompletedTask;
        }
    }

    [TestMethod]
    public async Task A_destroyed_tenant_is_forgotten_with_its_steps_and_payments_and_the_audit_says_so()
    {
        using var db = Db();
        var gone = Tenant("gone", TenantStatus.Destroyed);
        db.Tenants.Add(gone);
        db.Tenants.Add(Tenant("blue", TenantStatus.Running));
        await db.SaveChangesAsync();
        var goneId = gone.Id;
        var audit = new CollectingAudit();

        var result = await ControlApi.Forget(db, audit, "gone", default);

        Assert.IsInstanceOfType<NoContent>(result.Result);
        Assert.IsNull(await db.Tenants.SingleOrDefaultAsync(t => t.Slug == "gone"));
        Assert.IsEmpty(await db.Steps.Where(s => s.TenantId == goneId).ToListAsync());
        Assert.IsEmpty(await db.Payments.Where(p => p.TenantId == goneId).ToListAsync());
        Assert.IsNotNull(await db.Tenants.SingleOrDefaultAsync(t => t.Slug == "blue"), "the neighbour is untouched");
        Assert.AreEqual(("tenant.forgotten", "gone"), audit.Rows.Single());
    }

    [TestMethod]
    public async Task Only_a_destroyed_tenant_can_be_forgotten()
    {
        using var db = Db();
        foreach (var status in new[] { TenantStatus.Running, TenantStatus.Stopped, TenantStatus.Failed, TenantStatus.Suspended, TenantStatus.Destroying })
            db.Tenants.Add(Tenant(status.ToString().ToLowerInvariant(), status));
        await db.SaveChangesAsync();
        var audit = new CollectingAudit();

        foreach (var slug in new[] { "running", "stopped", "failed", "suspended", "destroying" })
        {
            var result = await ControlApi.Forget(db, audit, slug, default);
            Assert.IsInstanceOfType<Conflict<Microsoft.AspNetCore.Mvc.ProblemDetails>>(result.Result, slug);
        }
        Assert.AreEqual(5, await db.Tenants.CountAsync(), "nothing was removed");
        Assert.IsEmpty(audit.Rows);

        Assert.IsInstanceOfType<NotFound>((await ControlApi.Forget(db, audit, "nobody", default)).Result);
    }
}
