using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderItemOptionIds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<List<int>>(
                name: "OptionIds",
                schema: "ordering",
                table: "orderItems",
                type: "integer[]",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OptionIds",
                schema: "ordering",
                table: "orderItems");
        }
    }
}
