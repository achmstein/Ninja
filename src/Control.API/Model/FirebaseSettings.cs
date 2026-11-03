namespace Ninja.Control.API.Model;

/// <summary>
/// The platform's Firebase project, as the control plane manages it (one row): a Google service
/// account with Firebase Admin on it, set on the Platform page's Firebase tab, which creates or finds a
/// business's own app there and downloads its Firebase files. Not the push notifications' credentials,
/// which stay on the host. Encrypted at rest like the AI's keys.
/// </summary>
public class FirebaseSettings
{
    public const int SingletonId = 1;

    public int Id { get; set; } = SingletonId;

    /// <summary>The service account's key file, as Google gives it.</summary>
    public string? ServiceAccountJson { get; set; }

    public DateTime UpdatedAt { get; set; }
}
