#nullable enable
using System.ComponentModel.DataAnnotations;

namespace Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// Order rating entity - allows customers to rate confirmed orders
/// </summary>
public class OrderRating : Entity
{
    public int OrderId { get; private set; }

    /// <summary>
    /// Rating value between 1 and 5 stars
    /// </summary>
    public int RatingValue { get; private set; }

    /// <summary>
    /// Optional comment from the customer (max 500 characters)
    /// </summary>
    [MaxLength(500)]
    public string? Comment { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public DateTime? UpdatedAt { get; private set; }

    // Navigation property
    public Order Order { get; private set; } = null!;

    // Required by EF Core
    protected OrderRating()
    {
    }

    public OrderRating(int orderId, int ratingValue, string? comment = null)
    {
        if (ratingValue < 1 || ratingValue > 5)
        {
            throw new OrderingDomainException("Rating value must be between 1 and 5.");
        }

        if (comment?.Length > 500)
        {
            throw new OrderingDomainException("Comment cannot exceed 500 characters.");
        }

        OrderId = orderId;
        RatingValue = ratingValue;
        Comment = comment;
        CreatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Update an existing rating
    /// </summary>
    public void Update(int ratingValue, string? comment = null)
    {
        if (ratingValue < 1 || ratingValue > 5)
        {
            throw new OrderingDomainException("Rating value must be between 1 and 5.");
        }

        if (comment?.Length > 500)
        {
            throw new OrderingDomainException("Comment cannot exceed 500 characters.");
        }

        RatingValue = ratingValue;
        Comment = comment;
        UpdatedAt = DateTime.UtcNow;
    }
}
