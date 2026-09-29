using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Catalog.API.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class TalabatSync : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TalabatSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BranchIds = table.Column<int[]>(type: "integer[]", nullable: false),
                    SyncOpenClose = table.Column<bool>(type: "boolean", nullable: false),
                    MenuChangedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MenuQueuedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MenuSentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastMenuResult = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    LastMenuResultAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TalabatSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TalabatTasks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Open = table.Column<bool>(type: "boolean", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NextAttemptAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AbandonedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastError = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TalabatTasks", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TalabatTasks_SentAt_AbandonedAt_NextAttemptAt",
                table: "TalabatTasks",
                columns: new[] { "SentAt", "AbandonedAt", "NextAttemptAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TalabatSettings");

            migrationBuilder.DropTable(
                name: "TalabatTasks");
        }
    }
}
