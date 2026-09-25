using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Apis;
using Ninja.Control.API.Extensions;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

/// <summary>
/// What the wizard chose stays editable: the record takes the locale, the
/// Arabic, the starting theme and the kind of place, and a running café's
/// apps see them at once, through the same tenant endpoint the brand goes by.
/// </summary>
[TestClass]
public sealed class StackSettingsTests
{
    private string _root = null!;
    private ControlContext _context = null!;
    private PlatformOptions _platform = null!;
    private DryRunStackProxy _stack = null!;
    private Provisioner _provisioner = null!;
    private Tenant _tenant = null!;

    private sealed class NoAudit : IAuditWriter
    {
        public Task WriteAsync(string action, string? slug, object? details, CancellationToken ct, string? source = null) => Task.CompletedTask;
    }

    [TestInitialize]
    public async Task Setup()
    {
        _root = Path.Combine(Path.GetTempPath(), "ninja-stack-settings-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_root);
        _platform = new PlatformOptions { Domain = "ninja.app", TenantsRoot = _root, PullImages = false };
        var options = Options.Create(_platform);
        _context = new ControlContext(new DbContextOptionsBuilder<ControlContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        _stack = new DryRunStackProxy(options);
        var shell = new RecordingShell(NullLogger<RecordingShell>.Instance);
        _provisioner = new Provisioner(_context, options, shell,
            new DryRunDatabaseAdmin(NullLogger<DryRunDatabaseAdmin>.Instance),
            new DryRunBrokerAdmin(NullLogger<DryRunBrokerAdmin>.Instance),
            new DryRunKeycloakAdmin(NullLogger<DryRunKeycloakAdmin>.Instance),
            new HttpTenantStack(_stack, NullLogger<HttpTenantStack>.Instance), new NoAudit(),
            new BackupService(shell, new RecordingOffsiteStore(), options, NullLogger<BackupService>.Instance),
            NullLogger<Provisioner>.Instance);

        _tenant = new Tenant
        {
            Slug = "blue", NameEn = "Blue", Kind = TenantKind.Customer, Status = TenantStatus.Running, Plan = TenantPlan.Pro,
            OwnerEmail = "owner@blue.test", IdentitySecret = TenantNaming.NewSecret(), ControlSecret = TenantNaming.NewSecret(), ImageTag = "v1",
            Country = "EG", Currency = "EGP", TimeZone = "Africa/Cairo", DefaultLanguage = "ar", ArabicStyle = "egyptian",
            BusinessType = BusinessType.CoffeeShop,
        };
        _context.Tenants.Add(_tenant);
        await _context.SaveChangesAsync();
    }

    [TestCleanup]
    public void Cleanup()
    {
        _context.Dispose();
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }

    private static UpdateTenantRequest Record(
        string country = "EG", string currency = "EGP", string timeZone = "Africa/Cairo", string language = "ar",
        string? arabicStyle = null, string? defaultTheme = null, BusinessType? business = null)
        => new("Blue", null, null, null, null, null, null, null, null, country, currency, timeZone, language, arabicStyle, defaultTheme, business);

    private Task<Microsoft.AspNetCore.Http.HttpResults.Results<Ok<TenantDetail>, NotFound, BadRequest<Microsoft.AspNetCore.Mvc.ProblemDetails>, ProblemHttpResult>> SaveAsync(UpdateTenantRequest request)
        => ControlApi.UpdateTenant(_context, null!, new NoAudit(), _provisioner, null!, _stack, Options.Create(_platform), "blue", request, CancellationToken.None);

    /// <summary>A running café speaks, prices and tells time the way the record now says, without waiting for an upgrade.</summary>
    [TestMethod]
    public async Task The_record_puts_the_locale_and_the_arabic_on_the_running_cafe()
    {
        var result = await SaveAsync(Record(country: "SA", currency: "SAR", timeZone: "Asia/Riyadh", language: "en", arabicStyle: "standard"));

        Assert.IsInstanceOfType<Ok<TenantDetail>>(result.Result);
        var locale = _stack.BrandOf(_tenant)["locale"]!;
        Assert.AreEqual("SA", locale["country"]!.GetValue<string>());
        Assert.AreEqual("SAR", locale["currency"]!.GetValue<string>());
        Assert.AreEqual("Asia/Riyadh", locale["timeZone"]!.GetValue<string>());
        Assert.AreEqual("en", locale["language"]!.GetValue<string>());
        Assert.AreEqual("standard", locale["arabicStyle"]!.GetValue<string>());
        Assert.AreEqual("standard", _tenant.ArabicStyle);
    }

    /// <summary>The light or dark a new person starts in moves on the café; "device" goes back to following the phone.</summary>
    [TestMethod]
    public async Task The_record_puts_the_starting_theme_on_the_running_cafe()
    {
        await SaveAsync(Record(defaultTheme: "dark"));
        Assert.AreEqual("dark", _stack.BrandOf(_tenant)["theme"]!["mode"]!.GetValue<string>());
        Assert.AreEqual("dark", _tenant.DefaultTheme);

        await SaveAsync(Record(defaultTheme: "device"));
        Assert.IsNull(_stack.BrandOf(_tenant)["theme"]!["mode"]);
        Assert.IsNull(_tenant.DefaultTheme);
    }

    /// <summary>
    /// The kind of place is a label on a running café: its apps learn it (a
    /// cloud kitchen hides its tables), but the switches the owner set and
    /// whether guests order from anywhere stay exactly as they were.
    /// </summary>
    [TestMethod]
    public async Task A_new_kind_of_place_changes_the_label_and_nothing_the_cafe_set()
    {
        var brand = _stack.BrandOf(_tenant);
        brand["features"]!["reservations"] = true;
        brand["guestOrdersAnywhere"] = false;

        await SaveAsync(Record(business: BusinessType.CloudKitchen));

        brand = _stack.BrandOf(_tenant);
        Assert.AreEqual("cloud_kitchen", brand["businessType"]!.GetValue<string>());
        Assert.IsTrue(brand["features"]!["reservations"]!.GetValue<bool>(), "the switches are the owner's");
        Assert.IsFalse(brand["guestOrdersAnywhere"]!.GetValue<bool>(), "guest ordering is the owner's");
        Assert.AreEqual(BusinessType.CloudKitchen, _tenant.BusinessType);
    }

    /// <summary>Left out, each setting stays as it is.</summary>
    [TestMethod]
    public async Task What_the_record_leaves_out_stays()
    {
        _tenant.DefaultTheme = "light";
        await _context.SaveChangesAsync();

        await SaveAsync(Record());

        Assert.AreEqual("light", _tenant.DefaultTheme);
        Assert.AreEqual("egyptian", _tenant.ArabicStyle);
        Assert.AreEqual(BusinessType.CoffeeShop, _tenant.BusinessType);
    }

    [TestMethod]
    public async Task An_unknown_arabic_or_theme_is_refused()
    {
        Assert.IsInstanceOfType<BadRequest<Microsoft.AspNetCore.Mvc.ProblemDetails>>((await SaveAsync(Record(arabicStyle: "levantine"))).Result);
        Assert.IsInstanceOfType<BadRequest<Microsoft.AspNetCore.Mvc.ProblemDetails>>((await SaveAsync(Record(defaultTheme: "sepia"))).Result);
    }

    /// <summary>A stack that is not running is not called; the record keeps the change.</summary>
    [TestMethod]
    public async Task A_stopped_cafe_keeps_the_change_on_the_record()
    {
        _tenant.Status = TenantStatus.Stopped;
        await _context.SaveChangesAsync();

        var result = await SaveAsync(Record(language: "en"));

        Assert.IsInstanceOfType<Ok<TenantDetail>>(result.Result);
        Assert.AreEqual("en", _tenant.DefaultLanguage);
        Assert.IsFalse(_stack.Brands.ContainsKey("blue"), "nothing was sent to a stopped stack");
    }

    /// <summary>The brand is sent back whole: the theme, the switches and the customer URL the café had go with it.</summary>
    [TestMethod]
    public void The_rest_of_the_brand_goes_back_as_the_cafe_had_it()
    {
        var current = new JsonObject
        {
            ["customerUrl"] = "https://blue.ninja.app",
            ["features"] = new JsonObject { ["kds"] = false },
            ["theme"] = new JsonObject { ["accent"] = "#ff0000", ["mode"] = "light" },
            ["icons"] = new JsonObject(),
        };
        _tenant.DefaultTheme = "dark";

        var brand = StackSettings.Apply(current, _tenant);

        Assert.AreEqual("https://blue.ninja.app", brand["customerUrl"]!.GetValue<string>());
        Assert.IsFalse(brand["features"]!["kds"]!.GetValue<bool>());
        Assert.AreEqual("#ff0000", brand["theme"]!["accent"]!.GetValue<string>());
        Assert.AreEqual("dark", brand["theme"]!["mode"]!.GetValue<string>());
        Assert.IsNull(brand["icons"], "what the stack makes itself is not sent back");
    }
}
