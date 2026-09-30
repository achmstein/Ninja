using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Ninja.Notification.API.Localization;
using Ninja.Notification.API.Model;
using Ninja.Notification.API.Services;
using Microsoft.AspNetCore.SignalR;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

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
            "Handling ServiceRequestCreatedIntegrationEvent: {RequestType} at {PlaceName}",
            @event.RequestType, @event.PlaceName.Primary);

        // Broadcast via SignalR first — live dashboards must not depend on
        // whether any FCM push subscriptions exist
        await hubContext.Clients.Group("admin").SendAsync("ServiceRequestCreated", new
        {
            type = "service_request",
            requestId = @event.RequestId,
            requestType = @event.RequestType.ToString(),
            placeId = @event.PlaceId,
            placeKind = @event.PlaceKind,
            optionCode = @event.OptionCode,
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
                    { "placeId", @event.PlaceId.ToString() },
                    { "placeKind", @event.PlaceKind },
                    { "placeName", @event.PlaceName.Get(lang) },
                    { "optionCode", @event.OptionCode ?? string.Empty }
                });

            totalSuccess += result.SuccessCount;
            allUnregisteredTokens.AddRange(result.UnregisteredTokens);
            logger.LogInformation(
                "Sent {SuccessCount}/{TotalCount} service request notifications in {Lang} for {RequestType} at {PlaceName}",
                result.SuccessCount, tokens.Count, lang, @event.RequestType, @event.PlaceName.Primary);
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
            "Sent {SuccessCount}/{TotalCount} total service request notifications for {RequestType} at {PlaceName}",
            totalSuccess, subscriptions.Count, @event.RequestType, @event.PlaceName.Primary);
    }

    private static (string title, string body) GetLocalizedNotificationContent(
        ServiceRequestCreatedIntegrationEvent @event,
        string lang)
    {
        return @event.RequestType switch
        {
            ServiceRequestType.CallWaiter => (
                NotificationMessages.WaiterNeededTitle.Get(lang),
                NotificationMessages.WaiterNeededBody(@event.PlaceName, @event.UserName).Get(lang)),
            ServiceRequestType.ControllerChange => (
                NotificationMessages.ControllerRequestTitle.Get(lang),
                NotificationMessages.ControllerRequestBody(@event.PlaceName, @event.UserName).Get(lang)),
            ServiceRequestType.ReceiptToPay => (
                NotificationMessages.BillRequestedTitle.Get(lang),
                NotificationMessages.BillRequestedBody(@event.PlaceName, @event.UserName).Get(lang)),
            // The two-option room words when they fit; the option's code otherwise
            ServiceRequestType.ChangeOption when @event.OptionCode == "multi" => (
                NotificationMessages.SwitchToMultiTitle.Get(lang),
                NotificationMessages.SwitchToMultiBody(@event.PlaceName, @event.UserName).Get(lang)),
            ServiceRequestType.ChangeOption when @event.OptionCode == "single" => (
                NotificationMessages.SwitchToSingleTitle.Get(lang),
                NotificationMessages.SwitchToSingleBody(@event.PlaceName, @event.UserName).Get(lang)),
            ServiceRequestType.ChangeOption => (
                NotificationMessages.ChangeOptionTitle.Get(lang),
                NotificationMessages.ChangeOptionBody(@event.PlaceName, @event.UserName, @event.OptionCode ?? "?").Get(lang)),
            _ => (
                NotificationMessages.ServiceRequestTitle.Get(lang),
                NotificationMessages.ServiceRequestBody(@event.PlaceName, @event.UserName).Get(lang))
        };
    }
}
