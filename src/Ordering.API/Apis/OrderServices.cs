public class OrderServices(
    IMediator mediator,
    IOrderQueries queries,
    IIdentityService identityService,
    IBranchSettingsQueries branchSettings,
    IPlaceQueries places,
    ILogger<OrderServices> logger)
{
    public IMediator Mediator { get; set; } = mediator;
    public ILogger<OrderServices> Logger { get; } = logger;
    public IOrderQueries Queries { get; } = queries;
    public IIdentityService IdentityService { get; } = identityService;
    public IBranchSettingsQueries BranchSettings { get; } = branchSettings;
    public IPlaceQueries Places { get; } = places;
}
