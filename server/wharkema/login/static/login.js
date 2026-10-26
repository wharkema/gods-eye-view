"use strict";

// Melding na een mislukte poging (?fout=...). Bewust één melding voor een onbekende naam en een fout wachtwoord.
const MELDINGEN = {
  onjuist: "Onjuiste gebruikersnaam of wachtwoord.",
  geblokkeerd: "Te veel mislukte pogingen. Probeer het over 15 minuten opnieuw.",
};

const fout = document.getElementById("login-fout");
const melding = MELDINGEN[new URLSearchParams(window.location.search).get("fout")] || "";
fout.textContent = melding;
fout.hidden = !melding;

// Het geheel (groot logo + blok) staat midden in beeld; de ringen (login-pulse.js) volgen het blok.
const kaart = document.querySelector(".loginvak");
const stapel = document.querySelector(".loginstapel");
const logo = document.querySelector(".loginlogo");

function plaatsen() {
  const k = kaart.getBoundingClientRect();
  const l = logo.getBoundingClientRect();
  const hangtErboven = l.height > 0 && getComputedStyle(logo).position === "absolute";
  const boven = hangtErboven ? k.top - l.top : 0;
  const inStroom = stapel.offsetHeight - kaart.offsetHeight;
  const top = Math.max(16, (window.innerHeight - (boven + inStroom + k.height)) / 2) + boven;
  document.body.style.setProperty("--login-boven", `${Math.round(top)}px`);
  kaart.dataset.basisHoogte = String(Math.round(k.height));
  document.body.classList.add("geplaatst");
  window.dispatchEvent(new Event("login-geplaatst"));
}

plaatsen();
window.addEventListener("resize", plaatsen);
if ("ResizeObserver" in window) new ResizeObserver(plaatsen).observe(kaart);
if (document.fonts) document.fonts.ready.then(plaatsen);
