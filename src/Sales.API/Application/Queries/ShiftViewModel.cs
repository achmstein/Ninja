#nullable enable
namespace Ninja.Sales.API.Application.Queries;

/// <summary>
/// A shift with its drawer math — the X report while open, the Z report once
/// closed (where <see cref="ExpectedCash"/>/<see cref="OverShort"/> are the
/// frozen verdict).
/// </summary>
public record ShiftView
{
    public int Id { get; init; }
    public int BranchId { get; init; }
    public string Status { get; init; } = string.Empty;
    public DateTime OpenedAt { get; init; }
    public string OpenedBy { get; init; } = string.Empty;
    public decimal OpeningFloat { get; init; }
    public DateTime? ClosedAt { get; init; }
    public string? ClosedBy { get; init; }
    public decimal? ClosingCount { get; init; }
    public decimal? ExpectedCash { get; init; }
    public decimal? OverShort { get; init; }
    public List<CashMovementView> Movements { get; init; } = [];
    public int TicketsSettled { get; init; }
    /// <summary>
    /// Σ the shift's settled tickets' totals: gross sales, before refunds.
    /// The same figure as <see cref="GrossSales"/>; net sales is <see cref="NetSales"/>.
    /// </summary>
    public decimal SalesTotal { get; init; }
    /// <inheritdoc cref="SalesFigures.GrossSales"/>
    public decimal GrossSales { get; init; }
    /// <summary><see cref="GrossSales"/> less <see cref="RefundsTotal"/>: what the shift sold and kept.</summary>
    public decimal NetSales { get; init; }
    /// <inheritdoc cref="SalesFigures.NetSalesExVat"/>
    public decimal NetSalesExVat { get; init; }
    /// <summary>VAT on the shift's settled tickets, included or added.</summary>
    public decimal Vat { get; init; }
    /// <inheritdoc cref="SalesFigures.VatAdded"/>
    public decimal VatAdded { get; init; }
    /// <inheritdoc cref="SalesFigures.RefundVat"/>
    public decimal RefundVat { get; init; }
    /// <summary>Bill discounts, line discounts and loyalty lines on the shift's tickets, as a positive number.</summary>
    public decimal Discounts { get; init; }
    /// <inheritdoc cref="SalesFigures.BillDiscounts"/>
    public decimal BillDiscounts { get; init; }
    /// <inheritdoc cref="SalesFigures.LineDiscounts"/>
    public decimal LineDiscounts { get; init; }
    /// <inheritdoc cref="SalesFigures.LoyaltyAndPromo"/>
    public decimal LoyaltyAndPromo { get; init; }
    /// <summary>
    /// The settled tickets' payments by tender. Cash is net of the change
    /// handed back, so the tenders add up to <see cref="SalesTotal"/>; what was
    /// handed over is each row's Tendered, and <see cref="CashTendered"/>.
    /// </summary>
    public List<TenderTotal> TenderTotals { get; init; } = [];
    /// <summary>Cash handed over at settle, before the change went back: the drawer's side of the cash.</summary>
    public decimal CashTendered { get; init; }
    public decimal ChangeGiven { get; init; }
    /// <summary>Credit notes issued during the shift, all tenders.</summary>
    public decimal RefundsTotal { get; init; }
    /// <summary>The part of those that left the drawer as cash.</summary>
    public decimal CashRefunds { get; init; }
    public decimal PayInsTotal { get; init; }
    public decimal PayOutsTotal { get; init; }
    /// <summary>
    /// Money taken against customers' tabs during the shift, all tenders.
    /// Not sales — those were counted when the bills went on account — so
    /// it sits beside <see cref="SalesTotal"/>, never inside it.
    /// </summary>
    public decimal TabPaymentsTotal { get; init; }
    /// <summary>The part of those that went into the drawer as cash.</summary>
    public decimal CashTabPayments { get; init; }
    public List<TenderTotal> TabPaymentTenderTotals { get; init; } = [];
    /// <summary>The slips themselves, newest first.</summary>
    public List<TabPaymentView> TabPayments { get; init; } = [];
    /// <summary>
    /// The drawer expectation worked out from the shift's rows now:
    /// float + cash tendered − change − cash refunds + cash tab payments +
    /// pay-ins − pay-outs. Once closed it equals <see cref="ExpectedCash"/>,
    /// unless a sale rung up offline during the shift reached it after the
    /// close (<see cref="LateCash"/>).
    /// </summary>
    public decimal ExpectedInDrawer { get; init; }
    /// <summary>
    /// Cash from sales rung up offline while the shift was open that reached
    /// the server after it closed: in the drawer when it was counted, but not
    /// in the frozen <see cref="ExpectedCash"/>. Zero while open.
    /// </summary>
    public decimal LateCash { get; init; }
    /// <summary>
    /// The count against the expectation with the late cash in it — the
    /// over/short the drawer really had. Null while open; equals
    /// <see cref="OverShort"/> when there is no late cash.
    /// </summary>
    public decimal? AdjustedOverShort { get; init; }
}

