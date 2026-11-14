#nullable enable
using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Two accounts turned out to be one person, and the owner merged them: what
/// was kept under <see cref="FromUserId"/> now belongs to
/// <see cref="IntoUserId"/>, whose name is <see cref="IntoDisplayName"/>.
/// The first account is switched off and takes no more business. Every
/// service moves its own rows; handling it twice moves nothing twice.
/// </summary>
public record CustomersMergedIntegrationEvent(string FromUserId, string IntoUserId, string IntoDisplayName) : IntegrationEvent;
