using System.ComponentModel;
using System.Drawing.Printing;
using System.Net.Sockets;
using System.Runtime.InteropServices;

namespace Ninja.PrintConnector;

/// <summary>Where a ticket's bytes go: a printer Windows knows by name, or one on the network.</summary>
public static class Printers
{
    /// <summary>The printers Windows has on this PC, for admin's station form.</summary>
    public static List<string> Installed() => PrinterSettings.InstalledPrinters.Cast<string>().Order().ToList();

    /// <summary>Raw ESC/POS through the Windows spooler: the driver passes it on untouched.</summary>
    public static void SendToWindowsPrinter(string printerName, byte[] bytes)
    {
        if (!OpenPrinter(printerName, out var printer, IntPtr.Zero))
            throw new Win32Exception(Marshal.GetLastWin32Error(), $"Windows has no printer named \"{printerName}\"");
        try
        {
            var doc = new DocInfo { DocName = "Ninja kitchen ticket", DataType = "RAW" };
            if (StartDocPrinter(printer, 1, doc) == 0)
                throw new Win32Exception(Marshal.GetLastWin32Error(), $"\"{printerName}\" refused the ticket");
            try
            {
                StartPagePrinter(printer);
                var unmanaged = Marshal.AllocHGlobal(bytes.Length);
                try
                {
                    Marshal.Copy(bytes, 0, unmanaged, bytes.Length);
                    if (!WritePrinter(printer, unmanaged, bytes.Length, out var written) || written != bytes.Length)
                        throw new Win32Exception(Marshal.GetLastWin32Error(), $"\"{printerName}\" took only part of the ticket");
                }
                finally
                {
                    Marshal.FreeHGlobal(unmanaged);
                }
                EndPagePrinter(printer);
            }
            finally
            {
                EndDocPrinter(printer);
            }
        }
        finally
        {
            ClosePrinter(printer);
        }
    }

    /// <summary>The raw port every ESC/POS network printer listens on: connect, write, close.</summary>
    public static async Task SendToNetworkPrinterAsync(string host, int port, byte[] bytes, CancellationToken ct)
    {
        using var client = new TcpClient();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(5));
        try
        {
            await client.ConnectAsync(host, port, timeout.Token);
        }
        catch (Exception e) when (e is SocketException or OperationCanceledException)
        {
            throw new IOException($"cannot reach {host}:{port} — {(e is SocketException s ? s.Message : "timed out")}", e);
        }
        await using var stream = client.GetStream();
        await stream.WriteAsync(bytes, timeout.Token);
        await stream.FlushAsync(timeout.Token);
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private sealed class DocInfo
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string? DocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string? OutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string? DataType;
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool OpenPrinter(string printerName, out IntPtr printer, IntPtr defaults);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool ClosePrinter(IntPtr printer);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern int StartDocPrinter(IntPtr printer, int level, [In] DocInfo docInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool EndDocPrinter(IntPtr printer);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool StartPagePrinter(IntPtr printer);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool EndPagePrinter(IntPtr printer);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool WritePrinter(IntPtr printer, IntPtr bytes, int count, out int written);
}