/// <summary>A tab payment slip: money a customer handed the till against their tab.</summary>
public record TabPaymentView(
    int Id,
    int Number,
    int BranchId,
    string CustomerId,
    string? CustomerName,
    string Tender,
    decimal Amount,
    string RecordedBy,
    DateTime RecordedAt,
    int? ShiftId);

public record CashMovementView(string Type, decimal Amount, string Reason, string RecordedBy, DateTime RecordedAt, string Kind = "Other", int? EmployeeId = null, string? EmployeeName = null,
    int? SupplierId = null, string? SupplierName = null, int? PartnerId = null, string? PartnerName = null, int? CategoryId = null);

/// <param name="Amount">
/// What the tender paid towards the bills. Cash is net of the change handed
/// back, so the tenders of the settled tickets add up to their totals.
/// </param>
/// <param name="Count">Payment rows.</param>
/// <param name="Tendered">What was handed over: for cash, before the change went back; the same as Amount otherwise.</param>
public record TenderTotal(string Tender, decimal Amount, int Count, decimal Tendered = 0);

/// <summary>
/// Settled sales over a caller-chosen window — the business-day report when
/// the caller passes the branch's day window (the SPA fetches the window from
/// Tenant.API; Sales never asks another service, per D5b).
/// </summary>
public record RangeReport
{
    public DateTime From { get; init; }
    public DateTime To { get; init; }
    public int TicketsSettled { get; init; }
    /// <summary>
    /// Σ ticket totals — what customers paid, before refunds: the same figure
    /// as <see cref="GrossSales"/>. Obsolete: kept for the screens that read it;
    /// "net sales" is <see cref="NetSales"/>.
    /// </summary>
    public decimal Net { get; init; }
    /// <inheritdoc cref="SalesFigures.GrossSales"/>
    public decimal GrossSales { get; init; }
    /// <summary>
    /// Net sales: <see cref="GrossSales"/> less the <see cref="Refunds"/> issued
    /// in the window, whenever the refunded sale was. VAT is still inside it.
    /// </summary>
    public decimal NetSales { get; init; }
    /// <inheritdoc cref="SalesFigures.NetSalesExVat"/>
    public decimal NetSalesExVat { get; init; }
    /// <summary>Bill discounts, line discounts and loyalty (negative) lines, as a positive number.</summary>
    public decimal Discounts { get; init; }
    /// <inheritdoc cref="SalesFigures.BillDiscounts"/>
    public decimal BillDiscounts { get; init; }
    /// <inheritdoc cref="SalesFigures.LineDiscounts"/>
    public decimal LineDiscounts { get; init; }
    /// <inheritdoc cref="SalesFigures.LoyaltyAndPromo"/>
    public decimal LoyaltyAndPromo { get; init; }
    public decimal ChangeGiven { get; init; }
    /// <summary>
    /// The settled tickets' payments by tender. Cash is net of the change
    /// handed back, so the tenders add up to <see cref="GrossSales"/>; what was
    /// handed over is each row's Tendered, and <see cref="CashTendered"/>.
    /// </summary>
    public List<TenderTotal> TenderTotals { get; init; } = [];
    /// <summary>Cash handed over at settle, before the change went back.</summary>
    public decimal CashTendered { get; init; }
    /// <summary>Settled tickets by type (Room, Table, Counter); delivery and platform bills are Counter here, see <see cref="ByChannel"/>.</summary>
    public List<TypeTotal> ByType { get; init; } = [];
    /// <summary>Settled tickets by where the sale came from: Counter, Delivery, Platform, Room or Table.</summary>
    public List<ChannelTotal> ByChannel { get; init; } = [];
    /// <summary>
    /// Menu money of the settled tickets: the lines (line discounts, loyalty
    /// and promo lines and the delivery fee in them), before the bill
    /// discount, service charge and VAT.
    /// </summary>
    public decimal Subtotal { get; init; }
    public decimal ServiceCharge { get; init; }
    /// <summary>VAT on the settled tickets, included in the prices or added on top.</summary>
    public decimal Vat { get; init; }
    /// <inheritdoc cref="SalesFigures.VatAdded"/>
    public decimal VatAdded { get; init; }
    /// <inheritdoc cref="SalesFigures.RefundVat"/>
    public decimal RefundVat { get; init; }
    /// <summary>
    /// What customers paid for delivery on the settled tickets: the fee lines
    /// with their share of the bill discount and VAT. Inside <see cref="GrossSales"/>,
    /// never among the items.
    /// </summary>
    public decimal DeliveryFees { get; init; }
    /// <summary>Credit notes issued in the window, all tenders — subtracted in <see cref="NetSales"/>.</summary>
    public decimal Refunds { get; init; }
    public int RefundCount { get; init; }
    /// <summary>Tab payments taken in the window, all tenders — beside the sales, never inside them.</summary>
    public decimal TabPayments { get; init; }
    public int TabPaymentCount { get; init; }
    public List<TenderTotal> TabPaymentTenderTotals { get; init; } = [];
    /// <summary>
    /// Menu money of the settled tickets' lines added from a suggestion ("goes
    /// well with"), line discounts off, before service charge and VAT — part
    /// of <see cref="Subtotal"/>, not beside it.
    /// </summary>
    public decimal SuggestedSales { get; init; }
    /// <summary>How many settled lines a suggestion added.</summary>
    public int SuggestedLines { get; init; }
}

