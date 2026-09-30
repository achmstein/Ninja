using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Catalog.API.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CatalogType",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CatalogType", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "IntegrationEventLog",
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
                name: "PromoCodes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Kind = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Value = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MinSubtotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    StartsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EndsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MaxUses = table.Column<int>(type: "integer", nullable: true),
                    OncePerCustomer = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Uses = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PromoCodes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PromoRedemptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    OrderId = table.Column<int>(type: "integer", nullable: false),
                    CustomerKey = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Discount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RedeemedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PromoRedemptions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TalabatSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BranchIds = table.Column<int[]>(type: "integer[]", nullable: false),
                    SyncOpenClose = table.Column<bool>(type: "boolean", nullable: false),
                    MenuChangedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MenuQueuedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MenuSentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastMenuResult = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    LastMenuResultAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TalabatSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TalabatTasks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Open = table.Column<bool>(type: "boolean", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NextAttemptAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AbandonedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastError = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TalabatTasks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Catalog",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PictureFileName = table.Column<string>(type: "text", nullable: true),
                    CatalogTypeId = table.Column<int>(type: "integer", nullable: false),
                    IsAvailable = table.Column<bool>(type: "boolean", nullable: false),
                    PreparationTimeMinutes = table.Column<int>(type: "integer", nullable: true),
                    IsOnOffer = table.Column<bool>(type: "boolean", nullable: false),
                    OfferPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    OfferWeekdays = table.Column<int>(type: "integer", nullable: true),
                    OfferFrom = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    OfferTo = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    IsPopular = table.Column<bool>(type: "boolean", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "jsonb", nullable: false),
                    Name = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Catalog", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Catalog_CatalogType_CatalogTypeId",
                        column: x => x.CatalogTypeId,
                        principalTable: "CatalogType",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BranchItemOverrides",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    CatalogItemId = table.Column<int>(type: "integer", nullable: false),
                    IsAvailable = table.Column<bool>(type: "boolean", nullable: false),
                    IsOutOfStock = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    PriceOverride = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    OfferPriceOverride = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    IsOnOfferOverride = table.Column<bool>(type: "boolean", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BranchItemOverrides", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BranchItemOverrides_Catalog_CatalogItemId",
                        column: x => x.CatalogItemId,
                        principalTable: "Catalog",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CustomerItemPurchases",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CatalogItemId = table.Column<int>(type: "integer", nullable: false),
                    OrderId = table.Column<int>(type: "integer", nullable: false),
                    Units = table.Column<int>(type: "integer", nullable: false),
                    OrderedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomerItemPurchases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomerItemPurchases_Catalog_CatalogItemId",
                        column: x => x.CatalogItemId,
                        principalTable: "Catalog",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ItemCustomizations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CatalogItemId = table.Column<int>(type: "integer", nullable: false),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false),
                    AllowMultiple = table.Column<bool>(type: "boolean", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ItemCustomizations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ItemCustomizations_Catalog_CatalogItemId",
                        column: x => x.CatalogItemId,
                        principalTable: "Catalog",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserItemFavorites",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CatalogItemId = table.Column<int>(type: "integer", nullable: false),
                    AddedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserItemFavorites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserItemFavorites_Catalog_CatalogItemId",
                        column: x => x.CatalogItemId,
                        principalTable: "Catalog",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserItemPreferences",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CatalogItemId = table.Column<int>(type: "integer", nullable: false),
                    LastUpdated = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserItemPreferences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserItemPreferences_Catalog_CatalogItemId",
                        column: x => x.CatalogItemId,
                        principalTable: "Catalog",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CustomizationOptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ItemCustomizationId = table.Column<int>(type: "integer", nullable: false),
                    PriceAdjustment = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomizationOptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomizationOptions_ItemCustomizations_ItemCustomizationId",
                        column: x => x.ItemCustomizationId,
                        principalTable: "ItemCustomizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserPreferenceOptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserItemPreferenceId = table.Column<int>(type: "integer", nullable: false),
                    CustomizationId = table.Column<int>(type: "integer", nullable: false),
                    OptionId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserPreferenceOptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserPreferenceOptions_UserItemPreferences_UserItemPreferenc~",
                        column: x => x.UserItemPreferenceId,
                        principalTable: "UserItemPreferences",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

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
                name: "IX_BranchItemOverrides_BranchId_CatalogItemId",
                table: "BranchItemOverrides",
                columns: new[] { "BranchId", "CatalogItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BranchItemOverrides_CatalogItemId",
                table: "BranchItemOverrides",
                column: "CatalogItemId");

            migrationBuilder.CreateIndex(
                name: "IX_BranchOptionStockOuts_BranchId_CustomizationOptionId",
                table: "BranchOptionStockOuts",
                columns: new[] { "BranchId", "CustomizationOptionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BranchOptionStockOuts_CustomizationOptionId",
                table: "BranchOptionStockOuts",
                column: "CustomizationOptionId");

            migrationBuilder.CreateIndex(
                name: "IX_Catalog_CatalogTypeId",
                table: "Catalog",
                column: "CatalogTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_Catalog_IsAvailable",
                table: "Catalog",
                column: "IsAvailable");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerItemPurchases_CatalogItemId",
                table: "CustomerItemPurchases",
                column: "CatalogItemId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerItemPurchases_UserId",
                table: "CustomerItemPurchases",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerItemPurchases_UserId_CatalogItemId_OrderId",
                table: "CustomerItemPurchases",
                columns: new[] { "UserId", "CatalogItemId", "OrderId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CustomizationOptions_ItemCustomizationId_DisplayOrder",
                table: "CustomizationOptions",
                columns: new[] { "ItemCustomizationId", "DisplayOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_ItemCustomizations_CatalogItemId_DisplayOrder",
                table: "ItemCustomizations",
                columns: new[] { "CatalogItemId", "DisplayOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_PromoCodes_Code",
                table: "PromoCodes",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PromoRedemptions_Code_CustomerKey",
                table: "PromoRedemptions",
                columns: new[] { "Code", "CustomerKey" });

            migrationBuilder.CreateIndex(
                name: "IX_PromoRedemptions_OrderId",
                table: "PromoRedemptions",
                column: "OrderId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TalabatTasks_SentAt_AbandonedAt_NextAttemptAt",
                table: "TalabatTasks",
                columns: new[] { "SentAt", "AbandonedAt", "NextAttemptAt" });

            migrationBuilder.CreateIndex(
                name: "IX_UserItemFavorites_CatalogItemId",
                table: "UserItemFavorites",
                column: "CatalogItemId");

            migrationBuilder.CreateIndex(
                name: "IX_UserItemFavorites_UserId_CatalogItemId",
                table: "UserItemFavorites",
                columns: new[] { "UserId", "CatalogItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserItemPreferences_CatalogItemId",
                table: "UserItemPreferences",
                column: "CatalogItemId");

            migrationBuilder.CreateIndex(
                name: "IX_UserItemPreferences_UserId_CatalogItemId",
                table: "UserItemPreferences",
                columns: new[] { "UserId", "CatalogItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserPreferenceOptions_UserItemPreferenceId_CustomizationId_~",
                table: "UserPreferenceOptions",
                columns: new[] { "UserItemPreferenceId", "CustomizationId", "OptionId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BranchItemOverrides");

            migrationBuilder.DropTable(
                name: "BranchOptionStockOuts");

            migrationBuilder.DropTable(
                name: "CustomerItemPurchases");

            migrationBuilder.DropTable(
                name: "IntegrationEventLog");

            migrationBuilder.DropTable(
                name: "PromoCodes");

            migrationBuilder.DropTable(
                name: "PromoRedemptions");

            migrationBuilder.DropTable(
                name: "TalabatSettings");

            migrationBuilder.DropTable(
                name: "TalabatTasks");

            migrationBuilder.DropTable(
                name: "UserItemFavorites");

            migrationBuilder.DropTable(
                name: "UserPreferenceOptions");

            migrationBuilder.DropTable(
                name: "CustomizationOptions");

            migrationBuilder.DropTable(
                name: "UserItemPreferences");

            migrationBuilder.DropTable(
                name: "ItemCustomizations");

            migrationBuilder.DropTable(
                name: "Catalog");

            migrationBuilder.DropTable(
                name: "CatalogType");
        }
    }
}
