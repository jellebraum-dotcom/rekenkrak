/* ============================================================
   Krak — sessielaag voor Taalkrak en Rekenkrak   (versie 4)
   ------------------------------------------------------------
   Praat met Supabase via gewone fetch-oproepen naar de RPC-functies.
   Geen SDK, geen CDN, geen build-stap: past bij de rest van de app en
   blijft offline werken (zonder net doen de oproepen gewoon niets).

   Laad dit NA krak-config.js:
       <script src="krak-config.js"></script>
       <script src="krak-sessie.js"></script>

   Een sessie loopt een les lang en bevat RONDES. Elke ronde is één
   oefening die de leerkracht start. Leerlingtoestellen vragen elke paar
   seconden wat ze moeten doen en schakelen mee over.

   De sessiecode reist mee in de link als &ls=XXXX. Die sleutel is vrij in
   beide apps, en beide parseParams-functies negeren onbekende sleutels —
   buildHash en parseParams hoeven dus niet aangepast te worden.
   ============================================================ */

var KrakSessie = (function(){
"use strict";

var CFG = (typeof window!=="undefined" && window.KRAK_CONFIG) || null;
var SLEUTEL_BEHEER  = "krak.beheer";   /* de sessie die nu open staat */
var SLEUTEL_ARCHIEF = "krak.sessies";  /* alle sessies van deze leerkracht  */
var VOORVOEGSEL_DEELNAME = "krak.deelname.";
var SLEUTEL_AUTH    = "krak.auth";     /* aanmelding van de leerkracht      */

/* ---------- basis ---------- */

function ingesteld(){
  return !!(CFG && CFG.url && CFG.sleutel &&
            String(CFG.url).indexOf("VUL_HIER") < 0 &&
            String(CFG.sleutel).indexOf("VUL_HIER") < 0);
}

/* De "Connect"-knop van Supabase geeft de URL soms mét /rest/v1 erachter.
   Dat stuk plakken we zelf, dus halen we het er hier af — anders krijg je
   "Invalid path specified in request URL". */
function basisUrl(){
  return String(CFG.url || "").trim()
    .replace(/\/+$/, "").replace(/\/rest\/v1$/i, "").replace(/\/+$/, "");
}

/* ---------- aanmelding van de leerkracht ----------
   Leerlingen hebben dit niet nodig: zonder aanmelding praat de app met de
   publieke sleutel, en dat volstaat om aan te sluiten en te oefenen. */

function auth(){
  var a = haal(SLEUTEL_AUTH);
  return (a && a.access_token) ? a : null;
}
function aangemeld(){ return !!auth(); }
function gebruiker(){ var a = auth(); return a ? (a.user || null) : null; }

/* Naar de aanbieder en terug. provider is "google" of "azure" — dat laatste
   is hoe Supabase Microsoft noemt. redirect_to moet in Supabase bij de
   toegelaten Redirect URLs staan, anders weigert hij de omleiding. */
/* Microsoft heet bij Supabase "azure". En bij azure moet je het e-mailadres
   uitdrukkelijk vragen: zonder de email-scope komt de aanmelding terug met
   "Error getting user email from external provider". */
var AANBIEDERS = {
  google:    { naam: "google", scopes: "" },
  microsoft: { naam: "azure",  scopes: "openid email profile" },
  azure:     { naam: "azure",  scopes: "openid email profile" }
};

function aanmelden(terug, aanbieder){
  if(!ingesteld()) return;
  var a = AANBIEDERS[String(aanbieder || "google").toLowerCase()] || AANBIEDERS.google;
  var naar = String(terug || (typeof location!=="undefined" ? location.href : ""));
  naar = naar.split("#")[0];
  location.href = basisUrl() + "/auth/v1/authorize?provider=" + a.naam +
                  (a.scopes ? "&scopes=" + encodeURIComponent(a.scopes) : "") +
                  "&redirect_to=" + encodeURIComponent(naar);
}

function afmelden(){
  var a = auth();
  wis(SLEUTEL_AUTH);
  if(!a) return Promise.resolve(true);
  return fetch(basisUrl() + "/auth/v1/logout", {
    method: "POST",
    headers: { "apikey": CFG.sleutel, "Authorization": "Bearer " + a.access_token }
  }).then(function(){ return true; }).catch(function(){ return true; });
}

/* Terug van de aanbieder. Bij succes staan de tokens in de hash; bij een
   mislukking staat er een foutmelding — in de hash én in de zoekreeks.
   Die moet zichtbaar worden, anders lijkt het alsof er niets gebeurt.
   Geeft {fout:"..."} terug bij een mislukking. */
function verwerkAanmelding(){
  if(typeof location === "undefined") return null;
  function ontleed(tekst){
    var kv = {};
    String(tekst || "").replace(/^[#?]/, "").split("&").forEach(function(deel){
      var i = deel.indexOf("=");
      if(i > 0) kv[deel.slice(0,i)] = decodeURIComponent(deel.slice(i+1).replace(/\+/g," "));
    });
    return kv;
  }
  var h = ontleed(location.hash), q = ontleed(location.search);
  var fout = h.error_description || q.error_description || h.error || q.error;
  if(fout){
    try{ history.replaceState(null, "", location.pathname); }catch(e){}
    return { fout: String(fout) };
  }
  var kv = h;
  if(!kv.access_token) return null;
  var a = {
    access_token: kv.access_token,
    refresh_token: kv.refresh_token || null,
    verloopt: Date.now() + (parseInt(kv.expires_in,10) || 3600) * 1000,
    user: null
  };
  zet(SLEUTEL_AUTH, a);
  try{ history.replaceState(null, "", location.pathname + location.search); }catch(e){}
  return a;
}

/* Wie ben ik? Vult het e-mailadres aan zodat de app het kan tonen. */
function haalGebruiker(){
  var a = auth();
  if(!a) return Promise.resolve(null);
  if(a.user) return Promise.resolve(a.user);
  return fetch(basisUrl() + "/auth/v1/user", {
    headers: { "apikey": CFG.sleutel, "Authorization": "Bearer " + a.access_token }
  }).then(function(r){ return r.ok ? r.json() : null; })
    .then(function(u){
      if(u){ a.user = { id: u.id, email: u.email }; zet(SLEUTEL_AUTH, a); }
      return a.user;
    }).catch(function(){ return null; });
}

function vernieuwToken(){
  var a = auth();
  if(!a || !a.refresh_token) return Promise.resolve(false);
  return fetch(basisUrl() + "/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": CFG.sleutel },
    body: JSON.stringify({ refresh_token: a.refresh_token })
  }).then(function(r){ return r.ok ? r.json() : null; })
    .then(function(j){
      if(!j || !j.access_token){ wis(SLEUTEL_AUTH); return false; }
      zet(SLEUTEL_AUTH, {
        access_token: j.access_token,
        refresh_token: j.refresh_token || a.refresh_token,
        verloopt: Date.now() + (j.expires_in || 3600) * 1000,
        user: (j.user ? { id: j.user.id, email: j.user.email } : a.user) || null
      });
      return true;
    }).catch(function(){ return false; });
}

