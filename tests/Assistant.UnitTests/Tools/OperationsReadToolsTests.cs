using System.Net;
using Ninja.Assistant.API.Tools;
using Ninja.Assistant.UnitTests.Support;

namespace Ninja.Assistant.UnitTests.Tools;

[TestClass]
public sealed class OperationsReadToolsTests
{
    private static OperationsReadTools Tools(Bench bench) => new(bench.Tenant, bench.Api, bench.Clock);

    [TestMethod]
    public async Task Orders_take_the_owners_word_for_a_status_and_search_and_list_the_newest()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "ordering-api/api/orders/all", r => new
        {
            items = r.Headers.GetValues("X-Branch-Id").First() == "1"
                ? new object[]
                {
                    new { orderNumber = 1042, date = new DateTime(2026, 9, 22, 10, 0, 0, DateTimeKind.Utc), status = "Cancelled", total = 120.5, promoCode = "SUMMER10", promoDiscount = 12m, loyaltyDiscount = 0, paysOnline = false, paidWith = (string?)null, refundedAmount = 0m, source = "Customer", userName = "Ahmed", placeName = new { en = "Table 4", ar = "طاولة ٤" } },
                }
                : Array.Empty<object>(),
            pageIndex = 0,
            pageSize = 20,
            totalCount = r.Headers.GetValues("X-Branch-Id").First() == "1" ? 1 : 0,
        });

        var result = await Tools(bench).GetOrders("cancelled, pending", "Ahmed Ali", "today", null, null, null, 20, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        var calls = bench.Handler.Requests.Where(q => q.Url.Host == "ordering-api").ToList();
        Assert.AreEqual(2, calls.Count);
        var nasr = calls.Single(c => c.Branch == "1").Url.Query;
        StringAssert.Contains(nasr, "status=Cancelled,Submitted");
        StringAssert.Contains(nasr, "search=Ahmed%20Ali");
        StringAssert.Contains(nasr, "fromDate=2026-09-21T14:00:00Z");
        StringAssert.Contains(nasr, "api-version=1.0");
        var json = Bench.JsonOf(result);
        Assert.AreEqual(1, json.GetProperty("orders").GetInt32());
        var row = json.GetProperty("rows")[0];
        Assert.AreEqual(1042, row.GetProperty("number").GetInt32());
        Assert.AreEqual("طاولة ٤", row.GetProperty("placeAr").GetString());
        Assert.AreEqual("SUMMER10", row.GetProperty("promo").GetString());

        var bad = await Tools(bench).GetOrders("lost", null, "today", null, null, null, 20, CancellationToken.None);
        Assert.IsTrue(bad.IsError);
        StringAssert.Contains(Bench.TextOf(bad), "Unknown status 'lost'");
    }

    [TestMethod]
    public async Task Open_bills_are_counted_per_branch_oldest_first_with_their_idle_time()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "sales-api/api/tickets/open", r => r.Headers.GetValues("X-Branch-Id").First() == "1"
            ? new object[]
            {
                new { id = 2, type = "Table", status = "Open", locationName = new { en = "Table 2", ar = "طاولة ٢" }, label = (string?)null, openedAt = new DateTime(2026, 9, 22, 11, 0, 0, DateTimeKind.Utc), lastActivityAt = new DateTime(2026, 9, 22, 11, 50, 0, DateTimeKind.Utc), lineCount = 3, total = 150m },
                new { id = 1, type = "Counter", status = "Open", locationName = (object?)null, label = "Karim", openedAt = new DateTime(2026, 9, 22, 9, 0, 0, DateTimeKind.Utc), lastActivityAt = new DateTime(2026, 9, 22, 9, 0, 0, DateTimeKind.Utc), lineCount = 1, total = 40m },
            }
            : Array.Empty<object>());

        var result = await Tools(bench).GetOpenTickets(null, 20, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        var json = Bench.JsonOf(result);
        Assert.AreEqual(2, json.GetProperty("open").GetInt32());
        Assert.AreEqual(190m, json.GetProperty("openValue").GetDecimal());
        var bills = json.GetProperty("branches")[0].GetProperty("bills").EnumerateArray().ToList();
        Assert.AreEqual("Karim", bills[0].GetProperty("where").GetString(), "the oldest first");
        Assert.AreEqual(180, bills[0].GetProperty("idleMinutes").GetInt32());
        Assert.AreEqual("طاولة ٢", bills[1].GetProperty("whereAr").GetString());
    }

    [TestMethod]
    public async Task Reservations_give_the_open_ones_and_the_period_closed_by_outcome()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "spaces-api/api/reservations/open", _ => new[]
        {
            new { id = 5, placeId = 3, placeKind = 1, placeName = new { en = "Room 2", ar = "غرفة ٢" }, customerName = "Sara", partySize = 4, @for = new DateTime(2026, 9, 22, 17, 0, 0, DateTimeKind.Utc), createdAt = new DateTime(2026, 9, 22, 8, 0, 0, DateTimeKind.Utc), status = 2, isHolding = false, notes = (string?)null },
        });
        bench.Handler.OnJson("GET", "spaces-api/api/reservations/history", _ => new
        {
            items = new[]
            {
                new { id = 4, placeId = 3, placeKind = 2, placeName = new { en = "Table 1", ar = "طاولة ١" }, customerName = "Omar", partySize = 2, @for = new DateTime(2026, 9, 22, 9, 0, 0, DateTimeKind.Utc), createdAt = new DateTime(2026, 9, 22, 8, 0, 0, DateTimeKind.Utc), status = 5, isHolding = false, notes = (string?)null },
            },
            totalCount = 1,
        });

        var result = await Tools(bench).GetReservations("today", null, null, "Maadi", 20, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        var history = bench.Handler.Requests.Single(q => q.Url.AbsolutePath == "/api/reservations/history");
        Assert.AreEqual("2", history.Branch);
        StringAssert.Contains(history.Url.Query, "fromDate=2026-09-21T21:00:00Z");
        Assert.IsFalse(history.Url.Query.Contains("api-version"), "Spaces is not versioned");
        var json = Bench.JsonOf(result);
        Assert.AreEqual(1, json.GetProperty("openNow").GetInt32());
        var open = json.GetProperty("open")[0];
        Assert.AreEqual("Confirmed", open.GetProperty("status").GetString());
        Assert.AreEqual("Room", open.GetProperty("placeKind").GetString());
        Assert.AreEqual("2026-09-22 20:00", open.GetProperty("for").GetString());
        Assert.AreEqual("Expired", json.GetProperty("closedByOutcome")[0].GetProperty("status").GetString());
    }

    [TestMethod]
    public async Task Place_usage_sends_the_javascript_offset_and_ranks_the_places()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "spaces-api/api/stays/stats", _ => new
        {
            days = new[] { new { date = "2026-09-21", stays = 3, hours = 5.5m, revenue = 300m } },
            places = new object[]
            {
                new { placeId = 1, placeKind = 1, placeName = new { en = "Room 1", ar = "غرفة ١" }, stays = 1, hours = 1.5m, revenue = 100m },
                new { placeId = 2, placeKind = 3, placeName = new { en = "PS5", ar = "بلايستيشن" }, stays = 2, hours = 4m, revenue = 200m },
            },
        });
        bench.Handler.OnJson("GET", "spaces-api/api/stays/open", _ => new[]
        {
            new { id = 9, placeId = 2, placeKind = 3, placeName = new { en = "PS5", ar = "بلايستيشن" }, customerName = "Youssef", startedAt = new DateTime(2026, 9, 22, 11, 0, 0, DateTimeKind.Utc), endedAt = (DateTime?)null, currentOptionName = new { en = "Multi", ar = "مالتي" }, totalCost = (decimal?)null, status = 2 },
        });

        var result = await Tools(bench).GetPlaceUsage("yesterday", null, null, "2", 10, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        StringAssert.Contains(bench.Handler.Requests.Single(q => q.Url.AbsolutePath == "/api/stays/stats").Url.Query, "tzOffsetMinutes=-180");
        var json = Bench.JsonOf(result);
        Assert.AreEqual(300m, json.GetProperty("revenue").GetDecimal());
        Assert.AreEqual("PS5", json.GetProperty("byPlace")[0].GetProperty("place").GetString());
        Assert.AreEqual("Station", json.GetProperty("byPlace")[0].GetProperty("kind").GetString());
        var running = json.GetProperty("runningNow")[0];
        Assert.AreEqual(60, running.GetProperty("minutes").GetInt32());
        Assert.AreEqual("مالتي", running.GetProperty("rateAr").GetString());
    }

    [TestMethod]
    public async Task Deliveries_show_the_riders_and_the_board_and_a_missing_module_is_a_sentence()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "ordering-api/api/orders/riders/overview", _ => new[]
        {
            new { userId = "r1", name = "Hassan", enabled = true, status = "Online", onDuty = true, lastSeenAt = new DateTime(2026, 9, 22, 11, 58, 0, DateTimeKind.Utc), signedIn = true, @out = 1, deliveredToday = 6, failedToday = 0, cashCollectedToday = 840m },
        });
        bench.Handler.OnJson("GET", "ordering-api/api/orders/deliveries", _ => new[]
        {
            new { orderNumber = 77, date = new DateTime(2026, 9, 22, 11, 30, 0, DateTimeKind.Utc), customerName = "Laila", total = 210m, paidOnline = false, toCollect = 210m, cashDifference = (decimal?)null, delivery = new { address = "12 Road 9", stage = "OnTheWay", riderName = "Hassan" } },
        });

        var result = await Tools(bench).GetDeliveries("Nasr City", 20, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        StringAssert.Contains(bench.Handler.Requests.Single(q => q.Url.AbsolutePath == "/api/orders/riders/overview").Url.Query, "tzOffsetMinutes=-180");
        var json = Bench.JsonOf(result);
        Assert.AreEqual(1, json.GetProperty("ridersOnline").GetInt32());
        Assert.AreEqual("OnTheWay", json.GetProperty("deliveriesByStage")[0].GetProperty("stage").GetString());
        Assert.AreEqual("Hassan", json.GetProperty("deliveries")[0].GetProperty("rider").GetString());

        var off = new Bench().WithTenant();
        off.Handler.On("GET", "ordering-api/api/orders/", _ => new HttpResponseMessage(HttpStatusCode.PaymentRequired));
        var none = await Tools(off).GetDeliveries(null, 20, CancellationToken.None);
        Assert.IsTrue(none.IsError);
        StringAssert.Contains(Bench.TextOf(none), "Ordering is not included in this business's plan");
    }

    [TestMethod]
    public async Task Payslips_overlapping_the_month_are_totalled_with_what_is_still_to_pay()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "payroll-api/api/payroll/payslips", r => r.Headers.GetValues("X-Branch-Id").First() == "2"
            ? new object[]
            {
                new { id = 1, employeeId = 3, employeeName = "Mona", branchId = 2, periodStart = "2026-09-01", periodEnd = "2026-09-30", scheme = 1, rate = 6000m, daysWorked = 20m, earned = 4000m, overtimeHours = 0m, overtimePay = 0m, absentDays = 0m, absenceDeduction = 0m, bonuses = 200m, deductions = 0m, advances = 500m, payments = 0m, carriedOver = 0m, amountDue = 3700m, remaining = 3700m, status = 0, paidAmount = (decimal?)null, paidAt = (DateTime?)null, paidBy = (string?)null },
                new { id = 2, employeeId = 4, employeeName = "Ali", branchId = 2, periodStart = "2026-09-01", periodEnd = "2026-09-15", scheme = 0, rate = 200m, daysWorked = 12m, earned = 2400m, overtimeHours = 0m, overtimePay = 0m, absentDays = 0m, absenceDeduction = 0m, bonuses = 0m, deductions = 0m, advances = 0m, payments = 2400m, carriedOver = 0m, amountDue = 2400m, remaining = 0m, status = 1, paidAmount = 2400m, paidAt = new DateTime(2026, 9, 16, 10, 0, 0, DateTimeKind.Utc), paidBy = "Owner" },
            }
            : Array.Empty<object>());

        var result = await Tools(bench).GetPayslips("this_month", null, null, null, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        var maadi = bench.Handler.Requests.Single(q => q.Url.Host == "payroll-api" && q.Branch == "2").Url.Query;
        StringAssert.Contains(maadi, "from=2026-09-01&to=2026-09-22");
        var json = Bench.JsonOf(result);
        Assert.AreEqual(2, json.GetProperty("payslips").GetInt32());
        Assert.AreEqual(6100m, json.GetProperty("amountDue").GetDecimal());
        Assert.AreEqual(3700m, json.GetProperty("stillToPay").GetDecimal());
        var first = json.GetProperty("rows")[0];
        Assert.AreEqual("Mona", first.GetProperty("employee").GetString(), "the unpaid come first");
        Assert.AreEqual("Monthly", first.GetProperty("scheme").GetString());
        Assert.AreEqual("Draft", first.GetProperty("status").GetString());
    }

    [TestMethod]
    public async Task Branch_settings_give_the_hours_and_what_is_switched_on()
    {
        var bench = new Bench();
        bench.Handler.OnJson("GET", "tenant-api/api/branches/all", _ => new object[]
        {
            new { id = 1, name = new { en = "Nasr City", ar = "مدينة نصر" }, address = new { en = "Abbas El Akkad", ar = "عباس العقاد" }, phone = "0100", taxNumber = "T-1", isActive = true, displayOrder = 1, dayStartTime = "17:00", dayEndTime = "05:00", isOrderingEnabled = true, isReservationsEnabled = true, requireSignInForTableOrders = false, latitude = 30.05, longitude = 31.34, isDeliveryEnabled = true, deliveryRadiusKm = 5m, deliveryFee = 25m, deliveryMinimumOrder = 100m, requireSignInForDelivery = true },
            new { id = 2, name = new { en = "Maadi", ar = "المعادي" }, address = (object?)null, phone = (string?)null, taxNumber = (string?)null, isActive = true, displayOrder = 2, dayStartTime = "00:00", dayEndTime = "23:59", isOrderingEnabled = false, isReservationsEnabled = false, requireSignInForTableOrders = false, latitude = (double?)null, longitude = (double?)null, isDeliveryEnabled = false, deliveryRadiusKm = (decimal?)null, deliveryFee = 0m, deliveryMinimumOrder = 0m, requireSignInForDelivery = false },
        });
        bench.Handler.OnJson("GET", "tenant-api/api/tenant", _ => new { name = new { en = "Chillax" }, locale = new { country = "EG", currency = "EGP", timeZone = "Africa/Cairo", language = "ar" } });

        var result = await Tools(bench).GetBranchSettings("nasr", CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        var branches = Bench.JsonOf(result).GetProperty("branches").EnumerateArray().ToList();
        Assert.AreEqual(1, branches.Count);
        Assert.AreEqual("عباس العقاد", branches[0].GetProperty("addressAr").GetString());
        Assert.AreEqual("17:00", branches[0].GetProperty("businessDayStartsAt").GetString());
        var delivery = branches[0].GetProperty("delivery");
        Assert.IsTrue(delivery.GetProperty("on").GetBoolean());
        Assert.AreEqual(25m, delivery.GetProperty("fee").GetDecimal());
    }

    [TestMethod]
    public async Task Pricing_rules_give_vat_and_service_as_percentages_and_the_items_priced_differently()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "sales-api/api/tickets/pricing/2", _ => new { branchId = 2, vatRate = 0.14m, pricesIncludeVat = true, serviceChargeRate = 0.12m, maxCashierDiscountRate = 0.1m });
        bench.Handler.OnJson("GET", "catalog-api/api/catalog/branches/2/overrides", _ => new[]
        {
            new { id = 1, branchId = 2, catalogItemId = 1, isAvailable = true, isOutOfStock = false, priceOverride = (decimal?)70m, offerPriceOverride = (decimal?)null, isOnOfferOverride = (bool?)null },
            new { id = 2, branchId = 2, catalogItemId = 2, isAvailable = false, isOutOfStock = false, priceOverride = (decimal?)null, offerPriceOverride = (decimal?)null, isOnOfferOverride = (bool?)null },
        });
        bench.Handler.OnJson("GET", "catalog-api/api/catalog/items", _ => new[]
        {
            new { id = 1, name = new { en = "Latte", ar = "لاتيه" }, price = 70m, catalogTypeId = 4, isAvailable = true, @base = new { price = 65m, isOnOffer = false, isAvailable = true } },
            new { id = 2, name = new { en = "Croissant", ar = "كرواسون" }, price = 40m, catalogTypeId = 5, isAvailable = false, @base = new { price = 40m, isOnOffer = false, isAvailable = true } },
        });

        var result = await Tools(bench).GetPricingRules("Maadi", CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        Assert.AreEqual("2", bench.Handler.Requests.Single(q => q.Url.AbsolutePath == "/api/tickets/pricing/2").Branch);
        var branch = Bench.JsonOf(result).GetProperty("branches")[0];
        Assert.AreEqual("14%", branch.GetProperty("vat").GetString());
        Assert.AreEqual("12%", branch.GetProperty("serviceCharge").GetString());
        var prices = branch.GetProperty("branchPrices").EnumerateArray().ToList();
        Assert.AreEqual(1, prices.Count, "a sold-out override is not a price");
        Assert.AreEqual(65m, prices[0].GetProperty("chainPrice").GetDecimal());
        Assert.AreEqual(70m, prices[0].GetProperty("price").GetDecimal());
    }
}
