using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>
/// The public edge: what the platform's Caddy routes, rewritten from the
/// record. Today the businesses' own domains; with more than one node, which
/// node each tenant's traffic goes to as well (docs/multi-server-plan.md).
/// </summary>
public interface IEdgeRouter
{
    /// <summary>The edge's files rewritten from the record and Caddy reloaded; the file put back when Caddy refuses it. What was done, in words.</summary>
    Task<string> ApplyAsync(CancellationToken ct);
}

/// <summary>The Caddy beside the control plane, reached with docker exec.</summary>
public sealed class CaddyEdgeRouter(ControlContext context, IShell shell, IOptions<PlatformOptions> options) : IEdgeRouter
{
    private PlatformOptions Platform => options.Value;

    /// <summary>The custom-domain sites of every live tenant, then a Caddy reload; nothing when no business has its own domain yet.</summary>
    public async Task<string> ApplyAsync(CancellationToken ct)
    {
        var live = await context.Tenants.AsNoTracking().Where(t => t.Status != TenantStatus.Destroyed && t.Status != TenantStatus.Destroying && t.CustomerDomain != null).ToListAsync(ct);
        var snippet = Templates.CustomDomains(live, Platform);
        var path = Platform.EdgeSnippetPath;
        var previous = File.Exists(path) ? await File.ReadAllTextAsync(path, ct) : null;
        if (previous == snippet)
            return "unchanged";
        if (Platform.DryRun && !Directory.Exists(Path.GetDirectoryName(path)!))
            return $"(dry run) {live.Count} custom domain(s)";

        // The file is what Caddy reads on its next start too, so a snippet it cannot parse must never stay on disk:
        // written, checked by Caddy itself, and put back the way it was when the check fails
        await File.WriteAllTextAsync(path, snippet, ct);
        var validate = await shell.RunAsync("docker", ["exec", Platform.EdgeContainer, "caddy", "validate", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"], null, CancellationToken.None);
        if (!validate.Ok)
        {
            if (previous is null) File.Delete(path);
            else await File.WriteAllTextAsync(path, previous, CancellationToken.None);
            throw new InvalidOperationException($"Caddy refused the custom domains; the previous file is back: {validate.Output}");
        }
        var reload = await shell.RunAsync("docker", ["exec", Platform.EdgeContainer, "caddy", "reload", "--config", "/etc/caddy/Caddyfile"], null, ct);
        if (!reload.Ok) throw new ShellException(reload.Output);
        return $"{live.Count} custom domain(s)";
    }
}
