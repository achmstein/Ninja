using Ninja.Assistant.API.Downstream;

namespace Ninja.Assistant.API.Context;

/// <summary>One branch's answer, or why it has none.</summary>
public sealed record FanOutResult<T>(List<(BranchResponse Branch, T Value)> Ok, List<string> Errors)
{
    public bool AnyOk => Ok.Count > 0;
}

/// <summary>
/// The reports know one branch at a time (X-Branch-Id), so "all branches" is
/// a fetch per branch, a few at once. A branch that fails becomes one line in
/// the answer; the others still count.
/// </summary>
public static class FanOut
{
    private const int Parallelism = 4;

    public static async Task<FanOutResult<T>> PerBranchAsync<T>(
        IReadOnlyList<BranchResponse> branches,
        Func<BranchResponse, Task<ApiResult<T>>> fetch)
    {
        using var gate = new SemaphoreSlim(Parallelism);
        var tasks = branches.Select(async branch =>
        {
            await gate.WaitAsync();
            try { return (branch, result: await fetch(branch)); }
            finally { gate.Release(); }
        }).ToList();

        var ok = new List<(BranchResponse, T)>();
        var errors = new List<string>();
        foreach (var (branch, result) in await Task.WhenAll(tasks))
        {
            if (result.IsOk) ok.Add((branch, result.Value!));
            else errors.Add($"{branch.DisplayName}: {result.Error}");
        }
        return new FanOutResult<T>(ok, errors);
    }
}
