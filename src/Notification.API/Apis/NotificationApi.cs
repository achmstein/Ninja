using System.ComponentModel;
using System.Security.Claims;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Ninja.Notification.API.Model;
using Ninja.Notification.API.Services;
using Ninja.ServiceDefaults;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.SignalR;
using static Ninja.ServiceDefaults.BranchHeaderExtensions;

using Ninja.Notification.API.Extensions;

namespace Ninja.Notification.API.Apis;

public static class NotificationApi
{
    public static IEndpointRouteBuilder MapNotificationApi(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("api/notifications").RequireAuthorization();

        // Subscription endpoints
        api.MapPost("/subscriptions/room-availability", SubscribeToRoomAvailability)
            .WithName("SubscribeToRoomAvailability")
            .WithSummary("Subscribe to room availability notifications")
            .WithDescription("Register to receive a one-time FCM notification when any room becomes available")
            .WithTags("Subscriptions");

        api.MapDelete("/subscriptions/room-availability", UnsubscribeFromRoomAvailability)
            .WithName("UnsubscribeFromRoomAvailability")
            .WithSummary("Unsubscribe from room availability notifications")
            .WithDescription("Remove your room availability notification subscription")
            .WithTags("Subscriptions");

        api.MapGet("/subscriptions/room-availability", GetRoomAvailabilitySubscription)
            .WithName("GetRoomAvailabilitySubscription")
            .WithSummary("Check subscription status")
            .WithDescription("Check if you are subscribed to room availability notifications")
            .WithTags("Subscriptions");

        // Admin order notification endpoints
        api.MapPost("/subscriptions/admin-orders", SubscribeToAdminOrderNotifications)
            .WithName("SubscribeToAdminOrderNotifications")
            .WithSummary("Subscribe to admin order notifications")
            .WithDescription("Register admin device to receive FCM notifications when new orders are placed (Admin only)")
            .WithTags("Admin Subscriptions")
            .RequireAuthorization("Admin");

        api.MapDelete("/subscriptions/admin-orders", UnsubscribeFromAdminOrderNotifications)
            .WithName("UnsubscribeFromAdminOrderNotifications")
            .WithSummary("Unsubscribe from admin order notifications")
            .WithDescription("Unregister admin device from order notifications (Admin only)")
            .WithTags("Admin Subscriptions")
            .RequireAuthorization("Admin");

        // Admin reservation notification endpoints
        api.MapPost("/subscriptions/admin-reservations", SubscribeToAdminReservationNotifications)
            .WithName("SubscribeToAdminReservationNotifications")
            .WithSummary("Subscribe to admin reservation notifications")
            .WithDescription("Register admin device to receive FCM notifications when rooms are reserved (Admin only)")
            .WithTags("Admin Subscriptions")
            .RequireAuthorization("Admin");

        api.MapDelete("/subscriptions/admin-reservations", UnsubscribeFromAdminReservationNotifications)
            .WithName("UnsubscribeFromAdminReservationNotifications")
            .WithSummary("Unsubscribe from admin reservation notifications")
            .WithDescription("Unregister admin device from reservation notifications (Admin only)")
            .WithTags("Admin Subscriptions")
            .RequireAuthorization("Admin");

        // User order notification endpoints (for customers)
        api.MapPost("/subscriptions/user-orders", SubscribeToUserOrderNotifications)
            .WithName("SubscribeToUserOrderNotifications")
            .WithSummary("Subscribe to user order notifications")
            .WithDescription("Register device to receive FCM notifications when your order status changes")
            .WithTags("Subscriptions");

        api.MapDelete("/subscriptions/user-orders", UnsubscribeFromUserOrderNotifications)
            .WithName("UnsubscribeFromUserOrderNotifications")
            .WithSummary("Unsubscribe from user order notifications")
            .WithDescription("Unregister device from order status notifications")
            .WithTags("Subscriptions");

        // User session notification endpoints (for customers)
        api.MapPost("/subscriptions/user-sessions", SubscribeToUserSessionNotifications)
            .WithName("SubscribeToUserSessionNotifications")
            .WithSummary("Subscribe to user session notifications")
            .WithDescription("Register device to receive FCM notifications when your session starts or ends")
            .WithTags("Subscriptions");

        api.MapDelete("/subscriptions/user-sessions", UnsubscribeFromUserSessionNotifications)
            .WithName("UnsubscribeFromUserSessionNotifications")
            .WithSummary("Unsubscribe from user session notifications")
            .WithDescription("Unregister device from session notifications")
            .WithTags("Subscriptions");

        // Service request subscription (for staff/admin)
        api.MapPost("/subscriptions/service-requests", SubscribeToServiceRequests)
            .WithName("SubscribeToServiceRequests")
            .WithSummary("Subscribe to service request notifications")
            .WithDescription("Register staff device to receive FCM notifications when users request help (Admin only)")
            .WithTags("Admin Subscriptions")
            .RequireAuthorization("Admin");

        api.MapDelete("/subscriptions/service-requests", UnsubscribeFromServiceRequests)
            .WithName("UnsubscribeFromServiceRequests")
            .WithSummary("Unsubscribe from service request notifications")
            .WithDescription("Unregister staff device from service request notifications (Admin only)")
            .WithTags("Admin Subscriptions")
            .RequireAuthorization("Admin");

        // Service request endpoints (for users)
        // A guest at a table has no account: the endpoint takes the guest
        // id header instead, the way Ordering does for guest orders
        api.MapPost("/service-requests", CreateServiceRequest)
            .AllowAnonymous()
            .RequireRateLimiting(ServiceRequestRateLimiting.GuestCreatePolicy)
            .WithName("CreateServiceRequest")
            .WithSummary("Create a service request")
            .WithDescription("Request waiter, controller change, or receipt")
            .WithTags("Service Requests");

        // The customer's side of the loop: what they asked for that is still
        // open, and taking a request back before anyone has moved on it
        api.MapGet("/service-requests/mine", GetMyServiceRequests)
            .AllowAnonymous()
            .WithName("GetMyServiceRequests")
            .WithSummary("Get my open service requests")
            .WithDescription("The caller's pending and acknowledged requests: open until the till finishes them or the caller cancels")
            .WithTags("Service Requests");

        api.MapDelete("/service-requests/{id}", CancelServiceRequest)
            .AllowAnonymous()
            .WithName("CancelServiceRequest")
            .WithSummary("Cancel my service request")
            .WithDescription("Withdraw a request of mine that nobody has acknowledged yet")
            .WithTags("Service Requests");

        // Service request management (for staff/admin)
        api.MapGet("/service-requests/pending", GetPendingServiceRequests)
            .WithName("GetPendingServiceRequests")
            .WithSummary("Get pending service requests")
            .WithDescription("Get all pending service requests for the branch (staff)")
            .WithTags("Service Requests")
            .RequireAuthorization("Pos");

        api.MapPut("/service-requests/{id}/acknowledge", AcknowledgeServiceRequest)
            .WithName("AcknowledgeServiceRequest")
            .WithSummary("Acknowledge a service request")
            .WithDescription("Mark request as acknowledged by staff")
            .WithTags("Service Requests")
            .RequireAuthorization("Pos");

        api.MapPut("/service-requests/{id}/complete", CompleteServiceRequest)
            .WithName("CompleteServiceRequest")
            .WithSummary("Complete a service request")
            .WithDescription("Mark request as completed")
            .WithTags("Service Requests")
            .RequireAuthorization("Pos");

        // Notification preferences endpoints
        api.MapGet("/preferences", GetNotificationPreferences)
            .WithName("GetNotificationPreferences")
            .WithSummary("Get notification preferences")
            .WithDescription("Get the current user's notification preferences")
            .WithTags("Preferences");

        api.MapPut("/preferences", UpdateNotificationPreferences)
            .WithName("UpdateNotificationPreferences")
            .WithSummary("Update notification preferences")
            .WithDescription("Update the current user's notification preferences")
            .WithTags("Preferences");

        // Announcement endpoints (staff broadcast to customers)
        api.MapPost("/announcements", SendAnnouncement)
            .WithName("SendAnnouncement")
            .WithSummary("Send an announcement")
            .WithDescription("Push an announcement to every opted-in customer device (Admin/Owner only)")
            .WithTags("Announcements")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Owner"));

        api.MapGet("/announcements", GetAnnouncements)
            .WithName("GetAnnouncements")
            .WithSummary("List sent announcements")
            .WithDescription("Recent announcements, newest first (Admin/Owner only)")
            .WithTags("Announcements")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Owner"));

        return app;
    }

