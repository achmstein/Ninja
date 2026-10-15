#nullable enable
using Ninja.Sales.API.Application.Deliveries;
using Ninja.Sales.API.Application.IntegrationEvents.EventHandling;
using Ninja.Sales.API.Payments;

namespace Ninja.Sales.API.Application.Queries;

/// <summary>
/// The money of some settled tickets and some credit notes, worked out one way
/// for every report that shows it — the range report, a shift's X and Z, a
/// cashier's line — so they agree on what net sales is.
/// </summary>
public sealed record SalesFigures
{
    /// <summary>Σ the settled tickets' totals: what customers paid, VAT, service and delivery in, before any refund.</summary>
    public decimal GrossSales { get; init; }

    /// <summary>Credit notes, all tenders.</summary>
    public decimal Refunds { get; init; }

    /// <summary>
    /// The VAT inside the credit notes: each gives back its sale's VAT in
    /// proportion, Amount × the sale's Vat / Total.
    /// </summary>
    public decimal RefundVat { get; init; }

    /// <summary>VAT on the settled tickets, included in the prices or added on top.</summary>
    public decimal Vat { get; init; }

    /// <summary>The part of <see cref="Vat"/> added on top of the prices; zero where prices include it.</summary>
    public decimal VatAdded { get; init; }

    /// <summary>Money taken off whole bills at the till (a percent or a fixed amount).</summary>
    public decimal BillDiscounts { get; init; }

    /// <summary>Money taken off single lines.</summary>
    public decimal LineDiscounts { get; init; }

    /// <summary>Loyalty points and promo codes redeemed: the negative lines, as a positive number.</summary>
    public decimal LoyaltyAndPromo { get; init; }

    /// <summary>Gross sales less refunds.</summary>
    public decimal NetSales => GrossSales - Refunds;

    /// <summary>
    /// Net sales without the VAT inside it — VAT is owed to the state, not
    /// earned: NetSales − (Vat − RefundVat).
    /// </summary>
    public decimal NetSalesExVat => NetSales - (Vat - RefundVat);

    /// <summary>Everything taken off, as one positive number.</summary>
    public decimal Discounts => BillDiscounts + LineDiscounts + LoyaltyAndPromo;

    /// <param name="refundedSales">The VAT and total of each refunded ticket, by id; a refund whose ticket is missing carries no VAT.</param>
    public static SalesFigures Of(
        IEnumerable<Ticket> tickets,
        IEnumerable<Refund> refunds,
        IReadOnlyDictionary<int, (decimal Vat, decimal Total)> refundedSales)
    {
        var settled = tickets.ToList();
        var given = refunds.ToList();

        return new SalesFigures
        {
            GrossSales = settled.Sum(t => t.Total),
            Refunds = given.Sum(r => r.Amount),
            RefundVat = given.Sum(r => RefundVatOf(r, refundedSales)),
            Vat = settled.Sum(t => t.Vat),
            VatAdded = settled.Where(t => !t.VatIncluded).Sum(t => t.Vat),
            BillDiscounts = settled.Sum(t => t.Discount),
            LineDiscounts = settled.Sum(t => t.Lines.Sum(l => l.Discount)),
            LoyaltyAndPromo = settled.Sum(t => t.Lines.Where(l => l.Total < 0).Sum(l => -l.Total)),
        };
    }

    /// <summary>The VAT a credit note gives back: its share of its sale's.</summary>
    public static decimal RefundVatOf(Refund refund, IReadOnlyDictionary<int, (decimal Vat, decimal Total)> refundedSales)
        => refundedSales.TryGetValue(refund.TicketId, out var sale) && sale.Total > 0
            ? Math.Round(refund.Amount * sale.Vat / sale.Total, 2, MidpointRounding.AwayFromZero)
            : 0m;

    /// <summary>
    /// The settled tickets' payments by tender, cash net of the change handed
    /// back (only cash is ever overpaid), so the tenders add up to the tickets'
    /// totals. Tendered keeps what was handed over, for the drawer.
    /// </summary>
    public static List<TenderTotal> Tenders(IEnumerable<Ticket> tickets)
    {
        var settled = tickets.ToList();
        var change = settled.Sum(t => t.ChangeGiven);

        return settled
            .SelectMany(t => t.Payments)
            .GroupBy(p => p.Tender)
            .Select(g =>
            {
                var tendered = g.Sum(p => p.Amount);
                var amount = g.Key == PaymentTender.Cash ? tendered - change : tendered;
                return new TenderTotal(g.Key.ToString(), amount, g.Count(), tendered);
            })
            .OrderBy(t => t.Tender)
            .ToList();
    }

    /// <summary>Where a sale came from: a platform's order, the business's own delivery, a room, a table, or the counter.</summary>
    public static string ChannelOf(Ticket ticket)
    {
        if (ticket.Platform is not null)
            return "Platform";
        if (ticket.CollectsAtDoor || ticket.Lines.Any(l => l.IsDeliveryFee))
            return "Delivery";
        return ticket.Type switch
        {
            TicketType.Room => "Room",
            TicketType.Table => "Table",
            _ => "Counter",
        };
    }
}

/// <summary>What a name on a report stands for: a person at the till, or the system settling or voiding by itself.</summary>
public static class CashierKinds
{
    public const string Staff = "Staff";
    public const string Platform = "Platform";
    public const string Online = "Online";
    public const string Rider = "Rider";
    public const string Automatic = "Automatic";

    /// <summary>The kind behind a name the system records its own work under; Staff for anyone else.</summary>
    public static string Of(string name) => name switch
    {
        OrderStatusChangedToConfirmedIntegrationEventHandler.PlatformSettledBy => Platform,
        SettlePaidOnlineCommandHandler.SettledBy => Online,
        DeliveryCashier.RiderSettledBy => Rider,
        OrderStatusChangedToCancelledIntegrationEventHandler.VoidedBy => Automatic,
        _ => Staff,
    };
}
