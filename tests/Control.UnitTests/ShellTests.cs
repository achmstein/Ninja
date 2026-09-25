using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

/// <summary>What docker printed, reduced to the line that says why it failed.</summary>
[TestClass]
public sealed class ShellTests
{
    public const string PullDenied = """
         Image ninja-spaces:nope Pulling 
         Image ninja-inventory:nope Pulling 
         Image ninja-inventory:nope Error pull access denied for ninja-inventory, repository does not exist or may require 'docker login': denied: requested access to the resource is denied
         Image ninja-spaces:nope Interrupted 
        Error response from daemon: pull access denied for ninja-inventory, repository does not exist or may require 'docker login': denied: requested access to the resource is denied
        Error response from daemon: No such image: ninja-spaces:nope
        """;

    [TestMethod]
    public void The_daemons_first_answer_is_the_line_that_matters_in_a_compose_pull()
        => Assert.AreEqual(
            "pull access denied for ninja-inventory, repository does not exist or may require 'docker login': denied: requested access to the resource is denied",
            ShellException.Summarize(PullDenied));

    [TestMethod]
    public void A_compose_progress_line_that_ended_in_error_stands_in_when_the_daemon_said_nothing()
        => Assert.AreEqual(
            "Container ninja-blue-catalog-api-1 Error dependency failed to start",
            ShellException.Summarize(" Container ninja-blue-postgres-1 Started \n Container ninja-blue-catalog-api-1 Error dependency failed to start\n Container ninja-blue-tenant-api-1 Waiting \n"));

    [TestMethod]
    public void An_error_line_loses_its_label_and_a_lone_line_comes_back_as_it_is()
    {
        Assert.AreEqual("no such service: gateway", ShellException.Summarize("validating compose file\nerror: no such service: gateway\n"));
        Assert.AreEqual("error during connect: this error may indicate that the docker daemon is not running", ShellException.Summarize("error during connect: this error may indicate that the docker daemon is not running\n"));
    }

    [TestMethod]
    public void With_no_error_line_the_last_line_is_the_best_guess()
        => Assert.AreEqual("exit status 1", ShellException.Summarize(" Container ninja-blue-postgres-1 Created \nexit status 1\n"));

    [TestMethod]
    public void The_exception_carries_the_whole_log_beside_the_one_line()
    {
        var ex = new ShellException(PullDenied);
        StringAssert.StartsWith(ex.Message, "pull access denied for ninja-inventory");
        Assert.AreEqual(PullDenied, ex.Log);
    }
}
