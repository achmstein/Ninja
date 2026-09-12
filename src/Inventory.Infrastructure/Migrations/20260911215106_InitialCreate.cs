using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Inventory.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "inventory");

            migrationBuilder.CreateSequence(
                name: "purchaselineseq",
                schema: "inventory",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "purchaseseq",
                schema: "inventory",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "recipelineseq",
                schema: "inventory",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "stockcountlineseq",
                schema: "inventory",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "stockcountseq",
                schema: "inventory",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "stockitemseq",
                schema: "inventory",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "stockmovementseq",
                schema: "inventory",
                incrementBy: 10);

            migrationBuilder.CreateTable(
                name: "IntegrationEventLog",
                schema: "inventory",
                columns: table => new
                {
                    EventId = table.Column<Guid>(type: "uuid", nullable: false),
                    EventTypeName = table.Column<string>(type: "text", nullable: false),
                    State = table.Column<int>(type: "integer", nullable: false),
                    TimesSent = table.Column<int>(type: "integer", nullable: false),
                    CreationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Content = table.Column<string>(type: "text", nullable: false),
                    TransactionId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IntegrationEventLog", x => x.EventId);
                });

            migrationBuilder.CreateTable(
                name: "menu_item_stock_statuses",
                schema: "inventory",
                columns: table => new
                {
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    CatalogItemId = table.Column<int>(type: "integer", nullable: false),
                    InStock = table.Column<bool>(type: "boolean", nullable: false),
                    ChangedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_menu_item_stock_statuses", x => new { x.BranchId, x.CatalogItemId });
                });

            migrationBuilder.CreateTable(
                name: "purchases",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Supplier = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    InvoiceRef = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ReceivedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ReceivedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_purchases", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "recipes",
                schema: "inventory",
                columns: table => new
                {
                    CatalogItemId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_recipes", x => x.CatalogItemId);
                });

            migrationBuilder.CreateTable(
                name: "requests",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Time = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_requests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "stock_counts",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CountedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CountedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_counts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "stock_items",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    NameEn = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    NameAr = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Unit = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    PackSize = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: true),
                    PackName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    AutoSoldOut = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_items", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "purchase_lines",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    StockItemId = table.Column<int>(type: "integer", nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    UnitCost = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    PurchaseId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_purchase_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_purchase_lines_purchases_PurchaseId",
                        column: x => x.PurchaseId,
                        principalSchema: "inventory",
                        principalTable: "purchases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_purchase_lines_stock_items_StockItemId",
                        column: x => x.StockItemId,
                        principalSchema: "inventory",
                        principalTable: "stock_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "recipe_lines",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    StockItemId = table.Column<int>(type: "integer", nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    OptionId = table.Column<int>(type: "integer", nullable: true),
                    CatalogItemId = table.Column<int>(type: "integer", nullable: true),
                    RecipeCatalogItemId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_recipe_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_recipe_lines_recipes_CatalogItemId",
                        column: x => x.CatalogItemId,
                        principalSchema: "inventory",
                        principalTable: "recipes",
                        principalColumn: "CatalogItemId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_recipe_lines_recipes_RecipeCatalogItemId",
                        column: x => x.RecipeCatalogItemId,
                        principalSchema: "inventory",
                        principalTable: "recipes",
                        principalColumn: "CatalogItemId");
                    table.ForeignKey(
                        name: "FK_recipe_lines_stock_items_StockItemId",
                        column: x => x.StockItemId,
                        principalSchema: "inventory",
                        principalTable: "stock_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "stock_count_lines",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    StockItemId = table.Column<int>(type: "integer", nullable: false),
                    Expected = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    Counted = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    StockCountId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_count_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_stock_count_lines_stock_counts_StockCountId",
                        column: x => x.StockCountId,
                        principalSchema: "inventory",
                        principalTable: "stock_counts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_stock_count_lines_stock_items_StockItemId",
                        column: x => x.StockItemId,
                        principalSchema: "inventory",
                        principalTable: "stock_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "stock_levels",
                schema: "inventory",
                columns: table => new
                {
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    StockItemId = table.Column<int>(type: "integer", nullable: false),
                    OnHand = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    ReorderLevel = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: true),
                    AvgUnitCost = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_levels", x => new { x.BranchId, x.StockItemId });
                    table.ForeignKey(
                        name: "FK_stock_levels_stock_items_StockItemId",
                        column: x => x.StockItemId,
                        principalSchema: "inventory",
                        principalTable: "stock_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "stock_movements",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    StockItemId = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    UnitCost = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    Reference = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RecordedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_movements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_stock_movements_stock_items_StockItemId",
                        column: x => x.StockItemId,
                        principalSchema: "inventory",
                        principalTable: "stock_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_purchase_lines_PurchaseId",
                schema: "inventory",
                table: "purchase_lines",
                column: "PurchaseId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_lines_StockItemId",
                schema: "inventory",
                table: "purchase_lines",
                column: "StockItemId");

            migrationBuilder.CreateIndex(
                name: "IX_purchases_BranchId_ReceivedAt",
                schema: "inventory",
                table: "purchases",
                columns: new[] { "BranchId", "ReceivedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_recipe_lines_CatalogItemId",
                schema: "inventory",
                table: "recipe_lines",
                column: "CatalogItemId");

            migrationBuilder.CreateIndex(
                name: "IX_recipe_lines_RecipeCatalogItemId",
                schema: "inventory",
                table: "recipe_lines",
                column: "RecipeCatalogItemId");

            migrationBuilder.CreateIndex(
                name: "IX_recipe_lines_StockItemId",
                schema: "inventory",
                table: "recipe_lines",
                column: "StockItemId");

            migrationBuilder.CreateIndex(
                name: "IX_stock_count_lines_StockCountId",
                schema: "inventory",
                table: "stock_count_lines",
                column: "StockCountId");

            migrationBuilder.CreateIndex(
                name: "IX_stock_count_lines_StockItemId",
                schema: "inventory",
                table: "stock_count_lines",
                column: "StockItemId");

            migrationBuilder.CreateIndex(
                name: "IX_stock_counts_BranchId_CountedAt",
                schema: "inventory",
                table: "stock_counts",
                columns: new[] { "BranchId", "CountedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_stock_items_IsActive",
                schema: "inventory",
                table: "stock_items",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_stock_levels_StockItemId",
                schema: "inventory",
                table: "stock_levels",
                column: "StockItemId");

            migrationBuilder.CreateIndex(
                name: "IX_stock_movements_BranchId_RecordedAt",
                schema: "inventory",
                table: "stock_movements",
                columns: new[] { "BranchId", "RecordedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_stock_movements_BranchId_StockItemId_RecordedAt",
                schema: "inventory",
                table: "stock_movements",
                columns: new[] { "BranchId", "StockItemId", "RecordedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_stock_movements_Reference_StockItemId",
                schema: "inventory",
                table: "stock_movements",
                columns: new[] { "Reference", "StockItemId" },
                unique: true,
                filter: "\"Reference\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_stock_movements_StockItemId",
                schema: "inventory",
                table: "stock_movements",
                column: "StockItemId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "IntegrationEventLog",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "menu_item_stock_statuses",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "purchase_lines",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "recipe_lines",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "requests",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "stock_count_lines",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "stock_levels",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "stock_movements",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "purchases",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "recipes",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "stock_counts",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "stock_items",
                schema: "inventory");

            migrationBuilder.DropSequence(
                name: "purchaselineseq",
                schema: "inventory");

            migrationBuilder.DropSequence(
                name: "purchaseseq",
                schema: "inventory");

            migrationBuilder.DropSequence(
                name: "recipelineseq",
                schema: "inventory");

            migrationBuilder.DropSequence(
                name: "stockcountlineseq",
                schema: "inventory");

            migrationBuilder.DropSequence(
                name: "stockcountseq",
                schema: "inventory");

            migrationBuilder.DropSequence(
                name: "stockitemseq",
                schema: "inventory");

            migrationBuilder.DropSequence(
                name: "stockmovementseq",
                schema: "inventory");
        }
    }
}
