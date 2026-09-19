namespace Ninja.Spaces.Infrastructure.Repositories;

public class PlaceRepository : IPlaceRepository
{
    private readonly SpacesContext _context;

    public IUnitOfWork UnitOfWork { get; }

    public PlaceRepository(SpacesContext context, IUnitOfWork unitOfWork)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        UnitOfWork = unitOfWork ?? throw new ArgumentNullException(nameof(unitOfWork));
    }

    public Place Add(Place place) => _context.Places.Add(place).Entity;

    public void Update(Place place) => _context.Entry(place).State = EntityState.Modified;

    public void Delete(Place place) => _context.Places.Remove(place);

    public async Task<Place?> GetAsync(int placeId) => await _context.Places.FindAsync(placeId);

    public async Task<List<Place>> GetAllAsync()
        => await _context.Places.OrderBy(p => p.Kind).ThenBy(p => p.Name.En).ToListAsync();

    public async Task<List<Place>> GetByKindAsync(PlaceKind kind)
        => await _context.Places.Where(p => p.Kind == kind).OrderBy(p => p.Name.En).ToListAsync();

    public async Task<List<Place>> GetByStatusAsync(PlaceStatus status)
        => await _context.Places.Where(p => p.PhysicalStatus == status).OrderBy(p => p.Name.En).ToListAsync();

    public async Task<bool> ExistsAsync(int placeId) => await _context.Places.AnyAsync(p => p.Id == placeId);
}
