using System.Diagnostics;
using System.Text;

namespace Ninja.Control.API.Platform;

public sealed record ShellResult(int ExitCode, string Output)
{
    public bool Ok => ExitCode == 0;
}

/// <summary>Runs a command on the host the control plane lives on: docker and docker compose, nothing else.</summary>
public interface IShell
{
    Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, CancellationToken ct);
}

public sealed class ProcessShell(ILogger<ProcessShell> logger) : IShell
{
    public async Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, CancellationToken ct)
    {
        var psi = new ProcessStartInfo(file)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            WorkingDirectory = workingDirectory ?? Environment.CurrentDirectory,
        };
        foreach (var a in args) psi.ArgumentList.Add(a);

        logger.LogInformation("$ {File} {Args}", file, string.Join(' ', args));
        using var process = Process.Start(psi) ?? throw new InvalidOperationException($"Could not start {file}");

        var output = new StringBuilder();
        var stdout = PumpAsync(process.StandardOutput, output);
        var stderr = PumpAsync(process.StandardError, output);
        await process.WaitForExitAsync(ct);
        await Task.WhenAll(stdout, stderr);

        return new ShellResult(process.ExitCode, output.ToString());
    }

    private static async Task PumpAsync(StreamReader reader, StringBuilder into)
    {
        while (await reader.ReadLineAsync() is { } line)
        {
            lock (into) into.AppendLine(line);
        }
    }
}

/// <summary>Dry run: says what it would have run and answers as if it worked.</summary>
public sealed class RecordingShell(ILogger<RecordingShell> logger) : IShell
{
    public List<string> Commands { get; } = [];

    public Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, CancellationToken ct)
    {
        var line = $"{file} {string.Join(' ', args)}";
        lock (Commands) Commands.Add(line);
        logger.LogInformation("(dry run) $ {Line}", line);
        return Task.FromResult(new ShellResult(0, $"(dry run) {line}"));
    }
}
