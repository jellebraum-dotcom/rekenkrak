/* ============================================================
   Krak — "Meld een probleem"
   ------------------------------------------------------------
   Eén bestand, zelfvoorzienend: eigen opmaak, eigen venster, eigen
   verzending. Laad het na krak-config.js en zet ergens een knop met
   data-krak-melding, of roep KrakMelding.open() zelf op.

       <script src="krak-config.js"></script>
       <script src="krak-melding.js"></script>
       <button type="button" data-krak-melding>Meld een probleem</button>

   Wat de gebruiker invult:
     - e-mailadres   VERPLICHT, moet een geldig adres zijn
     - onderwerp     VERPLICHT
     - omschrijving  VERPLICHT, screenshots mogen erin geplakt worden
   De hele melding blijft onder 2 MB. Te grote afbeeldingen worden eerst
   automatisch verkleind; lukt dat niet, dan zegt het venster het.

   Waar het naartoe gaat — in te stellen via window.KRAK_MELDING:

     window.KRAK_MELDING = {
       app: "rekenkrak",          // welke app de melding stuurt
       wijze: "supabase",         // "supabase" (standaard) of "post"
       url: "",                   // bij wijze "post": het endpoint
       mailto: "jij@example.be"   // terugval als verzenden mislukt
     };

   Bij "supabase" gaat de melding naar de RPC-functie melding_nieuw van
   hetzelfde project als de klassessies — zie supabase-meldingen.sql.
   Bij "post" wordt dezelfde inhoud als JSON naar url ge-POST:

     { app, email, onderwerp, omschrijving, context, bijlagen:[
         { naam, type, bytes, data } ] }
   waarbij data de afbeelding is als base64, zonder data:-voorvoegsel.
   ============================================================ */

