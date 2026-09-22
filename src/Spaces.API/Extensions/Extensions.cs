using System.Text.Json.Serialization;
using Ninja.Spaces.API.Application.BackgroundServices;
using Ninja.Spaces.API.Application.IntegrationEvents.Events;
using Ninja.Spaces.API.Application.IntegrationEvents;
using Ninja.Spaces.API.Application.IntegrationEvents.EventHandling;
using Ninja.IntegrationEventLogEF.Services;
using Ninja.Spaces.API.Application.Queries;
using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;
using Ninja.Spaces.API.Infrastructure;
using Ninja.Spaces.Infrastructure;
using Ninja.Spaces.Infrastructure.Idempotency;
using Ninja.Spaces.Infrastructure.Repositories;
using SpacesContext = Ninja.Spaces.Infrastructure.SpacesContext;

namespace Ninja.Spaces.API.Extensions;

public static class Extensions
{
    public static void AddApplicationServices(this IHostApplicationBuilder builder)
    {
        builder.AddDefaultAuthentication();

        // Avoid loading full database config and migrations if startup
        // is being invoked from build-time OpenAPI generation
        if (builder.Environment.IsBuild())
        {
            builder.Services.AddDbContext<SpacesContext>();
            return;
        }

        builder.AddNpgsqlDbContext<SpacesContext>("spacesdb");

        // REVIEW: This is done for development ease but shouldn't be here in production
        builder.Services.AddMigration<SpacesContext, SpacesContextSeed>();

        builder.Services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblyContaining(typeof(Program));
            cfg.LicenseKey = builder.Configuration["MediatR:LicenseKey"];
        });

        builder.Services.AddScoped<IPlaceRepository, PlaceRepository>();
        builder.Services.AddScoped<IReservationRepository, ReservationRepository>();
        builder.Services.AddScoped<IStayRepository, StayRepository>();

        // The outbox: events are written with the rows that produced them and
        // published after the commit (SpacesUnitOfWork). The repositories hand
        // the unit of work out, so every endpoint and bus handler is in it.
        builder.Services.AddScoped<IUnitOfWork, SpacesUnitOfWork>();
        builder.Services.AddTransient<IIntegrationEventLogService, IntegrationEventLogService<SpacesContext>>();
        builder.Services.AddScoped<ISpacesIntegrationEventService, SpacesIntegrationEventService>();
        builder.Services.AddScoped<IOutboxPublisher>(sp => sp.GetRequiredService<ISpacesIntegrationEventService>());
        builder.Services.AddScoped<IRequestManager, RequestManager>();

        builder.Services.AddScoped<IPlaceQueries, PlaceQueries>();
        builder.Services.AddScoped<IReservationQueries, ReservationQueries>();
        builder.Services.AddScoped<IBranchSettingsQueries, BranchSettingsQueries>();
        builder.Services.AddScoped<ITenantFeaturesQueries, TenantFeaturesQueries>();

        builder.Services.AddHostedService<ReservationExpiryService>();

        builder.AddRabbitMqEventBus("eventbus")
            // Branch.API's flags, projected locally: a branch with reservations
            // paused refuses customer reservations without a call across services
            .AddSubscription<BranchSettingsChangedIntegrationEvent, BranchSettingsChangedIntegrationEventHandler>()
            // The café's switches, projected locally: a place is only given a rate or opened to
            // bookings while the module is on, whatever the request says
            .AddSubscription<TenantFeaturesChangedIntegrationEvent, TenantFeaturesChangedIntegrationEventHandler>()
            // Sales' receipt, projected onto the stay it covered: the
            // customer sees the cost as paid without a call to Sales
            .AddSubscription<TicketSettledIntegrationEvent, TicketSettledIntegrationEventHandler>()
            .ConfigureJsonOptions(options =>
                options.TypeInfoResolverChain.Add(SpacesIntegrationEventContext.Default));
    }
}

[JsonSerializable(typeof(PlaceUpdatedIntegrationEvent))]
[JsonSerializable(typeof(PlaceReservedIntegrationEvent))]
[JsonSerializable(typeof(PlaceBecameAvailableIntegrationEvent))]
[JsonSerializable(typeof(ReservationCancelledIntegrationEvent))]
[JsonSerializable(typeof(SessionCompletedIntegrationEvent))]
[JsonSerializable(typeof(SessionStartedIntegrationEvent))]
[JsonSerializable(typeof(SessionEndedIntegrationEvent))]
[JsonSerializable(typeof(SessionMemberJoinedIntegrationEvent))]
[JsonSerializable(typeof(SessionCustomerAssignedIntegrationEvent))]
[JsonSerializable(typeof(BranchSettingsChangedIntegrationEvent))]
[JsonSerializable(typeof(TenantFeaturesChangedIntegrationEvent))]
[JsonSerializable(typeof(TicketSettledIntegrationEvent))]
[JsonSerializable(typeof(SessionPaidIntegrationEvent))]
public partial class SpacesIntegrationEventContext : JsonSerializerContext
{
}
