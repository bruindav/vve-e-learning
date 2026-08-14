// fix 47
// Gedeelde Firebase Authentication + Firestore helpers.
// Patroon: registratie met e-mail/wachtwoord -> pending-status -> admin keurt goed en
// wijst modules toe -> bevestigingsmail bij registratie én bij goedkeuring (via EmailJS).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  firebaseConfig,
  EMAILJS_SERVICE_ID,
  EMAILJS_PUBLIC_KEY,
  EMAILJS_TEMPLATE_ID,
  ALL_MODULES,
  ADMIN_EMAIL,
} from "./firebase-config.js?v47";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ======================= Registratie / login (VvE) =======================

export async function registerVve(email, password, naam) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Vul een geldig e-mailadres in.");
  }
  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  const ref = doc(db, "vves", cred.user.uid);
  await setDoc(ref, {
    email: cleanEmail,
    naam: naam || "",
    status: "pending",
    createdAt: serverTimestamp(),
  });
  await sendRegistrationEmail(cleanEmail, naam);
  await sendAdminNewRegistrationNotice(cleanEmail, naam);
  return cred.user;
}

export async function loginVve(email, password) {
  return signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
}

export async function resetPasswordVve(email) {
  return sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function getVveDocForCurrentUser() {
  const user = auth.currentUser;
  if (!user) return null;
  const ref = doc(db, "vves", user.uid);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getGroupForCurrentUser() {
  const vve = await getVveDocForCurrentUser();
  if (!vve || !vve.groupId) return null;
  const ref = doc(db, "vveGroups", vve.groupId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function hasModuleAccess(slug) {
  const vve = await getVveDocForCurrentUser();
  if (!vve || vve.status !== "approved" || !vve.groupId) return false;
  const groupRef = doc(db, "vveGroups", vve.groupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) return false;
  const group = groupSnap.data();
  return !!(group.moduleAccess && group.moduleAccess[slug] === true);
}

export function logout() {
  return signOut(auth);
}

// ======================= Beheerder =======================

export async function adminSignInWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function getAllVves() {
  const snap = await getDocs(collection(db, "vves"));
  const out = [];
  snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
  // Pending eerst, dan op naam/e-mail
  out.sort((a, b) => {
    if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
    return (a.naam || a.email).localeCompare(b.naam || b.email);
  });
  return out;
}

export async function getAllGroups() {
  const snap = await getDocs(collection(db, "vveGroups"));
  const out = [];
  snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
  out.sort((a, b) => (a.naam || "").localeCompare(b.naam || ""));
  return out;
}

export function suggestGroupCode(naam) {
  const base = (naam || "VVE")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10) || "VVE";
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return base + "-" + suffix;
}

/**
 * Keurt een NIEUWE registratie goed door er een NIEUWE VvE-groep voor aan te maken,
 * met de gekozen modules. Verstuurt de goedkeuringsmail.
 */
export async function approveVveNewGroup(vveDocId, email, naam, groupNaam, groupCode, moduleAccess) {
  const groupRef = doc(collection(db, "vveGroups"));
  await setDoc(groupRef, {
    naam: groupNaam || naam || "",
    code: groupCode || suggestGroupCode(groupNaam || naam),
    moduleAccess: moduleAccess || {},
    createdAt: serverTimestamp(),
  });
  const vveRef = doc(db, "vves", vveDocId);
  await updateDoc(vveRef, {
    status: "approved",
    groupId: groupRef.id,
    approvedAt: serverTimestamp(),
  });
  await sendApprovalEmail(email, naam, moduleAccess || {});
  return groupRef.id;
}

/**
 * Keurt een NIEUWE registratie goed door deze te koppelen aan een BESTAANDE VvE-groep.
 * De moduletoegang van die groep geldt automatisch mee. Verstuurt de goedkeuringsmail.
 */
export async function approveVveLinkGroup(vveDocId, email, naam, groupId) {
  const groupSnap = await getDoc(doc(db, "vveGroups", groupId));
  const moduleAccess = groupSnap.exists() ? groupSnap.data().moduleAccess || {} : {};
  const vveRef = doc(db, "vves", vveDocId);
  await updateDoc(vveRef, {
    status: "approved",
    groupId: groupId,
    approvedAt: serverTimestamp(),
  });
  await sendApprovalEmail(email, naam, moduleAccess);
  return groupId;
}

/**
 * Zet moduletoegang voor een hele VvE-groep tegelijk (geldt voor alle gekoppelde
 * accounts). Verstuurt de update-mail naar elk gekoppeld, goedgekeurd lid.
 */
export async function setGroupModuleAccess(groupId, slug, enabled, previousModuleAccess, groupNaam, members) {
  const ref = doc(db, "vveGroups", groupId);
  await updateDoc(ref, { [`moduleAccess.${slug}`]: enabled });
  const newModuleAccess = Object.assign({}, previousModuleAccess, { [slug]: enabled });
  for (const member of members || []) {
    await sendModulesUpdatedEmail(member.email, member.naam || groupNaam, newModuleAccess, previousModuleAccess);
  }
  return newModuleAccess;
}

/**
 * Bevestigt een hele set moduletoegang-wijzigingen in één keer (i.p.v. direct per
 * checkbox), en verstuurt daarna één update-mail per gekoppeld lid met het overzicht
 * van wat er is gewijzigd. Bedoeld voor een expliciete 'bevestig wijzigingen'-knop,
 * zodat een los aan/uit-klikje nooit direct iets opslaat of verstuurt.
 */
export async function confirmGroupModuleAccess(groupId, newModuleAccess, previousModuleAccess, groupNaam, members) {
  const ref = doc(db, "vveGroups", groupId);
  await updateDoc(ref, { moduleAccess: newModuleAccess });
  for (const member of members || []) {
    await sendModulesUpdatedEmail(member.email, member.naam || groupNaam, newModuleAccess, previousModuleAccess);
  }
  return newModuleAccess;
}

/**
 * Ontkoppelt een account van zijn huidige VvE-groep, door voor dat account een
 * NIEUWE, losse groep aan te maken (met dezelfde naam/modules als startpunt, zodat
 * niemand per ongeluk zonder toegang komt te zitten). De oude groep blijft
 * ongewijzigd voor de overige gekoppelde leden.
 */
export async function unlinkVveFromGroup(vveDocId, currentGroup) {
  const newGroupRef = doc(collection(db, "vveGroups"));
  await setDoc(newGroupRef, {
    naam: (currentGroup && currentGroup.naam) || "",
    code: suggestGroupCode((currentGroup && currentGroup.naam) || "VVE"),
    moduleAccess: (currentGroup && currentGroup.moduleAccess) || {},
    createdAt: serverTimestamp(),
  });
  const vveRef = doc(db, "vves", vveDocId);
  await updateDoc(vveRef, { groupId: newGroupRef.id });
  return newGroupRef.id;
}

// ======================= Gebruiksstatistiek (gestart / afgerond) =======================
// Alleen de eigen VvE mag dit bijwerken (zie firestore.rules), en alleen het 'progress'-veld —
// nooit status of moduleAccess. Fouten hier mogen de rest van de pagina nooit blokkeren,
// vandaar de stille try/catch.

export async function markModuleStarted(slug) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const ref = doc(db, "vves", user.uid);
    await updateDoc(ref, { [`progress.${slug}.started`]: true });
  } catch (e) {
    console.warn("[vve-auth] markModuleStarted mislukt:", e);
  }
}

export async function markModuleCompleted(slug) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const ref = doc(db, "vves", user.uid);
    await updateDoc(ref, { [`progress.${slug}.completed`]: true });
  } catch (e) {
    console.warn("[vve-auth] markModuleCompleted mislukt:", e);
  }
}

