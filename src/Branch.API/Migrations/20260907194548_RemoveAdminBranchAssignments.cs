using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Ninja.Branch.API.Migrations
{
    /// <inheritdoc />
    public partial class RemoveAdminBranchAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdminBranchAssignments");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AdminBranchAssignments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    AdminUserId = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminBranchAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AdminBranchAssignments_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdminBranchAssignments_AdminUserId",
                table: "AdminBranchAssignments",
                column: "AdminUserId");

            migrationBuilder.CreateIndex(
                name: "IX_AdminBranchAssignments_AdminUserId_BranchId",
                table: "AdminBranchAssignments",
                columns: new[] { "AdminUserId", "BranchId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AdminBranchAssignments_BranchId",
                table: "AdminBranchAssignments",
                column: "BranchId");
        }
    }
}
