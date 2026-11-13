using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DeliveryZones : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Delivery_EtaMinutes",
                schema: "ordering",
                table: "orders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Delivery_MinimumOrder",
                schema: "ordering",
                table: "orders",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Delivery_ZoneId",
                schema: "ordering",
                table: "orders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Delivery_ZoneNameAr",
                schema: "ordering",
                table: "orders",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Delivery_ZoneNameEn",
                schema: "ordering",
                table: "orders",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "branchdeliveryzones",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    NameEn = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    NameAr = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    Fee = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MinimumOrder = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    EtaMinutes = table.Column<int>(type: "integer", nullable: true),
                    IsOn = table.Column<bool>(type: "boolean", nullable: false),
                    Shape = table.Column<string>(type: "jsonb", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_branchdeliveryzones", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_branchdeliveryzones_BranchId_SortOrder",
                schema: "ordering",
                table: "branchdeliveryzones",
                columns: new[] { "BranchId", "SortOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "branchdeliveryzones",
                schema: "ordering");

            migrationBuilder.DropColumn(
                name: "Delivery_EtaMinutes",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_MinimumOrder",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_ZoneId",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_ZoneNameAr",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_ZoneNameEn",
                schema: "ordering",
                table: "orders");
        }
    }
}
