using Chillax.Catalog.API.Model;

namespace Chillax.Catalog.API.Dtos;

/// <summary>
/// Extension methods for mapping entities to DTOs
/// </summary>
public static class CatalogMappers
{
    private static readonly IReadOnlySet<int> NoOptionStockOuts = new HashSet<int>();

    public static CatalogItemDto ToDto(this CatalogItem item, string? baseUrl = null)
    {
        return new CatalogItemDto
        {
            Id = item.Id,
            Name = item.Name,
            Description = item.Description,
            Price = item.Price,
            PictureUri = string.IsNullOrEmpty(item.PictureFileName)
                ? null
                : $"{baseUrl}/api/catalog/items/{item.Id}/pic?v={Uri.EscapeDataString(item.PictureFileName)}",
            CatalogTypeId = item.CatalogTypeId,
            CatalogTypeName = item.CatalogType?.Name ?? new LocalizedText(),
            IsAvailable = item.IsAvailable,
            IsOnOffer = item.IsOnOffer,
            OfferPrice = item.OfferPrice,
            EffectivePrice = item.EffectivePrice,
            IsPopular = item.IsPopular,
            PreparationTimeMinutes = item.PreparationTimeMinutes,
            DisplayOrder = item.DisplayOrder,
            Customizations = item.Customizations.OrderBy(c => c.DisplayOrder).Select(c => c.ToDto()).ToList()
        };
    }

    /// <summary>
    /// Maps a catalog item to DTO with branch-specific overrides applied.
    /// </summary>
    public static CatalogItemDto ToDto(this CatalogItem item, BranchItemOverride? branchOverride, IReadOnlySet<int> outOfStockOptionIds, string? baseUrl = null)
    {
        if (branchOverride == null)
            return item.ToDto(baseUrl) with
            {
                Customizations = item.Customizations.OrderBy(c => c.DisplayOrder).Select(c => c.ToDto(outOfStockOptionIds)).ToList()
            };

        var isOnOffer = branchOverride.IsOnOfferOverride ?? item.IsOnOffer;
        var price = branchOverride.PriceOverride ?? item.Price;
        var offerPrice = branchOverride.OfferPriceOverride ?? item.OfferPrice;
        var effectivePrice = isOnOffer && offerPrice.HasValue ? offerPrice.Value : price;

        return new CatalogItemDto
        {
            Id = item.Id,
            Name = item.Name,
            Description = item.Description,
            Price = price,
            PictureUri = string.IsNullOrEmpty(item.PictureFileName)
                ? null
                : $"{baseUrl}/api/catalog/items/{item.Id}/pic?v={Uri.EscapeDataString(item.PictureFileName)}",
            CatalogTypeId = item.CatalogTypeId,
            CatalogTypeName = item.CatalogType?.Name ?? new LocalizedText(),
            // A branch can only restrict: a global sold-out always wins, and a
            // stock-out is a restriction Inventory applies on top of the manual switch
            IsAvailable = item.IsAvailable && branchOverride.IsAvailable && !branchOverride.IsOutOfStock,
            IsOutOfStock = branchOverride.IsOutOfStock,
            IsOnOffer = isOnOffer,
            OfferPrice = offerPrice,
            EffectivePrice = effectivePrice,
            IsPopular = item.IsPopular,
            PreparationTimeMinutes = item.PreparationTimeMinutes,
            DisplayOrder = item.DisplayOrder,
            Customizations = item.Customizations.OrderBy(c => c.DisplayOrder).Select(c => c.ToDto(outOfStockOptionIds)).ToList(),
            Base = new CatalogItemBaseDto(item.Price, item.OfferPrice, item.IsOnOffer, item.IsAvailable)
        };
    }

    public static List<CatalogItemDto> ToDtoList(this IEnumerable<CatalogItem> items, string? baseUrl = null)
    {
        return items.Select(i => i.ToDto(baseUrl)).ToList();
    }

    /// <summary>
    /// Maps items to DTOs with branch-specific overrides applied.
    /// </summary>
    public static List<CatalogItemDto> ToDtoList(this IEnumerable<CatalogItem> items, Dictionary<int, BranchItemOverride> overrides, IReadOnlySet<int> outOfStockOptionIds, string? baseUrl = null)
    {
        return items.Select(i => i.ToDto(overrides.GetValueOrDefault(i.Id), outOfStockOptionIds, baseUrl)).ToList();
    }