/// <param name="Net">Σ the tickets' totals, before refunds (gross).</param>
public record TypeTotal(string Type, int Count, decimal Net);

/// <param name="Channel">Counter, Delivery (the business's own), Platform (Talabat and the like), Room or Table.</param>
/// <param name="Gross">Σ the tickets' totals, before refunds.</param>
public record ChannelTotal(string Channel, int Count, decimal Gross);

/// <summary>
/// Settled sales per business day: a day runs from the branch's day start to
/// the same time the next day, in the zone asked for.
/// </summary>
public record DailyReport
{
    public DateTime From { get; init; }
    public DateTime To { get; init; }
    /// <summary>The IANA zone the days are in.</summary>
    public string TimeZone { get; init; } = string.Empty;
    /// <summary>When each business day starts, local time ("HH:mm").</summary>
    public string DayStart { get; init; } = "00:00";
    /// <summary>Every business day the window touches, oldest first, empty days included.</summary>
    public List<DailySales> Days { get; init; } = [];
}

/// <param name="Date">The business day: the date it started on.</param>
/// <param name="Tickets">Tickets settled that day.</param>
/// <param name="GrossSales">Σ their totals.</param>
/// <param name="Refunds">Credit notes issued that day, whenever the sale was.</param>
/// <param name="NetSales">GrossSales less Refunds — the same net sales as the range report's.</param>
/// <param name="RefundCount">How many credit notes.</param>
public record DailySales(DateOnly Date, int Tickets, decimal GrossSales, decimal Refunds, decimal NetSales, int RefundCount);

/// <summary>
/// The same window cut four ways: by the hour and weekday the bills were
/// settled (in the caller's clock), by who settled them, and by what was
/// sold. Voids are counted beside the cashier who gave them, refunds beside
/// who issued them and netted out of the items they gave back.
/// </summary>
public record BreakdownReport
{
    public DateTime From { get; init; }
    public DateTime To { get; init; }
    /// <summary>
    /// Minutes the caller's clock is ahead of UTC, when the hours were read at
    /// a fixed offset; ignored when <see cref="TimeZone"/> is set.
    /// </summary>
    public int OffsetMinutes { get; init; }
    /// <summary>The IANA zone the hours and weekdays are in, each bill at its own moment's offset; null for a fixed offset.</summary>
    public string? TimeZone { get; init; }
    /// <summary>Settled bills by the hour they settled; Net is Σ their totals, before refunds.</summary>
    public List<HourTotal> ByHour { get; init; } = [];
    /// <summary>Settled bills by the weekday they settled; Net is Σ their totals, before refunds.</summary>
    public List<WeekdayTotal> ByWeekday { get; init; } = [];
    public List<CashierTotal> ByCashier { get; init; } = [];
    /// <summary>
    /// What sold, biggest first - every item, so the back office can fold the
    /// list into categories through CatalogItemId. The delivery fee is not an
    /// item; the loyalty and promo lines are inside each item's Amount.
    /// </summary>
    public List<ItemTotal> ByItem { get; init; } = [];
    /// <summary>
    /// Settled bills by who took the order that opened them (the ticket's
    /// TakenBy), biggest first: a call centre's agents, who settle nothing at
    /// the branch, show here. Empty when no bill names a taker.
    /// </summary>
    public List<TakerTotal> ByTaker { get; init; } = [];
}

