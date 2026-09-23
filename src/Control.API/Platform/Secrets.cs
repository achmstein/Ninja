using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>
/// The tenants' secrets (database and broker passwords, the realm's client
/// secrets, the owner's first password) at rest: AES-256-GCM under one key
/// from the platform's .env, so a dump of controldb is not a dump of every
/// café's credentials. A value without the prefix is one written before
/// there was a key and reads as itself; the first start with a key rewrites
/// every row. No key (a dry run) means nothing is touched either way.
/// </summary>
public sealed class SecretProtector
{
    private const string Prefix = "enc:v1:";
    private const int NonceBytes = 12;
    private const int TagBytes = 16;

    private readonly byte[]? _key;

    private SecretProtector(byte[]? key) => _key = key;

    /// <summary>Stores and reads plaintext: dry runs and tests.</summary>
    public static readonly SecretProtector None = new(null);

    public bool Enabled => _key is not null;

    /// <summary>From the base64 of 32 random bytes (openssl rand -base64 32).</summary>
    public static SecretProtector FromBase64(string key)
    {
        byte[] bytes;
        try { bytes = Convert.FromBase64String(key.Trim()); }
        catch (FormatException) { throw new ArgumentException("Platform:EncryptionKey is not base64.", nameof(key)); }
        if (bytes.Length != 32) throw new ArgumentException($"Platform:EncryptionKey must be 32 bytes, not {bytes.Length}.", nameof(key));
        return new SecretProtector(bytes);
    }

    public static bool IsProtected(string? stored) => stored is not null && stored.StartsWith(Prefix, StringComparison.Ordinal);

    /// <summary>What goes into the column: the ciphertext under a fresh nonce, or the value itself without a key.</summary>
    public string Protect(string plaintext)
    {
        if (_key is null) return plaintext;
        var nonce = RandomNumberGenerator.GetBytes(NonceBytes);
        var bytes = Encoding.UTF8.GetBytes(plaintext);
        var cipher = new byte[bytes.Length];
        var tag = new byte[TagBytes];
        using var aes = new AesGcm(_key, TagBytes);
        aes.Encrypt(nonce, bytes, cipher, tag);
        var packed = new byte[NonceBytes + TagBytes + cipher.Length];
        nonce.CopyTo(packed, 0);
        tag.CopyTo(packed, NonceBytes);
        cipher.CopyTo(packed, NonceBytes + TagBytes);
        return Prefix + Convert.ToBase64String(packed);
    }

    /// <summary>What the column holds, read: decrypted when it carries the prefix, as it is otherwise. A prefixed value under the wrong key throws: better a loud failure than a wrong password handed to a stack.</summary>
    public string Unprotect(string stored)
    {
        if (!IsProtected(stored)) return stored;
        if (_key is null) throw new CryptographicException("A stored secret is encrypted but Platform:EncryptionKey is not set.");
        var packed = Convert.FromBase64String(stored[Prefix.Length..]);
        if (packed.Length < NonceBytes + TagBytes) throw new CryptographicException("A stored secret is too short to be one of ours.");
        var nonce = packed.AsSpan(0, NonceBytes);
        var tag = packed.AsSpan(NonceBytes, TagBytes);
        var cipher = packed.AsSpan(NonceBytes + TagBytes);
        var plain = new byte[cipher.Length];
        using var aes = new AesGcm(_key, TagBytes);
        aes.Decrypt(nonce, cipher, tag, plain);
        return Encoding.UTF8.GetString(plain);
    }

    /// <summary>The EF converter for a secret column: protected on the way in, read back either way.</summary>
    public ValueConverter<string, string> Converter() => new(v => Protect(v), v => Unprotect(v));

    /// <summary>The same for a column that may be null.</summary>
    public ValueConverter<string?, string?> NullableConverter() => new(v => v == null ? null : Protect(v), v => v == null ? null : Unprotect(v));
}

/// <summary>Carries the protector into the context's options, where the model is built; the model cache tells a keyed context from a plain one.</summary>
public sealed class SecretsOptionsExtension(SecretProtector protector) : IDbContextOptionsExtension
{
    public SecretProtector Protector { get; } = protector;

    public DbContextOptionsExtensionInfo Info => new ExtensionInfo(this);

    public void ApplyServices(IServiceCollection services) { }

    public void Validate(IDbContextOptions options) { }

    private sealed class ExtensionInfo(SecretsOptionsExtension extension) : DbContextOptionsExtensionInfo(extension)
    {
        public override bool IsDatabaseProvider => false;

        public override string LogFragment => extension.Protector.Enabled ? "SecretsEncrypted " : "";

        public override int GetServiceProviderHashCode() => 0;

        public override bool ShouldUseSameServiceProvider(DbContextOptionsExtensionInfo other) => true;

        public override void PopulateDebugInfo(IDictionary<string, string> debugInfo) => debugInfo["Secrets:Encrypted"] = extension.Protector.Enabled.ToString();
    }
}

