#nullable enable
using Chillax.Payroll.API.Application.Commands;
using Chillax.Payroll.API.Application.Queries;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Chillax.Payroll.API.Apis;

public static class PayrollApi
{
    public static RouteGroupBuilder MapPayrollApi(this IEndpointRouteBuilder app)
    {
        // Back-office work: Admin (branch-checked) or Owner. The register,
        // attendance and payslips belong to the branch named by X-Branch-Id;
        // an employee's own record and ledger are reached by id.
        var api = app.NewVersionedApi("Payroll")
            .MapGroup("api/payroll")
            .HasApiVersion(1.0)
            .RequireAuthorization("Admin");

        // The register
        api.MapGet("/employees", GetEmployees)
            .WithName("GetEmployees")
            .WithSummary("Everyone at the branch, with their current pay terms and what they are owed");

        api.MapGet("/employees/{id:int}", GetEmployee)
            .WithName("GetEmployee")
            .WithSummary("One employee with their pay history");

        api.MapPost("/employees", HireEmployee)
            .WithName("HireEmployee")
            .WithSummary("Add someone to the register with the pay they start on");

        api.MapPut("/employees/{id:int}", UpdateEmployee)
            .WithName("UpdateEmployee")
            .WithSummary("Edit name, job, phone, branch or the linked login");

        // Changing what someone is paid is the owner's call, not the
        // branch manager's; a hire's starting pay stays with the manager
        app.NewVersionedApi("Payroll")
            .MapGroup("api/payroll")
            .HasApiVersion(1.0)
            .RequireAuthorization("Owner")
            .MapPut("/employees/{id:int}/pay-terms", SetPayTerms)
            .WithName("SetPayTerms")
            .WithSummary("New pay from a date; earlier terms stay as history (owner only)");

        api.MapPost("/employees/{id:int}/leave", Leave)
            .WithName("LeaveEmployee")
            .WithSummary("Record that someone left; the ledger and payslips stay");

        api.MapPost("/employees/{id:int}/rehire", Rehire)
            .WithName("RehireEmployee")
            .WithSummary("Someone who left is back");

        // Attendance
        api.MapGet("/attendance", GetAttendance)
            .WithName("GetAttendance")
            .WithSummary("The branch's marked days in a date range");

        api.MapPut("/attendance/{date}", MarkAttendance)
            .WithName("MarkAttendance")
            .WithSummary("Mark a day for one or many people; a null status clears the mark");

        // The ledger
        api.MapGet("/employees/{id:int}/ledger", GetLedger)
            .WithName("GetEmployeeLedger")
            .WithSummary("What the café owes someone, line by line, with the balance");

        api.MapPost("/employees/{id:int}/ledger", PostLedgerEntry)
            .WithName("PostLedgerEntry")
            .WithSummary("A bonus, deduction, advance or payment keyed in by hand");

        // Payslips
        api.MapGet("/payslips", GetPayslips)
            .WithName("GetPayslips")
            .WithSummary("The branch's payslips whose period overlaps a date range");

        api.MapGet("/payslips/{id:int}", GetPayslip)
            .WithName("GetPayslip")
            .WithSummary("One payslip");

        api.MapPost("/payslips", GeneratePayslips)
            .WithName("GeneratePayslips")
            .WithSummary("Generate (or regenerate the drafts) for a period: one employee, or everyone at the branch");

        api.MapPost("/payslips/{id:int}/pay", PayPayslip)
            .WithName("PayPayslip")
            .WithSummary("Mark a payslip paid and post the payment on the ledger");

        api.MapDelete("/payslips/{id:int}", DeletePayslip)
            .WithName("DeletePayslip")
            .WithSummary("Drop a draft payslip and the earnings line it posted");

        // The till's one need: whom to hand a wage or an advance to. Read by
        // a cashier, so it sits under the Pos policy, not the back office's.
        app.NewVersionedApi("Payroll")
            .MapGroup("api/payroll/till")
            .HasApiVersion(1.0)
            .RequireAuthorization("Pos")
            .MapGet("/employees", GetTillEmployees)
            .WithName("GetTillEmployees")
            .WithSummary("The branch's current employees, for the till's pay-out picker");

        return api;
    }

