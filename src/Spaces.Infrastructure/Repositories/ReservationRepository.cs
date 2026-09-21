namespace Ninja.Spaces.Infrastructure.Repositories;

public class ReservationRepository : IReservationRepository
{
    private static readonly ReservationStatus[] Open = [ReservationStatus.Requested, ReservationStatus.Confirmed];

    private readonly SpacesContext _context;

    public IUnitOfWork UnitOfWork { get; }

    public ReservationRepository(SpacesContext context, IUnitOfWork unitOfWork)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        UnitOfWork = unitOfWork ?? throw new ArgumentNullException(nameof(unitOfWork));
    }

    private IQueryable<Reservation> OpenOnes => _context.Reservations.Where(r => Open.Contains(r.Status));

    public Reservation Add(Reservation reservation) => _context.Reservations.Add(reservation).Entity;

    public void Update(Reservation reservation) => _context.Update(reservation);

    public async Task<Reservation?> GetAsync(int reservationId) => await _context.Reservations.FindAsync(reservationId);

    public async Task<Reservation?> GetWithPlaceAsync(int reservationId)
        => await _context.Reservations.Include(r => r.Place).FirstOrDefaultAsync(r => r.Id == reservationId);

    public async Task<Reservation?> GetOpenForCustomerAsync(string customerId)
        => await OpenOnes
            .Include(r => r.Place)
            .Where(r => r.CustomerId == customerId)
            .OrderBy(r => r.For ?? r.CreatedAt)
            .FirstOrDefaultAsync();

    public async Task<bool> IsHeldAsync(int placeId, DateTime now)
        => await OpenOnes
            .Where(r => r.PlaceId == placeId)
            .Where(r => r.For == null || r.For <= now)
            .AnyAsync();

    public async Task<bool> HasConflictAsync(int placeId, DateTime at, int? exceptReservationId = null)
    {
        var from = at.AddMinutes(-Reservation.SlotMinutes);
        var to = at.AddMinutes(Reservation.SlotMinutes);
        return await OpenOnes
            .Where(r => r.PlaceId == placeId)
            .Where(r => exceptReservationId == null || r.Id != exceptReservationId)
            .Where(r => (r.For ?? r.CreatedAt) > from && (r.For ?? r.CreatedAt) < to)
            .AnyAsync();
    }

    public async Task<bool> HasOpenAsync(int placeId)
        => await OpenOnes.Where(r => r.PlaceId == placeId).AnyAsync();

    public async Task<List<Reservation>> GetLapsedAsync(DateTime now)
        => await OpenOnes
            .Where(r => r.ExpiresAt != null && r.ExpiresAt <= now)
            .ToListAsync();
}
