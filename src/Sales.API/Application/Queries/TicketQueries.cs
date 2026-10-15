#nullable enable
using Ninja.Sales.Domain.AggregatesModel.TabPaymentAggregate;
using Ninja.Sales.Infrastructure;

namespace Ninja.Sales.API.Application.Queries;

public interface ITicketQueries
{
    Task<IEnumerable<TicketSummary>> GetOpenTicketsAsync(int branchId);

    /// <summary>
    /// Settled bills for the branch, newest receipt first — the way back to
    /// a bill after it left the floor. A receipt number narrows to that one.
    /// </summary>
    Task<IEnumerable<SettledTicketSummary>> GetSettledTicketsAsync(int branchId, int pageIndex, int pageSize, int? receiptNumber);

    Task<TicketDetail?> GetTicketAsync(int ticketId);

    /// <summary>
    /// The ticket a confirmed order's lines landed on — how the POS routes the
    /// cashier from a just-created counter sale to its settle screen. Null
    /// while the confirmation event is still in flight. Prefers the open
    /// ticket (lines may have been moved), falling back to the newest.
    /// </summary>
    Task<int?> FindTicketIdByOrderAsync(int orderId);

    /// <summary>
    /// Settled sales in [from, to) — tender split, discounts, per-type counts.
    /// The caller picks the window (the branch business day, a shift, a week).
    /// </summary>
    Task<RangeReport> GetRangeReportAsync(int branchId, DateTime from, DateTime to);

    /// <summary>
    /// Settled sales and credit notes per business day: a day starts at
    /// <paramref name="dayStart"/> in <paramref name="zone"/> and runs to the
    /// same time the next day. Every day the window touches is listed.
    /// </summary>
    Task<DailyReport> GetDailyReportAsync(int branchId, DateTime from, DateTime to, TimeZoneInfo zone, TimeOnly dayStart);

    /// <summary>
    /// The window by hour, weekday, cashier and item; hours in
    /// <paramref name="zone"/>, or at a fixed <paramref name="offsetMinutes"/>
    /// when no zone is given.
    /// </summary>
    Task<BreakdownReport> GetBreakdownAsync(int branchId, DateTime from, DateTime to, int offsetMinutes, TimeZoneInfo? zone = null);

    /// <summary>What the item was bought with on the window's settled tickets, most often first.</summary>
    Task<ItemPairsReport> GetItemPairsAsync(int branchId, int catalogItemId, DateTime from, DateTime to);

    /// <summary>The branch's pricing rules, defaults when it never set any.</summary>
    Task<PricingView> GetPricingAsync(int branchId);

    /// <summary>
    /// Closed tickets — settled or voided — newest first, for the back office.
    /// The window is on the moment the ticket closed (SettledAt or VoidedAt);
    /// a receipt number names one bill and ignores the window.
    /// </summary>
    Task<PagedResult<TicketHistoryRow>> GetTicketHistoryAsync(
        int branchId, TicketStatus status, DateTime? from, DateTime? to, int? receiptNumber, int pageIndex, int pageSize);

    /// <summary>
    /// Payments taken on tickets settled in [from, to), newest first. Windowed
    /// on the settle so the page reconciles with <see cref="RangeReport.TenderTotals"/>.
    /// </summary>
    Task<PagedResult<PaymentRow>> GetPaymentsAsync(
        int branchId, DateTime from, DateTime to, PaymentTender? tender, int pageIndex, int pageSize);

    /// <summary>Credit notes issued in [from, to), newest first.</summary>
    Task<PagedResult<RefundSummary>> GetRefundsAsync(int branchId, DateTime from, DateTime to, int pageIndex, int pageSize);

    /// <summary>Tab payment slips taken in [from, to), newest first.</summary>
    Task<PagedResult<TabPaymentView>> GetTabPaymentsAsync(int branchId, DateTime from, DateTime to, int pageIndex, int pageSize);

    /// <summary>One slip, to reprint it.</summary>
    Task<TabPaymentView?> GetTabPaymentAsync(int id);

    /// <summary>
    /// The bills the caller is on — sat in the room, ordered a line, or paid
    /// a share — open ones first, then those settled or voided since
    /// <paramref name="since"/>. Identified by account, or by the guest id
    /// their browser holds. Sums come from the same rules the till bills by.
    /// </summary>
    Task<IEnumerable<BillView>> GetMyBillsAsync(string? userId, string? guestId, DateTime since);
}

