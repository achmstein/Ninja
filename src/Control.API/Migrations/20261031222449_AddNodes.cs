using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Ninja.Control.API.Migrations
{
    /// <inheritdoc />
    public partial class AddNodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MovingToNodeId",
                table: "Tenants",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "NodeId",
                table: "Tenants",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "NodeId",
                table: "Jobs",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Nodes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Kind = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Status = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    AgentUrl = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    IngressUrl = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CertThumbprint = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Architecture = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Labels = table.Column<List<string>>(type: "text[]", nullable: false),
                    ReserveMb = table.Column<int>(type: "integer", nullable: true),
                    StackFootprintMb = table.Column<int>(type: "integer", nullable: true),
                    PostgresMaxConnections = table.Column<int>(type: "integer", nullable: true),
                    PlatformConnections = table.Column<int>(type: "integer", nullable: true),
                    MaxStacks = table.Column<int>(type: "integer", nullable: true),
                    KeycloakInternalUrl = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    AiGatewayUrl = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    TalabatRelayUrl = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    AgentVersion = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    LastSeenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LastError = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Nodes", x => x.Id);
                });

            // Node 1: the box the control plane runs on, every setting the platform's. Every tenant from before nodes
            // lives here (Tenants.NodeId defaults to 1). Its id given, the identity then starts after it
            migrationBuilder.Sql("""
                INSERT INTO "Nodes" ("Id", "Name", "Kind", "Status", "Architecture", "Labels", "CreatedAt")
                VALUES (1, 'node-1', 'Local', 'Active', 'amd64', '{}', now());
                SELECT setval(pg_get_serial_sequence('"Nodes"', 'Id'), (SELECT MAX("Id") FROM "Nodes"));
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Tenants_MovingToNodeId",
                table: "Tenants",
                column: "MovingToNodeId");

            migrationBuilder.CreateIndex(
                name: "IX_Tenants_NodeId",
                table: "Tenants",
                column: "NodeId");

            migrationBuilder.CreateIndex(
                name: "IX_Jobs_Status_Lane_NodeId",
                table: "Jobs",
                columns: new[] { "Status", "Lane", "NodeId" });

            migrationBuilder.CreateIndex(
                name: "IX_Nodes_Name",
                table: "Nodes",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Tenants_Nodes_MovingToNodeId",
                table: "Tenants",
                column: "MovingToNodeId",
                principalTable: "Nodes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Tenants_Nodes_NodeId",
                table: "Tenants",
                column: "NodeId",
                principalTable: "Nodes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tenants_Nodes_MovingToNodeId",
                table: "Tenants");

            migrationBuilder.DropForeignKey(
                name: "FK_Tenants_Nodes_NodeId",
                table: "Tenants");

            migrationBuilder.DropTable(
                name: "Nodes");

            migrationBuilder.DropIndex(
                name: "IX_Tenants_MovingToNodeId",
                table: "Tenants");

            migrationBuilder.DropIndex(
                name: "IX_Tenants_NodeId",
                table: "Tenants");

            migrationBuilder.DropIndex(
                name: "IX_Jobs_Status_Lane_NodeId",
                table: "Jobs");

            migrationBuilder.DropColumn(
                name: "MovingToNodeId",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "NodeId",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "NodeId",
                table: "Jobs");
        }
    }
}
