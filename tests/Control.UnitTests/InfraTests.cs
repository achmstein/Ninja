using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

/// <summary>What the broker is told, in order, and what the log is allowed to show.</summary>
[TestClass]
public sealed class InfraTests
{
    private static (RabbitCtlBrokerAdmin Admin, RecordingShell Shell) Broker()
    {
        var shell = new RecordingShell(NullLogger<RecordingShell>.Instance);
        return (new RabbitCtlBrokerAdmin(shell, Options.Create(new PlatformOptions { RabbitContainer = "broker" })), shell);
    }

    [TestMethod]
    public async Task Broker_user_is_added_then_granted_only_its_vhost()
    {
        var (admin, shell) = Broker();

        await admin.EnsureUserAsync("blue_app", "pw-1234567890123456", CancellationToken.None);
        await admin.EnsureVHostAsync("blue", "blue_app", CancellationToken.None);
        await admin.ClearPermissionsAsync("blue", "guest", CancellationToken.None);
        await admin.DeleteUserAsync("blue_app", CancellationToken.None);

        CollectionAssert.AreEqual(new[]
        {
            "docker exec broker rabbitmqctl list_users --quiet --no-table-headers",
            "docker exec broker rabbitmqctl add_user blue_app pw-1234567890123456",
            "docker exec broker rabbitmqctl set_user_tags blue_app",
            "docker exec broker rabbitmqctl list_vhosts --quiet --no-table-headers",
            "docker exec broker rabbitmqctl add_vhost blue",
            "docker exec broker rabbitmqctl set_permissions -p blue blue_app .* .* .*",
            "docker exec broker rabbitmqctl set_policy -p blue dead-letter .* {\"dead-letter-exchange\":\"ninja_dead_letters\"} --apply-to queues",
            "docker exec broker rabbitmqctl clear_permissions -p blue guest",
            "docker exec broker rabbitmqctl delete_user blue_app",
        }, shell.Commands);
    }

    [TestMethod]
    public void The_log_never_shows_a_password()
    {
        Assert.AreEqual("exec broker rabbitmqctl add_user blue_app ***", ProcessShell.ForLog(["exec", "broker", "rabbitmqctl", "add_user", "blue_app", "secret"]));
        Assert.AreEqual("exec broker rabbitmqctl change_password blue_app ***", ProcessShell.ForLog(["exec", "broker", "rabbitmqctl", "change_password", "blue_app", "secret"]));
        Assert.AreEqual("exec -e PGPASSWORD=*** pg pg_dump", ProcessShell.ForLog(["exec", "-e", "PGPASSWORD=secret", "pg", "pg_dump"]));
        Assert.AreEqual("compose -p ninja-blue up -d", ProcessShell.ForLog(["compose", "-p", "ninja-blue", "up", "-d"]));
    }

    [TestMethod]
    public void The_platform_databases_are_the_ones_closed_to_public()
        => CollectionAssert.AreEquivalent(new[] { "controldb", "keycloak", "postgres" }, PlatformLockdownService.Databases);
}
