// fix 45
import { watchAuth, hasModuleAccess, getVveDocForCurrentUser, markModuleStarted, markModuleCompleted } from "./vve-auth.js?v45";

function showScreen(opts) {
  document.documentElement.style.visibility = "";
  document.body.innerHTML =
    '<div style="min-height:100vh; display:flex; align-items:center; justify-content:center; ' +
    'padding:24px; background:#132228; font-family:\'IBM Plex Sans\',sans-serif;">' +
    '<div style="max-width:400px; width:100%; background:#ECE4D1; border-radius:4px; ' +
    'padding:32px 28px; text-align:center; box-shadow:0 20px 50px -20px #000000a0;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace; font-size:11px; letter-spacing:.14em; ' +
    'text-transform:uppercase; color:#a86f1c; margin-bottom:14px;">Digidave &middot; E-learning VvE-bestuur</div>' +
    '<div style="display:inline-flex; align-items:center; gap:6px; font-family:\'IBM Plex Mono\',monospace; ' +
    'font-size:11.5px; font-weight:600; color:#5A5040; background:#00000009; border:1px solid #2F4F4433; ' +
    'padding:5px 12px; border-radius:2px; margin-bottom:16px;">' + opts.badge + '</div>' +
    '<h1 style="font-family:Georgia,serif; font-size:21px; color:#2A2118; margin:0 0 10px;">' + opts.title + '</h1>' +
    '<p style="font-size:13.5px; color:#5A5040; line-height:1.55; margin:0 0 22px;">' + opts.text + '</p>' +
    '<a href="' + opts.href + '" style="display:inline-block; padding:11px 18px; background:#C98A2C; ' +
    'color:#0d1a1f; font-weight:600; font-size:14px; border-radius:3px; text-decoration:none;">' +
    opts.linkText + '</a>' +
    '</div></div>';
}

function showNotLoggedIn(slug) {
  showScreen({
    badge: "&#128274; Inloggen vereist",
    title: "Log in om verder te gaan",
    text: "Deze module is alleen toegankelijk voor geregistreerde VvE's. Log in of registreer jullie VvE.",
    href: "../register.html?module=" + encodeURIComponent(slug),
    linkText: "Naar inloggen / registreren \u2192",
  });
}

function showPending() {
  showScreen({
    badge: "&#9203; In afwachting",
    title: "Jullie aanvraag wordt nog bekeken",
    text: "Jullie VvE is geregistreerd, maar nog niet goedgekeurd. Je ontvangt een bevestigingsmail zodra dat is gebeurd.",
    href: "../index.html",
    linkText: "\u2190 Terug naar overzicht",
  });
}

function showDenied() {
  showScreen({
    badge: "&#128274; Op aanvraag beschikbaar",
    title: "Deze module is er nog niet bij",
    text: "Jullie VvE heeft deze module nog niet afgenomen. Neem contact op als jullie hier toegang toe willen \u2014 dan zetten we 'm voor jullie open.",
    href: "../index.html",
    linkText: "\u2190 Terug naar overzicht",
  });
}

function showError() {
  showScreen({
    badge: "&#9888; Fout",
    title: "Er ging iets mis",
    text: "Er ging iets mis bij het controleren van je toegang. Probeer het later opnieuw.",
    href: "../index.html",
    linkText: "\u2190 Terug naar overzicht",
  });
}

export function guardModule(slug) {
  watchAuth(async (user) => {
    if (!user) {
      showNotLoggedIn(slug);
      return;
    }
    try {
      const vve = await getVveDocForCurrentUser();
      if (!vve || vve.status !== "approved") {
        showPending();
        return;
      }
      const ok = await hasModuleAccess(slug);
      if (ok) {
        window.__vveUid = user.uid;
        document.documentElement.style.visibility = "";
        markModuleStarted(slug);
        window.__markModuleCompleted = function () { markModuleCompleted(slug); };
      } else {
        showDenied();
      }
    } catch (e) {
      showError();
    }
  });
}
