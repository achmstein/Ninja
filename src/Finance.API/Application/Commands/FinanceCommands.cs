#nullable enable
using Ninja.Finance.Infrastructure.Idempotency;

namespace Ninja.Finance.API.Application.Commands;

// ---------------------------------------------------------------------------
// Categories

public record SaveCategoryCommand(int? Id, LocalizedText Name, int DisplayOrder, bool IsActive) : IRequest<int>;

public class SaveCategoryCommandHandler(IExpenseCategoryRepository categories) : IRequestHandler<SaveCategoryCommand, int>
{
    public async Task<int> Handle(SaveCategoryCommand command, CancellationToken cancellationToken)
    {
        ExpenseCategory category;

        if (command.Id is { } id)
        {
            category = await categories.GetAsync(id) ?? throw new FinanceDomainException("Category not found.");
            category.Update(command.Name, command.DisplayOrder, command.IsActive);
        }
        else
        {
            category = categories.Add(new ExpenseCategory(command.Name, command.DisplayOrder));
        }

        await categories.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return category.Id;
    }
}

// ---------------------------------------------------------------------------
// Expenses

/// <summary>
/// An expense keyed in on the page. Paid from a partner's own pocket, it
/// is also a contribution on that partner's account, under the expense's
/// reference, so the two never drift apart.
/// </summary>
public record RecordExpenseCommand(
    int BranchId,
    DateOnly Date,
    int CategoryId,
    decimal Amount,
    PaidFrom PaidFrom,
    int? PartnerId,
    string? Vendor,
    string? Note,
    string RecordedBy) : IRequest<int>;

public class RecordExpenseCommandHandler(
    IExpenseRepository expenses,
    IExpenseCategoryRepository categories,
    IPartnerRepository partners) : IRequestHandler<RecordExpenseCommand, int>
{
    public async Task<int> Handle(RecordExpenseCommand command, CancellationToken cancellationToken)
    {
        _ = await categories.GetAsync(command.CategoryId) ?? throw new FinanceDomainException("Category not found.");

        Partner? partner = null;
        if (command.PaidFrom == PaidFrom.Partner)
        {
            partner = await partners.GetAsync(command.PartnerId ?? 0) ?? throw new FinanceDomainException("Partner not found.");
            if (!partner.Owns(command.BranchId))
                throw new FinanceDomainException($"{partner.Name} is not a partner at this branch.");
        }

        var expense = expenses.Add(new Expense(command.BranchId, command.Date, command.CategoryId, command.Amount, command.PaidFrom,
            partner?.Id, command.Vendor, command.Note, command.RecordedBy));
        await expenses.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        if (partner is not null)
        {
            partners.AddEntry(new PartnerEntry(partner.Id, command.BranchId, PartnerEntryType.Contribution, command.Amount, command.Date,
                command.Vendor ?? command.Note, command.RecordedBy, FinanceSource.Manual, $"expense:{expense.Id}"));
            await partners.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        }

        return expense.Id;
    }
}

/// <summary>A retried record answers 0: the first attempt made the line, the list shows it.</summary>
public class RecordExpenseIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<RecordExpenseCommand, int>> logger)
    : IdentifiedCommandHandler<RecordExpenseCommand, int>(mediator, requestManager, logger)
{
    protected override Task<int> CreateResultForDuplicateRequestAsync(RecordExpenseCommand command, CancellationToken cancellationToken)
        => Task.FromResult(0);
}

/// <summary>Void an expense; a partner's matching contribution is reversed by a drawing under the same reference.</summary>
public record VoidExpenseCommand(int ExpenseId, string Reason, string By) : IRequest<bool>;

public class VoidExpenseCommandHandler(
    IExpenseRepository expenses,
    IPartnerRepository partners) : IRequestHandler<VoidExpenseCommand, bool>
{
    public async Task<bool> Handle(VoidExpenseCommand command, CancellationToken cancellationToken)
    {
        var expense = await expenses.GetAsync(command.ExpenseId) ?? throw new FinanceDomainException("Expense not found.");

        expense.Void(command.Reason, command.By);

        if (expense.PartnerId is { } partnerId)
        {
            partners.AddEntry(new PartnerEntry(partnerId, expense.BranchId, PartnerEntryType.Drawing, expense.Amount,
                BusinessDay.Of(DateTime.UtcNow), $"void: {command.Reason}", command.By, FinanceSource.Manual, $"expense:{expense.Id}:void"));
        }

        await expenses.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return true;
    }
}

