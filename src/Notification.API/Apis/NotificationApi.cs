using System.ComponentModel;
using System.Security.Claims;
using Chillax.Notification.API.IntegrationEvents.Events;
using Chillax.Notification.API.Model;
using Chillax.Notification.API.Services;
using Chillax.ServiceDefaults;
using Microsoft.AspNetCore.Http.HttpResults;
using static Chillax.ServiceDefaults.BranchHeaderExtensions;

namespace Chillax.Notification.API.Apis;

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
        api.MapPost("/service-requests", CreateServiceRequest)
            .WithName("CreateServiceRequest")
            .WithSummary("Create a service request")
            .WithDescription("Request waiter, controller change, or receipt")
            .WithTags("Service Requests");

        // Service request management (for staff/admin)
        api.MapGet("/service-requests/pending", GetPendingServiceRequests)
            .WithName("GetPendingServiceRequests")
            .WithSummary("Get pending service requests")
            .WithDescription("Get all pending service requests for staff dashboard (Admin only)")
            .WithTags("Service Requests")
            .RequireAuthorization("Admin");

        api.MapPut("/service-requests/{id}/acknowledge", AcknowledgeServiceRequest)
            .WithName("AcknowledgeServiceRequest")
            .WithSummary("Acknowledge a service request")
            .WithDescription("Mark request as acknowledged by staff (Admin only)")
            .WithTags("Service Requests")
            .RequireAuthorization("Admin");

        api.MapPut("/service-requests/{id}/complete", CompleteServiceRequest)
            .WithName("CompleteServiceRequest")
            .WithSummary("Complete a service request")
            .WithDescription("Mark request as completed (Admin only)")
            .WithTags("Service Requests")
            .RequireAuthorization("Admin");

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
    public static async Task<Results<Created<ServiceRequestResponse>, BadRequest<string>>> CreateServiceRequest(
        NotificationContext context,
        IEventBus eventBus,
        ClaimsPrincipal user,
        HttpContext httpContext,
        CreateServiceRequestDto request)
    {
        var userId = user.GetUserId()!;
        var userName = user.GetUserName() ?? "Guest";
        var branchId = httpContext.GetRequiredBranchId();

        // Check for recent duplicate request (within 30 seconds)
        var recentRequest = await context.ServiceRequests
            .Where(r => r.UserId == userId
                && r.SessionId == request.SessionId
                && r.RequestType == request.RequestType
                && r.Status == ServiceRequestStatus.Pending
                && r.CreatedAt > DateTime.UtcNow.AddSeconds(-30))
            .FirstOrDefaultAsync();

        if (recentRequest != null)
        {
            return TypedResults.BadRequest("A similar request was made recently. Please wait before making another request.");
        }

        var serviceRequest = new ServiceRequest
        {
            UserId = userId,
            UserName = userName,
            SessionId = request.SessionId,
            RoomId = request.RoomId,
            BranchId = branchId,
            RoomName = request.RoomName,
            RequestType = request.RequestType,
            Status = ServiceRequestStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        context.ServiceRequests.Add(serviceRequest);
        await context.SaveChangesAsync();

        // Publish event to notify staff
        await eventBus.PublishAsync(new ServiceRequestCreatedIntegrationEvent(
            serviceRequest.Id,
            serviceRequest.UserName,
            serviceRequest.RoomId,
            serviceRequest.RoomName,
            serviceRequest.RequestType,
            serviceRequest.CreatedAt,
            branchId));

        return TypedResults.Created(
            $"/api/notifications/service-requests/{serviceRequest.Id}",
            new ServiceRequestResponse(
                serviceRequest.Id,
                serviceRequest.UserName,
                serviceRequest.RoomId,
                serviceRequest.RoomName,
                serviceRequest.RequestType,
                serviceRequest.Status,
                serviceRequest.CreatedAt));
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
                r.CreatedAt))
            .ToListAsync();

        return TypedResults.Ok(requests);
    }

    public static async Task<Results<Ok<ServiceRequestResponse>, NotFound>> AcknowledgeServiceRequest(
        NotificationContext context,
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

        return TypedResults.Ok(new ServiceRequestResponse(
            request.Id,
            request.UserName,
            request.RoomId,
            request.RoomName,
            request.RequestType,
            request.Status,
            request.CreatedAt));
    }

    public static async Task<Results<Ok<ServiceRequestResponse>, NotFound>> CompleteServiceRequest(
        NotificationContext context,
        [Description("The service request ID")] int id)
    {
        var request = await context.ServiceRequests.FindAsync(id);

        if (request == null)
        {
            return TypedResults.NotFound();
        }

        request.Status = ServiceRequestStatus.Completed;
        await context.SaveChangesAsync();

        return TypedResults.Ok(new ServiceRequestResponse(
            request.Id,
            request.UserName,
            request.RoomId,
            request.RoomName,
            request.RequestType,
            request.Status,
            request.CreatedAt));
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
    [property: Description("The user's active session ID")] int SessionId,
    [property: Description("The room ID")] int RoomId,
    [property: Description("The room name (localized)")] LocalizedText RoomName,
    [property: Description("The type of request")] ServiceRequestType RequestType
);

public record ServiceRequestResponse(
    int Id,
    string UserName,
    int RoomId,
    LocalizedText RoomName,
    ServiceRequestType RequestType,
    ServiceRequestStatus Status,
    DateTime CreatedAt
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
