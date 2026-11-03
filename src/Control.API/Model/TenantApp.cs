namespace Ninja.Control.API.Model;

/// <summary>
/// What a business's own customer app is built, signed and uploaded with, kept beside its record so
/// nothing is set per business in GitHub: its Android upload key, its Play and App Store Connect API
/// keys, its icons and its Firebase files. The build reads it as the app-builder client
/// (GET /tenants/{slug}/app-kit, tenants/fetch-kit.sh). The keys are encrypted at rest like the
/// tenants' own secrets; the Firebase files and icons are not secret. Kept when the business is
/// destroyed, so one brought back still signs with its upload key; dropped with its record.
/// </summary>
public class TenantApp
{
    public Guid TenantId { get; set; }

    /// <summary>The upload keystore as base64: PKCS12 when made here, PKCS12 or JKS when imported.</summary>
    public string? UploadKeystore { get; set; }

    public string? KeyAlias { get; set; }

    public string? KeyPassword { get; set; }

    public string? StorePassword { get; set; }

    /// <summary>The upload key's certificate fingerprints, AA:BB:…; a JKS keystore's are reported by its first build.</summary>
    public string? UploadKeySha1 { get; set; }

    public string? UploadKeySha256 { get; set; }

    /// <summary>A Google service account with release rights on the business's Play account, as Google gives it.</summary>
    public string? PlayServiceAccountJson { get; set; }

    /// <summary>An App Store Connect API key from the business's account (App Manager): its id, issuer and .p8.</summary>
    public string? AscKeyId { get; set; }

    public string? AscIssuerId { get; set; }

    public string? AscPrivateKey { get; set; }

    /// <summary>The app's Firebase files, as the platform's Firebase project gives them for the app's id.</summary>
    public string? GoogleServicesJson { get; set; }

    public string? GoogleServiceInfoPlist { get; set; }

    /// <summary>Firebase's ids of the two apps (1:…:android:…, 1:…:ios:…).</summary>
    public string? FirebaseAndroidAppId { get; set; }

    public string? FirebaseIosAppId { get; set; }

    /// <summary>
    /// The iOS OAuth client Google sign-in comes back to, made by hand in the Google Cloud project of the
    /// platform's sign-in client (Google gives no API for it); the build writes it into the iOS Firebase
    /// file as CLIENT_ID, which the app and tool/stamp_tenant.dart read. Null: the file's own.
    /// </summary>
    public string? GoogleIosClientId { get; set; }

    /// <summary>
    /// The SHA-1 of Play's app signing key, copied from Play Console (App integrity): Play's API gives only
    /// its SHA-256. Firebase is given it with the upload key's, and so makes the Android OAuth client
    /// Google sign-in needs for the app as Play installs it.
    /// </summary>
    public string? PlaySigningSha1 { get; set; }

    /// <summary>1024x1024 PNG, no transparency: the iOS icon and Android's legacy one.</summary>
    public byte[]? Icon { get; set; }

    /// <summary>Android's adaptive foreground: the mark inside its middle two thirds, PNG.</summary>
    public byte[]? IconForeground { get; set; }

    /// <summary>The last readiness check, as JSON (one line per item), and when it ran.</summary>
    public string? Checks { get; set; }

    public DateTime? CheckedAt { get; set; }

    /// <summary>The last build started from the control app: its GitHub run once found, when, and for what.</summary>
    public long? BuildRunId { get; set; }

    public DateTime? BuildRequestedAt { get; set; }

    public string? BuildPlatform { get; set; }

    public string? BuildTrack { get; set; }

    public DateTime UpdatedAt { get; set; }
}
