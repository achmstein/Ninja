using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Control.API.Migrations
{
    /// <inheritdoc />
    public partial class TenantOwnApp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FirebaseSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    ServiceAccountJson = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FirebaseSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TenantApps",
                columns: table => new
                {
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UploadKeystore = table.Column<string>(type: "text", nullable: true),
                    KeyAlias = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    KeyPassword = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    StorePassword = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    UploadKeySha1 = table.Column<string>(type: "character varying(59)", maxLength: 59, nullable: true),
                    UploadKeySha256 = table.Column<string>(type: "character varying(95)", maxLength: 95, nullable: true),
                    PlayServiceAccountJson = table.Column<string>(type: "text", nullable: true),
                    AscKeyId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    AscIssuerId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    AscPrivateKey = table.Column<string>(type: "text", nullable: true),
                    GoogleServicesJson = table.Column<string>(type: "text", nullable: true),
                    GoogleServiceInfoPlist = table.Column<string>(type: "text", nullable: true),
                    FirebaseAndroidAppId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    FirebaseIosAppId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Icon = table.Column<byte[]>(type: "bytea", nullable: true),
                    IconForeground = table.Column<byte[]>(type: "bytea", nullable: true),
                    Checks = table.Column<string>(type: "jsonb", nullable: true),
                    CheckedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantApps", x => x.TenantId);
                    table.ForeignKey(
                        name: "FK_TenantApps_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FirebaseSettings");

            migrationBuilder.DropTable(
                name: "TenantApps");
        }
    }
}
