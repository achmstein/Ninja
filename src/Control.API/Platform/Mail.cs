using System.Threading.Channels;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace Ninja.Control.API.Platform;

/// <summary>One mail as a template made it: both bodies, and which template and tenant for the audit.</summary>
public sealed record MailMessage(string To, string Subject, string Html, string Text, string Template, string? Slug, string? ReplyTo = null);

public interface IMailer
{
    bool Configured { get; }
    Task SendAsync(MailMessage message, CancellationToken ct);
}

/// <summary>Any SMTP server, through MailKit: STARTTLS on 587 by default, or whatever the options say.</summary>
public sealed class SmtpMailer(IOptions<PlatformOptions> options) : IMailer
{
    private MailOptions Mail => options.Value.Mail;

    public bool Configured => Mail.Configured;

    public async Task SendAsync(MailMessage message, CancellationToken ct)
    {
        var mime = new MimeMessage();
        mime.From.Add(new MailboxAddress(Mail.FromName, Mail.From));
        mime.To.Add(MailboxAddress.Parse(message.To));
        if (message.ReplyTo is not null) mime.ReplyTo.Add(MailboxAddress.Parse(message.ReplyTo));
        mime.Subject = message.Subject;
        mime.Body = new BodyBuilder { HtmlBody = message.Html, TextBody = message.Text }.ToMessageBody();

        using var client = new SmtpClient();
        await client.ConnectAsync(Mail.Host ?? throw new InvalidOperationException("No SMTP host"), Mail.Port, Mail.UseStartTls ? SecureSocketOptions.StartTls : SecureSocketOptions.Auto, ct);
        if (!string.IsNullOrEmpty(Mail.User)) await client.AuthenticateAsync(Mail.User, Mail.Password ?? "", ct);
        await client.SendAsync(mime, ct);
        await client.DisconnectAsync(true, ct);
    }
}

/// <summary>No host set: nothing goes out, and the audit says so for every mail that would have.</summary>
public sealed class NullMailer(ILogger<NullMailer> logger) : IMailer
{
    public bool Configured => false;

    public Task SendAsync(MailMessage message, CancellationToken ct)
    {
        logger.LogInformation("(mail off) {Template} to {To}: {Subject}", message.Template, message.To, message.Subject);
        return Task.CompletedTask;
    }
}

/// <summary>What the callers hand their mails to; nobody waits on a server.</summary>
public sealed class MailQueue
{
    private readonly Channel<MailMessage> _channel = Channel.CreateUnbounded<MailMessage>();

    public void Enqueue(MailMessage message) => _channel.Writer.TryWrite(message);

    public IAsyncEnumerable<MailMessage> ReadAllAsync(CancellationToken ct) => _channel.Reader.ReadAllAsync(ct);
}

/// <summary>What the platform page shows about mail: is it on, when it last worked, what last went wrong.</summary>
public sealed class MailStatus
{
    private int _sent, _failed, _skipped;

    public DateTimeOffset? LastSentAt { get; private set; }

    public string? LastError { get; private set; }

    public int Sent => _sent;

    public int Failed => _failed;

    public int Skipped => _skipped;

    public void MarkSent() { Interlocked.Increment(ref _sent); LastSentAt = DateTimeOffset.UtcNow; }

    public void MarkFailed(string error) { Interlocked.Increment(ref _failed); LastError = error; }

    public void MarkSkipped() => Interlocked.Increment(ref _skipped);
}

/// <summary>Sends what is queued, one at a time, three attempts each; every outcome is audited.</summary>
public sealed class MailSender(MailQueue queue, IMailer mailer, MailStatus status, IServiceScopeFactory scopes, ILogger<MailSender> logger) : BackgroundService
{
    internal static readonly TimeSpan[] Backoff = [TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(30)];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var message in queue.ReadAllAsync(stoppingToken))
        {
            using var scope = scopes.CreateScope();
            var audit = scope.ServiceProvider.GetRequiredService<IAuditWriter>();
            try
            {
                await DeliverAsync(message, mailer, audit, status, Task.Delay, stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Delivering {Template} to {To} threw past the retries", message.Template, message.To);
            }
        }
    }

    /// <summary>The attempts and the audit, with the wait injectable so the test does not sleep.</summary>
    internal static async Task DeliverAsync(MailMessage message, IMailer mailer, IAuditWriter audit, MailStatus status, Func<TimeSpan, CancellationToken, Task> delay, CancellationToken ct)
    {
        var details = new { template = message.Template, to = message.To };
        if (!mailer.Configured)
        {
            await mailer.SendAsync(message, ct);
            status.MarkSkipped();
            await audit.WriteAsync("mail.skipped", message.Slug, details, ct, "mail");
            return;
        }

        Exception? last = null;
        for (var attempt = 0; attempt <= Backoff.Length; attempt++)
        {
            if (attempt > 0) await delay(Backoff[attempt - 1], ct);
            try
            {
                await mailer.SendAsync(message, ct);
                status.MarkSent();
                await audit.WriteAsync("mail.sent", message.Slug, details, ct, "mail");
                return;
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                last = ex;
            }
        }
        status.MarkFailed(last!.Message);
        await audit.WriteAsync("mail.failed", message.Slug, new { details.template, details.to, error = last.Message }, ct, "mail");
    }
}