/* ---------- praten met de databank ---------- */

function rpc(naam, params, tweedePoging){
  if(!ingesteld()) return Promise.reject(new Error("krak-config.js is nog niet ingevuld"));
  var a = auth();

  /* Bijna verlopen? Eerst vernieuwen, anders faalt de oproep onderweg. */
  if(a && a.verloopt && a.verloopt - Date.now() < 60000 && !tweedePoging){
    return vernieuwToken().then(function(){ return rpc(naam, params, true); });
  }

  return fetch(basisUrl() + "/rest/v1/rpc/" + naam, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "apikey": CFG.sleutel,
      "Authorization": "Bearer " + (a ? a.access_token : CFG.sleutel)
    },
    body: JSON.stringify(params || {})
  }).then(function(r){
    return r.text().then(function(tekst){
      var data = null;
      try{ data = tekst ? JSON.parse(tekst) : null; }catch(e){}
      if(!r.ok){
        /* Token afgekeurd: één keer vernieuwen en opnieuw proberen. */
        if((r.status===401 || r.status===403) && a && !tweedePoging){
          return vernieuwToken().then(function(gelukt){
            if(!gelukt){ wis(SLEUTEL_AUTH); }
            return rpc(naam, params, true);
          });
        }
        var reden = (data && (data.message || data.hint)) || ("http_" + r.status);
        var f = new Error(reden); f.status = r.status; f.data = data;
        throw f;
      }
      return data;
    });
  });
}

