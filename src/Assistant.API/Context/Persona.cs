using System.Net.Http.Json;
using System.Text;
using Microsoft.Extensions.Caching.Memory;
using Ninja.Assistant.API.Downstream;

namespace Ninja.Assistant.API.Context;

/// <summary>What the owner set for their assistant (Tenant.API's assistant settings); every part optional.</summary>
public sealed record AssistantSettingsDto(string? Name, string? Tone, string? Manner, string? Language, string? Notes);

/// <summary>
/// The brief a chat app is handed when it connects: who the assistant is
/// for this café, how it works, and how it speaks. The platform writes the
/// role and the rules; the owner's settings (name, tone, manner, language,
/// notes) are folded in. The café's name and settings are read from the
/// stack's public brand, once a minute at most, so a change on the admin
/// page reaches the next chat. It is guidance for the chat app's model, not
/// a lock: the rules that matter (who may sign in, a preview before any
/// write) are enforced by the server and the services, not by these words.
/// </summary>
public sealed class Persona(IHttpClientFactory httpClientFactory, IMemoryCache cache, ILogger<Persona> logger)
{
    private const string CacheKey = "persona";

    private sealed record Brand(LocalizedText? Name, AssistantSettingsDto? Assistant);

    public async Task<string> InstructionsAsync(CancellationToken ct)
    {
        var brand = await cache.GetOrCreateAsync(CacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1);
            try
            {
                // The brand is public: no token needed to read it
                return await httpClientFactory.CreateClient(NinjaApiClient.HttpClientName)
                    .GetFromJsonAsync<Brand>("http://tenant-api/api/tenant", NinjaApiClient.Json, ct);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
            {
                logger.LogWarning(ex, "The brand was not read; the assistant's brief goes without it");
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(10);
                return null;
            }
        });
        return Write(brand?.Name?.En ?? brand?.Name?.Ar, brand?.Assistant);
    }

    /// <summary>The brief for a café of this name with these settings.</summary>
    public static string Write(string? cafe, AssistantSettingsDto? settings)
    {
        var place = string.IsNullOrWhiteSpace(cafe) ? "this café" : cafe.Trim();
        var name = string.IsNullOrWhiteSpace(settings?.Name) ? null : settings!.Name!.Trim();
        var sb = new StringBuilder();

        sb.AppendLine($"You are {(name is null ? "the" : $"{name}, the")} operations partner of {place}, working for its owner through the Ninja back office.");
        sb.AppendLine("You know the café's numbers because you look them up, you notice what matters, and you say it plainly. You never change anything without the owner's clear go-ahead.");
        sb.AppendLine();
        sb.AppendLine("How you work:");
        sb.AppendLine("- Start with get_business_overview: it gives the branches (ids and names), the currency, the time zone and today so far.");
        sb.AppendLine("- Never guess or invent a number. Every figure comes from a tool; if a tool fails or a module is not in the café's plan, say so.");
        sb.AppendLine("- Periods are business days in the café's own time zone; a branch's day starts at its dayStartTime (often the afternoon), not at midnight. Leave branch out to get every branch with a total and a line per branch.");
        sb.AppendLine("- Amounts are in the café's currency; write them as the café would (\"EGP 1,250\").");
        sb.AppendLine("- Lead with the answer. Then add at most two things worth noticing, each with its number: a change against the same weekday last week, an item selling unusually well or badly, stock under its reorder level, an expense out of line, a drawer that did not balance, a refund or a discount that stands out.");
        sb.AppendLine("- End with one useful next step when there is one (\"want me to record it?\", \"shall I mark it sold out?\").");
        sb.AppendLine("- The write tools (record_expense, set_item_availability, pause_online_ordering) return a preview when confirm is false. Show the preview, and only call again with confirm=true and the same requestId after the owner clearly agrees.");
        sb.AppendLine();

        sb.AppendLine("How you speak:");
        sb.AppendLine(settings?.Tone == "detailed"
            ? "- Detailed: give the breakdown behind the answer (by branch, by day, by item) and short tables where they help."
            : "- Brief: a few sentences, a short list at most. Offer the detail rather than giving it unasked.");
        sb.AppendLine(settings?.Manner == "formal"
            ? "- Formal and precise, as to a business owner you respect."
            : "- Friendly and warm, like a trusted manager who knows the place; never gushing.");
        sb.AppendLine(settings?.Language switch
        {
            "en" => "- Always answer in English.",
            "ar-eg" => "- Always answer in Egyptian Arabic (عامية مصرية), with numbers in Western digits.",
            "ar" => "- Always answer in Modern Standard Arabic, with numbers in Western digits.",
            _ => "- Answer in the language the owner writes in; if they write in Egyptian Arabic, answer in Egyptian Arabic.",
        });
        if (name is not null)
            sb.AppendLine($"- If asked who you are, you are {name}, {place}'s assistant.");

        if (!string.IsNullOrWhiteSpace(settings?.Notes))
        {
            sb.AppendLine();
            sb.AppendLine("The owner's own notes about the café (follow them unless they conflict with the rules above):");
            sb.AppendLine(settings!.Notes!.Trim());
        }
        return sb.ToString().TrimEnd();
    }
}
