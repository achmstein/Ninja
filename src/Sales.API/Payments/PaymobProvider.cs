#nullable enable
using System.Globalization;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;

namespace Ninja.Sales.API.Payments;

/// <summary>
/// Paymob's Intention API and Unified Checkout, on the business's own account:
/// an intention is created server-side with the business's secret key (amounts
/// in the currency's minor unit), the guest pays on Paymob's checkout page,
/// and Paymob's transaction callback, signed with HMAC-SHA512 over twenty
/// fixed fields, says how it went. The redirect back is never trusted; the
/// app asks our API, which only the callback updates.
/// Check against Paymob's current docs on a sandbox account:
/// developers.paymob.com (intention-apis/create-intention, webhook-callbacks-and-hmac).
/// </summary>
public sealed class PaymobProvider(HttpClient http, IOptions<PaymentsOptions> options, ILogger<PaymobProvider> logger) : IPaymentProvider
{
    public const string ProviderName = "paymob";

    public string Name => ProviderName;

    private string BaseUrl => options.Value.Paymob.BaseUrl.TrimEnd('/');

    /// <summary>The callback fields Paymob signs, in the order it concatenates them.</summary>
    internal static readonly string[] SignedFields =
    [
        "amount_cents", "created_at", "currency", "error_occured", "has_parent_transaction", "id",
        "integration_id", "is_3d_secure", "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
        "is_voided", "order.id", "owner", "pending", "source_data.pan", "source_data.sub_type",
        "source_data.type", "success",
    ];

    internal static long Cents(decimal amount) => (long)Math.Round(amount * 100m, MidpointRounding.AwayFromZero);

    public async Task<CheckoutSession> StartCheckoutAsync(ProviderAccount account, CheckoutRequest request, CancellationToken ct)
    {
        if (account.PublicKey is null) throw new PaymentProviderException("The business's Paymob public key is not set.");

        var (first, last) = SplitName(request.PayerName);
        var body = new JsonObject
        {
            ["amount"] = Cents(request.Charged),
            ["currency"] = request.Currency,
            ["payment_methods"] = new JsonArray([.. account.IntegrationIds.Select(id => (JsonNode)id)]),
            ["items"] = new JsonArray([.. request.Items.Select(i => (JsonNode)new JsonObject
            {
                ["name"] = i.Name,
                ["amount"] = Cents(i.Amount),
                ["quantity"] = 1,
            })]),
            // Paymob asks for a full billing block; a guest at a table has a name and maybe a phone
            ["billing_data"] = new JsonObject
            {
                ["first_name"] = first,
                ["last_name"] = last,
                ["phone_number"] = string.IsNullOrWhiteSpace(request.PayerPhone) ? "NA" : request.PayerPhone,
                ["email"] = "NA",
                ["apartment"] = "NA",
                ["street"] = "NA",
                ["building"] = "NA",
                ["floor"] = "NA",
                ["city"] = "NA",
                ["country"] = "NA",
                ["state"] = "NA",
            },
            ["special_reference"] = request.Reference,
            ["notification_url"] = request.CallbackUrl,
            ["redirection_url"] = request.ReturnUrl,
        };

        using var message = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/v1/intention/") { Content = JsonContent.Create(body) };
        message.Headers.Authorization = new AuthenticationHeaderValue("Token", account.SecretKey);
        using var response = await http.SendAsync(message, ct);
        var text = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            // The body names the field Paymob did not like; it carries no secret of ours
            logger.LogWarning("Paymob refused an intention ({Status}): {Body}", (int)response.StatusCode, text);
            throw new PaymentProviderException($"Paymob refused the payment ({(int)response.StatusCode}).");
        }

        var json = JsonNode.Parse(text);
        var clientSecret = json?["client_secret"]?.GetValue<string>();
        var order = json?["intention_order_id"]?.ToString();
        if (string.IsNullOrEmpty(clientSecret) || string.IsNullOrEmpty(order))
            throw new PaymentProviderException("Paymob answered without a checkout.");

