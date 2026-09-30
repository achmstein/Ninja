public class OrderServices(
    IMediator mediator,
    IOrderQueries queries,
    IIdentityService identityService,
    IBranchSettingsQueries branchSettings,
    ITenantSettingsQueries tenantSettings,
    IPlaceQueries places,
    TenantCountry country,
    ILogger<OrderServices> logger,
    IRequestManager requests)
{
    public IMediator Mediator { get; set; } = mediator;
    public ILogger<OrderServices> Logger { get; } = logger;
    public IOrderQueries Queries { get; } = queries;
    public IIdentityService IdentityService { get; } = identityService;
    public IBranchSettingsQueries BranchSettings { get; } = branchSettings;
    public ITenantSettingsQueries TenantSettings { get; } = tenantSettings;
    public IPlaceQueries Places { get; } = places;

    /// <summary>Where the business is, so a guest's phone is read the way its country writes one.</summary>
    public TenantCountry Country { get; } = country;

    /// <summary>The requests already carried out, so the same one sent again is answered as done.</summary>
    public IRequestManager Requests { get; } = requests;
}