/// <summary>Add a recurring bill, or edit one when <paramref name="Id"/> is given. A due bill posts within the hour.</summary>
public record SaveRecurringExpenseCommand(
    int? Id,
    int BranchId,
    int CategoryId,
    decimal Amount,
    int DayOfMonth,
    PaidFrom PaidFrom,
    int? PartnerId,
    string? Vendor,
    string? Note,
    bool IsActive) : IRequest<int>;

public class SaveRecurringExpenseCommandHandler(
    IRecurringExpenseRepository bills,
    IExpenseCategoryRepository categories,
    IPartnerRepository partners) : IRequestHandler<SaveRecurringExpenseCommand, int>
{
    public async Task<int> Handle(SaveRecurringExpenseCommand command, CancellationToken cancellationToken)
    {
        _ = await categories.GetAsync(command.CategoryId) ?? throw new FinanceDomainException("Category not found.");

        if (command.PaidFrom == PaidFrom.Partner)
        {
            var partner = await partners.GetAsync(command.PartnerId ?? 0) ?? throw new FinanceDomainException("Partner not found.");
            if (!partner.Owns(command.BranchId))
                throw new FinanceDomainException($"{partner.Name} is not a partner at this branch.");
        }

        RecurringExpense bill;

        if (command.Id is { } id)
        {
            bill = await bills.GetAsync(id) ?? throw new FinanceDomainException("Recurring bill not found.");
            bill.Update(command.CategoryId, command.Amount, command.DayOfMonth, command.PaidFrom, command.PartnerId, command.Vendor, command.Note, command.IsActive);
        }
        else
        {
            bill = bills.Add(new RecurringExpense(command.BranchId, command.CategoryId, command.Amount, command.DayOfMonth, command.PaidFrom, command.PartnerId, command.Vendor, command.Note));
        }

        await bills.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return bill.Id;
    }
}

/// <summary>Attach (or replace) the photo of the bill behind an expense.</summary>
public record AttachReceiptCommand(int ExpenseId, string ContentType, string FileName, byte[] Data, string By) : IRequest<bool>;

public class AttachReceiptCommandHandler(IExpenseRepository expenses) : IRequestHandler<AttachReceiptCommand, bool>
{
    public async Task<bool> Handle(AttachReceiptCommand command, CancellationToken cancellationToken)
    {
        _ = await expenses.GetAsync(command.ExpenseId) ?? throw new FinanceDomainException("Expense not found.");

        var existing = await expenses.GetReceiptAsync(command.ExpenseId);
        if (existing is null)
            expenses.AddReceipt(new ExpenseReceipt(command.ExpenseId, command.ContentType, command.FileName, command.Data, command.By));
        else
            existing.Replace(command.ContentType, command.FileName, command.Data, command.By);

        await expenses.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return true;
    }
}

public record RemoveReceiptCommand(int ExpenseId) : IRequest<bool>;

public class RemoveReceiptCommandHandler(IExpenseRepository expenses) : IRequestHandler<RemoveReceiptCommand, bool>
{
    public async Task<bool> Handle(RemoveReceiptCommand command, CancellationToken cancellationToken)
    {
        var receipt = await expenses.GetReceiptAsync(command.ExpenseId);
        if (receipt is null)
            return false;

        expenses.RemoveReceipt(receipt);
        await expenses.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return true;
    }
}

// ---------------------------------------------------------------------------
// Suppliers

public record SaveSupplierCommand(int? Id, string Name, string? Phone, string? Notes, bool IsActive) : IRequest<int>;

