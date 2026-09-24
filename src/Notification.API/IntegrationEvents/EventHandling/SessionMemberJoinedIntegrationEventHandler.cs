using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Ninja.Notification.API.Localization;
using Ninja.Notification.API.Model;
using Ninja.Notification.API.Services;
using Microsoft.AspNetCore.SignalR;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

public class SessionMemberJoinedIntegrationEventHandler(
    NotificationContext context,
    IFcmService fcmService,
    IHubContext<NotificationHub> hubContext,
    ILogger<SessionMemberJoinedIntegrationEventHandler> logger) : IIntegrationEventHandler<SessionMemberJoinedIntegrationEvent>
{
    public async Task Handle(SessionMemberJoinedIntegrationEvent @event)
    {
        logger.LogInformation("Handling SessionMemberJoinedIntegrationEvent: ReservationId={ReservationId}, MemberId={MemberId}",
            @event.ReservationId, @event.MemberUserId);

        // The member's open app (the web has no push) refetches its sessions
        await hubContext.Clients.Group($"user:{@event.MemberUserId}").SendAsync("RoomStatusChanged", new
        {
            type = "member_joined",
            placeId = @event.PlaceId,
            placeKind = @event.PlaceKind,
            reservationId = @event.ReservationId
        });


        // Get session notification subscription for the joining member
        var subscriptions = await context.Subscriptions
            .Where(s => s.UserId == @event.MemberUserId
                && s.Type == SubscriptionType.UserSessionNotification)
            .ToListAsync();

        if (subscriptions.Count == 0)
        {
            logger.LogInformation("No session notification subscription found for member {MemberId}", @event.MemberUserId);
            return;
        }

        var startTimeMs = @event.ActualStartTime?.ToUniversalTime()
            .Subtract(DateTime.UnixEpoch).TotalMilliseconds.ToString("0") ?? "";

        var allUnregisteredTokens = new List<string>();

        foreach (var group in subscriptions.GroupBy(s => s.PreferredLanguage))
        {
            var lang = group.Key;
            var tokens = group.Select(s => s.FcmToken).ToList();
            var data = new Dictionary<string, string>
            {
                { "type", "session_started" },
                { "sessionId", @event.ReservationId.ToString() },
                { "placeId", @event.PlaceId.ToString() },
                { "placeKind", @event.PlaceKind },
                { "placeName", @event.PlaceName.GetText(lang) },
                { "placeNameEn", @event.PlaceName.GetText("en") },
                { "placeNameAr", @event.PlaceName.GetText("ar") },
                { "startTimeMs", startTimeMs },
                { "locale", lang },
                { "optionCode", @event.OptionCode ?? string.Empty }
            };

            var result = await fcmService.SendBatchDataMessagesAsync(tokens, data);
            allUnregisteredTokens.AddRange(result.UnregisteredTokens);
            logger.LogInformation("Sent {SuccessCount}/{TotalCount} session started FCM to joining member {MemberId} in {Lang}",
                result.SuccessCount, tokens.Count, @event.MemberUserId, lang);
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
    }
}
