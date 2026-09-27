// Bar Lento — what's new in the app (owner's request 2026-09-27: "quando ci sono tasti nuovi o PDF aggiornati, notifica a tutti
// e una mail pulita alle email registrate, così le prossime volte c'è già tutto").
// HOW IT WORKS: add ONE entry at the top of `entries` and push. The live site announces it by itself (lib/whatsnew.js, on the
// polls of /api/data, never at night): one push to every phone with notifications on, one email to every person on staff at the
// email Bar Lento has for them (Toast, else the one they signed with), one summary email to the owner, one history line.
// Each entry is sent once (Redis flag). Keep it short: a title, a few items, the links that matter. English first (the team),
// Italian below. No emoji.
module.exports = {
  copyTo: "simoneviola@barlentony.com",
  appUrl: "https://bar-lento.vercel.app",
  entries: [
    {
      id: "2026-09-27-bar",
      date: "2026-09-27",
      title: { en: "New in the app: the Bar card", it: "Novità nell'app: la card Bar" },
      intro: {
        en: "Three things changed today. Open the app and have a look: it takes a minute.",
        it: "Oggi sono cambiate tre cose. Apri l'app e dai un'occhiata: ci vuole un minuto.",
      },
      items: [
        {
          en: ["Bar", "a new card on the home screen with what is NOT available behind the bar right now and how to make things (the spritz, wine by the glass). A red NEW tag until you open it; inside, an EN / IT switch. Everyone can read it; only Simone and Marta can change it. When the list changes, the people working today or tomorrow get a notification."],
          it: ["Bar", "una nuova card nella schermata principale con cosa NON è disponibile al bancone in questo momento e come si preparano le cose (lo spritz, il vino al calice). Un'etichetta rossa NEW finché non la apri; dentro, il selettore EN / IT. La leggono tutti; la cambiano solo Simone e Marta. Quando la lista cambia, chi lavora oggi o domani riceve una notifica."],
        },
        {
          en: ["Cleaner look", "same app, lighter and tidier on the phone: one size for everything, fewer colours, nothing moves for no reason."],
          it: ["Grafica più pulita", "stessa app, più leggera e ordinata sul telefono: una misura unica per tutto, meno colori, niente che si muove senza motivo."],
        },
        {
          en: ["Guide updated", "the welcome guide (PDF) now shows the Bar card too. It is linked at the bottom of the app."],
          it: ["Guida aggiornata", "la guida di benvenuto (PDF) ora mostra anche la card Bar. La trovi in fondo all'app."],
        },
      ],
      links: [{ label: { en: "Guide (PDF)", it: "Guida (PDF)" }, url: "https://bar-lento.vercel.app/welcome.pdf" }],
      push: { en: "New in the app: the Bar card — what's not available and how to make things. Open the app." },
    },
  ],
};
