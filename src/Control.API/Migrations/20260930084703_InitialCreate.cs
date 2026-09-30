using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Ninja.Control.API.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Audits",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    At = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Actor = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ActorEmail = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    Source = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Action = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Slug = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: true),
                    Details = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Audits", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Jobs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Action = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ImageTag = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CanaryId = table.Column<Guid>(type: "uuid", nullable: true),
                    Lane = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    EnqueuedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    NotBefore = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    StartedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    FinishedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Error = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    RequestedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Jobs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Outbox",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    To = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    Subject = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Html = table.Column<string>(type: "text", nullable: false),
                    Text = table.Column<string>(type: "text", nullable: false),
                    Template = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Slug = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: true),
                    ReplyTo = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    Status = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    LastError = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    EnqueuedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SentAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Outbox", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Tenants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    NameEn = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    NameAr = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    Kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Seed = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Country = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    TimeZone = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    DefaultLanguage = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false),
                    PrimaryColor = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: true),
                    BusinessType = table.Column<int>(type: "integer", nullable: false),
                    ArabicStyle = table.Column<string>(type: "text", nullable: false),
                    DefaultTheme = table.Column<string>(type: "text", nullable: true),
                    Slab = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    SocialSignIn = table.Column<bool>(type: "boolean", nullable: false),
                    CustomerDomain = table.Column<string>(type: "character varying(253)", maxLength: 253, nullable: true),
                    OwnerEmail = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    ContactName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    Phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Address = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Plan = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Addons = table.Column<string[]>(type: "text[]", nullable: false),
                    Subscription = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    PaidThrough = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    GraceDays = table.Column<int>(type: "integer", nullable: true),
                    SuspendedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    PastDueNotifiedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    TalabatChainCode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    TalabatGlobalEntityId = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    IsDrill = table.Column<bool>(type: "boolean", nullable: false),
                    OwnerInitialPassword = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    IdentitySecret = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ControlSecret = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    AssistantSecret = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    PaymentsKey = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    DbPassword = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    BrokerPassword = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    ImageTag = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PreviousImageTag = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    UpgradeBackupId = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: true),
                    RestoreFrom = table.Column<string>(type: "character varying(48)", maxLength: 48, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ProvisionedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    WelcomeSentAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ExpiryWarnedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    DestroyWarnedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LastError = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tenants", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Payments",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    At = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    PeriodStart = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    PeriodEnd = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Reference = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RecordedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Payments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Payments_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Steps",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RunId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    FinishedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Output = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Steps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Steps_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Audits_Slug_Id",
                table: "Audits",
                columns: new[] { "Slug", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_Jobs_Status_Lane_Priority_Id",
                table: "Jobs",
                columns: new[] { "Status", "Lane", "Priority", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_Jobs_TenantId_Status",
                table: "Jobs",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Outbox_Status_Id",
                table: "Outbox",
                columns: new[] { "Status", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_Payments_TenantId_Id",
                table: "Payments",
                columns: new[] { "TenantId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_Steps_TenantId_RunId",
                table: "Steps",
                columns: new[] { "TenantId", "RunId" });

            migrationBuilder.CreateIndex(
                name: "IX_Tenants_Slug",
                table: "Tenants",
                column: "Slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Audits");

            migrationBuilder.DropTable(
                name: "Jobs");

            migrationBuilder.DropTable(
                name: "Outbox");

            migrationBuilder.DropTable(
                name: "Payments");

            migrationBuilder.DropTable(
                name: "Steps");

            migrationBuilder.DropTable(
                name: "Tenants");
        }
    }
}
