#nullable enable
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;

namespace Ninja.Sales.API.Payments;

/// <summary>
/// Seals the café's provider secrets before they reach the database, with
/// the stack's payments key (AES-256-GCM, a fresh nonce each time). The key
/// is in the stack's environment, never in the database, so a dump or a
/// backup of Sales holds the secrets only as "sealed:v1:…".
/// </summary>
public sealed class SecretSealer(IOptions<PaymentsOptions> options)
{
    private const string Prefix = "sealed:v1:";
    private const int NonceSize = 12;
    private const int TagSize = 16;

    public bool CanSeal => !string.IsNullOrWhiteSpace(options.Value.Key);

    private byte[] Key()
    {
        var key = options.Value.Key;
        if (string.IsNullOrWhiteSpace(key))
            throw new InvalidOperationException("This stack has no payments key; the control plane stamps one on its next upgrade.");
        return SHA256.HashData(Encoding.UTF8.GetBytes(key));
    }

    public string Seal(string secret)
    {
        var plain = Encoding.UTF8.GetBytes(secret);
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var cipher = new byte[plain.Length];
        var tag = new byte[TagSize];
        using var aes = new AesGcm(Key(), TagSize);
        aes.Encrypt(nonce, plain, cipher, tag);
        return Prefix + Convert.ToBase64String([.. nonce, .. tag, .. cipher]);
    }

    public string Open(string sealedSecret)
    {
        if (!sealedSecret.StartsWith(Prefix, StringComparison.Ordinal))
            throw new CryptographicException("Not a sealed secret.");
        var data = Convert.FromBase64String(sealedSecret[Prefix.Length..]);
        var nonce = data.AsSpan(0, NonceSize);
        var tag = data.AsSpan(NonceSize, TagSize);
        var cipher = data.AsSpan(NonceSize + TagSize);
        var plain = new byte[cipher.Length];
        using var aes = new AesGcm(Key(), TagSize);
        aes.Decrypt(nonce, cipher, tag, plain);
        return Encoding.UTF8.GetString(plain);
    }
}
