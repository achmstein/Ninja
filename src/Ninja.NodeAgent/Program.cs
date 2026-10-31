using System.Runtime.InteropServices;
using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.Server.Kestrel.Https;
using Microsoft.Extensions.Options;
using Ninja.Control.NodeRuntime;
using Ninja.NodeAgent;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<AgentOptions>(builder.Configuration.GetSection(AgentOptions.Section));
// The node's own settings: its tenants folder, its Postgres and broker
builder.Services.Configure<NodeSettings>(builder.Configuration.GetSection("Node"));

var agent = builder.Configuration.GetSection(AgentOptions.Section).Get<AgentOptions>() ?? new();
if (agent.RequireClientCertificate)
{
    // Only the control plane's certificate gets past the handshake; its thumbprint is pinned, so no CA is trusted
    builder.WebHost.ConfigureKestrel(kestrel => kestrel.ConfigureHttpsDefaults(https =>
    {
        https.ClientCertificateMode = ClientCertificateMode.RequireCertificate;
        https.ClientCertificateValidation = (certificate, _, _) => ControlPlaneOnly.Allows(certificate, agent.ControlPlaneThumbprints);
    }));
}

if (agent.DryRun)
{
    builder.Services.AddSingleton<RecordingShell>();
    builder.Services.AddSingleton<IShell>(sp => sp.GetRequiredService<RecordingShell>());
    builder.Services.AddSingleton<IDatabaseAdmin, DryRunDatabaseAdmin>();
    builder.Services.AddSingleton<IBrokerAdmin, DryRunBrokerAdmin>();
}
else
{
    builder.Services.AddSingleton<IShell, ProcessShell>();
    builder.Services.AddSingleton<IDatabaseAdmin, NpgsqlDatabaseAdmin>();
    builder.Services.AddSingleton<IBrokerAdmin, RabbitCtlBrokerAdmin>();
}
builder.Services.AddSingleton<IStackRuntime, LocalStackRuntime>();
builder.Services.AddSingleton<INodeData, LocalNodeData>();
builder.Services.AddSingleton<IImageInventory, LocalImageInventory>();
builder.Services.AddSingleton<IHostCapacity, ProcHostCapacity>();
builder.Services.AddSingleton(sp =>
{
    var o = sp.GetRequiredService<IOptions<AgentOptions>>().Value;
    return new ComposePolicy(o.ImagePrefixes, o.BindSources);
});

var app = builder.Build();

app.UseMiddleware<ControlPlaneOnly>();
app.MapAgentApi();

app.Run();

/// <summary>The program, for the tests' in-process agent.</summary>
public partial class Program;

/// <summary>
/// Every request carries the control plane's certificate, or it is refused:
/// the handshake already asked for it on a real node, and this holds the line
/// again behind any proxy or misconfiguration.
/// </summary>
internal sealed class ControlPlaneOnly(RequestDelegate next, IOptions<AgentOptions> options)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var o = options.Value;
        if (o.RequireClientCertificate && !Allows(context.Connection.ClientCertificate, o.ControlPlaneThumbprints))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }
        await next(context);
    }

    /// <summary>The certificate's SHA-256 thumbprint is one of the control plane's.</summary>
    public static bool Allows(X509Certificate2? certificate, IReadOnlyList<string> thumbprints)
        => certificate is not null
           && thumbprints.Contains(certificate.GetCertHashString(System.Security.Cryptography.HashAlgorithmName.SHA256), StringComparer.OrdinalIgnoreCase);

    /// <summary>The box's architecture as the registry names it.</summary>
    public static string Architecture => RuntimeInformation.OSArchitecture switch
    {
        System.Runtime.InteropServices.Architecture.Arm64 => "arm64",
        _ => "amd64",
    };
}
