using Ninja.Accounts.Domain.AggregatesModel.CustomerAccountAggregate;
using Ninja.Accounts.Domain.Exceptions;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Ninja.Accounts.API.Application.Commands;

public class AddChargeCommandHandler : IRequestHandler<AddChargeCommand, bool>
{
    private readonly ICustomerAccountRepository _accountRepository;
    private readonly ILogger<AddChargeCommandHandler> _logger;

    public AddChargeCommandHandler(
        ICustomerAccountRepository accountRepository,
        ILogger<AddChargeCommandHandler> logger)
    {
        _accountRepository = accountRepository;
        _logger = logger;
    }

    public async Task<bool> Handle(AddChargeCommand request, CancellationToken cancellationToken)
    {
        var account = await _accountRepository.GetWithTransactionsByCustomerIdAsync(request.CustomerId);

        if (account == null)
        {
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

        // A referenced charge posts at most once — the bus redelivers, and a
        // customer must never pay the same ticket twice
        if (request.Reference != null && account.Transactions.Any(t => t.Reference == request.Reference))
        {
            _logger.LogInformation("Charge with reference {Reference} already posted - skipping", request.Reference);
            return true;
        }

        account.AddCharge(request.Amount, request.Description, request.AddedBy, request.Reference, request.Source, request.SourceNumber);

        _logger.LogInformation("Adding charge of {Amount} to customer {CustomerId} by {AddedBy}",
            request.Amount, request.CustomerId, request.AddedBy);

        await _accountRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        return true;
    }
}
