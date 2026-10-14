using System.Drawing;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;

namespace Ninja.PrintConnector;

/// <summary>Where print bytes go, behind a seam so the local API is testable without a printer.</summary>
public interface IPrinterSink
{
    IReadOnlyList<string> Installed();

    void SendToWindows(string printerName, byte[] bytes);

    Task SendToNetworkAsync(string host, int port, byte[] bytes, CancellationToken ct);
}

/// <summary>This PC's real printers.</summary>
public sealed class WindowsPrinterSink : IPrinterSink
{
    public IReadOnlyList<string> Installed() => Printers.Installed();

    public void SendToWindows(string printerName, byte[] bytes) => Printers.SendToWindowsPrinter(printerName, bytes);

    public Task SendToNetworkAsync(string host, int port, byte[] bytes, CancellationToken ct) =>
        Printers.SendToNetworkPrinterAsync(host, port, bytes, ct);
}

public sealed record PrinterTarget(string? Name, string? Host, int? Port);

public sealed record PrintRequest(PrinterTarget? Printer, string? Image, bool KickDrawer);

public sealed record DrawerRequest(PrinterTarget? Printer);

public sealed record StatusReply(string Name, string Version, IReadOnlyList<string> Printers);

public sealed record OkReply(bool Ok);

public sealed record ErrorReply(string Error);

/// <summary>
/// The web till's way to this PC's printers, on the PC itself: a browser
/// cannot open a printer's raw port, but it can call this. The till draws a
/// receipt or a kitchen chit to a picture exactly as it shows it, and the
/// connector turns the picture into ESC/POS — the same dots its own kitchen
/// tickets are — then sends it to a printer Windows knows, or to one on the
/// network. With the internet down this still works: nothing here asks the
/// cloud. Only the paired business's till may call it (LocalAccess), and
/// only from this PC: it listens on the loopback address alone.
/// </summary>
public static class LocalApi
{
    public const int Port = 17777;

    // A long receipt drawn at 203 dpi is well under this as a PNG
    private const long MaxBody = 4 * 1024 * 1024;

    private static readonly string Version =
        (typeof(LocalApi).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "0")
            .Split('+')[0];

