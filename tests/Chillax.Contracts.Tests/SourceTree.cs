using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Chillax.Contracts.Tests;

/// <summary>A record or class declared in one service, with the property names System.Text.Json would read or write.</summary>
public sealed record TypeShape(string Name, string Service, string Namespace, string File, IReadOnlySet<string> Properties, IReadOnlyDictionary<string, string> PropertyTypes);

/// <summary>One `new XIntegrationEvent(...)`: where, and which namespaces that file can see (to tell duplicate declarations apart).</summary>
public sealed record PublishSite(string Service, string File, IReadOnlySet<string> VisibleNamespaces);

/// <summary>
/// The integration-event contracts as written in src/: each service's copy
/// of every event, who news one up (publishes) and who subscribes.
/// </summary>
public sealed class SourceTree
{
    public const string EventSuffix = "IntegrationEvent";

    private static readonly Lazy<SourceTree> Cached = new(Load);

    public static SourceTree Current => Cached.Value;

    public string Root { get; }

    /// <summary>Event name → every service's copy.</summary>
    public IReadOnlyDictionary<string, IReadOnlyList<TypeShape>> Events { get; }

    /// <summary>Service → every record/class it declares (for the payload types nested in events).</summary>
    public IReadOnlyDictionary<string, IReadOnlyDictionary<string, TypeShape>> TypesByService { get; }

    /// <summary>Event name → services that construct it outside its declaration folder.</summary>
    public IReadOnlyDictionary<string, IReadOnlySet<string>> Publishers { get; }

    /// <summary>Event name → every construction site.</summary>
    public IReadOnlyDictionary<string, IReadOnlyList<PublishSite>> PublishSites { get; }

    /// <summary>Event name → services that AddSubscription to it.</summary>
    public IReadOnlyDictionary<string, IReadOnlySet<string>> Consumers { get; }

    /// <summary>Events declared more than once inside one service — ambiguous about which copy is on the wire.</summary>
    public IEnumerable<(string Name, string Service, IReadOnlyList<TypeShape> Copies)> DuplicateDeclarations
        => Events.SelectMany(kv => kv.Value.GroupBy(c => c.Service).Where(g => g.Count() > 1).Select(g => (kv.Key, g.Key, (IReadOnlyList<TypeShape>)g.ToList())));

    /// <summary>The copy of <paramref name="name"/> the publishing service actually constructs: the one its construction site can see.</summary>
    public TypeShape? PublisherCopy(string name)
    {
        if (!Events.TryGetValue(name, out var copies) || !PublishSites.TryGetValue(name, out var sites))
            return null;
        foreach (var site in sites)
        {
            var visible = copies.FirstOrDefault(c => c.Service == site.Service && site.VisibleNamespaces.Contains(c.Namespace));
            if (visible is not null)
                return visible;
        }
        return copies.FirstOrDefault(c => sites.Any(s => s.Service == c.Service));
    }

    private SourceTree(string root,
        IReadOnlyDictionary<string, IReadOnlyList<TypeShape>> events,
        IReadOnlyDictionary<string, IReadOnlyDictionary<string, TypeShape>> typesByService,
        IReadOnlyDictionary<string, IReadOnlySet<string>> publishers,
        IReadOnlyDictionary<string, IReadOnlyList<PublishSite>> publishSites,
        IReadOnlyDictionary<string, IReadOnlySet<string>> consumers)
    {
        Root = root;
        Events = events;
        TypesByService = typesByService;
        Publishers = publishers;
        PublishSites = publishSites;
        Consumers = consumers;
    }

    private static SourceTree Load()
    {
        var root = FindRepoRoot();
        var src = Path.Combine(root, "src");

        var types = new Dictionary<string, Dictionary<string, TypeShape>>(StringComparer.Ordinal);
        var events = new Dictionary<string, List<TypeShape>>(StringComparer.Ordinal);
        var publishers = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        var publishSites = new Dictionary<string, List<PublishSite>>(StringComparer.Ordinal);
        var consumers = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);

