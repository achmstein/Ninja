using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Model;

public enum MailOutcome
{
    Queued = 0,
    Sent = 1,
    /// <summary>Three attempts, none took.</summary>
    Failed = 2,
    /// <summary>Mail is off on this platform; audited, never sent.</summary>
    Skipped = 3,
}

/// <summary>
/// A mail waiting to go out, on the record: written in the same save as
/// whatever it announces (the welcome with the owner's first password, a
/// payment), so a restart between the two cannot lose it.
/// </summary>
public class OutboxMail
{
    public long Id { get; set; }

    public string To { get; set; } = "";

    public string Subject { get; set; } = "";

    public string Html { get; set; } = "";

    public string Text { get; set; } = "";

    /// <summary>Which template made it, for the audit and the status page.</summary>
    public string Template { get; set; } = "";

    public string? Slug { get; set; }

    public string? ReplyTo { get; set; }

    public MailOutcome Status { get; set; }

    public int Attempts { get; set; }

    public string? LastError { get; set; }

    public DateTimeOffset EnqueuedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? SentAt { get; set; }

    public static OutboxMail From(MailMessage m) => new()
    {
        To = m.To,
        Subject = m.Subject,
        Html = m.Html,
        Text = m.Text,
        Template = m.Template,
        Slug = m.Slug,
        ReplyTo = m.ReplyTo,
    };

    public MailMessage ToMessage() => new(To, Subject, Html, Text, Template, Slug, ReplyTo);
}
