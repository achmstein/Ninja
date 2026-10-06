using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PaymentMoves : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ReconciledAt",
                schema: "sales",
                table: "payment_settings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SealedApiKey",
                schema: "sales",
                table: "payment_settings",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AttentionSince",
                schema: "sales",
                table: "online_payments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CheckedAt",
                schema: "sales",
                table: "online_payments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Move",
                schema: "sales",
                table: "online_payments",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "None");

            migrationBuilder.AddColumn<int>(
                name: "MoveAttempts",
                schema: "sales",
                table: "online_payments",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "MoveBy",
                schema: "sales",
                table: "online_payments",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "MoveDueAt",
                schema: "sales",
                table: "online_payments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "MoveLeasedUntil",
                schema: "sales",
                table: "online_payments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MoveReason",
                schema: "sales",
                table: "online_payments",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Problem",
                schema: "sales",
                table: "online_payments",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_online_payments_AttentionSince",
                schema: "sales",
                table: "online_payments",
                column: "AttentionSince");

            migrationBuilder.CreateIndex(
                name: "IX_online_payments_Move_MoveDueAt",
                schema: "sales",
                table: "online_payments",
                columns: new[] { "Move", "MoveDueAt" });

            migrationBuilder.CreateIndex(
                name: "IX_online_payments_Status_CreatedAt",
                schema: "sales",
                table: "online_payments",
                columns: new[] { "Status", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_online_payments_AttentionSince",
                schema: "sales",
                table: "online_payments");

            migrationBuilder.DropIndex(
                name: "IX_online_payments_Move_MoveDueAt",
                schema: "sales",
                table: "online_payments");

            migrationBuilder.DropIndex(
                name: "IX_online_payments_Status_CreatedAt",
                schema: "sales",
                table: "online_payments");

            migrationBuilder.DropColumn(
                name: "ReconciledAt",
                schema: "sales",
                table: "payment_settings");

            migrationBuilder.DropColumn(
                name: "SealedApiKey",
                schema: "sales",
                table: "payment_settings");

            migrationBuilder.DropColumn(
                name: "AttentionSince",
                schema: "sales",
                table: "online_payments");

            migrationBuilder.DropColumn(
                name: "CheckedAt",
                schema: "sales",
                table: "online_payments");

            migrationBuilder.DropColumn(
                name: "Move",
                schema: "sales",
                table: "online_payments");

            migrationBuilder.DropColumn(
                name: "MoveAttempts",
                schema: "sales",
                table: "online_payments");

            migrationBuilder.DropColumn(
                name: "MoveBy",
                schema: "sales",
                table: "online_payments");

            migrationBuilder.DropColumn(
                name: "MoveDueAt",
                schema: "sales",
                table: "online_payments");

            migrationBuilder.DropColumn(
                name: "MoveLeasedUntil",
                schema: "sales",
                table: "online_payments");

            migrationBuilder.DropColumn(
                name: "MoveReason",
                schema: "sales",
                table: "online_payments");

            migrationBuilder.DropColumn(
                name: "Problem",
                schema: "sales",
                table: "online_payments");
        }
    }
}
