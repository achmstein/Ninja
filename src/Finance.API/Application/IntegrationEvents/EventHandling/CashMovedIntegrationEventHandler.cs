#nullable enable
using Ninja.EventBus.Abstractions;
using Ninja.Finance.API.Application.IntegrationEvents.Events;

namespace Ninja.Finance.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// Money the till moved lands where it belongs: a supplier's payment on
/// their account, an expense in the register, a partner's drawing or
/// contribution on theirs — dated to the shift's business day, idempotent
/// on the shift and movement. Whatever the till could not name (no
/// category, an unknown supplier) is logged and left: the drawer already
/// moved, and a manager can key the line in by hand.
/// </summary>
public class CashMovedIntegrationEventHandler(
    IExpenseRepository expenses,
    IExpenseCategoryRepository categories,
    ISupplierRepository suppliers,
    IPartnerRepository partners,
    FinanceTransaction transaction,
    ILogger<CashMovedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<CashMovedIntegrationEvent>
{
    public static string ReferenceFor(int shiftId, int movementId) => $"shift:{shiftId}:movement:{movementId}";

    public Task Handle(CashMovedIntegrationEvent @event)
        => transaction.RunAsync(nameof(CashMovedIntegrationEvent), () => Post(@event));

    private async Task Post(CashMovedIntegrationEvent @event)
    {
        var reference = ReferenceFor(@event.ShiftId, @event.MovementId);
        var day = BusinessDay.Of(@event.ShiftOpenedAt);
        var payOut = @event.Type == "PayOut";

        switch (@event.Kind)
        {
            case "Supplier" when payOut && @event.SupplierId is { } supplierId:
                if (await suppliers.FindEntryByReferenceAsync(reference) is not null)
                    return;
                if (await suppliers.GetAsync(supplierId) is null)
                {
                    logger.LogWarning("Pay-out {Reference} names supplier {SupplierId}, who is not on the list - skipped", reference, supplierId);
                    return;
                }
                suppliers.AddEntry(new SupplierEntry(supplierId, @event.BranchId, SupplierEntryType.Payment, @event.Amount, day,
                    @event.Reason, @event.RecordedBy, FinanceSource.Till, reference));
                await suppliers.UnitOfWork.SaveEntitiesAsync();
                break;

            case "Expense" when payOut && @event.CategoryId is { } categoryId:
                if (await expenses.FindByReferenceAsync(reference) is not null)
                    return;
                if (await categories.GetAsync(categoryId) is null)
                {
                    logger.LogWarning("Pay-out {Reference} names category {CategoryId}, which does not exist - skipped", reference, categoryId);
                    return;
                }
                expenses.Add(new Expense(@event.BranchId, day, categoryId, @event.Amount, PaidFrom.Drawer, null,
                    null, @event.Reason, @event.RecordedBy, FinanceSource.Till, reference));
                await expenses.UnitOfWork.SaveEntitiesAsync();
                break;

            case "Partner" when @event.PartnerId is { } partnerId:
                if (await partners.FindEntryByReferenceAsync(reference) is not null)
                    return;
                var partner = await partners.GetAsync(partnerId);
                if (partner is null)
                {
                    logger.LogWarning("Movement {Reference} names partner {PartnerId}, who is not on the list - skipped", reference, partnerId);
                    return;
                }
                partners.AddEntry(new PartnerEntry(partnerId, @event.BranchId,
                    payOut ? PartnerEntryType.Drawing : PartnerEntryType.Contribution, @event.Amount, day,
                    @event.Reason, @event.RecordedBy, FinanceSource.Till, reference));
                await partners.UnitOfWork.SaveEntitiesAsync();
                break;

            default:
                logger.LogInformation("Movement {Reference} ({Kind}, {Type}) is nothing Finance accounts for - ignored", reference, @event.Kind, @event.Type);
                return;
        }

        logger.LogInformation("Movement {Reference} ({Kind}) of {Amount} posted", reference, @event.Kind, @event.Amount);
    }
}
