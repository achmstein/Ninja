using System.Runtime.Serialization;
using Ninja.Accounts.Domain.AggregatesModel.CustomerAccountAggregate;
using MediatR;

namespace Ninja.Accounts.API.Application.Commands;

[DataContract]
public class RecordPaymentCommand : IRequest<bool>
{
    [DataMember]
    public string CustomerId { get; private set; } = string.Empty;

    [DataMember]
    public decimal Amount { get; private set; }

    [DataMember]
    public string? Description { get; private set; }

    [DataMember]
    public string RecordedBy { get; private set; } = string.Empty;

    /// <summary>
    /// What outside the ledger this payment settles (e.g. "sales-refund:42").
    /// Unique when set; null for payments staff key in by hand.
    /// </summary>
    [DataMember]
    public string? Reference { get; private set; }

    /// <summary>Where the line comes from, and the till's number for it; Manual with no number for staff entries.</summary>
    [DataMember]
    public TransactionSource Source { get; private set; }

    [DataMember]
    public int? SourceNumber { get; private set; }

    /// <summary>
    /// The customer's name as the till knows it. Set only by the till: a
    /// payment taken there must land even when no tab exists yet, so the
    /// account is opened with this name. Staff paying by hand leave it null
    /// and get "not found" instead.
    /// </summary>
    [DataMember]
    public string? CustomerName { get; private set; }

    public RecordPaymentCommand(
        string customerId,
        decimal amount,
        string? description,
        string recordedBy,
        string? reference = null,
        TransactionSource source = TransactionSource.Manual,
        int? sourceNumber = null,
        string? customerName = null)
    {
        CustomerName = customerName;
        CustomerId = customerId;
        Amount = amount;
        Description = description;
        RecordedBy = recordedBy;
        Reference = reference;
        Source = source;
        SourceNumber = sourceNumber;
    }
}
