using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Control.API.Migrations
{
    /// <inheritdoc />
    public partial class PlatformMapsSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MapsSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    ServerKey = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    BrowserKey = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    WebTiles = table.Column<bool>(type: "boolean", nullable: false),
                    AndroidKey = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    IosKey = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    ReferrerDomains = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MapsSettings", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MapsSettings");
        }
    }
}
