namespace Ninja.Accounts.UnitTests.Application;

using Ninja.Accounts.API.Application.Commands;
using Ninja.Accounts.Domain.AggregatesModel.CustomerAccountAggregate;
using Ninja.Accounts.Domain.Exceptions;
using Ninja.Accounts.Domain.SeedWork;
using Microsoft.Extensions.Logging;
using NSubstitute;

/// <summary>
/// A payment the till already took must land on the ledger even when the
/// customer has no tab yet; a payment keyed in by hand against a tab that
/// was never charged is a mistake. The name on the command tells them apart.
/// </summary>
[TestClass]
public class RecordPaymentCommandHandlerTest
{
    private readonly ICustomerAccountRepository _repository = Substitute.For<ICustomerAccountRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly ILogger<RecordPaymentCommandHandler> _logger = Substitute.For<ILogger<RecordPaymentCommandHandler>>();

    public RecordPaymentCommandHandlerTest()
    {
        _repository.UnitOfWork.Returns(_unitOfWork);
        _unitOfWork.SaveEntitiesAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult(true));
    }

    private static RecordPaymentCommand FromTill(string? name = "Ahmed", string reference = "sales-tab-payment:9") =>
        new("u1", 100, null, "cashier", reference, TransactionSource.PosTabPayment, 3, name);

    [TestMethod]
    public async Task Opens_the_tab_when_the_till_names_a_customer_without_one()
    {
        // Arrange: no account on the first read, the freshly added one after
        CustomerAccount? created = null;
        _repository.Add(Arg.Do<CustomerAccount>(a => created = a)).Returns(x => x.Arg<CustomerAccount>());
        _repository.GetWithTransactionsByCustomerIdAsync("u1").Returns(
            _ => Task.FromResult<CustomerAccount?>(null),
            _ => Task.FromResult(created));

        // Act
        var handler = new RecordPaymentCommandHandler(_repository, _logger);
        await handler.Handle(FromTill(), CancellationToken.None);

        // Assert
        Assert.IsNotNull(created);
        Assert.AreEqual("Ahmed", created.CustomerName);
        Assert.AreEqual(-100m, created.Balance);
        Assert.AreEqual(TransactionSource.PosTabPayment, created.Transactions.Single().Source);
        await _unitOfWork.Received(2).SaveEntitiesAsync(Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task By_hand_a_missing_tab_is_not_found()
    {
        _repository.GetWithTransactionsByCustomerIdAsync("u1").Returns(Task.FromResult<CustomerAccount?>(null));

        var handler = new RecordPaymentCommandHandler(_repository, _logger);

        await Assert.ThrowsExactlyAsync<AccountsDomainException>(() =>
            handler.Handle(new RecordPaymentCommand("u1", 100, "cash at the office", "admin"), CancellationToken.None));
        _repository.DidNotReceive().Add(Arg.Any<CustomerAccount>());
    }

    [TestMethod]
    public async Task A_redelivered_slip_posts_once()
    {
        var account = new CustomerAccount("u1", "Ahmed");
        account.RecordPayment(100, null, "cashier", "sales-tab-payment:9", TransactionSource.PosTabPayment, 3);
        _repository.GetWithTransactionsByCustomerIdAsync("u1").Returns(Task.FromResult<CustomerAccount?>(account));

        var handler = new RecordPaymentCommandHandler(_repository, _logger);
        await handler.Handle(FromTill(), CancellationToken.None);

        Assert.AreEqual(1, account.Transactions.Count);
        Assert.AreEqual(-100m, account.Balance);
        await _unitOfWork.DidNotReceive().SaveEntitiesAsync(Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task The_tills_name_refreshes_a_stale_one()
    {
        var account = new CustomerAccount("u1", "Ahmd");
        _repository.GetWithTransactionsByCustomerIdAsync("u1").Returns(Task.FromResult<CustomerAccount?>(account));

        var handler = new RecordPaymentCommandHandler(_repository, _logger);
        await handler.Handle(FromTill(), CancellationToken.None);

        Assert.AreEqual("Ahmed", account.CustomerName);
        Assert.AreEqual(-100m, account.Balance);
    }
}
