using System.Text.Json;
using Ninja.Assistant.API.Tools;
using Ninja.Assistant.UnitTests.Support;
using static Ninja.Assistant.UnitTests.Tools.FinanceWriteToolsTests;

namespace Ninja.Assistant.UnitTests.Tools;

[TestClass]
public sealed class StaffWriteToolsTests
{
    private static StaffWriteTools Tools(Bench bench) => new(bench.Tenant, bench.Api, Flow(bench), bench.Clock);

    /// <summary>Mona and Karim at Nasr City, Ali at Maadi</summary>
    private static Bench Staff()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "payroll-api/api/payroll/employees", r => r.Headers.GetValues("X-Branch-Id").First() == "1"
            ? new object[]
            {
                new { id = 1, name = "Mona Adel", jobTitle = "Barista", phone = "+201000000001", branchId = 1, userId = "u-mona", startedOn = "2026-01-01", endedOn = (string?)null, isActive = true, paidDaysOff = 4, balance = 0 },
                new { id = 2, name = "Karim Samy", jobTitle = "Waiter", phone = (string?)null, branchId = 1, userId = (string?)null, startedOn = "2026-02-01", endedOn = (string?)null, isActive = true, paidDaysOff = 2, balance = 0 },
            }
            : new object[]
            {
                new { id = 3, name = "Ali Hassan", jobTitle = "Cashier", phone = (string?)null, branchId = 2, userId = (string?)null, startedOn = "2026-03-01", endedOn = (string?)null, isActive = true, paidDaysOff = 4, balance = 0 },
            });
        bench.Handler.OnJson("GET", "payroll-api/api/payroll/attendance", _ => new object[]
        {
            new { employeeId = 2, date = "2026-09-21", branchId = 1, status = 0, overtimeHours = 0 },
        });
        return bench;
    }

    [TestMethod]
    public async Task A_hire_previews_its_pay_and_posts_once_with_its_key()
    {
        var bench = Staff();
        bench.Handler.OnJson("POST", "payroll-api/api/payroll/employees", _ => new { id = 10 });
        var tools = Tools(bench);

        var preview = await tools.AddEmployee("Salma Nour", "daily", 250, "Barista", "01000000009", "Maadi", "2026-09-27", "r1");
        Assert.AreNotEqual(true, preview.IsError, Bench.TextOf(preview));
        StringAssert.Contains(Bench.JsonOf(preview).GetProperty("preview").GetString(), "Add Salma Nour as Barista at Maadi / المعادي, starting 2026-09-27, paid EGP 250 a day");
        Assert.IsFalse(Writes(bench).Any());

        var done = await tools.AddEmployee("Salma Nour", "daily", 250, "Barista", "01000000009", "Maadi", "2026-09-27", "r1", confirm: true);
        Assert.AreEqual(10, Bench.JsonOf(done).GetProperty("employeeId").GetInt32());
        var post = Writes(bench).Single();
        Assert.AreEqual("2", post.Branch);
        Assert.AreEqual(WriteTools.IdempotencyKey("owner-1", "add_employee", "r1|hire").ToString(), post.RequestId);
        using var body = JsonDocument.Parse(post.Body!);
        Assert.AreEqual(2, body.RootElement.GetProperty("branchId").GetInt32());
        Assert.AreEqual(0, body.RootElement.GetProperty("scheme").GetInt32(), "daily");
        Assert.AreEqual(250m, body.RootElement.GetProperty("rate").GetDecimal());
        Assert.AreEqual("2026-09-27", body.RootElement.GetProperty("startedOn").GetString());
    }

    [TestMethod]
    public async Task An_edit_keeps_the_sign_in_and_days_off_and_never_touches_pay()
    {
        var bench = Staff();
        bench.Handler.On("PUT", "payroll-api/api/payroll/employees/1", _ => new HttpResponseMessage(System.Net.HttpStatusCode.OK));
        var tools = Tools(bench);

        var preview = await tools.UpdateEmployee("mona", jobTitle: "Shift supervisor", moveToBranch: "Maadi", requestId: "r1");
        var text = Bench.JsonOf(preview).GetProperty("preview").GetString()!;
        StringAssert.Contains(text, "job title Barista → Shift supervisor");
        StringAssert.Contains(text, "works at Nasr City / مدينة نصر → Maadi / المعادي");
        StringAssert.Contains(text, "pay stays");
        Assert.IsFalse(Writes(bench).Any());

        var done = await tools.UpdateEmployee("mona", jobTitle: "Shift supervisor", moveToBranch: "Maadi", requestId: "r1", confirm: true);
        Assert.AreNotEqual(true, done.IsError, Bench.TextOf(done));
        var put = Writes(bench).Single();
        Assert.AreEqual(HttpMethod.Put, put.Method);
        Assert.AreEqual("1", put.Branch);
        using var body = JsonDocument.Parse(put.Body!);
        Assert.AreEqual("Mona Adel", body.RootElement.GetProperty("name").GetString());
        Assert.AreEqual("+201000000001", body.RootElement.GetProperty("phone").GetString());
        Assert.AreEqual(2, body.RootElement.GetProperty("branchId").GetInt32());
        Assert.AreEqual("u-mona", body.RootElement.GetProperty("userId").GetString());
        Assert.AreEqual(4, body.RootElement.GetProperty("paidDaysOff").GetInt32());
        Assert.IsFalse(body.RootElement.TryGetProperty("rate", out _));
        Assert.IsFalse(bench.Handler.Requests.Any(r => r.Url.AbsolutePath.Contains("pay-terms")));
    }

    [TestMethod]
    public async Task Everyone_then_the_exceptions_marks_the_day_in_one_put()
    {
        var bench = Staff();
        bench.Handler.On("PUT", "payroll-api/api/payroll/attendance/2026-09-21", _ => new HttpResponseMessage(System.Net.HttpStatusCode.OK));
        var tools = Tools(bench);
        List<StaffWriteTools.AttendanceInput> marks = [new("everyone", "present"), new("Karim", "absent", "sick")];

        var preview = await tools.MarkAttendance(marks, branch: "Nasr City", requestId: "r1");
        var text = Bench.JsonOf(preview).GetProperty("preview").GetString()!;
        StringAssert.Contains(text, "Mark 2026-09-21 at Nasr City", "the 17:00 day start keeps 15:00 on the 21st");
        StringAssert.Contains(text, "Mona Adel: present");
        StringAssert.Contains(text, "Karim Samy: absent (sick) (was present)");
        Assert.IsFalse(Writes(bench).Any());

        var done = await tools.MarkAttendance(marks, branch: "Nasr City", requestId: "r1", confirm: true);
        Assert.AreNotEqual(true, done.IsError, Bench.TextOf(done));
        var put = Writes(bench).Single();
        Assert.AreEqual("1", put.Branch);
        using var body = JsonDocument.Parse(put.Body!);
        var sent = body.RootElement.GetProperty("marks").EnumerateArray().ToDictionary(m => m.GetProperty("employeeId").GetInt32(), m => m.GetProperty("status").GetInt32());
        Assert.AreEqual(0, sent[1]);
        Assert.AreEqual(2, sent[2]);
        Assert.AreEqual(2, sent.Count, "only the branch's own staff");
    }

    [TestMethod]
    public async Task An_unknown_mark_or_person_is_refused()
    {
        var bench = Staff();
        var bad = await Tools(bench).MarkAttendance([new("Mona", "vacation")], branch: "1");
        Assert.IsTrue(bad.IsError);
        var nobody = await Tools(bench).MarkAttendance([new("Ali", "present")], branch: "1");
        Assert.IsTrue(nobody.IsError);
        StringAssert.Contains(Bench.TextOf(nobody), "Mona Adel, Karim Samy");
    }
}
