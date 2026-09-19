using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using Google.Apis.Auth.OAuth2;

namespace Ninja.Notification.API.Services;

public class FcmService : IFcmService
{
    private const string FirebaseCredentialsFileName = "firebase-credentials.json";
    private readonly ILogger<FcmService> _logger;
    private readonly bool _isInitialized;

    public FcmService(ILogger<FcmService> logger)
    {
        _logger = logger;

        try
        {
            if (FirebaseApp.DefaultInstance == null)
            {
                var credentialsPath = FindCredentialsFile();

                if (credentialsPath != null)
                {
                    FirebaseApp.Create(new AppOptions
                    {
                        Credential = GoogleCredential.FromFile(credentialsPath)
                    });
                    _isInitialized = true;
                    _logger.LogInformation("Firebase initialized successfully from {Path}", credentialsPath);
                }
                else
                {
                    _logger.LogWarning("{FileName} not found. FCM notifications will be simulated.", FirebaseCredentialsFileName);
                    _isInitialized = false;
                }
            }
            else
            {
                _isInitialized = true;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize Firebase");
            _isInitialized = false;
        }
    }

    private string? FindCredentialsFile()
    {
        // Check current directory
        var currentDir = Path.Combine(Directory.GetCurrentDirectory(), FirebaseCredentialsFileName);
        if (File.Exists(currentDir))
            return currentDir;

        // Check app base directory
        var baseDir = Path.Combine(AppContext.BaseDirectory, FirebaseCredentialsFileName);
        if (File.Exists(baseDir))
            return baseDir;

        return null;
    }

    /// <summary>
    /// Extract unregistered tokens from a SendEachResponse so callers can clean them up.
    /// </summary>
    private static List<string> GetUnregisteredTokens(BatchResponse response, List<string> tokens)
    {
        var unregistered = new List<string>();
        for (var i = 0; i < response.Responses.Count; i++)
        {
            var sendResponse = response.Responses[i];
            if (sendResponse.Exception?.MessagingErrorCode == MessagingErrorCode.Unregistered)
            {
                unregistered.Add(tokens[i]);
            }
        }
        return unregistered;
    }

    public async Task<bool> SendNotificationAsync(string fcmToken, string title, string body, Dictionary<string, string>? data = null)
    {
        if (!_isInitialized)
        {
            _logger.LogInformation("Simulating FCM notification to token {Token}: {Title} - {Body}",
                fcmToken[..Math.Min(10, fcmToken.Length)] + "...", title, body);
            return true;
        }

        try
        {
            var message = new Message
            {
                Token = fcmToken,
                Notification = new FirebaseAdmin.Messaging.Notification
                {
                    Title = title,
                    Body = body
                },
                Data = data,
                // High priority for instant delivery
                Android = new AndroidConfig
                {
                    Priority = Priority.High,
                    Notification = new AndroidNotification
                    {
                        Priority = NotificationPriority.MAX,
                        ChannelId = "high_priority_channel"
                    }
                },
                Apns = new ApnsConfig
                {
                    Headers = new Dictionary<string, string>
                    {
                        { "apns-priority", "10" } // Immediate delivery on iOS
                    },
                    Aps = new Aps
                    {
                        Sound = "default",
                        ContentAvailable = true
                    }
                }
            };

            var response = await FirebaseMessaging.DefaultInstance.SendAsync(message);
            _logger.LogInformation("FCM notification sent successfully: {Response}", response);
            return true;
        }
        catch (FirebaseMessagingException ex) when (ex.MessagingErrorCode == MessagingErrorCode.Unregistered)
        {
            _logger.LogWarning("FCM token is no longer valid: {Token}", fcmToken[..Math.Min(10, fcmToken.Length)] + "...");
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send FCM notification to token {Token}", fcmToken[..Math.Min(10, fcmToken.Length)] + "...");
            return false;
        }
    }

    public async Task<BatchSendResult> SendBatchNotificationsAsync(IEnumerable<string> fcmTokens, string title, string body, Dictionary<string, string>? data = null)
    {
        var tokenList = fcmTokens.ToList();
        if (tokenList.Count == 0)
            return new BatchSendResult(0, []);

        if (!_isInitialized)
        {
            _logger.LogInformation("Simulating batch FCM notifications to {Count} tokens: {Title} - {Body}",
                tokenList.Count, title, body);
            return new BatchSendResult(tokenList.Count, []);
        }

        try
        {
            var messages = tokenList.Select(token => new Message
            {
                Token = token,
                Notification = new FirebaseAdmin.Messaging.Notification
                {
                    Title = title,
                    Body = body
                },
                Data = data,
                Android = new AndroidConfig
                {
                    Priority = Priority.High,
                    Notification = new AndroidNotification
                    {
                        Priority = NotificationPriority.MAX,
                        ChannelId = "high_priority_channel"
                    }
                },
                Apns = new ApnsConfig
                {
                    Headers = new Dictionary<string, string>
                    {
                        { "apns-priority", "10" }
                    },
                    Aps = new Aps
                    {
                        Sound = "default",
                        ContentAvailable = true
                    }
                }
            }).ToList();

            var response = await FirebaseMessaging.DefaultInstance.SendEachAsync(messages);
            var unregistered = GetUnregisteredTokens(response, tokenList);

            if (unregistered.Count > 0)
                _logger.LogWarning("Found {Count} unregistered FCM tokens during batch send", unregistered.Count);

            _logger.LogInformation("Batch FCM notifications sent: {Success}/{Total} successful",
                response.SuccessCount, tokenList.Count);

            return new BatchSendResult(response.SuccessCount, unregistered);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send batch FCM notifications");
            return new BatchSendResult(0, []);
        }
    }

    public async Task<BatchSendResult> SendBatchDataWithApnsAlertAsync(IEnumerable<string> fcmTokens, string title, string body, Dictionary<string, string> data)
    {
        var tokenList = fcmTokens.ToList();
        if (tokenList.Count == 0)
            return new BatchSendResult(0, []);

        if (!_isInitialized)
        {
            _logger.LogInformation("Simulating batch FCM data+APNs messages to {Count} tokens: {Title} - {Body}",
                tokenList.Count, title, body);
            return new BatchSendResult(tokenList.Count, []);
        }

        try
        {
            var messages = tokenList.Select(token => new Message
            {
                Token = token,
                Data = data,
                Android = new AndroidConfig
                {
                    Priority = Priority.High
                },
                Apns = new ApnsConfig
                {
                    Headers = new Dictionary<string, string>
                    {
                        { "apns-priority", "10" }
                    },
                    Aps = new Aps
                    {
                        Sound = "default",
                        ContentAvailable = true,
                        Alert = new ApsAlert
                        {
                            Title = title,
                            Body = body
                        }
                    }
                }
            }).ToList();

            var response = await FirebaseMessaging.DefaultInstance.SendEachAsync(messages);
            var unregistered = GetUnregisteredTokens(response, tokenList);

            if (unregistered.Count > 0)
                _logger.LogWarning("Found {Count} unregistered FCM tokens during data+APNs batch send", unregistered.Count);

            _logger.LogInformation("Batch FCM data+APNs messages sent: {Success}/{Total} successful",
                response.SuccessCount, tokenList.Count);

            return new BatchSendResult(response.SuccessCount, unregistered);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send batch FCM data+APNs messages");
            return new BatchSendResult(0, []);
        }
    }

    public async Task<BatchSendResult> SendBatchDataMessagesAsync(IEnumerable<string> fcmTokens, Dictionary<string, string> data)
    {
        var tokenList = fcmTokens.ToList();
        if (tokenList.Count == 0)
            return new BatchSendResult(0, []);

        if (!_isInitialized)
        {
            _logger.LogInformation("Simulating batch FCM data messages to {Count} tokens: {Data}",
                tokenList.Count, string.Join(", ", data.Select(d => $"{d.Key}={d.Value}")));
            return new BatchSendResult(tokenList.Count, []);
        }

        try
        {
            var messages = tokenList.Select(token => new Message
            {
                Token = token,
                Data = data,
                Android = new AndroidConfig
                {
                    Priority = Priority.High
                },
                Apns = new ApnsConfig
                {
                    Headers = new Dictionary<string, string>
                    {
                        { "apns-priority", "10" }
                    },
                    Aps = new Aps
                    {
                        ContentAvailable = true
                    }
                }
            }).ToList();

            var response = await FirebaseMessaging.DefaultInstance.SendEachAsync(messages);
            var unregistered = GetUnregisteredTokens(response, tokenList);

            if (unregistered.Count > 0)
                _logger.LogWarning("Found {Count} unregistered FCM tokens during data batch send", unregistered.Count);

            _logger.LogInformation("Batch FCM data messages sent: {Success}/{Total} successful",
                response.SuccessCount, tokenList.Count);

            return new BatchSendResult(response.SuccessCount, unregistered);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send batch FCM data messages");
            return new BatchSendResult(0, []);
        }
    }
}
