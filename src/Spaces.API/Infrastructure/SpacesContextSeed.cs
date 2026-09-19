using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.SeedWork;
using Ninja.Spaces.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Ninja.Spaces.API.Infrastructure;

/// <summary>
/// Plants the floor once, on an empty database, according to the stack's
/// <see cref="SeedProfile"/>: nothing for a customer (the owner draws the
/// floor), a few tables and one room for a demo, tenant one's own rooms
/// and tables for dev and tests.
/// </summary>
public class SpacesContextSeed(ILogger<SpacesContextSeed> logger, IConfiguration configuration) : IDbSeeder<SpacesContext>
{
    public async Task SeedAsync(SpacesContext context)
    {
        var profile = SeedProfile.Of(configuration);
        switch (profile)
        {
            case SeedProfile.Chillax:
                await SeedChillaxAsync(context);
                break;
            case SeedProfile.Sample:
                await SeedSampleAsync(context);
                break;
            default:
                logger.LogInformation("Seed profile {Profile}: the floor starts empty", profile);
                break;
        }
    }

    private async Task SeedSampleAsync(SpacesContext context)
    {
        if (await context.Places.AnyAsync())
        {
            return;
        }

        var places = new List<Place>();
        for (var i = 1; i <= 4; i++)
            places.Add(Place.Table(new LocalizedText($"Table {i}", $"ترابيزة {ArabicDigits(i)}"), 1));
        places.Add(Room("Room 1", "غرفة ١", 50.00m, 80.00m, 1, "A private room for groups", "غرفة خاصة للمجموعات"));

        context.Places.AddRange(places);
        await context.SaveChangesAsync();
        logger.LogInformation("Seeded the sample floor: {NumPlaces} places", places.Count);
    }

    private async Task SeedChillaxAsync(SpacesContext context)
    {
        // Rooms and tables are guarded separately: a database that already
        // has rooms may still be missing tables.
        if (!await context.Places.AnyAsync(p => p.Kind == PlaceKind.Room))
        {
            var rooms = new List<Place>
            {
                // El-Manshia (Branch 1)
                Room("Room 1", "اوضة ١", 50.00m, 80.00m, 1, "PS5 with 2 controllers and 55\" TV", "بلايستيشن 5 مع 2 دراعات وشاشة 55 بوصة"),
                Room("Room 2", "اوضة ٢", 50.00m, 80.00m, 1, "PS5 with 2 controllers and 55\" TV", "بلايستيشن 5 مع 2 دراعات وشاشة 55 بوصة"),
                Room("Room 3", "اوضة ٣", 50.00m, 80.00m, 1, "PS5 with 2 controllers and 55\" TV", "بلايستيشن 5 مع 2 دراعات وشاشة 55 بوصة"),
                Room("Room 4", "اوضة ٤", 60.00m, 90.00m, 1, "PS5 with 4 controllers and 65\" TV - Great for groups", "بلايستيشن 5 مع 4 دراعات وشاشة 65 بوصة - مناسبة للمجموعات"),
                Room("Room 5", "اوضة ٥", 70.00m, 100.00m, 1, "PS5 Pro with VR headset and 65\" TV", "بلايستيشن 5 برو مع نظارة VR وشاشة 65 بوصة"),
                Room("Room 6", "اوضة ٦", 70.00m, 100.00m, 1, "PS5 Pro with VR headset and 65\" TV", "بلايستيشن 5 برو مع نظارة VR وشاشة 65 بوصة"),
                Room("Room VIP", "اوضة VIP", 150.00m, 200.00m, 1, "Premium VIP room with 2 PS5 Pro consoles, VR headsets, 75\" OLED TV, premium sound system, and private lounge area - Fits up to 10 people", "اوضة VIP مميزة مع 2 بلايستيشن 5 برو، نظارات VR، شاشة OLED 75 بوصة، نظام صوت مميز، ومنطقة جلوس خاصة - تتسع حتى 10 أشخاص"),
                // El-Benzina (Branch 2)
                Room("Room 1", "اوضة ١", 50.00m, 80.00m, 2, "PS5 with 2 controllers and 55\" TV", "بلايستيشن 5 مع 2 دراعات وشاشة 55 بوصة"),
                Room("Room 2", "اوضة ٢", 50.00m, 80.00m, 2, "PS5 with 2 controllers and 55\" TV", "بلايستيشن 5 مع 2 دراعات وشاشة 55 بوصة"),
                Room("Room 3", "اوضة ٣", 50.00m, 80.00m, 2, "PS5 with 2 controllers and 55\" TV", "بلايستيشن 5 مع 2 دراعات وشاشة 55 بوصة"),
                Room("Room VIP", "اوضة VIP", 150.00m, 200.00m, 2, "Premium VIP room with 2 PS5 Pro consoles, VR headsets, 75\" OLED TV, premium sound system, and private lounge area", "اوضة VIP مميزة مع 2 بلايستيشن 5 برو، نظارات VR، شاشة OLED 75 بوصة، نظام صوت مميز، ومنطقة جلوس خاصة"),
            };

            context.Places.AddRange(rooms);
            await context.SaveChangesAsync();
            logger.LogInformation("Seeded {NumRooms} rooms", rooms.Count);
        }

        if (!await context.Places.AnyAsync(p => p.Kind == PlaceKind.Table))
        {
            var tables = new List<Place>();

            // El-Manshia (Branch 1): four tables and the high chairs at the bar
            for (var i = 1; i <= 4; i++)
                tables.Add(Place.Table(new LocalizedText($"Table {i}", $"ترابيزة {ArabicDigits(i)}"), 1));
            tables.Add(Place.Table(new LocalizedText("High Chairs", "الكراسي العالية"), 1));

            // El-Benzina (Branch 2)
            for (var i = 1; i <= 5; i++)
                tables.Add(Place.Table(new LocalizedText($"Table {i}", $"ترابيزة {ArabicDigits(i)}"), 2));

            context.Places.AddRange(tables);
            await context.SaveChangesAsync();
            logger.LogInformation("Seeded {NumTables} tables", tables.Count);
        }
    }

    private static Place Room(string en, string ar, decimal single, decimal multi, int branchId, string descEn, string descAr)
        => Place.Room(new LocalizedText(en, ar), single, multi, branchId, new LocalizedText(descEn, descAr));

    // Arabic-Indic numerals for the Arabic name, so a table reads ترابيزة ١
    // the way the rooms read اوضة ١ rather than mixing Western digits in.
    private static string ArabicDigits(int n) => n.ToString()
        .Replace('0', '٠').Replace('1', '١').Replace('2', '٢').Replace('3', '٣').Replace('4', '٤')
        .Replace('5', '٥').Replace('6', '٦').Replace('7', '٧').Replace('8', '٨').Replace('9', '٩');
}
