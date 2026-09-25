using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>
/// What the new-tenant wizard chose, put on a running stack: the name and
/// color, the locale, which Arabic it speaks, the light or dark a new person
/// starts in, and what kind of place it is. The stack's tenant endpoint takes
/// the whole brand at once, so the brand is read, these fields changed, and
/// the rest — theme, switches, customer URL — sent back as the stack had it.
/// </summary>
public static class StackSettings
{
    /// <summary>The fields Branch.API's PUT /api/tenant reads; the rest of its answer is its own.</summary>
    private static readonly string[] Writable = ["name", "primaryColor", "customerUrl", "features", "theme", "locale"];

    /// <summary>The brand the stack would keep, with the record's settings on it.</summary>
    public static JsonObject Apply(JsonObject current, Tenant tenant)
    {
        var brand = new JsonObject();
        foreach (var key in Writable)
        {
            if (current[key] is { } value) brand[key] = value.DeepClone();
        }
        brand["name"] = new JsonObject { ["en"] = tenant.NameEn, ["ar"] = tenant.NameAr };
        brand["primaryColor"] = tenant.PrimaryColor;
        var theme = brand["theme"] as JsonObject ?? new JsonObject();
        theme["mode"] = tenant.DefaultTheme;
        brand["theme"] = theme;
        brand["locale"] = new JsonObject
        {
            ["country"] = tenant.Country, ["currency"] = tenant.Currency, ["timeZone"] = tenant.TimeZone, ["language"] = tenant.DefaultLanguage,
            ["arabicStyle"] = tenant.ArabicStyle,
        };
        // Only the label: the switches, the menu and whether guests order away from a table stay as the café has them
        brand["businessType"] = BusinessProfiles.Key(tenant.BusinessType);
        return brand;
    }

    /// <summary>Puts the record's settings on the stack; null when it took them, else why not.</summary>
    public static async Task<string?> PushAsync(IStackProxy stack, Tenant tenant, CancellationToken ct)
    {
        using var get = await stack.SendAsync(tenant, HttpMethod.Get, "/api/tenant", null, StackAuth.Anonymous, ct);
        if (!get.IsSuccessStatusCode)
            return $"The stack answered {(int)get.StatusCode} reading its brand.";
        var current = await get.Content.ReadFromJsonAsync<JsonObject>(ct) ?? new JsonObject();

        using var put = await stack.SendAsync(tenant, HttpMethod.Put, "/api/tenant", JsonContent.Create(Apply(current, tenant)), StackAuth.Control, ct);
        return put.IsSuccessStatusCode
            ? null
            : $"The stack answered {(int)put.StatusCode}: {await put.Content.ReadAsStringAsync(ct)}";
    }
}
