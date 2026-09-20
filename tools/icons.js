// Builds the app icon set: black square, white "BL" (Bar Lento), Helvetica-like bold, tight tracking. Owner's request 2026-09-20.
// Run: NODE_PATH=/opt/node22/lib/node_modules node tools/icons.js  (headless Chromium; writes icons/*.png)
const { chromium } = require("playwright"); const path = require("path");
const OUT = path.join(__dirname, "..", "icons");
function html(size, maskable) {
  const fs = Math.round(size * (maskable ? 0.46 : 0.60)); // maskable: letters inside the safe zone (Android crops ~10% per side)
  return `<html><body style="margin:0;background:#000"><div style="width:${size}px;height:${size}px;background:#000;display:flex;align-items:center;justify-content:center;font-family:'Liberation Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:700;color:#fff;font-size:${fs}px;letter-spacing:-0.06em;line-height:1"><span style="transform:translateY(-${Math.round(size*0.015)}px)">BL</span></div></body></html>`;
}
(async () => {
  const b = await chromium.launch(); const jobs = [["icon-192.png", 192, false], ["icon-512.png", 512, false], ["icon-512-maskable.png", 512, true], ["apple-touch-icon.png", 180, false], ["favicon-32.png", 32, false]];
  for (const [file, size, mask] of jobs) {
    const p = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await p.setContent(html(size, mask)); await p.waitForTimeout(100);
    await p.screenshot({ path: path.join(OUT, file), clip: { x: 0, y: 0, width: size, height: size }, omitBackground: false }); await p.close(); console.log("wrote", file, size);
  }
  await b.close();
})();
