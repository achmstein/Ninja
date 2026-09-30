#nullable enable
using Ninja.Ordering.Domain.Seedwork;

namespace Ninja.Ordering.API.Extensions;

public static class BasketItemExtensions
{
    public static IEnumerable<OrderItemDTO> ToOrderItemsDTO(this IEnumerable<BasketItem> basketItems)
    {
        foreach (var item in basketItems)
        {
            yield return item.ToOrderItemDTO();
        }
    }

    public static OrderItemDTO ToOrderItemDTO(this BasketItem item)
    {
        // Build localized customizations description
        LocalizedText? customizationsDescription = null;
        if (item.SelectedCustomizations.Count > 0)
        {
            customizationsDescription = BuildLocalizedCustomizations(item.SelectedCustomizations);
        }

        return new OrderItemDTO()
        {
            ProductId = item.ProductId,
            ProductName = item.ProductName,
            PictureUrl = item.PictureUrl,
            // Use TotalPrice which includes customization adjustments
            UnitPrice = item.TotalPrice,
            Units = item.Quantity,
            SpecialInstructions = item.SpecialInstructions,
            CustomizationsDescription = customizationsDescription,
            // Kept structured beside the description: Inventory deducts an
            // option's ingredients by id, never by parsing the text
            OptionIds = item.SelectedCustomizations.Count > 0
                ? item.SelectedCustomizations.Select(c => c.OptionId).Where(id => id > 0).Distinct().ToList()
                : null
        };
    }

    private static LocalizedText BuildLocalizedCustomizations(List<BasketItemCustomization> customizations)
    {
        // A language any option is written in gets the whole line, an option
        // not written in it read in the other; a language none is written in
        // stays empty
        var names = customizations.Select(c => c.OptionName ?? new LocalizedText()).ToList();
        return new LocalizedText(
            names.Any(n => n.En is not null) ? string.Join(", ", names.Select(n => n.Get("en"))) : null,
            names.Any(n => n.Ar is not null) ? string.Join(", ", names.Select(n => n.Get("ar"))) : null);
    }
}
