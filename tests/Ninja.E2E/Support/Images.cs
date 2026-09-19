namespace Ninja.E2E.Support;

/// <summary>Bytes that pass the services' image checks; the fake scanner never looks at the pixels.</summary>
public static class Images
{
    /// <summary>A 1×1 white PNG (67 bytes).</summary>
    public static readonly byte[] TinyPng = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=");
}
