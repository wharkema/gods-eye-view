"use strict";

// "Magnetic pulse": langzaam uitdijende ringen achter de loginkaart.
// Alleen in de weergave Aurora; bij "minder beweging" staat de animatie stil (één vast beeld).
(function () {
  const canvas = document.getElementById("pulseCanvas");
  if (!canvas || !canvas.getContext) return;
  if (document.documentElement.dataset.thema !== "aurora") {
    canvas.dataset.animatie = "uit"; // SUPERP: geen ringen
    canvas.hidden = true;
    return;
  }
  const ctx = canvas.getContext("2d");

  const kleuren = ["#6927ff", "#8c52ff", "#38bdf8", "#a855f7"];
  const maxAlpha = 0.4; // subtiel, niet overheersend
  const snelheid = 0.1; // vaste snelheid
  const aantalRingen = 10;
  const minderBeweging = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let breedte = 0;
  let hoogte = 0;
  let midX = 0;
  let midY = 0;

  // Het middelpunt van de ringen is het midden van het loginblok
  const kaart = document.querySelector(".loginvak");
  function middenBepalen() {
    const r = kaart ? kaart.getBoundingClientRect() : { left: 0, top: 0, width: breedte, height: hoogte };
    midX = r.left + r.width / 2;
    // Hoogte van het blok in de begintoestand (login.js): openklappen van het beheerblok verplaatst de ringen niet
    const basis = kaart ? parseFloat(kaart.dataset.basisHoogte) : NaN;
    midY = r.top + (basis > 0 ? basis : r.height) / 2;
    canvas.dataset.midden = `${Math.round(midX)},${Math.round(midY)}`;
  }

  function maatAanpassen() {
    const dpr = window.devicePixelRatio || 1;
    breedte = window.innerWidth;
    hoogte = window.innerHeight;
    canvas.width = Math.round(breedte * dpr);
    canvas.height = Math.round(hoogte * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    middenBepalen();
  }

  const maxStraal = () => Math.max(breedte, hoogte) / 1.2;

  class Ring {
    constructor(verspreid) {
      this.opnieuw();
      if (verspreid) this.straal = Math.random() * maxStraal(); // niet leeg beginnen
    }

    opnieuw() {
      this.straal = 0;
      this.kleur = kleuren[Math.floor(Math.random() * kleuren.length)];
      this.basissnelheid = 0.5 + Math.random() * 1.5;
      this.dikte = 1 + Math.random() * 2.5;
    }

    bijwerken() {
      this.straal += this.basissnelheid * snelheid;
      if (this.straal > maxStraal()) this.opnieuw();
    }

    tekenen() {
      const max = maxStraal();
      let zichtbaar = 1;
      if (this.straal < 50) zichtbaar = this.straal / 50; // invagen
      else if (this.straal > max - 200) zichtbaar = (max - this.straal) / 200; // uitvagen
      ctx.beginPath();
      ctx.arc(midX, midY, this.straal, 0, Math.PI * 2);
      ctx.strokeStyle = this.kleur;
      ctx.globalAlpha = Math.max(zichtbaar, 0) * maxAlpha;
      ctx.lineWidth = this.dikte;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  maatAanpassen();
  const ringen = Array.from({ length: aantalRingen }, () => new Ring(true));

  function beeld() {
    ctx.clearRect(0, 0, breedte, hoogte); // doorzichtig: de achtergrond van de weergave blijft zichtbaar
    ringen.forEach((ring) => ring.tekenen());
  }

  function animeren() {
    ringen.forEach((ring) => ring.bijwerken());
    beeld();
    requestAnimationFrame(animeren); // pauzeert vanzelf als het tabblad niet zichtbaar is
  }

  window.addEventListener("resize", () => {
    maatAanpassen();
    beeld();
  });
  // Blok verandert van grootte (lettertype geladen, melding, wachtwoordblok) of de pagina scrolt
  const opnieuwMidden = () => {
    middenBepalen();
    if (minderBeweging) beeld();
  };
  if (kaart && "ResizeObserver" in window) new ResizeObserver(opnieuwMidden).observe(kaart);
  window.addEventListener("scroll", opnieuwMidden, { passive: true });
  window.addEventListener("login-geplaatst", opnieuwMidden);
  canvas.dataset.animatie = minderBeweging ? "stil" : "aan";
  if (minderBeweging) beeld();
  else animeren();
})();
