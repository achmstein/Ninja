using Chillax.Rooms.Domain.AggregatesModel.ReservationAggregate;
using Chillax.Rooms.Domain.AggregatesModel.RoomAggregate;
using Chillax.Rooms.Domain.SeedWork;
using Microsoft.EntityFrameworkCore;
using Room = Chillax.Rooms.Domain.AggregatesModel.RoomAggregate.Room;
using RoomsContext = Chillax.Rooms.Infrastructure.RoomsContext;

namespace Chillax.Rooms.API.Application.Queries;

public class RoomQueries : IRoomQueries
{
    private readonly RoomsContext _context;

    public RoomQueries(RoomsContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<RoomViewModel>> GetAllRoomsAsync(int branchId)
    {
        var rooms = await _context.Rooms
            .Where(r => r.BranchId == branchId)
            .OrderBy(r => r.Name.En)
            .ToListAsync();

        // Get all active/reserved reservations for computing display status
        var activeReservations = await _context.Reservations
            .Where(r => r.Status == ReservationStatus.Reserved || r.Status == ReservationStatus.Active)
            .ToListAsync();

        return rooms.Select(room =>
        {
            var roomReservations = activeReservations.Where(r => r.RoomId == room.Id).ToList();
            return MapToViewModel(room, roomReservations);
        });
    }

    public async Task<IEnumerable<RoomViewModel>> GetAvailableRoomsAsync(int branchId)
    {
        var allRooms = await GetAllRoomsAsync(branchId);
        return allRooms.Where(r => r.DisplayStatus == RoomDisplayStatus.Available);
    }

    public async Task<RoomViewModel?> GetRoomByIdAsync(int roomId)
    {
        var room = await _context.Rooms.FindAsync(roomId);
        if (room == null) return null;

        var roomReservations = await _context.Reservations
            .Where(r => r.RoomId == roomId)
            .Where(r => r.Status == ReservationStatus.Reserved || r.Status == ReservationStatus.Active)
            .ToListAsync();

        return MapToViewModel(room, roomReservations);
    }

    public async Task<IEnumerable<ReservationViewModel>> GetCustomerReservationsAsync(string customerId)
    {
        // Include sessions where customer is owner OR a session member
        var reservations = await _context.Reservations
            .Include(r => r.Room)
            .Include(r => r.SessionMembers)
            .Include(r => r.SessionSegments)
            .Where(r => r.CustomerId == customerId ||
                        r.SessionMembers.Any(m => m.CustomerId == customerId))
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        return reservations.Select(MapToViewModel);
    }

    public async Task<IEnumerable<ReservationViewModel>> GetActiveSessionsAsync(int branchId)
    {
        var reservations = await _context.Reservations
            .Include(r => r.Room)
            .Include(r => r.SessionMembers)
            .Include(r => r.SessionSegments)
            .Where(r => r.Status == ReservationStatus.Active || r.Status == ReservationStatus.Reserved)
            .Where(r => r.Room!.BranchId == branchId)
            .OrderBy(r => r.CreatedAt)
            .ToListAsync();

        return reservations.Select(MapToViewModel);
    }

    public async Task<ReservationViewModel?> GetReservationByIdAsync(int reservationId)
    {
        var reservation = await _context.Reservations
            .Include(r => r.Room)
            .Include(r => r.SessionMembers)
            .Include(r => r.SessionSegments)
            .FirstOrDefaultAsync(r => r.Id == reservationId);

        return reservation == null ? null : MapToViewModel(reservation);
    }

    private static RoomViewModel MapToViewModel(Room room, List<Reservation> reservations)
    {
        var displayStatus = ComputeDisplayStatus(room, reservations);

        return new RoomViewModel
        {
            Id = room.Id,
            Name = room.Name,
            Description = room.Description,
            SingleRate = room.SingleRate,
            MultiRate = room.MultiRate,
            DisplayStatus = displayStatus
        };
    }

    private static RoomDisplayStatus ComputeDisplayStatus(Room room, List<Reservation> reservations)
    {
        // Check physical status first
        if (room.PhysicalStatus == RoomPhysicalStatus.Maintenance)
            return RoomDisplayStatus.Maintenance;

        if (room.PhysicalStatus == RoomPhysicalStatus.Occupied)
            return RoomDisplayStatus.Occupied;

        // Check for active sessions
        if (reservations.Any(r => r.Status == ReservationStatus.Active))
            return RoomDisplayStatus.Occupied;

        // Check for pending reservations (customer has 15 min to arrive)
        if (reservations.Any(r => r.Status == ReservationStatus.Reserved))
            return RoomDisplayStatus.Reserved;

        return RoomDisplayStatus.Available;
    }

    private static ReservationViewModel MapToViewModel(Reservation reservation)
    {
        return new ReservationViewModel
        {
            Id = reservation.Id,
            RoomId = reservation.RoomId,
            RoomName = reservation.Room?.Name ?? new LocalizedText($"Room {reservation.RoomId}"),
            SingleRate = reservation.SingleRate,
            MultiRate = reservation.MultiRate,
            CustomerId = reservation.CustomerId,
            CustomerName = reservation.CustomerName,
            CreatedAt = reservation.CreatedAt,
            ActualStartTime = reservation.ActualStartTime,
            EndTime = reservation.EndTime,
            TotalCost = reservation.TotalCost,
            CurrentPlayerMode = reservation.CurrentPlayerMode?.ToString(),
            SingleRoundedHours = reservation.GetSingleRoundedHours(),
            MultiRoundedHours = reservation.GetMultiRoundedHours(),
            SingleCost = reservation.GetSingleCost(),
            MultiCost = reservation.GetMultiCost(),
            Status = reservation.Status,
            Notes = reservation.Notes,
            ExpiresAt = reservation.GetExpirationTime(),
            Members = reservation.SessionMembers?.Select(m => new SessionMemberViewModel
            {
                CustomerId = m.CustomerId,
                CustomerName = m.CustomerName,
                JoinedAt = m.JoinedAt,
                Role = m.Role.ToString()
            }).ToList() ?? new(),
            Segments = reservation.SessionSegments?.OrderBy(s => s.StartTime).Select(s => new SessionSegmentViewModel
            {
                PlayerMode = s.PlayerMode.ToString(),
                HourlyRate = s.HourlyRate,
                StartTime = s.StartTime,
                EndTime = s.EndTime
            }).ToList() ?? new()
        };
    }

    public async Task<RoomScanViewModel?> GetRoomScanInfoAsync(int roomId, string customerId)
    {
        var room = await _context.Rooms.FindAsync(roomId);
        if (room == null) return null;

        var roomReservations = await _context.Reservations
            .Include(r => r.SessionMembers)
            .Where(r => r.RoomId == roomId)
            .Where(r => r.Status == ReservationStatus.Reserved || r.Status == ReservationStatus.Active)
            .ToListAsync();

        var displayStatus = ComputeDisplayStatus(room, roomReservations);

        var activeReservation = roomReservations
            .FirstOrDefault(r => r.Status == ReservationStatus.Active);

        SessionPreviewViewModel? sessionPreview = null;
        bool isAlreadyMember = false;

        if (activeReservation != null)
        {
            sessionPreview = new SessionPreviewViewModel
            {
                SessionId = activeReservation.Id,
                RoomId = activeReservation.RoomId,
                RoomName = room.Name,
                StartTime = activeReservation.ActualStartTime ?? activeReservation.CreatedAt,
                MemberCount = activeReservation.SessionMembers.Count
            };

            isAlreadyMember = activeReservation.CustomerId == customerId ||
                activeReservation.SessionMembers.Any(m => m.CustomerId == customerId);
        }

        return new RoomScanViewModel
        {
            BranchId = room.BranchId,
            RoomId = room.Id,
            RoomName = room.Name,
            SingleRate = room.SingleRate,
            MultiRate = room.MultiRate,
            DisplayStatus = displayStatus,
            HasActiveSession = activeReservation != null,
            SessionPreview = sessionPreview,
            IsAlreadyMember = isAlreadyMember
        };
    }

    public async Task<PaginatedResult<ReservationViewModel>> GetSessionHistoryAsync(
        int branchId,
        int pageIndex,
        int pageSize,
        int? roomId = null,
        DateTime? fromDate = null,
        DateTime? toDate = null)
    {
        var query = _context.Reservations
            .AsNoTracking()
            .Include(r => r.Room)
            .Include(r => r.SessionSegments)
            .Where(r => r.Room!.BranchId == branchId)
            .Where(r => r.Status == ReservationStatus.Completed || r.Status == ReservationStatus.Cancelled);

        if (roomId.HasValue)
            query = query.Where(r => r.RoomId == roomId.Value);

        if (fromDate.HasValue)
            query = query.Where(r => (r.EndTime ?? r.CreatedAt) >= fromDate.Value);

        if (toDate.HasValue)
            query = query.Where(r => (r.EndTime ?? r.CreatedAt) <= toDate.Value);

        var totalCount = await query.CountAsync();

        var reservations = await query
            .OrderByDescending(r => r.EndTime ?? r.CreatedAt)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PaginatedResult<ReservationViewModel>
        {
            Items = reservations.Select(MapToViewModel),
            PageIndex = pageIndex,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<IEnumerable<ReservationViewModel>> GetRoomSessionHistoryAsync(int roomId, int limit = 20)
    {
        var reservations = await _context.Reservations
            .Include(r => r.Room)
            .Include(r => r.SessionSegments)
            .Where(r => r.RoomId == roomId)
            .Where(r => r.Status == ReservationStatus.Completed || r.Status == ReservationStatus.Cancelled)
            .OrderByDescending(r => r.EndTime ?? r.CreatedAt)
            .Take(limit)
            .ToListAsync();

        return reservations.Select(MapToViewModel);
    }
}
