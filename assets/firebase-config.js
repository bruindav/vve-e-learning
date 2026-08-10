// fix 45
// VUL HIERONDER JE EIGEN FIREBASE-CONFIGURATIE IN
// (Firebase Console > Projectinstellingen > Jouw apps > Web app > SDK setup and configuration)
export const firebaseConfig = {
  apiKey: "AIzaSyBMKmzFlWhetUjb7NoxanWAS9gT-VEhDrs",
  authDomain: "vve-elearning.firebaseapp.com",
  projectId: "vve-elearning",
  storageBucket: "vve-elearning.firebasestorage.app",
  messagingSenderId: "345240440061",
  appId: "1:345240440061:web:22523f00da850b9dbec294",
};

// E-mailadres van de beheerder. Dit bepaalt alleen of de beheerpagina in de UI wordt getoond —
// de echte beveiliging zit in de Firestore-regels (zie firestore.rules).
export const ADMIN_EMAIL = "davedebruin123@gmail.com";

// EmailJS-configuratie voor bevestigingsmails (registratie + goedkeuring).
// We gebruiken hier bewust maar één gedeeld template (gratis EmailJS-limiet is 2 templates
// per account) — onderwerp en inhoud worden per mail meegegeven als variabelen.
export const EMAILJS_SERVICE_ID = "service_am7yhzo";
export const EMAILJS_PUBLIC_KEY = "grly1relpuAh_73z7";
export const EMAILJS_TEMPLATE_ID = "template_mss670k";

// Betaalgegevens die getoond worden bij een moduleaanvraag.
export const PAYMENT_IBAN = "NL43 ABNA 0476 7127 85";
export const PAYMENT_TNV = "D.R. de Bruin";
export const PAYMENT_PRICE = "\u20ac15";
// De Tikkie-link + vervaldatum staan niet hier, maar in Firestore (config/tikkie),
// bewerkbaar via admin.html — zo hoeft de site niet opnieuw gepubliceerd te worden
// als de Tikkie wordt vernieuwd.
// Alle modules die in het systeem bestaan. slug moet overeenkomen met de bestandsnaam
// (zonder .html) in de map modules/.
export const ALL_MODULES = [
  { slug: "basis", title: "Module 1 — Grip op de VvE-boekhouding" },
  { slug: "gevorderden", title: "Module 2 — VvE-boekhouding voor gevorderden" },
  { slug: "overeenkomsten-alv", title: "Module 3 — Overeenkomsten, offertes & de ALV" },
  { slug: "mjop", title: "Module 4 — Het MJOP begrijpen en beoordelen" },
  { slug: "geld-risico", title: "Module 5 — Lenen, verzekeren, aansprakelijkheid" },
  { slug: "verduurzaming", title: "Module 6 — Verduurzaming van het gebouw" },
  { slug: "statuten-reglementen", title: "Module 7 — Statuten en reglementen" },
  { slug: "kascommissie", title: "Module 8 — Wat doe je als kascommissie" },
  { slug: "ledenadministratie-privacy", title: "Module 9 — Ledenadministratie en privacy" },
  { slug: "bijdragen-incasso", title: "Module 10 — Bijdragen, incasso en achterstanden" },
  { slug: "vve-en-omgeving", title: "Module 11 — VvE en omgeving" },
  { slug: "conflict-burenruzies", title: "Module 12 — Conflict, burenruzies en overlast" },
];
