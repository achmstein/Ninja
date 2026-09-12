using Chillax.Notification.API.Hubs;
using Chillax.Notification.API.IntegrationEvents.Events;
using Chillax.Notification.API.Localization;
using Chillax.Notification.API.Model;
using Chillax.Notification.API.Services;
using Microsoft.AspNetCore.SignalR;

namespace Chillax.Notification.API.IntegrationEvents.EventHandling;

public class ServiceRequestCreatedIntegrationEventHandler(
    NotificationContext context,
    IFcmService fcmService,
    IHubContext<NotificationHub> hubContext,
    ILogger<ServiceRequestCreatedIntegrationEventHandler> logger) :
    IIntegrationEventHandler<ServiceRequestCreatedIntegrationEvent>
{
    public async Task Handle(ServiceRequestCreatedIntegrationEvent @event)
    {
        logger.LogInformation(
            "Handling ServiceRequestCreatedIntegrationEvent: {RequestType} for room {RoomName}",
            @event.RequestType, @event.RoomName.En);

        // Broadcast via SignalR first — live dashboards must not depend on
        // whether any FCM push subscriptions exist
        await hubContext.Clients.Group("admin").SendAsync("ServiceRequestCreated", new
        {
            type = "service_request",
            requestId = @event.RequestId,
            requestType = @event.RequestType.ToString(),
            roomId = @event.RoomId,
            branchId = @event.BranchId
        });

        // Get staff subscribed to ServiceRequests for this branch
        var subscriptions = await context.Subscriptions
            .Where(s => s.Type == SubscriptionType.ServiceRequests
                && (s.BranchId == null || s.BranchId == @event.BranchId))
            .ToListAsync();

        if (subscriptions.Count == 0)
        {
            logger.LogWarning("No staff subscribed to service requests");
            return;
        }

        var totalSuccess = 0;
        var allUnregisteredTokens = new List<string>();

        // Group by language and send localized notifications
        foreach (var group in subscriptions.GroupBy(s => s.PreferredLanguage))
        {
            var lang = group.Key;
            var tokens = group.Select(s => s.FcmToken).ToList();
            var (title, body) = GetLocalizedNotificationContent(@event, lang);

            var result = await fcmService.SendBatchNotificationsAsync(
                tokens,
                title,
                body,
                new Dictionary<string, string>
                {
                    { "type", "service_request" },
                    { "requestId", @event.RequestId.ToString() },
                    { "requestType", @event.RequestType.ToString() },
                    { "roomId", @event.RoomId.ToString() },
                    { "roomName", @event.RoomName.GetText(lang) }
                });

            totalSuccess += result.SuccessCount;
            allUnregisteredTokens.AddRange(result.UnregisteredTokens);
            logger.LogInformation(
                "Sent {SuccessCount}/{TotalCount} service request notifications in {Lang} for {RequestType} in {RoomName}",
                result.SuccessCount, tokens.Count, lang, @event.RequestType, @event.RoomName.En);
        }

        if (allUnregisteredTokens.Count > 0)
        {
            var staleSubscriptions = subscriptions
                .Where(s => allUnregisteredTokens.Contains(s.FcmToken))
                .ToList();
            context.Subscriptions.RemoveRange(staleSubscriptions);
            await context.SaveChangesAsync();
            logger.LogWarning("Removed {Count} subscriptions with unregistered FCM tokens", staleSubscriptions.Count);
        }

        logger.LogInformation(
            "Sent {SuccessCount}/{TotalCount} total service request notifications for {RequestType} in {RoomName}",
            totalSuccess, subscriptions.Count, @event.RequestType, @event.RoomName.En);
    }

    private static (string title, string body) GetLocalizedNotificationContent(
        ServiceRequestCreatedIntegrationEvent @event,
        string lang)
    {
        return @event.RequestType switch
        {
            ServiceRequestType.CallWaiter => (
                NotificationMessages.WaiterNeededTitle.GetText(lang),
                NotificationMessages.WaiterNeededBody(@event.RoomName, @event.UserName).GetText(lang)),
            ServiceRequestType.ControllerChange => (
                NotificationMessages.ControllerRequestTitle.GetText(lang),
                NotificationMessages.ControllerRequestBody(@event.RoomName, @event.UserName).GetText(lang)),
            ServiceRequestType.ReceiptToPay => (
                NotificationMessages.BillRequestedTitle.GetText(lang),
                NotificationMessages.BillRequestedBody(@event.RoomName, @event.UserName).GetText(lang)),
            ServiceRequestType.SwitchToMulti => (
                NotificationMessages.SwitchToMultiTitle.GetText(lang),
                NotificationMessages.SwitchToMultiBody(@event.RoomName, @event.UserName).GetText(lang)),
            ServiceRequestType.SwitchToSingle => (
                NotificationMessages.SwitchToSingleTitle.GetText(lang),
                NotificationMessages.SwitchToSingleBody(@event.RoomName, @event.UserName).GetText(lang)),
            _ => (
                NotificationMessages.ServiceRequestTitle.GetText(lang),
                NotificationMessages.ServiceRequestBody(@event.RoomName, @event.UserName).GetText(lang))
        };
    }
}