/// <param name="Count">Settled bills whose order this person took.</param>
/// <param name="Net">Σ those bills' totals, before refunds.</param>
public record TakerTotal(string Name, int Count, decimal Net);

public record HourTotal(int Hour, int Count, decimal Net);

/// <summary>0 is Sunday, like <see cref="DayOfWeek"/>.</summary>
public record WeekdayTotal(int Weekday, int Count, decimal Net);

/// <param name="Name">Who settled, voided or refunded; for the system's own work, the name it goes by (see Kind).</param>
/// <param name="Count">Bills they settled.</param>
/// <param name="Net">Σ those bills' totals, before refunds — the same as GrossSales; kept for the screens that read it.</param>
/// <param name="Discounts">Everything taken off those bills, as a positive number.</param>
/// <param name="Voids">Open bills they voided.</param>
/// <param name="Refunds">Credit notes they issued, all tenders.</param>
/// <param name="Kind">
/// "Staff" for a person at the till; otherwise the system settling or voiding
/// by itself: "Platform" (a delivery platform's order, settled to it),
/// "Online" (paid from a phone), "Rider" (a delivery's cash handed in) or
/// "Automatic" (a bill voided or refunded because its order was cancelled).
/// </param>
/// <param name="GrossSales">Σ the bills' totals.</param>
/// <param name="NetSales">GrossSales less the refunds they issued.</param>
/// <param name="NetSalesExVat">NetSales without the VAT inside it.</param>
public record CashierTotal(
    string Name,
    int Count,
    decimal Net,
    decimal Discounts,
    int Voids,
    decimal Refunds,
    string Kind = CashierKinds.Staff,
    decimal GrossSales = 0,
    decimal NetSales = 0,
    decimal NetSalesExVat = 0,
    decimal BillDiscounts = 0,
    decimal LineDiscounts = 0,
    decimal LoyaltyAndPromo = 0,
    decimal VatAdded = 0);

/// <param name="Qty">Units sold on the window's settled bills.</param>
/// <param name="Amount">
/// What customers paid for them: the lines with their share of the bill's
/// money off (bill discount, loyalty and promo), service and VAT. Refunds are
/// not taken off; see NetAmount.
/// </param>
/// <param name="CatalogItemId">The catalog item, when the lines carried one; null groups as uncategorised.</param>
/// <param name="MenuAmount">The same lines at menu money: line discounts off, before the bill's figures.</param>
/// <param name="RefundedQty">Units given back by credit notes issued in the window, whenever they sold.</param>
/// <param name="RefundedAmount">What those credit notes gave back for them.</param>
/// <param name="NetQty">Qty less RefundedQty.</param>
/// <param name="NetAmount">Amount less RefundedAmount.</param>
public record ItemTotal(
    LocalizedText Description,
    decimal Qty,
    decimal Amount,
    int Tickets,
    int? CatalogItemId = null,
    decimal MenuAmount = 0,
    decimal RefundedQty = 0,
    decimal RefundedAmount = 0,
    decimal NetQty = 0,
    decimal NetAmount = 0);

/// <summary>
/// What an item is bought with: of the settled tickets that had it, how many
/// also had each other catalog item, most often first.
/// </summary>
/// <param name="TicketsWithItem">Settled tickets in the window that had the item.</param>
public record ItemPairsReport(int CatalogItemId, int TicketsWithItem, List<ItemPair> Pairs);

/// <param name="Together">Tickets that had both.</param>
/// <param name="Share">Together over the tickets that had the item, 0 to 1.</param>
public record ItemPair(int CatalogItemId, int Together, decimal Share);