export async function deleteVve(vveDocId) {
  await deleteDoc(doc(db, "vves", vveDocId));
}

// ======================= Tikkie-configuratie =======================

export async function getTikkieConfig() {
  const ref = doc(db, "config", "tikkie");
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null; // { link, expiresAt } — expiresAt als 'YYYY-MM-DD'
}

export async function setTikkieConfig(link, expiresAt) {
  const ref = doc(db, "config", "tikkie");
  await setDoc(ref, { link: link || "", expiresAt: expiresAt || "" });
}

export function isTikkieValid(cfg) {
  if (!cfg || !cfg.link || !cfg.expiresAt) return false;
  const today = new Date().toISOString().slice(0, 10);
  return cfg.expiresAt >= today;
}

// ======================= EmailJS bevestigingsmails =======================

function _loginLink() {
  return window.location.origin + window.location.pathname.replace(/[^/]*$/, "") + "register.html";
}

function _adminLink() {
  return window.location.origin + window.location.pathname.replace(/[^/]*$/, "") + "admin.html";
}

function _loadEmailJs() {
  if (window.emailjs) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
    script.onload = () => {
      window.emailjs.init(EMAILJS_PUBLIC_KEY);
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function sendRegistrationEmail(email, naam) {
  if (EMAILJS_SERVICE_ID === "VUL_IN") return; // EmailJS nog niet geconfigureerd
  if (!email) { console.warn("[vve-auth] registratiemail overgeslagen: geen e-mailadres"); return; }
  try {
    await _loadEmailJs();
    await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      email: email,
      to_name: naam || email,
      email_subject: "Aanmelding ontvangen — VvE e-learning",
      email_body:
        "Bedankt voor je aanmelding bij de VvE e-learning!\n\n" +
        "Je aanvraag wordt nu bekeken. Zodra deze is goedgekeurd, ontvang je een bevestiging " +
        "met de modules die voor jullie VvE zijn vrijgegeven.\n\n" +
        "Goed om te weten: ieder bestuurslid kan zich met het eigen e-mailadres apart aanmelden " +
        "\u2014 je hoeft dit account dus niet te delen.\n\n" +
        "We wensen je veel succes met het bestuurswerk!\n\n" +
        "Inloggen kan hier zodra je bent goedgekeurd:\n" +
        _loginLink(),
    });
  } catch (e) {
    console.error("[vve-auth] registratiemail mislukt:", e);
  }
}

