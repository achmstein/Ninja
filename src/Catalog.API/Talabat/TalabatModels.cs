namespace Ninja.Catalog.API.Talabat;

/// <summary>
/// The business on Talabat, as its catalog keeps it: which branches sell there,
/// whether a branch's open/paused switch closes it there too, and how the last
/// menu went. One row. The business's chain at Talabat is the platform's to set;
/// nothing here names it.
/// </summary>
public class TalabatSettings
{
    public int Id { get; set; }

    /// <summary>The branches on Talabat; empty keeps everything here to itself.</summary>
    public int[] BranchIds { get; set; } = [];

    /// <summary>A branch paused here (between shifts, or from the till) closes on Talabat, and opens again with it.</summary>
    public bool SyncOpenClose { get; set; } = true;

    /// <summary>When the menu last changed in a way Talabat should see.</summary>
    public DateTime? MenuChangedAt { get; set; }

    /// <summary>When a push was last queued for that change; a newer change queues another.</summary>
    public DateTime? MenuQueuedAt { get; set; }

    /// <summary>When Talabat last took a menu from here.</summary>
    public DateTime? MenuSentAt { get; set; }

    /// <summary>What Talabat said about the last menu: submitted, done, done_with_errors, failed, or why it never got there.</summary>
    public string? LastMenuResult { get; set; }

    public DateTime? LastMenuResultAt { get; set; }

    public bool IsOn(int branchId) => BranchIds.Contains(branchId);
}

public enum TalabatTaskKind
{
    /// <summary>A branch's whole menu.</summary>
    Menu,

    /// <summary>An item or an option sold out, or back, at a branch.</summary>
    Availability,

    /// <summary>A branch opens or closes.</summary>
    Store,
}

/// <summary>
/// Something to tell Talabat, queued with the change that caused it and sent
/// afterwards, retried until Talabat takes it. What an availability task says
/// is read when it is sent, so a flurry of stock changes ends on the latest.
/// </summary>
public class TalabatTask
{
    public int Id { get; set; }

    public TalabatTaskKind Kind { get; set; }

    public int BranchId { get; set; }

    /// <summary>For availability: the remote code (item-12, option-7).</summary>
    public string? Code { get; set; }

    /// <summary>For a store: open (true) or closed.</summary>
    public bool? Open { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime NextAttemptAt { get; set; }

    public int Attempts { get; set; }

    public DateTime? SentAt { get; set; }

    public DateTime? AbandonedAt { get; set; }

    public string? LastError { get; set; }
}

class TalabatSettingsEntityTypeConfiguration : IEntityTypeConfiguration<TalabatSettings>
{
    public void Configure(EntityTypeBuilder<TalabatSettings> builder)
    {
        builder.ToTable("TalabatSettings");
        builder.Property(s => s.LastMenuResult).HasMaxLength(1000);
    }
}

class TalabatTaskEntityTypeConfiguration : IEntityTypeConfiguration<TalabatTask>
{
    public void Configure(EntityTypeBuilder<TalabatTask> builder)
    {
        builder.ToTable("TalabatTasks");
        builder.Property(t => t.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(t => t.Code).HasMaxLength(40);
        builder.Property(t => t.LastError).HasMaxLength(1000);
        builder.HasIndex(t => new { t.SentAt, t.AbandonedAt, t.NextAttemptAt });
    }
}
