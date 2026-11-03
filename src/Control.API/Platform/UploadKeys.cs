using System.Formats.Asn1;
using System.Security.Cryptography;
using System.Security.Cryptography.Pkcs;
using System.Security.Cryptography.X509Certificates;

namespace Ninja.Control.API.Platform;

/// <summary>An upload keystore as the build takes it: the file, the alias and passwords, and its certificate's fingerprints when they could be read.</summary>
public sealed record UploadKey(byte[] Keystore, string Alias, string KeyPassword, string StorePassword, string? Sha1, string? Sha256);

/// <summary>
/// A business's Android upload key: made here (what keytool -genkey would make, as PKCS12, which
/// Gradle reads whatever the file's name), or an existing one taken in and checked. Play signs what
/// the stores hand out with its own app signing key; this one only proves an upload is the business's,
/// and Play refuses another until it is reset in Play Console.
/// </summary>
public static class UploadKeys
{
    /// <summary>PKCS12's friendlyName bag attribute, where Java reads a key's alias from.</summary>
    private const string FriendlyNameOid = "1.2.840.113549.1.9.20";

    public const string DefaultAlias = "upload";

    /// <summary>
    /// A new key: RSA 2048, valid 25 years (Play wants one beyond 22 October 2033), named after the
    /// business. One password for the store and the key, since Java's PKCS12 takes no other.
    /// </summary>
    public static UploadKey Generate(string businessName, DateTimeOffset? now = null)
    {
        var from = (now ?? DateTimeOffset.UtcNow).AddDays(-1);
        using var rsa = RSA.Create(2048);
        var subject = new X500DistinguishedNameBuilder();
        subject.AddCommonName(string.IsNullOrWhiteSpace(businessName) ? "Upload" : businessName.Trim());
        subject.AddOrganizationName("Ninja");
        var request = new CertificateRequest(subject.Build(), rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        using var certificate = request.CreateSelfSigned(from, from.AddYears(25));

        var password = Convert.ToBase64String(RandomNumberGenerator.GetBytes(18)).Replace('+', 'x').Replace('/', 'y');
        var keystore = Pkcs12(certificate, rsa, DefaultAlias, password);
        return new UploadKey(keystore, DefaultAlias, password, password, Sha1(certificate), Sha256(certificate));
    }

    /// <summary>
    /// An existing keystore, checked: a PKCS12 one must open with the store password and hold the alias,
    /// and gives its fingerprints; a JKS one (what keytool made before Java 9) cannot be read here and is
    /// kept as it is, its fingerprints reported by its first build. Null and an error when refused.
    /// </summary>
    public static UploadKey? Import(byte[] keystore, string alias, string keyPassword, string storePassword, out string? error)
    {
        error = null;
        alias = alias.Trim();
        if (keystore.Length == 0 || keystore.Length > 64 * 1024)
        {
            error = "The keystore file is empty or far too large to be one.";
            return null;
        }
        if (alias.Length == 0 || storePassword.Length == 0 || keyPassword.Length == 0)
        {
            error = "Give the key's alias, the store password and the key password.";
            return null;
        }
        if (IsJks(keystore)) return new UploadKey(keystore, alias, keyPassword, storePassword, null, null);

        try
        {
            var info = Pkcs12Info.Decode(keystore, out _, skipCopy: true);
            if (!info.VerifyMac(storePassword))
            {
                error = "The store password does not open this keystore.";
                return null;
            }
            var aliases = Aliases(info, storePassword);
            if (aliases.Count > 0 && !aliases.Contains(alias, StringComparer.OrdinalIgnoreCase))
            {
                error = $"The keystore has no key named {alias}; it has {string.Join(", ", aliases)}.";
                return null;
            }
            using var certificate = X509CertificateLoader.LoadPkcs12(keystore, storePassword);
            return new UploadKey(keystore, alias, keyPassword, storePassword, Sha1(certificate), Sha256(certificate));
        }
        catch (CryptographicException)
        {
            error = "This is neither a PKCS12 nor a JKS keystore, or the password does not open it.";
            return null;
        }
    }

    /// <summary>JKS starts with 0xFEEDFEED; JCEKS with 0xCECECECE, which Gradle reads too.</summary>
    public static bool IsJks(ReadOnlySpan<byte> keystore)
        => keystore.Length >= 4 && ((keystore[0] == 0xFE && keystore[1] == 0xED && keystore[2] == 0xFE && keystore[3] == 0xED)
            || (keystore[0] == 0xCE && keystore[1] == 0xCE && keystore[2] == 0xCE && keystore[3] == 0xCE));

    /// <summary>A certificate's fingerprint as Play Console and keytool show it: AA:BB:…</summary>
    public static string Sha1(X509Certificate2 certificate) => Colons(certificate.GetCertHash(HashAlgorithmName.SHA1));

    public static string Sha256(X509Certificate2 certificate) => Colons(certificate.GetCertHash(HashAlgorithmName.SHA256));

    public static string Colons(byte[] hash) => string.Join(':', hash.Select(b => b.ToString("X2")));

    private static byte[] Pkcs12(X509Certificate2 certificate, RSA key, string alias, string password)
    {
        var name = FriendlyName(alias);
        var localKeyId = new Pkcs9LocalKeyId(certificate.GetCertHash(HashAlgorithmName.SHA1));
        var encryption = new PbeParameters(PbeEncryptionAlgorithm.Aes256Cbc, HashAlgorithmName.SHA256, 10_000);

        var keys = new Pkcs12SafeContents();
        var keyBag = keys.AddShroudedKey(key, password, encryption);
        keyBag.Attributes.Add(localKeyId);
        keyBag.Attributes.Add(name);

        var certificates = new Pkcs12SafeContents();
        var certificateBag = certificates.AddCertificate(certificate);
        certificateBag.Attributes.Add(localKeyId);
        certificateBag.Attributes.Add(name);

        var builder = new Pkcs12Builder();
        builder.AddSafeContentsEncrypted(certificates, password, encryption);
        builder.AddSafeContentsUnencrypted(keys);
        builder.SealWithMac(password, HashAlgorithmName.SHA256, 10_000);
        return builder.Encode();
    }

    private static AsnEncodedData FriendlyName(string alias)
    {
        var writer = new AsnWriter(AsnEncodingRules.DER);
        writer.WriteCharacterString(UniversalTagNumber.BMPString, alias);
        return new AsnEncodedData(FriendlyNameOid, writer.Encode());
    }

    /// <summary>The aliases the keystore's bags carry, opening the encrypted ones with the password.</summary>
    private static List<string> Aliases(Pkcs12Info info, string password)
    {
        var aliases = new List<string>();
        foreach (var contents in info.AuthenticatedSafe)
        {
            if (contents.ConfidentialityMode == Pkcs12ConfidentialityMode.Password) contents.Decrypt(password);
            if (contents.ConfidentialityMode is not Pkcs12ConfidentialityMode.None) continue;
            foreach (var bag in contents.GetBags())
            foreach (var attribute in bag.Attributes)
            {
                if (attribute.Oid.Value != FriendlyNameOid) continue;
                foreach (var value in attribute.Values)
                {
                    var reader = new AsnReader(value.RawData, AsnEncodingRules.BER);
                    var alias = reader.ReadCharacterString(UniversalTagNumber.BMPString);
                    if (!aliases.Contains(alias)) aliases.Add(alias);
                }
            }
        }
        return aliases;
    }
}
