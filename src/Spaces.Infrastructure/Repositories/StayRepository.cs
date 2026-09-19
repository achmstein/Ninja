namespace Ninja.Spaces.Infrastructure.Repositories;

public class StayRepository : IStayRepository
{
    private readonly SpacesContext _context;

    public IUnitOfWork UnitOfWork { get; }

    public StayRepository(SpacesContext context, IUnitOfWork unitOfWork)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        UnitOfWork = unitOfWork ?? throw new ArgumentNullException(nameof(unitOfWork));
    }

    public Stay Add(Stay stay) => _context.Stays.Add(stay).Entity;

    public void Update(Stay stay) => _context.Update(stay);

    public async Task<Stay?> GetAsync(int stayId) => await _context.Stays.FindAsync(stayId);

    public async Task<Stay?> GetWithPlaceAsync(int stayId)
        => await _context.Stays.Include(s => s.Place).FirstOrDefaultAsync(s => s.Id == stayId);

    public async Task<Stay?> GetOpenStayForCustomerAsync(string customerId)
        => await _context.Stays
            .Include(s => s.Place)
            .Where(s => s.CustomerId == customerId)
            .Where(s => s.Status == StayStatus.Running || s.Status == StayStatus.Held)
            .FirstOrDefaultAsync();

    public async Task<List<Stay>> GetOpenStaysAsync()
        => await _context.Stays
            .Include(s => s.Place)
            .Where(s => s.Status == StayStatus.Running || s.Status == StayStatus.Held)
            .OrderBy(s => s.StartedAt ?? s.CreatedAt)
            .ToListAsync();

    public async Task<List<Stay>> GetExpiredHoldsAsync()
    {
        var now = DateTime.UtcNow;
        return await _context.Stays
            .Include(s => s.Place)
            .Where(s => s.Status == StayStatus.Held && s.ExpiresAt != null && s.ExpiresAt < now)
            .ToListAsync();
    }

    public async Task<List<Stay>> GetCustomerStaysAsync(string customerId, int? limit = null)
    {
        var query = _context.Stays
            .Include(s => s.Place)
            .Where(s => s.CustomerId == customerId)
            .OrderByDescending(s => s.CreatedAt);

        return limit.HasValue
            ? await query.Take(limit.Value).ToListAsync()
            : await query.ToListAsync();
    }

    public async Task<bool> HasOpenStayAsync(int placeId)
        => await _context.Stays
            .Where(s => s.PlaceId == placeId)
            .Where(s => s.Status == StayStatus.Running || s.Status == StayStatus.Held)
            .AnyAsync();

    public async Task<Stay?> GetWithMembersAsync(int stayId)
        => await _context.Stays
            .Include(s => s.Place)
            .Include(s => s.Members)
            .FirstOrDefaultAsync(s => s.Id == stayId);

    public async Task<Stay?> GetWithSegmentsAsync(int stayId)
        => await _context.Stays
            .Include(s => s.Place)
            .Include(s => s.Segments)
            .Include(s => s.Members)
            .FirstOrDefaultAsync(s => s.Id == stayId);

    public async Task<Stay?> GetRunningStayForPlaceAsync(int placeId)
        => await _context.Stays
            .Include(s => s.Place)
            .Include(s => s.Members)
            .Where(s => s.PlaceId == placeId && s.Status == StayStatus.Running)
            .FirstOrDefaultAsync();
}