var KrakMelding = (function(){
"use strict";

var MAX_TOTAAL   = 2 * 1024 * 1024;   /* 2 MB voor de hele melding */
var MAX_BIJLAGEN = 6;
var MAX_ZIJDE    = 1600;              /* screenshots hierboven worden verkleind */

function cfg(){
  var c = (typeof window!=="undefined" && window.KRAK_MELDING) || {};
  return {
    app:    c.app    || "rekenkrak",
    wijze:  c.wijze  || "supabase",
    url:    c.url    || "",
    mailto: c.mailto || ""
  };
}

/* ---------- opmaak ----------
   Staat hier zodat dit bestand overal werkt, ook op een pagina die
   rekenkrak.css niet inlaadt. De kleuren komen uit de app als die er zijn. */
var CSS = [
".kmd-backdrop{position:fixed;inset:0;z-index:2000;background:rgba(30,26,20,.55);",
"  display:grid;place-items:center;padding:16px;overflow:auto;",
"  font-family:var(--font,ui-rounded,'Segoe UI',Roboto,system-ui,sans-serif);color:var(--ink,#2B2D42)}",
".kmd{background:var(--card,#fff);width:min(96vw,620px);border-radius:22px;padding:22px 22px 18px;",
"  box-shadow:0 20px 50px rgba(0,0,0,.28);max-height:94dvh;overflow:auto}",
".kmd h2{margin:0 0 2px;font-size:22px;font-weight:800;letter-spacing:-.02em}",
".kmd__sub{margin:0 0 16px;font-size:14px;font-weight:600;color:var(--ink-soft,#5A5C73);line-height:1.45}",
".kmd__veld{margin-bottom:14px}",
".kmd__label{display:block;font-weight:800;font-size:14.5px;margin:0 0 6px}",
".kmd__label i{font-style:normal;color:var(--berry,#E5566B)}",
".kmd input,.kmd textarea{width:100%;font:inherit;font-size:16px;padding:12px 14px;border-radius:13px;",
"  border:2px solid rgba(0,0,0,.12);background:#fff;color:inherit;display:block}",
".kmd textarea{min-height:130px;resize:vertical;line-height:1.5}",
".kmd input:focus,.kmd textarea:focus{outline:none;border-color:var(--sky,#46B8E8)}",
".kmd input[aria-invalid=true],.kmd textarea[aria-invalid=true]{border-color:var(--berry,#E5566B);background:#FFF6F7}",
".kmd__fout{display:block;margin-top:5px;font-size:13px;font-weight:700;color:var(--berry-deep,#C73B52)}",
".kmd__tip{margin:6px 0 0;font-size:12.5px;font-weight:600;color:var(--ink-soft,#5A5C73)}",
".kmd__beelden{display:flex;flex-wrap:wrap;gap:9px;margin-top:10px}",
".kmd__beeld{position:relative;width:96px;height:72px;border-radius:11px;overflow:hidden;",
"  border:1px solid rgba(0,0,0,.12);background:#F6EFE2}",
".kmd__beeld img{width:100%;height:100%;object-fit:cover;display:block}",
".kmd__weg{position:absolute;top:3px;right:3px;width:22px;height:22px;border-radius:50%;",
"  background:rgba(0,0,0,.62);color:#fff;font-size:13px;font-weight:800;line-height:22px;text-align:center;",
"  cursor:pointer;border:none;padding:0}",
".kmd__maat{display:flex;align-items:center;gap:9px;margin-top:10px;font-size:12.5px;font-weight:700;",
"  color:var(--ink-soft,#5A5C73)}",
".kmd__balk{flex:1;height:7px;border-radius:99px;background:#EFE6D6;overflow:hidden}",
".kmd__balk span{display:block;height:100%;width:0;border-radius:99px;background:var(--grass,#36A85B);",
"  transition:width .2s}",
".kmd__balk--vol span{background:var(--berry,#E5566B)}",
".kmd__knoppen{display:flex;gap:10px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap}",
".kmd__btn{border:none;border-radius:14px;font:inherit;font-weight:800;font-size:15.5px;padding:13px 20px;cursor:pointer}",
".kmd__btn--ok{background:linear-gradient(160deg,#41bd68,var(--grass-deep,#268043));color:#fff}",
".kmd__btn--ok:disabled{opacity:.55;cursor:not-allowed}",
".kmd__btn--weg{background:#F0E8D8;color:var(--ink-soft,#5A5C73)}",
".kmd__melding{margin-top:12px;padding:11px 14px;border-radius:12px;font-size:14px;font-weight:700;line-height:1.45}",
".kmd__melding--fout{background:#FDEDEF;color:var(--berry-deep,#C73B52)}",
".kmd__melding--ok{background:#EAF7EE;color:var(--grass-deep,#268043)}",
".kmd__klaar{text-align:center;padding:14px 4px 6px}",
".kmd__klaar .kmd__emo{font-size:60px;line-height:1}",
".kmd__klaar h2{margin-top:8px}",
".kmd__kenmerk{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;",
"  background:rgba(0,0,0,.05);border-radius:9px;padding:5px 10px;display:inline-block;margin-top:4px}",
".kmd__wat{margin-top:14px;font-size:12.5px;font-weight:600;color:var(--ink-soft,#5A5C73);line-height:1.5}",
".kmd__wat summary{cursor:pointer;font-weight:800}",
".kmd__wat ul{margin:6px 0 0;padding-left:18px}",
"@media (max-width:520px){.kmd{padding:18px 16px 14px}.kmd__knoppen .kmd__btn{flex:1}}"
].join("\n");

function zetOpmaak(){
  if(document.getElementById("kmd-css")) return;
  var s=document.createElement("style"); s.id="kmd-css"; s.textContent=CSS;
  document.head.appendChild(s);
}

/* ---------- kleine hulpjes ---------- */

function el(tag,klas,tekst){
  var e=document.createElement(tag);
  if(klas) e.className=klas;
  if(tekst!=null) e.textContent=tekst;
  return e;
}
function mb(bytes){ return (bytes/1048576).toFixed(2).replace(".",",")+" MB"; }

/* Bewust streng maar niet overdreven: één @, een punt in het domein, geen
   spaties. Strenger dan dit wijst echte adressen af. */
var EMAIL_RE=/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
function geldigEmail(v){ return EMAIL_RE.test(String(v||"").trim()) && String(v).length<=160; }

function base64(blob){
  return new Promise(function(res,rej){
    var fr=new FileReader();
    fr.onload=function(){ var s=String(fr.result); res(s.slice(s.indexOf(",")+1)); };
    fr.onerror=function(){ rej(new Error("lezen_mislukt")); };
    fr.readAsDataURL(blob);
  });
}

/* Screenshots van een digibord zijn al snel 3 MB. Eerst verkleinen tot
   MAX_ZIJDE en als JPEG opslaan; nog te groot, dan zakt de kwaliteit tot
   het past. Zo hoeft de gebruiker zelf niets te doen. */
function verklein(bestand, budget){
  return new Promise(function(res){
    if(!/^image\//.test(bestand.type) || bestand.type==="image/gif"){ res(bestand); return; }
    var url=URL.createObjectURL(bestand), img=new Image();
    img.onload=function(){
      var w=img.naturalWidth, h=img.naturalHeight;
      var f=Math.min(1, MAX_ZIJDE/Math.max(w,h));
      var c=document.createElement("canvas");
      c.width=Math.max(1,Math.round(w*f)); c.height=Math.max(1,Math.round(h*f));
      var ctx=c.getContext("2d");
      ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height);
      ctx.drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(url);
      var kwaliteiten=[0.85,0.7,0.55,0.4], i=0;
      (function volgende(){
        c.toBlob(function(b){
          if(!b){ res(bestand); return; }
          if(b.size<=budget || i>=kwaliteiten.length-1){ res(b); return; }
          i++; volgende();
        },"image/jpeg",kwaliteiten[i]);
      })();
    };
    img.onerror=function(){ URL.revokeObjectURL(url); res(bestand); };
    img.src=url;
  });
}

/* Wat er automatisch meegaat. Genoeg om een probleem na te bootsen, niets
   meer: geen namen, geen antwoorden, geen sessiegegevens. */
function context(){
  var c={
    pagina: location.pathname + (location.hash||""),
    tijd: new Date().toISOString(),
    scherm: (window.innerWidth||0)+"x"+(window.innerHeight||0),
    beeldpunten: (window.devicePixelRatio||1),
    taal: navigator.language||"",
    browser: navigator.userAgent||""
  };
  try{
    if(window.MK && typeof MK.buildHash==="function" && window.__krakLaatsteInstelling)
      c.instelling = MK.buildHash(window.__krakLaatsteInstelling);
  }catch(e){}
  return c;
}

/* ---------- verzenden ---------- */

function naarSupabase(melding){
  var K = window.KRAK_CONFIG;
  if(!K || !K.url || !K.sleutel) return Promise.reject(new Error("geen_verbinding"));
  var basis = String(K.url).trim().replace(/\/+$/,"").replace(/\/rest\/v1$/i,"").replace(/\/+$/,"");
  return fetch(basis+"/rest/v1/rpc/melding_nieuw",{
    method:"POST",
    headers:{ "Content-Type":"application/json", "Accept":"application/json",
              "apikey":K.sleutel, "Authorization":"Bearer "+K.sleutel },
    body: JSON.stringify({
      p_app: melding.app, p_email: melding.email, p_onderwerp: melding.onderwerp,
      p_omschrijving: melding.omschrijving, p_context: melding.context,
      p_bijlagen: melding.bijlagen
    })
  }).then(function(r){
    return r.text().then(function(t){
      var d=null; try{ d=t?JSON.parse(t):null; }catch(e){}
      if(!r.ok) throw new Error((d && (d.message||d.hint)) || ("http_"+r.status));
      return d;   /* het id van de melding */
    });
  });
}

function naarUrl(melding, url){
  return fetch(url,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(melding)
  }).then(function(r){
    return r.text().then(function(t){
      var d=null; try{ d=t?JSON.parse(t):null; }catch(e){}
      if(!r.ok) throw new Error((d && (d.message||d.fout)) || ("http_"+r.status));
      return (d && (d.id||d.kenmerk)) || null;
    });
  });
}

function verstuur(melding){
  var c=cfg();
  if(c.wijze==="post" && c.url) return naarUrl(melding, c.url);
  return naarSupabase(melding);
}

/* ---------- het venster ---------- */

var open_ = false;

function open(){
  if(open_) return;
  open_ = true;
  zetOpmaak();

  var bijlagen = [];          /* { blob, naam, type, url } */
  var vorigeFocus = document.activeElement;

  var achter = el("div","kmd-backdrop");
  var kader  = el("div","kmd");
  kader.setAttribute("role","dialog");
  kader.setAttribute("aria-modal","true");
  kader.setAttribute("aria-labelledby","kmd-titel");
  achter.appendChild(kader);

  kader.innerHTML =
    '<h2 id="kmd-titel">Een probleem melden</h2>'+
    '<p class="kmd__sub">Werkt er iets niet zoals het hoort? Laat het hier weten. '+
      'Hoe concreter, hoe sneller het opgelost raakt — een schermafbeelding helpt het meest.</p>'+

    '<div class="kmd__veld">'+
      '<label class="kmd__label" for="kmdMail">Je e-mailadres <i>*</i></label>'+
      '<input id="kmdMail" type="email" inputmode="email" autocomplete="email" '+
             'placeholder="naam@school.be" maxlength="160" required>'+
      '<span class="kmd__fout" id="kmdMailFout" hidden></span>'+
      '<p class="kmd__tip">Nodig om je een antwoord te kunnen sturen.</p>'+
    '</div>'+

    '<div class="kmd__veld">'+
      '<label class="kmd__label" for="kmdOnderwerp">Onderwerp <i>*</i></label>'+
      '<input id="kmdOnderwerp" type="text" maxlength="120" required '+
             'placeholder="Bijvoorbeeld: juist antwoord telt als fout">'+
      '<span class="kmd__fout" id="kmdOnderwerpFout" hidden></span>'+
    '</div>'+

    '<div class="kmd__veld">'+
      '<label class="kmd__label" for="kmdTekst">Wat loopt er mis? <i>*</i></label>'+
      '<textarea id="kmdTekst" maxlength="8000" required '+
                'placeholder="Wat deed je, wat verwachtte je, en wat gebeurde er? Plak hier gerust een schermafbeelding (Ctrl+V)."></textarea>'+
      '<span class="kmd__fout" id="kmdTekstFout" hidden></span>'+
      '<p class="kmd__tip">Schermafbeelding plakken met Ctrl+V (Cmd+V op een Mac), of het bestand hierin slepen. '+
        'Maximaal '+MAX_BIJLAGEN+' afbeeldingen.</p>'+
      '<div class="kmd__beelden" id="kmdBeelden"></div>'+
      '<div class="kmd__maat">'+
        '<span id="kmdMaatTekst">0,00 MB van 2,00 MB</span>'+
        '<span class="kmd__balk" id="kmdBalk"><span></span></span>'+
      '</div>'+
    '</div>'+

    '<details class="kmd__wat">'+
      '<summary>Wat wordt er meegestuurd?</summary>'+
      '<ul>'+
        '<li>je e-mailadres, het onderwerp en je tekst</li>'+
        '<li>de afbeeldingen die je zelf toevoegt</li>'+
        '<li>welke pagina open stond, de schermgrootte, de taal en het browsertype</li>'+
      '</ul>'+
      '<p style="margin:6px 0 0">Geen namen van leerlingen, geen antwoorden en geen klasgegevens.</p>'+
    '</details>'+

    '<div class="kmd__melding kmd__melding--fout" id="kmdAlarm" hidden></div>'+

    '<div class="kmd__knoppen">'+
      '<button type="button" class="kmd__btn kmd__btn--weg" id="kmdAnnuleer">Annuleren</button>'+
      '<button type="button" class="kmd__btn kmd__btn--ok" id="kmdVerstuur">Versturen</button>'+
    '</div>';

  document.body.appendChild(achter);
  document.body.style.overflow="hidden";

  var mail=kader.querySelector("#kmdMail"),
      onderwerp=kader.querySelector("#kmdOnderwerp"),
      tekst=kader.querySelector("#kmdTekst"),
      beelden=kader.querySelector("#kmdBeelden"),
      maatTekst=kader.querySelector("#kmdMaatTekst"),
      balk=kader.querySelector("#kmdBalk"),
      alarm=kader.querySelector("#kmdAlarm"),
      knopOk=kader.querySelector("#kmdVerstuur");

  setTimeout(function(){ try{ mail.focus(); }catch(e){} },40);

  /* ---- maat bijhouden ---- */
  function tekstBytes(){
    var ruw=(mail.value+onderwerp.value+tekst.value);
    try{ return new Blob([ruw]).size + 600; }catch(e){ return ruw.length + 600; }
  }
  function totaal(){
    var t=tekstBytes();
    bijlagen.forEach(function(b){ t += Math.ceil(b.blob.size*4/3); });
    return t;
  }
  function toonMaat(){
    var t=totaal(), deel=Math.min(1,t/MAX_TOTAAL);
    maatTekst.textContent = mb(t)+" van "+mb(MAX_TOTAAL);
    balk.firstElementChild.style.width=(deel*100)+"%";
    balk.classList.toggle("kmd__balk--vol", t>MAX_TOTAAL);
  }

  function toonBeelden(){
    beelden.innerHTML="";
    bijlagen.forEach(function(b,i){
      var vak=el("div","kmd__beeld");
      var img=el("img"); img.src=b.url; img.alt=b.naam||("afbeelding "+(i+1));
      var weg=el("button","kmd__weg","×");
      weg.type="button";
      weg.title="Deze afbeelding verwijderen";
      weg.setAttribute("aria-label","Afbeelding "+(i+1)+" verwijderen");
      weg.onclick=function(){
        try{ URL.revokeObjectURL(b.url); }catch(e){}
        bijlagen.splice(i,1); toonBeelden(); toonMaat();
      };
      vak.appendChild(img); vak.appendChild(weg);
      beelden.appendChild(vak);
    });
    toonMaat();
  }

  function zegFout(boodschap){
    alarm.textContent=boodschap;
    alarm.hidden=!boodschap;
  }

  /* ---- afbeeldingen toevoegen ---- */
  function voegToe(bestanden){
    var lijst=Array.prototype.slice.call(bestanden||[]).filter(function(f){
      return f && /^image\//.test(f.type);
    });
    if(!lijst.length) return;
    var waarschuwing="";
    if(bijlagen.length+lijst.length > MAX_BIJLAGEN){
      waarschuwing="Maximaal "+MAX_BIJLAGEN+" afbeeldingen per melding.";
      lijst=lijst.slice(0, Math.max(0, MAX_BIJLAGEN-bijlagen.length));
      if(!lijst.length){ zegFout(waarschuwing); return; }
    }
    var ruimte=Math.max(120*1024, MAX_TOTAAL-totaal());
    var budget=Math.floor(ruimte/lijst.length*0.72);   /* base64 kost ~1/3 extra */
    Promise.all(lijst.map(function(f){ return verklein(f,budget); })).then(function(blobs){
      blobs.forEach(function(b,i){
        bijlagen.push({ blob:b, naam:(lijst[i].name||"schermafbeelding.jpg"),
                        type:b.type||"image/jpeg", url:URL.createObjectURL(b) });
      });
      toonBeelden();
      if(totaal()>MAX_TOTAAL)
        zegFout("De melding is te groot ("+mb(totaal())+"). Verwijder een afbeelding of kort de tekst in.");
      else zegFout(waarschuwing);
    });
  }

  tekst.addEventListener("paste",function(e){
    var d=e.clipboardData; if(!d) return;
    var beeld=Array.prototype.slice.call(d.items||[]).filter(function(it){
      return it.kind==="file" && /^image\//.test(it.type);
    });
    if(!beeld.length) return;
    e.preventDefault();
    voegToe(beeld.map(function(it){ return it.getAsFile(); }));
  });
  ["dragover","drop"].forEach(function(naam){
    kader.addEventListener(naam,function(e){
      e.preventDefault();
      if(naam==="drop" && e.dataTransfer) voegToe(e.dataTransfer.files);
    });
  });
  [mail,onderwerp,tekst].forEach(function(v){ v.addEventListener("input",toonMaat); });
  toonMaat();

  /* ---- controleren ---- */
  function keur(veld, foutId, geldig, boodschap){
    var f=kader.querySelector("#"+foutId);
    veld.setAttribute("aria-invalid", geldig? "false":"true");
    f.textContent = geldig? "" : boodschap;
    f.hidden = geldig;
    return geldig;
  }
  function allesGeldig(){
    var a=keur(mail,"kmdMailFout", geldigEmail(mail.value),
               mail.value.trim()? "Dat lijkt geen geldig e-mailadres." : "Vul je e-mailadres in.");
    var b=keur(onderwerp,"kmdOnderwerpFout", onderwerp.value.trim().length>=3,
               "Geef een kort onderwerp (minstens 3 tekens).");
    var c=keur(tekst,"kmdTekstFout", tekst.value.trim().length>=10,
               "Beschrijf kort wat er misloopt (minstens 10 tekens).");
    if(!(a&&b&&c)) return false;
    toonMaat();
    if(totaal()>MAX_TOTAAL){
      zegFout("De melding is te groot ("+mb(totaal())+" van maximaal "+mb(MAX_TOTAAL)+"). "+
              "Verwijder een afbeelding of kort de tekst in.");
      return false;
    }
    zegFout("");
    return true;
  }
  mail.addEventListener("blur",function(){
    if(mail.value.trim()) keur(mail,"kmdMailFout",geldigEmail(mail.value),"Dat lijkt geen geldig e-mailadres.");
  });

  /* ---- sluiten ---- */
  function sluit(){
    if(!open_) return;
    open_=false;
    bijlagen.forEach(function(b){ try{ URL.revokeObjectURL(b.url); }catch(e){} });
    document.removeEventListener("keydown",opToets,true);
    achter.remove();
    document.body.style.overflow="";
    try{ if(vorigeFocus && vorigeFocus.focus) vorigeFocus.focus(); }catch(e){}
  }
  function opToets(e){
    if(e.key==="Escape"){ e.preventDefault(); sluit(); return; }
    if(e.key!=="Tab") return;
    var f=kader.querySelectorAll('input,textarea,button,summary,[tabindex]:not([tabindex="-1"])');
    if(!f.length) return;
    var eerste=f[0], laatste=f[f.length-1];
    if(e.shiftKey && document.activeElement===eerste){ e.preventDefault(); laatste.focus(); }
    else if(!e.shiftKey && document.activeElement===laatste){ e.preventDefault(); eerste.focus(); }
  }
  document.addEventListener("keydown",opToets,true);
  achter.addEventListener("mousedown",function(e){ if(e.target===achter) sluit(); });
  kader.querySelector("#kmdAnnuleer").onclick=sluit;

  /* ---- versturen ---- */
  knopOk.onclick=function(){
    if(!allesGeldig()) return;
    knopOk.disabled=true;
    knopOk.textContent="Bezig met versturen…";
    zegFout("");

    Promise.all(bijlagen.map(function(b){
      return base64(b.blob).then(function(d){
        return { naam:b.naam, type:b.type, bytes:b.blob.size, data:d };
      });
    })).then(function(bl){
      return verstuur({
        app: cfg().app,
        email: mail.value.trim(),
        onderwerp: onderwerp.value.trim(),
        omschrijving: tekst.value.trim(),
        context: context(),
        bijlagen: bl
      });
    }).then(function(id){
      toonDank(id);
    }).catch(function(err){
      knopOk.disabled=false;
      knopOk.textContent="Versturen";
      var reden=String(err && err.message || err);
      var uitleg = /geen_verbinding/.test(reden)
        ? "De verbinding met de server is niet ingesteld."
        : (/Failed to fetch|NetworkError|network/i.test(reden)
            ? "Geen verbinding met de server. Ben je online?"
            : "Er ging iets mis bij het versturen ("+reden+").");
      var c=cfg();
      if(c.mailto){
        zegFout(uitleg+" Je kan het opnieuw proberen, of je melding mailen.");
        toonMailKnop(c.mailto);
      } else {
        zegFout(uitleg+" Probeer het straks opnieuw.");
      }
    });
  };

  function toonMailKnop(adres){
    if(kader.querySelector("#kmdMailKnop")) return;
    var b=el("button","kmd__btn kmd__btn--weg","Mailen in plaats daarvan");
    b.type="button"; b.id="kmdMailKnop";
    b.onclick=function(){
      var lijf = tekst.value.trim()+
        "\n\n---\nAfzender: "+mail.value.trim()+
        "\nPagina: "+context().pagina+
        "\nScherm: "+context().scherm+
        "\nBrowser: "+context().browser+
        (bijlagen.length? "\n\n(Vergeet de "+bijlagen.length+" schermafbeelding(en) niet als bijlage toe te voegen.)" : "");
      location.href="mailto:"+adres+
        "?subject="+encodeURIComponent("[Rekenkrak] "+onderwerp.value.trim())+
        "&body="+encodeURIComponent(lijf);
    };
    knopOk.parentNode.insertBefore(b, knopOk);
  }

  function toonDank(id){
    kader.innerHTML=
      '<div class="kmd__klaar">'+
        '<div class="kmd__emo">✅</div>'+
        '<h2>Bedankt voor je melding!</h2>'+
        '<p class="kmd__sub">Ze is goed aangekomen. Je krijgt een antwoord op '+
          '<b>'+String(mail.value.trim()).replace(/[<>&]/g,"")+'</b>.</p>'+
        (id? '<div class="kmd__kenmerk">kenmerk '+String(id).slice(0,8)+'</div>' : '')+
      '</div>'+
      '<div class="kmd__knoppen">'+
        '<button type="button" class="kmd__btn kmd__btn--ok" id="kmdKlaar">Sluiten</button>'+
      '</div>';
    kader.querySelector("#kmdKlaar").onclick=sluit;
    kader.querySelector("#kmdKlaar").focus();
  }
}

/* ---------- knoppen op de pagina ---------- */
document.addEventListener("click",function(e){
  var k=e.target && e.target.closest && e.target.closest("[data-krak-melding]");
  if(k){ e.preventDefault(); open(); }
});

return { open:open, geldigEmail:geldigEmail, MAX:MAX_TOTAAL };

})();

if(typeof window!=="undefined") window.KrakMelding = KrakMelding;