export async function sendModulesUpdatedEmail(email, naam, moduleAccess, previousModuleAccess) {
  if (EMAILJS_SERVICE_ID === "VUL_IN") return; // EmailJS nog niet geconfigureerd
  if (!email) { console.warn("[vve-auth] update-mail overgeslagen: geen e-mailadres"); return; }
  try {
    await _loadEmailJs();
    const modulesText = ALL_MODULES
      .filter((mod) => moduleAccess && moduleAccess[mod.slug] === true)
      .map((mod) => "- " + mod.title)
      .join("\n") || "(op dit moment geen modules)";

    const added = ALL_MODULES.filter(
      (mod) =>
        moduleAccess && moduleAccess[mod.slug] === true &&
        !(previousModuleAccess && previousModuleAccess[mod.slug] === true)
    );
    const removed = ALL_MODULES.filter(
      (mod) =>
        previousModuleAccess && previousModuleAccess[mod.slug] === true &&
        !(moduleAccess && moduleAccess[mod.slug] === true)
    );
    let changeText = "";
    if (added.length) {
      changeText += "Nieuw toegevoegd:\n" + added.map((mod) => "- " + mod.title).join("\n") + "\n\n";
    }
    if (removed.length) {
      changeText += "Niet langer beschikbaar:\n" + removed.map((mod) => "- " + mod.title).join("\n") + "\n\n";
    }

    await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      email: email,
      to_name: naam || email,
      email_subject: "Je moduletoegang is bijgewerkt \u2014 VvE e-learning",
      email_body:
        "Je toegang tot de VvE e-learning is zojuist aangepast.\n\n" +
        changeText +
        "Je hebt nu in totaal toegang tot de volgende modules:\n\n" +
        modulesText +
        "\n\nInloggen kan hier:\n" +
        _loginLink(),
    });
  } catch (e) {
    console.error("[vve-auth] update-mail mislukt:", e);
  }
}

export async function sendAdminNewRegistrationNotice(email, naam) {
  if (EMAILJS_SERVICE_ID === "VUL_IN") return; // EmailJS nog niet geconfigureerd
  try {
    await _loadEmailJs();
    await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      email: ADMIN_EMAIL,
      to_name: "Dave",
      email_subject: "Nieuwe registratie \u2014 VvE e-learning",
      email_body:
        "Er heeft zich een nieuwe VvE aangemeld voor de e-learning:\n\n" +
        "Naam: " + (naam || "(niet ingevuld)") + "\n" +
        "E-mail: " + email + "\n\n" +
        "Beoordeel de aanvraag in het beheerscherm:\n" +
        _adminLink(),
    });
  } catch (e) {
    console.error("[vve-auth] beheer-notificatie mislukt:", e);
  }
}

export async function sendModuleRequestEmail(email, naam, moduleTitle) {
  if (EMAILJS_SERVICE_ID === "VUL_IN") return; // EmailJS nog niet geconfigureerd
  try {
    await _loadEmailJs();
    await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      email: ADMIN_EMAIL,
      to_name: "Dave",
      email_subject: "Aanvraag voor module \u2014 VvE e-learning",
      email_body:
        "Een VvE vraagt toegang aan tot een module:\n\n" +
        "VvE: " + (naam || "(niet ingevuld)") + "\n" +
        "E-mail: " + email + "\n" +
        "Gevraagde module: " + moduleTitle + "\n\n" +
        "Beoordeel dit in het beheerscherm:\n" +
        _adminLink(),
    });
  } catch (e) {
    console.error("[vve-auth] aanvraagmail mislukt:", e);
  }
}

export async function sendApprovalEmail(email, naam, moduleAccess) {
  if (EMAILJS_SERVICE_ID === "VUL_IN") return; // EmailJS nog niet geconfigureerd
  if (!email) { console.warn("[vve-auth] goedkeuringsmail overgeslagen: geen e-mailadres"); return; }
  try {
    await _loadEmailJs();
    const modulesText = ALL_MODULES
      .filter((mod) => moduleAccess && moduleAccess[mod.slug] === true)
      .map((mod) => "- " + mod.title)
      .join("\n") || "(nog geen modules toegekend)";
    await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      email: email,
      to_name: naam || email,
      email_subject: "Je hebt toegang tot de VvE e-learning!",
      email_body:
        "Goed nieuws \u2014 je aanmelding voor de VvE e-learning is goedgekeurd. Je hebt nu toegang tot de volgende modules:\n\n" +
        modulesText +
        "\n\nWe wensen je veel succes en plezier met het bestuurswerk!\n\n" +
        "Inloggen kan hier:\n" +
        _loginLink(),
    });
  } catch (e) {
    console.error("[vve-auth] goedkeuringsmail mislukt:", e);
  }
}
