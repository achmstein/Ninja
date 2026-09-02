using System.Runtime.Serialization;
using MediatR;

namespace Chillax.Accounts.API.Application.Commands;

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

    public RecordPaymentCommand(
        string customerId,
        decimal amount,
        string? description,
        string recordedBy,
        string? reference = null)
    {
        CustomerId = customerId;
        Amount = amount;
        Description = description;
        RecordedBy = recordedBy;
        Reference = reference;
    }
}
