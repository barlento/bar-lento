// Bar Lento menu, as the assistant explains it to the team (dishes, ingredients, allergens, how to describe them).
// Owner keeps the official PDF (menu kit); paste the current content here when it changes. Dual-mode: browser + server.
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(); else root.BL_MENU = factory(); })(typeof self !== "undefined" ? self : this, function () {
  return {
    updated: null, // YYYY-MM-DD of the last menu update, null = not loaded yet
    note: "The menu has not been loaded into the app yet. Ask the manager or check the printed menu.",
    sections: [
      // { name: "Small bites", items: [{ name: "Cacio e Pepe", price: 18, desc: "tonnarelli, pecorino romano, black pepper", allergens: ["Gluten", "Dairy"], notes: "vegetarian; can be made gluten-free on request" }] }
    ],
  };
});
