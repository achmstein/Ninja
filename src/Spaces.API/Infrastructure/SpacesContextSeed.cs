using Chillax.Spaces.Domain.AggregatesModel.RoomAggregate;
using Chillax.Spaces.Domain.AggregatesModel.TableAggregate;
using Chillax.Spaces.Infrastructure;
using Microsoft.Extensions.Logging;

namespace Chillax.Spaces.API.Infrastructure;

public class SpacesContextSeed(ILogger<SpacesContextSeed> logger) : IDbSeeder<SpacesContext>
{
    public async Task SeedAsync(SpacesContext context)
    {
        if (!context.Rooms.Any())
        {
            var rooms = new List<Room>
            {
                // El-Manshia (Branch 1)
                new("Room 1", 50.00m, 80.00m, 1, "PS5 with 2 controllers and 55\" TV", "اوضة ١", "بلايستيشن 5 مع 2 دراعات وشاشة 55 بوصة"),
                new("Room 2", 50.00m, 80.00m, 1, "PS5 with 2 controllers and 55\" TV", "اوضة ٢", "بلايستيشن 5 مع 2 دراعات وشاشة 55 بوصة"),
                new("Room 3", 50.00m, 80.00m, 1, "PS5 with 2 controllers and 55\" TV", "اوضة ٣", "بلايستيشن 5 مع 2 دراعات وشاشة 55 بوصة"),
                new("Room 4", 60.00m, 90.00m, 1, "PS5 with 4 controllers and 65\" TV - Great for groups", "اوضة ٤", "بلايستيشن 5 مع 4 دراعات وشاشة 65 بوصة - مناسبة للمجموعات"),
                new("Room 5", 70.00m, 100.00m, 1, "PS5 Pro with VR headset and 65\" TV", "اوضة ٥", "بلايستيشن 5 برو مع نظارة VR وشاشة 65 بوصة"),
                new("Room 6", 70.00m, 100.00m, 1, "PS5 Pro with VR headset and 65\" TV", "اوضة ٦", "بلايستيشن 5 برو مع نظارة VR وشاشة 65 بوصة"),
                new("Room VIP", 150.00m, 200.00m, 1, "Premium VIP room with 2 PS5 Pro consoles, VR headsets, 75\" OLED TV, premium sound system, and private lounge area - Fits up to 10 people", "اوضة VIP", "اوضة VIP مميزة مع 2 بلايستيشن 5 برو، نظارات VR، شاشة OLED 75 بوصة، نظام صوت مميز، ومنطقة جلوس خاصة - تتسع حتى 10 أشخاص"),
                // El-Benzina (Branch 2)
                new("Room 1", 50.00m, 80.00m, 2, "PS5 with 2 controllers and 55\" TV", "اوضة ١", "بلايستيشن 5 مع 2 دراعات وشاشة 55 بوصة"),
                new("Room 2", 50.00m, 80.00m, 2, "PS5 with 2 controllers and 55\" TV", "اوضة ٢", "بلايستيشن 5 مع 2 دراعات وشاشة 55 بوصة"),
                new("Room 3", 50.00m, 80.00m, 2, "PS5 with 2 controllers and 55\" TV", "اوضة ٣", "بلايستيشن 5 مع 2 دراعات وشاشة 55 بوصة"),
                new("Room VIP", 150.00m, 200.00m, 2, "Premium VIP room with 2 PS5 Pro consoles, VR headsets, 75\" OLED TV, premium sound system, and private lounge area", "اوضة VIP", "اوضة VIP مميزة مع 2 بلايستيشن 5 برو، نظارات VR، شاشة OLED 75 بوصة، نظام صوت مميز، ومنطقة جلوس خاصة")
            };

            context.Rooms.AddRange(rooms);
            await context.SaveChangesAsync();
            logger.LogInformation("Seeded {NumRooms} rooms", rooms.Count);
        }

        // Guarded separately from rooms: existing databases already have rooms, so the
        // check above never fires there and tables would otherwise never be seeded.
        if (!context.Tables.Any())
        {
            var tables = new List<Table>();

            // El-Manshia (Branch 1): four tables and the high chairs at the bar
            for (var i = 1; i <= 4; i++)
            {
                tables.Add(new Table($"Table {i}", 1, $"ترابيزة {ArabicDigits(i)}"));
            }
            tables.Add(new Table("High Chairs", 1, "الكراسي العالية"));

            // El-Benzina (Branch 2)
            for (var i = 1; i <= 5; i++)
            {
                tables.Add(new Table($"Table {i}", 2, $"ترابيزة {ArabicDigits(i)}"));
            }

            context.Tables.AddRange(tables);
            await context.SaveChangesAsync();
            logger.LogInformation("Seeded {NumTables} tables", tables.Count);
        }
    }
    // Arabic-Indic numerals for the Arabic name, so a table reads ترابيزة ١
    // the way the rooms read اوضة ١ rather than mixing Western digits in.
    private static string ArabicDigits(int n) => n.ToString()
        .Replace('0', '٠').Replace('1', '١').Replace('2', '٢').Replace('3', '٣').Replace('4', '٤')
        .Replace('5', '٥').Replace('6', '٦').Replace('7', '٧').Replace('8', '٨').Replace('9', '٩');
}
