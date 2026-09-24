public class OrderServices(
    IMediator mediator,
    IOrderQueries queries,
    IIdentityService identityService,
    IBranchSettingsQueries branchSettings,
    IPlaceQueries places,
    TenantCountry country,
    ILogger<OrderServices> logger)
{
    public IMediator Mediator { get; set; } = mediator;
    public ILogger<OrderServices> Logger { get; } = logger;
    public IOrderQueries Queries { get; } = queries;
    public IIdentityService IdentityService { get; } = identityService;
    public IBranchSettingsQueries BranchSettings { get; } = branchSettings;
    public IPlaceQueries Places { get; } = places;

    /// <summary>Where the café is, so a guest's phone is read the way its country writes one.</summary>
    public TenantCountry Country { get; } = country;
}
