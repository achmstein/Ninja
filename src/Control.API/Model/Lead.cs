using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Model;

public enum LeadStatus
{
    /// <summary>Just came in from the site; nobody has answered yet.</summary>
    New = 0,
    /// <summary>Somebody talked to them; no demo yet.</summary>
    Contacted = 1,
    /// <summary>A demo was stamped for them: <see cref="Lead.TenantSlug"/> says which.</summary>
    DemoCreated = 2,
    /// <summary>Not a business, or not interested.</summary>
    Dismissed = 3,
}

/// <summary>
/// Someone who asked on the site to see Ninja on their own menu: who they
/// are, how to reach them, the menu photos they sent, and where they came
/// from (a campaign's tags, or the business whose "Powered by ninja" they
/// followed). A platform admin turns it into a demo; nothing is stamped by
/// the request itself.
/// </summary>
public class Lead
{
    public long Id { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>The person asking.</summary>
    public string Name { get; set; } = "";

    /// <summary>What their place is called.</summary>
    public string Business { get; set; } = "";

    public string Phone { get; set; } = "";

    public BusinessType BusinessType { get; set; } = BusinessType.CoffeeShop;

    /// <summary>The language of the page they asked from: en or ar.</summary>
    public string Language { get; set; } = "en";

    /// <summary>utm_source: where the visit came from (facebook, tiktok, a partner's name).</summary>
    public string? Source { get; set; }

    /// <summary>utm_medium: the kind of link (reel, ad, qr).</summary>
    public string? Medium { get; set; }

    /// <summary>utm_campaign.</summary>
    public string? Campaign { get; set; }

    /// <summary>The slug of the business whose guests' app or owner sent them.</summary>
    public string? Ref { get; set; }

    /// <summary>The site the browser came from, host only.</summary>
    public string? Referrer { get; set; }

    /// <summary>The page of the site they first landed on.</summary>
    public string? Landing { get; set; }

    public LeadStatus Status { get; set; }

    /// <summary>The demo made for them.</summary>
    public string? TenantSlug { get; set; }

    public string? Note { get; set; }

    public List<LeadPhoto> Photos { get; set; } = [];
}

/// <summary>One page of the menu a lead sent, kept as it arrived until the demo is made or the lead is deleted.</summary>
public class LeadPhoto
{
    public long Id { get; set; }

    public long LeadId { get; set; }

    public string ContentType { get; set; } = "";

    public byte[] Bytes { get; set; } = [];
}
