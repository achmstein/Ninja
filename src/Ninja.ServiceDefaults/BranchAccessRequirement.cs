using Microsoft.AspNetCore.Authorization;

namespace Ninja.ServiceDefaults;

/// <summary>
/// A request that names a branch must name one the caller is assigned to.
/// Added to the staff policies ("Admin", "Pos"); evaluated by
/// <see cref="BranchAccessHandler"/>.
/// </summary>
public sealed class BranchAccessRequirement : IAuthorizationRequirement;
