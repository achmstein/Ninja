using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Http.Resilience;

namespace Ninja.ServiceDefaults;

public static class MapLinkClientExtensions
{
    /// <summary>
    /// The client <see cref="MapLocation.ResolveAsync"/> follows a shared short
    /// map link with (<see cref="MapLocation.ClientName"/>): it never follows a
    /// redirect itself, since the resolver checks each hop's host before it
    /// goes there; it gives up after five seconds; and it does not retry, so
    /// a link that does not answer costs one try, not the default pipeline's
    /// several.
    /// </summary>
    public static IHttpClientBuilder AddMapLinkClient(this IServiceCollection services)
    {
        var builder = services
            .AddHttpClient(MapLocation.ClientName, http => http.Timeout = TimeSpan.FromSeconds(5))
            .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
            {
                AllowAutoRedirect = false,
                UseCookies = false,
                ConnectTimeout = TimeSpan.FromSeconds(3),
            });
#pragma warning disable EXTEXP0001 // RemoveAllResilienceHandlers: the defaults' retries are not wanted here
        builder.RemoveAllResilienceHandlers();
#pragma warning restore EXTEXP0001
        return builder;
    }
}