    /// <summary>
    /// The app, not yet started. <paramref name="host"/> picks where it
    /// listens (Kestrel on loopback for the service, a test server in tests)
    /// and how it logs.
    /// </summary>
    public static WebApplication Build(string server, IPrinterSink sink, Action<WebApplicationBuilder>? host = null)
    {
        var builder = WebApplication.CreateSlimBuilder(new WebApplicationOptions
        {
            Args = [],
            ContentRootPath = AppContext.BaseDirectory,
        });
        builder.Logging.ClearProviders();
        builder.WebHost.ConfigureKestrel(k => k.Limits.MaxRequestBodySize = MaxBody);
        builder.Services.AddSingleton(sink);
        host?.Invoke(builder);

        var app = builder.Build();
        var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Ninja.PrintConnector.LocalApi");

        app.Use(async (context, next) =>
        {
            var origin = context.Request.Headers.Origin.ToString();
            if (!LocalAccess.Allows(origin, server))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new ErrorReply("This connector prints only for its own business's till."));
                return;
            }

            context.Response.Headers.AccessControlAllowOrigin = origin;
            context.Response.Headers.Vary = "Origin";

            // The browser's preflight: a site on the internet calling this PC
            // asks first, and is told yes only for the paired till
            if (HttpMethods.IsOptions(context.Request.Method))
            {
                context.Response.Headers.AccessControlAllowMethods = "GET, POST";
                context.Response.Headers.AccessControlAllowHeaders = "Content-Type";
                context.Response.Headers["Access-Control-Allow-Private-Network"] = "true";
                context.Response.Headers.AccessControlMaxAge = "600";
                context.Response.StatusCode = StatusCodes.Status204NoContent;
                return;
            }

            // JSON only: a plain form post from some page skips the preflight, this doesn't
            if (HttpMethods.IsPost(context.Request.Method) && !context.Request.HasJsonContentType())
            {
                context.Response.StatusCode = StatusCodes.Status415UnsupportedMediaType;
                await context.Response.WriteAsJsonAsync(new ErrorReply("Send JSON."));
                return;
            }

            await next();
        });

        app.MapGet("/v1/status", (IPrinterSink printers) =>
            Results.Ok(new StatusReply(Environment.MachineName, Version, printers.Installed())));

        app.MapPost("/v1/print", async (HttpContext http, IPrinterSink printers) =>
        {
            var (request, refused) = await ReadAsync<PrintRequest>(http);
            if (refused is not null)
                return refused;
            if (TargetOf(request!.Printer, out var target) is { } badTarget)
                return badTarget;
            if (string.IsNullOrWhiteSpace(request.Image))
                return Bad("No image to print.");

            byte[] png;
            try
            {
                png = Convert.FromBase64String(request.Image);
            }
            catch (FormatException)
            {
                return Bad("The image is not base64.");
            }

            byte[] job;
            try
            {
                using var stream = new MemoryStream(png);
                using var decoded = new Bitmap(stream);
                using var fitted = EscPos.FitToPaper(decoded);
                job = EscPos.Job(fitted, request.KickDrawer);
            }
            catch (Exception e) when (e is ArgumentException or ExternalException)
            {
                return Bad("The image is not a picture this PC can read.");
            }

            return await SendAsync(printers, target!, job, logger, http.RequestAborted);
        });

        app.MapPost("/v1/drawer", async (HttpContext http, IPrinterSink printers) =>
        {
            var (request, refused) = await ReadAsync<DrawerRequest>(http);
            if (refused is not null)
                return refused;
            if (TargetOf(request!.Printer, out var target) is { } badTarget)
                return badTarget;

            return await SendAsync(printers, target!, EscPos.Kick(), logger, http.RequestAborted);
        });

        return app;
    }

    private static async Task<(T? Request, IResult? Refused)> ReadAsync<T>(HttpContext http) where T : class
    {
        try
        {
            var request = await http.Request.ReadFromJsonAsync<T>(http.RequestAborted);
            return request is null ? (null, Bad("Empty request.")) : (request, null);
        }
        catch (JsonException)
        {
            return (null, Bad("The request is not valid JSON."));
        }
        catch (BadHttpRequestException e)
        {
            return (null, Results.Json(new ErrorReply(e.Message), statusCode: e.StatusCode));
        }
    }

    /// <summary>A printer Windows knows by name wins; else one on the network, on 9100 unless told.</summary>
    private static IResult? TargetOf(PrinterTarget? printer, out PrinterTarget? target)
    {
        target = null;
        if (!string.IsNullOrWhiteSpace(printer?.Name))
        {
            target = new PrinterTarget(printer.Name.Trim(), null, null);
            return null;
        }
        if (!string.IsNullOrWhiteSpace(printer?.Host))
        {
            var port = printer.Port ?? 9100;
            if (port is < 1 or > 65535)
                return Bad("The printer's port is out of range.");
            target = new PrinterTarget(null, printer.Host.Trim(), port);
            return null;
        }
        return Bad("Say which printer: its Windows name, or its network address.");
    }

    private static async Task<IResult> SendAsync(IPrinterSink printers, PrinterTarget target, byte[] bytes, ILogger logger, CancellationToken ct)
    {
        try
        {
            if (target.Name is { } name)
                printers.SendToWindows(name, bytes);
            else
                await printers.SendToNetworkAsync(target.Host!, target.Port!.Value, bytes, ct);
            return Results.Ok(new OkReply(true));
        }
        catch (Exception e) when (!ct.IsCancellationRequested)
        {
            // The till shows the reason and falls back to the browser's print
            // (a network printer that timed out is a cancellation, and a failure)
            logger.LogWarning(e, "The till's print to {Printer} failed", target.Name ?? $"{target.Host}:{target.Port}");
            return Results.Json(new ErrorReply(e.Message), statusCode: StatusCodes.Status502BadGateway);
        }
    }

    private static IResult Bad(string error) => Results.BadRequest(new ErrorReply(error));
}

/// <summary>
/// Runs the local API inside the service, beside the kitchen's queue. Kept
/// apart so a port some other program holds costs only the till's printing:
/// the kitchen tickets go on, and the port is tried again every minute.
/// </summary>
public sealed class LocalApiService(ConnectorConfig config, ILogger<LocalApiService> logger) : BackgroundService
{
    private static readonly TimeSpan Retry = TimeSpan.FromMinutes(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            WebApplication? app = null;
            try
            {
                app = LocalApi.Build(config.Server, new WindowsPrinterSink(), builder =>
                {
                    builder.WebHost.ConfigureKestrel(k => k.Listen(IPAddress.Loopback, LocalApi.Port));
                    builder.Logging.AddEventLog(o => o.SourceName = "NinjaPrintConnector");
                });
                await app.StartAsync(stoppingToken);
                logger.LogInformation("The till can print through http://127.0.0.1:{Port}", LocalApi.Port);
                await Task.Delay(Timeout.Infinite, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception e)
            {
                logger.LogError(e, "The till's printing could not start on port {Port}; trying again in a minute", LocalApi.Port);
                await Task.Delay(Retry, stoppingToken).ContinueWith(_ => { }, TaskScheduler.Default);
            }
            finally
            {
                if (app is not null)
                {
                    try
                    {
                        await app.StopAsync(CancellationToken.None);
                    }
                    catch (Exception e)
                    {
                        logger.LogDebug(e, "Stopping the till's printing");
                    }
                    await app.DisposeAsync();
                }
            }
        }
    }
}