public static class SecretsOptionsExtensions
{
    public static DbContextOptionsBuilder UseSecretProtector(this DbContextOptionsBuilder builder, SecretProtector protector)
    {
        ((IDbContextOptionsBuilderInfrastructure)builder).AddOrUpdateExtension(new SecretsOptionsExtension(protector));
        builder.ReplaceService<IModelCacheKeyFactory, SecretsModelCacheKeyFactory>();
        return builder;
    }

    /// <summary>The protector these options carry, or the one that does nothing.</summary>
    public static SecretProtector SecretProtector(this IDbContextOptions options)
        => options.FindExtension<SecretsOptionsExtension>()?.Protector ?? Platform.SecretProtector.None;
}

/// <summary>A model built with the converter is not a model built without it.</summary>
public sealed class SecretsModelCacheKeyFactory : IModelCacheKeyFactory
{
    public object Create(DbContext context, bool designTime)
        => (context.GetType(), designTime, ((IDbContextOptions)context.GetService<IDbContextOptions>()).SecretProtector().Enabled);
}

/// <summary>
/// Once, on start: every secret still stored as it was typed is rewritten
/// under the key. Runs after the migrations, before anything reads a tenant.
/// </summary>
public sealed class SecretsMigrationService(IServiceScopeFactory scopes, SecretProtector protector, ILogger<SecretsMigrationService> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken ct)
    {
        if (!protector.Enabled) return;
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
        var audit = scope.ServiceProvider.GetRequiredService<IAuditWriter>();
        // The converter decrypts what was encrypted and passes the rest through, so only the raw column says which is which:
        // asked in SQL, since a LIKE through the converter would encrypt the pattern
        var plain = await context.Tenants
            .FromSqlRaw("""
                SELECT * FROM "Tenants"
                WHERE "IdentitySecret" NOT LIKE 'enc:v1:%' OR "ControlSecret" NOT LIKE 'enc:v1:%' OR "AssistantSecret" NOT LIKE 'enc:v1:%'
                   OR "DbPassword" NOT LIKE 'enc:v1:%' OR "BrokerPassword" NOT LIKE 'enc:v1:%' OR "OwnerInitialPassword" NOT LIKE 'enc:v1:%'
                """)
            .ToListAsync(ct);
        if (plain.Count == 0) return;
        foreach (var tenant in plain)
        {
            var entry = context.Entry(tenant);
            foreach (var property in new[] { nameof(Tenant.IdentitySecret), nameof(Tenant.ControlSecret), nameof(Tenant.AssistantSecret), nameof(Tenant.DbPassword), nameof(Tenant.BrokerPassword), nameof(Tenant.OwnerInitialPassword) })
                if (entry.Property(property).CurrentValue is not null) entry.Property(property).IsModified = true;
        }
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("platform.secrets.encrypted", null, new { tenants = plain.Count }, ct, "platform");
        logger.LogWarning("{Count} tenant(s) had secrets stored in the clear; they are encrypted now", plain.Count);
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}

/// <summary>
/// The owner's first password stays on the record only until it has done
/// its job: once a day, an owner who has changed it (Keycloak no longer
/// asks them to) or one whose stack is a month old loses it from the
/// record. The control app shows it while it is there.
/// </summary>
public sealed class OwnerPasswordSweepService(IServiceScopeFactory scopes, IKeycloakAdmin keycloak, IOptions<PlatformOptions> options, ILogger<OwnerPasswordSweepService> logger) : BackgroundService
{
    public static readonly TimeSpan KeepAtMost = TimeSpan.FromDays(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(24));
        do
        {
            try { await SweepAsync(stoppingToken); }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested) { logger.LogError(ex, "Owner password sweep failed"); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    /// <summary>Pure, for the test: whether the password has done its job.</summary>
    public static bool ShouldClear(Tenant t, bool stillRequired, DateTimeOffset now)
        => t.OwnerInitialPassword is not null && (!stillRequired || (t.ProvisionedAt is { } at && now - at > KeepAtMost));

    internal async Task SweepAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
        var audit = scope.ServiceProvider.GetRequiredService<IAuditWriter>();
        var now = DateTimeOffset.UtcNow;
        var tenants = await context.Tenants.Where(t => t.OwnerInitialPassword != null && t.Status == TenantStatus.Running).ToListAsync(ct);
        foreach (var tenant in tenants)
        {
            bool stillRequired;
            try { stillRequired = await keycloak.HasRequiredActionAsync(TenantNaming.Realm(tenant.Slug), tenant.OwnerEmail, "UPDATE_PASSWORD", ct); }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                logger.LogWarning(ex, "{Slug}: could not ask the realm about the owner", tenant.Slug);
                continue;
            }
            if (!ShouldClear(tenant, stillRequired, now)) continue;
            tenant.OwnerInitialPassword = null;
            await context.SaveChangesAsync(ct);
            await audit.WriteAsync("owner.password.cleared", tenant.Slug, new { reason = stillRequired ? "a month old" : "changed by the owner" }, ct, "sweep");
        }
        _ = options;
    }
}
