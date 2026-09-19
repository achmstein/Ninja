namespace Ninja.E2E.Support;

/// <summary>
/// The numeric enum values the SPAs put on the wire. No API registers a
/// string-enum converter for requests, so these are what the services parse.
/// Responses mostly return numbers too, except the Sales views that
/// ToString() their enums (shift status, tender, movement type/kind, ticket
/// type/status) — those DTOs carry strings.
/// </summary>
public static class Codes
{
    /// <summary>Sales PaymentTender.</summary>
    public static class Tender
    {
        public const int Cash = 0;
        public const int Card = 1;
        public const int InstaPay = 2;
        public const int Account = 3;
    }

    /// <summary>Sales CashMovementType.</summary>
    public static class MovementType
    {
        public const int PayIn = 0;
        public const int PayOut = 1;
    }

    /// <summary>Sales CashMovementKind.</summary>
    public static class MovementKind
    {
        public const int Other = 0;
        public const int Supplier = 1;
        public const int Wage = 2;
        public const int Advance = 3;
        public const int Expense = 4;
        public const int Partner = 5;
    }

    /// <summary>Sales TicketType.</summary>
    public static class TicketType
    {
        public const int Room = 0;
        public const int Table = 1;
        public const int Counter = 2;
    }

    /// <summary>Inventory MovementType.</summary>
    public static class StockMovement
    {
        public const int Purchase = 0;
        public const int Sale = 1;
        public const int Waste = 2;
        public const int Count = 3;
        public const int Adjustment = 4;
    }

    /// <summary>Finance SupplierEntryType.</summary>
    public static class SupplierEntry
    {
        public const int Invoice = 0;
        public const int Payment = 1;
        public const int Credit = 2;
    }

    /// <summary>Finance PartnerEntryType.</summary>
    public static class PartnerEntry
    {
        public const int Drawing = 0;
        public const int Contribution = 1;
    }

    /// <summary>Finance PaidFrom.</summary>
    public static class PaidFrom
    {
        public const int Drawer = 0;
        public const int Bank = 1;
        public const int Partner = 2;
    }

    /// <summary>Finance FinanceSource.</summary>
    public static class FinanceSource
    {
        public const int Manual = 0;
        public const int Till = 1;
        public const int Purchase = 2;
        public const int Recurring = 3;
    }

    /// <summary>Payroll PayScheme.</summary>
    public static class PayScheme
    {
        public const int Daily = 0;
        public const int Monthly = 1;
    }

    /// <summary>Payroll AttendanceStatus.</summary>
    public static class Attendance
    {
        public const int Present = 0;
        public const int HalfDay = 1;
        public const int Absent = 2;
        public const int DayOff = 3;
    }

    /// <summary>Payroll LedgerEntryType.</summary>
    public static class LedgerEntry
    {
        public const int Earned = 0;
        public const int Bonus = 1;
        public const int Deduction = 2;
        public const int Advance = 3;
        public const int Payment = 4;
    }

    /// <summary>Payroll LedgerSource.</summary>
    public static class LedgerSource
    {
        public const int Manual = 0;
        public const int Payslip = 1;
        public const int TillPayOut = 2;
    }

    /// <summary>Payroll PayslipStatus.</summary>
    public static class Payslip
    {
        public const int Draft = 0;
        public const int Paid = 1;
    }

    /// <summary>Notification ServiceRequestType.</summary>
    public static class ServiceRequest
    {
        public const int CallWaiter = 1;
        public const int ControllerChange = 2;
        public const int ReceiptToPay = 3;
    }

    /// <summary>The rate options of a room's tariff, by code.</summary>
    public static class RateOption
    {
        public const string Single = "single";
        public const string Multi = "multi";
    }
}
