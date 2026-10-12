// Vérifie le jeton de passage de la connexion power user et le refus de faux identifiants Spotify.
import { signHandoff, verifyApp, verifyHandoff } from "@/lib/power-login";
const t = signHandoff("walid-test");
console.log("jeton valide :", verifyHandoff(t) === "walid-test");
console.log("jeton falsifié refusé :", verifyHandoff(t.replace(/.$/, (c) => (c === "A" ? "B" : "A"))) === null);
const [p, mac] = t.split(".");
const forged = Buffer.from(JSON.stringify({ sub: "autre", exp: 9999999999 })).toString("base64url");
console.log("autre identité refusée :", verifyHandoff(`${forged}.${mac}`) === null, "· sans signature :", verifyHandoff(p) === null);
console.log("fausse app refusée :", (await verifyApp({ clientId: "0".repeat(32), clientSecret: "1".repeat(32) })) === false);
console.log("app de Sortify acceptée :", await verifyApp({ clientId: process.env.SPOTIFY_CLIENT_ID!, clientSecret: process.env.SPOTIFY_CLIENT_SECRET! }));
