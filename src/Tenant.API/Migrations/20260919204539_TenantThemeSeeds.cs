using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Tenant.API.Migrations
{
    /// <inheritdoc />
    public partial class TenantThemeSeeds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The theme's JSON is reshaped in place: the light page colour becomes the
            // surface seed, the text colour goes (it is derived from the surface now),
            // the one font splits by script, and the dark scheme starts derived.
            migrationBuilder.Sql("""
                UPDATE "Tenants" SET "Theme" = jsonb_strip_nulls(jsonb_build_object(
                    'Accent', "Theme"->'Accent',
                    'Surface', "Theme"->'Background',
                    'Radius', "Theme"->'Radius',
                    'FontLatin', CASE WHEN "Theme"->>'Font' IN ('Cairo', 'Tajawal', 'Almarai') THEN NULL ELSE "Theme"->'Font' END,
                    'FontArabic', CASE WHEN "Theme"->>'Font' IN ('Cairo', 'Tajawal', 'Almarai') THEN "Theme"->'Font' ELSE NULL END
                ))
                WHERE "Theme" IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "Tenants" SET "Theme" = jsonb_strip_nulls(jsonb_build_object(
                    'Accent', "Theme"->'Accent',
                    'Background', "Theme"->'Surface',
                    'Radius', "Theme"->'Radius',
                    'Font', COALESCE("Theme"->'FontLatin', "Theme"->'FontArabic')
                ))
                WHERE "Theme" IS NOT NULL;
                """);
        }
    }
}
