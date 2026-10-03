// Where am I? The phone's location (asked with the browser's permission prompt), turned into place names by
// OpenStreetMap's Nominatim, with BigDataCloud's free client geocoder as a fallback. Only the place names are kept;
// the coordinates are sent to the geocoder once and never saved.
import { placeFromBigDataCloud, placeFromNominatim, placeFromText } from "./area.js";

const TIMEOUT = 12000;

async function getJSON(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/** The phone's position: {lat, lon}. Throws a readable Error (permission refused, no signal, not supported). */
export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!globalThis.navigator?.geolocation) return reject(new Error("This browser can't share your location — type your place instead."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) =>
        reject(
          new Error(
            e.code === 1
              ? "Location permission was refused. Allow location for this site in your browser settings, or type your place."
              : "Couldn't get your location (no GPS signal?). Try again outdoors, or type your place.",
          ),
        ),
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

const round = (v) => Math.round(v * 1000) / 1000; // about 100 m: enough for the town, kinder to privacy

/** Place names for a position. */
export async function placeAt({ lat, lon }) {
  const la = round(lat);
  const lo = round(lon);
  try {
    const j = await getJSON(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${la}&lon=${lo}&zoom=14&addressdetails=1&accept-language=en`);
    const p = placeFromNominatim(j.address);
    if (p.local || p.district || p.state) return p;
  } catch {
    /* try the next service */
  }
  const j = await getJSON(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${la}&longitude=${lo}&localityLanguage=en`);
  const p = placeFromBigDataCloud(j);
  if (!p.local && !p.district && !p.state) throw new Error("Couldn't find a place name for your location — type it instead.");
  return p;
}

/** A typed place ("Palayamkottai" or "Ambasamudram, Tirunelveli") looked up for its district and state. */
export async function findPlace(text) {
  const typed = placeFromText(text);
  try {
    const j = await getJSON(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=jsonv2&addressdetails=1&limit=1&accept-language=en`);
    if (j?.[0]?.address) {
      const p = placeFromNominatim(j[0].address);
      if (p.local || p.district || p.state) return p;
    }
  } catch {
    /* offline: use what was typed */
  }
  return typed;
}