    // The register

    public static async Task<Ok<IReadOnlyList<EmployeeView>>> GetEmployees(
        HttpContext httpContext,
        [FromServices] IPayrollQueries queries,
        bool includeInactive = false)
        => TypedResults.Ok(await queries.GetEmployeesAsync(httpContext.GetRequiredBranchId(), includeInactive));

    public static async Task<Results<Ok<EmployeeView>, NotFound>> GetEmployee(
        int id,
        [FromServices] IPayrollQueries queries)
    {
        var employee = await queries.GetEmployeeAsync(id);
        return employee is null ? TypedResults.NotFound() : TypedResults.Ok(employee);
    }

    public static async Task<Results<Ok<CreatedResponse>, BadRequest<string>>> HireEmployee(
        HireEmployeeRequest request,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        [FromServices] IMediator mediator)
    {
        try
        {
            var id = await mediator.SendIdentified<HireEmployeeCommand, int>(requestId, new HireEmployeeCommand(
                request.Name, request.JobTitle, request.Phone, request.BranchId, request.UserId,
                request.StartedOn, request.Scheme, request.Rate, request.PaidDaysOff ?? Employee.DefaultPaidDaysOff));

            return TypedResults.Ok(new CreatedResponse(id));
        }
        catch (PayrollDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok, BadRequest<string>>> UpdateEmployee(
        int id,
        UpdateEmployeeRequest request,
        [FromServices] IMediator mediator)
    {
        try
        {
            await mediator.Send(new UpdateEmployeeCommand(id, request.Name, request.JobTitle, request.Phone, request.BranchId, request.UserId, request.PaidDaysOff ?? Employee.DefaultPaidDaysOff));
            return TypedResults.Ok();
        }
        catch (PayrollDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok, BadRequest<string>>> SetPayTerms(
        int id,
        PayTermsRequest request,
        [FromServices] IMediator mediator)
    {
        try
        {
            await mediator.Send(new SetPayTermsCommand(id, request.Scheme, request.Rate, request.EffectiveFrom));
            return TypedResults.Ok();
        }
        catch (PayrollDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok, BadRequest<string>>> Leave(
        int id,
        LeaveRequest request,
        [FromServices] IMediator mediator)
    {
        try
        {
            await mediator.Send(new LeaveCommand(id, request.EndedOn));
            return TypedResults.Ok();
        }
        catch (PayrollDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok, BadRequest<string>>> Rehire(
        int id,
        RehireRequest request,
        [FromServices] IMediator mediator)
    {
        try
        {
            await mediator.Send(new RehireCommand(id, request.StartedOn));
            return TypedResults.Ok();
        }
        catch (PayrollDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Ok<IReadOnlyList<TillEmployeeView>>> GetTillEmployees(
        HttpContext httpContext,
        [FromServices] IPayrollQueries queries)
        => TypedResults.Ok(await queries.GetTillEmployeesAsync(httpContext.GetRequiredBranchId()));

    // Attendance

    public static async Task<Ok<IReadOnlyList<AttendanceView>>> GetAttendance(
        HttpContext httpContext,
        [FromServices] IPayrollQueries queries,
        DateOnly from,
        DateOnly to)
        => TypedResults.Ok(await queries.GetAttendanceAsync(httpContext.GetRequiredBranchId(), from, to));

    public static async Task<Results<Ok, BadRequest<string>>> MarkAttendance(
        DateOnly date,
        MarkAttendanceRequest request,
        HttpContext httpContext,
        [FromServices] IMediator mediator)
    {
        var branchId = httpContext.GetRequiredBranchId();

        try
        {
            await mediator.Send(new MarkAttendanceCommand(branchId, date, request.Marks, httpContext.GetActor()));
            return TypedResults.Ok();
        }
        catch (PayrollDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    // The ledger

    public static async Task<Results<Ok<LedgerView>, NotFound>> GetLedger(
        int id,
        [FromServices] IPayrollQueries queries,
        DateOnly? from = null,
        DateOnly? to = null)
    {
        var ledger = await queries.GetLedgerAsync(id, from, to);
        return ledger is null ? TypedResults.NotFound() : TypedResults.Ok(ledger);
    }

    public static async Task<Results<Ok<CreatedResponse>, BadRequest<string>>> PostLedgerEntry(
        int id,
        LedgerEntryRequest request,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        HttpContext httpContext,
        [FromServices] IMediator mediator)
    {
        try
        {
            var entryId = await mediator.SendIdentified<PostLedgerEntryCommand, int>(requestId, new PostLedgerEntryCommand(
                id, request.Type, request.Amount, request.Date, request.Note, httpContext.GetActor()));

            return TypedResults.Ok(new CreatedResponse(entryId));
        }
        catch (PayrollDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    // Payslips

    public static async Task<Ok<IReadOnlyList<PayslipView>>> GetPayslips(
        HttpContext httpContext,
        [FromServices] IPayrollQueries queries,
        DateOnly from,
        DateOnly to)
        => TypedResults.Ok(await queries.GetPayslipsAsync(httpContext.GetRequiredBranchId(), from, to));

    public static async Task<Results<Ok<PayslipView>, NotFound>> GetPayslip(
        int id,
        [FromServices] IPayrollQueries queries)
    {
        var payslip = await queries.GetPayslipAsync(id);
        return payslip is null ? TypedResults.NotFound() : TypedResults.Ok(payslip);
    }

    public static async Task<Results<Ok<GeneratedResponse>, BadRequest<string>>> GeneratePayslips(
        GeneratePayslipsRequest request,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        HttpContext httpContext,
        [FromServices] IMediator mediator)
    {
        var branchId = httpContext.GetRequiredBranchId();

        try
        {
            var ids = await mediator.SendIdentified<GeneratePayslipsCommand, IReadOnlyList<int>>(requestId, new GeneratePayslipsCommand(
                branchId, request.EmployeeId, request.PeriodStart, request.PeriodEnd, httpContext.GetActor()));

            return TypedResults.Ok(new GeneratedResponse(ids));
        }
        catch (PayrollDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok, BadRequest<string>>> PayPayslip(
        int id,
        PayPayslipRequest request,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        HttpContext httpContext,
        [FromServices] IMediator mediator)
    {
        try
        {
            await mediator.SendIdentified<PayPayslipCommand, bool>(requestId, new PayPayslipCommand(
                id, request.Amount, request.Note, httpContext.GetActor()));

            return TypedResults.Ok();
        }
        catch (PayrollDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok, NotFound, BadRequest<string>>> DeletePayslip(
        int id,
        [FromServices] IMediator mediator)
    {
        try
        {
            return await mediator.Send(new DeletePayslipCommand(id)) ? TypedResults.Ok() : TypedResults.NotFound();
        }
        catch (PayrollDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }
}

public record CreatedResponse(int Id);

public record GeneratedResponse(IReadOnlyList<int> Ids);

public record HireEmployeeRequest(
    string Name,
    string? JobTitle,
    string? Phone,
    int BranchId,
    string? UserId,
    DateOnly StartedOn,
    PayScheme Scheme,
    decimal Rate,
    int? PaidDaysOff = null);

public record UpdateEmployeeRequest(string Name, string? JobTitle, string? Phone, int BranchId, string? UserId, int? PaidDaysOff = null);

public record PayTermsRequest(PayScheme Scheme, decimal Rate, DateOnly EffectiveFrom);

public record LeaveRequest(DateOnly EndedOn);

public record RehireRequest(DateOnly StartedOn);

public record MarkAttendanceRequest(IReadOnlyList<AttendanceMark> Marks);

public record LedgerEntryRequest(LedgerEntryType Type, decimal Amount, DateOnly Date, string? Note);

public record GeneratePayslipsRequest(int? EmployeeId, DateOnly PeriodStart, DateOnly PeriodEnd);

public record PayPayslipRequest(decimal? Amount, string? Note);
