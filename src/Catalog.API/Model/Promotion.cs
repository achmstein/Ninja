namespace Ninja.Catalog.API.Model;

/// <summary>Where a promotion's button takes the customer</summary>
public enum PromotionLink
{
    /// <summary>Nowhere: the popup only shows</summary>
    None = 0,
    /// <summary>An item, opened (<see cref="Promotion.LinkId"/> the item)</summary>
    Item = 1,
    /// <summary>A category of the menu (<see cref="Promotion.LinkId"/> the category)</summary>
    Category = 2,
    /// <summary>The Book tab: the rooms and places to book</summary>
    Book = 3,
}

/// <summary>
/// Something the business promotes in the customer app: a designed picture
/// (the owner's own, or one the image model made from the owner's real photo
/// with the headline drawn in) shown once to each customer as a popup when
/// the app opens, while it runs, then kept as a small banner. Its button
/// opens an item, a category or booking. One runs at a time per branch: the
/// newest one live there.
/// </summary>
public class Promotion
{
    public const int HeadlineMaxLength = 80;

    public int Id { get; set; }

    /// <summary>What it says, as the owner typed it: drawn into the picture, and kept as text for screen readers and the banner</summary>
    public LocalizedText Headline { get; set; } = new();

    /// <summary>The picture shown; a promotion with none is not shown</summary>
    public string? PictureFileName { get; set; }

    public PromotionLink Link { get; set; }

    /// <summary>The item or category the button opens, per <see cref="Link"/></summary>
    public int? LinkId { get; set; }

    /// <summary>The branches it runs at; empty for every branch</summary>
    public List<int> BranchIds { get; set; } = [];

    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }

    /// <summary>Which days it shows: a bit per <see cref="DayOfWeek"/>; null or 0 is every day (as an item's offer)</summary>
    public int? Weekdays { get; set; }

    /// <summary>Its hours, local time; both null is all day. Ending before it starts runs past midnight</summary>
    public TimeOnly? ShowFrom { get; set; }
    public TimeOnly? ShowTo { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    /// <summary>Switched on, with a picture, inside its dates and hours, at <paramref name="branchId"/> (any branch when null)</summary>
    public bool IsLiveAt(int? branchId, DateTime utcNow, DateTime local)
        => IsActive
           && !string.IsNullOrEmpty(PictureFileName)
           && (StartsAt is not { } from || utcNow >= from)
           && (EndsAt is not { } to || utcNow < to)
           && (BranchIds.Count == 0 || branchId is null || BranchIds.Contains(branchId.Value))
           && OfferWindow.Covers(Weekdays, ShowFrom, ShowTo, local);
}