/* Opslag mag altijd falen (privémodus, geblokkeerde cookies): nooit crashen. */
function zet(s, w){ try{ window.localStorage.setItem(s, JSON.stringify(w)); }catch(e){} }
function haal(s){ try{ var v=window.localStorage.getItem(s); return v?JSON.parse(v):null; }catch(e){ return null; } }
function wis(s){ try{ window.localStorage.removeItem(s); }catch(e){} }

/* ---------- sessiecode in de link ---------- */

function codeUitHash(bron){
  var str = bron;
  if(str == null) str = (typeof location !== "undefined" ? location.hash : "");
  if(!str) return null;
  var i = String(str).indexOf("#");
  if(i > -1) str = String(str).slice(i + 1);
  var gevonden = null;
  String(str).split("&").forEach(function(deel){
    var m = deel.split("=");
    if(m[0] === "ls" && m[1]) gevonden = decodeURIComponent(m[1]).toUpperCase();
  });
  return (gevonden && /^[A-Z0-9]{4}$/.test(gevonden)) ? gevonden : null;
}

function beheerUitHash(bron){
  var str = bron;
  if(str == null) str = (typeof location !== "undefined" ? location.hash : "");
  if(!str) return null;
  var i = String(str).indexOf("#");
  if(i > -1) str = String(str).slice(i + 1);
  var gevonden = null;
  String(str).split("&").forEach(function(deel){
    var m = deel.split("=");
    if(m[0] === "beheer" && m[1]) gevonden = decodeURIComponent(m[1]);
  });
  return (gevonden && /^[0-9a-f-]{36}$/i.test(gevonden)) ? gevonden : null;
}

function codeInLink(url, code){
  if(!code) return url;
  if(String(url).indexOf("ls=") > -1) return url;
  return url + (String(url).indexOf("#") > -1 ? "&" : "#") + "ls=" + code;
}

/* ============================================================
   Leerkracht
   ============================================================ */

function start(app, titel){
  return rpc("sessie_start", { p_app: app, p_titel: titel || null })
    .then(function(rijen){
      var r = rijen && rijen[0];
      if(!r || !r.code) throw new Error("sessie_niet_aangemaakt");
      var s = { code: r.code, beheer: r.beheer_token, app: app,
                titel: titel || null, datum: new Date().toISOString() };
      bewaarInArchief(s);
      zet(SLEUTEL_BEHEER, s);
      return s;
    });
}

/* ---------- archief: alle sessies van deze leerkracht ---------- */

/* Wat er in deze browser bewaard is. Blijft bestaan voor sessies van vóór
   de aanmelding, en dient als terugval zonder net. */
function lokaalArchief(){
  var l = haal(SLEUTEL_ARCHIEF);
  return (l && l.length) ? l : [];
}

/* Mijn sessies. Aangemeld komen ze uitsluitend van de server: wat deze
   browser toevallig onthield hoort niet in de lijst van wie er nu aangemeld
   is — op een gedeelde klaslaptop zou je dan de sessies van een collega zien.
   Niet aangemeld blijft het wat deze browser onthield. */
/* app is "taalkrak" of "rekenkrak": een leerkracht wil op de Rekenkrak-pagina
   haar rekensessies zien, niet die van spelling. Laat je het weg, dan krijg je
   alles. */
function filterApp(lijst, app){
  if(!app) return lijst;
  return lijst.filter(function(s){ return !s.app || s.app === app; });
}

