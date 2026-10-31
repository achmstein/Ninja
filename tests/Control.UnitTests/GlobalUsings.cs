global using Microsoft.VisualStudio.TestTools.UnitTesting;
global using Ninja.Control.NodeRuntime;

[assembly: Parallelize(Workers = 0, Scope = ExecutionScope.MethodLevel)]
