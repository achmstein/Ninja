using System.Diagnostics;
using System.Text;

namespace Ninja.Control.API.Platform;

/// <param name="Output">What the command printed on both streams, in order: a log, not something to parse.</param>
/// <param name="Stdout">Its standard output alone, for output that is data (JSON, a dump).</param>
public sealed record ShellResult(int ExitCode, string Output, string Stdout = "")
{
    public bool Ok => ExitCode == 0;
}

/// <summary>Runs a command on the host the control plane lives on: docker and docker compose, nothing else.</summary>
public interface IShell
{
    Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, CancellationToken ct);

    /// <summary>The same, with standard output copied raw into <paramref name="stdout"/> (a dump, an archive) and only stderr kept as the log.</summary>
    Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, Stream? stdin, Stream stdout, CancellationToken ct);
}

public sealed class ProcessShell(ILogger<ProcessShell> logger) : IShell
{
    public async Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, CancellationToken ct)
    {
        using var process = Start(file, args, workingDirectory, redirectStdin: false);

        var combined = new StringBuilder();
        var output = new StringBuilder();
        var stdout = PumpAsync(process.StandardOutput, combined, output);
        var stderr = PumpAsync(process.StandardError, combined, null);
        await process.WaitForExitAsync(ct);
        await Task.WhenAll(stdout, stderr);

        return new ShellResult(process.ExitCode, combined.ToString(), output.ToString());
    }

    public async Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, Stream? stdin, Stream stdout, CancellationToken ct)
    {
        using var process = Start(file, args, workingDirectory, redirectStdin: stdin is not null);

        var errors = new StringBuilder();
        var stderr = PumpAsync(process.StandardError, errors, null);
        var copyOut = process.StandardOutput.BaseStream.CopyToAsync(stdout, ct);
        if (stdin is not null)
        {
            await stdin.CopyToAsync(process.StandardInput.BaseStream, ct);
            process.StandardInput.Close();
        }
        await copyOut;
        await process.WaitForExitAsync(ct);
        await stderr;

        return new ShellResult(process.ExitCode, errors.ToString());
    }

    private Process Start(string file, IReadOnlyList<string> args, string? workingDirectory, bool redirectStdin)
    {
        var psi = new ProcessStartInfo(file)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            RedirectStandardInput = redirectStdin,
            UseShellExecute = false,
            WorkingDirectory = workingDirectory ?? Environment.CurrentDirectory,
        };
        foreach (var a in args) psi.ArgumentList.Add(a);

        logger.LogInformation("$ {File} {Args}", file, ForLog(args));
        return Process.Start(psi) ?? throw new InvalidOperationException($"Could not start {file}");
    }

    /// <summary>The command line for the log, with the passwords a broker user or a dump carries masked.</summary>
    internal static string ForLog(IReadOnlyList<string> args)
    {
        var shown = new string[args.Count];
        for (var i = 0; i < args.Count; i++)
        {
            var a = args[i];
            var afterUser = i >= 2 && args[i - 2] is "add_user" or "change_password";
            shown[i] = afterUser ? "***" : a.StartsWith("PGPASSWORD=", StringComparison.Ordinal) ? "PGPASSWORD=***" : a;
        }
        return string.Join(' ', shown);
    }

    private static async Task PumpAsync(StreamReader reader, StringBuilder combined, StringBuilder? own)
    {
        while (await reader.ReadLineAsync() is { } line)
        {
            lock (combined)
            {
                combined.AppendLine(line);
                own?.AppendLine(line);
            }
        }
    }
}

/// <summary>Dry run: says what it would have run and answers as if it worked.</summary>
public sealed class RecordingShell(ILogger<RecordingShell> logger) : IShell
{
    public List<string> Commands { get; } = [];

    public Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, CancellationToken ct)
    {
        var line = Record(file, args);
        return Task.FromResult(new ShellResult(0, $"(dry run) {line}"));
    }

    public Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, Stream? stdin, Stream stdout, CancellationToken ct)
    {
        var line = Record(file, args);
        return Task.FromResult(new ShellResult(0, $"(dry run) {line}"));
    }

    private string Record(string file, IReadOnlyList<string> args)
    {
        // Commands keeps what would have run, for the tests; the log shows it masked
        var line = $"{file} {string.Join(' ', args)}";
        lock (Commands) Commands.Add(line);
        logger.LogInformation("(dry run) $ {File} {Args}", file, ProcessShell.ForLog(args));
        return $"{file} {ProcessShell.ForLog(args)}";
    }
}
