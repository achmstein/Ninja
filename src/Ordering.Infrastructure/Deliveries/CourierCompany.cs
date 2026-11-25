#nullable enable
namespace Ninja.Ordering.Infrastructure.Deliveries;

/// <summary>
/// A courier company the business hands deliveries to when it has no rider for one: listed by the
/// owner in admin, offered at the till after the branch's riders. A manual courier: the till tells
/// the company by phone and marks the delivery's steps itself. Business-wide, for every branch.
/// Never deleted, only switched off, so the deliveries it carried keep their company.
/// </summary>
public class CourierCompany
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>The number the till rings to send it a delivery.</summary>
    public string? Phone { get; set; }

    /// <summary>What it usually charges per delivery; the till may change it for one.</summary>
    public decimal? DefaultFee { get; set; }

    /// <summary>Offered at the till; switched off, it carries no new delivery.</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Where its system takes Ninja's jobs ("https://api.courier.example/ninja"): set, the company is
    /// connected and a delivery given to it is sent as a job, its steps coming back on their own;
    /// null, a manual courier told by phone, its steps marked at the till.
    /// </summary>
    public string? ApiBaseUrl { get; set; }

    /// <summary>The key the company gave the business for its system, sealed with the stack's key.</summary>
    public string? SealedApiKey { get; set; }

    /// <summary>The secret its status calls are signed with, made by Ninja and given to the company, sealed.</summary>
    public string? SealedWebhookSecret { get; set; }

    /// <summary>
    /// The job id the company gave the last test job the owner sent from admin: a status for it is
    /// checked (signature, body) and answered, and changes no order.
    /// </summary>
    public string? TestJobId { get; set; }

    /// <summary>Connected: a delivery given to it is sent to its system as a job.</summary>
    public bool IsConnected => !string.IsNullOrWhiteSpace(ApiBaseUrl);

    public DateTime CreatedAt { get; set; }
}
