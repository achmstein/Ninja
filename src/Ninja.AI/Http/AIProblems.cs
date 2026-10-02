using Ninja.AI.Agents;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Ninja.AI.Http;

/// <summary>What an endpoint answers when the assistant cannot: the same problem shape for every AI feature.</summary>
public static class AIProblems
{
    public const string NotConfiguredDetail = "AI assistant is not configured on this server.";

    /// <summary>The title of a 429 whose cause is a spent allowance rather than a burst; the apps word it so.</summary>
    public const string QuotaTitle = "AI quota used up";

    private static readonly System.Text.RegularExpressions.Regex RetryIn = new(
        @"retry in (?:(?<h>\d+)h)?(?:(?<m>\d+)m)?(?:(?<s>[\d.]+)s)?",
        System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.CultureInvariant,
        TimeSpan.FromSeconds(1));

    /// <summary>
    /// How long until a spent allowance comes back, when the 429 is one: the provider says "quota" (Gemini's
    /// "You exceeded your current quota … Please retry in 2h47m56s"); its own wait, else the Retry-After, else an
    /// hour. Null for an ordinary rate limit, which passes in a minute.
    /// </summary>
    internal static TimeSpan? QuotaWait(AIProviderException provider)
    {
        if (!provider.Message.Contains("quota", StringComparison.OrdinalIgnoreCase)) return null;
        var match = RetryIn.Match(provider.Message);
        if (match.Success && match.Length > "retry in ".Length)
        {
            double Part(string name) => match.Groups[name].Success ? double.Parse(match.Groups[name].Value, System.Globalization.CultureInfo.InvariantCulture) : 0;
            return TimeSpan.FromHours(Part("h")) + TimeSpan.FromMinutes(Part("m")) + TimeSpan.FromSeconds(Math.Ceiling(Part("s")));
        }
        return provider.RetryAfter ?? TimeSpan.FromHours(1);
    }

    /// <summary>"2h 48m", "35m", "40s": a wait as a person reads it.</summary>
    internal static string Readable(TimeSpan wait)
        => wait.TotalHours >= 1 ? $"{(int)wait.TotalHours}h {wait.Minutes}m"
            : wait.TotalMinutes >= 1 ? $"{(int)Math.Ceiling(wait.TotalMinutes)}m"
            : $"{(int)Math.Ceiling(wait.TotalSeconds)}s";

    /// <summary>503: no chat model on this service.</summary>
    public static ProblemHttpResult NotConfigured()
        => TypedResults.Problem(NotConfiguredDetail, statusCode: StatusCodes.Status503ServiceUnavailable, title: "AI assistant unavailable");

    public static ProblemHttpResult From(AIException exception, HttpContext httpContext)
    {
        switch (exception)
        {
            case AIUnavailableException:
                return NotConfigured();

            case AIProviderException { Status: StatusCodes.Status429TooManyRequests } provider when QuotaWait(provider) is { } wait:
                // The provider's allowance is spent (a free tier's requests a day): no point in a minute; it says when
                httpContext.Response.Headers.RetryAfter = ((int)wait.TotalSeconds).ToString(System.Globalization.CultureInfo.InvariantCulture);
                return TypedResults.Problem($"The AI's allowance is used up; it comes back in about {Readable(wait)}.",
                    statusCode: StatusCodes.Status429TooManyRequests, title: QuotaTitle);

            case AIProviderException { Status: StatusCodes.Status429TooManyRequests } provider:
                httpContext.Response.Headers.RetryAfter = ((int)(provider.RetryAfter?.TotalSeconds ?? 60)).ToString(System.Globalization.CultureInfo.InvariantCulture);
                return TypedResults.Problem("The AI provider's rate limit was hit; try again in a minute.",
                    statusCode: StatusCodes.Status429TooManyRequests, title: "AI assistant busy");

            case AIProviderException { Status: StatusCodes.Status401Unauthorized or StatusCodes.Status403Forbidden }:
                return TypedResults.Problem("The AI provider rejected this server's API key.",
                    statusCode: StatusCodes.Status502BadGateway, title: "AI provider error");

            case AIProviderException provider:
                return TypedResults.Problem($"The AI provider answered {provider.Status}; try again shortly.",
                    statusCode: StatusCodes.Status502BadGateway, title: "AI provider error");

            case AITruncatedException:
                return TypedResults.Problem("The answer was too long for the assistant; send less at once (one page, fewer items).",
                    statusCode: StatusCodes.Status502BadGateway, title: "AI answer too long");

            case AITimeoutException:
                return TypedResults.Problem("The assistant took too long to answer; try again.",
                    statusCode: StatusCodes.Status504GatewayTimeout, title: "AI assistant timed out");

            default:
                return TypedResults.Problem("The assistant returned an unusable answer; try again.",
                    statusCode: StatusCodes.Status502BadGateway, title: "AI assistant error");
        }
    }
}
