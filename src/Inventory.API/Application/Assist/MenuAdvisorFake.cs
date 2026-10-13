#nullable enable
using System.Text.Json;
using Ninja.AI.Fake;
using Ninja.AI.Json;
using Ninja.AI.Text;

namespace Ninja.Inventory.API.Application.Assist;

/// <summary>
/// What the advisor answers under test: raise every plowhorse's price,
/// promote every puzzle, remove every dog, and leave stars alone.
/// Deterministic, so the E2E suite can assert on it.
/// </summary>
public static class MenuAdvisorFake
{
    public static string Respond(FakeAgentRequest request)
    {
        var prompt = JsonSerializer.Deserialize<MenuAdvicePrompt>(request.UserText, AIJson.Options)
            ?? throw new InvalidOperationException("The advisor prompt is not the expected JSON");

        var items = prompt.Items
            .Select(d => d.Class switch
            {
                "plowhorse" => new ItemAdviceResult(d.Id, "raise-price", new LocalizedPair("Raise it by EGP 5", "زوّد سعره ٥ جنيه")),
                "puzzle" => new ItemAdviceResult(d.Id, "promote", new LocalizedPair("Move it up the menu", "طلّعه فوق في المنيو")),
                "dog" => new ItemAdviceResult(d.Id, "remove", new LocalizedPair("Take it off the menu", "شيله من المنيو")),
                _ => null,
            })
            .OfType<ItemAdviceResult>()
            .ToList();

        var result = new MenuAdviceResult(new LocalizedPair("Your stars carry the menu.", "النجوم شايلة المنيو."), items, string.Empty);
        return JsonSerializer.Serialize(result, AIJson.Options);
    }
}
