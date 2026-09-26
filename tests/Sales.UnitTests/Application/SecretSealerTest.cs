namespace Ninja.Sales.UnitTests.Application;

using System.Security.Cryptography;
using Microsoft.Extensions.Options;
using Ninja.Sales.API.Payments;

[TestClass]
public class SecretSealerTest
{
    private static SecretSealer With(string? key) => new(Options.Create(new PaymentsOptions { Key = key }));

    [TestMethod]
    public void A_sealed_secret_opens_only_with_the_same_key_and_never_reads_as_itself()
    {
        var sealer = With("stack-key-one");

        var sealedOnce = sealer.Seal("sk_live_abc");
        var sealedTwice = sealer.Seal("sk_live_abc");

        Assert.StartsWith("sealed:v1:", sealedOnce);
        Assert.DoesNotContain("sk_live_abc", sealedOnce);
        Assert.AreNotEqual(sealedOnce, sealedTwice, "a fresh nonce every time");
        Assert.AreEqual("sk_live_abc", sealer.Open(sealedOnce));
        Assert.ThrowsExactly<AuthenticationTagMismatchException>(() => With("another-stack").Open(sealedOnce));
    }

    [TestMethod]
    public void A_stack_without_a_key_cannot_seal()
    {
        var sealer = With(null);
        Assert.IsFalse(sealer.CanSeal);
        Assert.ThrowsExactly<InvalidOperationException>(() => sealer.Seal("x"));
    }
}
