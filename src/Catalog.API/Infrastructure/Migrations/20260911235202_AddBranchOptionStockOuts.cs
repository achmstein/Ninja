using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Catalog.API.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddBranchOptionStockOuts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BranchOptionStockOuts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    CustomizationOptionId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BranchOptionStockOuts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BranchOptionStockOuts_CustomizationOptions_CustomizationOpt~",
                        column: x => x.CustomizationOptionId,
                        principalTable: "CustomizationOptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BranchOptionStockOuts_BranchId_CustomizationOptionId",
                table: "BranchOptionStockOuts",
                columns: new[] { "BranchId", "CustomizationOptionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BranchOptionStockOuts_CustomizationOptionId",
                table: "BranchOptionStockOuts",
                column: "CustomizationOptionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BranchOptionStockOuts");
        }
    }
}