        foreach (var file in Directory.EnumerateFiles(src, "*.cs", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(src, file);
            var segments = relative.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            if (segments.Any(s => s is "bin" or "obj" or "node_modules" or "Migrations"))
                continue;

            var service = ServiceOf(segments[0]);
            if (service is null)
                continue;

            var tree = CSharpSyntaxTree.ParseText(File.ReadAllText(file), path: file);
            var unit = tree.GetCompilationUnitRoot();
            var visible = unit.DescendantNodes().OfType<BaseNamespaceDeclarationSyntax>().Select(n => n.Name.ToString())
                .Concat(unit.DescendantNodes().OfType<UsingDirectiveSyntax>().Where(u => u.Alias is null && u.Name is not null).Select(u => u.Name!.ToString()))
                .ToHashSet(StringComparer.Ordinal);

            foreach (var decl in unit.DescendantNodes().OfType<TypeDeclarationSyntax>())
            {
                if (decl is not (RecordDeclarationSyntax or ClassDeclarationSyntax))
                    continue;

                var ns = decl.Ancestors().OfType<BaseNamespaceDeclarationSyntax>().FirstOrDefault()?.Name.ToString() ?? "";
                var shape = ShapeOf(decl, service, ns, relative);
                types.TryAdd(service, new Dictionary<string, TypeShape>(StringComparer.Ordinal));
                types[service].TryAdd(shape.Name, shape);

                if (shape.Name.EndsWith(EventSuffix, StringComparison.Ordinal) && shape.Name != EventSuffix && InheritsIntegrationEvent(decl))
                {
                    events.TryAdd(shape.Name, []);
                    events[shape.Name].Add(shape);
                }
            }

            // Publishers: `new XIntegrationEvent(...)` anywhere but the declarations folder.
            var inDeclarations = relative.Contains($"{Path.DirectorySeparatorChar}Events{Path.DirectorySeparatorChar}", StringComparison.Ordinal)
                || relative.Contains("/Events/", StringComparison.Ordinal);
            if (!inDeclarations)
            {
                foreach (var creation in unit.DescendantNodes().OfType<ObjectCreationExpressionSyntax>())
                {
                    var name = TypeName(creation.Type);
                    if (name is not null && name.EndsWith(EventSuffix, StringComparison.Ordinal))
                    {
                        publishers.TryAdd(name, new HashSet<string>(StringComparer.Ordinal));
                        publishers[name].Add(service);
                        publishSites.TryAdd(name, []);
                        publishSites[name].Add(new PublishSite(service, relative, visible));
                    }
                }
            }

            // Consumers: `AddSubscription<XIntegrationEvent, Handler>()`.
            foreach (var generic in unit.DescendantNodes().OfType<GenericNameSyntax>())
            {
                if (generic.Identifier.Text != "AddSubscription" || generic.TypeArgumentList.Arguments.Count == 0)
                    continue;
                var name = TypeName(generic.TypeArgumentList.Arguments[0]);
                if (name is null)
                    continue;
                consumers.TryAdd(name, new HashSet<string>(StringComparer.Ordinal));
                consumers[name].Add(service);
            }
        }

        return new SourceTree(root,
            events.ToDictionary(kv => kv.Key, kv => (IReadOnlyList<TypeShape>)kv.Value, StringComparer.Ordinal),
            types.ToDictionary(kv => kv.Key, kv => (IReadOnlyDictionary<string, TypeShape>)kv.Value, StringComparer.Ordinal),
            publishers.ToDictionary(kv => kv.Key, kv => (IReadOnlySet<string>)kv.Value, StringComparer.Ordinal),
            publishSites.ToDictionary(kv => kv.Key, kv => (IReadOnlyList<PublishSite>)kv.Value, StringComparer.Ordinal),
            consumers.ToDictionary(kv => kv.Key, kv => (IReadOnlySet<string>)kv.Value, StringComparer.Ordinal));
    }

    /// <summary>"Sales.API", "Sales.Domain", "Sales.Infrastructure" → "Sales"; shared libraries → null.</summary>
    private static string? ServiceOf(string project)
    {
        foreach (var suffix in new[] { ".API", ".Domain", ".Infrastructure" })
        {
            if (project.EndsWith(suffix, StringComparison.Ordinal))
                return project[..^suffix.Length];
        }
        return null;
    }

    private static bool InheritsIntegrationEvent(TypeDeclarationSyntax decl)
        => decl.BaseList?.Types.Any(t => TypeName(t.Type) == EventSuffix) == true;

    /// <summary>
    /// What System.Text.Json sees on the type: positional record parameters
    /// (they become properties) plus public instance properties with a getter,
    /// minus what the IntegrationEvent base already carries.
    /// </summary>
    private static TypeShape ShapeOf(TypeDeclarationSyntax decl, string service, string ns, string file)
    {
        var props = new Dictionary<string, string>(StringComparer.Ordinal);

        if (decl.ParameterList is { } parameters)
        {
            foreach (var p in parameters.Parameters)
                props[p.Identifier.Text] = p.Type?.ToString() ?? "";
        }

        foreach (var member in decl.Members.OfType<PropertyDeclarationSyntax>())
        {
            var isPublic = member.Modifiers.Any(m => m.IsKind(SyntaxKind.PublicKeyword));
            var isStatic = member.Modifiers.Any(m => m.IsKind(SyntaxKind.StaticKeyword));
            var hasGetter = member.AccessorList?.Accessors.Any(a => a.IsKind(SyntaxKind.GetAccessorDeclaration)) == true || member.ExpressionBody is not null;
            if (isPublic && !isStatic && hasGetter)
                props[member.Identifier.Text] = member.Type.ToString();
        }

        props.Remove("Id");
        props.Remove("CreationDate");

        return new TypeShape(decl.Identifier.Text, service, ns, file, props.Keys.ToHashSet(StringComparer.Ordinal), props);
    }

    /// <summary>The bare identifier of a type syntax: `Foo`, `Ns.Foo`, `Foo?`, `List&lt;Foo&gt;` → Foo (the last identifier at the top level).</summary>
    public static string? TypeName(TypeSyntax type) => type switch
    {
        IdentifierNameSyntax id => id.Identifier.Text,
        QualifiedNameSyntax q => TypeName(q.Right),
        NullableTypeSyntax n => TypeName(n.ElementType),
        GenericNameSyntax g => g.Identifier.Text,
        _ => null,
    };

    /// <summary>The element type of a collection-ish declared type: `IReadOnlyList&lt;Foo&gt;`, `List&lt;Foo&gt;`, `Foo[]`, `Foo?` → Foo.</summary>
    public static string? ElementTypeName(string declaredType)
    {
        var t = declaredType.Trim().TrimEnd('?');
        if (t.EndsWith("[]", StringComparison.Ordinal))
            return t[..^2];
        var open = t.IndexOf('<', StringComparison.Ordinal);
        if (open >= 0 && t.EndsWith('>'))
            return ElementTypeName(t[(open + 1)..^1]);
        var dot = t.LastIndexOf('.');
        return dot >= 0 ? t[(dot + 1)..] : t;
    }

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "Chillax.slnx")))
                return dir.FullName;
            dir = dir.Parent;
        }
        throw new InvalidOperationException($"Chillax.slnx not found above {AppContext.BaseDirectory}");
    }
}
