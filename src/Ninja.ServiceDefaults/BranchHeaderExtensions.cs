using Microsoft.AspNetCore.Http;

namespace Ninja.ServiceDefaults;

public static class BranchHeaderExtensions
{
    public const string HeaderName = "X-Branch-Id";

    /// <summary>
    /// Gets the branch ID from the X-Branch-Id header, or null if not present/invalid.
    /// </summary>
    public static int? GetBranchId(this HttpContext ctx)
    {
        if (ctx.Request.Headers.TryGetValue(HeaderName, out var values) &&
            int.TryParse(values.FirstOrDefault(), out var branchId))
        {
            return branchId;
        }

        return null;
    }

    /// <summary>
    /// Gets the branch ID from the X-Branch-Id header.
    /// A missing or invalid header is the caller's mistake: answers 400.
    /// </summary>
    public static int GetRequiredBranchId(this HttpContext ctx)
    {
        return ctx.GetBranchId()
            ?? throw new BadHttpRequestException($"Required header '{HeaderName}' is missing or invalid.");
    }
}
