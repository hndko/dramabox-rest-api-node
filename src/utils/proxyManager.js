import fs from "fs";
import axios from "axios";

let proxies = [];
let lastRotatedProxy = null;

// Load local proxy from file
export function loadLocalProxy() {
  try {
    const file = fs.readFileSync("./proxyList.txt", "utf-8");
    proxies = file
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    console.log("Loaded local proxies:", proxies.length);
  } catch (err) {
    console.log("Cannot load proxyList.txt:", err.message);
  }
}

// Load online proxy list (extra optional)
export async function loadOnlineProxy() {
  try {
    const res = await axios.get(
      "https://proxylist.geonode.com/api/proxy-list?limit=20"
    );
    const online = res.data.data.map(
      (p) => `${p.protocols[0]}://${p.ip}:${p.port}`
    );

    proxies.push(...online);
    proxies = [...new Set(proxies)];

    console.log("Online proxies added:", online.length);
  } catch (error) {
    console.log("Failed to fetch online proxies");
  }
}

// Get random proxy
export function getRandomProxy() {
  if (proxies.length === 0) return null;
  const random = proxies[Math.floor(Math.random() * proxies.length)];
  lastRotatedProxy = random;
  return random;
}

// Rotation system
export function autoRotate(seconds = 30) {
  setInterval(() => {
    lastRotatedProxy = getRandomProxy();
    console.log("🔄 Rotated Proxy:", lastRotatedProxy);
  }, seconds * 1000);
}

export function getCurrentProxy() {
  return lastRotatedProxy || getRandomProxy();
}