    public static async Task<Results<Ok<AnnouncementResponse>, BadRequest<string>>> SendAnnouncement(
        NotificationContext context,
        ClaimsPrincipal user,
        IFcmService fcmService,
        SendAnnouncementRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Body))
        {
            return TypedResults.BadRequest("Title and body are required");
        }

        // Customer devices only, excluding users who opted out of promotions
        var optedOutUsers = await context.Preferences
            .Where(p => !p.PromotionsAndOffers)
            .Select(p => p.UserId)
            .ToListAsync();

        var customerTypes = new[]
        {
            SubscriptionType.RoomAvailability,
            SubscriptionType.UserOrderNotification,
            SubscriptionType.UserSessionNotification,
        };

        var tokens = await context.Subscriptions
            .Where(s => customerTypes.Contains(s.Type))
            .Where(s => !optedOutUsers.Contains(s.UserId))
            .Select(s => s.FcmToken)
            .Distinct()
            .ToListAsync();

        var result = await fcmService.SendBatchNotificationsAsync(
            tokens,
            request.Title.Trim(),
            request.Body.Trim(),
            new Dictionary<string, string> { ["type"] = "announcement" });

        // Prune tokens FCM reports as unregistered (mirrors the event handlers)
        if (result.UnregisteredTokens.Count > 0)
        {
            var stale = await context.Subscriptions
                .Where(s => result.UnregisteredTokens.Contains(s.FcmToken))
                .ToListAsync();
            context.Subscriptions.RemoveRange(stale);
        }

        var announcement = new Announcement
        {
            Title = request.Title.Trim(),
            Body = request.Body.Trim(),
            SentBy = user.FindFirst("name")?.Value
                ?? user.FindFirst("preferred_username")?.Value
                ?? user.GetUserId()
                ?? "staff",
            RecipientCount = result.SuccessCount,
        };
        context.Announcements.Add(announcement);
        await context.SaveChangesAsync();

        return TypedResults.Ok(new AnnouncementResponse(
            announcement.Id,
            announcement.Title,
            announcement.Body,
            announcement.SentBy,
            announcement.SentAt,
            announcement.RecipientCount));
    }

    public static async Task<Ok<List<AnnouncementResponse>>> GetAnnouncements(
        NotificationContext context,
        [Description("Maximum number of announcements to return")] int limit = 50)
    {
        var announcements = await context.Announcements
            .AsNoTracking()
            .OrderByDescending(a => a.SentAt)
            .Take(limit)
            .Select(a => new AnnouncementResponse(
                a.Id, a.Title, a.Body, a.SentBy, a.SentAt, a.RecipientCount))
            .ToListAsync();

        return TypedResults.Ok(announcements);
    }

    public static async Task<Results<Created<SubscriptionResponse>, Conflict<string>>> SubscribeToRoomAvailability(
        NotificationContext context,
        ClaimsPrincipal user,
        SubscribeRequest request)
    {
        var userId = user.GetUserId()!;

        // Check if already subscribed
        var existing = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Type == SubscriptionType.RoomAvailability);

        if (existing != null)
        {
            // Always update token, language, branch, and timestamp
            existing.FcmToken = request.FcmToken;
            existing.PreferredLanguage = request.PreferredLanguage ?? "en";
            existing.BranchId = request.BranchId;
            existing.UpdatedAt = DateTime.UtcNow;
            await context.SaveChangesAsync();
            return TypedResults.Conflict("Already subscribed to room availability notifications");
        }

        var subscription = new NotificationSubscription
        {
            UserId = userId,
            FcmToken = request.FcmToken,
            Type = SubscriptionType.RoomAvailability,
            BranchId = request.BranchId,
            PreferredLanguage = request.PreferredLanguage ?? "en",
            CreatedAt = DateTime.UtcNow
        };

        context.Subscriptions.Add(subscription);
        await context.SaveChangesAsync();

        return TypedResults.Created(
            $"/api/notifications/subscriptions/room-availability",
            new SubscriptionResponse(subscription.Id, subscription.Type, subscription.CreatedAt));
    }

    public static async Task<NoContent> UnsubscribeFromRoomAvailability(
        NotificationContext context,
        ClaimsPrincipal user)
    {
        var userId = user.GetUserId()!;

        var subscription = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Type == SubscriptionType.RoomAvailability);

        if (subscription != null)
        {
            context.Subscriptions.Remove(subscription);
            await context.SaveChangesAsync();
        }

        // Always return 204 — idempotent (already deleted = success)
        return TypedResults.NoContent();
    }

    public static async Task<Ok<RoomAvailabilityStatusResponse>> GetRoomAvailabilitySubscription(
        NotificationContext context,
        ClaimsPrincipal user)
    {
        var userId = user.GetUserId()!;

        var subscription = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Type == SubscriptionType.RoomAvailability);

        if (subscription == null)
        {
            return TypedResults.Ok(new RoomAvailabilityStatusResponse(IsSubscribed: false));
        }

        return TypedResults.Ok(new RoomAvailabilityStatusResponse(
            IsSubscribed: true,
            Id: subscription.Id,
            CreatedAt: subscription.CreatedAt));
    }

    // Admin order notification handlers
    public static async Task<Results<Ok<SubscriptionResponse>, Created<SubscriptionResponse>>> SubscribeToAdminOrderNotifications(
        NotificationContext context,
        ClaimsPrincipal user,
        SubscribeRequest request)
    {
        var userId = user.GetUserId()!;

        // Check if already subscribed (update token if so)
        var existing = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Type == SubscriptionType.AdminOrderNotification);

        if (existing != null)
        {
            // Always update token, language, branch, and timestamp
            existing.FcmToken = request.FcmToken;
            existing.PreferredLanguage = request.PreferredLanguage ?? "en";
            existing.BranchId = request.BranchId;
            existing.UpdatedAt = DateTime.UtcNow;
            await context.SaveChangesAsync();
            return TypedResults.Ok(new SubscriptionResponse(existing.Id, existing.Type, existing.CreatedAt));
        }

        var subscription = new NotificationSubscription
        {
            UserId = userId,
            FcmToken = request.FcmToken,
            Type = SubscriptionType.AdminOrderNotification,
            BranchId = request.BranchId,
            PreferredLanguage = request.PreferredLanguage ?? "en",
            CreatedAt = DateTime.UtcNow
        };

        context.Subscriptions.Add(subscription);
        await context.SaveChangesAsync();

        return TypedResults.Created(
            $"/api/notifications/subscriptions/admin-orders",
            new SubscriptionResponse(subscription.Id, subscription.Type, subscription.CreatedAt));
    }

    public static async Task<Results<NoContent, NotFound>> UnsubscribeFromAdminOrderNotifications(
        NotificationContext context,
        ClaimsPrincipal user)
    {
        var userId = user.GetUserId()!;

        var subscription = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Type == SubscriptionType.AdminOrderNotification);

        if (subscription == null)
        {
            return TypedResults.NotFound();
        }

        context.Subscriptions.Remove(subscription);
        await context.SaveChangesAsync();

        return TypedResults.NoContent();
    }

    // Admin reservation notification handlers
    public static async Task<Results<Ok<SubscriptionResponse>, Created<SubscriptionResponse>>> SubscribeToAdminReservationNotifications(
        NotificationContext context,
        ClaimsPrincipal user,
        SubscribeRequest request)
    {
        var userId = user.GetUserId()!;

        // Check if already subscribed (update token if so)
        var existing = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Type == SubscriptionType.AdminReservationNotification);

        if (existing != null)
        {
            // Always update token, language, branch, and timestamp
            existing.FcmToken = request.FcmToken;
            existing.PreferredLanguage = request.PreferredLanguage ?? "en";
            existing.BranchId = request.BranchId;
            existing.UpdatedAt = DateTime.UtcNow;
            await context.SaveChangesAsync();
            return TypedResults.Ok(new SubscriptionResponse(existing.Id, existing.Type, existing.CreatedAt));
        }

        var subscription = new NotificationSubscription
        {
            UserId = userId,
            FcmToken = request.FcmToken,
            Type = SubscriptionType.AdminReservationNotification,
            BranchId = request.BranchId,
            PreferredLanguage = request.PreferredLanguage ?? "en",
            CreatedAt = DateTime.UtcNow
        };

        context.Subscriptions.Add(subscription);
        await context.SaveChangesAsync();

        return TypedResults.Created(
            $"/api/notifications/subscriptions/admin-reservations",
            new SubscriptionResponse(subscription.Id, subscription.Type, subscription.CreatedAt));
    }

    public static async Task<Results<NoContent, NotFound>> UnsubscribeFromAdminReservationNotifications(
        NotificationContext context,
        ClaimsPrincipal user)
    {
        var userId = user.GetUserId()!;

        var subscription = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Type == SubscriptionType.AdminReservationNotification);

        if (subscription == null)
        {
            return TypedResults.NotFound();
        }

        context.Subscriptions.Remove(subscription);
        await context.SaveChangesAsync();

        return TypedResults.NoContent();
    }

    // User order notification handlers
    public static async Task<Results<Ok<SubscriptionResponse>, Created<SubscriptionResponse>>> SubscribeToUserOrderNotifications(
        NotificationContext context,
        ClaimsPrincipal user,
        SubscribeRequest request)
    {
        var userId = user.GetUserId()!;

        var existing = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Type == SubscriptionType.UserOrderNotification);

        if (existing != null)
        {
            // Always update token, language, and timestamp
            existing.FcmToken = request.FcmToken;
            existing.PreferredLanguage = request.PreferredLanguage ?? "en";
            existing.UpdatedAt = DateTime.UtcNow;
            await context.SaveChangesAsync();
            return TypedResults.Ok(new SubscriptionResponse(existing.Id, existing.Type, existing.CreatedAt));
        }

        var subscription = new NotificationSubscription
        {
            UserId = userId,
            FcmToken = request.FcmToken,
            Type = SubscriptionType.UserOrderNotification,
            PreferredLanguage = request.PreferredLanguage ?? "en",
            CreatedAt = DateTime.UtcNow
        };

        context.Subscriptions.Add(subscription);
        await context.SaveChangesAsync();

        return TypedResults.Created(
            "/api/notifications/subscriptions/user-orders",
            new SubscriptionResponse(subscription.Id, subscription.Type, subscription.CreatedAt));
    }

    public static async Task<Results<NoContent, NotFound>> UnsubscribeFromUserOrderNotifications(
        NotificationContext context,
        ClaimsPrincipal user)
    {
        var userId = user.GetUserId()!;

        var subscription = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Type == SubscriptionType.UserOrderNotification);

        if (subscription == null)
        {
            return TypedResults.NotFound();
        }

        context.Subscriptions.Remove(subscription);
        await context.SaveChangesAsync();

        return TypedResults.NoContent();
    }

    // User session notification handlers
    public static async Task<Results<Ok<SubscriptionResponse>, Created<SubscriptionResponse>>> SubscribeToUserSessionNotifications(
        NotificationContext context,
        ClaimsPrincipal user,
        SubscribeRequest request)
    {
        var userId = user.GetUserId()!;

        var existing = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Type == SubscriptionType.UserSessionNotification);

        if (existing != null)
        {
            // Always update token, language, and timestamp
            existing.FcmToken = request.FcmToken;
            existing.PreferredLanguage = request.PreferredLanguage ?? "en";
            existing.UpdatedAt = DateTime.UtcNow;
            await context.SaveChangesAsync();
            return TypedResults.Ok(new SubscriptionResponse(existing.Id, existing.Type, existing.CreatedAt));
        }

        var subscription = new NotificationSubscription
        {
            UserId = userId,
            FcmToken = request.FcmToken,
            Type = SubscriptionType.UserSessionNotification,
            PreferredLanguage = request.PreferredLanguage ?? "en",
            CreatedAt = DateTime.UtcNow
        };

        context.Subscriptions.Add(subscription);
        await context.SaveChangesAsync();

        return TypedResults.Created(
            "/api/notifications/subscriptions/user-sessions",
            new SubscriptionResponse(subscription.Id, subscription.Type, subscription.CreatedAt));
    }

    public static async Task<Results<NoContent, NotFound>> UnsubscribeFromUserSessionNotifications(
        NotificationContext context,
        ClaimsPrincipal user)
    {
        var userId = user.GetUserId()!;

        var subscription = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Type == SubscriptionType.UserSessionNotification);

        if (subscription == null)
        {
            return TypedResults.NotFound();
        }

        context.Subscriptions.Remove(subscription);
        await context.SaveChangesAsync();

        return TypedResults.NoContent();
    }

    // Service request subscription handlers
    public static async Task<Results<Ok<SubscriptionResponse>, Created<SubscriptionResponse>>> SubscribeToServiceRequests(
        NotificationContext context,
        ClaimsPrincipal user,
        SubscribeRequest request)
    {
        var userId = user.GetUserId()!;

        var existing = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Type == SubscriptionType.ServiceRequests);

        if (existing != null)
        {
            var changed = false;
            if (existing.FcmToken != request.FcmToken)
            {
                existing.FcmToken = request.FcmToken;
                changed = true;
            }
            if (existing.PreferredLanguage != (request.PreferredLanguage ?? "en"))
            {
                existing.PreferredLanguage = request.PreferredLanguage ?? "en";
                changed = true;
            }
            if (existing.BranchId != request.BranchId)
            {
                existing.BranchId = request.BranchId;
                changed = true;
            }
            if (changed)
            {
                await context.SaveChangesAsync();
            }
            return TypedResults.Ok(new SubscriptionResponse(existing.Id, existing.Type, existing.CreatedAt));
        }

        var subscription = new NotificationSubscription
        {
            UserId = userId,
            FcmToken = request.FcmToken,
            Type = SubscriptionType.ServiceRequests,
            BranchId = request.BranchId,
            PreferredLanguage = request.PreferredLanguage ?? "en",
            CreatedAt = DateTime.UtcNow
        };

        context.Subscriptions.Add(subscription);
        await context.SaveChangesAsync();

        return TypedResults.Created(
            "/api/notifications/subscriptions/service-requests",
            new SubscriptionResponse(subscription.Id, subscription.Type, subscription.CreatedAt));
    }

    public static async Task<Results<NoContent, NotFound>> UnsubscribeFromServiceRequests(
        NotificationContext context,
        ClaimsPrincipal user)
    {
        var userId = user.GetUserId()!;

        var subscription = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Type == SubscriptionType.ServiceRequests);

        if (subscription == null)
        {
            return TypedResults.NotFound();
        }

        context.Subscriptions.Remove(subscription);
        await context.SaveChangesAsync();

        return TypedResults.NoContent();
    }

    // Service request handlers
    public static async Task<Results<Created<ServiceRequestResponse>, BadRequest<string>, UnauthorizedHttpResult>> CreateServiceRequest(
        NotificationContext context,
        IEventBus eventBus,
        ClaimsPrincipal user,
        HttpContext httpContext,
        CreateServiceRequestDto request)
    {
        // A signed-in customer, or a guest at a table known only by the id
        // their browser keeps (Ordering identifies guests the same way)
        var guestId = httpContext.GetGuestId();
        var userId = user.GetUserId() ?? (guestId is not null ? $"guest:{guestId}" : null);
        if (userId is null)
        {
            return TypedResults.Unauthorized();
        }
        var userName = user.GetUserName() ?? "Guest";
        var branchId = httpContext.GetRequiredBranchId();

        // The place the request comes from, by whichever id the client sent
        // (place first; older clients send a room or a table id), looked up
        // in Spaces' projection. What a place can take follows from what it
        // is: a waiter and the bill anywhere, a controller in a room, a rate
        // change where the tariff has options and a clock is running. A
        // place the projection has never heard of falls back to the old
        // rule: a table asks for a waiter or the bill, a room session for
        // anything.
        // LEGACY(places): atTable, the RoomId/TableId lookup and the TableName/RoomName fallbacks serve a request on the old fields — remove when every till and customer app is on /api/places and /api/stays.
        var atTable = request.PlaceId is null && request.SessionId is null && request.TableId is not null;
        var place = await ResolvePlaceAsync(context, request.PlaceId, request.RoomId, request.TableId);
        var placeName = request.PlaceName ?? (atTable ? request.TableName : request.RoomName) ?? place?.Name;
        if (placeName is null)
        {
            return TypedResults.BadRequest("A request names the place it comes from.");
        }
        // A place the projection has never heard of (created before the
        // projection existed, or its PlaceUpdated never arrived) still names
        // its kind in the request: a table takes a waiter or the bill, a room
        // anything, a rate change needs a running clock either way
        var allowed = place is not null
            ? request.RequestType switch
            {
                ServiceRequestType.CallWaiter or ServiceRequestType.ReceiptToPay => true,
                ServiceRequestType.ControllerChange => place.TakesControllerRequests,
                _ => place.HasOptions && request.SessionId is not null,
            }
            : request.PlaceKind is not null
                ? request.RequestType switch
                {
                    ServiceRequestType.CallWaiter or ServiceRequestType.ReceiptToPay => true,
                    ServiceRequestType.ControllerChange => request.PlaceKind == "Room",
                    _ => request.SessionId is not null,
                }
                : atTable
                    ? request.RequestType is ServiceRequestType.CallWaiter or ServiceRequestType.ReceiptToPay
                    : request.SessionId is not null;
        if (!allowed)
        {
            return TypedResults.BadRequest("This place cannot take that kind of request.");
        }
        // A rate change names the option wanted; the two old room types are
        // the two-option case of it
        var optionCode = request.RequestType switch
        {
            // LEGACY(places): SwitchToMulti/SwitchToSingle mapped onto the ChangeOption codes — remove when every till and customer app is on /api/places and /api/stays.
            ServiceRequestType.SwitchToMulti => "multi",
            ServiceRequestType.SwitchToSingle => "single",
            ServiceRequestType.ChangeOption => request.OptionCode?.Trim().ToLowerInvariant(),
            _ => null,
        };
        if (request.RequestType == ServiceRequestType.ChangeOption && string.IsNullOrEmpty(optionCode))
        {
            return TypedResults.BadRequest("A rate change names the option wanted.");
        }
        // LEGACY(places): an old SwitchTo* request is stored as the ChangeOption it means, so the tills only ever see one type — remove when every till and customer app is on /api/places and /api/stays.
        var requestType = request.RequestType is ServiceRequestType.SwitchToMulti or ServiceRequestType.SwitchToSingle
            ? ServiceRequestType.ChangeOption
            : request.RequestType;
        var placeId = request.PlaceId ?? place?.PlaceId;
        var placeKind = request.PlaceKind ?? place?.Kind ?? (atTable ? "Table" : "Room");
        // LEGACY(places): fills the old RoomId from the place so older tills still see it — remove when every till and customer app is on /api/places and /api/stays.
        var roomId = request.RoomId ?? (placeKind == "Room" ? placeId : null);

        // One open request of a kind per person per place: the earlier one
        // is still on the till's screen, so a second changes nothing there,
        // and a stranger with a table's link can leave one, not a pile. The
        // customer can take theirs back and ask again.
        var alreadyOpen = await context.ServiceRequests
            .AnyAsync(r => r.UserId == userId
                && r.PlaceId == placeId
                && r.RequestType == requestType
                && r.Status == ServiceRequestStatus.Pending);

        if (alreadyOpen)
        {
            return TypedResults.BadRequest("You already have this request waiting. The counter will see it shortly.");
        }

        var serviceRequest = new ServiceRequest
        {
            UserId = userId,
            UserName = userName,
            SessionId = request.SessionId,
            PlaceId = placeId,
            PlaceKind = placeKind,
            OptionCode = optionCode,
            // LEGACY(places): RoomId, RoomName, TableId and TableName fill the old columns beside the place — remove when every till and customer app is on /api/places and /api/stays.
            RoomId = roomId,
            BranchId = branchId,
            // Own copies: both names are owned JSON columns, and EF refuses one
            // LocalizedText instance hanging off two of them
            RoomName = new LocalizedText(placeName.En, placeName.Ar),
            TableId = request.TableId,
            TableName = request.TableName is null ? null : new LocalizedText(request.TableName.En, request.TableName.Ar),
            RequestType = requestType,
            Status = ServiceRequestStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        context.ServiceRequests.Add(serviceRequest);
        await context.SaveChangesAsync();

        // Publish event to notify staff
        await eventBus.PublishAsync(new ServiceRequestCreatedIntegrationEvent(
            serviceRequest.Id,
            serviceRequest.UserName,
            serviceRequest.RoomId ?? 0,
            serviceRequest.RoomName,
            serviceRequest.RequestType,
            serviceRequest.CreatedAt,
            branchId,
            serviceRequest.TableId,
            serviceRequest.TableName,
            serviceRequest.PlaceId,
            serviceRequest.PlaceKind,
            serviceRequest.OptionCode));

        return TypedResults.Created(
            $"/api/notifications/service-requests/{serviceRequest.Id}",
            new ServiceRequestResponse(
                serviceRequest.Id,
                serviceRequest.UserName,
                serviceRequest.RoomId,
                serviceRequest.RoomName,
                serviceRequest.RequestType,
                serviceRequest.Status,
                serviceRequest.CreatedAt,
                serviceRequest.TableId,
                serviceRequest.TableName,
                serviceRequest.PlaceId,
                serviceRequest.PlaceKind,
                serviceRequest.OptionCode,
                serviceRequest.TableName ?? serviceRequest.RoomName));
    }

    /// <summary>
    /// LEGACY(places): the roomId/tableId fallbacks resolve an old room/table id — remove when the printed room/table stickers are reprinted with /p/{id}.
    /// The projected place behind whichever id the client sent: place, then room, then table.
    /// </summary>
    private static async Task<Place?> ResolvePlaceAsync(NotificationContext context, int? placeId, int? roomId, int? tableId)
    {
        var places = context.Places.AsNoTracking();
        if (placeId is int id)
            return await places.FirstOrDefaultAsync(p => p.PlaceId == id);
        // LEGACY(places): old room/table id fallbacks — remove when the printed room/table stickers are reprinted with /p/{id}.
        if (roomId is int room)
            return await places.FirstOrDefaultAsync(p => p.LegacyRoomId == room)
                ?? await places.FirstOrDefaultAsync(p => p.PlaceId == room && p.Kind == "Room");
        if (tableId is int table)
            return await places.FirstOrDefaultAsync(p => p.LegacyTableId == table)
                ?? await places.FirstOrDefaultAsync(p => p.PlaceId == table && p.Kind == "Table");
        return null;
    }

    public static async Task<Ok<List<ServiceRequestResponse>>> GetPendingServiceRequests(
        NotificationContext context,
        HttpContext httpContext)
    {
        var branchId = httpContext.GetRequiredBranchId();

        var requests = await context.ServiceRequests
            .AsNoTracking()
            .Where(r => r.Status == ServiceRequestStatus.Pending || r.Status == ServiceRequestStatus.Acknowledged)
            .Where(r => r.BranchId == branchId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new ServiceRequestResponse(
                r.Id,
                r.UserName,
                r.RoomId,
                r.RoomName,
                r.RequestType,
                r.Status,
                r.CreatedAt,
                r.TableId,
                r.TableName,
                r.PlaceId,
                r.PlaceKind,
                r.OptionCode,
                r.TableName ?? r.RoomName))
            .ToListAsync();

        return TypedResults.Ok(requests);
    }

    /// <summary>The caller as a request names its owner: the account's id, or the guest id its browser holds.</summary>
    private static string? RequestOwner(ClaimsPrincipal user, HttpContext httpContext)
    {
        var guestId = httpContext.GetGuestId();
        return user.GetUserId() ?? (guestId is not null ? $"guest:{guestId}" : null);
    }

    /// <summary>The hub group the owner listens on: the account's, or the guest's (the id already carries its prefix).</summary>
    private static string CustomerGroup(string ownerId) =>
        ownerId.StartsWith("guest:", StringComparison.Ordinal) ? ownerId : $"user:{ownerId}";

    private static ServiceRequestResponse ToResponse(ServiceRequest r) => new(
        r.Id,
        r.UserName,
        r.RoomId,
        r.RoomName,
        r.RequestType,
        r.Status,
        r.CreatedAt,
        r.TableId,
        r.TableName,
        r.PlaceId,
        r.PlaceKind,
        r.OptionCode,
        r.TableName ?? r.RoomName,
        r.AcknowledgedBy,
        r.AcknowledgedAt);

    /// <summary>
    /// Tells the customer (and every till) that a request of theirs moved:
    /// the pill on their screen goes from sent to on-the-way to done.
    /// </summary>
    private static async Task PushChangedAsync(IHubContext<NotificationHub> hub, ServiceRequest request)
    {
        var payload = new
        {
            id = request.Id,
            status = request.Status,
            requestType = request.RequestType,
            placeId = request.PlaceId,
            acknowledgedBy = request.AcknowledgedBy,
            branchId = request.BranchId
        };
        await hub.Clients.Group(CustomerGroup(request.UserId)).SendAsync("ServiceRequestChanged", payload);
        await hub.Clients.Group("admin").SendAsync("ServiceRequestChanged", payload);
    }

    public static async Task<Results<Ok<List<ServiceRequestResponse>>, UnauthorizedHttpResult>> GetMyServiceRequests(
        NotificationContext context,
        ClaimsPrincipal user,
        HttpContext httpContext)
    {
        var owner = RequestOwner(user, httpContext);
        if (owner is null)
        {
            return TypedResults.Unauthorized();
        }
        // Open until the till finishes it or the customer takes it back;
        // no clock decides a request was forgotten
        var requests = await context.ServiceRequests
            .AsNoTracking()
            .Where(r => r.UserId == owner)
            .Where(r => r.Status == ServiceRequestStatus.Pending || r.Status == ServiceRequestStatus.Acknowledged)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        return TypedResults.Ok(requests.Select(ToResponse).ToList());
    }

    public static async Task<Results<Ok<ServiceRequestResponse>, NotFound, Conflict<string>, UnauthorizedHttpResult>> CancelServiceRequest(
        NotificationContext context,
        IHubContext<NotificationHub> hub,
        ClaimsPrincipal user,
        HttpContext httpContext,
        [Description("The service request ID")] int id)
    {
        var owner = RequestOwner(user, httpContext);
        if (owner is null)
        {
            return TypedResults.Unauthorized();
        }

        // Someone else's request is not found rather than forbidden: the id
        // alone should not tell a caller whether it exists
        var request = await context.ServiceRequests.FindAsync(id);
        if (request == null || request.UserId != owner)
        {
            return TypedResults.NotFound();
        }
        // Once a waiter is on the way the request is theirs to finish
        if (request.Status != ServiceRequestStatus.Pending)
        {
            return TypedResults.Conflict("This request has already been picked up.");
        }

        request.Status = ServiceRequestStatus.Cancelled;
        await context.SaveChangesAsync();
        await PushChangedAsync(hub, request);

        return TypedResults.Ok(ToResponse(request));
    }

    public static async Task<Results<Ok<ServiceRequestResponse>, NotFound>> AcknowledgeServiceRequest(
        NotificationContext context,
        IHubContext<NotificationHub> hub,
        ClaimsPrincipal user,
        [Description("The service request ID")] int id)
    {
        var request = await context.ServiceRequests.FindAsync(id);

        if (request == null)
        {
            return TypedResults.NotFound();
        }

        request.Status = ServiceRequestStatus.Acknowledged;
        request.AcknowledgedAt = DateTime.UtcNow;
        request.AcknowledgedBy = user.GetUserName() ?? user.GetUserId();

        await context.SaveChangesAsync();
        await PushChangedAsync(hub, request);

        return TypedResults.Ok(ToResponse(request));
    }

    public static async Task<Results<Ok<ServiceRequestResponse>, NotFound>> CompleteServiceRequest(
        NotificationContext context,
        IHubContext<NotificationHub> hub,
        [Description("The service request ID")] int id)
    {
        var request = await context.ServiceRequests.FindAsync(id);

        if (request == null)
        {
            return TypedResults.NotFound();
        }

        request.Status = ServiceRequestStatus.Completed;
        await context.SaveChangesAsync();
        await PushChangedAsync(hub, request);

        return TypedResults.Ok(new ServiceRequestResponse(
            request.Id,
            request.UserName,
            request.RoomId,
            request.RoomName,
            request.RequestType,
            request.Status,
            request.CreatedAt,
            request.TableId,
            request.TableName,
            request.PlaceId,
            request.PlaceKind,
            request.OptionCode,
            request.TableName ?? request.RoomName));
    }

    // Notification preferences handlers
    public static async Task<Ok<NotificationPreferencesResponse>> GetNotificationPreferences(
        NotificationContext context,
        ClaimsPrincipal user)
    {
        var userId = user.GetUserId()!;

        var preferences = await context.Preferences
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (preferences == null)
        {
            // Return default preferences if none exist
            return TypedResults.Ok(new NotificationPreferencesResponse(
                OrderStatusUpdates: true,
                PromotionsAndOffers: true));
        }

        return TypedResults.Ok(new NotificationPreferencesResponse(
            preferences.OrderStatusUpdates,
            preferences.PromotionsAndOffers));
    }

    public static async Task<Ok> UpdateNotificationPreferences(
        NotificationContext context,
        ClaimsPrincipal user,
        UpdateNotificationPreferencesRequest request)
    {
        var userId = user.GetUserId()!;

        var preferences = await context.Preferences
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (preferences == null)
        {
            // Create new preferences
            preferences = new NotificationPreferences
            {
                UserId = userId,
                OrderStatusUpdates = request.OrderStatusUpdates,
                PromotionsAndOffers = request.PromotionsAndOffers,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            context.Preferences.Add(preferences);
        }
        else
        {
            // Update existing preferences
            preferences.OrderStatusUpdates = request.OrderStatusUpdates;
            preferences.PromotionsAndOffers = request.PromotionsAndOffers;
            preferences.UpdatedAt = DateTime.UtcNow;
        }

        await context.SaveChangesAsync();

        return TypedResults.Ok();
    }
}

public record SubscribeRequest(
    [property: Description("The FCM token from the mobile device")] string FcmToken,
    [property: Description("Preferred language for notifications (en or ar)")] string? PreferredLanguage = "en",
    [property: Description("Branch ID for branch-scoped notifications (admin only)")] int? BranchId = null
);

public record SubscriptionResponse(
    int Id,
    SubscriptionType Type,
    DateTime CreatedAt
);

public record CreateServiceRequestDto(
    [property: Description("The type of request")] ServiceRequestType RequestType,
    [property: Description("The room session, for a request from a room")] int? SessionId = null,
    // LEGACY(places): old RoomId/RoomName/TableId/TableName request fields beside PlaceId/PlaceKind/PlaceName — remove when every till and customer app is on /api/places and /api/stays.
    [property: Description("The room, for a request from a room")] int? RoomId = null,
    [property: Description("The room name (localized)")] LocalizedText? RoomName = null,
    [property: Description("The table, for a waiter or the bill at a table")] int? TableId = null,
    [property: Description("The table name (localized)")] LocalizedText? TableName = null,
    [property: Description("The Spaces place the request comes from; newer clients send this instead of a room or table id")] int? PlaceId = null,
    [property: Description("Room, Table or Station")] string? PlaceKind = null,
    [property: Description("The place name (localized)")] LocalizedText? PlaceName = null,
    [property: Description("The rate option wanted, for a ChangeOption request")] string? OptionCode = null
);

public record ServiceRequestResponse(
    int Id,
    string UserName,
    // LEGACY(places): old RoomId/RoomName (and TableId/TableName below) beside PlaceId/PlaceKind — remove when every till and customer app is on /api/places and /api/stays.
    int? RoomId,
    LocalizedText RoomName,
    ServiceRequestType RequestType,
    ServiceRequestStatus Status,
    DateTime CreatedAt,
    int? TableId = null,
    LocalizedText? TableName = null,
    int? PlaceId = null,
    string? PlaceKind = null,
    string? OptionCode = null,
    LocalizedText? PlaceName = null,
    [property: Description("Who picked the request up, for the customer's 'on the way'")] string? AcknowledgedBy = null,
    DateTime? AcknowledgedAt = null
);

public record NotificationPreferencesResponse(
    bool OrderStatusUpdates,
    bool PromotionsAndOffers
);

public record UpdateNotificationPreferencesRequest(
    [property: Description("Receive notifications when order status changes")] bool OrderStatusUpdates,
    [property: Description("Receive promotional offers and discounts")] bool PromotionsAndOffers
);

public record RoomAvailabilityStatusResponse(
    bool IsSubscribed,
    int? Id = null,
    DateTime? CreatedAt = null
);

public record SendAnnouncementRequest(
    [property: Description("Notification title")] string Title,
    [property: Description("Notification body")] string Body
);

public record AnnouncementResponse(
    int Id,
    string Title,
    string Body,
    string SentBy,
    DateTime SentAt,
    int RecipientCount
);
