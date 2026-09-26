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
/// Paymob's Intention API and Unified Checkout, on the café's own account:
/// an intention is created server-side with the café's secret key (amounts
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
        if (account.PublicKey is null) throw new PaymentProviderException("The café's Paymob public key is not set.");

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

        return new CallbackOutcome(
            Field(obj, "order.id"),
            merchantReference.Length == 0 ? null : merchantReference,
            Field(obj, "id"),
            Field(obj, "success") == "true",
            Field(obj, "pending") == "true",
            cents / 100m,
            error.Length == 0 ? null : error);
    }

    /// <summary>Paymob's HMAC: the signed fields' values concatenated in order, HMAC-SHA512 with the café's secret, lower-case hex.</summary>
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

    public async Task RefundAsync(ProviderAccount account, string transactionId, decimal amount, CancellationToken ct)
    {
        var body = new JsonObject { ["transaction_id"] = transactionId, ["amount_cents"] = Cents(amount) };
        using var message = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/api/acceptance/void_refund/refund") { Content = JsonContent.Create(body) };
        message.Headers.Authorization = new AuthenticationHeaderValue("Token", account.SecretKey);
        using var response = await http.SendAsync(message, ct);
        if (!response.IsSuccessStatusCode)
        {
            var text = await response.Content.ReadAsStringAsync(ct);
            logger.LogWarning("Paymob refused a refund of {Transaction} ({Status}): {Body}", transactionId, (int)response.StatusCode, text);
            throw new PaymentProviderException($"Paymob refused the refund ({(int)response.StatusCode}).");
        }
    }

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
