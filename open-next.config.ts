import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Domyślna konfiguracja wystarcza na start (bez ISR/cache tuningu).
// Cache/R2/KV dołożysz później, jak będzie potrzeba.
export default defineCloudflareConfig();
