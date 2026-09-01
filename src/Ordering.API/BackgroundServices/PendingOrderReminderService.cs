namespace Chillax.Ordering.API.BackgroundServices;

/// <summary>
/// Background service that periodically checks for pending (Submitted) orders
/// that haven't been confirmed by admins and sends escalating reminder notifications.
///
/// Escalation timeline:
///   - 1 min pending → 1st reminder
///   - 2 min pending → 2nd reminder
///   - 4 min pending → 3rd reminder (full-screen intent)
///   - 7 min pending → 4th reminder
///   - 10 min pending → 5th (final) reminder
/// </summary>
public class PendingOrderReminderService(
    IServiceScopeFactory scopeFactory,
    IEventBus eventBus,
    ILogger<PendingOrderReminderService> logger) : BackgroundService
{
    private static readonly TimeSpan CheckInterval = TimeSpan.FromSeconds(30);
    private const int MaxReminders = 5;

    // Minutes after order submission when each reminder should fire
    private static readonly int[] ReminderThresholdsMinutes = [1, 2, 4, 7, 10];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("PendingOrderReminderService started");

        // Wait a bit before first check to let the app fully start
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckAndSendRemindersAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Error checking pending order reminders");
            }

            await Task.Delay(CheckInterval, stoppingToken);
        }
    }

    private async Task CheckAndSendRemindersAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<OrderingContext>();

        var now = DateTime.UtcNow;

        // Get all submitted orders that are old enough for at least the first reminder
        // and haven't exceeded max reminders
        var pendingOrders = await context.Orders
            .Include(o => o.Buyer)
            .Where(o => o.OrderStatus == OrderStatus.Submitted
                && o.ReminderCount < MaxReminders
                && o.OrderDate <= now.AddMinutes(-ReminderThresholdsMinutes[0]))
            .ToListAsync(ct);

        if (pendingOrders.Count == 0)
            return;

        logger.LogInformation("Found {Count} pending orders to check for reminders", pendingOrders.Count);

        foreach (var order in pendingOrders)
        {
            var minutesPending = (int)(now - order.OrderDate).TotalMinutes;
            var nextReminderIndex = order.ReminderCount;

            // Check if enough time has passed for the next reminder
            if (nextReminderIndex >= ReminderThresholdsMinutes.Length)
                continue;

            var requiredMinutes = ReminderThresholdsMinutes[nextReminderIndex];
            if (minutesPending < requiredMinutes)
                continue;

            // Also ensure at least 1 minute since last reminder to avoid rapid-fire
            if (order.LastReminderSentAt.HasValue
                && (now - order.LastReminderSentAt.Value).TotalMinutes < 1)
                continue;

            var buyerName = order.Buyer?.Name ?? order.GuestName ?? "Customer";

            logger.LogInformation(
                "Sending reminder #{ReminderCount} for order {OrderId} (pending {Minutes} min)",
                nextReminderIndex + 1, order.Id, minutesPending);

            // Update the order's reminder tracking
            order.RecordReminderSent();

            // Publish reminder event to Notification service
            var reminderEvent = new OrderReminderIntegrationEvent(
                order.Id, buyerName, order.BranchId,
                order.ReminderCount, minutesPending);

            await eventBus.PublishAsync(reminderEvent);
        }

        // Save all reminder count updates
        await context.SaveChangesAsync(ct);
    }
}
