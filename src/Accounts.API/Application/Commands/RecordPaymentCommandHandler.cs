using Chillax.Accounts.Domain.AggregatesModel.CustomerAccountAggregate;
using Chillax.Accounts.Domain.Exceptions;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Chillax.Accounts.API.Application.Commands;

public class RecordPaymentCommandHandler : IRequestHandler<RecordPaymentCommand, bool>
{
    private readonly ICustomerAccountRepository _accountRepository;
    private readonly ILogger<RecordPaymentCommandHandler> _logger;

    public RecordPaymentCommandHandler(
        ICustomerAccountRepository accountRepository,
        ILogger<RecordPaymentCommandHandler> logger)
    {
        _accountRepository = accountRepository;
        _logger = logger;
    }

    public async Task<bool> Handle(RecordPaymentCommand request, CancellationToken cancellationToken)
    {
        var account = await _accountRepository.GetWithTransactionsByCustomerIdAsync(request.CustomerId);

        if (account == null)
        {
            // Money the till already took cannot be refused for want of a
            // row: open the tab and let it go into credit. By hand, a tab
            // that was never charged has nothing to pay.
            if (request.CustomerName == null)
                throw new AccountsDomainException($"Account not found for customer {request.CustomerId}");

            account = new CustomerAccount(request.CustomerId, request.CustomerName);
            _accountRepository.Add(account);
            await _accountRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

            account = await _accountRepository.GetWithTransactionsByCustomerIdAsync(request.CustomerId);
            if (account == null)
                throw new AccountsDomainException("Failed to create customer account");
        }
        else if (request.CustomerName != null && account.CustomerName != request.CustomerName)
        {
            account.UpdateCustomerName(request.CustomerName);
        }

        // A referenced payment posts at most once — the bus redelivers, and a
        // credit note must never credit a tab twice
        if (request.Reference != null && account.Transactions.Any(t => t.Reference == request.Reference))
        {
            _logger.LogInformation("Payment with reference {Reference} already posted - skipping", request.Reference);
            return true;
        }

        account.RecordPayment(request.Amount, request.Description, request.RecordedBy, request.Reference, request.Source, request.SourceNumber);

        _logger.LogInformation("Recording payment of {Amount} for customer {CustomerId} by {RecordedBy}",
            request.Amount, request.CustomerId, request.RecordedBy);

        await _accountRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        return true;
    }
}
