namespace Ninja.Ordering.UnitTests.Delivery;

using System.IO;
using System.Reflection;
using System.Text.RegularExpressions;
using Ninja.Ordering.Infrastructure;

/// <summary>
/// The delivery module's edge, held: outside src/Ordering.API/Deliveries and
/// src/Ordering.Infrastructure/Deliveries, Ordering's code may use only what
/// the module offers the rest of it (the wiring, the policy order creation
/// asks, its draft, the address book, the address error codes and the step
/// commands), and only the DbContext may name the module's tables. Anything
/// else reaching in fails here, so splitting the module out later stays a move.
/// The domain's Delivery value object is the order's own and is not the module's.
/// </summary>
[TestClass]
public class DeliveryModuleBoundaryTest
{
    /// <summary>What the rest of Ordering.API may name from the module.</summary>
    private static readonly HashSet<string> Offered =
    [
        nameof(DeliveryModule),
        nameof(IDeliveryPolicy),
        nameof(DeliveryDraft),
        nameof(DeliveryTaker),
        nameof(ICustomerAddressBook),
        nameof(AddressErrors),
    ];

    /// <summary>The one file outside the module that may name its tables and their configurations.</summary>
    private const string Context = "OrderingContext.cs";

    [TestMethod]
    public void Ordering_reaches_the_delivery_module_only_through_what_it_offers()
    {
        var root = RepoRoot();
        var apiTypes = ModuleTypes(typeof(DeliveryModule).Assembly, "Ninja.Ordering.API.Deliveries")
            .Where(t => !Offered.Contains(t) && !t.EndsWith("Command", StringComparison.Ordinal))
            .ToHashSet();
        var tableTypes = ModuleTypes(typeof(OrderingContext).Assembly, "Ninja.Ordering.Infrastructure.Deliveries")
            .Where(t => t != "DeliverySchema")
            .ToHashSet();

        var reaches = new List<string>();
        reaches.AddRange(Scan(Path.Combine(root, "src", "Ordering.API"), apiTypes.Concat(tableTypes), allowContext: false));
        reaches.AddRange(Scan(Path.Combine(root, "src", "Ordering.Infrastructure"), tableTypes, allowContext: true));
        reaches.AddRange(Scan(Path.Combine(root, "src", "Ordering.Domain"), apiTypes.Concat(tableTypes), allowContext: false));

        Assert.IsEmpty(reaches, "Outside the delivery module, Ordering names its internals:\n  " + string.Join("\n  ", reaches));
    }

    [TestMethod]
    public void The_module_offers_what_order_creation_needs()
    {
        // The edge is real: these are what OrdersApi and CreateOrderCommandHandler use
        foreach (var name in Offered)
            Assert.IsNotNull(typeof(DeliveryModule).Assembly.GetTypes().SingleOrDefault(t => t.Name == name && t.Namespace == "Ninja.Ordering.API.Deliveries"), name);
    }

    private static IEnumerable<string> ModuleTypes(Assembly assembly, string ns) =>
        assembly.GetTypes()
            .Where(t => t.Namespace == ns && !t.IsNested && !t.Name.Contains('<'))
            .Select(t => t.Name.Split('`')[0])
            .Distinct();

    private static IEnumerable<string> Scan(string folder, IEnumerable<string> forbidden, bool allowContext)
    {
        var names = forbidden.ToList();
        if (names.Count == 0) yield break;
        var pattern = new Regex(@"\b(" + string.Join("|", names.Select(Regex.Escape)) + @")\b", RegexOptions.Compiled);

        foreach (var file in Directory.EnumerateFiles(folder, "*.cs", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(folder, file);
            var segments = relative.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            if (segments.Any(s => s is "bin" or "obj" or "Migrations" or "Deliveries"))
                continue;
            if (allowContext && Path.GetFileName(file) == Context)
                continue;

            var code = WithoutComments(File.ReadAllText(file));
            foreach (Match match in pattern.Matches(code))
                yield return $"{Path.GetFileName(folder)}/{relative.Replace('\\', '/')}: {match.Value}";
        }
    }

    /// <summary>The code alone: line, block and XML doc comments say what they like.</summary>
    private static string WithoutComments(string code) =>
        Regex.Replace(code, @"/\*.*?\*/|//[^\n]*", string.Empty, RegexOptions.Singleline);

    private static string RepoRoot()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "src", "Ordering.API")))
                return dir.FullName;
        }
        throw new InvalidOperationException("The repository root (with src/Ordering.API) is not above " + AppContext.BaseDirectory);
    }
}
