using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PaymentTenderChange : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "TenderChangedAt",
                schema: "sales",
                table: "payments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TenderChangedBy",
                schema: "sales",
                table: "payments",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TenderChangedFrom",
                schema: "sales",
                table: "payments",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TenderChangedAt",
                schema: "sales",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "TenderChangedBy",
                schema: "sales",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "TenderChangedFrom",
                schema: "sales",
                table: "payments");
        }
    }
}
