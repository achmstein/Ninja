#nullable enable
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Ninja.ServiceDefaults;

namespace Microsoft.AspNetCore.Hosting;

/// <summary>
/// Numbers written before numbers had one form (010…, where +2010… is kept now), rewritten where they
/// lie. Run at start, after the migrations, like a migration for what the columns hold: it needs the
/// country and the numbering plan, which SQL has neither of. Repeat-safe: a number already in the
/// form is not looked at, and what is not a number (a hotline's 19019, a note) is left as it is.
/// </summary>
internal static class PhoneColumns
{
    /// <summary>A customer's number: a mobile of the business's country, or left alone.</summary>
    public static Func<string, string?> Customer(string country) =>
        phone => PhoneRules.IsValid(phone, country) ? PhoneRules.Normalize(phone, country) : null;

    /// <summary>Any phone (a branch's, a supplier's, a member of staff's): any real number, or left alone.</summary>
    public static Func<string, string?> Any(string country) =>
        phone => PhoneRules.Tidy(phone, country) is { } tidy && tidy.StartsWith('+') ? tidy : null;

    /// <summary>
    /// Rewrites one column of <typeparamref name="TEntity"/> (or of the part of it named by
    /// <paramref name="owned"/>). Returns how many different numbers were rewritten.
    /// </summary>
    public static async Task<int> KeepPhonesInOneFormAsync<TEntity>(
        this DbContext context, string property, Func<string, string?> inOneForm, string? owned = null)
        where TEntity : class
    {
        var entity = context.Model.FindEntityType(typeof(TEntity))
            ?? throw new InvalidOperationException($"{typeof(TEntity).Name} is not in {context.GetType().Name}");
        if (owned is not null)
        {
            entity = entity.FindNavigation(owned)?.TargetEntityType
                ?? throw new InvalidOperationException($"{typeof(TEntity).Name} has no {owned}");
        }
        var tableName = entity.GetTableName() ?? throw new InvalidOperationException($"{entity.Name} has no table");
        var store = StoreObjectIdentifier.Table(tableName, entity.GetSchema());
        var columnName = entity.FindProperty(property)?.GetColumnName(store)
            ?? throw new InvalidOperationException($"{entity.Name} has no column for {property}");

        // Names from the model, quoted: nothing here is anyone's input
        var table = entity.GetSchema() is { } schema ? $"\"{schema}\".\"{tableName}\"" : $"\"{tableName}\"";
        var column = $"\"{columnName}\"";

#pragma warning disable EF1002 // The table and column come from the model, the numbers go in as parameters
        var kept = await context.Database
            .SqlQueryRaw<string>($"SELECT DISTINCT {column} AS \"Value\" FROM {table} WHERE {column} IS NOT NULL AND {column} NOT LIKE '+%'")
            .ToListAsync();

        var rewritten = 0;
        foreach (var old in kept)
        {
            if (inOneForm(old) is not { } phone || phone == old) continue;
            await context.Database.ExecuteSqlRawAsync($"UPDATE {table} SET {column} = {{0}} WHERE {column} = {{1}}", phone, old);
            rewritten++;
        }
#pragma warning restore EF1002
        return rewritten;
    }
}
