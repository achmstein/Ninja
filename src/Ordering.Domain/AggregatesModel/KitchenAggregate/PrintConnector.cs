#nullable enable
using System.Security.Cryptography;
using System.Text;

namespace Ninja.Ordering.Domain.AggregatesModel.KitchenAggregate;

/// <summary>
/// The Ninja Print Connector on a Windows PC in the shop: a small service
/// that prints the kitchen's tickets on any printer Windows knows, by name,
/// and on the network printers the tills can reach. It talks to us only
/// outbound, with the key it was given when an owner paired it, so nothing
/// in the shop is ever opened to the internet.
/// </summary>
public class PrintConnector : Entity, IAggregateRoot
{
    public int BranchId { get; private set; }

    /// <summary>The PC's name, as Windows gives it; what the admin sees.</summary>
    public string Name { get; private set; } = string.Empty;

    /// <summary>SHA-256 of the key; the key itself is only ever on the PC.</summary>
    public string KeyHash { get; private set; } = string.Empty;

    /// <summary>"en" or "ar": the language its tickets print in.</summary>
    public string Language { get; private set; } = "ar";

    public DateTime PairedAt { get; private set; }

    public DateTime? LastSeenAt { get; private set; }

    /// <summary>The printers Windows has on the PC, as it last reported them.</summary>
    public List<string> Printers { get; private set; } = [];

    protected PrintConnector() { }

    private PrintConnector(int branchId, string name, string keyHash, string language)
    {
        BranchId = branchId;
        Name = name;
        KeyHash = keyHash;
        Language = language;
        PairedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Pair a PC with the branch the code was made for. Returns the
    /// connector and the key it signs its calls with, shown to it once.
    /// </summary>
    public static (PrintConnector Connector, string Key) Pair(ConnectorPairing pairing, string machineName, DateTime now)
    {
        pairing.Use(now);
        var key = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var name = string.IsNullOrWhiteSpace(machineName) ? "Windows PC" : machineName.Trim()[..Math.Min(machineName.Trim().Length, 100)];
        return (new PrintConnector(pairing.BranchId, name, Hash(key), pairing.Language), key);
    }

    public bool Holds(string key) =>
        CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(Hash(key)), Encoding.ASCII.GetBytes(KeyHash));

    /// <summary>It checked in: alive, with these printers installed.</summary>
    public void Seen(IEnumerable<string>? printers, DateTime now)
    {
        LastSeenAt = now;
        if (printers is not null)
        {
            Printers = printers.Where(p => !string.IsNullOrWhiteSpace(p)).Select(p => p.Trim()).Distinct().Order().Take(50).ToList();
        }
    }

    public static string Hash(string key) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key))).ToLowerInvariant();
}

/// <summary>
/// A one-time code an owner makes in admin to pair a print connector with
/// a branch. Short enough to type, good for ten minutes, good once.
/// </summary>
public class ConnectorPairing : Entity, IAggregateRoot
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);

    // No 0/O or 1/I: read off a screen and typed on another
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public string Code { get; private set; } = string.Empty;

    public int BranchId { get; private set; }

    public string Language { get; private set; } = "ar";

    public DateTime ExpiresAt { get; private set; }

    public DateTime? UsedAt { get; private set; }

    protected ConnectorPairing() { }

    public static ConnectorPairing New(int branchId, string? language, DateTime now)
    {
        var code = new string(RandomNumberGenerator.GetItems<char>(Alphabet, 8));
        return new ConnectorPairing
        {
            Code = code,
            BranchId = branchId,
            Language = language == "en" ? "en" : "ar",
            ExpiresAt = now + Lifetime,
        };
    }

    public bool IsLive(DateTime now) => UsedAt is null && now < ExpiresAt;

    internal void Use(DateTime now)
    {
        if (!IsLive(now))
        {
            throw new OrderingDomainException("That pairing code has expired or was already used. Make a new one in admin.");
        }
        UsedAt = now;
    }

    /// <summary>What a person types: case and dashes do not matter.</summary>
    public static string Normalize(string code) => new(code.Where(char.IsLetterOrDigit).Select(char.ToUpperInvariant).ToArray());
}