public class TicketQueries(SalesContext context) : ITicketQueries
{
    public async Task<IEnumerable<TicketSummary>> GetOpenTicketsAsync(int branchId)
    {
        var tickets = await context.Tickets
            .AsNoTracking()
            .Where(t => t.BranchId == branchId && t.Status == TicketStatus.Open)
            .OrderBy(t => t.OpenedAt)
            .ToListAsync();

        var rules = await RulesForAsync(branchId);

        // Lines auto-include; totals come from the aggregate so the floor
        // and the settle dialog can never disagree on the math
        return tickets.Select(t => new TicketSummary
        {
            Id = t.Id,
            Type = t.Type.ToString(),
            Status = t.Status.ToString(),
            LocationName = t.LocationName,
            SessionId = t.SessionId,
            PlaceId = t.PlaceId,
            PlaceKind = t.PlaceKind,
            Label = t.Label,
            OpenedAt = t.OpenedAt,
            LastActivityAt = t.LastActivityAt,
            LineCount = t.Lines.Count,
            Total = t.GetBill(rules).Total,
            CustomerIds = t.Lines
                .Select(l => l.CustomerId)
                .Where(id => !string.IsNullOrEmpty(id))
                .Distinct()
                .ToList()!,
        });
    }

    public async Task<IEnumerable<SettledTicketSummary>> GetSettledTicketsAsync(int branchId, int pageIndex, int pageSize, int? receiptNumber)
    {
        // Receipts are the index: one per settled ticket, numbered in order
        var receipts = context.Receipts.AsNoTracking().Where(r => r.BranchId == branchId);

        if (receiptNumber is int number)
            receipts = receipts.Where(r => r.Number == number);

        var page = await receipts
            .OrderByDescending(r => r.Number)
            .Skip(Math.Max(0, pageIndex) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var ticketIds = page.Select(r => r.TicketId).ToList();

        var tickets = await context.Tickets
            .AsNoTracking()
            .Where(t => ticketIds.Contains(t.Id))
            .ToListAsync();

        var refunded = await context.Refunds
            .AsNoTracking()
            .Where(r => ticketIds.Contains(r.TicketId))
            .GroupBy(r => r.TicketId)
            .Select(g => new { TicketId = g.Key, Amount = g.Sum(r => r.Amount) })
            .ToDictionaryAsync(x => x.TicketId, x => x.Amount);

        return page
            .Select(r => (Receipt: r, Ticket: tickets.FirstOrDefault(t => t.Id == r.TicketId)))
            .Where(x => x.Ticket is not null)
            .Select(x => new SettledTicketSummary(
                x.Ticket!.Id,
                x.Receipt.Number,
                x.Ticket.Type.ToString(),
                x.Ticket.LocationName,
                x.Ticket.Label,
                x.Ticket.SettledAt ?? x.Receipt.IssuedAt,
                x.Ticket.Total,
                refunded.GetValueOrDefault(x.Ticket.Id),
                x.Ticket.ProvisionalReceiptNumber))
            .ToList();
    }

    public async Task<int?> FindTicketIdByOrderAsync(int orderId)
    {
        var candidates = await context.Tickets
            .AsNoTracking()
            .Where(t => t.Lines.Any(l => l.OrderId == orderId))
            .Select(t => new { t.Id, t.Status })
            .ToListAsync();

        if (candidates.Count == 0)
            return null;

        return (candidates.FirstOrDefault(c => c.Status == TicketStatus.Open) ?? candidates.MaxBy(c => c.Id))!.Id;
    }

    public async Task<RangeReport> GetRangeReportAsync(int branchId, DateTime from, DateTime to)
    {
        // A day is at most a few hundred tickets — load them whole and let
        // the aggregate own the money math, like everywhere else in Sales
        var tickets = await SettledInAsync(branchId, from, to);
        var refunds = await RefundsInAsync(branchId, from, to);
        var refundedSales = await RefundedSalesAsync(refunds);

        var tabPayments = await context.TabPayments
            .AsNoTracking()
            .Where(p => p.BranchId == branchId && p.RecordedAt >= from && p.RecordedAt < to)
            .ToListAsync();

        var suggested = tickets
            .SelectMany(t => t.Lines)
            .Where(l => l.Suggestion != SuggestionSource.None)
            .ToList();

        var figures = SalesFigures.Of(tickets, refunds, refundedSales);

        return new RangeReport
        {
            From = from,
            To = to,
            TicketsSettled = tickets.Count,
            Net = figures.GrossSales,
            GrossSales = figures.GrossSales,
            NetSales = figures.NetSales,
            NetSalesExVat = figures.NetSalesExVat,
            Subtotal = tickets.Sum(t => t.Subtotal),
            ServiceCharge = tickets.Sum(t => t.ServiceCharge),
            Vat = figures.Vat,
            VatAdded = figures.VatAdded,
            RefundVat = figures.RefundVat,
            DeliveryFees = tickets.Sum(t => t.GetPaidShares().DeliveryFeePaid),
            Refunds = figures.Refunds,
            RefundCount = refunds.Count,
            TabPayments = tabPayments.Sum(p => p.Amount),
            TabPaymentCount = tabPayments.Count,
            TabPaymentTenderTotals = ShiftQueries.TenderTotals(tabPayments),
            Discounts = figures.Discounts,
            BillDiscounts = figures.BillDiscounts,
            LineDiscounts = figures.LineDiscounts,
            LoyaltyAndPromo = figures.LoyaltyAndPromo,
            ChangeGiven = tickets.Sum(t => t.ChangeGiven),
            CashTendered = CashTenderedOf(tickets),
            SuggestedSales = suggested.Sum(l => l.Total),
            SuggestedLines = suggested.Count,
            TenderTotals = SalesFigures.Tenders(tickets),
            ByType = tickets
                .GroupBy(t => t.Type)
                .Select(g => new TypeTotal(g.Key.ToString(), g.Count(), g.Sum(t => t.Total)))
                .OrderBy(t => t.Type)
                .ToList(),
            ByChannel = tickets
                .GroupBy(SalesFigures.ChannelOf)
                .Select(g => new ChannelTotal(g.Key, g.Count(), g.Sum(t => t.Total)))
                .OrderBy(c => c.Channel)
                .ToList(),
        };
    }

    public async Task<DailyReport> GetDailyReportAsync(int branchId, DateTime from, DateTime to, TimeZoneInfo zone, TimeOnly dayStart)
    {
        var tickets = await context.Tickets
            .AsNoTracking()
            .Where(t => t.BranchId == branchId
                        && t.Status == TicketStatus.Settled
                        && t.SettledAt >= from && t.SettledAt < to)
            .Select(t => new { SettledAt = t.SettledAt!.Value, t.Total })
            .ToListAsync();

        var refunds = await context.Refunds
            .AsNoTracking()
            .Where(r => r.BranchId == branchId && r.RefundedAt >= from && r.RefundedAt < to)
            .Select(r => new { r.RefundedAt, r.Amount })
            .ToListAsync();

        // The business day an instant belongs to: its local time less the
        // day start, so a sale at 02:00 on a day that starts at 06:00 is the
        // day before's. Each instant at its own offset, so a day across a
        // clock change is still one day.
        DateOnly DayOf(DateTime utc) => DateOnly.FromDateTime(ReportClock.ToLocal(utc, zone) - dayStart.ToTimeSpan());

        var sales = tickets.GroupBy(t => DayOf(t.SettledAt)).ToDictionary(g => g.Key, g => (Count: g.Count(), Gross: g.Sum(t => t.Total)));
        var given = refunds.GroupBy(r => DayOf(r.RefundedAt)).ToDictionary(g => g.Key, g => (Count: g.Count(), Amount: g.Sum(r => r.Amount)));

        var first = DayOf(from);
        var last = DayOf(to.AddTicks(-1));
        var days = new List<DailySales>();
        for (var day = first; day <= last; day = day.AddDays(1))
        {
            var sold = sales.GetValueOrDefault(day);
            var back = given.GetValueOrDefault(day);
            days.Add(new DailySales(day, sold.Count, sold.Gross, back.Amount, sold.Gross - back.Amount, back.Count));
        }

        return new DailyReport
        {
            From = from,
            To = to,
            TimeZone = zone.Id,
            DayStart = dayStart.ToString("HH:mm", System.Globalization.CultureInfo.InvariantCulture),
            Days = days,
        };
    }

    private async Task<List<Ticket>> SettledInAsync(int branchId, DateTime from, DateTime to)
        => await context.Tickets
            .AsNoTracking()
            .Where(t => t.BranchId == branchId
                        && t.Status == TicketStatus.Settled
                        && t.SettledAt >= from && t.SettledAt < to)
            .ToListAsync();

    private async Task<List<Refund>> RefundsInAsync(int branchId, DateTime from, DateTime to)
        => await context.Refunds
            .AsNoTracking()
            .Where(r => r.BranchId == branchId && r.RefundedAt >= from && r.RefundedAt < to)
            .ToListAsync();

    /// <summary>The VAT and total of the sales some credit notes answer, to take their VAT back out.</summary>
    internal static async Task<IReadOnlyDictionary<int, (decimal Vat, decimal Total)>> RefundedSalesAsync(SalesContext context, IEnumerable<Refund> refunds)
    {
        var ids = refunds.Select(r => r.TicketId).Distinct().ToList();
        if (ids.Count == 0)
            return new Dictionary<int, (decimal Vat, decimal Total)>();

        var sales = await context.Tickets
            .AsNoTracking()
            .Where(t => ids.Contains(t.Id))
            .Select(t => new { t.Id, t.Vat, t.Total })
            .ToListAsync();

        return sales.ToDictionary(t => t.Id, t => (t.Vat, t.Total));
    }

    private Task<IReadOnlyDictionary<int, (decimal Vat, decimal Total)>> RefundedSalesAsync(IEnumerable<Refund> refunds)
        => RefundedSalesAsync(context, refunds);

    /// <summary>Cash handed over at settle, before the change went back.</summary>
    internal static decimal CashTenderedOf(IEnumerable<Ticket> tickets)
        => tickets.SelectMany(t => t.Payments).Where(p => p.Tender == PaymentTender.Cash).Sum(p => p.Amount);

    /// <summary>
    /// What one payment kept towards its bill: the change came back out of
    /// the cash, taken from the last cash payment first, so a bill's payments
    /// add up to its total. Any other tender keeps what it paid.
    /// </summary>
    internal static decimal KeptOf(Ticket ticket, int paymentId, decimal amount)
    {
        var change = ticket.ChangeGiven;
        foreach (var cash in ticket.Payments.Where(p => p.Tender == PaymentTender.Cash).OrderByDescending(p => p.Id))
        {
            var back = Math.Min(change, cash.Amount);
            if (cash.Id == paymentId)
                return cash.Amount - back;
            change -= back;
        }
        return amount;
    }

    public async Task<IEnumerable<BillView>> GetMyBillsAsync(string? userId, string? guestId, DateTime since)
    {
        if (userId is null && guestId is null)
            return [];

        // Open bills whatever their age (an unpaid table from last night is
        // still on the customer), and closed ones from the window asked for
        var query = context.Tickets
            .AsNoTracking()
            .Where(t => t.SettledAt == null && t.VoidedAt == null
                || t.SettledAt >= since
                || t.VoidedAt >= since);

        // The same test as Ticket.Involves, in SQL: a member of the room's
        // party, a line of theirs, or a payment of theirs. MemberIds is a
        // stored list, so it is checked in memory below.
        query = userId is not null
            ? query.Where(t => t.MemberIds.Contains(userId)
                || t.Lines.Any(l => l.CustomerId == userId)
                || t.Payments.Any(p => p.CustomerId == userId))
            : query.Where(t => t.Lines.Any(l => l.GuestId == guestId));

        var tickets = await query
            .OrderBy(t => t.SettledAt != null || t.VoidedAt != null)
            .ThenByDescending(t => t.LastActivityAt)
            .ToListAsync();
        if (tickets.Count == 0)
            return [];

        var ids = tickets.Select(t => t.Id).ToList();
        var receipts = await context.Receipts
            .AsNoTracking()
            .Where(r => ids.Contains(r.TicketId))
            .ToDictionaryAsync(r => r.TicketId, r => r.Number);
        var refunded = await context.Refunds
            .AsNoTracking()
            .Where(r => ids.Contains(r.TicketId))
            .GroupBy(r => r.TicketId)
            .Select(g => new { TicketId = g.Key, Amount = g.Sum(r => r.Amount) })
            .ToDictionaryAsync(x => x.TicketId, x => x.Amount);

        var bills = new List<BillView>(tickets.Count);
        foreach (var ticket in tickets)
        {
            var bill = ticket.GetBill(await RulesForAsync(ticket.BranchId));
            bills.Add(new BillView
            {
                Id = ticket.Id,
                Type = ticket.Type.ToString(),
                Status = ticket.Status.ToString(),
                BranchId = ticket.BranchId,
                PlaceId = ticket.PlaceId,
                PlaceKind = ticket.PlaceKind,
                LocationName = ticket.LocationName,
                SessionId = ticket.SessionId,
                SessionEndedAt = ticket.SessionEndedAt,
                OpenedAt = ticket.OpenedAt,
                LastActivityAt = ticket.LastActivityAt,
                SettledAt = ticket.SettledAt,
                VoidedAt = ticket.VoidedAt,
                ReceiptNumber = receipts.TryGetValue(ticket.Id, out var number) ? number : null,
                PaidWith = ticket.SettledAt is null ? null : Payment.DescribeTenders(ticket.Payments),
                Lines = ticket.Lines.Select(l => new BillLineView
                {
                    Id = l.Id,
                    Source = l.Source.ToString(),
                    OrderId = l.OrderId,
                    Description = l.Description,
                    Details = l.Details,
                    Qty = l.Qty,
                    UnitPrice = l.UnitPrice,
                    Discount = l.Discount,
                    Total = l.Total,
                    CustomerName = l.CustomerName,
                    IsMine = (userId is not null && l.CustomerId == userId)
                        || (guestId is not null && l.GuestId == guestId),
                }).ToList(),
                Subtotal = bill.Subtotal,
                Discount = bill.Discount,
                DiscountRate = ticket.DiscountRate,
                ServiceCharge = bill.ServiceCharge,
                ServiceChargeRate = bill.ServiceChargeRate,
                Vat = bill.Vat,
                VatRate = bill.VatRate,
                VatIncluded = bill.VatIncluded,
                Total = bill.Total,
                RefundedTotal = refunded.TryGetValue(ticket.Id, out var amount) ? amount : 0,
            });
        }
        return bills;
    }

    public async Task<TicketDetail?> GetTicketAsync(int ticketId)
    {
        var ticket = await context.Tickets
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == ticketId);

        if (ticket is null)
            return null;

        var receipt = await context.Receipts
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.TicketId == ticketId);

