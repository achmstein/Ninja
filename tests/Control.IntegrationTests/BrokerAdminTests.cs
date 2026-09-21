using Ninja.Control.API.Platform;

namespace Ninja.Control.IntegrationTests;

/// <summary>rabbitmqctl in the broker's container, as the platform runs it: a user, its vhost, the dead-letter policy, the shared user off the vhost, and everything down again.</summary>
[TestClass]
public sealed class BrokerAdminTests
{
    private static RabbitCtlBrokerAdmin Admin() => new(Containers.Shell, Containers.Options);

    private static async Task<string> CtlAsync(params string[] args)
    {
        var result = await Containers.Shell.RunAsync("docker", ["exec", Containers.RabbitName, "rabbitmqctl", .. args], null, CancellationToken.None);
        Assert.IsTrue(result.Ok, result.Output);
        return result.Stdout;
    }

    [TestMethod]
    public async Task A_stack_gets_a_user_with_every_right_on_its_vhost_alone_and_the_shared_user_is_taken_off_it()
    {
        var admin = Admin();
        var password = TenantNaming.NewSecret();

        await admin.EnsureUserAsync("blue_app", password, CancellationToken.None);
        await admin.EnsureVHostAsync("blue", "blue_app", CancellationToken.None);
        // Run again, as a retried stamp does: the user is re-keyed, the vhost is found, nothing fails
        await admin.EnsureVHostAsync("blue", "blue_app", CancellationToken.None);

        var users = await CtlAsync("list_users", "--quiet", "--no-table-headers");
        Assert.Contains("blue_app", users);
        Assert.IsFalse(users.Split('\n').First(l => l.StartsWith("blue_app", StringComparison.Ordinal)).Contains("administrator"), "no management tags");

        var permissions = await CtlAsync("list_permissions", "-p", "blue", "--quiet", "--no-table-headers");
        Assert.Contains("blue_app", permissions);
        Assert.Contains(".*", permissions);

        var policies = await CtlAsync("list_policies", "-p", "blue", "--quiet", "--no-table-headers");
        Assert.Contains("dead-letter", policies);
        Assert.Contains("ninja_dead_letters", policies);

        // The vhost is the boundary: blue_app holds nothing on the platform's default vhost
        var onRoot = await CtlAsync("list_user_permissions", "blue_app", "--quiet", "--no-table-headers");
        Assert.IsFalse(onRoot.Split('\n').Any(l => l.Trim() == "/" || l.StartsWith("/\t", StringComparison.Ordinal)), onRoot);

        // Re-keyed on a second stamp; the shared user loses the vhost once the stack is on its own
        await admin.EnsureUserAsync("blue_app", TenantNaming.NewSecret(), CancellationToken.None);
        await admin.ClearPermissionsAsync("blue", "guest", CancellationToken.None);
        await admin.ClearPermissionsAsync("blue", "guest", CancellationToken.None);

        await admin.DeleteVHostAsync("blue", CancellationToken.None);
        await admin.DeleteUserAsync("blue_app", CancellationToken.None);
        // Gone twice is not an error: a destroy retried from the top must pass
        await admin.DeleteVHostAsync("blue", CancellationToken.None);
        await admin.DeleteUserAsync("blue_app", CancellationToken.None);
        Assert.DoesNotContain("blue_app", await CtlAsync("list_users", "--quiet", "--no-table-headers"));
        Assert.DoesNotContain("blue", (await CtlAsync("list_vhosts", "--quiet", "--no-table-headers")).Split('\n').Select(l => l.Trim()).ToList());
    }
}
