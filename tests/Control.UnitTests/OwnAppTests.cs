using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json.Nodes;
using Ninja.Control.API.Apis;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

/// <summary>
/// A business's own app kept on the control plane: the upload key made or taken in here is one the
/// build signs with, its fingerprints reach the record's App Links, a carry never replaces what is
/// set, and Firebase is asked only for what is missing.
/// </summary>
[TestClass]
public sealed class OwnAppTests
{
    private static Tenant OwnApp() => new() { Slug = "blue", OwnerEmail = "owner@blue.test", NameEn = "Blue Café", AppId = "net.ninjapp.blue", AppleTeamId = "ABCDE12345" };

    [TestMethod]
    public void A_generated_upload_key_opens_with_its_password_and_names_its_alias()
    {
        var key = UploadKeys.Generate("Blue Café");

        Assert.AreEqual("upload", key.Alias);
        Assert.AreEqual(key.StorePassword, key.KeyPassword, "Java's PKCS12 takes one password for the store and the key");
        using var certificate = X509CertificateLoader.LoadPkcs12(key.Keystore, key.StorePassword);
        Assert.IsTrue(certificate.HasPrivateKey);
        Assert.Contains("CN=Blue Café", certificate.Subject);
        Assert.IsGreaterThan(DateTime.UtcNow.AddYears(24), certificate.NotAfter, "Play wants an upload key valid well beyond 2033");
        Assert.AreEqual(UploadKeys.Sha256(certificate), key.Sha256);

        // Taken in again, the same key: its alias is found in the bags and its fingerprints read
        var again = UploadKeys.Import(key.Keystore, "upload", key.KeyPassword, key.StorePassword, out var error);
        Assert.IsNull(error);
        Assert.AreEqual(key.Sha1, again!.Sha1);
        Assert.AreEqual(key.Sha256, again.Sha256);
    }

