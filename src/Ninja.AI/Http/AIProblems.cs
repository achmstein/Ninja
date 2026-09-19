using Ninja.AI.Agents;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Ninja.AI.Http;

/// <summary>What an endpoint answers when the assistant cannot: the same problem shape for every AI feature.</summary>
public static class AIProblems
{
    public const string NotConfiguredDetail = "AI assistant is not configured on this server.";

    /// <summary>503: no chat model on this service.</summary>
    public static ProblemHttpResult NotConfigured()
        => TypedResults.Problem(NotConfiguredDetail, statusCode: StatusCodes.Status503ServiceUnavailable, title: "AI assistant unavailable");

    public static ProblemHttpResult From(AIException exception, HttpContext httpContext)
    {
        switch (exception)
        {
            case AIUnavailableException:
                return NotConfigured();

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

            case AITimeoutException:
                return TypedResults.Problem("The assistant took too long to answer; try again.",
                    statusCode: StatusCodes.Status504GatewayTimeout, title: "AI assistant timed out");

            default:
                return TypedResults.Problem("The assistant returned an unusable answer; try again.",
                    statusCode: StatusCodes.Status502BadGateway, title: "AI assistant error");
        }
    }
}
