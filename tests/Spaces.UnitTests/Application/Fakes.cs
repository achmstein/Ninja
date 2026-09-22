using System.Reflection;
using Ninja.Spaces.API.Application.Queries;
using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;
using Ninja.Spaces.Domain.SeedWork;

namespace Ninja.Spaces.UnitTests.Application;

/// <summary>
/// The three repositories over lists, sharing one unit of work that counts
/// its saves. Ids are handed out on Add the way HiLo does, so a handler
/// can link a stay to the reservation it was seated from.
/// </summary>
internal sealed class InMemorySpaces : IUnitOfWork
{
    public readonly List<Place> Places = [];
    public readonly List<Reservation> Reservations = [];
    public readonly List<Stay> Stays = [];
    public int Saves { get; private set; }
    private int _nextId = 100;

    public readonly IPlaceRepository PlaceRepository;
    public readonly IReservationRepository ReservationRepository;
    public readonly IStayRepository StayRepository;

    public InMemorySpaces()
    {
        PlaceRepository = new PlaceRepo(this);
        ReservationRepository = new ReservationRepo(this);
        StayRepository = new StayRepo(this);
    }

    /// <summary>A place on branch 1 with an id, as if it had been saved.</summary>
    public Place AddPlace(Place place)
    {
        WithId(place, _nextId++);
        Places.Add(place);
        return place;
    }

    public int NextId() => _nextId++;

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) { Saves++; return Task.FromResult(1); }
    public Task<bool> SaveEntitiesAsync(CancellationToken cancellationToken = default) { Saves++; return Task.FromResult(true); }
    public void Dispose() { }

    /// <summary>Entity.Id has a protected setter; the tests play the database.</summary>
    public static T WithId<T>(T entity, int id) where T : Entity
    {
        typeof(Entity).GetProperty(nameof(Entity.Id), BindingFlags.Public | BindingFlags.Instance)!.SetValue(entity, id);
        return entity;
    }

    private sealed class PlaceRepo(InMemorySpaces db) : IPlaceRepository
    {
        public IUnitOfWork UnitOfWork => db;
        public Place Add(Place place) => db.AddPlace(place);
        public void Update(Place place) { }
        public void Delete(Place place) => db.Places.Remove(place);
        public Task<Place?> GetAsync(int placeId) => Task.FromResult(db.Places.FirstOrDefault(p => p.Id == placeId));
        public Task<List<Place>> GetAllAsync() => Task.FromResult(db.Places.ToList());
        public Task<List<Place>> GetByKindAsync(PlaceKind kind) => Task.FromResult(db.Places.Where(p => p.Kind == kind).ToList());
        public Task<List<Place>> GetByStatusAsync(PlaceStatus status) => Task.FromResult(db.Places.Where(p => p.PhysicalStatus == status).ToList());
        public Task<bool> ExistsAsync(int placeId) => Task.FromResult(db.Places.Any(p => p.Id == placeId));
    }

    private sealed class ReservationRepo(InMemorySpaces db) : IReservationRepository
    {
        public IUnitOfWork UnitOfWork => db;
        private IEnumerable<Reservation> Open => db.Reservations.Where(r => r.IsOpen);

        public Reservation Add(Reservation reservation)
        {
            WithId(reservation, db.NextId());
            db.Reservations.Add(reservation);
            return reservation;
        }

        public void Update(Reservation reservation) { }
        public Task<Reservation?> GetAsync(int id) => Task.FromResult(db.Reservations.FirstOrDefault(r => r.Id == id));
        public Task<Reservation?> GetWithPlaceAsync(int id) => GetAsync(id);
        public Task<Reservation?> GetOpenForCustomerAsync(string customerId)
            => Task.FromResult(Open.Where(r => r.CustomerId == customerId).OrderBy(r => r.EffectiveFor).FirstOrDefault());
        public Task<bool> IsHeldAsync(int placeId, DateTime now)
            => Task.FromResult(Open.Any(r => r.PlaceId == placeId && r.IsHolding(now)));
        public Task<bool> HasConflictAsync(int placeId, DateTime at, int? exceptReservationId = null)
            => Task.FromResult(Open.Any(r => r.PlaceId == placeId
                && (exceptReservationId is null || r.Id != exceptReservationId)
                && Math.Abs((r.EffectiveFor - at).TotalMinutes) < Reservation.SlotMinutes));
        public Task<bool> HasOpenAsync(int placeId) => Task.FromResult(Open.Any(r => r.PlaceId == placeId));
        public Task<List<Reservation>> GetLapsedAsync(DateTime now) => Task.FromResult(Open.Where(r => r.IsExpired(now)).ToList());
        public Task<Reservation?> GetSeatedAtAsync(int placeId)
            => Task.FromResult(db.Reservations.Where(r => r.PlaceId == placeId && r.IsSeated && r.StayId is null).OrderByDescending(r => r.SeatedAt).FirstOrDefault());
    }

    private sealed class StayRepo(InMemorySpaces db) : IStayRepository
    {
        public IUnitOfWork UnitOfWork => db;
        private IEnumerable<Stay> Running => db.Stays.Where(s => s.Status == StayStatus.Running);

        public Stay Add(Stay stay)
        {
            WithId(stay, db.NextId());
            db.Stays.Add(stay);
            return stay;
        }

        public void Update(Stay stay) { }
        public Task<Stay?> GetAsync(int id) => Task.FromResult(db.Stays.FirstOrDefault(s => s.Id == id));
        public Task<Stay?> GetWithPlaceAsync(int id) => GetAsync(id);
        public Task<Stay?> GetOpenStayForCustomerAsync(string customerId) => Task.FromResult(Running.FirstOrDefault(s => s.CustomerId == customerId));
        public Task<List<Stay>> GetOpenStaysAsync() => Task.FromResult(Running.ToList());
        public Task<List<Stay>> GetCustomerStaysAsync(string customerId, int? limit = null)
            => Task.FromResult(db.Stays.Where(s => s.CustomerId == customerId).ToList());
        public Task<bool> HasOpenStayAsync(int placeId) => Task.FromResult(Running.Any(s => s.PlaceId == placeId));
        public Task<Stay?> GetWithMembersAsync(int id) => GetAsync(id);
        public Task<Stay?> GetWithSegmentsAsync(int id) => GetAsync(id);
        public Task<Stay?> GetRunningStayForPlaceAsync(int placeId) => Task.FromResult(Running.FirstOrDefault(s => s.PlaceId == placeId));
    }
}

/// <summary>The branch flag as the handler reads it: taking reservations unless a test says otherwise.</summary>
internal sealed class FakeBranchSettings(bool reservationsEnabled = true) : IBranchSettingsQueries
{
    public Task<bool> IsReservationsEnabledAsync(int branchId) => Task.FromResult(reservationsEnabled);
}
