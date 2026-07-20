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
var RANGE_OPTS=[{v:20,l:"tot 20"},{v:100,l:"tot 100"},{v:1000,l:"tot 1000"}];
var SPLIT_OPTS=[10,20,30,40,50,60,70,80,90,100];
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

function defaults(){ return {ops:["mul"],tables:[2,5,10],range:100,splits:[10],forms:[0],rest:false,seconds:0,count:10,mode:"pad",session:"self"}; }

/* ---------- helpers ---------- */
function rnd(a,b){return a+Math.floor(Math.random()*(b-a+1));}
function pick(a){return a[Math.floor(Math.random()*a.length)];}
function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}

/* =====================================================================
   URL <-> instellingen
   ===================================================================== */
function buildHash(c){
  return "#o="+c.ops.map(function(o){return OP2TOK[o];}).join(",")+
         "&t="+c.tables.join(",")+
         "&r="+c.range+
         "&sp="+c.splits.join(",")+
         "&f="+c.forms.join(",")+
         "&rest="+(c.rest?1:0)+
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
    range:[20,100,1000].indexOf(parseInt(p.r,10))>-1?parseInt(p.r,10):100,
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
  var top=pick(splits), a=rnd(0,top), b=top-a;
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
function buildSet(cfg){
  var n=cfg.count>0?cfg.count:12, list=[], used={}, last="";
  for(var i=0;i<n;i++){
    var q=null;
    for(var t=0;t<80;t++){
      q=genQuestion(cfg,last);
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
  var lim = q.op==="split"? q.top : Math.max(20,ans+5);
  while(out.length<4){ var r=rnd(0,lim); if(!set[r]){set[r]=true;out.push(r);} }
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
        stars:0, firstTry:0, total:0, classRight:0, wrongOnce:false,
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
  g.current=g.set[g.i]; g.typed=""; g.typed2=""; g.active=0; g.locked=false; g.wrongOnce=false;
  renderEq();
  if(g.cfg.mode==="mc" && !g.current.two) renderChoices(); else renderPad();
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
var AUTO_DELAY=250, autoT=null;
function cancelAuto(){ if(autoT){ clearTimeout(autoT); autoT=null; } }
function fieldTarget(fld){
  var q=game.current;
  if(q.two) return fld==="typed2"? q.rem : q.c;
  return q.answer;
}
function autoStep(check){
  cancelAuto();
  var g=game,fld=curField();
  if(String(g[fld]).length < String(fieldTarget(fld)).length) return;
  autoT=setTimeout(function(){ autoT=null; performAuto(check); }, AUTO_DELAY);
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
function padPress(k){
  var g=game; if(g.locked) return;
  var fld=curField();
  if(k==="del"){ cancelAuto(); g[fld]=g[fld].slice(0,-1); setBlankText(); return; }
  else if(k==="ok"){ cancelAuto(); submitSelf(); return; }
  else { if(g[fld].length<4) g[fld]+=k; }
  setBlankText();
  autoStep(submitSelf);
}
function evalCorrect(){
  var g=game,q=g.current;
  if(q.two) return parseInt(g.typed,10)===q.c && parseInt(g.typed2,10)===q.rem;
  return parseInt(g.typed,10)===q.answer;
}
function bothFilled(){ var g=game; return g.current.two ? (g.typed!=="" && g.typed2!=="") : (g.typed!==""); }
function submitSelf(){
  var g=game; if(g.locked) return;
  if(!bothFilled()){ nudgeEmpty(); return; }
  if(evalCorrect()){
    g.locked=true; stopTimer(); g.total++; g.stars++;
    if(!g.wrongOnce) g.firstTry++; g.wrongOnce=false;
    $("#starCount").textContent=g.stars; sndGood();
    if(!reduced) confetti(); splash("🎉","Goed zo!","");
    setTimeout(advance, reduced?500:850);
  } else {
    sndBad(); shakeBlanks(); g.wrongOnce=true;
    g.typed=""; g.typed2=""; g.active=0; setBlankText(); syncCursor();
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
      if(v===g.current.answer){ b.classList.add("good"); g.locked=true; stopTimer(); g.total++; g.stars++;
        if(!g.wrongOnce) g.firstTry++; g.wrongOnce=false; $("#starCount").textContent=g.stars; sndGood();
        if(!reduced) confetti(); splash("🎉","Goed zo!",""); setTimeout(advance, reduced?500:850);
      } else { b.classList.add("bad"); sndBad(); b.classList.add("shake"); setTimeout(function(){b.classList.remove("shake");},450); g.wrongOnce=true; }
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
  g.locked=true; stopTimer(); g.total++; g.wrongOnce=false;
  revealInTiles();
  if(g.cfg.mode==="mc" && !g.current.two){ $$(".choice").forEach(function(b){ if(parseInt(b.dataset.v,10)===g.current.answer) b.classList.add("good"); }); }
  sndTime(); splash("⏰","Tijd om!", answerText(g.current));
  setTimeout(advance, reduced?900:1700);
}
function revealInTiles(){
  var g=game,q=g.current,b1=$("#blankTile");
  if(b1){ b1.classList.add("filled"); b1.textContent = q.two? q.c : q.answer; }
  if(q.two){ var b2=$("#blankTile2"); if(b2){ b2.classList.add("filled"); b2.textContent=q.rem; } }
}
function answerText(q){ return q.two? ("Het juiste antwoord is "+q.c+" rest "+q.rem) : ("Het juiste antwoord is "+q.answer); }
function advance(){ hideSplash(); setGlow(0,"#FFD27A"); game.i++; nextQuestion(); }
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
  $("#input").innerHTML=
    '<div class="classbar">'+
      '<div class="handprompt" id="handPrompt"><span class="wave">✋</span> Wie weet het antwoord?</div>'+
      padMarkup()+
      '<div class="classctrls">'+
        (g.i>0? '<button class="bigbtn bigbtn--prev" id="cPrev" type="button" aria-label="Vorige som">←</button>':'')+
        '<button class="bigbtn bigbtn--rev" id="cReveal" type="button">Toon antwoord</button>'+
      '</div>'+
      '<div class="somcount" id="cCount"></div>'+
    '</div>';
  $$(".key").forEach(function(b){ b.onclick=function(){ classPad(b.dataset.k); }; });
  $("#cReveal").onclick=revealClass;
  var p=$("#cPrev"); if(p) p.onclick=function(){ classGo(-1); };
}
function classPad(k){
  var g=game; if(g.revealed) return;
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
  var hp=$("#handPrompt"); if(hp) hp.innerHTML='<span style="font-size:22px">🤔</span> Bijna! Denk nog eens goed na…';
}
function classCorrect(){
  var g=game; g.revealed=true; stopTimer(); setGlow(0,"#FFD27A");
  revealInTiles();
  var hp=$("#handPrompt"); if(hp) hp.innerHTML='<span style="font-size:23px">🎉</span> Juist!';
  g.classRight++; sndGood(); if(!reduced) confetti(); splash("🎉","Goed zo!","");
  var last=(g.cfg.count>0 && g.i>=g.cfg.count-1);
  setTimeout(function(){ hideSplash(); if(last) endClass(); else classGo(1); }, reduced?700:1500);
}
function revealClass(){
  var g=game; if(g.revealed) return;
  g.revealed=true; stopTimer(); setGlow(0,"#FFD27A"); revealInTiles();
  var hp=$("#handPrompt"); if(hp) hp.innerHTML='Het antwoord is <b style="color:var(--grass-deep)">'+(g.current.two?(g.current.c+" rest "+g.current.rem):g.current.answer)+'</b>';
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
function endGame(){ stopTimer(); hidePlayScreens(); $("#screenDone").classList.remove("hidden"); if(root.scrollTo) root.scrollTo(0,0); showResults(); }
function showResults(){
  var g=game, total=g.total, stars=g.stars, pct=total?Math.round(stars/total*100):0;
  var medal=pct>=90?"🏆":pct>=70?"🥇":pct>=50?"🥈":"🌱";
  var titel=pct>=90?"Wauw, knap gedaan!":pct>=70?"Goed bezig!":pct>=50?"Flink geoefend!":"Blijf oefenen!";
  $("#resultsBox").innerHTML=
    '<div class="medal">'+medal+'</div><h2>'+titel+'</h2>'+
    '<div class="score">'+stars+' van '+total+' juist</div>'+
    '<div class="breakdown">'+
      '<div class="bd"><b>'+stars+'</b><span>sterren</span></div>'+
      '<div class="bd"><b>'+g.firstTry+'</b><span>in één keer</span></div>'+
      '<div class="bd"><b>'+pct+'%</b><span>juist</span></div>'+
    '</div>'+
    '<div class="results__btns">'+
      '<button class="btn btn--grass" id="again" type="button">↻ Nog eens</button>'+
      '<button class="btn btn--ghost" id="exit" type="button">🏠 Klaar</button>'+
    '</div>';
  $("#again").onclick=function(){ startGame(g.cfg); };
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
    '<div class="block"><p class="block__label">Bewerkingen <span class="block__hint">kies één of meer</span></p><div class="ops" data-r="ops"></div></div>'+
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
    '<div class="block"><p class="block__label">Hoe antwoorden?</p><div class="chips" data-r="modes">'+
      '<button class="chip chip--wide" data-m="pad" type="button">🔢 Cijfers tikken</button>'+
      '<button class="chip chip--wide" data-m="mc" type="button">👉 Kiezen uit 4</button>'+
    '</div></div>'+
    '<div class="block"><p class="block__label">Aantal sommen</p><div class="chips" data-r="counts"></div></div>';

  var R=function(n){return host.querySelector('[data-r="'+n+'"]');};

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
    var b=chip(o.l,true); b.onclick=function(){ st.range=o.v; syncRange(); onChange(); }; R("range").appendChild(b);
  });
  function syncRange(){ $$(".chip",R("range")).forEach(function(b,i){ b.setAttribute("aria-pressed", RANGE_OPTS[i].v===st.range); }); }

  // splitsingen
  SPLIT_OPTS.forEach(function(v){
    var b=chip(v); b.onclick=function(){
      var idx=st.splits.indexOf(v); if(idx>-1) st.splits.splice(idx,1); else st.splits.push(v);
      if(!st.splits.length) st.splits.push(v); st.splits.sort(function(a,b){return a-b;});
      syncSplits(); onChange();
    }; R("splits").appendChild(b);
  });
  R("spAll").onclick=function(){ st.splits=SPLIT_OPTS.slice(); syncSplits(); onChange(); };
  R("spNone").onclick=function(){ st.splits=[10]; syncSplits(); onChange(); };
  function syncSplits(){ $$(".chip",R("splits")).forEach(function(b){ b.setAttribute("aria-pressed", st.splits.indexOf(parseInt(b.textContent,10))>-1); }); }

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
    var hasMD = st.ops.indexOf("mul")>-1 || st.ops.indexOf("div")>-1;
    var hasAS = st.ops.indexOf("add")>-1 || st.ops.indexOf("sub")>-1;
    var hasDiv = st.ops.indexOf("div")>-1;
    var hasSplit = st.ops.indexOf("split")>-1;
    var onlySplit = hasSplit && st.ops.length===1;
    R("tablesBlock").classList.toggle("hidden", !hasMD);
    R("rangeBlock").classList.toggle("hidden", !hasAS);
    R("splitBlock").classList.toggle("hidden", !hasSplit);
    R("formsBlock").classList.toggle("hidden", onlySplit); // bij splitsen is er maar één somtype
    R("restBlock").classList.toggle("hidden", !hasDiv);
    var restOn = hasDiv && st.rest;
    var mcBtn = host.querySelector('[data-m="mc"]');
    mcBtn.disabled = restOn;
    if(restOn && st.mode==="mc"){ st.mode="pad"; }
    syncModes();
  }
  function syncAll(){ syncOps(); syncTables(); syncRange(); syncSplits(); syncForms(); R("rest").setAttribute("aria-pressed",st.rest); syncTimes(); syncModes(); syncCounts(); refreshVis(); }

  syncAll();
  return { sync:syncAll };
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
  OPS:OPS, RANGE_OPTS:RANGE_OPTS, SPLIT_OPTS:SPLIT_OPTS, FORM_LABEL:FORM_LABEL
};
root.MK=api;
if(typeof module!=="undefined" && module.exports) module.exports=api;

})(typeof window!=="undefined"?window:globalThis);
