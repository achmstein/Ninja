#nullable enable
using Ninja.Finance.Infrastructure;

namespace Ninja.Finance.API.Application.Services;

/// <summary>
/// The usual business expense categories, once, on an empty list. The owner
/// renames, reorders or retires them from the page; nothing here runs
/// again once a category exists.
/// </summary>
public class FinanceContextSeed(ILogger<FinanceContextSeed> logger, TenantCountry country) : IDbSeeder<FinanceContext>
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
        // Phones kept the old local way (010…) put in the one form (+2010…); every start, unlike the categories
        var anyPhone = PhoneColumns.Any(country.Code);
        await context.KeepPhonesInOneFormAsync<Supplier>(nameof(Supplier.Phone), anyPhone);
        await context.KeepPhonesInOneFormAsync<Partner>(nameof(Partner.Phone), anyPhone);

        if (await context.ExpenseCategories.AnyAsync())
            return;

        var order = 0;
        foreach (var (en, ar) in Defaults)
            context.ExpenseCategories.Add(new ExpenseCategory(new LocalizedText(en, ar), order++));

        await context.SaveChangesAsync();
        logger.LogInformation("Seeded {Count} expense categories", Defaults.Length);
    }
}