    public static CatalogTypeDto ToDto(this CatalogType type)
    {
        return new CatalogTypeDto
        {
            Id = type.Id,
            Name = type.Name,
            DisplayOrder = type.DisplayOrder
        };
    }

    public static List<CatalogTypeDto> ToDtoList(this IEnumerable<CatalogType> types)
    {
        return types.Select(t => t.ToDto()).ToList();
    }

    public static ItemCustomizationDto ToDto(this ItemCustomization customization)
    {
        return customization.ToDto(NoOptionStockOuts);
    }

    /// <summary>
    /// Maps a customization with a branch's option stock-outs applied.
    /// </summary>
    public static ItemCustomizationDto ToDto(this ItemCustomization customization, IReadOnlySet<int> outOfStockOptionIds)
    {
        return new ItemCustomizationDto
        {
            Id = customization.Id,
            Name = customization.Name,
            IsRequired = customization.IsRequired,
            AllowMultiple = customization.AllowMultiple,
            DisplayOrder = customization.DisplayOrder,
            Options = customization.Options.OrderBy(o => o.DisplayOrder).Select(o => o.ToDto(outOfStockOptionIds)).ToList()
        };
    }

    public static List<ItemCustomizationDto> ToDtoList(this IEnumerable<ItemCustomization> customizations)
    {
        return customizations.Select(c => c.ToDto()).ToList();
    }

    /// <summary>
    /// Maps customizations with a branch's option stock-outs applied.
    /// </summary>
    public static List<ItemCustomizationDto> ToDtoList(this IEnumerable<ItemCustomization> customizations, IReadOnlySet<int> outOfStockOptionIds)
    {
        return customizations.Select(c => c.ToDto(outOfStockOptionIds)).ToList();
    }

    public static CustomizationOptionDto ToDto(this CustomizationOption option)
    {
        return option.ToDto(NoOptionStockOuts);
    }

    /// <summary>
    /// Maps an option, flagging it sold out when the branch's stock-outs name it.
    /// </summary>
    public static CustomizationOptionDto ToDto(this CustomizationOption option, IReadOnlySet<int> outOfStockOptionIds)
    {
        return new CustomizationOptionDto
        {
            Id = option.Id,
            Name = option.Name,
            PriceAdjustment = option.PriceAdjustment,
            IsDefault = option.IsDefault,
            DisplayOrder = option.DisplayOrder,
            IsOutOfStock = outOfStockOptionIds.Contains(option.Id)
        };
    }

    public static UserItemPreferenceDto ToDto(this UserItemPreference preference)
    {
        return new UserItemPreferenceDto
        {
            CatalogItemId = preference.CatalogItemId,
            LastUpdated = preference.LastUpdated,
            SelectedOptions = preference.SelectedOptions
                .Select(o => new UserPreferenceOptionDto
                {
                    CustomizationId = o.CustomizationId,
                    OptionId = o.OptionId
                })
                .ToList()
        };
    }

    public static List<UserItemPreferenceDto> ToDtoList(this IEnumerable<UserItemPreference> preferences)
    {
        return preferences.Select(p => p.ToDto()).ToList();
    }

    public static BundleDealDto ToDto(this BundleDeal bundle, string? baseUrl = null)
    {
        return new BundleDealDto
        {
            Id = bundle.Id,
            Name = bundle.Name,
            Description = bundle.Description,
            BundlePrice = bundle.BundlePrice,
            OriginalPrice = bundle.Items.Sum(i => (i.CatalogItem?.Price ?? 0) * i.Quantity),
            PictureUri = string.IsNullOrEmpty(bundle.PictureFileName)
                ? null
                : $"{baseUrl}/api/catalog/bundles/{bundle.Id}/pic?v={Uri.EscapeDataString(bundle.PictureFileName)}",
            IsActive = bundle.IsActive,
            DisplayOrder = bundle.DisplayOrder,
            Items = bundle.Items.Select(i => i.ToDto()).ToList()
        };
    }

    public static List<BundleDealDto> ToDtoList(this IEnumerable<BundleDeal> bundles, string? baseUrl = null)
    {
        return bundles.Select(b => b.ToDto(baseUrl)).ToList();
    }

    public static BundleDealItemDto ToDto(this BundleDealItem item)
    {
        return new BundleDealItemDto
        {
            Id = item.Id,
            CatalogItemId = item.CatalogItemId,
            ItemName = item.CatalogItem?.Name ?? new LocalizedText(),
            ItemPrice = item.CatalogItem?.Price ?? 0,
            Quantity = item.Quantity
        };
    }
}
