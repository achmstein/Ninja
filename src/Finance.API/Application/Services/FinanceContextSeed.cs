#nullable enable
using Chillax.Finance.Infrastructure;

namespace Chillax.Finance.API.Application.Services;

/// <summary>
/// The usual café expense categories, once, on an empty list. The owner
/// renames, reorders or retires them from the page; nothing here runs
/// again once a category exists.
/// </summary>
public class FinanceContextSeed(ILogger<FinanceContextSeed> logger) : IDbSeeder<FinanceContext>
{
    private static readonly (string En, string Ar)[] Defaults =
    [
        ("Rent", "إيجار"),
        ("Electricity", "كهرباء"),
        ("Gas", "غاز"),
        ("Water", "مياه"),
        ("Internet", "إنترنت"),
        ("Maintenance", "صيانة"),
        ("Marketing", "تسويق"),
        ("Licences", "رخص"),
        ("Other", "أخرى"),
    ];

    public async Task SeedAsync(FinanceContext context)
    {
        if (await context.ExpenseCategories.AnyAsync())
            return;

        var order = 0;
        foreach (var (en, ar) in Defaults)
            context.ExpenseCategories.Add(new ExpenseCategory(new LocalizedText(en, ar), order++));

        await context.SaveChangesAsync();
        logger.LogInformation("Seeded {Count} expense categories", Defaults.Length);
    }
}
