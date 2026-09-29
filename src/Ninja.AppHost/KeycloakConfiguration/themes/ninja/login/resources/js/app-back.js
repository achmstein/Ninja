// The customer's pages have a way back to the café's app in their top bar. A
// client whose address Keycloak knows gets it in the markup; for one that has
// none, the address the sign-in came from (its redirect_uri, on the first
// page of the flow) is kept for this tab and used on every page after it.
const KEY = "nj_app_origin";
const redirect = new URLSearchParams(location.search).get("redirect_uri");
if (redirect) {
    try {
        const origin = new URL(redirect).origin;
        if (origin.startsWith("http")) sessionStorage.setItem(KEY, origin);
    } catch {
        // Not an address: nothing to keep
    }
}

const back = document.querySelector("[data-app-back][hidden]");
if (back) {
    let origin = null;
    try {
        origin = sessionStorage.getItem(KEY);
    } catch {
        origin = null;
    }
    if (origin) {
        back.href = origin + "/";
        back.hidden = false;
    }
}
