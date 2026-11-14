namespace Ninja.Payroll.UnitTests.Domain;

using Ninja.Payroll.Domain.AggregatesModel.EmployeeAggregate;
using Ninja.Payroll.Domain.Exceptions;

/// <summary>A start date keyed in wrong at the hire can be put right.</summary>
[TestClass]
public class CorrectStartTest
{
    private static readonly DateOnly Nov1 = new(2026, 11, 1);
    private static readonly DateOnly Nov14 = new(2026, 11, 14);
    private static readonly DateOnly Nov30 = new(2026, 11, 30);

    private static Employee Hired(DateOnly startedOn)
        => Employee.Hire("Islam", "Manager", null, 1, null, startedOn, PayScheme.Monthly, 7000);

    [TestMethod]
    public void An_earlier_start_takes_the_starting_pay_with_it()
    {
        var islam = Hired(Nov14);

        Assert.IsTrue(islam.CorrectStart(Nov1));

        Assert.AreEqual(Nov1, islam.StartedOn);
        Assert.AreEqual(1, islam.Terms.Count);
        Assert.AreEqual(7000m, islam.TermsOn(Nov1)!.Rate);
        Assert.AreEqual(30, islam.DaysEmployed(Nov1, Nov30));
    }

    [TestMethod]
    public void A_later_start_takes_the_starting_pay_with_it()
    {
        var islam = Hired(Nov1);

        Assert.IsTrue(islam.CorrectStart(Nov14));

        Assert.IsNull(islam.TermsOn(Nov1));
        Assert.AreEqual(7000m, islam.TermsOn(Nov14)!.Rate);
        Assert.AreEqual(17, islam.DaysEmployed(Nov1, Nov30));
    }

    [TestMethod]
    public void The_same_date_changes_nothing()
    {
        var islam = Hired(Nov1);

        Assert.IsFalse(islam.CorrectStart(Nov1));
    }

    [TestMethod]
    public void A_later_pay_change_stays_where_it_was()
    {
        var islam = Hired(Nov14);
        islam.SetPayTerms(PayScheme.Monthly, 8000, new DateOnly(2026, 11, 20));

        islam.CorrectStart(Nov1);

        Assert.AreEqual(2, islam.Terms.Count);
        Assert.AreEqual(7000m, islam.TermsOn(Nov1)!.Rate);
        Assert.AreEqual(8000m, islam.TermsOn(Nov30)!.Rate);
    }

    [TestMethod]
    public void A_start_cannot_pass_a_pay_change_or_the_day_they_left()
    {
        var raised = Hired(Nov1);
        raised.SetPayTerms(PayScheme.Monthly, 8000, new DateOnly(2026, 11, 10));
        Assert.ThrowsExactly<PayrollDomainException>(() => raised.CorrectStart(Nov14));

        var left = Hired(Nov1);
        left.Leave(new DateOnly(2026, 11, 10));
        Assert.ThrowsExactly<PayrollDomainException>(() => left.CorrectStart(Nov14));
    }
}