    [TestMethod]
    public void Java_reads_the_generated_key_when_keytool_is_on_this_machine()
    {
        var keytool = new[]
        {
            Environment.GetEnvironmentVariable("JAVA_HOME") is { Length: > 0 } home ? Path.Combine(home, "bin", OperatingSystem.IsWindows() ? "keytool.exe" : "keytool") : "",
            @"C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe",
        }.FirstOrDefault(File.Exists);
        if (keytool is null)
        {
            Assert.Inconclusive("No keytool here: CI's Android build is where Gradle reads it");
            return;
        }

        var key = UploadKeys.Generate("Blue Café");
        var file = Path.Combine(Path.GetTempPath(), $"upload-{Guid.NewGuid():N}.jks");
        File.WriteAllBytes(file, key.Keystore);
        try
        {
            var run = System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(keytool, ["-list", "-v", "-keystore", file, "-storepass", key.StorePassword, "-alias", "upload"])
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            })!;
            var output = run.StandardOutput.ReadToEnd() + run.StandardError.ReadToEnd();
            run.WaitForExit();
            Assert.AreEqual(0, run.ExitCode, output);
            Assert.Contains("PrivateKeyEntry", output);
            Assert.Contains(key.Sha256!, output, "keytool shows the fingerprint the record is given");
        }
        finally
        {
            File.Delete(file);
        }
    }

    [TestMethod]
    public void An_imported_key_is_refused_with_the_wrong_password_or_alias_and_a_jks_one_is_kept_unread()
    {
        var key = UploadKeys.Generate("Blue");
        Assert.IsNull(UploadKeys.Import(key.Keystore, "upload", "wrong", "wrong", out var password));
        Assert.Contains("password", password!);
        Assert.IsNull(UploadKeys.Import(key.Keystore, "release", key.KeyPassword, key.StorePassword, out var alias));
        Assert.Contains("upload", alias!, "the error names the aliases it has");

        byte[] jks = [0xFE, 0xED, 0xFE, 0xED, 0, 0, 0, 2, 1, 2, 3];
        var kept = UploadKeys.Import(jks, "upload", "secret", "secret", out var error);
        Assert.IsNull(error);
        Assert.IsNull(kept!.Sha256, "a JKS key's fingerprints come from its first build");
    }

    [TestMethod]
    public void A_new_upload_key_replaces_the_old_ones_fingerprint_on_the_record_and_keeps_plays()
    {
        var play = string.Join(':', Enumerable.Repeat("AB", 32));
        var tenant = OwnApp();
        tenant.AndroidCertFingerprints = play;
        var app = new TenantApp { TenantId = tenant.Id };

        var first = UploadKeys.Generate("Blue");
        ControlApi.SetUploadKey(tenant, app, first);
        CollectionAssert.AreEqual(new[] { play, first.Sha256 }, AppLinks.Fingerprints(tenant.AndroidCertFingerprints));

        var second = UploadKeys.Generate("Blue");
        ControlApi.SetUploadKey(tenant, app, second);
        CollectionAssert.AreEqual(new[] { play, second.Sha256 }, AppLinks.Fingerprints(tenant.AndroidCertFingerprints));
        Assert.AreEqual(second.Sha256, app.UploadKeySha256);
    }

    [TestMethod]
    public void A_carry_fills_what_is_empty_and_never_replaces_what_is_set()
    {
        var tenant = OwnApp();
        var key = UploadKeys.Generate("Blue");
        var app = new TenantApp { TenantId = tenant.Id, PlayServiceAccountJson = "{\"saved\":true}" };
        using var ec = ECDsa.Create(ECCurve.NamedCurves.nistP256);

        var result = AppCarry.Apply(tenant, app, new CarryAppKitRequest(
            Keystore: System.Convert.ToBase64String(key.Keystore),
            KeyAlias: "upload",
            KeyPassword: key.KeyPassword,
            StorePassword: key.StorePassword,
            PlayServiceAccountJson: ServiceAccountJson(RSA.Create(2048)),
            AscKeyId: "KEY1234567",
            AscIssuerId: Guid.NewGuid().ToString(),
            AscPrivateKey: ec.ExportPkcs8PrivateKeyPem(),
            GoogleServicesJson: "{\"package_name\": \"com.someone.else\"}"));

        CollectionAssert.AreEquivalent(new[] { "keystore", "apple" }, result.Filled.ToArray());
        CollectionAssert.AreEqual(new[] { "play" }, result.Kept.ToArray());
        Assert.HasCount(1, result.Refused, "another app's Firebase file is refused");
        Assert.AreEqual("{\"saved\":true}", app.PlayServiceAccountJson);
        Assert.AreEqual(key.Sha256, app.UploadKeySha256);
        Assert.Contains(key.Sha256!, tenant.AndroidCertFingerprints!);

        var again = AppCarry.Apply(tenant, app, new CarryAppKitRequest(Keystore: System.Convert.ToBase64String(UploadKeys.Generate("Other").Keystore), KeyAlias: "upload", StorePassword: "x"));
        CollectionAssert.AreEqual(new[] { "keystore" }, again.Kept.ToArray());
        Assert.AreEqual(key.Sha256, app.UploadKeySha256, "a carried key is never replaced by a second carry");
    }

    [TestMethod]
    public void Each_platforms_kit_holds_only_what_its_build_uses()
    {
        var app = new TenantApp
        {
            UploadKeystore = "a2V5", KeyAlias = "upload", KeyPassword = "k", StorePassword = "s", UploadKeySha256 = "AA",
            PlayServiceAccountJson = "{}", AscKeyId = "KEY", AscIssuerId = "issuer", AscPrivateKey = "p8",
            GoogleServicesJson = "{android}", GoogleServiceInfoPlist = "<ios/>", Icon = [1], IconForeground = [2],
        };
        var android = ControlApi.Kit(app, "android");
        Assert.AreEqual("{android}", android.GoogleServicesJson);
        Assert.AreEqual("a2V5", android.Keystore);
        Assert.IsTrue(android.FingerprintsKnown);
        Assert.IsNull(android.AscPrivateKey, "Android's build never sees Apple's key");
        Assert.IsNull(android.GoogleServiceInfoPlist);

        var ios = ControlApi.Kit(app, "ios");
        Assert.AreEqual("p8", ios.AscPrivateKey);
        Assert.AreEqual("<ios/>", ios.GoogleServiceInfoPlist);
        Assert.IsNull(ios.Keystore, "iOS's build never sees the upload key");
        Assert.IsNull(ios.PlayServiceAccountJson);
        Assert.IsNull(ios.IconForeground);
    }

    [TestMethod]
    public void Both_icons_are_made_from_a_logo_of_any_shape()
    {
        // A black mark on white, wider than tall, off-centre, like a logo exported from anything
        using var logo = new SkiaSharp.SKBitmap(614, 600);
        using (var canvas = new SkiaSharp.SKCanvas(logo))
        {
            canvas.Clear(SkiaSharp.SKColors.White);
            using var ink = new SkiaSharp.SKPaint { Color = SkiaSharp.SKColors.Black };
            canvas.DrawRect(100, 200, 400, 300, ink);
        }
        using var encoded = SkiaSharp.SKImage.FromBitmap(logo).Encode(SkiaSharp.SKEncodedImageFormat.Png, 100);

        var made = AppIcons.Make(encoded.ToArray(), out var error);
        Assert.IsNull(error);

        using var icon = SkiaSharp.SKBitmap.Decode(made!.Icon);
        Assert.AreEqual(1024, icon.Width);
        Assert.AreEqual(1024, icon.Height);
        Assert.AreEqual(SkiaSharp.SKColors.White, icon.GetPixel(10, 10), "the margin is white");
        Assert.AreEqual(255, icon.GetPixel(10, 10).Alpha, "no transparency for the App Store");
        Assert.AreEqual(SkiaSharp.SKColors.Black, icon.GetPixel(512, 512), "the mark is centred");

        using var foreground = SkiaSharp.SKBitmap.Decode(made.Foreground);
        Assert.AreEqual(1024, foreground.Width);
        Assert.AreEqual(0, foreground.GetPixel(10, 10).Alpha, "the layer around the mark is transparent");
        Assert.AreEqual(0, foreground.GetPixel(512, 190).Alpha, "the mark stays in the middle 60%, inside every launcher's mask");
        Assert.AreEqual(SkiaSharp.SKColors.Black, foreground.GetPixel(512, 512));

        Assert.IsNull(AppIcons.Make(Encoding.ASCII.GetBytes("not an image at all"), out var refused));
        Assert.Contains("not an image", refused!);
    }

    [TestMethod]
    public void The_local_checks_name_what_is_missing()
    {
        var tenant = OwnApp();
        var checks = AppChecks.Local(tenant, new TenantApp()).ToDictionary(c => c.Item);
        Assert.IsFalse(checks["android-key"].Ok);
        Assert.IsFalse(checks["firebase-android"].Ok);
        Assert.IsFalse(checks["icon"].Ok);
        Assert.IsTrue(checks["apple-team"].Ok);
        Assert.IsFalse(checks["app-links"].Ok, "no Play app signing fingerprint on the record");

        var ok = AppChecks.Local(tenant, new TenantApp
        {
            UploadKeystore = "x", UploadKeySha256 = "11:22:33:44:55:66",
            GoogleServicesJson = "{\"package_name\": \"net.ninjapp.blue\"}",
            GoogleServiceInfoPlist = "<key>BUNDLE_ID</key>\n<string>com.other</string>",
            Icon = [1],
        }).ToDictionary(c => c.Item);
        Assert.IsTrue(ok["android-key"].Ok);
        Assert.IsTrue(ok["firebase-android"].Ok);
        Assert.IsFalse(ok["firebase-ios"].Ok, "another app's plist");
        Assert.Contains("com.other", ok["firebase-ios"].Detail);
    }

    [TestMethod]
    public void An_app_store_connect_token_is_es256_signed_for_apple()
    {
        using var ec = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var pem = ec.ExportPkcs8PrivateKeyPem();
        Assert.IsTrue(StoreKeys.IsAscKey(pem));
        Assert.IsFalse(StoreKeys.IsAscKey("-----BEGIN PRIVATE KEY-----\nnope\n-----END PRIVATE KEY-----"));

        var parts = StoreKeys.AscToken("KEY1234567", "issuer", pem).Split('.');
        Assert.HasCount(3, parts);
        var header = JsonNode.Parse(FromBase64Url(parts[0]))!;
        var payload = JsonNode.Parse(FromBase64Url(parts[1]))!;
        Assert.AreEqual("ES256", header["alg"]!.GetValue<string>());
        Assert.AreEqual("KEY1234567", header["kid"]!.GetValue<string>());
        Assert.AreEqual("appstoreconnect-v1", payload["aud"]!.GetValue<string>());
        Assert.IsTrue(ec.VerifyData(Encoding.ASCII.GetBytes($"{parts[0]}.{parts[1]}"), FromBase64Url(parts[2]), HashAlgorithmName.SHA256));
    }

    [TestMethod]
    public async Task Linking_finds_the_existing_apps_adds_only_the_missing_certificate_and_keeps_both_files()
    {
        var known = string.Join(':', Enumerable.Repeat("AA", 20));
        var missing = string.Join(':', Enumerable.Repeat("BB", 32));
        var handler = new FakeGoogle(request => (request.Method.Method, request.RequestUri!.AbsolutePath) switch
        {
            ("POST", "/token") => """{"access_token":"t"}""",
            ("GET", "/v1beta1/projects/ninja-test/androidApps") => """{"apps":[{"appId":"1:2:android:3","packageName":"net.ninjapp.blue"}]}""",
            ("GET", "/v1beta1/projects/ninja-test/androidApps/1:2:android:3/sha") => $$"""{"certificates":[{"shaHash":"{{known.Replace(":", "").ToLowerInvariant()}}","certType":"SHA_1"}]}""",
            ("POST", "/v1beta1/projects/ninja-test/androidApps/1:2:android:3/sha") => "{}",
            ("GET", "/v1beta1/projects/ninja-test/androidApps/1:2:android:3/config") => $$"""{"configFileContents":"{{B64("{android file}")}}"}""",
            ("GET", "/v1beta1/projects/ninja-test/iosApps") => """{"apps":[]}""",
            ("POST", "/v1beta1/projects/ninja-test/iosApps") => """{"name":"operations/make-ios","done":false}""",
            ("GET", "/v1beta1/operations/make-ios") => """{"name":"operations/make-ios","done":true,"response":{"appId":"1:2:ios:4","bundleId":"net.ninjapp.blue"}}""",
            ("GET", "/v1beta1/projects/ninja-test/iosApps/1:2:ios:4/config") => $$"""{"configFileContents":"{{B64("<ios file/>")}}"}""",
            _ => null,
        });
        var account = GoogleServiceAccount.Parse(ServiceAccountJson(RSA.Create(2048)), out _)!;
        var firebase = new FirebaseApps(new HttpClient(handler), account, TimeSpan.Zero);

        var result = await firebase.LinkAsync("net.ninjapp.blue", "Blue", "ABCDE12345", [known], [missing], CancellationToken.None);

        Assert.AreEqual("1:2:android:3", result.Android!.AppId);
        Assert.AreEqual("{android file}", result.Android.ConfigFile);
        Assert.AreEqual("1:2:ios:4", result.Ios!.AppId);
        Assert.AreEqual("<ios file/>", result.Ios.ConfigFile);
        var added = handler.Bodies.Where(b => b.Path.EndsWith("/sha") && b.Method == "POST").ToList();
        Assert.HasCount(1, added, "the SHA-1 Firebase already had is not added again");
        Assert.Contains("SHA_256", added[0].Body);
        Assert.Contains("ABCDE12345", handler.Bodies.Single(b => b.Path.EndsWith("/iosApps") && b.Method == "POST").Body, "the iOS app is made under the business's team");
    }

    [TestMethod]
    public async Task A_build_is_started_for_the_customer_app_and_found_again_by_its_name()
    {
        var since = new DateTime(2026, 11, 3, 12, 0, 0, DateTimeKind.Utc);
        var handler = new FakeGoogle(request => (request.Method.Method, request.RequestUri!.AbsolutePath) switch
        {
            ("POST", "/repos/achmstein/Ninja/actions/workflows/mobile-deploy.yml/dispatches") => null,
            ("GET", "/repos/achmstein/Ninja/actions/workflows/mobile-deploy.yml/runs") => """
                {"workflow_runs":[
                  {"id":7,"display_title":"Customer app for other","status":"queued","html_url":"https://x/7","created_at":"2026-11-03T12:00:05Z"},
                  {"id":9,"display_title":"Customer app for blue","status":"in_progress","conclusion":null,"html_url":"https://x/9","created_at":"2026-11-03T12:00:06Z"}]}
                """,
            ("GET", "/repos/achmstein/Ninja/actions/runs/9/jobs") => """
                {"jobs":[{"name":"build-android-client","status":"completed","conclusion":"success"},
                         {"name":"build-ios-client","status":"in_progress","conclusion":null},
                         {"name":"build-android-pos","status":"completed","conclusion":"skipped"}]}
                """,
            _ => null,
        }, noContentFor: "/dispatches");
        var builds = new GitHubBuilds(new HttpClient(handler), new AppBuildSettings { GitHubToken = "github_pat_x" });

        Assert.IsNull(await builds.StartAsync("blue", "all", "internal", CancellationToken.None), "GitHub said no run id: it is found by name");
        var dispatch = JsonNode.Parse(handler.Bodies.First().Body)!;
        Assert.AreEqual("client_app", dispatch["inputs"]!["app"]!.GetValue<string>());
        Assert.AreEqual("blue", dispatch["inputs"]!["tenant"]!.GetValue<string>());
        Assert.AreEqual("main", dispatch["ref"]!.GetValue<string>());

        var run = await builds.FindAsync("blue", null, since, CancellationToken.None);
        Assert.AreEqual(9, run!.Id);
        Assert.AreEqual("in_progress", run.Status);
        CollectionAssert.AreEqual(new[] { "Android", "iOS" }, run.Jobs.Select(j => j.Name).ToArray(), "only the customer app's jobs");
        Assert.AreEqual("success", run.Jobs[0].Conclusion);
    }

    [TestMethod]
    public async Task The_apple_app_ids_are_made_when_missing_with_the_apps_capabilities()
    {
        using var ec = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var handler = new FakeGoogle(request => (request.Method.Method, request.RequestUri!.AbsolutePath, request.RequestUri.Query) switch
        {
            ("GET", "/v1/bundleIds", var q) when q.Contains("ChillaxLiveActivity") => """{"data":[{"id":"EXT","attributes":{"identifier":"net.ninjapp.blue.ChillaxLiveActivity"}}]}""",
            ("GET", "/v1/bundleIds", _) => """{"data":[{"id":"OTHER","attributes":{"identifier":"net.ninjapp.blue.ChillaxLiveActivity"}}]}""",
            ("POST", "/v1/bundleIds", _) => """{"data":{"id":"APP"}}""",
            ("GET", "/v1/bundleIds/APP/bundleIdCapabilities", _) => """{"data":[{"attributes":{"capabilityType":"PUSH_NOTIFICATIONS"}}]}""",
            ("POST", "/v1/bundleIdCapabilities", _) => "{}",
            _ => null,
        });

        var done = await StoreKeys.RegisterAppIdsAsync(new HttpClient(handler), "KEY1234567", "issuer", ec.ExportPkcs8PrivateKeyPem(), "net.ninjapp.blue", "Blue Café", CancellationToken.None);

        var made = handler.Bodies.Where(b => b.Method == "POST" && b.Path == "/v1/bundleIds").ToList();
        Assert.HasCount(1, made, "the app is made; the extension, already there, is not");
        Assert.Contains("\"Blue Caf\"", made[0].Body, "Apple's names take letters, digits and spaces");
        var capabilities = handler.Bodies.Where(b => b.Path == "/v1/bundleIdCapabilities").Select(b => b.Body).ToList();
        Assert.HasCount(2, capabilities, "push was there already");
        Assert.IsTrue(capabilities.Any(c => c.Contains("SIGN_IN_WITH_APPLE") && c.Contains("PRIMARY_APP_CONSENT")), "Sign in with Apple as its own primary App ID");
        Assert.IsTrue(capabilities.Any(c => c.Contains("ASSOCIATED_DOMAINS")));
        Assert.HasCount(3, done);
    }

    private static string B64(string s) => System.Convert.ToBase64String(Encoding.UTF8.GetBytes(s));

    private static byte[] FromBase64Url(string s)
    {
        s = s.Replace('-', '+').Replace('_', '/');
        return System.Convert.FromBase64String(s.PadRight(s.Length + (4 - s.Length % 4) % 4, '='));
    }

    private static string ServiceAccountJson(RSA rsa) => new JsonObject
    {
        ["type"] = "service_account",
        ["project_id"] = "ninja-test",
        ["client_email"] = "builder@ninja-test.iam.gserviceaccount.com",
        ["private_key"] = rsa.ExportPkcs8PrivateKeyPem(),
        ["token_uri"] = "https://oauth2.googleapis.com/token",
    }.ToJsonString();

    private sealed class FakeGoogle(Func<HttpRequestMessage, string?> answer, string? noContentFor = null) : HttpMessageHandler
    {
        public List<(string Method, string Path, string Body)> Bodies { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var body = request.Content is null ? "" : await request.Content.ReadAsStringAsync(ct);
            Bodies.Add((request.Method.Method, request.RequestUri!.AbsolutePath, body));
            if (noContentFor is not null && request.RequestUri.AbsolutePath.EndsWith(noContentFor, StringComparison.Ordinal))
                return new HttpResponseMessage(HttpStatusCode.NoContent);
            return answer(request) is { } json
                ? new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") }
                : new HttpResponseMessage(HttpStatusCode.NotFound) { Content = new StringContent($"no fake for {request.Method} {request.RequestUri}") };
        }
    }
}
