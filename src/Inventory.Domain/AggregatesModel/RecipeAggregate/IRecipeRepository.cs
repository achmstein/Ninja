#nullable enable
namespace Chillax.Inventory.Domain.AggregatesModel.RecipeAggregate;

public interface IRecipeRepository : IRepository<Recipe>
{
    Recipe Add(Recipe recipe);

    void Remove(Recipe recipe);

    Task<Recipe?> GetAsync(int catalogItemId);

    Task<List<Recipe>> GetManyAsync(IEnumerable<int> catalogItemIds);

    /// <summary>Every recipe whose base lines use any of these stock items.</summary>
    Task<List<Recipe>> GetUsingAsync(IEnumerable<int> stockItemIds);

    /// <summary>Every recipe whose option lines use any of these stock items.</summary>
    Task<List<Recipe>> GetUsingInOptionsAsync(IEnumerable<int> stockItemIds);
}
