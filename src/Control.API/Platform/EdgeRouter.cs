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

/// <summary>
/// The Caddy beside the control plane, reached with docker exec. Two files it
/// imports are the record's: the businesses' own domains, and the tenants on
/// another node with that node's ingress. Written together, checked by Caddy
/// together, put back together when it refuses them, reloaded once.
/// </summary>
public sealed class CaddyEdgeRouter(ControlContext context, IShell shell, IOptions<PlatformOptions> options) : IEdgeRouter
{
    private PlatformOptions Platform => options.Value;

    public async Task<string> ApplyAsync(CancellationToken ct)
    {
        var live = await context.Tenants.AsNoTracking().Where(t => t.Status != TenantStatus.Destroyed && t.Status != TenantStatus.Destroying).ToListAsync(ct);
        var withDomain = live.Where(t => t.CustomerDomain != null).ToList();
        var ingress = await context.Nodes.AsNoTracking().Where(n => n.IngressUrl != null).ToDictionaryAsync(n => n.Id, n => n.IngressUrl, ct);
        var placed = live.Select(t => (t.Slug, IngressUrl: ingress.GetValueOrDefault(t.NodeId))).ToList();

        var files = new[]
        {
            (Path: Platform.EdgeSnippetPath, Text: Templates.CustomDomains(withDomain, Platform)),
            (Path: Platform.EdgeRoutesPath, Text: Templates.TenantRoutes(placed)),
        };
        var said = $"{withDomain.Count} custom domain(s), {placed.Count(p => p.IngressUrl is not null)} tenant(s) on other nodes";
        var previous = new List<(string Path, string? Text)>();
        foreach (var file in files)
            previous.Add((file.Path, File.Exists(file.Path) ? await File.ReadAllTextAsync(file.Path, ct) : null));
        if (files.Zip(previous).All(p => p.First.Text == p.Second.Text))
            return "unchanged";
        if (Platform.DryRun && !Directory.Exists(Path.GetDirectoryName(Platform.EdgeSnippetPath)!))
            return $"(dry run) {said}";

        // Each file is what Caddy reads on its next start too, so files it cannot parse must never stay on disk:
        // written, checked by Caddy itself, and put back the way they were when the check fails
        foreach (var file in files)
            await File.WriteAllTextAsync(file.Path, file.Text, ct);
        var validate = await shell.RunAsync("docker", ["exec", Platform.EdgeContainer, "caddy", "validate", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"], null, CancellationToken.None);
        if (!validate.Ok)
        {
            foreach (var (path, text) in previous)
            {
                if (text is null) File.Delete(path);
                else await File.WriteAllTextAsync(path, text, CancellationToken.None);
            }
            throw new InvalidOperationException($"Caddy refused the edge files; the previous ones are back: {validate.Output}");
        }
        var reload = await shell.RunAsync("docker", ["exec", Platform.EdgeContainer, "caddy", "reload", "--config", "/etc/caddy/Caddyfile"], null, ct);
        if (!reload.Ok) throw new ShellException(reload.Output);
        return said;
    }
}
