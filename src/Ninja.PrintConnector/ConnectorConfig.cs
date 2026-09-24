using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Ninja.PrintConnector;

/// <summary>
/// What pairing left behind: the café's API, who this connector is, and the
/// key it signs with — the key encrypted for this machine, so a copied file
/// is useless on another PC.
/// </summary>
public sealed record ConnectorConfig(string Server, int ConnectorId, string ProtectedKey, string Language)
{
    public static string Directory { get; } =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Ninja", "PrintConnector");

    private static string FilePath => Path.Combine(Directory, "connector.json");

    public string Key => Encoding.UTF8.GetString(
        ProtectedData.Unprotect(Convert.FromBase64String(ProtectedKey), null, DataProtectionScope.LocalMachine));

    public static ConnectorConfig Create(string server, int connectorId, string key, string language) => new(
        server.TrimEnd('/'),
        connectorId,
        Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(key), null, DataProtectionScope.LocalMachine)),
        language);

    public static ConnectorConfig? Load() =>
        File.Exists(FilePath) ? JsonSerializer.Deserialize<ConnectorConfig>(File.ReadAllText(FilePath)) : null;

    public void Save()
    {
        System.IO.Directory.CreateDirectory(Directory);
        File.WriteAllText(FilePath, JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true }));
    }

    public static void Forget()
    {
        if (File.Exists(FilePath)) File.Delete(FilePath);
    }
}
