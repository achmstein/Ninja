namespace Chillax.E2E.Harness;

public static class RepoRoot
{
    private static readonly Lazy<string> Cached = new(Locate);

    /// <summary>The checkout root (the folder holding Chillax.slnx), found by walking up from the test binaries.</summary>
    public static string Path => Cached.Value;

    private static string Locate()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            if (File.Exists(System.IO.Path.Combine(dir.FullName, "Chillax.slnx")))
                return dir.FullName;
            dir = dir.Parent;
        }

        throw new InvalidOperationException($"Chillax.slnx not found above {AppContext.BaseDirectory}");
    }
}