function mijnSessies(app){
  if(!aangemeld()) return Promise.resolve(filterApp(lokaalArchief(), app));
  return rpc("mijn_sessies").then(function(lijst){ return filterApp(lijst || [], app); })
                            .catch(function(){ return []; });
}

/* Sessies die op dit toestel bewaard zijn maar (nog) geen eigenaar hebben —
   van vóór er aangemeld werd. */
function oudeSessies(app){ return aangemeld() ? filterApp(lokaalArchief(), app) : []; }

/* Die alsnog aan je account hangen. Wat van iemand anders blijkt te zijn of
   niet meer bestaat, verdwijnt gewoon uit deze browser. */
function koppelOudeSessies(){
  if(!aangemeld()) return Promise.resolve(0);
  var lijst = lokaalArchief();
  if(!lijst.length) return Promise.resolve(0);
  var aantal = 0;
  return lijst.reduce(function(ketting, s){
    return ketting.then(function(){
      return rpc("sessie_opeisen", { p_beheer_token: s.beheer })
        .then(function(ok){ if(ok) aantal++; })
        .catch(function(){});
    });
  }, Promise.resolve()).then(function(){
    zet(SLEUTEL_ARCHIEF, []);
    return aantal;
  });
}

/* Alleen wie niet aangemeld is heeft deze browseropslag nodig. Aangemeld
   staat de sessie op de server, en dan hoort ze niet in een lijst die op een
   gedeelde klaslaptop voor de volgende leerkracht blijft staan. */
function bewaarInArchief(s){
  if(aangemeld()) return;
  var l = lokaalArchief().filter(function(x){ return x.beheer !== s.beheer; });
  l.unshift(s);
  if(l.length > 50) l = l.slice(0, 50);
  zet(SLEUTEL_ARCHIEF, l);
}

function uitArchief(beheer){
  zet(SLEUTEL_ARCHIEF, lokaalArchief().filter(function(x){ return x.beheer !== beheer; }));
  var open = haal(SLEUTEL_BEHEER);
  if(open && open.beheer === beheer) wis(SLEUTEL_BEHEER);
}

function lopendeSessie(){
  var s = haal(SLEUTEL_BEHEER);
  return (s && s.beheer && s.code) ? s : null;
}

/* Een sessie uit het archief openen. */
function kiesSessie(beheerOfSessie){
  var s = beheerOfSessie;
  if(typeof beheerOfSessie === "string"){
    s = null;
    lokaalArchief().forEach(function(x){ if(x.beheer === beheerOfSessie) s = x; });
    if(!s) s = { beheer: beheerOfSessie, code: "····" };
  }
  if(s && s.beheer) zet(SLEUTEL_BEHEER, s);
  return s;
}

/* De open sessie sluiten. Ze blijft in het archief staan. */
function sluitSessie(){ wis(SLEUTEL_BEHEER); }

/* Alles van deze leerkracht op dit toestel wissen. */
function vergeetSessie(beheer){
  if(beheer) uitArchief(beheer);
  else { wis(SLEUTEL_BEHEER); wis(SLEUTEL_ARCHIEF); }
}

/* Link om te bookmarken of naar jezelf te mailen. Werkt op elk toestel. */
function beheerLink(basis, beheer){
  var b = beheer || (lopendeSessie() || {}).beheer;
  if(!b) return null;
  var u = String(basis || (typeof location !== "undefined" ? location.href : ""));
  u = u.split("#")[0];
  return u + "#beheer=" + b;
}

/* Staat er een beheer-token in de link? Dan die sessie ophalen en bewaren. */
function herstelUitLink(bron){
  var b = beheerUitHash(bron);
  if(!b) return Promise.resolve(null);
  return rpc("sessie_overzicht", { p_beheer_token: b }).then(function(ov){
    var s = { code: ov.code, beheer: b, app: ov.app,
              titel: ov.titel, datum: ov.aangemaakt_op };
    bewaarInArchief(s);
    zet(SLEUTEL_BEHEER, s);
    /* Hoort ze nog niemand toe en ben je aangemeld, dan wordt ze van jou. */
    if(aangemeld()) return rpc("sessie_opeisen", { p_beheer_token: b })
                      .catch(function(){ return false; }).then(function(){ return s; });
    return s;
  });
}

