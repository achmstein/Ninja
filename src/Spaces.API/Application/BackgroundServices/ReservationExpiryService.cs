using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;
using SpacesContext = Ninja.Spaces.Infrastructure.SpacesContext;

namespace Ninja.Spaces.API.Application.BackgroundServices;

/// <summary>Lapses reservations nobody arrived for, once a minute.</summary>
public class ReservationExpiryService(
    IServiceProvider serviceProvider,
    ILogger<ReservationExpiryService> logger) : BackgroundService
{
    private static readonly ReservationStatus[] Open = [ReservationStatus.Requested, ReservationStatus.Confirmed];
    private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Reservation expiry service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ExpireLapsedAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error lapsing reservations");
            }

            await Task.Delay(_checkInterval, stoppingToken);
        }

        logger.LogInformation("Reservation expiry service stopped");
    }

    private async Task ExpireLapsedAsync(CancellationToken cancellationToken)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<SpacesContext>();

        // Staff-made reservations have no expiry and never lapse
        var now = DateTime.UtcNow;
        var lapsed = await context.Reservations
            .Where(r => Open.Contains(r.Status))
            .Where(r => r.ExpiresAt != null && r.ExpiresAt <= now)
            .ToListAsync(cancellationToken);

        if (lapsed.Count == 0)
            return;

        foreach (var reservation in lapsed)
        {
            reservation.Expire();
            logger.LogInformation("Reservation {ReservationId} at place {PlaceId} lapsed (customer {CustomerId})",
                reservation.Id, reservation.PlaceId, reservation.CustomerId);
        }

        await context.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Lapsed {Count} reservations", lapsed.Count);
    }
}
