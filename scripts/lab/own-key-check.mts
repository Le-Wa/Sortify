// Vérifie le chiffrement des clés personnelles et le refus d'une fausse clé (rien n'est enregistré).
import { decrypt, encrypt } from "@/lib/secrets";
import { setAnthropicKey } from "@/lib/own-keys";
const blob = encrypt("sk-ant-test-1234567890abcdefghij");
console.log("aller-retour :", decrypt(blob) === "sk-ant-test-1234567890abcdefghij", "· chiffré différent du clair :", !blob.includes("sk-ant"));
for (const key of ["pas une clé", "sk-ant-api03-ffffffffffffffffffffffffffffffffffffffff"]) {
  try {
    await setAnthropicKey("membre-inexistant", key);
    console.log("✗ acceptée :", key.slice(0, 12));
  } catch (e) {
    console.log("✓ refusée :", e instanceof Error ? e.message : e);
  }
}
