using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Microsoft.EntityFrameworkCore;
using SpacesContext = Chillax.Spaces.Infrastructure.SpacesContext;

namespace Chillax.Spaces.API.Application.BackgroundServices;

/// <summary>
/// Background service that automatically cancels expired reservations (no-shows)
/// </summary>
public class ReservationExpirationService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ReservationExpirationService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(1);

    public ReservationExpirationService(
        IServiceProvider serviceProvider,
        ILogger<ReservationExpirationService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Reservation expiration service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CancelExpiredReservationsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cancelling expired reservations");
            }

            await Task.Delay(_checkInterval, stoppingToken);
        }

        _logger.LogInformation("Reservation expiration service stopped");
    }

    private async Task CancelExpiredReservationsAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<SpacesContext>();

        // Find all reserved (not started) reservations that have exceeded their expiration time.
        // Admin-created reservations have ExpiresAt = null and never expire.
        var expiredReservations = await context.Reservations
            .Where(r => r.Status == ReservationStatus.Reserved)
            .Where(r => r.ExpiresAt != null && r.ExpiresAt <= DateTime.UtcNow)
            .ToListAsync(cancellationToken);

        if (expiredReservations.Count == 0)
            return;

        foreach (var reservation in expiredReservations)
        {
            reservation.CancelDueToExpiration();
            _logger.LogInformation(
                "Auto-cancelled expired reservation {ReservationId} for room {RoomId} (customer: {CustomerId})",
                reservation.Id, reservation.RoomId, reservation.CustomerId);
        }

        await context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Cancelled {Count} expired reservations", expiredReservations.Count);
    }
}
