using System.Runtime.Serialization;
using Chillax.Accounts.Domain.AggregatesModel.CustomerAccountAggregate;
using MediatR;

namespace Chillax.Accounts.API.Application.Commands;

[DataContract]
public class AddChargeCommand : IRequest<bool>
{
    [DataMember]
    public string CustomerId { get; private set; } = string.Empty;

    [DataMember]
    public string? CustomerName { get; private set; }

    [DataMember]
    public decimal Amount { get; private set; }

    [DataMember]
    public string? Description { get; private set; }

    [DataMember]
    public string AddedBy { get; private set; } = string.Empty;

    /// <summary>
    /// What outside the ledger this charge settles (e.g. "sales-ticket:42").
    /// Unique when set; null for charges staff key in by hand.
    /// </summary>
    [DataMember]
    public string? Reference { get; private set; }

    /// <summary>Where the line comes from, and the till's number for it; Manual with no number for staff entries.</summary>
    [DataMember]
    public TransactionSource Source { get; private set; }

    [DataMember]
    public int? SourceNumber { get; private set; }

    public AddChargeCommand(
        string customerId,
        string? customerName,
        decimal amount,
        string? description,
        string addedBy,
        string? reference = null,
        TransactionSource source = TransactionSource.Manual,
        int? sourceNumber = null)
    {
        CustomerId = customerId;
        CustomerName = customerName;
        Amount = amount;
        Description = description;
        AddedBy = addedBy;
        Reference = reference;
        Source = source;
        SourceNumber = sourceNumber;
    }
}