/* Volgende oefening starten. config is de instellingenhash van de app zelf,
   bv. "#g=1&th=hak&v=dictee&n=10&t=0&m=s". Geeft het rondenummer terug. */
function rondeStart(config){
  var s = lopendeSessie();
  if(!s) return Promise.reject(new Error("geen_sessie"));
  return rpc("ronde_start", { p_beheer_token: s.beheer, p_config: config });
}

function overzicht(){
  var s = lopendeSessie();
  if(!s) return Promise.resolve(null);
  return rpc("sessie_overzicht", { p_beheer_token: s.beheer })
    .catch(function(f){
      /* De sessie is uit de database verdwenen (opgekuist): vergeet ze ook hier. */
      if(f && f.message === "sessie_niet_gevonden"){ uitArchief(s.beheer); return null; }
      throw f;
    });
}

/* Blijft het overzicht ophalen tot je de teruggegeven functie aanroept. */
function volg(bij, fout, ms){
  var gestopt = false, timer = null, pauze = ms || 2000;
  function ronde(){
    overzicht()
      .then(function(stand){
        if(gestopt || !stand || !bij) return;
        try{ bij(stand); }
        catch(e){ setTimeout(function(){ throw e; }, 0); }
      })
      .catch(function(f){ if(!gestopt && fout) fout(f); })
      .then(function(){ if(!gestopt) timer = setTimeout(ronde, pauze); });
  }
  ronde();
  return function stop(){ gestopt = true; if(timer) clearTimeout(timer); };
}

function beeindig(){
  var s = lopendeSessie();
  if(!s) return Promise.resolve(false);
  return rpc("sessie_beeindigen", { p_beheer_token: s.beheer });
}

/* ============================================================
   Leerling
   ============================================================ */

/* Welke sessie deze leerling bezig is. Normaal staat de code in de link, maar
   ze kan ook ingetypt zijn — daarom onthouden we ze zodra ze bekend is, zodat
   de rest niet afhangt van wat er in de adresbalk staat. */
var actieveCode = null;

function deelname(code){
  var c = code || actieveCode || codeUitHash();
  if(!c) return null;
  c = String(c).toUpperCase();
  var d = haal(VOORVOEGSEL_DEELNAME + c);
  if(!d || !d.token) return null;
  actieveCode = c;
  return d;
}

function join(code, voornaam){
  var c = String(code || "").toUpperCase();
  return rpc("sessie_join", { p_code: c, p_voornaam: voornaam })
    .then(function(token){
      if(!token) throw new Error("geen_token");
      var d = { token: token, code: c, voornaam: voornaam };
      zet(VOORVOEGSEL_DEELNAME + c, d);
      actieveCode = c;
      return d;
    });
}

function verlaat(code){
  var c = code || actieveCode || codeUitHash();
  if(c) wis(VOORVOEGSEL_DEELNAME + String(c).toUpperCase());
  actieveCode = null;
  wachtend = null;
  if(duwTimer){ clearTimeout(duwTimer); duwTimer = null; }
}

/* Wat moet ik nu doen? Geeft {gevonden, actief, nummer, config}.
   nummer 0 betekent: aangesloten, maar de juf zette nog geen oefening klaar. */
function stand(){
  var d = deelname();
  if(!d) return Promise.resolve(null);
  return rpc("leerling_stand", { p_token: d.token })
    .catch(function(){ return null; });   /* netwerkhik: niets veranderen */
}

/* Roept bij() aan zodra er iets verandert: een nieuwe ronde, of de sessie die
   stopt. Niet bij elke poging — alleen bij een echte wijziging. */
