using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Catalog.API.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ItemPairings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CatalogItemPairings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CatalogItemId = table.Column<int>(type: "integer", nullable: false),
                    PairedItemId = table.Column<int>(type: "integer", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CatalogItemPairings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CatalogItemPairings_Catalog_CatalogItemId",
                        column: x => x.CatalogItemId,
                        principalTable: "Catalog",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CatalogItemPairings_Catalog_PairedItemId",
                        column: x => x.PairedItemId,
                        principalTable: "Catalog",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CatalogItemPairings_CatalogItemId_DisplayOrder",
                table: "CatalogItemPairings",
                columns: new[] { "CatalogItemId", "DisplayOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_CatalogItemPairings_CatalogItemId_PairedItemId",
                table: "CatalogItemPairings",
                columns: new[] { "CatalogItemId", "PairedItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CatalogItemPairings_PairedItemId",
                table: "CatalogItemPairings",
                column: "PairedItemId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CatalogItemPairings");
        }
    }
}
