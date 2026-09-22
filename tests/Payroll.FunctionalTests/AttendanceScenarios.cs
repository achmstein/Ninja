using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Ninja.EventBus.Abstractions;
using Ninja.EventBus.Events;
using Ninja.Payroll.API.Application.IntegrationEvents.Events;
using Ninja.Payroll.Domain.AggregatesModel.AttendanceAggregate;
using Ninja.Testing;

namespace Ninja.Payroll.FunctionalTests;

/// <summary>
/// Who was in: the grid a manager marks, and the drawer that marks a
/// cashier present without anyone being asked.
/// </summary>
[TestClass]
public sealed class AttendanceScenarios
{
    private static string Days(string from, string to) => Suite.Url("/attendance") + $"&from={from}&to={to}";

    private static Task TellAsync(IntegrationEvent what)
        => Suite.Payroll.Services.GetRequiredService<IEventBus>().PublishAsync(what);

    [TestMethod]
    public async Task A_day_is_marked_for_everyone_at_once_and_a_wrong_mark_is_cleared()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var mona = await Suite.HireAsync(books, branch, "Mona");
        var tarek = await Suite.HireAsync(books, branch, "Tarek");

        var (marked, detail) = await books.RefusedAsync(HttpMethod.Put, Suite.Url("/attendance/2026-03-03"), new
        {
            marks = new object[]
            {
                new { employeeId = mona, status = (int)AttendanceStatus.Present, overtimeHours = 2m },
                new { employeeId = tarek, status = (int)AttendanceStatus.HalfDay, note = "Left after lunch" },
            },
        });
        Assert.AreEqual(HttpStatusCode.OK, marked, detail);

        var day = await books.GetAsync<List<AttendanceView>>(Days("2026-03-03", "2026-03-03"));
        Assert.AreEqual(2, day.Count, "the whole column is marked in one go");
        var hers = day.Single(a => a.EmployeeId == mona);
        Assert.AreEqual(AttendanceStatus.Present, hers.Status);
        Assert.AreEqual(2m, hers.OvertimeHours, "and the hours she stayed on are on the day");
        Assert.AreEqual(branch, hers.BranchId);
        Assert.AreEqual("Admin", hers.MarkedBy);
        Assert.AreEqual(AttendanceStatus.HalfDay, day.Single(a => a.EmployeeId == tarek).Status);

        // Marking again is an edit, not a second row
        await books.RefusedAsync(HttpMethod.Put, Suite.Url("/attendance/2026-03-03"), new
        {
            marks = new object[] { new { employeeId = tarek, status = (int)AttendanceStatus.Present } },
        });
        var edited = await books.GetAsync<List<AttendanceView>>(Days("2026-03-03", "2026-03-03"));
        Assert.AreEqual(2, edited.Count);
        Assert.AreEqual(AttendanceStatus.Present, edited.Single(a => a.EmployeeId == tarek).Status);

        // A mark cleared is a day nobody said anything about
        await books.RefusedAsync(HttpMethod.Put, Suite.Url("/attendance/2026-03-03"), new
        {
            marks = new object[] { new { employeeId = tarek, status = (AttendanceStatus?)null } },
        });
        var cleared = await books.GetAsync<List<AttendanceView>>(Days("2026-03-03", "2026-03-03"));
        Assert.AreEqual(mona, cleared.Single().EmployeeId);

        Assert.IsEmpty(await books.GetAsync<List<AttendanceView>>(Days("2026-03-04", "2026-03-10")), "and no other day was touched");

        var (tooLong, why) = await books.RefusedAsync(HttpMethod.Put, Suite.Url("/attendance/2026-03-04"), new
        {
            marks = new object[] { new { employeeId = mona, status = (int)AttendanceStatus.Present, overtimeHours = 20m } },
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, tooLong);
        Assert.Contains("16", why, "a day has a limit, however busy the café is");
    }

    [TestMethod]
    public async Task A_cashier_who_opens_the_drawer_is_at_work()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var login = $"user-{Guid.NewGuid():N}";
        var employee = await Suite.HireAsync(books, branch, "Nadia", userId: login);

        await TellAsync(new ShiftOpenedIntegrationEvent
        {
            ShiftId = branch * 10 + 1,
            BranchId = branch,
            OpenedAt = new DateTime(2026, 3, 6, 9, 0, 0, DateTimeKind.Utc),
            OpenedByUserId = login,
        });

        await ServiceUnderTest<Program>.EventuallyAsync(
            async () => (await books.GetAsync<List<AttendanceView>>(Days("2026-03-06", "2026-03-06"))).Count == 1,
            "opening the drawer marks the day without anyone being asked");

        var marked = (await books.GetAsync<List<AttendanceView>>(Days("2026-03-06", "2026-03-06"))).Single();
        Assert.AreEqual(employee, marked.EmployeeId);
        Assert.AreEqual(AttendanceStatus.Present, marked.Status);
        Assert.AreEqual("till", marked.MarkedBy, "and the grid says the till said so, not a manager");
        Assert.AreEqual($"shift:{branch * 10 + 1}", marked.Note);

        // A manager's own word stands: the till never overrides a person
        await books.RefusedAsync(HttpMethod.Put, Suite.Url("/attendance/2026-03-07"), new
        {
            marks = new object[] { new { employeeId = employee, status = (int)AttendanceStatus.HalfDay } },
        });

        await TellAsync(new ShiftOpenedIntegrationEvent
        {
            ShiftId = branch * 10 + 2,
            BranchId = branch,
            OpenedAt = new DateTime(2026, 3, 7, 9, 0, 0, DateTimeKind.Utc),
            OpenedByUserId = login,
        });

        // A shift opened by a login nobody is hired under marks nobody
        await TellAsync(new ShiftOpenedIntegrationEvent
        {
            ShiftId = branch * 10 + 3,
            BranchId = branch,
            OpenedAt = new DateTime(2026, 3, 8, 9, 0, 0, DateTimeKind.Utc),
            OpenedByUserId = $"nobody-{Guid.NewGuid():N}",
        });

        // One more of hers behind them: the day it marks says the two before it were handled
        await TellAsync(new ShiftOpenedIntegrationEvent
        {
            ShiftId = branch * 10 + 4,
            BranchId = branch,
            OpenedAt = new DateTime(2026, 3, 9, 9, 0, 0, DateTimeKind.Utc),
            OpenedByUserId = login,
        });

        await ServiceUnderTest<Program>.EventuallyAsync(
            async () => (await books.GetAsync<List<AttendanceView>>(Days("2026-03-09", "2026-03-09"))).Count == 1,
            "the shifts behind the first are handled too");

        var week = await books.GetAsync<List<AttendanceView>>(Days("2026-03-06", "2026-03-09"));
        Assert.AreEqual(3, week.Count, "the stranger's shift marked nobody");
        Assert.AreEqual(AttendanceStatus.HalfDay, week.Single(a => a.Date == new DateOnly(2026, 3, 7)).Status,
            "and the half day the manager marked is still a half day");
    }
}
