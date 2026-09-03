using System.Text.Json.Serialization;
using Chillax.Spaces.API.Application.BackgroundServices;
using Chillax.Spaces.API.Application.IntegrationEvents.Events;
using Chillax.Spaces.API.Application.IntegrationEvents.EventHandling;
using Chillax.Spaces.API.Application.Queries;
using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Chillax.Spaces.Domain.AggregatesModel.RoomAggregate;
using Chillax.Spaces.API.Infrastructure;
using Chillax.Spaces.Infrastructure;
using Chillax.Spaces.Infrastructure.Idempotency;
using Chillax.Spaces.Infrastructure.Repositories;
using SpacesContext = Chillax.Spaces.Infrastructure.SpacesContext;

namespace Chillax.Spaces.API.Extensions;

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

        builder.AddNpgsqlDbContext<SpacesContext>("spacesdb", configureDbContextOptions: options =>
        {
            // Ensure the schema is created for the new DDD model
        });

        // REVIEW: This is done for development ease but shouldn't be here in production
        builder.Services.AddMigration<SpacesContext, SpacesContextSeed>();

        // Add MediatR for CQRS
        builder.Services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblyContaining(typeof(Program));
            cfg.LicenseKey = builder.Configuration["MediatR:LicenseKey"];
        });

        // Register repositories
        builder.Services.AddScoped<IRoomRepository, RoomRepository>();
        builder.Services.AddScoped<IReservationRepository, ReservationRepository>();
        builder.Services.AddScoped<IRequestManager, RequestManager>();

        // Register queries
        builder.Services.AddScoped<IRoomQueries, RoomQueries>();
        builder.Services.AddScoped<IBranchSettingsQueries, BranchSettingsQueries>();

        // Register background services
        builder.Services.AddHostedService<ReservationExpirationService>();

        // Add RabbitMQ event bus for publishing room availability events
        builder.AddRabbitMqEventBus("eventbus")
            // Branch.API's flags, projected locally: a branch with reservations
            // paused refuses customer bookings without a call across services
            .AddSubscription<BranchSettingsChangedIntegrationEvent, BranchSettingsChangedIntegrationEventHandler>()
            .ConfigureJsonOptions(options =>
                options.TypeInfoResolverChain.Add(SpacesIntegrationEventContext.Default));
    }
}

[JsonSerializable(typeof(RoomBecameAvailableIntegrationEvent))]
[JsonSerializable(typeof(SessionCompletedIntegrationEvent))]
[JsonSerializable(typeof(SessionStartedIntegrationEvent))]
[JsonSerializable(typeof(SessionEndedIntegrationEvent))]
[JsonSerializable(typeof(SessionMemberJoinedIntegrationEvent))]
[JsonSerializable(typeof(BranchSettingsChangedIntegrationEvent))]
public partial class SpacesIntegrationEventContext : JsonSerializerContext
{
}
