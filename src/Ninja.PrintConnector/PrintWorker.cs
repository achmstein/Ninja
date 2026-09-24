namespace Ninja.PrintConnector;

/// <summary>
/// The service's life: every few seconds, take what is waiting for this
/// connector's printers, print it, say how it went; every minute, tell the
/// café which printers Windows has. A claim held by a till or a tablet is
/// left to it — the server decides who prints, so nothing prints twice.
/// </summary>
public sealed class PrintWorker(ConnectorConfig config, ILogger<PrintWorker> logger) : BackgroundService
{
    private static readonly TimeSpan Poll = TimeSpan.FromSeconds(3);
    private static readonly TimeSpan Heartbeat = TimeSpan.FromMinutes(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var queue = QueueClient.For(config);
        var labels = TicketRenderer.Labels.For(config.Language);
        var lastHeartbeat = DateTime.MinValue;

        logger.LogInformation("Printing for {Server} as connector {Id}", config.Server, config.ConnectorId);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (DateTime.UtcNow - lastHeartbeat > Heartbeat)
                {
                    await queue.HeartbeatAsync(Printers.Installed(), stoppingToken);
                    lastHeartbeat = DateTime.UtcNow;
                }

                foreach (var ticket in await queue.JobsAsync(stoppingToken))
                {
                    if (ticket.ClaimedAt is { } claimed && DateTime.UtcNow - claimed.ToUniversalTime() < TimeSpan.FromSeconds(60))
                        continue;
                    if (!await queue.ClaimAsync(ticket.JobId, stoppingToken))
                        continue;

                    try
                    {
                        using var image = TicketRenderer.Render(ticket, config.Language, labels);
                        var bytes = EscPos.Job(image);
                        if (ticket.PrinterName is { } name)
                            Printers.SendToWindowsPrinter(name, bytes);
                        else if (ticket.PrinterHost is { } host)
                            await Printers.SendToNetworkPrinterAsync(host, ticket.PrinterPort, bytes, stoppingToken);
                        else
                            throw new InvalidOperationException("The station has no printer set");

                        await queue.PrintedAsync(ticket.JobId, stoppingToken);
                        logger.LogInformation("Printed ticket {Job} for station {Station}", ticket.JobId, ticket.StationName.En);
                    }
                    catch (Exception e) when (e is not OperationCanceledException)
                    {
                        logger.LogWarning(e, "Ticket {Job} did not print", ticket.JobId);
                        await queue.FailedAsync(ticket.JobId, e.Message, stoppingToken);
                    }
                }
            }
            catch (UnauthorizedAccessException e)
            {
                // Unpaired in admin: nothing to do until someone pairs it again
                logger.LogError("{Message}", e.Message);
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                // The café's Wi-Fi dropped, or the API is restarting: try again shortly
                logger.LogWarning("Queue unreachable: {Message}", e.Message);
            }

            await Task.Delay(Poll, stoppingToken);
        }
    }
}