        var url = $"{BaseUrl}/unifiedcheckout/?publicKey={Uri.EscapeDataString(account.PublicKey)}&clientSecret={Uri.EscapeDataString(clientSecret)}";
        return new CheckoutSession(order, url);
    }

    public CallbackOutcome? VerifyCallback(ProviderAccount account, JsonElement body, string? signature)
    {
        if (account.HmacSecret is null || string.IsNullOrWhiteSpace(signature)) return null;
        if (!body.TryGetProperty("obj", out var obj) || obj.ValueKind != JsonValueKind.Object) return null;

        var expected = Sign(obj, account.HmacSecret);
        if (!CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(signature.Trim().ToLowerInvariant())))
            return null;

        var merchantReference = Field(obj, "order.merchant_order_id");
        var cents = decimal.TryParse(Field(obj, "amount_cents"), NumberStyles.Number, CultureInfo.InvariantCulture, out var c) ? c : 0m;
        var error = Field(obj, "data.message");

        // A capture, void or refund we made is a transaction of its own on the same order, with the
        // payment as its parent; it is the payment's follow-up, not another payment
        var followUp = Field(obj, "has_parent_transaction") == "true"
            || Field(obj, "is_capture") == "true" || Field(obj, "is_voided") == "true" || Field(obj, "is_refunded") == "true";

        return new CallbackOutcome(
            Field(obj, "order.id"),
            merchantReference.Length == 0 ? null : merchantReference,
            Field(obj, "id"),
            Field(obj, "success") == "true",
            Field(obj, "pending") == "true",
            cents / 100m,
            error.Length == 0 ? null : error,
            IsAuth: Field(obj, "is_auth") == "true",
            IsFollowUp: followUp);
    }

    /// <summary>Paymob's HMAC: the signed fields' values concatenated in order, HMAC-SHA512 with the business's secret, lower-case hex.</summary>
    internal static string Sign(JsonElement obj, string hmacSecret)
    {
        var concatenated = string.Concat(SignedFields.Select(f => Field(obj, f)));
        var hash = HMACSHA512.HashData(Encoding.UTF8.GetBytes(hmacSecret), Encoding.UTF8.GetBytes(concatenated));
        return Convert.ToHexStringLower(hash);
    }

    /// <summary>A field by dotted path as Paymob writes it into the signature: booleans lower-case, numbers as sent, null as nothing.</summary>
    internal static string Field(JsonElement obj, string path)
    {
        var current = obj;
        foreach (var part in path.Split('.'))
        {
            if (current.ValueKind != JsonValueKind.Object || !current.TryGetProperty(part, out current)) return "";
        }
        return current.ValueKind switch
        {
            JsonValueKind.String => current.GetString() ?? "",
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            JsonValueKind.Number => current.GetRawText(),
            _ => "",
        };
    }

    // Paymob's post-payment operations (its "Refund & Void & Capture APIs" collection): each a POST with the
    // business's secret key, naming the transaction; amounts in the minor unit

    public Task RefundAsync(ProviderAccount account, string transactionId, decimal amount, CancellationToken ct)
        => PostOperationAsync(account, "api/acceptance/void_refund/refund", new JsonObject { ["transaction_id"] = transactionId, ["amount_cents"] = Cents(amount) }, "refund", transactionId, ct);

    public Task CaptureAsync(ProviderAccount account, string transactionId, decimal amount, CancellationToken ct)
        => PostOperationAsync(account, "api/acceptance/capture", new JsonObject { ["transaction_id"] = transactionId, ["amount_cents"] = Cents(amount) }, "capture", transactionId, ct);

    public Task VoidAsync(ProviderAccount account, string transactionId, CancellationToken ct)
        => PostOperationAsync(account, "api/acceptance/void_refund/void", new JsonObject { ["transaction_id"] = transactionId }, "void", transactionId, ct);

    /// <summary>
    /// One of Paymob's money moves. Paymob answers a move it would not make with a transaction whose
    /// "success" is false, often with HTTP 200, so the body decides, not the status. No answer at all
    /// (a timeout, a dropped connection), a 5xx or a 429 may pass: whether the money moved is then not
    /// known, and the caller asks (<see cref="LookupAsync"/>) before trying again.
    /// </summary>
    private async Task PostOperationAsync(ProviderAccount account, string path, JsonObject body, string what, string transactionId, CancellationToken ct)
    {
        using var message = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/{path}") { Content = JsonContent.Create(body) };
        message.Headers.Authorization = new AuthenticationHeaderValue("Token", account.SecretKey);
        var (status, text) = await SendAsync(message, what, transactionId, ct);
        if (status is >= 200 and < 300)
        {
            var json = TryParse(text);
            if (json is { ValueKind: JsonValueKind.Object } obj && Field(obj, "success") == "false")
            {
                var why = Field(obj, "data.message");
                logger.LogWarning("Paymob would not make a {What} of {Transaction}: {Why}", what, transactionId, why);
                throw new PaymentProviderException($"Paymob would not make the {what}{(why.Length > 0 ? $": {why}" : ".")}");
            }
            return;
        }

        logger.LogWarning("Paymob refused a {What} of {Transaction} ({Status}): {Body}", what, transactionId, status, text);
        var reason = TryParse(text) is { ValueKind: JsonValueKind.Object } refusal
            ? FirstOf(refusal, "detail", "message", "data.message")
            : "";
        throw new PaymentProviderException(
            $"Paymob refused the {what} ({status}){(reason.Length > 0 ? $": {reason}" : ".")}",
            transient: status is >= 500 or 408 or 429);
    }

    /// <summary>Sends, turning no answer into a transient failure; the caller's own cancellation stays a cancellation.</summary>
    private async Task<(int Status, string Body)> SendAsync(HttpRequestMessage message, string what, string transactionId, CancellationToken ct)
    {
        try
        {
            using var response = await http.SendAsync(message, ct);
            return ((int)response.StatusCode, await response.Content.ReadAsStringAsync(ct));
        }
        catch (Exception ex) when (ex is HttpRequestException || (ex is TaskCanceledException && !ct.IsCancellationRequested))
        {
            logger.LogWarning(ex, "Paymob did not answer a {What} of {Transaction}", what, transactionId);
            throw new PaymentProviderException($"Paymob did not answer the {what}.", transient: true, ex);
        }
    }

    // Paymob's Transaction Inquiry API: the business's API key buys a bearer token (good for an hour),
    // which reads a transaction by its id, or the one a checkout ended in by our reference (the
    // intention's special_reference, which Paymob keeps as the order's merchant_order_id)

    public async Task<ProviderTransaction?> LookupAsync(ProviderAccount account, string transactionId, CancellationToken ct)
        => await InquireAsync(account, () => new HttpRequestMessage(HttpMethod.Get, $"{BaseUrl}/api/acceptance/transactions/{Uri.EscapeDataString(transactionId)}"), transactionId, ct);

    public async Task<ProviderTransaction?> FindByReferenceAsync(ProviderAccount account, string ourReference, CancellationToken ct)
        => await InquireAsync(account, () => new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/api/ecommerce/orders/transaction_inquiry")
        {
            Content = JsonContent.Create(new JsonObject { ["merchant_order_id"] = ourReference }),
        }, ourReference, ct);

    private async Task<ProviderTransaction?> InquireAsync(ProviderAccount account, Func<HttpRequestMessage> request, string what, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(account.ApiKey)) return null;
        for (var attempt = 0; attempt < 2; attempt++)
        {
            var token = await TokenAsync(account.ApiKey, ct);
            using var message = request();
            message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var (status, text) = await SendAsync(message, "lookup", what, ct);
            if (status == 401 && attempt == 0)
            {
                // The token ran out early, or the key changed: a fresh one, once
                Tokens.TryRemove(TokenKey(account.ApiKey), out _);
                continue;
            }
            if (status == 404) return null;
            if (status is < 200 or >= 300)
            {
                logger.LogWarning("Paymob would not say how {What} stands ({Status}): {Body}", what, status, text);
                throw new PaymentProviderException($"Paymob would not say how the payment stands ({status}).", transient: status is >= 500 or 408 or 429);
            }
            return TryParse(text) is { ValueKind: JsonValueKind.Object } obj && Field(obj, "id").Length > 0 ? Read(obj) : null;
        }
        return null;
    }

    /// <summary>A transaction as Paymob writes it, in a callback or an inquiry.</summary>
    internal static ProviderTransaction Read(JsonElement obj)
    {
        static decimal Money(JsonElement o, string path)
            => decimal.TryParse(Field(o, path), NumberStyles.Number, CultureInfo.InvariantCulture, out var cents) ? cents / 100m : 0m;
        var amount = Money(obj, "amount_cents");
        var refunded = Money(obj, "refunded_amount_cents");
        var error = Field(obj, "data.message");
        var order = Field(obj, "order.id");
        if (order.Length == 0) order = Field(obj, "order");
        return new ProviderTransaction(
            Field(obj, "id"),
            order.Length == 0 ? null : order,
            Success: Field(obj, "success") == "true",
            Pending: Field(obj, "pending") == "true",
            IsAuth: Field(obj, "is_auth") == "true",
            Captured: Field(obj, "is_captured") == "true" || Money(obj, "captured_amount") > 0,
            Voided: Field(obj, "is_voided") == "true",
            Refunded: Field(obj, "is_refunded") == "true" && refunded >= amount,
            Amount: amount,
            Error: error.Length == 0 ? null : error);
    }

    /// <summary>Bearer tokens by API key (hashed), each kept a little under Paymob's hour.</summary>
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, (string Token, DateTime Until)> Tokens = new();

    private static string TokenKey(string apiKey) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(apiKey)));

    private async Task<string> TokenAsync(string apiKey, CancellationToken ct)
    {
        var key = TokenKey(apiKey);
        if (Tokens.TryGetValue(key, out var cached) && cached.Until > DateTime.UtcNow) return cached.Token;

        using var message = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/api/auth/tokens") { Content = JsonContent.Create(new JsonObject { ["api_key"] = apiKey }) };
        var (status, text) = await SendAsync(message, "sign-in", "the API key", ct);
        var token = status is >= 200 and < 300 && TryParse(text) is { ValueKind: JsonValueKind.Object } obj ? Field(obj, "token") : "";
        if (token.Length == 0)
        {
            logger.LogWarning("Paymob would not take the business's API key ({Status})", status);
            throw new PaymentProviderException("Paymob would not take the API key; check it in the payment settings.", transient: status is >= 500 or 408 or 429);
        }
        Tokens[key] = (token, DateTime.UtcNow.AddMinutes(50));
        return token;
    }

    private static JsonElement? TryParse(string text)
    {
        try
        {
            return string.IsNullOrWhiteSpace(text) ? null : JsonDocument.Parse(text).RootElement.Clone();
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string FirstOf(JsonElement obj, params string[] paths)
        => paths.Select(path => Field(obj, path)).FirstOrDefault(v => v.Length > 0) ?? "";

    private static (string First, string Last) SplitName(string name)
    {
        var parts = name.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        return parts.Length switch
        {
            0 => ("Guest", "NA"),
            1 => (parts[0], "NA"),
            _ => (parts[0], parts[1]),
        };
    }
}