        var bill = ticket.GetBill(await RulesForAsync(ticket.BranchId));

        var refunds = await context.Refunds
            .AsNoTracking()
            .Where(r => r.TicketId == ticketId)
            .OrderBy(r => r.Number)
            .ToListAsync();

        return new TicketDetail
        {
            Id = ticket.Id,
            Type = ticket.Type.ToString(),
            Status = ticket.Status.ToString(),
            BranchId = ticket.BranchId,
            LocationName = ticket.LocationName,
            SessionId = ticket.SessionId,
            SessionEndedAt = ticket.SessionEndedAt,
            PlaceId = ticket.PlaceId,
            PlaceKind = ticket.PlaceKind,
            Label = ticket.Label,
            GuestPhone = ticket.GuestPhone,
            TakenBy = ticket.TakenBy,
            TakenAtBranchId = ticket.TakenAtBranchId,
            OpenedAt = ticket.OpenedAt,
            LastActivityAt = ticket.LastActivityAt,
            SettledAt = ticket.SettledAt,
            SettledBy = ticket.SettledBy,
            ShiftId = ticket.ShiftId,
            ChangeGiven = ticket.ChangeGiven,
            VoidedAt = ticket.VoidedAt,
            VoidedBy = ticket.VoidedBy,
            VoidReason = ticket.VoidReason,
            Lines = ticket.Lines.Select(l => new TicketLineView
            {
                Id = l.Id,
                Source = l.Source.ToString(),
                OrderId = l.OrderId,
                Description = l.Description,
                Details = l.Details,
                Qty = l.Qty,
                UnitPrice = l.UnitPrice,
                Discount = l.Discount,
                Total = l.Total,
                AddedBy = l.AddedBy,
                CustomerName = l.CustomerName,
                CustomerId = l.CustomerId,
                GuestId = l.GuestId,
            }).ToList(),
            Payments = ticket.Payments.Select(p => new PaymentView
            {
                Tender = p.Tender.ToString(),
                Amount = p.Amount,
                CustomerName = p.CustomerName,
                CustomerId = p.CustomerId,
                RecordedBy = p.RecordedBy,
                RecordedAt = p.RecordedAt,
            }).ToList(),
            Total = bill.Total,
            Subtotal = bill.Subtotal,
            Discount = bill.Discount,
            DiscountRate = ticket.DiscountRate,
            DiscountReason = ticket.DiscountReason,
            DiscountBy = ticket.DiscountBy,
            ServiceCharge = bill.ServiceCharge,
            Vat = bill.Vat,
            VatIncluded = bill.VatIncluded,
            VatRate = bill.VatRate,
            ServiceChargeRate = bill.ServiceChargeRate,
            Refunds = refunds.Select(ToView).ToList(),
            RefundedTotal = refunds.Sum(r => r.Amount),
            ReceiptNumber = receipt?.Number,
            ProvisionalReceiptNumber = ticket.ProvisionalReceiptNumber,
        };
    }

    public async Task<BreakdownReport> GetBreakdownAsync(int branchId, DateTime from, DateTime to, int offsetMinutes, TimeZoneInfo? zone = null)
    {
        var tickets = await SettledInAsync(branchId, from, to);

        var voids = await context.Tickets
            .AsNoTracking()
            .Where(t => t.BranchId == branchId
                        && t.Status == TicketStatus.Voided
                        && t.VoidedAt >= from && t.VoidedAt < to)
            .Select(t => new { t.VoidedBy })
            .ToListAsync();

        var refunds = await RefundsInAsync(branchId, from, to);
        var refundedSales = await RefundedSalesAsync(refunds);

        // In the zone the caller named, each bill at its own moment's offset
        // (a week across a clock change keeps its hours); a fixed offset only
        // for a caller that still sends one
        var offset = TimeSpan.FromMinutes(offsetMinutes);
        DateTime Local(Ticket t)
        {
            var at = t.SettledAt ?? t.OpenedAt;
            return zone is null ? at + offset : ReportClock.ToLocal(at, zone);
        }

        var byHour = tickets
            .GroupBy(t => Local(t).Hour)
            .ToDictionary(g => g.Key, g => (Count: g.Count(), Net: g.Sum(t => t.Total)));

        var byWeekday = tickets
            .GroupBy(t => (int)Local(t).DayOfWeek)
            .ToDictionary(g => g.Key, g => (Count: g.Count(), Net: g.Sum(t => t.Total)));

        var voidsBy = voids.GroupBy(v => v.VoidedBy ?? "").ToDictionary(g => g.Key, g => g.Count());
        var refundsBy = refunds.GroupBy(r => r.RefundedBy).ToDictionary(g => g.Key, g => g.ToList());

        var cashiers = tickets.Select(t => t.SettledBy ?? "")
            .Concat(voidsBy.Keys)
            .Concat(refundsBy.Keys)
            .Distinct()
            .Select(name =>
            {
                var own = tickets.Where(t => (t.SettledBy ?? "") == name).ToList();
                var figures = SalesFigures.Of(own, refundsBy.GetValueOrDefault(name) ?? [], refundedSales);
                return new CashierTotal(
                    name,
                    own.Count,
                    figures.GrossSales,
                    figures.Discounts,
                    voidsBy.GetValueOrDefault(name),
                    figures.Refunds,
                    CashierKinds.Of(name),
                    figures.GrossSales,
                    figures.NetSales,
                    figures.NetSalesExVat,
                    figures.BillDiscounts,
                    figures.LineDiscounts,
                    figures.LoyaltyAndPromo,
                    figures.VatAdded);
            })
            .OrderByDescending(c => c.Net)
            .ToList();

        // Who took the orders the bills opened for, over the phone or at the
        // counter: the call centre's agents among them, who settle nothing
        // here and so are not among the cashiers
        var takers = tickets
            .Where(t => !string.IsNullOrWhiteSpace(t.TakenBy))
            .GroupBy(t => t.TakenBy!)
            .Select(g => new TakerTotal(g.Key, g.Count(), g.Sum(t => t.Total)))
            .OrderByDescending(t => t.Net)
            .ThenBy(t => t.Name)
            .ToList();

        return new BreakdownReport
        {
            From = from,
            To = to,
            OffsetMinutes = offsetMinutes,
            TimeZone = zone?.Id,
            ByTaker = takers,
            ByHour = Enumerable.Range(0, 24)
                .Select(h => new HourTotal(h, byHour.GetValueOrDefault(h).Count, byHour.GetValueOrDefault(h).Net))
                .ToList(),
            ByWeekday = Enumerable.Range(0, 7)
                .Select(d => new WeekdayTotal(d, byWeekday.GetValueOrDefault(d).Count, byWeekday.GetValueOrDefault(d).Net))
                .ToList(),
            ByCashier = cashiers,
            ByItem = await ItemsAsync(tickets, refunds),
        };
    }

    /// <summary>
    /// What sold, by the catalog item where the line names one and by the
    /// line's name otherwise (the room's time, older lines), at what the
    /// customers paid for it: the bill's money off, loyalty and promo lines
    /// included, its service and VAT, spread over the items as a refund gives
    /// them back. The delivery fee is not a thing sold, and a money-off line
    /// is inside the items it thinned. Credit notes issued in the window come
    /// off the items they gave back, whenever those sold. Every item, not a
    /// top 50: the back office folds them into categories, and a menu is a
    /// short list.
    /// </summary>
    private async Task<List<ItemTotal>> ItemsAsync(List<Ticket> tickets, List<Refund> refunds)
    {
        static string KeyOf(TicketLine line) => line.CatalogItemId is { } id ? $"#{id}" : line.Description.Primary;

        var sold = tickets
            .SelectMany(t =>
            {
                var shares = t.GetPaidShares();
                return t.Lines
                    .Where(l => l.Total > 0 && !l.IsDeliveryFee)
                    .Select(l => (Ticket: t.Id, Line: l, Paid: shares.PaidFor(l)));
            })
            .ToList();

        // The lines the credit notes gave back, found on their tickets: in the
        // window's, or the earlier ones they answer
        var lines = tickets.SelectMany(t => t.Lines).ToDictionary(l => l.Id);
        var missing = refunds.Select(r => r.TicketId).Distinct().Where(id => tickets.All(t => t.Id != id)).ToList();
        if (missing.Count > 0)
        {
            var earlier = await context.Tickets.AsNoTracking().Where(t => missing.Contains(t.Id)).ToListAsync();
            foreach (var line in earlier.SelectMany(t => t.Lines))
                lines.TryAdd(line.Id, line);
        }

        var givenBack = refunds
            .SelectMany(r => r.Lines)
            .Select(rl => (Refunded: rl, Line: lines.GetValueOrDefault(rl.TicketLineId)))
            .Where(x => x.Line is not null && !x.Line.IsDeliveryFee)
            .GroupBy(x => KeyOf(x.Line!))
            .ToDictionary(g => g.Key, g => (Qty: g.Sum(x => x.Refunded.Qty), Amount: g.Sum(x => x.Refunded.Amount), Line: g.First().Line!));

        var items = sold
            .GroupBy(x => KeyOf(x.Line))
            .Select(g =>
            {
                var back = givenBack.GetValueOrDefault(g.Key);
                var qty = g.Sum(x => x.Line.Qty);
                var amount = Money(g.Sum(x => x.Paid));
                return new ItemTotal(
                    g.First().Line.Description,
                    qty,
                    amount,
                    g.Select(x => x.Ticket).Distinct().Count(),
                    g.First().Line.CatalogItemId,
                    g.Sum(x => x.Line.Total),
                    back.Qty,
                    back.Amount,
                    qty - back.Qty,
                    amount - back.Amount);
            })
            .ToList();

        // An item given back in the window that did not sell in it still
        // shows, with nothing sold and what went back
        var listed = sold.Select(x => KeyOf(x.Line)).ToHashSet();
        items.AddRange(givenBack
            .Where(g => !listed.Contains(g.Key))
            .Select(g => new ItemTotal(
                g.Value.Line.Description, 0, 0, 0, g.Value.Line.CatalogItemId, 0,
                g.Value.Qty, g.Value.Amount, -g.Value.Qty, -g.Value.Amount)));

        return items.OrderByDescending(i => i.Amount).ThenByDescending(i => i.NetAmount).ToList();
    }

    private static decimal Money(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);

    public async Task<ItemPairsReport> GetItemPairsAsync(int branchId, int catalogItemId, DateTime from, DateTime to)
    {
        var tickets = await context.Tickets
            .AsNoTracking()
            .Where(t => t.BranchId == branchId
                        && t.Status == TicketStatus.Settled
                        && t.SettledAt >= from && t.SettledAt < to)
            .ToListAsync();

        // The same rule as the breakdown: a negative line was not bought, and
        // the delivery fee is not a thing sold
        return ItemPairs.Count(
            catalogItemId,
            tickets.Select(t => t.Lines.Where(l => l.Total > 0 && !l.IsDeliveryFee).Select(l => l.CatalogItemId)));
    }

    public async Task<PricingView> GetPricingAsync(int branchId)
    {
        var pricing = await context.BranchPricings.AsNoTracking().FirstOrDefaultAsync(p => p.BranchId == branchId);
        var rules = pricing?.Rules ?? PricingRules.None;
        return new PricingView(
            branchId,
            rules.VatRate,
            rules.PricesIncludeVat,
            rules.ServiceChargeRate,
            pricing?.MaxCashierDiscountRate ?? BranchPricing.DefaultMaxCashierDiscountRate);
    }

    /// <summary>
    /// Everything taken off settled bills, as a positive number: the bill
    /// discount frozen at settle, line discounts, and loyalty (negative) lines.
    /// </summary>
    internal static decimal DiscountsOf(IEnumerable<Ticket> tickets)
        => tickets.Sum(t => t.Discount + t.Lines.Sum(l => l.Discount + (l.Total < 0 ? -l.Total : 0)));

    public async Task<PagedResult<TicketHistoryRow>> GetTicketHistoryAsync(
        int branchId, TicketStatus status, DateTime? from, DateTime? to, int? receiptNumber, int pageIndex, int pageSize)
    {
        var voided = status == TicketStatus.Voided;

        var tickets = context.Tickets
            .AsNoTracking()
            .Where(t => t.BranchId == branchId && t.Status == status);

        if (receiptNumber is int number)
        {
            // A receipt number names one bill; the window is beside the point
            var ticketId = await context.Receipts
                .AsNoTracking()
                .Where(r => r.BranchId == branchId && r.Number == number)
                .Select(r => (int?)r.TicketId)
                .FirstOrDefaultAsync();

            if (ticketId is null)
                return new PagedResult<TicketHistoryRow>([], 0, pageIndex, pageSize);

            var id = ticketId.Value;
            tickets = tickets.Where(t => t.Id == id);
        }
        else if (voided)
        {
            if (from is not null) tickets = tickets.Where(t => t.VoidedAt >= from);
            if (to is not null) tickets = tickets.Where(t => t.VoidedAt < to);
        }
        else
        {
            if (from is not null) tickets = tickets.Where(t => t.SettledAt >= from);
            if (to is not null) tickets = tickets.Where(t => t.SettledAt < to);
        }

        var totalCount = await tickets.CountAsync();

        var page = await (voided
                ? tickets.OrderByDescending(t => t.VoidedAt)
                : tickets.OrderByDescending(t => t.SettledAt))
            .ThenByDescending(t => t.Id)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var ticketIds = page.Select(t => t.Id).ToList();

        var receipts = await context.Receipts
            .AsNoTracking()
            .Where(r => ticketIds.Contains(r.TicketId))
            .ToDictionaryAsync(r => r.TicketId, r => r.Number);

        var refunded = await context.Refunds
            .AsNoTracking()
            .Where(r => ticketIds.Contains(r.TicketId))
            .GroupBy(r => r.TicketId)
            .Select(g => new { TicketId = g.Key, Amount = g.Sum(r => r.Amount) })
            .ToDictionaryAsync(x => x.TicketId, x => x.Amount);

        // A void freezes the bill it cancelled, so its worth is what it was
        // then; one voided before that is worked out under today's rules
        var rules = await RulesForAsync(branchId);

        var rows = page
            .Select(t => new TicketHistoryRow(
                t.Id,
                receipts.TryGetValue(t.Id, out var receipt) ? receipt : (int?)null,
                t.Status.ToString(),
                t.Type.ToString(),
                t.LocationName,
                t.Label,
                (voided ? t.VoidedAt : t.SettledAt) ?? t.LastActivityAt,
                voided ? t.VoidedBy : t.SettledBy,
                t.GetBill(rules).Total,
                refunded.GetValueOrDefault(t.Id)))
            .ToList();

        return new PagedResult<TicketHistoryRow>(rows, totalCount, pageIndex, pageSize);
    }

    public async Task<PagedResult<PaymentRow>> GetPaymentsAsync(
        int branchId, DateTime from, DateTime to, PaymentTender? tender, int pageIndex, int pageSize)
    {
        // Windowed on the settle, not the payment, so the page adds up to the
        // range report's tender split for the same window
        var payments = context.Tickets
            .AsNoTracking()
            .Where(t => t.BranchId == branchId
                        && t.Status == TicketStatus.Settled
                        && t.SettledAt >= from && t.SettledAt < to)
            .SelectMany(t => t.Payments, (t, p) => new { Ticket = t, Payment = p });

        if (tender is PaymentTender wanted)
            payments = payments.Where(x => x.Payment.Tender == wanted);

        var totalCount = await payments.CountAsync();

        var page = await payments
            .OrderByDescending(x => x.Payment.RecordedAt)
            .ThenByDescending(x => x.Payment.Id)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                TicketId = x.Ticket.Id,
                PaymentId = x.Payment.Id,
                x.Payment.Tender,
                x.Payment.Amount,
                x.Payment.CustomerId,
                x.Payment.CustomerName,
                x.Payment.RecordedBy,
                x.Payment.RecordedAt,
            })
            .ToListAsync();

        var ticketIds = page.Select(x => x.TicketId).Distinct().ToList();

        // The bills behind the page, loaded whole like the receipts screen does
        var tickets = await context.Tickets
            .AsNoTracking()
            .Where(t => ticketIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id);

        var receipts = await context.Receipts
            .AsNoTracking()
            .Where(r => ticketIds.Contains(r.TicketId))
            .ToDictionaryAsync(r => r.TicketId, r => r.Number);

        var rows = page
            .Select(x => (Payment: x, Ticket: tickets.GetValueOrDefault(x.TicketId)))
            .Where(x => x.Ticket is not null)
            .Select(x => new PaymentRow(
                x.Ticket!.Id,
                receipts.TryGetValue(x.Ticket.Id, out var receipt) ? receipt : (int?)null,
                x.Ticket.Type.ToString(),
                x.Ticket.LocationName,
                x.Ticket.Label,
                x.Payment.Tender.ToString(),
                x.Payment.Amount,
                x.Payment.CustomerId,
                x.Payment.CustomerName,
                x.Payment.RecordedBy,
                x.Payment.RecordedAt,
                x.Ticket.SettledAt ?? x.Payment.RecordedAt,
                KeptOf(x.Ticket, x.Payment.PaymentId, x.Payment.Amount)))
            .ToList();

        return new PagedResult<PaymentRow>(rows, totalCount, pageIndex, pageSize);
    }

    public async Task<PagedResult<TabPaymentView>> GetTabPaymentsAsync(int branchId, DateTime from, DateTime to, int pageIndex, int pageSize)
    {
        var slips = context.TabPayments
            .AsNoTracking()
            .Where(p => p.BranchId == branchId && p.RecordedAt >= from && p.RecordedAt < to);

        var totalCount = await slips.CountAsync();

        var page = await slips
            .OrderByDescending(p => p.Number)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<TabPaymentView>(page.Select(ShiftQueries.ToView).ToList(), totalCount, pageIndex, pageSize);
    }

    public async Task<TabPaymentView?> GetTabPaymentAsync(int id)
    {
        var slip = await context.TabPayments.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
        return slip is null ? null : ShiftQueries.ToView(slip);
    }

    public async Task<PagedResult<RefundSummary>> GetRefundsAsync(int branchId, DateTime from, DateTime to, int pageIndex, int pageSize)
    {
        var refunds = context.Refunds
            .AsNoTracking()
            .Where(r => r.BranchId == branchId && r.RefundedAt >= from && r.RefundedAt < to);

        var totalCount = await refunds.CountAsync();

        // Projected rather than loaded: the lines auto-include, and the list
        // only needs to know how many there were
        var page = await refunds
            .OrderByDescending(r => r.Number)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .Select(r => new
            {
                r.Id,
                r.Number,
                r.TicketId,
                r.ReceiptNumber,
                r.Amount,
                r.Tender,
                r.Reason,
                r.CustomerName,
                r.RefundedBy,
                r.RefundedAt,
                r.ShiftId,
                LineCount = r.Lines.Count(),
            })
            .ToListAsync();

        var rows = page
            .Select(r => new RefundSummary(
                r.Id,
                r.Number,
                r.TicketId,
                r.ReceiptNumber,
                r.Amount,
                r.Tender.ToString(),
                r.Reason,
                r.CustomerName,
                r.RefundedBy,
                r.RefundedAt,
                r.ShiftId,
                r.LineCount))
            .ToList();

        return new PagedResult<RefundSummary>(rows, totalCount, pageIndex, pageSize);
    }

    private async Task<PricingRules> RulesForAsync(int branchId)
    {
        var pricing = await context.BranchPricings.AsNoTracking().FirstOrDefaultAsync(p => p.BranchId == branchId);
        return pricing?.Rules ?? PricingRules.None;
    }

    private static RefundView ToView(Refund refund) => new(
        refund.Id,
        refund.Number,
        refund.Amount,
        refund.Reason,
        refund.Tender.ToString(),
        refund.CustomerName,
        refund.RefundedBy,
        refund.RefundedAt,
        refund.Lines.Select(l => new RefundLineView(l.TicketLineId, l.Description, l.Qty, l.Amount)).ToList());
}
