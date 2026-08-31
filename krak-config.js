/* ============================================================
   Krak — verbinding met je eigen Supabase-project
   ============================================================
   Vul de twee waarden hieronder in. Je vindt ze allebei via de knop
   "Connect" bovenaan je project, of onder Project Settings.

   - url     : het veld "Project URL", bv. https://abcdefghijklm.supabase.co
   - sleutel : je publieke sleutel. Supabase is aan het overschakelen, dus je
               ziet er één van twee (of allebei):
                 * "publishable key", begint met sb_publishable_...   <- neem deze
                 * "anon public",     begint met eyJ...               <- werkt ook,
                   maar verdwijnt eind 2026
               Beide werken identiek voor Krak; kies de publishable als je ze hebt.

   Die publieke sleutel hoort in je app te staan en is geen wachtwoord: de
   tabellen liggen op slot en alle toegang loopt via functies die een token
   vragen. Zet hier NOOIT een "service_role" of "secret" sleutel (sb_secret_...)
   — die omzeilt alles.

   Zelfde bestand voor Taalkrak en Rekenkrak: één keer invullen, in beide
   repo's uploaden.
   ============================================================ */

window.KRAK_CONFIG = {
  url:     "https://avnxhqxtusfwwjspeosh.supabase.co",
  sleutel: "sb_publishable_KNjHNHkEaP9tjg081jAuyA_9uEEm-ag"
};