public class SaveSupplierCommandHandler(ISupplierRepository suppliers) : IRequestHandler<SaveSupplierCommand, int>
{
    public async Task<int> Handle(SaveSupplierCommand command, CancellationToken cancellationToken)
    {
        Supplier supplier;

        if (command.Id is { } id)
        {
            supplier = await suppliers.GetAsync(id) ?? throw new FinanceDomainException("Supplier not found.");
            supplier.Update(command.Name, command.Phone, command.Notes, command.IsActive);
        }
        else
        {
            supplier = suppliers.Add(new Supplier(command.Name, command.Phone, command.Notes));
        }

        await suppliers.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return supplier.Id;
    }
}

/// <summary>A line keyed in by hand on a supplier's account: a payment made outside the drawer, a credit, an invoice with no stock receipt.</summary>
public record PostSupplierEntryCommand(int SupplierId, int BranchId, SupplierEntryType Type, decimal Amount, DateOnly Date, string? Note, string RecordedBy) : IRequest<int>;

public class PostSupplierEntryCommandHandler(ISupplierRepository suppliers) : IRequestHandler<PostSupplierEntryCommand, int>
{
    public async Task<int> Handle(PostSupplierEntryCommand command, CancellationToken cancellationToken)
    {
        _ = await suppliers.GetAsync(command.SupplierId) ?? throw new FinanceDomainException("Supplier not found.");

        var entry = suppliers.AddEntry(new SupplierEntry(command.SupplierId, command.BranchId, command.Type, command.Amount, command.Date, command.Note, command.RecordedBy));
        await suppliers.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return entry.Id;
    }
}

public class PostSupplierEntryIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<PostSupplierEntryCommand, int>> logger)
    : IdentifiedCommandHandler<PostSupplierEntryCommand, int>(mediator, requestManager, logger)
{
    protected override Task<int> CreateResultForDuplicateRequestAsync(PostSupplierEntryCommand command, CancellationToken cancellationToken)
        => Task.FromResult(0);
}

// ---------------------------------------------------------------------------
// Partners

public record PartnerShareInput(int BranchId, decimal Percent);

public record SavePartnerCommand(int? Id, string Name, string? Phone, string? UserId, IReadOnlyList<PartnerShareInput> Shares, bool IsActive) : IRequest<int>;

public class SavePartnerCommandHandler(IPartnerRepository partners) : IRequestHandler<SavePartnerCommand, int>
{
    public async Task<int> Handle(SavePartnerCommand command, CancellationToken cancellationToken)
    {
        Partner partner;

        if (command.Id is { } id)
        {
            partner = await partners.GetAsync(id) ?? throw new FinanceDomainException("Partner not found.");
            partner.Update(command.Name, command.Phone, command.UserId, command.Shares.Select(s => (s.BranchId, s.Percent)), command.IsActive);
        }
        else
        {
            partner = partners.Add(new Partner(command.Name, command.Phone, command.UserId, command.Shares.Select(s => (s.BranchId, s.Percent))));
        }

        await partners.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return partner.Id;
    }
}

/// <summary>A line keyed in by hand on a partner's account: money put in at the bank, a drawing outside the drawer.</summary>
public record PostPartnerEntryCommand(int PartnerId, int BranchId, PartnerEntryType Type, decimal Amount, DateOnly Date, string? Note, string RecordedBy) : IRequest<int>;

public class PostPartnerEntryCommandHandler(IPartnerRepository partners) : IRequestHandler<PostPartnerEntryCommand, int>
{
    public async Task<int> Handle(PostPartnerEntryCommand command, CancellationToken cancellationToken)
    {
        var partner = await partners.GetAsync(command.PartnerId) ?? throw new FinanceDomainException("Partner not found.");

        if (!partner.Owns(command.BranchId))
            throw new FinanceDomainException($"{partner.Name} is not a partner at this branch.");

        var entry = partners.AddEntry(new PartnerEntry(command.PartnerId, command.BranchId, command.Type, command.Amount, command.Date, command.Note, command.RecordedBy));
        await partners.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return entry.Id;
    }
}

public class PostPartnerEntryIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<PostPartnerEntryCommand, int>> logger)
    : IdentifiedCommandHandler<PostPartnerEntryCommand, int>(mediator, requestManager, logger)
{
    protected override Task<int> CreateResultForDuplicateRequestAsync(PostPartnerEntryCommand command, CancellationToken cancellationToken)
        => Task.FromResult(0);
}
