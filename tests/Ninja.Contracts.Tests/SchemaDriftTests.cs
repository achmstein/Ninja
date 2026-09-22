namespace Ninja.Contracts.Tests;

/// <summary>
/// Each consumer keeps its own copy of an event record with only the
/// properties it reads. System.Text.Json matches property names exactly
/// (the bus uses default options: PascalCase, case-sensitive), so a property
/// on a consumer's copy that the publisher's copy does not have is silently
/// left at its default — the kind of drift no compiler catches. Same for the
/// payload records nested in an event.
/// </summary>
[TestClass]
public sealed class SchemaDriftTests
{
    [TestMethod]
    public void Consumer_copies_read_only_what_the_publisher_sends()
    {
        var tree = SourceTree.Current;
        var drift = new List<string>();

        foreach (var (name, copies) in tree.Events)
        {
            if (!tree.Publishers.TryGetValue(name, out var publishingServices))
                continue; // dead consumer: nothing to compare against

            var publisher = tree.PublisherCopy(name);
            if (publisher is null)
            {
                drift.Add($"{name}: published by {string.Join(", ", publishingServices)} but declared in none of them");
                continue;
            }

            foreach (var consumer in copies.Where(c => c.Service != publisher.Service))
                CompareShapes(tree, name, publisher, consumer, drift, depth: 0);
        }

        Assert.IsEmpty(drift, "Event contract drift:\n  " + string.Join("\n  ", drift));
    }

    private static void CompareShapes(SourceTree tree, string context, TypeShape publisher, TypeShape consumer, List<string> drift, int depth)
    {
        var missing = consumer.Properties.Except(publisher.Properties).Order().ToList();
        if (missing.Count > 0)
        {
            var hint = missing.Select(m => publisher.Properties.FirstOrDefault(p => string.Equals(p, m, StringComparison.OrdinalIgnoreCase)) is { } near ? $"{m} (publisher has {near})" : m);
            drift.Add($"{context}: {consumer.Service}'s copy ({consumer.File}) reads [{string.Join(", ", hint)}] which {publisher.Service}'s copy ({publisher.File}) does not send");
        }

        // The properties both sides have must be the same kind of value: a
        // number read as a string (or the other way round) throws on the
        // consumer and dead-letters the message
        foreach (var (property, consumerType) in consumer.PropertyTypes)
        {
            if (!publisher.PropertyTypes.TryGetValue(property, out var publisherType))
                continue;

            var mine = Simple(consumerType);
            var theirs = Simple(publisherType);
            if (mine is null || theirs is null || mine == theirs)
                continue;

            drift.Add($"{context}.{property}: {consumer.Service} reads it as {consumerType.Trim()}, {publisher.Service} sends {publisherType.Trim()}");
        }

        if (depth > 3)
            return;

        // Nested payload records: compare the consumer's declared type with the publisher's type of the same name.
        foreach (var (property, declaredType) in consumer.PropertyTypes)
        {
            if (!publisher.PropertyTypes.TryGetValue(property, out var publisherType))
                continue;

            var consumerElement = SourceTree.ElementTypeName(declaredType);
            var publisherElement = SourceTree.ElementTypeName(publisherType);
            if (consumerElement is null || publisherElement is null)
                continue;

            if (!tree.TypesByService.TryGetValue(consumer.Service, out var consumerTypes) || !consumerTypes.TryGetValue(consumerElement, out var consumerPayload))
                continue; // a framework or shared type (LocalizedText, DateTime, ...)
            if (!tree.TypesByService.TryGetValue(publisher.Service, out var publisherTypes) || !publisherTypes.TryGetValue(publisherElement, out var publisherPayload))
            {
                drift.Add($"{context}.{property}: {consumer.Service} declares payload {consumerElement} but {publisher.Service} sends {publisherType}, which is not a type it declares");
                continue;
            }

            CompareShapes(tree, $"{context}.{property}", publisherPayload, consumerPayload, drift, depth + 1);
        }
    }

    /// <summary>
    /// The value a property carries, when it is one JSON reads on its own
    /// (a number, a string, a date). Null for anything else — a payload
    /// record or a collection, which the nested walk below compares by
    /// name. Nullability is not part of it: a consumer may read what the
    /// publisher always sends as optional.
    /// </summary>
    private static string? Simple(string declaredType)
    {
        var t = declaredType.Trim().TrimEnd('?');
        var dot = t.LastIndexOf('.');
        if (dot >= 0) t = t[(dot + 1)..];

        return t switch
        {
            "int" or "Int32" => "int",
            "long" or "Int64" => "long",
            "decimal" or "Decimal" => "decimal",
            "double" or "Double" => "double",
            "float" or "Single" => "float",
            "bool" or "Boolean" => "bool",
            "string" or "String" => "string",
            "Guid" => "Guid",
            "DateTime" => "DateTime",
            "DateTimeOffset" => "DateTimeOffset",
            "DateOnly" => "DateOnly",
            "TimeOnly" => "TimeOnly",
            "TimeSpan" => "TimeSpan",
            _ => null,
        };
    }

    [TestMethod]
    public void No_service_declares_the_same_event_twice()
    {
        var duplicates = SourceTree.Current.DuplicateDeclarations
            .Select(d => $"{d.Service} declares {d.Name} {d.Copies.Count} times: {string.Join(" | ", d.Copies.Select(c => $"{c.File} [{string.Join(", ", c.Properties.Order())}]"))}")
            .ToList();
        Assert.IsEmpty(duplicates,
            "Two declarations of one event in one service: whichever the publisher happens to import is the wire contract, and the other is a trap.\n  "
            + string.Join("\n  ", duplicates));
    }

    [TestMethod]
    public void Every_integration_event_is_declared_somewhere()
    {
        var tree = SourceTree.Current;
        Assert.IsGreaterThanOrEqualTo(40, tree.Events.Count, $"Expected the 40 known events, found {tree.Events.Count}: {string.Join(", ", tree.Events.Keys.Order())}");
        Assert.IsNotEmpty(tree.Publishers, "no publishers found - is the source tree where SourceTree expects it?");
        Assert.IsNotEmpty(tree.Consumers, "no consumers found - is the source tree where SourceTree expects it?");
    }
}
