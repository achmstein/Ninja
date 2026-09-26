#nullable enable
using Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;

namespace Ninja.Sales.API.Payments;

/// <summary>One line of the bill as a paying guest sees it.</summary>
/// <param name="Share">Its part of the total (discount, service and VAT taken through).</param>
/// <param name="Claimed">Paid for, or being paid for, by someone: not selectable.</param>
/// <param name="IsMine">Ordered by this guest.</param>
public sealed record PayLineView(int Id, LocalizedText Description, LocalizedText? Details, decimal Qty, decimal Total, decimal Share, bool Claimed, bool IsMine);

/// <summary>One share paid or in progress, as the table sees it: the name the payer gave and how much.</summary>
/// <param name="Key">The caller's own payment only, so they can go back to its checkout or cancel it; null for anyone else's.</param>
public sealed record PayShareView(string? PayerName, decimal Amount, string Status, DateTime? PaidAt, bool IsMine, Guid? Key = null);

/// <summary>How the café takes payments, as the guest's phone needs it.</summary>
public sealed record PayOptionsView(
    bool Ready,
    string Currency,
    string FeeMode,
    decimal FeePercent,
    decimal FeeFixed,
    bool AllowItems,
    bool AllowEqual,
    bool AllowCustom,
    bool Card,
    bool Wallet,
    bool ApplePay,
    bool Simulated = false);

/// <summary>
/// A bill as a guest pays it: what is on it, what is paid, what is held,
/// what is left, and how the café lets them split it. The phone polls it
/// while the sheet is open, so every guest sees the others' shares land.
/// </summary>
/// <param name="CanPay">Whether a payment can start now; <paramref name="Why"/> says why not.</param>
/// <param name="People">Who sat at the table, where the bill knows (a room's party); a start for dividing equally.</param>
public sealed record PayView(
    int TicketId,
    int? PlaceId,
    LocalizedText? LocationName,
    string Status,
    IReadOnlyList<PayLineView> Lines,
    decimal Subtotal,
    decimal Discount,
    decimal ServiceCharge,
    decimal Vat,
    decimal Total,
    decimal Paid,
    decimal Held,
    decimal Remaining,
    IReadOnlyList<PayShareView> Shares,
    int? People,
    PayOptionsView Options,
    bool CanPay,
    string? Why);

/// <summary>One payment, as the guest's return page follows it.</summary>
public sealed record PaymentStatusView(Guid Key, int TicketId, string Status, decimal Amount, decimal Fee, decimal Charged, string Currency, string? FailureReason, bool BillClosed);

/// <summary>An online payment on a bill, as the till lists it.</summary>
public sealed record OnlinePaymentView(Guid Key, string Mode, string? PayerName, decimal Amount, decimal Fee, string Status, DateTime CreatedAt, DateTime? PaidAt, string? TransactionId, DateTime? RefundedAt);

/// <summary>The café's payment settings as the owner edits them; secrets only as whether they are set.</summary>
public sealed record PaymentSettingsView(
    string Provider,
    string Currency,
    bool SecretKeySet,
    string? SecretKeyHint,
    string? PublicKey,
    bool HmacSecretSet,
    int? CardIntegrationId,
    int? WalletIntegrationId,
    int? ApplePayIntegrationId,
    FeeMode FeeMode,
    decimal FeePercent,
    decimal FeeFixed,
    bool AllowItems,
    bool AllowEqual,
    bool AllowCustom,
    bool Ready,
    bool CanKeepSecrets,
    string CallbackUrl,
    bool Simulated = false)
{
    /// <param name="simulated">A demo taking pretend payments until a real account is entered.</param>
    public static PaymentSettingsView From(PaymentSettings s, bool canKeepSecrets, string callbackUrl, bool simulated = false) => new(
        s.Provider, s.Currency, s.SealedSecretKey is not null, s.SecretKeyHint, s.PublicKey, s.SealedHmacSecret is not null,
        s.CardIntegrationId, s.WalletIntegrationId, s.ApplePayIntegrationId, s.FeeMode, s.FeePercent, s.FeeFixed,
        s.AllowItems, s.AllowEqual, s.AllowCustom, s.IsReady, canKeepSecrets, callbackUrl, simulated);
}

public static class PayViews
{
    public static PayOptionsView Options(PaymentSettings s, bool simulated = false) => new(
        s.IsReady || simulated, s.Currency, s.FeeMode.ToString(), s.FeeMode == FeeMode.Guest ? s.FeePercent : 0, s.FeeMode == FeeMode.Guest ? s.FeeFixed : 0,
        s.AllowItems, s.AllowEqual, s.AllowCustom,
        s.CardIntegrationId is not null || simulated, s.WalletIntegrationId is not null, s.ApplePayIntegrationId is not null, simulated);

    public static PayView Build(Ticket ticket, Bill bill, IReadOnlyList<OnlinePayment> payments, PaymentSettings settings, bool enabled, string? userId, string? guestId, DateTime now, bool simulated = false)
    {
        var claimed = OnlineShares.ClaimedLines(payments, now);
        var paid = OnlineShares.Paid(payments);
        var held = payments.Where(p => p.Status == OnlinePaymentStatus.Pending && p.Holds(now)).Sum(p => p.Amount);
        bool Mine(string? payerId) => payerId is not null && (payerId == userId || payerId == guestId);

        string? why = null;
        if (!enabled) why = "off";
        else if (!settings.IsReady && !simulated) why = "not-set-up";
        else if (ticket.Status != TicketStatus.Open) why = "closed";
        else if (ticket.HasSession && ticket.SessionEndedAt is null) why = "clock-running";
        else if (ticket.Lines.Count == 0) why = "empty";
        else if (OnlineShares.Remaining(bill.Total, payments, now) <= 0) why = held > 0 ? "being-paid" : "paid";

        return new PayView(
            ticket.Id,
            ticket.PlaceId,
            ticket.LocationName,
            ticket.Status.ToString(),
            ticket.Lines
                .Where(l => l.Total != 0)
                .Select(l => new PayLineView(
                    l.Id, l.Description, l.Details, l.Qty, l.Total, OnlineShares.LineShare(l, bill), claimed.Contains(l.Id),
                    (userId is not null && l.CustomerId == userId) || (guestId is not null && l.GuestId == guestId)))
                .ToList(),
            bill.Subtotal, bill.Discount, bill.ServiceCharge, bill.Vat, bill.Total,
            paid, held, OnlineShares.Remaining(bill.Total, payments, now),
            payments
                .Where(p => p.Holds(now))
                .Select(p => new PayShareView(p.PayerName, p.Amount, p.Status.ToString(), p.PaidAt, Mine(p.PayerId), Mine(p.PayerId) ? p.Key : null))
                .ToList(),
            ticket.MemberIds.Count > 1 ? ticket.MemberIds.Count : null,
            Options(settings, simulated),
            why is null,
            why);
    }
}
