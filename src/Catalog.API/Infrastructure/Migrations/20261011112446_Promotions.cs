using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Catalog.API.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Promotions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Promotions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PictureFileName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Link = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    LinkId = table.Column<int>(type: "integer", nullable: true),
                    BranchIds = table.Column<List<int>>(type: "integer[]", nullable: false),
                    StartsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EndsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Weekdays = table.Column<int>(type: "integer", nullable: true),
                    ShowFrom = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    ShowTo = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Headline = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Promotions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Promotions_IsActive",
                table: "Promotions",
                column: "IsActive");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Promotions");
        }
    }
}
