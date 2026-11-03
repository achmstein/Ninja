using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Control.API.Migrations
{
    /// <inheritdoc />
    public partial class AppBuilds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BuildPlatform",
                table: "TenantApps",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "BuildRequestedAt",
                table: "TenantApps",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "BuildRunId",
                table: "TenantApps",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BuildTrack",
                table: "TenantApps",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AppBuildSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    GitHubToken = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    Repository = table.Column<string>(type: "character varying(140)", maxLength: 140, nullable: false),
                    Workflow = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Ref = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppBuildSettings", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AppBuildSettings");

            migrationBuilder.DropColumn(
                name: "BuildPlatform",
                table: "TenantApps");

            migrationBuilder.DropColumn(
                name: "BuildRequestedAt",
                table: "TenantApps");

            migrationBuilder.DropColumn(
                name: "BuildRunId",
                table: "TenantApps");

            migrationBuilder.DropColumn(
                name: "BuildTrack",
                table: "TenantApps");
        }
    }
}
