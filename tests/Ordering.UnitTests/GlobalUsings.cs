global using System;
global using System.Collections.Generic;
global using System.Linq;
global using System.Threading;
global using System.Threading.Tasks;
global using MediatR;
global using Microsoft.AspNetCore.Mvc;
global using Ninja.Ordering.API.Application.Commands;
global using Ninja.Ordering.API.Application.Models;
global using Ninja.Ordering.API.Infrastructure.Services;
global using Ninja.Ordering.Domain.AggregatesModel.BuyerAggregate;
global using Ninja.Ordering.Domain.Events;
global using Ninja.Ordering.Domain.Exceptions;
global using Ninja.Ordering.Domain.SeedWork;
global using Ninja.Ordering.Infrastructure.Idempotency;
global using Microsoft.Extensions.Logging;
global using NSubstitute;
global using Ninja.Ordering.UnitTests;
global using Microsoft.VisualStudio.TestTools.UnitTesting;

[assembly: Parallelize(Workers = 0, Scope = ExecutionScope.MethodLevel)]
