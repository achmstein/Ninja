using Chillax.Spaces.Domain.AggregatesModel.StayAggregate;
using Microsoft.EntityFrameworkCore;
using SpacesContext = Chillax.Spaces.Infrastructure.SpacesContext;

namespace Chillax.Spaces.API.Application.BackgroundServices;

/// <summary>Cancels holds nobody arrived for, once a minute.</summary>
public class HoldExpirationService(
    IServiceProvider serviceProvider,
    ILogger<HoldExpirationService> logger) : BackgroundService
{
    private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Hold expiration service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CancelLapsedHoldsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error cancelling lapsed holds");
            }

            await Task.Delay(_checkInterval, stoppingToken);
        }

        logger.LogInformation("Hold expiration service stopped");
    }

    private async Task CancelLapsedHoldsAsync(CancellationToken cancellationToken)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<SpacesContext>();

        // Staff-made holds have no expiry and never lapse
        var lapsed = await context.Stays
            .Where(s => s.Status == StayStatus.Held)
            .Where(s => s.ExpiresAt != null && s.ExpiresAt <= DateTime.UtcNow)
            .ToListAsync(cancellationToken);

        if (lapsed.Count == 0)
            return;

        foreach (var stay in lapsed)
        {
            stay.CancelDueToExpiration();
            logger.LogInformation("Hold {StayId} at place {PlaceId} lapsed (customer {CustomerId})", stay.Id, stay.PlaceId, stay.CustomerId);
        }

        await context.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Cancelled {Count} lapsed holds", lapsed.Count);
    }
}
