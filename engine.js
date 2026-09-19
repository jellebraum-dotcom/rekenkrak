/* =====================================================================
   Rekenkrak — gedeelde motor (engine).
   Bevat: parameters (URL), sommen voor + - x :, instellingen-UI,
   en de volledige speler (zelf oefenen + klassikaal samen oefenen).
   Wordt ingeladen in zowel index.html (leerling) als leerkracht.html.
   ===================================================================== */
(function(root){
"use strict";
var $=function(s,r){return (r||document).querySelector(s);};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
var reduced = (root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches) || false;

/* ---------- constanten ---------- */
var TIME_OPTS=[{v:0,l:"Geen"},{v:3,l:"3 sec"},{v:5,l:"5 sec"},{v:10,l:"10 sec"},{v:15,l:"15 sec"},{v:20,l:"20 sec"}];
var COUNT_OPTS=[{v:5,l:"5"},{v:10,l:"10"},{v:15,l:"15"},{v:20,l:"20"},{v:0,l:"∞"}];
/* l1:true betekent: hoort bij het eerste leerjaar en is elders niet zichtbaar. */
var RANGE_OPTS=[{v:6,l:"tot 6",l1:true},{v:10,l:"tot 10",l1:true},
                {v:20,l:"tot 20"},{v:100,l:"tot 100"},{v:1000,l:"tot 1000"}];
var RANGE_WAARDEN=RANGE_OPTS.map(function(o){return o.v;});
/* -6 en -10 zijn geen getallen om te splitsen, maar de keuzes "tot 6" en
   "tot 10": elke opgave splitst dan een willekeurig getal in dat bereik.
   Allebei horen ze bij het eerste leerjaar en staan ze daar alleen. */
var SPLIT_TOT6=-6, SPLIT_TOT10=-10;
var SPLIT_L1=[SPLIT_TOT6,SPLIT_TOT10];
var SPLIT_OPTS=[SPLIT_TOT6,SPLIT_TOT10,10,20,30,40,50,60,70,80,90,100];
function splitL1(v){ return SPLIT_L1.indexOf(v)>-1; }
function splitLabel(v){ return v===SPLIT_TOT6? "tot 6" : (v===SPLIT_TOT10? "tot 10" : String(v)); }
var OPS=[
  {id:"add",sym:"+",word:"Plus",tok:"a"},
  {id:"sub",sym:"−",word:"Min",tok:"s"},
  {id:"mul",sym:"×",word:"Keer",tok:"m"},
  {id:"div",sym:"÷",word:"Gedeeld",tok:"d"},
  {id:"split",sym:"⌂",word:"Splitsen",tok:"p"}
];
var TOK2OP={a:"add",s:"sub",m:"mul",d:"div",p:"split"};
var OP2TOK={add:"a",sub:"s",mul:"m",div:"d",split:"p"};
var FORM_LABEL={0:"Antwoord",1:"Eerste getal",2:"Tweede getal"};

function defaults(){ return {graad:2,jaar:0,domein:"bew",topics:[],ops:["mul"],tables:[2,5,10],range:100,splits:[10],forms:[0],rest:false,seconds:0,count:10,mode:"pad",session:"self"}; }

/* =====================================================================
   DOMEINEN — de vijf leergebieden van wiskunde in het lager onderwijs.
   Je kiest er telkens één; daarbinnen vink je onderwerpen aan. Zo blijft
   het scherm overzichtelijk, ook nu er veel meer leerstof in zit.
   ===================================================================== */
var GRAAD_LABEL={1:"1e graad (L1–L2)",2:"2e graad (L3–L4)",3:"3e graad (L5–L6)"};
/* De 1e graad is gesplitst in L1 en L2: alleen in L1 horen de kleinste
   bereiken thuis. jaar is 1 of 2 binnen de 1e graad, en 0 daarbuiten. */
var JAAR_LABEL={1:"1e leerjaar",2:"2e leerjaar"};
function niveauLabel(graad,jaar){
  return (graad===1 && JAAR_LABEL[jaar])? JAAR_LABEL[jaar] : GRAAD_LABEL[graad];
}
var DOMEINEN=[
  {id:"bew",   sym:"+−×÷", label:"Bewerkingen",   sub:"plus, min, keer, gedeeld, splitsen"},
  {id:"getal", sym:"123",  label:"Getallenkennis", sub:"tellen, ordenen, plaatswaarde"},
  {id:"breuk", sym:"½",    label:"Breuken & komma", sub:"breuken, kommagetallen, procent"},
  {id:"meten", sym:"📏",   label:"Meten",          sub:"lengte, gewicht, omtrek, oppervlakte"},
  {id:"mk",    sym:"△",    label:"Meetkunde",      sub:"vormen, hoeken, ruimtefiguren"}
];
function domeinById(id){ for(var i=0;i<DOMEINEN.length;i++) if(DOMEINEN[i].id===id) return DOMEINEN[i]; return DOMEINEN[0]; }

/* ---------- tekenhulpjes voor meten en meetkunde ---------- */
function figRect(l,b,unit){
  var w=150, h=Math.max(50,Math.round(150*b/Math.max(l,b)*0.7));
  return '<svg class="fig" viewBox="0 0 210 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+
    '<rect class="fig__shape" x="30" y="'+(25+(80-h)/2)+'" width="'+w+'" height="'+h+'" rx="4"/>'+
    '<text class="fig__lbl" x="'+(30+w/2)+'" y="18">'+l+' '+unit+'</text>'+
    '<text class="fig__lbl" x="16" y="'+(25+(80-h)/2+h/2)+'" transform="rotate(-90 16 '+(25+(80-h)/2+h/2)+')">'+b+' '+unit+'</text>'+
    '</svg>';
}
function figTri(b,h,unit){
  return '<svg class="fig" viewBox="0 0 210 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+
    '<polygon class="fig__shape" points="35,105 185,105 110,25"/>'+
    '<line class="fig__help" x1="110" y1="25" x2="110" y2="105"/>'+
    '<text class="fig__lbl" x="110" y="122">'+b+' '+unit+'</text>'+
    '<text class="fig__lbl" x="122" y="68">'+h+' '+unit+'</text>'+
    '</svg>';
}
var SHAPES={
  vierkant:'<rect class="fig__shape" x="65" y="20" width="80" height="80" rx="3"/>',
  rechthoek:'<rect class="fig__shape" x="35" y="30" width="140" height="60" rx="3"/>',
  driehoek:'<polygon class="fig__shape" points="35,100 175,100 105,20"/>',
  cirkel:'<circle class="fig__shape" cx="105" cy="60" r="45"/>',
  vijfhoek:'<polygon class="fig__shape" points="105,18 160,58 139,100 71,100 50,58"/>',
  zeshoek:'<polygon class="fig__shape" points="65,20 145,20 175,60 145,100 65,100 35,60"/>'
};
function figShape(name){
  return '<svg class="fig" viewBox="0 0 210 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+(SHAPES[name]||"")+'</svg>';
}
function figAngle(deg){
  var a=(-deg)*Math.PI/180;
  return '<svg class="fig" viewBox="0 0 210 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+
    '<line class="fig__ray" x1="40" y1="95" x2="185" y2="95"/>'+
    '<line class="fig__ray" x1="40" y1="95" x2="'+(40+145*Math.cos(a)).toFixed(1)+'" y2="'+(95+145*Math.sin(a)).toFixed(1)+'"/>'+
    '<path class="fig__arc" d="M 75 95 A 35 35 0 0 1 '+(40+35*Math.cos(a)).toFixed(1)+' '+(95+35*Math.sin(a)).toFixed(1)+'" fill="none"/>'+
    '</svg>';
}

/* ---------- generatoren per onderwerp ----------
   Elk onderwerp levert: {gen:true, prompt, answer, unit, choices?, fig?, key} */
function G(prompt,answer,extra){
  var q={gen:true, prompt:prompt, answer:answer, key:prompt};
  if(extra) for(var k in extra) q[k]=extra[k];
  return q;
}
/* keuzes samenstellen: het juiste antwoord plus afleiders, nooit twee keer
   dezelfde knop (reserve-afleiders vullen aan waar nodig) */
function shuffle4(correct, wrongs, reserve){
  var out=[String(correct)];
  (wrongs||[]).forEach(function(w){ w=String(w); if(out.length<4 && out.indexOf(w)===-1) out.push(w); });
  (reserve||[]).forEach(function(w){ w=String(w); if(out.length<4 && out.indexOf(w)===-1) out.push(w); });
  return shuffle(out);
}
/* kommagetal in Nederlandse schrijfwijze, zonder drijvende-kommaruis */
function kommaStr(x){ return (Math.round(x*10000)/10000).toString().replace(".",","); }

var TOPICS={
getal:{
 1:[
  {id:"buur", label:"Buurgetallen", sub:"na 39 komt …", gen:function(c){
    var n=rnd(2,c.graad===1?99:999), na=Math.random()<0.5;
    return G("Welk getal komt vlak "+(na?"na":"voor")+" "+n+"?", na?n+1:n-1, {key:"buur"+n+na});
  }},
  {id:"tussen", label:"Getal ertussen", sub:"tussen 45 en 47", gen:function(c){
    var n=rnd(2,98);
    return G("Welk getal ligt tussen "+(n-1)+" en "+(n+1)+"?", n, {key:"tus"+n});
  }},
  {id:"vgl", label:"Groter of kleiner?", sub:"34 ? 43", gen:function(c){
    var a=rnd(1,99), b=rnd(1,99);
    return G("Vergelijk: "+a+" ⬚ "+b, a<b?"<":(a>b?">":"="), {choices:["<",">","="], key:"vgl"+a+"_"+b});
  }},
  {id:"even", label:"Even of oneven?", sub:"47 is oneven", gen:function(c){
    var n=rnd(1,99);
    return G("Is "+n+" even of oneven?", n%2===0?"even":"oneven", {choices:["even","oneven"], key:"ev"+n});
  }},
  {id:"pw1", label:"Tientallen en eenheden", sub:"in 47 zitten 4 T", gen:function(c){
    var n=rnd(11,99), t=Math.random()<0.5;
    return G("Hoeveel "+(t?"tientallen":"eenheden")+" heeft "+n+"?", t?Math.floor(n/10):n%10, {key:"pw1"+n+t});
  }}
 ],
 2:[
  {id:"buur", label:"Buurgetallen", sub:"na 899 komt …", gen:function(c){
    var n=rnd(100,9998), na=Math.random()<0.5;
    return G("Welk getal komt vlak "+(na?"na":"voor")+" "+n+"?", na?n+1:n-1, {key:"buur"+n+na});
  }},
  {id:"vgl", label:"Groter of kleiner?", sub:"1345 ? 1354", gen:function(c){
    var a=rnd(100,9999), b=Math.random()<0.5? a+pick([-9,-1,1,9,90]) : rnd(100,9999);
    if(b<0) b=rnd(100,9999);
    return G("Vergelijk: "+a+" ⬚ "+b, a<b?"<":(a>b?">":"="), {choices:["<",">","="], key:"vgl"+a+"_"+b});
  }},
  {id:"pw2", label:"Plaatswaarde", sub:"3482 → 4 honderdtallen", gen:function(c){
    var n=rnd(1000,9999);
    var k=pick([["duizendtallen",1000],["honderdtallen",100],["tientallen",10],["eenheden",1]]);
    return G("Hoeveel "+k[0]+" heeft "+n+"?", Math.floor(n/k[1])%10, {key:"pw2"+n+k[0]});
  }},
  {id:"afr", label:"Afronden", sub:"op tien of honderd", gen:function(c){
    var n=rnd(105,9994);
    var k=pick([["tiental",10],["honderdtal",100]]);
    return G("Rond "+n+" af op het "+k[0]+".", Math.round(n/k[1])*k[1], {key:"afr"+n+k[0]});
  }},
  {id:"even", label:"Even of oneven?", sub:"1348 is even", gen:function(c){
    var n=rnd(100,9999);
    return G("Is "+n+" even of oneven?", n%2===0?"even":"oneven", {choices:["even","oneven"], key:"ev"+n});
  }}
 ],
 3:[
  {id:"pw3", label:"Plaatswaarde grote getallen", sub:"348512 → 8 tienduizendtallen", gen:function(c){
    var n=rnd(100000,999999);
    var k=pick([["honderdduizendtallen",100000],["tienduizendtallen",10000],["duizendtallen",1000],["honderdtallen",100]]);
    return G("Hoeveel "+k[0]+" heeft "+n+"?", Math.floor(n/k[1])%10, {key:"pw3"+n+k[0]});
  }},
  {id:"afr3", label:"Afronden", sub:"op duizend", gen:function(c){
    var n=rnd(10050,994499);   /* hoger rondt af op 1000000: 7 cijfers, niet in te tikken */
    var k=pick([["honderdtal",100],["duizendtal",1000],["tienduizendtal",10000]]);
    return G("Rond "+n+" af op het "+k[0]+".", Math.round(n/k[1])*k[1], {key:"afr3"+n+k[0]});
  }},
  {id:"deelb", label:"Deelbaarheid", sub:"deelbaar door 3?", gen:function(c){
    var d=pick([2,3,5,9,10]), n=rnd(100,999);
    return G("Is "+n+" deelbaar door "+d+"?", n%d===0?"ja":"nee", {choices:["ja","nee"], key:"db"+n+"_"+d});
  }},
  {id:"neg", label:"Negatieve getallen", sub:"3 − 8 = −5", gen:function(c){
    var a=rnd(1,9), b=rnd(a+1,15), r=a-b;
    return G(a+" − "+b+" = ⬚", String(r),
      {choices:shuffle4(r, [b-a, r-1, r+2], [r-2, r+1, b+a]), key:"neg"+a+"_"+b});
  }},
  {id:"vgl3", label:"Ordenen", sub:"grootste getal", gen:function(c){
    var s=[rnd(1000,99999),rnd(1000,99999),rnd(1000,99999)];
    while(s[0]===s[1]||s[1]===s[2]||s[0]===s[2]) s=[rnd(1000,99999),rnd(1000,99999),rnd(1000,99999)];
    var grootste=Math.random()<0.5;
    var a=grootste? Math.max.apply(null,s) : Math.min.apply(null,s);
    return G("Welk getal is het "+(grootste?"grootst":"kleinst")+"?", String(a),
      {choices:shuffle(s.map(String)), key:"ord"+s.join("_")+grootste});
  }}
 ]
},
breuk:{
 2:[
  {id:"deelvan", label:"Deel van een getal", sub:"3/4 van 20", gen:function(c){
    var n=pick([2,3,4,5]), t=rnd(1,n-1)||1, tot=n*rnd(2,6);
    return G(t+"/"+n+" van "+tot+" = ⬚", tot/n*t, {key:"dv"+t+n+tot});
  }},
  {id:"gelijkw", label:"Gelijkwaardige breuken", sub:"1/2 = ?/8", gen:function(c){
    var n=pick([2,3,4,5]), t=rnd(1,n-1)||1, f=rnd(2,4);
    return G(t+"/"+n+" = ⬚/"+(n*f), t*f, {key:"gw"+t+n+f});
  }},
  {id:"breukvgl", label:"Welke breuk is groter?", sub:"2/3 of 3/5", gen:function(c){
    var a=[rnd(1,4),rnd(2,6)], b=[rnd(1,4),rnd(2,6)];
    while(a[0]>=a[1]) a=[rnd(1,4),rnd(2,6)];
    while(b[0]>=b[1] || a[0]/a[1]===b[0]/b[1]) b=[rnd(1,4),rnd(2,6)];
    var A=a[0]+"/"+a[1], B=b[0]+"/"+b[1];
    return G("Welke breuk is het grootst?", (a[0]/a[1]>b[0]/b[1])?A:B, {choices:shuffle([A,B]), key:"bv"+A+B});
  }},
  {id:"kommalees", label:"Kommagetallen ordenen", sub:"0,7 of 0,25", gen:function(c){
    var s=[]; while(s.length<3){ var v=(rnd(1,99)/(pick([10,100]))).toFixed(2).replace(/0$/,"");
      if(s.indexOf(v)===-1) s.push(v); }
    var nums=s.map(Number), grootste=Math.random()<0.5;
    var w=grootste? Math.max.apply(null,nums) : Math.min.apply(null,nums);
    var ans=s[nums.indexOf(w)];
    return G("Welk getal is het "+(grootste?"grootst":"kleinst")+"?", ans.replace(".",","),
      {choices:shuffle(s.map(function(x){return x.replace(".",",");})), key:"kl"+s.join("_")+grootste});
  }}
 ],
 3:[
  {id:"breukoptel", label:"Breuken optellen", sub:"1/5 + 2/5", gen:function(c){
    var n=pick([4,5,6,8,10]), a=rnd(1,n-2), b=rnd(1,n-a-1)||1;
    return G(a+"/"+n+" + "+b+"/"+n+" = ⬚/"+n, a+b, {key:"bo"+a+b+n});
  }},
  {id:"vereenv", label:"Breuken vereenvoudigen", sub:"6/8 = 3/4", gen:function(c){
    var basis=pick([[1,2],[1,3],[2,3],[1,4],[3,4],[1,5],[2,5],[3,5]]), f=rnd(2,4);
    var t=basis[0]*f, n=basis[1]*f, ans=basis[0]+"/"+basis[1];
    var w=[t+"/"+(n*2), (basis[0]*2)+"/"+basis[1], basis[0]+"/"+(basis[1]*2)].filter(function(x){return x!==ans;});
    return G("Vereenvoudig "+t+"/"+n+" zo ver mogelijk.", ans, {choices:shuffle4(ans,w.slice(0,3)), key:"ve"+t+n});
  }},
  {id:"breukkomma", label:"Breuk naar kommagetal", sub:"1/4 = 0,25", gen:function(c){
    var m=pick([[1,2,"0,5"],[1,4,"0,25"],[3,4,"0,75"],[1,5,"0,2"],[2,5,"0,4"],[3,5,"0,6"],[1,10,"0,1"],[7,10,"0,7"]]);
    var w=["0,15","0,45","0,05","0,8","0,35","0,9"].filter(function(x){return x!==m[2];});
    return G(m[0]+"/"+m[1]+" = ⬚ (als kommagetal)", m[2], {choices:shuffle4(m[2], shuffle(w).slice(0,3)), key:"bk"+m[0]+m[1]});
  }},
  {id:"kommamaal", label:"Kommagetal × 10, 100", sub:"3,5 × 10", gen:function(c){
    var dec=pick([1,2]);
    var v=rnd(11, dec===1?99:999)/Math.pow(10,dec);
    var f=pick([10,100,1000]);
    var ans=kommaStr(v*f);
    return G(kommaStr(v)+" × "+f+" = ⬚", ans,
      {choices:shuffle4(ans, [kommaStr(v*f*10), kommaStr(v*f/10), kommaStr(v)],
                             [kommaStr(v*f/100), kommaStr(v*f*100)]),
       key:"km"+kommaStr(v)+"x"+f});
  }},
  {id:"procent", label:"Procent van een getal", sub:"10% van 250", gen:function(c){
    var p=pick([10,20,25,50,75]), tot=pick([20,40,60,80,100,200,250,400]);
    return G(p+"% van "+tot+" = ⬚", Math.round(tot*p/100), {key:"pc"+p+tot});
  }},
  {id:"verhoud", label:"Verhoudingen", sub:"3 stuks → 6 stuks", gen:function(c){
    var n=rnd(2,6), prijs=rnd(2,9), f=rnd(2,4);
    return G(n+" broden kosten "+(n*prijs)+" euro. Hoeveel kosten "+(n*f)+" broden?", n*prijs*f, {unit:"euro", key:"vh"+n+prijs+f});
  }}
 ]
},
meten:{
 1:[
  {id:"geld1", label:"Geld teruggeven", sub:"betalen met €20", gen:function(c){
    var prijs=rnd(2,18), betaald=pick([10,20]);
    if(prijs>=betaald) prijs=rnd(2,betaald-1);
    return G("Je koopt iets van "+prijs+" euro en betaalt met "+betaald+" euro. Hoeveel krijg je terug?", betaald-prijs, {unit:"euro", key:"gl"+prijs+betaald});
  }},
  {id:"lengte1", label:"Meter en centimeter", sub:"2 m = 200 cm", gen:function(c){
    var m=rnd(1,9);
    return G(m+" m = ⬚ cm", m*100, {unit:"cm", key:"le1"+m});
  }},
  {id:"tijd1", label:"Tijdmaten", sub:"1 uur = 60 minuten", gen:function(c){
    var k=pick([["uur","minuten",60],["dag","uur",24],["week","dagen",7],["minuut","seconden",60]]);
    var n=rnd(2,6);
    return G(n+" "+k[0]+(n>1?(k[0]==="uur"?"":"en"):"")+" = ⬚ "+k[1], n*k[2], {unit:k[1], key:"tm1"+k[0]+n});
  }}
 ],
 2:[
  {id:"lengte2", label:"Lengtematen omzetten", sub:"3 km = 3000 m", gen:function(c){
    var k=pick([["km","m",1000],["m","cm",100],["m","dm",10],["cm","mm",10],["dm","cm",10]]);
    var n=rnd(2,9);
    return G(n+" "+k[0]+" = ⬚ "+k[1], n*k[2], {unit:k[1], key:"le2"+k[0]+n});
  }},
  {id:"gewicht", label:"Gewicht omzetten", sub:"2 kg = 2000 g", gen:function(c){
    var k=pick([["kg","g",1000],["ton","kg",1000]]);
    var n=rnd(2,9);
    return G(n+" "+k[0]+" = ⬚ "+k[1], n*k[2], {unit:k[1], key:"gw"+k[0]+n});
  }},
  {id:"inhoud", label:"Inhoud omzetten", sub:"5 l = 50 dl", gen:function(c){
    var k=pick([["l","dl",10],["l","cl",100],["l","ml",1000],["dl","cl",10],["cl","ml",10]]);
    var n=rnd(2,9);
    return G(n+" "+k[0]+" = ⬚ "+k[1], n*k[2], {unit:k[1], key:"ih"+k[0]+n});
  }},
  {id:"omtrek", label:"Omtrek berekenen", sub:"rechthoek", gen:function(c){
    var l=rnd(3,15), b=rnd(2,l-1)||2;
    return G("Bereken de omtrek van deze rechthoek.", 2*(l+b), {unit:"cm", fig:figRect(l,b,"cm"), key:"om"+l+"_"+b});
  }},
  {id:"omtrekv", label:"Omtrek van een vierkant", sub:"zijde 7 cm", gen:function(c){
    var z=rnd(2,20);
    return G("Een vierkant heeft zijden van "+z+" cm. Wat is de omtrek?", 4*z, {unit:"cm", fig:figShape("vierkant"), key:"omv"+z});
  }}
 ],
 3:[
  {id:"opprecht", label:"Oppervlakte rechthoek", sub:"lengte × breedte", gen:function(c){
    var l=rnd(3,15), b=rnd(2,12);
    return G("Bereken de oppervlakte van deze rechthoek.", l*b, {unit:"cm²", fig:figRect(l,b,"cm"), key:"or"+l+"_"+b});
  }},
  {id:"oppdrie", label:"Oppervlakte driehoek", sub:"(basis × hoogte) : 2", gen:function(c){
    var b=pick([4,6,8,10,12,14,16]), h=rnd(3,12);
    return G("Bereken de oppervlakte van deze driehoek.", b*h/2, {unit:"cm²", fig:figTri(b,h,"cm"), key:"od"+b+"_"+h});
  }},
  {id:"volume", label:"Volume van een balk", sub:"l × b × h", gen:function(c){
    var l=rnd(2,9), b=rnd(2,8), h=rnd(2,7);
    return G("Een balk is "+l+" cm lang, "+b+" cm breed en "+h+" cm hoog. Wat is het volume?", l*b*h, {unit:"cm³", key:"vol"+l+b+h});
  }},
  {id:"omzet3", label:"Maten omzetten", sub:"alle eenheden", gen:function(c){
    var k=pick([["km","m",1000],["m","mm",1000],["kg","g",1000],["l","ml",1000],["m²","dm²",100],["uur","seconden",3600]]);
    var n=rnd(2,9);
    return G(n+" "+k[0]+" = ⬚ "+k[1], n*k[2], {unit:k[1], key:"oz"+k[0]+n});
  }},
  {id:"schaal", label:"Schaal", sub:"1 cm = 100 m", gen:function(c){
    var s=pick([100,1000,10000]), cm=rnd(2,9);
    return G("Op een kaart is de schaal 1 cm = "+s+" m. Hoeveel meter is "+cm+" cm in het echt?", cm*s, {unit:"m", key:"sc"+s+cm});
  }}
 ]
},
mk:{
 1:[
  {id:"vorm", label:"Vormen herkennen", sub:"vierkant · cirkel", gen:function(c){
    var n=pick(["vierkant","rechthoek","driehoek","cirkel"]);
    var w=["vierkant","rechthoek","driehoek","cirkel"].filter(function(x){return x!==n;});
    return G("Welke vorm is dit?", n, {choices:shuffle4(n,w.slice(0,3)), fig:figShape(n), key:"vorm"+n});
  }},
  {id:"zijden", label:"Hoeveel zijden?", sub:"driehoek → 3", gen:function(c){
    var m=pick([["driehoek",3],["vierkant",4],["rechthoek",4],["vijfhoek",5],["zeshoek",6]]);
    return G("Hoeveel zijden heeft een "+m[0]+"?", m[1], {fig:figShape(m[0]), key:"zij"+m[0]});
  }},
  {id:"hoekjes", label:"Hoeveel hoeken?", sub:"vierkant → 4", gen:function(c){
    var m=pick([["driehoek",3],["vierkant",4],["rechthoek",4],["vijfhoek",5],["zeshoek",6]]);
    return G("Hoeveel hoeken heeft een "+m[0]+"?", m[1], {fig:figShape(m[0]), key:"hkj"+m[0]});
  }},
  {id:"ruimte1", label:"Vormen om je heen", sub:"voetbal → bol", gen:function(c){
    var m=pick([["een voetbal","bol"],["een dobbelsteen","kubus"],["een blikje soep","cilinder"],
                ["een schoendoos","balk"],["een verkeerskegel","kegel"],["een knikker","bol"],
                ["een suikerklontje","kubus"],["een wc-rol","cilinder"]]);
    var w=["bol","kubus","cilinder","balk","kegel"].filter(function(x){return x!==m[1];});
    return G("Welke vorm heeft "+m[0]+"?", m[1], {choices:shuffle4(m[1], shuffle(w).slice(0,3)), key:"rv"+m[0]});
  }}
 ],
 2:[
  {id:"hoek", label:"Soorten hoeken", sub:"recht · scherp · stomp", gen:function(c){
    var m=pick([[90,"een rechte hoek"],[rnd(20,75),"een scherpe hoek"],[rnd(105,160),"een stompe hoek"]]);
    return G("Wat voor hoek is dit?", m[1], {choices:shuffle(["een rechte hoek","een scherpe hoek","een stompe hoek"]), fig:figAngle(m[0]), key:"hk"+m[0]});
  }},
  {id:"ruimte", label:"Ruimtefiguren", sub:"kubus → 12 ribben", gen:function(c){
    var m=pick([["kubus","ribben",12],["kubus","vlakken",6],["kubus","hoekpunten",8],
                ["balk","ribben",12],["balk","vlakken",6],["balk","hoekpunten",8],
                ["driezijdige piramide","vlakken",4]]);
    return G("Hoeveel "+m[1]+" heeft een "+m[0]+"?", m[2], {key:"rf"+m[0]+m[1]});
  }},
  {id:"symm", label:"Symmetrieassen", sub:"vierkant → 4", gen:function(c){
    var m=pick([["vierkant",4],["rechthoek",2],["cirkel",null],["gelijkzijdige driehoek",3]]);
    if(m[1]===null) m=["vierkant",4];
    return G("Hoeveel symmetrieassen heeft een "+m[0]+"?", m[1], {key:"sy"+m[0]});
  }},
  {id:"evenwijdig", label:"Evenwijdig of loodrecht?", sub:"⊥ of ∥", gen:function(c){
    var lood=Math.random()<0.5;
    return G(lood? "Twee lijnen maken een rechte hoek met elkaar. Hoe noem je dat?"
                 : "Twee lijnen lopen naast elkaar en raken elkaar nooit. Hoe noem je dat?",
             lood?"loodrecht":"evenwijdig", {choices:["evenwijdig","loodrecht"], key:"ew"+lood});
  }}
 ],
 3:[
  {id:"driehoek", label:"Soorten driehoeken", sub:"gelijkzijdig · rechthoekig", gen:function(c){
    var m=pick([["drie gelijke zijden","gelijkzijdig"],["twee gelijke zijden","gelijkbenig"],["een rechte hoek","rechthoekig"]]);
    return G("Een driehoek met "+m[0]+" noem je …", m[1],
      {choices:shuffle(["gelijkzijdig","gelijkbenig","rechthoekig"]), key:"dh"+m[1]});
  }},
  {id:"vierhoek", label:"Soorten vierhoeken", sub:"vierkant · ruit · trapezium", gen:function(c){
    var m=pick([["vier gelijke zijden en vier rechte hoeken","vierkant"],
                ["twee paar evenwijdige zijden en vier rechte hoeken","rechthoek"],
                ["vier gelijke zijden zonder rechte hoeken","ruit"],
                ["precies één paar evenwijdige zijden","trapezium"]]);
    return G("Een vierhoek met "+m[0]+" noem je …", m[1],
      {choices:shuffle4(m[1],["vierkant","rechthoek","ruit","trapezium"].filter(function(x){return x!==m[1];}).slice(0,3)), key:"vh"+m[1]});
  }},
  {id:"hoeksom", label:"Hoeken berekenen", sub:"som = 180°", gen:function(c){
    var a=rnd(30,80), b=rnd(30,180-a-20);
    return G("Twee hoeken van een driehoek zijn "+a+"° en "+b+"°. Hoe groot is de derde hoek?", 180-a-b, {unit:"°", key:"hs"+a+"_"+b});
  }},
  {id:"cirkel", label:"Straal en middellijn", sub:"r → d", gen:function(c){
    var r=rnd(2,20), naarD=Math.random()<0.5;
    return G(naarD? "Een cirkel heeft een straal van "+r+" cm. Hoe groot is de middellijn?"
                  : "Een cirkel heeft een middellijn van "+(r*2)+" cm. Hoe groot is de straal?",
             naarD? r*2 : r, {unit:"cm", fig:figShape("cirkel"), key:"ci"+r+naarD});
  }}
 ]
}
};
function topicsFor(domein,graad){
  if(domein==="bew") return [];
  var d=TOPICS[domein]||{};
  return d[graad]||[];
}
function topicById(domein,graad,id){
  var l=topicsFor(domein,graad);
  for(var i=0;i<l.length;i++) if(l[i].id===id) return l[i];
  return null;
}

/* ---------- helpers ---------- */
function rnd(a,b){return a+Math.floor(Math.random()*(b-a+1));}
function pick(a){return a[Math.floor(Math.random()*a.length)];}
function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}

/* =====================================================================
   URL <-> instellingen
   ===================================================================== */
function buildHash(c){
  return "#g="+c.graad+"&j="+(c.jaar||0)+"&d="+c.domein+
         "&o="+c.ops.map(function(o){return OP2TOK[o];}).join(",")+
         "&t="+c.tables.join(",")+
         "&r="+c.range+
         "&sp="+c.splits.join(",")+
         "&f="+c.forms.join(",")+
         "&rest="+(c.rest?1:0)+
         "&tp="+(c.topics||[]).join(",")+
         "&s="+c.seconds+"&n="+c.count+"&m="+c.mode+"&k="+(c.session==="class"?1:0);
}
function parseParams(str){
  if(!str) return null;
  var h = str.indexOf("#")>-1 ? str.substring(str.indexOf("#")+1) : str.replace(/^\?/,"");
  if(h.indexOf("t=")<0 && h.indexOf("o=")<0) return null;
  var p={}; h.split("&").forEach(function(kv){var a=kv.split("=");p[a[0]]=a[1];});
  function nums(s){return (s||"").split(",").map(Number).filter(function(n){return !isNaN(n);});}
  var ops=(p.o||"").split(",").map(function(t){return TOK2OP[t];}).filter(Boolean);
  if(!ops.length) ops=["mul"]; // terugwaarts compatibel met oude maaltafel-links
  var c={
    ops:ops,
    tables:nums(p.t).filter(function(n){return n>=1&&n<=10;}),
    range:RANGE_WAARDEN.indexOf(parseInt(p.r,10))>-1?parseInt(p.r,10):100,
    splits:nums(p.sp).filter(function(n){return SPLIT_OPTS.indexOf(n)>-1;}),
    forms:nums(p.f).filter(function(n){return n>=0&&n<=2;}),
    rest:(p.rest==="1"),
    seconds:Math.max(0,parseInt(p.s,10)||0),
    count:Math.max(0,parseInt(p.n,10)||10),
    mode:(p.m==="mc"?"mc":"pad"),
    session:(p.k==="1"?"class":"self")
  };
  if(!c.tables.length) c.tables=[2,5,10];
  if(!c.splits.length) c.splits=[10];
  if(!c.forms.length) c.forms=[0];
  if(c.rest && c.mode==="mc") c.mode="pad";
  /* Nieuw sinds de uitbreiding: graad, domein en onderwerpen.
     Oudere QR-codes en links bevatten die niet — die blijven gewoon werken
     en worden als een bewerkingen-oefening geopend. */
  var g=parseInt(p.g,10);
  c.graad=(g===1||g===2||g===3)? g : (c.range<=20?1:(c.range>=1000?3:2));
  /* Oudere links kennen j nog niet: een klein bereik wijst dan op L1. */
  var j=parseInt(p.j,10);
  c.jaar=(c.graad===1)? ((j===1||j===2)? j : (c.range<=10?1:2)) : 0;
  c.domein=(p.d && TOPICS[p.d])? p.d : "bew";
  c.topics=(p.tp||"").split(",").filter(function(id){ return topicById(c.domein,c.graad,id); });
  if(c.domein!=="bew" && !c.topics.length){
    var l=topicsFor(c.domein,c.graad);
    if(!l.length){ c.domein="bew"; } else c.topics=[l[0].id];
  }
  return c;
}

/* =====================================================================
   Sommen genereren
   ===================================================================== */
function genAddSub(op,R,forms){
  var a,b,c;
  if(op==="add"){ a=rnd(0,R); b=rnd(0,R-a); c=a+b; }
  else { a=rnd(0,R); b=rnd(0,a); c=a-b; }
  var form=pick(forms);
  var answer = form===0? c : (form===1? a : b);
  return {op:op,sym:(op==="add"?"+":"−"),a:a,b:b,c:c,form:form,answer:answer,key:op+a+"_"+b+"_"+form};
}
function genMul(tables,forms){
  var table=pick(tables), mult=rnd(1,10), x,y;
  if(Math.random()<0.5){x=table;y=mult;} else {x=mult;y=table;}
  var c=x*y, form=pick(forms);
  var answer = form===0? c : (form===1? x : y);
  return {op:"mul",sym:"×",a:x,b:y,c:c,form:form,answer:answer,key:"m"+x+"_"+y+"_"+form};
}
function genDivExact(tables,forms){
  var b=pick(tables), q=rnd(1,10), a=b*q;  // a ÷ b = q
  var form=pick(forms);
  var answer = form===0? q : (form===1? a : b);
  return {op:"div",sym:"÷",a:a,b:b,c:q,form:form,answer:answer,key:"d"+a+"_"+b+"_"+form};
}
function genDivRem(tables){
  var pool=tables.filter(function(t){return t>=2;});
  var b = pool.length? pick(pool) : rnd(2,10);
  var q=rnd(1,10), r=rnd(1,b-1), a=b*q+r;  // a ÷ b = q rest r
  return {op:"divr",sym:"÷",a:a,b:b,c:q,rem:r,two:true,answer:q,key:"r"+a+"_"+b};
}
function genSplit(splits){
  var keuze=pick(splits);
  var top=(keuze===SPLIT_TOT6)? rnd(2,6) : ((keuze===SPLIT_TOT10)? rnd(2,10) : keuze);
  var a=rnd(0,top), b=top-a;
  var blankLeg=rnd(0,1);                 // welk been is verstopt?
  var answer = blankLeg===0? a : b;
  return {op:"split",top:top,a:a,b:b,blankLeg:blankLeg,answer:answer,key:"p"+top+"_"+a+"_"+blankLeg};
}
function genQuestion(cfg,avoid){
  var q;
  for(var t=0;t<50;t++){
    var op=pick(cfg.ops);
    if(op==="add"||op==="sub") q=genAddSub(op,cfg.range,cfg.forms);
    else if(op==="mul") q=genMul(cfg.tables,cfg.forms);
    else if(op==="split") q=genSplit(cfg.splits);
    else q = cfg.rest ? genDivRem(cfg.tables) : genDivExact(cfg.tables,cfg.forms);
    if(q.key!==avoid) return q;
  }
  return q;
}
/* Een reeks opbouwen: binnen één reeks komt dezelfde som niet dubbel voor
   (zolang er genoeg verschillende sommen bestaan voor de gekozen opties).
   Pas als alle mogelijkheden op zijn, mag een som terugkeren — maar nooit
   twee keer meteen na elkaar. */
/* Eén opgave, uit het gekozen domein */
function genAny(cfg,avoid){
  if(cfg.domein==="bew" || !cfg.topics || !cfg.topics.length) return genQuestion(cfg,avoid);
  for(var t=0;t<60;t++){
    var tp=topicById(cfg.domein,cfg.graad,pick(cfg.topics));
    if(!tp) continue;
    var q=tp.gen(cfg);
    q.topic=tp;
    if(q.key!==avoid) return q;
  }
  return genQuestion(cfg,avoid);
}
function buildSet(cfg){
  var n=cfg.count>0?cfg.count:12, list=[], used={}, last="";
  for(var i=0;i<n;i++){
    var q=null;
    for(var t=0;t<80;t++){
      q=genAny(cfg,last);
      if(!used[q.key]) break;
    }
    used[q.key]=true; last=q.key; list.push(q);
  }
  return list;
}
function choicesFor(q){
  var ans=q.answer, set={}; set[ans]=true; var out=[ans];
  var cand=[ans-1,ans+1,ans-2,ans+2,ans+10,ans-10,ans+5,ans-5];
  if(q.b!=null){ cand.push(ans+q.b, Math.abs(ans-q.b)); }
  cand=cand.filter(function(v){return v>=0;});
  if(q.op==="split"){ cand=cand.filter(function(v){return v<=q.top;}); }
  shuffle(cand);
  for(var i=0;i<cand.length && out.length<4;i++){ if(!set[cand[i]]){set[cand[i]]=true;out.push(cand[i]);} }
  /* Bij een kleine splitsing (bv. splits 3) bestaan er te weinig verschillende
     getallen voor vier knoppen: ruimer bereik en een harde begrenzing, anders
     blijft deze lus eeuwig zoeken en loopt de app vast. */
  var lim = q.op==="split"? Math.max(q.top+2,6) : Math.max(20,ans+5);
  var pogingen=0;
  while(out.length<4 && pogingen++<300){ var r=rnd(0,lim); if(!set[r]){set[r]=true;out.push(r);} }
  return shuffle(out);
}

/* =====================================================================
   Geluid
   ===================================================================== */
var AC=null, soundOn=true;
function ac(){ if(!AC){try{AC=new (root.AudioContext||root.webkitAudioContext)();}catch(e){}} return AC; }
function beep(freqs,dur,type,vol){
  if(!soundOn) return; var a=ac(); if(!a) return; if(a.state==="suspended") a.resume();
  var t0=a.currentTime;
  freqs.forEach(function(f,i){
    var o=a.createOscillator(), g=a.createGain(); o.type=type||"sine"; o.frequency.value=f;
    var st=t0+i*0.09; g.gain.setValueAtTime(0,st); g.gain.linearRampToValueAtTime(vol||0.18,st+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,st+(dur||0.18));
    o.connect(g); g.connect(a.destination); o.start(st); o.stop(st+(dur||0.18)+0.02);
  });
}
var sndGood=function(){beep([660,880,1175],0.20,"sine",0.16);};
var sndBad =function(){beep([200,150],0.18,"triangle",0.14);};
var sndTime=function(){beep([392,330,262],0.22,"sine",0.14);};
var sndTick=function(){beep([880],0.05,"sine",0.05);};

/* =====================================================================
   Speler
   ===================================================================== */
var game=null;
var onExit=function(){};   // wordt per pagina ingesteld (leerling: naar start; leerkracht: naar generator)

function startGame(c){
  ac();
  game={cfg:c, classMode:(c.session==="class"), set:buildSet(c), i:0,
        stars:0, firstTry:0, total:0, classRight:0, wrongOnce:false, log:[], firstWrong:null,
        locked:false, revealed:false, typed:"", typed2:"", active:0, current:null, raf:null, endT:0};
  hidePlayScreens(); $("#screenPlay").classList.remove("hidden");
  if(root.scrollTo) root.scrollTo(0,0);   // meteen bovenaan de oefening, nooit scrollen
  document.body.style.background="radial-gradient(130% 90% at 50% -20%, #FFF7E6 0%, var(--paper) 60%)";
  soundOn=true; $("#soundBtn").textContent="🔊";
  if(game.classMode){ $("#starIcon").classList.add("hidden"); classShow(); }
  else { $("#starIcon").classList.remove("hidden"); $("#starCount").textContent="0"; nextQuestion(); }
}
/* verbergt alle schermen van de pagina (generator, welkom, setup, scanner, speler, resultaat),
   zodat starten/eindigen altijd één volledig scherm toont — nooit scrollen */
function hidePlayScreens(){ $$("main").forEach(function(m){ m.classList.add("hidden"); }); }

/* ---------- equation tiles ---------- */
function tNum(v){return '<span class="tile">'+v+'</span>';}
function tOp(s){return '<span class="tile op">'+s+'</span>';}
function tBlank(txt,filled,cursor,id){return '<span class="tile blank'+(cursor?" cursor":"")+(filled?" filled":"")+'" id="'+id+'">'+txt+'</span>';}
function renderEq(){
  var g=game,q=g.current,html,big;
  /* opgaven uit de nieuwe domeinen: vraag in woorden, met eventueel een tekening */
  if(q.gen){
    var f=g.typed!=="";
    var eqG=$("#eq"); eqG.className="eq eq--vraag";
    eqG.innerHTML=
      (q.topic? '<span class="vraag__tag">'+q.topic.label+'</span>':'')+
      '<p class="vraag">'+q.prompt.replace("⬚",'<span class="vraag__gap">?</span>')+'</p>'+
      (q.fig? '<div class="figwrap">'+q.fig+'</div>':'')+
      (q.choices? '' :
        '<div class="antwoordrij">'+tBlank(f?g.typed:"?",f,true,"blankTile")+
        (q.unit? '<span class="eenheid">'+q.unit+'</span>':'')+'</div>');
    return;
  }
  if(q.op==="split"){
    var f=g.typed!=="";
    var legA = q.blankLeg===0? tBlank(f?g.typed:"?",f,true,"blankTile") : tNum(q.a);
    var legB = q.blankLeg===1? tBlank(f?g.typed:"?",f,true,"blankTile") : tNum(q.b);
    html='<div class="spl">'+
           '<span class="tile spl__top">'+q.top+'</span>'+
           '<svg class="spl__lines" viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden="true">'+
             '<path d="M60 2 L22 28 M60 2 L98 28"/></svg>'+
           '<div class="spl__legs">'+legA+legB+'</div>'+
         '</div>';
    var eqS=$("#eq"); eqS.className="eq eq--split"; eqS.innerHTML=html;
    return;
  }
  if(q.two){
    var f1=g.typed!=="", f2=g.typed2!=="";
    html=tNum(q.a)+tOp(q.sym)+tNum(q.b)+tOp("=")+
         tBlank(f1?g.typed:"?",f1,g.active===0,"blankTile")+
         '<span class="rest-lbl">rest</span>'+
         tBlank(f2?g.typed2:"?",f2,g.active===1,"blankTile2");
    big=(q.a>=100);
  } else {
    var slots=[{v:q.a,blank:q.form===1},{op:q.sym},{v:q.b,blank:q.form===2},{op:"="},{v:q.c,blank:q.form===0}];
    html=slots.map(function(s){
      if(s.op) return tOp(s.op);
      if(s.blank){var f=g.typed!=="";return tBlank(f?g.typed:"?",f,true,"blankTile");}
      return tNum(s.v);
    }).join("");
    big=(q.a>=100||q.b>=100||q.c>=100);
  }
  var eq=$("#eq"); eq.className="eq"+(big?" eq--big":""); eq.innerHTML=html;
  if(q.two){
    var b1=$("#blankTile"), b2=$("#blankTile2");
    if(b1) b1.onclick=function(){ if(!g.locked){g.active=0;syncCursor();} };
    if(b2) b2.onclick=function(){ if(!g.locked){g.active=1;syncCursor();} };
  }
}
function syncCursor(){
  var g=game,b1=$("#blankTile"),b2=$("#blankTile2");
  if(b1) b1.classList.toggle("cursor",g.active===0);
  if(b2) b2.classList.toggle("cursor",g.active===1);
}
function setBlankText(){
  var g=game,b1=$("#blankTile");
  if(b1){var f=g.typed!=="";b1.classList.toggle("filled",f);b1.textContent=f?g.typed:"?";}
  if(g.current.two){var b2=$("#blankTile2"); if(b2){var f2=g.typed2!=="";b2.classList.toggle("filled",f2);b2.textContent=f2?g.typed2:"?";}}
}
function curField(){ return (game.current.two && game.active===1) ? "typed2" : "typed"; }

/* ---------- cijferpad ---------- */
function padMarkup(){
  var keys=["1","2","3","4","5","6","7","8","9","del","0","ok"], html='<div class="pad">';
  keys.forEach(function(k){
    if(k==="del") html+='<button class="key key--del" data-k="del" type="button" aria-label="Wissen">⌫</button>';
    else if(k==="ok") html+='<button class="key key--act" data-k="ok" type="button" aria-label="Controleer">✓</button>';
    else html+='<button class="key" data-k="'+k+'" type="button">'+k+'</button>';
  });
  return html+"</div>";
}

/* ---------- zelf oefenen ---------- */
function nextQuestion(){
  cancelAuto();
  var g=game;
  if(g.cfg.count>0 && g.i>=g.set.length){ return endGame(); }
  if(g.i>=g.set.length) g.set=g.set.concat(buildSet(g.cfg));
  g.current=g.set[g.i]; g.typed=""; g.typed2=""; g.active=0; g.locked=false; g.wrongOnce=false; g.firstWrong=null;
  renderEq();
  if(g.current.gen){
    /* sommige onderwerpen hebben van nature keuzeknoppen (bv. even of oneven),
       de andere worden ingetikt met het cijferpad */
    if(g.current.choices) renderTextChoices(g.current.choices); else renderPad();
  }
  else if(g.cfg.mode==="mc" && !g.current.two) renderChoices(); else renderPad();
  updateProgress();
  if(g.cfg.seconds>0) startTimer(g.cfg.seconds);
}
function renderPad(){
  var box=$("#input"); box.innerHTML=padMarkup();
  $$(".key",box).forEach(function(b){ b.onclick=function(){padPress(b.dataset.k);}; });
}
/* Automatische stappen: zodra een vakje het verwachte aantal cijfers heeft,
   wacht de app een kwartseconde en controleert dan vanzelf (of springt door
   naar het volgende lege vakje). De korte pauze verklapt niet hoeveel cijfers
   het antwoord telt; elke nieuwe toetsaanslag annuleert de geplande controle.
   Het kind hoeft nooit ✓ te tikken. */
var AUTO_DELAY=250, autoT=null, autoFn=null;
function cancelAuto(){ if(autoT){ clearTimeout(autoT); autoT=null; } autoFn=null; }
/* Staat er nog een controle klaar, voer ze dan meteen uit. Zo telt een antwoord
   dat het kind net voor de bel volledig intikte, ook echt mee. */
function flushAuto(){
  if(!autoT) return false;
  clearTimeout(autoT); autoT=null;
  var fn=autoFn; autoFn=null;
  if(fn) performAuto(fn);
  return true;
}
function fieldTarget(fld){
  var q=game.current;
  if(q.gen) return q.answer;
  if(q.two) return fld==="typed2"? q.rem : q.c;
  return q.answer;
}
function autoStep(check){
  cancelAuto();
  var g=game,fld=curField();
  if(String(g[fld]).length < String(fieldTarget(fld)).length) return;
  autoFn=check;
  autoT=setTimeout(function(){ autoT=null; autoFn=null; performAuto(check); }, AUTO_DELAY);
}
function performAuto(check){
  var g=game; if(!g) return;
  if(g.classMode? g.revealed : g.locked) return;
  if($("#screenPlay").classList.contains("hidden")) return;
  var q=g.current,fld=curField();
  if(String(g[fld]).length < String(fieldTarget(fld)).length) return;
  if(q.two){
    var other = fld==="typed"? "typed2" : "typed";
    if(String(g[other]).length < String(fieldTarget(other)).length){
      g.active = other==="typed2"? 1 : 0; syncCursor(); return;
    }
  }
  check();
}
/* Op een touchscreen of digibord wordt een tik soms twee keer geteld. Twee
   identieke tikken binnen 70 ms zijn nooit menselijk: die tweede slaan we over,
   anders wordt 5 ineens 55 en telt een juist antwoord als fout. */
var laatsteTik={k:null,t:0};
function echoTik(k){
  var nu=(root.performance&&performance.now)?performance.now():Date.now();
  if(k===laatsteTik.k && (nu-laatsteTik.t)<70){ laatsteTik.t=nu; return true; }
  laatsteTik={k:k,t:nu}; return false;
}
function padPress(k){
  var g=game; if(g.locked) return;
  if(k!=="del" && k!=="ok" && echoTik(k)) return;
  var fld=curField();
  if(k==="del"){ cancelAuto(); g[fld]=g[fld].slice(0,-1); setBlankText(); return; }
  else if(k==="ok"){ cancelAuto(); submitSelf(); return; }
  else { if(g[fld].length<(g.current.gen?6:4)) g[fld]+=k; }
  setBlankText();
  autoStep(submitSelf);
}
function evalCorrect(){
  var g=game,q=g.current;
  if(q.gen) return String(parseInt(g.typed,10))===String(q.answer);
  if(q.two) return parseInt(g.typed,10)===q.c && parseInt(g.typed2,10)===q.rem;
  return parseInt(g.typed,10)===q.answer;
}
/* keuzeknoppen met woorden (even/oneven, <, >, =, vormen, …) */
function renderTextChoices(opts){
  var html='<div class="choices choices--tekst">';
  opts.forEach(function(v){ html+='<button class="choice choice--tekst" data-v="'+String(v).replace(/"/g,"&quot;")+'" type="button">'+v+'</button>'; });
  html+="</div>";
  var box=$("#input"); box.innerHTML=html;
  $$(".choice",box).forEach(function(b){
    b.onclick=function(){
      var g=game; if(g.locked) return;
      var v=b.dataset.v, q=g.current;
      if(v===String(q.answer)){
        b.classList.add("good"); g.locked=true; stopTimer(); g.total++; g.stars++; g.firstTry++;
        g.log.push({q:q, ok:true});
        $("#starCount").textContent=g.stars; sndGood();
        if(!reduced) confetti(); splash("🎉","Goed zo!",""); setTimeout(advance, reduced?500:850);
      } else {
        g.locked=true; stopTimer(); g.total++;
        g.log.push({q:q, ok:false, wrong:v});
        b.classList.add("bad","shake"); sndBad();
        $$(".choice").forEach(function(x){ if(x.dataset.v===String(q.answer)) x.classList.add("good"); });
        splash("🤔","Bijna!", answerText(q));
        setTimeout(advance, reduced?900:2300);
      }
    };
  });
}
function bothFilled(){ var g=game; return g.current.two ? (g.typed!=="" && g.typed2!=="") : (g.typed!==""); }
/* Eén kans per som: een fout antwoord telt als fout en blijft fout.
   Het juiste antwoord verschijnt even op het scherm, daarna volgt de
   volgende som. (In de klasmodus mag er wél samen verder gezocht worden.) */
function submitSelf(){
  var g=game; if(g.locked) return;
  if(!bothFilled()){ nudgeEmpty(); return; }
  if(evalCorrect()){
    g.locked=true; stopTimer(); g.total++; g.stars++; g.firstTry++;
    g.log.push({q:g.current, ok:true});
    $("#starCount").textContent=g.stars; sndGood();
    if(!reduced) confetti(); splash("🎉","Goed zo!","");
    setTimeout(advance, reduced?500:850);
  } else {
    g.locked=true; stopTimer(); g.total++;
    g.log.push({q:g.current, ok:false, wrong:(g.current.two? (g.typed+" rest "+g.typed2) : g.typed)});
    sndBad(); shakeBlanks();
    setTimeout(revealInTiles, reduced?60:430);
    splash("🤔","Bijna!", answerText(g.current));
    setTimeout(advance, reduced?900:2300);
  }
}
function renderChoices(){
  var opts=choicesFor(game.current), html='<div class="choices">';
  opts.forEach(function(v){ html+='<button class="choice" data-v="'+v+'" type="button">'+v+'</button>'; });
  html+="</div>";
  var box=$("#input"); box.innerHTML=html;
  $$(".choice",box).forEach(function(b){
    b.onclick=function(){
      var g=game; if(g.locked) return; var v=parseInt(b.dataset.v,10);
      if(v===g.current.answer){ b.classList.add("good"); g.locked=true; stopTimer(); g.total++; g.stars++; g.firstTry++;
        g.log.push({q:g.current, ok:true});
        $("#starCount").textContent=g.stars; sndGood();
        if(!reduced) confetti(); splash("🎉","Goed zo!",""); setTimeout(advance, reduced?500:850);
      } else {
        g.locked=true; stopTimer(); g.total++;
        g.log.push({q:g.current, ok:false, wrong:String(v)});
        b.classList.add("bad","shake"); sndBad();
        $$(".choice").forEach(function(x){ if(parseInt(x.dataset.v,10)===g.current.answer) x.classList.add("good"); });
        splash("🤔","Bijna!", answerText(g.current));
        setTimeout(advance, reduced?900:2300);
      }
    };
  });
}
function timeUp(){
  var g=game;
  if(g.classMode){
    stopTimer(); setGlow(0,"#FFD27A"); sndTime();
    var hp=$("#handPrompt"); if(hp && !g.revealed) hp.innerHTML='<span class="wave">✋</span> Denktijd voorbij — wie weet het?';
    return;
  }
  if(g.locked) return;
  /* Het kind tikte het antwoord net voor de bel volledig in: die controle stond
     al klaar en krijgt voorrang op "tijd om". Anders werd een juist antwoord
     als fout gerekend. */
  flushAuto();
  if(g.locked) return;
  cancelAuto();
  g.locked=true; stopTimer(); g.total++; g.wrongOnce=false;
  g.log.push({q:g.current, ok:false, wrong:null, timeout:true});
  revealInTiles();
  if(g.cfg.mode==="mc" && !g.current.two){ $$(".choice").forEach(function(b){ if(parseInt(b.dataset.v,10)===g.current.answer) b.classList.add("good"); }); }
  sndTime(); splash("⏰","Tijd om!", answerText(g.current));
  setTimeout(advance, reduced?900:1700);
}
function revealInTiles(){
  var g=game,q=g.current,b1=$("#blankTile");
  if(b1){ b1.classList.add("filled"); b1.textContent = q.gen? q.answer : (q.two? q.c : q.answer); }
  if(q.two){ var b2=$("#blankTile2"); if(b2){ b2.classList.add("filled"); b2.textContent=q.rem; } }
}
function answerText(q){
  if(q.gen) return "Het juiste antwoord is "+q.answer+(q.unit? " "+q.unit:"");
  return q.two? ("Het juiste antwoord is "+q.c+" rest "+q.rem) : ("Het juiste antwoord is "+q.answer);
}
function advance(){ meldSessie(false); hideSplash(); setGlow(0,"#FFD27A"); game.i++; nextQuestion(); }
function updateProgress(){
  var g=game, pct=g.cfg.count>0?(g.i/g.cfg.count)*100:(g.total%12)/12*100;
  $("#progFill").style.width=pct+"%";
}

/* ---------- klassikaal samen oefenen ---------- */
function classShow(){
  cancelAuto();
  var g=game; g.revealed=false; g.typed=""; g.typed2=""; g.active=0;
  g.current=g.set[g.i]; renderEq(); renderClassControls(); updateClassCount();
  if(g.cfg.seconds>0) startTimer(g.cfg.seconds);
}
function renderClassControls(){
  var g=game;
  /* Onderwerpen met woordknoppen (even/oneven, vormen, …) tonen die knoppen
     ook op het digibord; de rest krijgt het cijferpad. */
  var keuze = g.current.gen && g.current.choices;
  var midden = keuze
    ? '<div class="choices choices--tekst">'+g.current.choices.map(function(v){
        return '<button class="choice choice--tekst" data-v="'+String(v).replace(/"/g,"&quot;")+'" type="button">'+v+'</button>';
      }).join("")+'</div>'
    : padMarkup();
  $("#input").innerHTML=
    '<div class="classbar">'+
      '<div class="handprompt" id="handPrompt"><span class="wave">✋</span> Wie weet het antwoord?</div>'+
      midden+
      '<div class="classctrls">'+
        (g.i>0? '<button class="bigbtn bigbtn--prev" id="cPrev" type="button" aria-label="Vorige som">←</button>':'')+
        '<button class="bigbtn bigbtn--rev" id="cReveal" type="button">Toon antwoord</button>'+
      '</div>'+
      '<div class="somcount" id="cCount"></div>'+
    '</div>';
  if(keuze){
    $$(".choice").forEach(function(b){
      b.onclick=function(){
        if(game.revealed) return;
        if(b.dataset.v===String(game.current.answer)) classCorrect();
        else { b.classList.add("bad"); classWrong(); }
      };
    });
  } else {
    $$(".key").forEach(function(b){ b.onclick=function(){ classPad(b.dataset.k); }; });
  }
  $("#cReveal").onclick=revealClass;
  var p=$("#cPrev"); if(p) p.onclick=function(){ classGo(-1); };
}
function classPad(k){
  var g=game; if(g.revealed) return;
  if(k!=="del" && k!=="ok" && echoTik(k)) return;
  var fld=curField();
  if(k==="del"){ cancelAuto(); g[fld]=g[fld].slice(0,-1); setBlankText(); return; }
  else if(k==="ok"){ cancelAuto(); classCheck(); return; }
  else { if(g[fld].length<4) g[fld]+=k; }
  setBlankText();
  autoStep(classCheck);
}
function classCheck(){
  var g=game; if(g.revealed) return;
  if(!bothFilled()){ nudgeEmpty(); return; }
  if(evalCorrect()) classCorrect(); else classWrong();
}
function classWrong(){
  var g=game; sndBad(); shakeBlanks();
  g.typed=""; g.typed2=""; g.active=0; setBlankText(); syncCursor();
  if(g.current.gen) renderEq();
  var hp=$("#handPrompt"); if(hp) hp.innerHTML='<span style="font-size:22px">🤔</span> Bijna! Denk nog eens goed na…';
}
function markClassChoice(){
  var q=game.current;
  if(q.gen && q.choices) $$(".choice").forEach(function(b){ if(b.dataset.v===String(q.answer)) b.classList.add("good"); });
}
function classCorrect(){
  var g=game; g.revealed=true; stopTimer(); setGlow(0,"#FFD27A");
  revealInTiles(); markClassChoice();
  var hp=$("#handPrompt"); if(hp) hp.innerHTML='<span style="font-size:23px">🎉</span> Juist!';
  g.classRight++; sndGood(); if(!reduced) confetti(); splash("🎉","Goed zo!","");
  var last=(g.cfg.count>0 && g.i>=g.cfg.count-1);
  setTimeout(function(){ hideSplash(); if(last) endClass(); else classGo(1); }, reduced?700:1500);
}
function revealClass(){
  var g=game; if(g.revealed) return;
  g.revealed=true; stopTimer(); setGlow(0,"#FFD27A"); revealInTiles(); markClassChoice();
  var hp=$("#handPrompt");
  if(hp) hp.innerHTML='Het antwoord is <b style="color:var(--grass-deep)">'+
    (g.current.two? (g.current.c+" rest "+g.current.rem)
                  : (g.current.answer+(g.current.gen&&g.current.unit? " "+g.current.unit:"")))+'</b>';
  sndGood();
  var btn=$("#cReveal"), last=(g.cfg.count>0 && g.i>=g.cfg.count-1);
  btn.className="bigbtn bigbtn--next"; btn.textContent=last?"Klaar ✓":"Volgende som →";
  btn.onclick=function(){ classGo(1); };
}
function classGo(dir){
  var g=game;
  if(dir>0 && g.cfg.count>0 && g.i>=g.cfg.count-1){ return endClass(); }
  g.i+=dir; if(g.i<0) g.i=0;
  if(g.i>=g.set.length) g.set=g.set.concat(buildSet(g.cfg));
  hideSplash(); setGlow(0,"#FFD27A"); classShow();
}
function updateClassCount(){
  var g=game, total=(g.cfg.count>0?g.cfg.count:0);
  var cc=$("#cCount"); if(cc) cc.textContent = total? ("Som "+(g.i+1)+" van "+total) : ("Som "+(g.i+1));
  $("#starCount").textContent = total? ((g.i+1)+" / "+total) : ("Som "+(g.i+1));
  $("#progFill").style.width = (total?(g.i/total)*100:(g.i%12)/12*100)+"%";
}
function endClass(){
  stopTimer(); setGlow(0,"#FFD27A"); hideSplash();
  hidePlayScreens(); $("#screenDone").classList.remove("hidden");
  if(root.scrollTo) root.scrollTo(0,0);
  var solved=game.classRight||0;
  $("#resultsBox").innerHTML=
    '<div class="medal">👏</div><h2>Goed samen geoefend!</h2>'+
    (solved? '<div class="score">'+solved+' sommen samen opgelost</div>':'')+
    '<p>Nog een rondje, of zet je de kinderen nu zelf aan het werk?</p>'+
    '<div class="results__btns"><button class="btn btn--grass" id="cAgain" type="button">↻ Nog eens</button></div>';
  $("#cAgain").onclick=function(){ startGame(game.cfg); };
  if(!reduced) setTimeout(confetti,250); sndGood();
}

/* ---------- gedeelde feedback-helpers ---------- */
function shakeBlanks(){
  [$("#blankTile"),$("#blankTile2")].forEach(function(t){ if(t){ t.classList.add("shake"); setTimeout(function(){t.classList.remove("shake");},450); } });
}
function nudgeEmpty(){
  var g=game;
  if(g.current.two){ // markeer het lege vakje
    if(g.typed===""){ g.active=0; } else if(g.typed2===""){ g.active=1; }
    syncCursor();
    var hp=$("#handPrompt"); // alleen in klasmodus aanwezig
    var t=(g.active===0)?$("#blankTile"):$("#blankTile2");
    if(t){ t.classList.add("shake"); setTimeout(function(){t.classList.remove("shake");},450); }
  }
}

/* ---------- timer + gloed ---------- */
function startTimer(sec){
  var g=game; stopTimer(); g.endT=performance.now()+sec*1000;
  var lastTick=Math.ceil(sec), bar=$("#ringBar");
  var len=bar.getTotalLength?bar.getTotalLength():640;
  bar.style.strokeDasharray=len; bar.style.strokeDashoffset=0;
  function frame(now){
    var left=(g.endT-now)/1000;
    if(left<=0){ bar.style.strokeDashoffset=len; setRing(0); timeUp(); return; }
    var ratio=left/sec; bar.style.strokeDashoffset=len*(1-ratio); setRing(ratio);
    if(left<=5){
      var e=(5-left)/5, op=0.12+e*0.72, col=mix("#FFD27A","#5A2E0A",e);
      setGlow(op,col); var s2=Math.ceil(left);
      if(s2!==lastTick && s2<=3){ lastTick=s2; sndTick(); }
    } else setGlow(0,"#FFD27A");
    g.raf=requestAnimationFrame(frame);
  }
  g.raf=requestAnimationFrame(frame);
}
function setRing(ratio){ $("#ringBar").style.stroke = ratio>0.5?"var(--grass)":(ratio>0.25?"var(--sun-deep)":"var(--berry)"); }
function stopTimer(){ if(game&&game.raf){ cancelAnimationFrame(game.raf); game.raf=null; } }
function setGlow(op,col){ var g=$("#glow"); if(g){ g.style.opacity=op; g.style.setProperty("--glowc",col); } }
function mix(a,b,t){
  function h(x){return [parseInt(x.substr(1,2),16),parseInt(x.substr(3,2),16),parseInt(x.substr(5,2),16)];}
  var A=h(a),B=h(b); function c(i){return Math.round(A[i]+(B[i]-A[i])*t);}
  return "rgb("+c(0)+","+c(1)+","+c(2)+")";
}

/* ---------- splash + confetti ---------- */
function splash(emo,txt,hint){ $("#splashEmo").textContent=emo; $("#splashTxt").textContent=txt; $("#splashHint").textContent=hint||""; $("#splash").classList.add("show"); }
function hideSplash(){ $("#splash").classList.remove("show"); }
var _cv=null,_ctx=null,_parts=[],_raf=null;
function confCanvas(){ if(!_cv){ _cv=$("#confetti"); if(_cv){ _ctx=_cv.getContext("2d"); root.addEventListener("resize",sizeConf); } } return _cv; }
function sizeConf(){ if(_cv){ _cv.width=root.innerWidth; _cv.height=root.innerHeight; } }
function confetti(){
  if(!confCanvas()) return; sizeConf();
  var cols=["#FFC233","#36A85B","#E5566B","#46B8E8","#7B5EA7"];
  for(var i=0;i<70;i++){ _parts.push({x:root.innerWidth/2+(Math.random()-0.5)*160,y:root.innerHeight*0.4,vx:(Math.random()-0.5)*9,vy:-6-Math.random()*7,g:0.3+Math.random()*0.2,s:6+Math.random()*7,c:cols[i%cols.length],r:Math.random()*6,vr:(Math.random()-0.5)*0.4,life:0}); }
  if(!_raf) confLoop();
}
function confLoop(){
  _ctx.clearRect(0,0,_cv.width,_cv.height);
  for(var i=_parts.length-1;i>=0;i--){ var p=_parts[i]; p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.r+=p.vr; p.life++;
    _ctx.save(); _ctx.translate(p.x,p.y); _ctx.rotate(p.r); _ctx.fillStyle=p.c; _ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*0.6); _ctx.restore();
    if(p.y>_cv.height+30||p.life>160) _parts.splice(i,1); }
  if(_parts.length){ _raf=requestAnimationFrame(confLoop); } else { _ctx.clearRect(0,0,_cv.width,_cv.height); _raf=null; }
}

/* ---------- resultaat (zelf) ---------- */
function endGame(){ meldSessie(true); stopTimer(); hidePlayScreens(); $("#screenDone").classList.remove("hidden"); if(root.scrollTo) root.scrollTo(0,0); showResults(); }
/* ---------- live sessie (optioneel) ----------
   Draait alleen als krak-sessie.js geladen is én het kind via een sessielink
   binnenkwam. Zonder sessie, zonder netwerk of zonder die bestanden gebeurt
   er simpelweg niets — de oefening zelf mag hier nooit op stuklopen. */
var sessieRonde = 0;
function setSessieRonde(n){ sessieRonde = n|0; }
function inSessie(){ return sessieRonde > 0; }
function meldSessie(klaar){
  if(!sessieRonde || typeof KrakSessie==="undefined" || !game) return;
  try{
    var fouten = game.log.filter(function(e){ return !e.ok; }).map(function(e){
      return { v: reviewSom(e.q), a: e.timeout? "" : (e.wrong || "") };
    });
    KrakSessie.meld(sessieRonde, game.firstTry, game.total, !!klaar, fouten);
  }catch(e){}
}

/* leesbare somtekst voor het overzicht */
function reviewSom(q){
  if(q.gen) return q.prompt.replace("⬚","___")+"  →  "+q.answer+(q.unit? " "+q.unit:"");
  if(q.op==="split") return "splits "+q.top+" → "+q.a+" en "+q.b;
  if(q.two) return q.a+" "+q.sym+" "+q.b+" = "+q.c+" rest "+q.rem;
  return q.a+" "+q.sym+" "+q.b+" = "+q.c;
}
function reviewHTML(log){
  if(!log || !log.length) return "";
  var nWrong=0; log.forEach(function(e){ if(!e.ok) nWrong++; });
  var html='<div class="review"><h3>Overzicht van je reeks'+
    '<span class="review__count">'+(nWrong? nWrong+" om te herhalen":"alles juist!")+'</span></h3>';
  log.forEach(function(e,i){
    var sub="";
    if(!e.ok){
      if(e.timeout) sub="de tijd was om";
      else if(e.wrong!=null && e.wrong!=="") sub="jouw antwoord: "+e.wrong;
      else sub="geen antwoord";
    }
    html+='<div class="review__row'+(e.ok?"":" review__row--bad")+'">'+
      '<span class="review__ic '+(e.ok?"review__ic--good":"review__ic--bad")+'">'+(e.ok?"✓":"✗")+'</span>'+
      '<span class="review__tx"><b>'+(i+1)+". "+reviewSom(e.q)+'</b>'+
      (sub? '<span class="review__given">'+sub+'</span>':"")+
      '</span></div>';
  });
  return html+"</div>";
}
function showResults(){
  var g=game, total=g.total, stars=g.stars, pct=total?Math.round(stars/total*100):0;
  var medal=pct>=90?"🏆":pct>=70?"🥇":pct>=50?"🥈":"🌱";
  var titel=pct>=90?"Wauw, knap gedaan!":pct>=70?"Goed bezig!":pct>=50?"Flink geoefend!":"Blijf oefenen!";
  $("#resultsBox").innerHTML=
    '<div class="medal">'+medal+'</div><h2>'+titel+'</h2>'+
    '<div class="score">'+stars+' van '+total+' juist</div>'+
    '<div class="breakdown">'+
      '<div class="bd"><b>'+stars+'</b><span>sterren</span></div>'+
      '<div class="bd"><b>'+(total-stars)+'</b><span>fout</span></div>'+
      '<div class="bd"><b>'+pct+'%</b><span>juist</span></div>'+
    '</div>'+
    reviewHTML(g.log)+
    '<div class="results__btns">'+
      (inSessie()? '' : '<button class="btn btn--grass" id="again" type="button">↻ Nog eens</button>')+
      '<button class="btn btn--ghost" id="exit" type="button">🏠 Klaar</button>'+
    '</div>';
  if($("#again")) $("#again").onclick=function(){ startGame(g.cfg); };
  $("#exit").onclick=function(){ onExit(); };
  if(pct>=70 && !reduced) setTimeout(confetti,250); sndGood();
}

/* ---------- toetsenbord ---------- */
document.addEventListener("keydown",function(e){
  if(!game || $("#screenPlay").classList.contains("hidden")) return;
  if(game.classMode){
    if(game.revealed){
      if(e.key==="ArrowRight"||e.key===" "||e.key==="Enter"){ e.preventDefault(); classGo(1); }
      else if(e.key==="ArrowLeft"){ e.preventDefault(); classGo(-1); }
      return;
    }
    if(e.key>="0"&&e.key<="9"){ classPad(e.key); }
    else if(e.key==="Backspace"){ e.preventDefault(); classPad("del"); }
    else if(e.key==="Enter"){ e.preventDefault(); classCheck(); }
    else if(e.key==="ArrowLeft"){ e.preventDefault(); classGo(-1); }
    else if(e.key==="Tab" && game.current.two){ e.preventDefault(); game.active=game.active?0:1; syncCursor(); }
    return;
  }
  if(game.locked || game.cfg.mode!=="pad") return;
  if(e.key>="0"&&e.key<="9") padPress(e.key);
  else if(e.key==="Backspace"){ e.preventDefault(); padPress("del"); }
  else if(e.key==="Enter") padPress("ok");
  else if(e.key==="Tab" && game.current.two){ e.preventDefault(); game.active=game.active?0:1; syncCursor(); }
});

/* =====================================================================
   Instellingen-UI (gedeeld door leerling-setup en leerkracht-generator)
   ===================================================================== */
function chip(label,wide){ var b=document.createElement("button"); b.type="button"; b.className="chip"+(wide?" chip--wide":""); b.textContent=label; return b; }

function makeSettings(host, st, onChange){
  onChange=onChange||function(){};
  host.innerHTML=
    '<div class="block"><p class="block__label">Leerjaar</p><div class="chips" data-r="graad">'+
      '<button class="chip chip--wide" data-g="1" data-j="1" type="button">L1</button>'+
      '<button class="chip chip--wide" data-g="1" data-j="2" type="button">L2</button>'+
      '<button class="chip chip--wide" data-g="2" data-j="0" type="button">2e graad</button>'+
      '<button class="chip chip--wide" data-g="3" data-j="0" type="button">3e graad</button>'+
    '</div><p class="block__hint" data-r="graadHint" style="margin-top:8px"></p></div>'+
    '<div class="block"><p class="block__label">Onderdeel <span class="block__hint">kies er één</span></p><div class="doms" data-r="doms"></div></div>'+
    '<div class="block" data-r="topicBlock"><p class="block__label">Onderwerpen <span class="block__hint">kies er één of meer</span></p><div class="forms" data-r="topics"></div><div class="tinybtns"><button class="tinybtn" data-r="tpAll" type="button">Alles aan</button><button class="tinybtn" data-r="tpNone" type="button">Alles uit</button></div></div>'+
    '<div class="block" data-r="opsBlock"><p class="block__label">Bewerkingen <span class="block__hint">kies één of meer</span></p><div class="ops" data-r="ops"></div></div>'+
    '<div class="block" data-r="tablesBlock"><p class="block__label">Maaltafels <span class="block__hint">voor × en ÷</span></p><div class="chips" data-r="tables"></div><div class="tinybtns"><button class="tinybtn" data-r="tAll" type="button">Alles</button><button class="tinybtn" data-r="tNone" type="button">Wissen</button></div></div>'+
    '<div class="block" data-r="rangeBlock"><p class="block__label">Getallenbereik <span class="block__hint">voor + en −</span></p><div class="chips" data-r="range"></div></div>'+
    '<div class="block" data-r="splitBlock"><p class="block__label">Splitsen van <span class="block__hint">kies één of meer getallen</span></p><div class="chips" data-r="splits"></div><div class="tinybtns"><button class="tinybtn" data-r="spAll" type="button">Alles</button><button class="tinybtn" data-r="spNone" type="button">Wissen</button></div></div>'+
    '<div class="block" data-r="formsBlock"><p class="block__label">Soorten sommen</p><div class="forms" data-r="forms">'+
      formOpt(0,"5 × 7 = <span class=\'blank\'>?</span>","Antwoord zoeken","het klassieke sommetje")+
      formOpt(1,"<span class=\'blank\'>?</span> × 7 = 35","Eerste getal zoeken","welk getal hoort vooraan?")+
      formOpt(2,"5 × <span class=\'blank\'>?</span> = 35","Tweede getal zoeken","welk getal hoort achteraan?")+
    '</div></div>'+
    '<div class="block" data-r="restBlock"><div class="switchrow"><div><b>Delen met rest</b><span>bv. 38 ÷ 7 = 5 rest 3</span></div><button class="switch" data-r="rest" type="button" aria-pressed="false" aria-label="Delen met rest aan/uit"></button></div></div>'+
    '<div class="block"><p class="block__label">Tijd per som <span class="block__hint">scherm gloeit op de laatste 5 sec</span></p><div class="chips" data-r="times"></div></div>'+
    '<div class="block" data-r="modesBlock"><p class="block__label">Hoe antwoorden?</p><div class="chips" data-r="modes">'+
      '<button class="chip chip--wide" data-m="pad" type="button">🔢 Cijfers tikken</button>'+
      '<button class="chip chip--wide" data-m="mc" type="button">👉 Kiezen uit 4</button>'+
    '</div></div>'+
    '<div class="block"><p class="block__label">Aantal sommen</p><div class="chips" data-r="counts"></div></div>';

  var R=function(n){return host.querySelector('[data-r="'+n+'"]');};

  // graad
  $$(".chip",R("graad")).forEach(function(b){
    b.onclick=function(){
      var g=parseInt(b.dataset.g,10), j=parseInt(b.dataset.j,10)||0;
      if(g===st.graad && j===(st.jaar||0)) return;
      st.graad=g; st.jaar=(g===1? j : 0);
      /* bereik meteen passend zetten, zodat de leerkracht niets moet nastellen */
      st.range = g===1? (j===1? 10 : 20) : (g===2? 100 : 1000);
      if(g===1) st.tables=[2,5,10];
      st.topics=[];
      weerL1();
      ensureTopics(); syncAll(); onChange();
    };
  });
  function syncGraad(){
    $$(".chip",R("graad")).forEach(function(b){
      b.setAttribute("aria-pressed", parseInt(b.dataset.g,10)===st.graad &&
                                     (parseInt(b.dataset.j,10)||0)===(st.jaar||0));
    });
    R("graadHint").textContent=niveauLabel(st.graad,st.jaar);
  }
  /* Zitten we niet in L1, dan horen de kleinste bereiken er ook niet te staan:
     zet ze weg en kies iets passends, zodat er nooit een onzichtbare keuze
     actief blijft. */
  function inL1(){ return st.graad===1 && st.jaar===1; }
  function weerL1(){
    if(inL1()) return;
    if(st.range===6 || st.range===10) st.range = (st.graad===1? 20 : (st.graad===2? 100 : 1000));
    st.splits = (st.splits||[]).filter(function(v){ return !splitL1(v); });
    if(!st.splits.length) st.splits=[10];
  }

  // domeinen
  DOMEINEN.forEach(function(d){
    var b=document.createElement("button"); b.type="button"; b.className="dombtn"; b.dataset.id=d.id;
    b.innerHTML='<span class="dombtn__s">'+d.sym+'</span><span class="dombtn__l">'+d.label+'</span><span class="dombtn__sub">'+d.sub+'</span>';
    b.onclick=function(){ if(st.domein===d.id) return; st.domein=d.id; st.topics=[]; ensureTopics(); syncAll(); onChange(); };
    R("doms").appendChild(b);
  });
  function syncDoms(){ $$(".dombtn",R("doms")).forEach(function(b){ b.setAttribute("aria-pressed", b.dataset.id===st.domein); }); }

  // onderwerpen binnen het domein
  function ensureTopics(){
    if(st.domein==="bew"){ st.topics=[]; return; }
    var lijst=topicsFor(st.domein,st.graad);
    st.topics=(st.topics||[]).filter(function(id){ return topicById(st.domein,st.graad,id); });
    if(!st.topics.length && lijst.length) st.topics=[lijst[0].id];
  }
  R("tpAll").onclick=function(){ st.topics=topicsFor(st.domein,st.graad).map(function(t){return t.id;}); syncTopics(); onChange(); };
  R("tpNone").onclick=function(){ st.topics=st.topics.slice(0,1); syncTopics(); onChange(); };
  function syncTopics(){
    var box=R("topics"); box.innerHTML="";
    var lijst=topicsFor(st.domein,st.graad);
    if(!lijst.length){
      box.innerHTML='<p class="leegmelding">Voor deze graad zit dit onderdeel nog niet in de leerlijn. Kies een andere graad of een ander onderdeel.</p>';
      return;
    }
    lijst.forEach(function(t){
      var on=st.topics.indexOf(t.id)>-1;
      var b=document.createElement("button"); b.type="button"; b.className="form-opt"; b.setAttribute("aria-pressed",on);
      b.innerHTML='<span class="form-opt__demo">'+t.sub+'</span>'+
                  '<span class="form-opt__txt"><b>'+t.label+'</b></span>'+
                  '<span class="form-opt__tick">✓</span>';
      b.onclick=function(){
        var i=st.topics.indexOf(t.id);
        if(i>-1){ if(st.topics.length>1) st.topics.splice(i,1); }
        else st.topics.push(t.id);
        syncTopics(); onChange();
      };
      box.appendChild(b);
    });
  }

  // bewerkingen
  OPS.forEach(function(o){
    var b=document.createElement("button"); b.type="button"; b.className="opbtn"; b.dataset.id=o.id;
    b.innerHTML='<span class="opbtn__s">'+o.sym+'</span><span class="opbtn__l">'+o.word+'</span>';
    b.onclick=function(){
      var idx=st.ops.indexOf(o.id);
      if(idx>-1) st.ops.splice(idx,1); else st.ops.push(o.id);
      if(!st.ops.length) st.ops.push(o.id);
      // bewaar in vaste volgorde
      st.ops=OPS.map(function(x){return x.id;}).filter(function(id){return st.ops.indexOf(id)>-1;});
      syncOps(); refreshVis(); onChange();
    };
    R("ops").appendChild(b);
  });
  function syncOps(){ $$(".opbtn",R("ops")).forEach(function(b){ b.setAttribute("aria-pressed", st.ops.indexOf(b.dataset.id)>-1); }); }

  // maaltafels
  for(var i=1;i<=10;i++){(function(i){
    var b=chip(i); b.onclick=function(){
      var idx=st.tables.indexOf(i); if(idx>-1) st.tables.splice(idx,1); else st.tables.push(i);
      if(!st.tables.length) st.tables.push(i); st.tables.sort(function(a,b){return a-b;});
      syncTables(); onChange();
    }; R("tables").appendChild(b);
  })(i);}
  R("tAll").onclick=function(){ st.tables=[1,2,3,4,5,6,7,8,9,10]; syncTables(); onChange(); };
  R("tNone").onclick=function(){ st.tables=[1]; syncTables(); onChange(); };
  function syncTables(){ $$(".chip",R("tables")).forEach(function(b){ b.setAttribute("aria-pressed", st.tables.indexOf(parseInt(b.textContent,10))>-1); }); }

  // bereik
  RANGE_OPTS.forEach(function(o){
    var b=chip(o.l,true); b.dataset.v=o.v; if(o.l1) b.dataset.l1="1";
    b.onclick=function(){ st.range=o.v; syncRange(); onChange(); };
    R("range").appendChild(b);
  });
  function syncRange(){
    $$(".chip",R("range")).forEach(function(b){
      b.classList.toggle("hidden", b.dataset.l1==="1" && !inL1());
      b.setAttribute("aria-pressed", parseInt(b.dataset.v,10)===st.range);
    });
  }

  // splitsingen
  SPLIT_OPTS.forEach(function(v){
    var b=chip(splitLabel(v), splitL1(v)); b.dataset.v=v;
    b.onclick=function(){
      var idx=st.splits.indexOf(v); if(idx>-1) st.splits.splice(idx,1); else st.splits.push(v);
      if(!st.splits.length) st.splits.push(v); st.splits.sort(function(a,b){return a-b;});
      syncSplits(); onChange();
    }; R("splits").appendChild(b);
  });
  /* "Alles" pakt alleen wat zichtbaar is: buiten L1 zijn tot 6 en tot 10 er niet. */
  R("spAll").onclick=function(){
    st.splits=SPLIT_OPTS.filter(function(v){ return inL1() || !splitL1(v); });
    syncSplits(); onChange();
  };
  R("spNone").onclick=function(){ st.splits=[10]; syncSplits(); onChange(); };
  function syncSplits(){
    $$(".chip",R("splits")).forEach(function(b){
      var v=parseInt(b.dataset.v,10);
      b.classList.toggle("hidden", splitL1(v) && !inL1());
      b.setAttribute("aria-pressed", st.splits.indexOf(v)>-1);
    });
  }

  // forms
  $$(".form-opt",R("forms")).forEach(function(b){
    b.onclick=function(){
      var f=parseInt(b.dataset.f,10), idx=st.forms.indexOf(f);
      if(idx>-1) st.forms.splice(idx,1); else st.forms.push(f);
      if(!st.forms.length) st.forms.push(f);
      syncForms(); onChange();
    };
  });
  function syncForms(){ $$(".form-opt",R("forms")).forEach(function(b){ b.setAttribute("aria-pressed", st.forms.indexOf(parseInt(b.dataset.f,10))>-1); }); }

  // rest-schakelaar
  R("rest").onclick=function(){ st.rest=!st.rest; R("rest").setAttribute("aria-pressed",st.rest); refreshVis(); onChange(); };

  // tijd
  TIME_OPTS.forEach(function(o){
    var b=chip(o.l,true); b.onclick=function(){ st.seconds=o.v; syncTimes(); onChange(); }; R("times").appendChild(b);
  });
  function syncTimes(){ $$(".chip",R("times")).forEach(function(b,i){ b.setAttribute("aria-pressed", TIME_OPTS[i].v===st.seconds); }); }

  // modes
  $$(".chip",R("modes")).forEach(function(b){
    b.onclick=function(){ if(b.disabled) return; st.mode=b.dataset.m; syncModes(); onChange(); };
  });
  function syncModes(){ $$(".chip",R("modes")).forEach(function(b){ b.setAttribute("aria-pressed", b.dataset.m===st.mode); }); }

  // aantal
  COUNT_OPTS.forEach(function(o){
    var b=chip(o.l,true); b.onclick=function(){ st.count=o.v; syncCounts(); onChange(); }; R("counts").appendChild(b);
  });
  function syncCounts(){ $$(".chip",R("counts")).forEach(function(b,i){ b.setAttribute("aria-pressed", COUNT_OPTS[i].v===st.count); }); }

  function refreshVis(){
    var bew = st.domein==="bew";
    /* Alleen wat bij het gekozen onderdeel hoort, blijft staan. Zo zie je
       nooit meer dan een handvol blokken tegelijk. */
    R("topicBlock").classList.toggle("hidden", bew);
    R("opsBlock").classList.toggle("hidden", !bew);
    var hasMD = bew && (st.ops.indexOf("mul")>-1 || st.ops.indexOf("div")>-1);
    var hasAS = bew && (st.ops.indexOf("add")>-1 || st.ops.indexOf("sub")>-1);
    var hasDiv = bew && st.ops.indexOf("div")>-1;
    var hasSplit = bew && st.ops.indexOf("split")>-1;
    var onlySplit = hasSplit && st.ops.length===1;
    R("tablesBlock").classList.toggle("hidden", !hasMD);
    R("rangeBlock").classList.toggle("hidden", !hasAS);
    R("splitBlock").classList.toggle("hidden", !hasSplit);
    R("formsBlock").classList.toggle("hidden", !bew || onlySplit); // bij splitsen is er maar één somtype
    R("restBlock").classList.toggle("hidden", !hasDiv);
    R("modesBlock").classList.toggle("hidden", !bew);             // andere onderdelen kiezen dat zelf
    var restOn = hasDiv && st.rest;
    var mcBtn = host.querySelector('[data-m="mc"]');
    mcBtn.disabled = restOn;
    if(restOn && st.mode==="mc"){ st.mode="pad"; }
    syncModes();
  }
  function syncAll(){ syncGraad(); syncDoms(); syncTopics(); syncOps(); syncTables(); syncRange(); syncSplits(); syncForms(); R("rest").setAttribute("aria-pressed",st.rest); syncTimes(); syncModes(); syncCounts(); refreshVis(); }

  weerL1();
  ensureTopics();
  syncAll();
  return { sync:function(){ weerL1(); ensureTopics(); syncAll(); } };
}
function formOpt(f,demo,title,sub){
  return '<button class="form-opt" data-f="'+f+'" type="button" aria-pressed="false">'+
    '<span class="form-opt__demo">'+demo+'</span>'+
    '<span class="form-opt__txt"><b>'+title+'</b><span>'+sub+'</span></span>'+
    '<span class="form-opt__tick">✓</span></button>';
}

/* =====================================================================
   Publieke API
   ===================================================================== */
var api={
  defaults:defaults, parseParams:parseParams, buildHash:buildHash,
  genQuestion:genQuestion, buildSet:buildSet, choicesFor:choicesFor,
  makeSettings:makeSettings, startGame:startGame,
  setOnExit:function(fn){ onExit=fn; },
  toggleSound:function(){ soundOn=!soundOn; var b=$("#soundBtn"); if(b) b.textContent=soundOn?"🔊":"🔈"; if(soundOn) ac(); return soundOn; },
  resumeAudio:ac,
  OPS:OPS, RANGE_OPTS:RANGE_OPTS, SPLIT_OPTS:SPLIT_OPTS, FORM_LABEL:FORM_LABEL,
  SPLIT_TOT6:SPLIT_TOT6, SPLIT_TOT10:SPLIT_TOT10, splitLabel:splitLabel, splitL1:splitL1,
  DOMEINEN:DOMEINEN, domeinById:domeinById, GRAAD_LABEL:GRAAD_LABEL,
  JAAR_LABEL:JAAR_LABEL, niveauLabel:niveauLabel,
  TOPICS:TOPICS, topicsFor:topicsFor, topicById:topicById, genAny:genAny,
  setSessieRonde:setSessieRonde, inSessie:inSessie, meldSessie:meldSessie
};
root.MK=api;
if(typeof module!=="undefined" && module.exports) module.exports=api;

})(typeof window!=="undefined"?window:globalThis);
