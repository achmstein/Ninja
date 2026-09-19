namespace Ninja.Notification.API.Services;

/// <summary>
/// Result of a batch FCM send operation, including which tokens are no longer valid.
/// </summary>
public record BatchSendResult(int SuccessCount, List<string> UnregisteredTokens);

public interface IFcmService
{
    Task<bool> SendNotificationAsync(string fcmToken, string title, string body, Dictionary<string, string>? data = null);
    Task<BatchSendResult> SendBatchNotificationsAsync(IEnumerable<string> fcmTokens, string title, string body, Dictionary<string, string>? data = null);
    Task<BatchSendResult> SendBatchDataMessagesAsync(IEnumerable<string> fcmTokens, Dictionary<string, string> data);

    /// <summary>
    /// Send data-only messages to Android (native code handles notification display)
    /// but with APNs alert for iOS (since data-only is silent on iOS).
    /// Used for order reminders where Android needs full control over the notification.
    /// </summary>
    Task<BatchSendResult> SendBatchDataWithApnsAlertAsync(IEnumerable<string> fcmTokens, string title, string body, Dictionary<string, string> data);
}
