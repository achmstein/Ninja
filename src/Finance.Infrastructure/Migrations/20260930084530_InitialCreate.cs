using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Finance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "finance");

            migrationBuilder.CreateSequence(
                name: "costfactseq",
                schema: "finance",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "expensecategoryseq",
                schema: "finance",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "expenseseq",
                schema: "finance",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "labourfactseq",
                schema: "finance",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "partnerentryseq",
                schema: "finance",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "partnerseq",
                schema: "finance",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "partnershareseq",
                schema: "finance",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "recurringexpenseseq",
                schema: "finance",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "salesfactseq",
                schema: "finance",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "supplierentryseq",
                schema: "finance",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "supplierseq",
                schema: "finance",
                incrementBy: 10);

            migrationBuilder.CreateTable(
                name: "cost_facts",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cost_facts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "expense_categories",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    NameEn = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    NameAr = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_expense_categories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "expense_receipts",
                schema: "finance",
                columns: table => new
                {
                    ExpenseId = table.Column<int>(type: "integer", nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    FileName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Data = table.Column<byte[]>(type: "bytea", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UploadedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_expense_receipts", x => x.ExpenseId);
                });

            migrationBuilder.CreateTable(
                name: "expenses",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    CategoryId = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PaidFrom = table.Column<int>(type: "integer", nullable: false),
                    PartnerId = table.Column<int>(type: "integer", nullable: true),
                    Vendor = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Source = table.Column<int>(type: "integer", nullable: false),
                    RecordedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    VoidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    VoidedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    VoidReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_expenses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "IntegrationEventLog",
                schema: "finance",
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
                name: "labour_facts",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    EmployeeId = table.Column<int>(type: "integer", nullable: false),
                    PeriodStart = table.Column<DateOnly>(type: "date", nullable: false),
                    PeriodEnd = table.Column<DateOnly>(type: "date", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_labour_facts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "partner_entries",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    PartnerId = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Source = table.Column<int>(type: "integer", nullable: false),
                    RecordedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_partner_entries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "partners",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    UserId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_partners", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "recurring_expenses",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    CategoryId = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DayOfMonth = table.Column<int>(type: "integer", nullable: false),
                    PaidFrom = table.Column<int>(type: "integer", nullable: false),
                    PartnerId = table.Column<int>(type: "integer", nullable: true),
                    Vendor = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_recurring_expenses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "requests",
                schema: "finance",
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
                name: "sales_facts",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Vat = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sales_facts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "supplier_entries",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    SupplierId = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Source = table.Column<int>(type: "integer", nullable: false),
                    RecordedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_supplier_entries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "suppliers",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_suppliers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "partner_shares",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Percent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    PartnerId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_partner_shares", x => x.Id);
                    table.ForeignKey(
                        name: "FK_partner_shares_partners_PartnerId",
                        column: x => x.PartnerId,
                        principalSchema: "finance",
                        principalTable: "partners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_cost_facts_BranchId_Date",
                schema: "finance",
                table: "cost_facts",
                columns: new[] { "BranchId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_cost_facts_Reference",
                schema: "finance",
                table: "cost_facts",
                column: "Reference",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_expenses_BranchId_Date",
                schema: "finance",
                table: "expenses",
                columns: new[] { "BranchId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_expenses_Reference",
                schema: "finance",
                table: "expenses",
                column: "Reference",
                unique: true,
                filter: "\"Reference\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_labour_facts_BranchId_PeriodStart",
                schema: "finance",
                table: "labour_facts",
                columns: new[] { "BranchId", "PeriodStart" });

            migrationBuilder.CreateIndex(
                name: "IX_labour_facts_EmployeeId_PeriodStart",
                schema: "finance",
                table: "labour_facts",
                columns: new[] { "EmployeeId", "PeriodStart" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_partner_entries_PartnerId_BranchId_Date",
                schema: "finance",
                table: "partner_entries",
                columns: new[] { "PartnerId", "BranchId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_partner_entries_Reference",
                schema: "finance",
                table: "partner_entries",
                column: "Reference",
                unique: true,
                filter: "\"Reference\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_partner_shares_PartnerId_BranchId",
                schema: "finance",
                table: "partner_shares",
                columns: new[] { "PartnerId", "BranchId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_recurring_expenses_BranchId",
                schema: "finance",
                table: "recurring_expenses",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_sales_facts_BranchId_Date",
                schema: "finance",
                table: "sales_facts",
                columns: new[] { "BranchId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_sales_facts_Reference",
                schema: "finance",
                table: "sales_facts",
                column: "Reference",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_supplier_entries_Reference",
                schema: "finance",
                table: "supplier_entries",
                column: "Reference",
                unique: true,
                filter: "\"Reference\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_supplier_entries_SupplierId_BranchId_Date",
                schema: "finance",
                table: "supplier_entries",
                columns: new[] { "SupplierId", "BranchId", "Date" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "cost_facts",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "expense_categories",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "expense_receipts",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "expenses",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "IntegrationEventLog",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "labour_facts",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "partner_entries",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "partner_shares",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "recurring_expenses",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "requests",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "sales_facts",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "supplier_entries",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "suppliers",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "partners",
                schema: "finance");

            migrationBuilder.DropSequence(
                name: "costfactseq",
                schema: "finance");

            migrationBuilder.DropSequence(
                name: "expensecategoryseq",
                schema: "finance");

            migrationBuilder.DropSequence(
                name: "expenseseq",
                schema: "finance");

            migrationBuilder.DropSequence(
                name: "labourfactseq",
                schema: "finance");

            migrationBuilder.DropSequence(
                name: "partnerentryseq",
                schema: "finance");

            migrationBuilder.DropSequence(
                name: "partnerseq",
                schema: "finance");

            migrationBuilder.DropSequence(
                name: "partnershareseq",
                schema: "finance");

            migrationBuilder.DropSequence(
                name: "recurringexpenseseq",
                schema: "finance");

            migrationBuilder.DropSequence(
                name: "salesfactseq",
                schema: "finance");

            migrationBuilder.DropSequence(
                name: "supplierentryseq",
                schema: "finance");

            migrationBuilder.DropSequence(
                name: "supplierseq",
                schema: "finance");
        }
    }
}
