namespace Ninja.Control.API.Model;

/// <summary>
/// How the control app starts the businesses' own app builds (one row): a GitHub token allowed to run
/// the repository's workflows (a fine-grained one with Actions read and write on that repository
/// alone), and which workflow and branch. Set on the Platform page's Own apps tab; the token is
/// encrypted at rest like the AI's keys.
/// </summary>
public class AppBuildSettings
{
    public const int SingletonId = 1;

    public int Id { get; set; } = SingletonId;

    public string? GitHubToken { get; set; }

    /// <summary>owner/name</summary>
    public string Repository { get; set; } = "achmstein/Ninja";

    public string Workflow { get; set; } = "mobile-deploy.yml";

    public string Ref { get; set; } = "main";

    public DateTime UpdatedAt { get; set; }
}
