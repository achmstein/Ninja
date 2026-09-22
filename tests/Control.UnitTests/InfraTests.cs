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
        await admin.DeleteQueueAsync("blue", "Inventory", CancellationToken.None);
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
            "docker exec broker rabbitmqctl delete_queue -p blue Inventory",
            "docker exec broker rabbitmqctl delete_user blue_app",
        }, shell.Commands);
    }

    /// <summary>A shell whose rabbitmqctl answers with the given exit code and text.</summary>
    private sealed class AnsweringShell(int code, string output) : IShell
    {
        public Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, CancellationToken ct) => Task.FromResult(new ShellResult(code, output));
        public Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, Stream? stdin, Stream stdout, CancellationToken ct) => Task.FromResult(new ShellResult(code, output));
    }

    [TestMethod]
    public async Task A_queue_that_is_already_gone_is_nothing_but_any_other_refusal_is_an_error()
    {
        static RabbitCtlBrokerAdmin With(int code, string output) => new(new AnsweringShell(code, output), Options.Create(new PlatformOptions { RabbitContainer = "broker" }));

        // RabbitMQ 4.2, the second time a plan drops the same module
        await With(64, "Deleting queue 'Payroll' on vhost 'lucaffe' ...\nError:\nNo such queue was found\n").DeleteQueueAsync("lucaffe", "Payroll", CancellationToken.None);
        await With(64, "Error:\nVirtual host 'gone' does not exist\n").DeleteQueueAsync("gone", "Payroll", CancellationToken.None);

        await Assert.ThrowsExactlyAsync<InvalidOperationException>(() => With(69, "Error: unable to connect to node rabbit@broker\n").DeleteQueueAsync("lucaffe", "Payroll", CancellationToken.None));
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
