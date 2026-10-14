using System.Diagnostics;
using Ninja.PrintConnector;

const string ServiceName = "NinjaPrintConnector";

// Run by Windows as the service: print until stopped
if (args.Contains("--service"))
{
    var config = ConnectorConfig.Load()
        ?? throw new InvalidOperationException("Not paired: run ninja-print-connector.exe once and paste the pairing link from admin.");

    var builder = Host.CreateApplicationBuilder(args);
    builder.Services.AddWindowsService(o => o.ServiceName = ServiceName);
    builder.Services.AddSingleton(config);
    builder.Services.AddHostedService<PrintWorker>();
    // The web till on this PC prints through it, with or without the internet
    builder.Services.AddHostedService<LocalApiService>();
    builder.Logging.AddEventLog(o => o.SourceName = ServiceName);
    await builder.Build().RunAsync();
    return 0;
}

// Support's check: a sample ticket drawn to an image, to see the fonts and the Arabic on this PC
if (args.Length == 3 && args[0] == "--preview")
{
    var sample = new KitchenTicket(0, 0, new TicketText("Shisha", "الشيشة"), null, 9100, null, null, DateTime.UtcNow, null,
        IsReprint: true, IsTest: false, 3124, DateTime.UtcNow, "Customer", new TicketText("Table 4", "ترابيزة ٤"), "Mona",
        args[2] == "ar" ? "عيد ميلاد — الحجر بسرعة" : "Birthday — coals quickly please",
        [
            new(new TicketText("Mint shisha", "شيشة نعناع"), 1, null, "Extra ice"),
            new(new TicketText("Grape shisha", "شيشة عنب"), 1, new TicketText("Double apple head", "حجر تفاحتين"), null),
        ]);
    using var image = TicketRenderer.Render(sample, args[2], TicketRenderer.Labels.For(args[2]));
    image.Save(args[1], System.Drawing.Imaging.ImageFormat.Png);
    return 0;
}

if (args.Contains("--uninstall"))
{
    Sc($"stop {ServiceName}");
    Sc($"delete {ServiceName}");
    ConnectorConfig.Forget();
    Console.WriteLine("The print connector was removed from this PC.");
    return 0;
}

// Run by a person: pair with the business, then install and start the service
Console.OutputEncoding = System.Text.Encoding.UTF8;
Console.WriteLine("Ninja Print Connector");
Console.WriteLine("Prints the kitchen's tickets on this PC's printers.");
Console.WriteLine();

var link = args.FirstOrDefault(a => a.Contains("/connect/", StringComparison.OrdinalIgnoreCase));

// A new version run on a PC already paired: put it in place and keep the
// pairing, unless someone asks to pair again (or passed a new link)
if (link is null && ConnectorConfig.Load() is { } current && Sc($"query {ServiceName}") == 0)
{
    Console.WriteLine($"This PC is already paired with {current.Server} as connector {current.ConnectorId}.");
    var answer = "";
    if (!Console.IsInputRedirected)
    {
        Console.Write("Press Enter to update it, or type P to pair it again: ");
        answer = Console.ReadLine()?.Trim() ?? "";
    }
    if (!string.Equals(answer, "P", StringComparison.OrdinalIgnoreCase))
    {
        Install();
        Console.WriteLine();
        Console.WriteLine("Updated. The connector runs in the background and starts with Windows.");
        Pause();
        return 0;
    }
}

while (link is null)
{
    Console.Write("Paste the pairing link from admin (Branches → Kitchen → Pair a Windows PC): ");
    var typed = Console.ReadLine()?.Trim();
    if (typed?.Contains("/connect/", StringComparison.OrdinalIgnoreCase) == true) link = typed;
    else Console.WriteLine("That is not a pairing link. It looks like https://api.your-business…/connect/ABCD2345");
}

var at = link.IndexOf("/connect/", StringComparison.OrdinalIgnoreCase);
var server = link[..at];
var code = link[(at + "/connect/".Length)..].Trim('/', ' ');

try
{
    var paired = await QueueClient.PairAsync(server, code, CancellationToken.None);
    ConnectorConfig.Create(server, paired.ConnectorId, paired.Key, paired.Language).Save();
    Console.WriteLine($"Paired as connector {paired.ConnectorId}.");
}
catch (Exception e)
{
    Console.WriteLine($"Pairing failed: {e.Message}");
    Pause();
    return 1;
}

Install();

Console.WriteLine();
Console.WriteLine("Done. The connector runs in the background and starts with Windows.");
Console.WriteLine("In admin, pick this PC's printer for a kitchen station; it shows up within a minute.");
Pause();
return 0;

// A fixed home, so the download can be deleted and the service still starts
static void Install()
{
    var installDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Ninja", "PrintConnector");
    Directory.CreateDirectory(installDir);
    var installed = Path.Combine(installDir, "ninja-print-connector.exe");
    var self = Environment.ProcessPath!;
    Sc($"stop {ServiceName}");
    if (!string.Equals(self, installed, StringComparison.OrdinalIgnoreCase))
    {
        // A running service keeps the old copy locked for a moment after stopping
        for (var attempt = 0; ; attempt++)
        {
            try { File.Copy(self, installed, overwrite: true); break; }
            catch (IOException) when (attempt < 10) { Thread.Sleep(500); }
        }
    }

    Sc($"delete {ServiceName}");
    Sc($"create {ServiceName} binPath= \"\\\"{installed}\\\" --service\" start= auto DisplayName= \"Ninja Print Connector\"");
    Sc($"description {ServiceName} \"Prints the kitchen's tickets and the till's receipts from Ninja on this PC's printers.\"");
    // Come back by itself if it ever stops unexpectedly
    Sc($"failure {ServiceName} reset= 86400 actions= restart/5000/restart/5000/restart/30000");
    Sc($"start {ServiceName}");
}

static int Sc(string arguments)
{
    using var process = Process.Start(new ProcessStartInfo("sc.exe", arguments) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true })!;
    process.WaitForExit();
    return process.ExitCode;
}

static void Pause()
{
    if (!Console.IsInputRedirected)
    {
        Console.WriteLine("Press Enter to close.");
        Console.ReadLine();
    }
}
