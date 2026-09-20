using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Transfer;
using Microsoft.Extensions.Options;

namespace Ninja.Control.API.Platform;

/// <summary>Where a copy of every backup goes, off the box: one object per backup, keyed {prefix}{slug}/{id}.tar.gz.</summary>
public interface IOffsiteStore
{
    bool Enabled { get; }
    Task UploadFileAsync(string key, string path, CancellationToken ct);
    Task DeleteAsync(string key, CancellationToken ct);
}

/// <summary>Any S3-compatible bucket (AWS, Backblaze B2, Cloudflare R2, Hetzner, MinIO on a laptop): path-style addressing and the SDK's own multipart retries.</summary>
public sealed class S3OffsiteStore(IOptions<PlatformOptions> options) : IOffsiteStore
{
    private OffsiteOptions Offsite => options.Value.Offsite;

    public bool Enabled => Offsite.Enabled;

    private AmazonS3Client Client()
    {
        var config = new AmazonS3Config { ForcePathStyle = true };
        if (!string.IsNullOrWhiteSpace(Offsite.Endpoint))
        {
            config.ServiceURL = Offsite.Endpoint;
            config.AuthenticationRegion = Offsite.Region;
        }
        else
        {
            config.RegionEndpoint = Amazon.RegionEndpoint.GetBySystemName(Offsite.Region);
        }
        return new AmazonS3Client(Offsite.AccessKey, Offsite.SecretKey, config);
    }

    public async Task UploadFileAsync(string key, string path, CancellationToken ct)
    {
        using var client = Client();
        using var transfer = new TransferUtility(client);
        await transfer.UploadAsync(new TransferUtilityUploadRequest { BucketName = Offsite.Bucket, Key = key, FilePath = path, ContentType = "application/gzip" }, ct);
    }

    public async Task DeleteAsync(string key, CancellationToken ct)
    {
        using var client = Client();
        await client.DeleteObjectAsync(new DeleteObjectRequest { BucketName = Offsite.Bucket, Key = key }, ct);
    }
}

/// <summary>Nothing configured: backups stay on the box and the UI says so.</summary>
public sealed class NoOffsiteStore : IOffsiteStore
{
    public bool Enabled => false;
    public Task UploadFileAsync(string key, string path, CancellationToken ct) => throw new InvalidOperationException("No offsite store is configured");
    public Task DeleteAsync(string key, CancellationToken ct) => Task.CompletedTask;
}

/// <summary>Dry run and tests: remembers what would have gone up.</summary>
public sealed class RecordingOffsiteStore : IOffsiteStore
{
    public List<string> Keys { get; } = [];
    public bool Enabled => true;
    public Task UploadFileAsync(string key, string path, CancellationToken ct) { lock (Keys) Keys.Add(key); return Task.CompletedTask; }
    public Task DeleteAsync(string key, CancellationToken ct) { lock (Keys) Keys.Remove(key); return Task.CompletedTask; }
}
