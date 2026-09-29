// A guest who ordered in the app and now makes an account brings what they
// gave at checkout: the app sends their name and phone with the sign-in
// (nj_first, nj_last, nj_phone), and every profile page of the flow (sign-up,
// the review after a first Google or Apple sign-in, an update) starts with
// them filled in, so nothing is typed twice. They are kept in this tab's
// storage for the flow, since the pages after Google or Apple no longer carry
// the sign-in's address, and forgotten once a profile form is sent. A field
// the customer already has, or has typed into, is never overwritten.
const KEY = "nj_guest";
const params = new URLSearchParams(location.search);
const incoming = { first: params.get("nj_first"), last: params.get("nj_last"), phone: params.get("nj_phone") };
if (incoming.first || incoming.last || incoming.phone) {
    try {
        sessionStorage.setItem(KEY, JSON.stringify(incoming));
    } catch {
        // No storage: the page this address opens is still filled below
    }
}

let saved = null;
try {
    saved = JSON.parse(sessionStorage.getItem(KEY) || "null");
} catch {
    saved = null;
}
saved = saved || incoming;

for (const [id, value] of [["firstName", saved.first], ["lastName", saved.last], ["phoneNumber", saved.phone]]) {
    const field = document.getElementById(id);
    if (field && !field.value && typeof value === "string" && value.trim()) field.value = value.trim();
}

const profileForm = document.querySelector("#kc-register-form, #kc-idp-review-profile-form, #kc-update-profile-form");
profileForm?.addEventListener("submit", () => {
    try {
        sessionStorage.removeItem(KEY);
    } catch {
        // Nothing kept
    }
});

// Google or Apple asked for by the app (nj_idp, in place of kc_idp_hint, which would skip this page
// and the details with it): on to that provider at once, the details kept for the page after it
const idp = params.get("nj_idp");
if (idp) {
    const link = document.getElementById("social-" + idp);
    if (link?.href) location.replace(link.href);
}
