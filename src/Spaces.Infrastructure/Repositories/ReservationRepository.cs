namespace Chillax.Spaces.Infrastructure.Repositories;

public class ReservationRepository : IReservationRepository
{
    private readonly SpacesContext _context;

    public IUnitOfWork UnitOfWork => _context;

    public ReservationRepository(SpacesContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public Reservation Add(Reservation reservation)
    {
        return _context.Reservations.Add(reservation).Entity;
    }

    public void Update(Reservation reservation)
    {
        _context.Update(reservation);
    }

    public async Task<Reservation?> GetAsync(int reservationId)
    {
        return await _context.Reservations.FindAsync(reservationId);
    }

    public async Task<Reservation?> GetWithRoomAsync(int reservationId)
    {
        return await _context.Reservations
            .Include(r => r.Room)
            .FirstOrDefaultAsync(r => r.Id == reservationId);
    }

    public async Task<Reservation?> GetActiveReservationForCustomerAsync(string customerId)
    {
        return await _context.Reservations
            .Include(r => r.Room)
            .Where(r => r.CustomerId == customerId)
            .Where(r => r.Status == ReservationStatus.Active || r.Status == ReservationStatus.Reserved)
            .FirstOrDefaultAsync();
    }

    public async Task<List<Reservation>> GetTodayReservationsForRoomAsync(int roomId)
    {
        var today = DateTime.UtcNow.Date;
        var tomorrow = today.AddDays(1);

        return await _context.Reservations
            .Include(r => r.Room)
            .Where(r => r.RoomId == roomId)
            .Where(r => r.CreatedAt >= today && r.CreatedAt < tomorrow)
            .Where(r => r.Status == ReservationStatus.Active || r.Status == ReservationStatus.Reserved)
            .OrderBy(r => r.CreatedAt)
            .ToListAsync();
    }

    public async Task<List<Reservation>> GetActiveSessionsAsync()
    {
        return await _context.Reservations
            .Include(r => r.Room)
            .Where(r => r.Status == ReservationStatus.Active)
            .OrderBy(r => r.ActualStartTime)
            .ToListAsync();
    }

    public async Task<List<Reservation>> GetCustomerReservationsAsync(string customerId, int? limit = null)
    {
        var query = _context.Reservations
            .Include(r => r.Room)
            .Where(r => r.CustomerId == customerId)
            .OrderByDescending(r => r.CreatedAt);

        if (limit.HasValue)
        {
            return await query.Take(limit.Value).ToListAsync();
        }

        return await query.ToListAsync();
    }

    public async Task<bool> HasActiveReservationAsync(int roomId)
    {
        return await _context.Reservations
            .Where(r => r.RoomId == roomId)
            .Where(r => r.Status == ReservationStatus.Active || r.Status == ReservationStatus.Reserved)
            .AnyAsync();
    }

    public async Task<Reservation?> GetWithMembersAsync(int reservationId)
    {
        return await _context.Reservations
            .Include(r => r.Room)
            .Include(r => r.SessionMembers)
            .FirstOrDefaultAsync(r => r.Id == reservationId);
    }

    public async Task<Reservation?> GetWithSegmentsAsync(int reservationId)
    {
        return await _context.Reservations
            .Include(r => r.Room)
            .Include(r => r.SessionSegments)
            .Include(r => r.SessionMembers)
            .FirstOrDefaultAsync(r => r.Id == reservationId);
    }

    public async Task<Reservation?> GetActiveSessionForRoomAsync(int roomId)
    {
        return await _context.Reservations
            .Include(r => r.Room)
            .Include(r => r.SessionMembers)
            .Where(r => r.RoomId == roomId)
            .Where(r => r.Status == ReservationStatus.Active)
            .FirstOrDefaultAsync();
    }
}