function volgOpdracht(bij, ms){
  var gestopt = false, timer = null, vorige = null, pauze = ms || 2000;
  function ronde(){
    stand().then(function(st){
      if(gestopt || !st) return;
      var sleutel = !st.gevonden ? "weg" : (!st.actief ? "stop" : "r" + st.nummer);
      if(sleutel !== vorige){
        try{
          if(bij) bij(st);
          vorige = sleutel;          /* pas onthouden als de callback het overleefde */
        }catch(e){
          /* Niet stilhouden: zo'n fout hoort zichtbaar te zijn, en we blijven
             het proberen in plaats van voorgoed in de wachtkamer te blijven. */
          setTimeout(function(){ throw e; }, 0);
        }
      }
    }).catch(function(){}).then(function(){
      if(!gestopt) timer = setTimeout(ronde, pauze);
    });
  }
  ronde();
  return function stop(){ gestopt = true; if(timer) clearTimeout(timer); };
}

/* Voortgang doorsturen voor één ronde. Faalt nooit hoorbaar: een leerling
   zonder net moet gewoon verder kunnen oefenen. Hoogstens één oproep per
   seconde, behalve de eindstand en het wisselen van ronde — die gaan meteen. */
var laatsteDuw = 0, wachtend = null, duwTimer = null;

function meld(ronde, juist, totaal, klaar, fouten){
  var d = deelname();
  if(!d) return Promise.resolve(false);
  var nieuw = { token: d.token, ronde: ronde|0, juist: juist|0, totaal: totaal|0,
                klaar: !!klaar, fouten: (fouten && fouten.length) ? fouten : [] };

  /* Nog iets open staan van een andere ronde? Dat eerst wegschrijven,
     anders gaat de stand van de vorige oefening verloren. */
  if(wachtend && wachtend.ronde !== nieuw.ronde){
    if(duwTimer){ clearTimeout(duwTimer); duwTimer = null; }
    duw();
  }
  wachtend = nieuw;

  if(nieuw.klaar){
    if(duwTimer){ clearTimeout(duwTimer); duwTimer = null; }
    return duw();
  }
  var sinds = Date.now() - laatsteDuw;
  if(sinds >= 1000) return duw();
  if(!duwTimer) duwTimer = setTimeout(function(){ duwTimer = null; duw(); }, 1000 - sinds);
  return Promise.resolve(true);
}

/* Meteen wegschrijven wat er nog in de wachtrij staat. Handig vlak voor je
   van ronde wisselt: anders kan de laatste stand van de vorige oefening
   blijven hangen. */
function spoel(){
  if(duwTimer){ clearTimeout(duwTimer); duwTimer = null; }
  return duw();
}

function duw(){
  var p = wachtend;
  if(!p) return Promise.resolve(false);
  laatsteDuw = Date.now();
  return rpc("voortgang_bijwerken", {
    p_token: p.token, p_ronde: p.ronde,
    p_juist: p.juist, p_totaal: p.totaal, p_klaar: p.klaar, p_fouten: p.fouten
  }).catch(function(){ return false; });
}

/* ============================================================ */

return {
  ingesteld: ingesteld,
  codeUitHash: codeUitHash,
  codeInLink: codeInLink,

  aangemeld: aangemeld,
  gebruiker: gebruiker,
  haalGebruiker: haalGebruiker,
  aanmelden: aanmelden,
  afmelden: afmelden,
  verwerkAanmelding: verwerkAanmelding,

  start: start,
  rondeStart: rondeStart,
  lopendeSessie: lopendeSessie,
  mijnSessies: mijnSessies,
  oudeSessies: oudeSessies,
  koppelOudeSessies: koppelOudeSessies,
  kiesSessie: kiesSessie,
  sluitSessie: sluitSessie,
  vergeetSessie: vergeetSessie,
  beheerLink: beheerLink,
  beheerUitHash: beheerUitHash,
  herstelUitLink: herstelUitLink,
  overzicht: overzicht,
  volg: volg,
  beeindig: beeindig,

  join: join,
  deelname: deelname,
  verlaat: verlaat,
  stand: stand,
  volgOpdracht: volgOpdracht,
  meld: meld,
  spoel: spoel
};
})();

if(typeof module !== "undefined" && module.exports) module.exports = KrakSessie;
