/**
 * The platform's home page, told who sent the visitor: the business's own
 * label on the platform's domain (mellow of mellow.ninjapp.net), or its whole
 * host when it lives on a domain of its own.
 */
export function platformLink(appsUrl: string, host: string): string {
  const platform = new URL(appsUrl)
  const ref = host.endsWith(`.${platform.host}`) ? host.slice(0, -platform.host.length - 1) : host
  return `${platform.origin}/?ref=${encodeURIComponent(ref)}&utm_medium=guest-app`
}
