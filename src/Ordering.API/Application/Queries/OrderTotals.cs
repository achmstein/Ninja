#nullable enable
using System.Linq.Expressions;
using System.Reflection;
using DomainOrder = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

namespace Ninja.Ordering.API.Application.Queries;

/// <summary>
/// What an order comes to, written once for the database as
/// <see cref="DomainOrder.GetTotal"/> is for the aggregate: the items net of
/// their discounts, less the promo and the loyalty discount, never below
/// nothing, and the delivery fee on top. A query says <see cref="Of"/> where
/// it wants the total and is passed through <see cref="WithOrderTotals{T}"/>,
/// which puts this formula in its place, so no query keeps a copy of it.
/// </summary>
public static class OrderTotals
{
    public static readonly Expression<Func<DomainOrder, decimal>> Formula = o =>
        Math.Max(0m, o.OrderItems.Sum(i => i.UnitPrice * i.Units - i.Discount) - o.PromoDiscount - (decimal)o.LoyaltyDiscount)
        + (o.Delivery != null ? o.Delivery.Fee : 0m);

    /// <summary>The order's total, inside a query passed through <see cref="WithOrderTotals{T}"/>; never called itself.</summary>
    public static decimal Of(DomainOrder order) =>
        throw new InvalidOperationException("OrderTotals.Of only stands in a query passed through WithOrderTotals().");

    private static readonly MethodInfo OfMethod = typeof(OrderTotals).GetMethod(nameof(Of))!;

    /// <summary>Puts <see cref="Formula"/> wherever the query says <see cref="Of"/>.</summary>
    public static IQueryable<T> WithOrderTotals<T>(this IQueryable<T> query) =>
        query.Provider.CreateQuery<T>(new Expander().Visit(query.Expression));

    private sealed class Expander : ExpressionVisitor
    {
        protected override Expression VisitMethodCall(MethodCallExpression node)
        {
            if (node.Method != OfMethod)
            {
                return base.VisitMethodCall(node);
            }

            var order = Visit(node.Arguments[0]);
            return new Replace(Formula.Parameters[0], order).Visit(Formula.Body);
        }
    }

    private sealed class Replace(ParameterExpression from, Expression to) : ExpressionVisitor
    {
        protected override Expression VisitParameter(ParameterExpression node) => node == from ? to : base.VisitParameter(node);
    }
}
