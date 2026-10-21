/* Анонимный чат под графиком. Подключается страницами игр: CPChat.init({room:'chart:es', lang:'es', onEvent:fn}).
   Работает только когда страница отдана server.mjs по http(s). Из file:// и со статического хостинга без сервера
   панель чата просто не появляется, игра работает как раньше. Весь текст из чата выводится через textContent. */
(function(){
'use strict';
var TX={
  ru:{ph:'Напиши ВВЕРХ или ВНИЗ…',send:'Отправить',rules:'Без ссылок и рекламы. 18+',rep:'Пожаловаться',reped:'Спасибо, отправлено',link:'Ссылки и контакты в чате запрещены',spam:'Похоже на спам, сообщение не отправлено',slow:'Не так быстро',dup:'Такое уже было',muted:'Чат отключён для вас до ',off:'Нет связи, переподключаюсь…',online:'онлайн',you:'вы'},
  en:{ph:'Type UP or DOWN…',send:'Send',rules:'No links or ads. 18+',rep:'Report',reped:'Thanks, reported',link:'Links and contacts are not allowed',spam:'Looks like spam, not sent',slow:'Slow down',dup:'Already said that',muted:'You are muted until ',off:'Offline, reconnecting…',online:'online',you:'you'},
  es:{ph:'Escribe SUBE o BAJA…',send:'Enviar',rules:'Sin enlaces ni publicidad. +18',rep:'Denunciar',reped:'Gracias, denunciado',link:'No se permiten enlaces ni contactos',spam:'Parece spam, no enviado',slow:'Más despacio',dup:'Ya lo dijiste',muted:'Silenciado hasta ',off:'Sin conexión, reconectando…',online:'en línea',you:'tú'},
  pt:{ph:'Escreva SOBE ou DESCE…',send:'Enviar',rules:'Sem links nem anúncios. 18+',rep:'Denunciar',reped:'Obrigado, denunciado',link:'Links e contactos não são permitidos',spam:'Parece spam, não enviado',slow:'Mais devagar',dup:'Já disse isso',muted:'Silenciado até ',off:'Sem ligação, a reconectar…',online:'online',you:'você'},
  de:{ph:'Schreibe HOCH oder RUNTER…',send:'Senden',rules:'Keine Links oder Werbung. 18+',rep:'Melden',reped:'Danke, gemeldet',link:'Links und Kontakte sind nicht erlaubt',spam:'Sieht nach Spam aus, nicht gesendet',slow:'Langsamer',dup:'Schon gesagt',muted:'Stummgeschaltet bis ',off:'Offline, verbinde neu…',online:'online',you:'du'},
  tr:{ph:'YUKARI veya AŞAĞI yaz…',send:'Gönder',rules:'Bağlantı ve reklam yok. 18+',rep:'Bildir',reped:'Teşekkürler, bildirildi',link:'Bağlantı ve iletişim bilgisi yasak',spam:'Spam gibi, gönderilmedi',slow:'Yavaş ol',dup:'Bunu zaten yazdın',muted:'Susturuldun, bitiş: ',off:'Bağlantı yok, yeniden bağlanıyor…',online:'çevrimiçi',you:'sen'},
  lv:{ph:'Raksti AUGŠĀ vai LEJĀ…',send:'Sūtīt',rules:'Bez saitēm un reklāmas. 18+',rep:'Ziņot',reped:'Paldies, paziņots',link:'Saites un kontakti nav atļauti',spam:'Izskatās pēc surogātpasta, nenosūtīts',slow:'Lēnāk',dup:'Jau teici',muted:'Izslēgts līdz ',off:'Nav savienojuma, pieslēdzas…',online:'tiešsaistē',you:'tu'},
  lt:{ph:'Rašyk AUKŠTYN arba ŽEMYN…',send:'Siųsti',rules:'Be nuorodų ir reklamos. 18+',rep:'Pranešti',reped:'Ačiū, pranešta',link:'Nuorodos ir kontaktai draudžiami',spam:'Panašu į šlamštą, neišsiųsta',slow:'Lėčiau',dup:'Jau parašei',muted:'Nutildytas iki ',off:'Nėra ryšio, jungiamasi…',online:'prisijungę',you:'tu'},
  hr:{ph:'Napiši GORE ili DOLJE…',send:'Pošalji',rules:'Bez poveznica i reklama. 18+',rep:'Prijavi',reped:'Hvala, prijavljeno',link:'Poveznice i kontakti nisu dopušteni',spam:'Izgleda kao spam, nije poslano',slow:'Polako',dup:'Već si to napisao',muted:'Utišan do ',off:'Nema veze, ponovno se spajam…',online:'online',you:'ti'},
  sr:{ph:'Napiši GORE ili DOLE…',send:'Pošalji',rules:'Bez linkova i reklama. 18+',rep:'Prijavi',reped:'Hvala, prijavljeno',link:'Linkovi i kontakti nisu dozvoljeni',spam:'Izgleda kao spam, nije poslato',slow:'Polako',dup:'Već si to napisao',muted:'Utišan do ',off:'Nema veze, ponovo se povezujem…',online:'online',you:'ti'}
};
var TX2={
  ru:{top:'Топ дня',late:'Поздно, приём прогнозов закрыт',pickdup:'Прогноз на этот раунд уже есть',nolb:'Пока нет прогнозов за сегодня',pts:'очк.',pick:'Ваш прогноз принят'},
  en:{top:'Top today',late:'Too late, picks are closed',pickdup:'You already picked this round',nolb:'No picks yet today',pts:'pts',pick:'Pick locked in'},
  es:{top:'Top de hoy',late:'Tarde, apuestas cerradas',pickdup:'Ya elegiste en esta ronda',nolb:'Aún no hay pronósticos hoy',pts:'pts',pick:'Pronóstico registrado'},
  pt:{top:'Top de hoje',late:'Tarde demais, palpites fechados',pickdup:'Já escolheu nesta ronda',nolb:'Ainda sem palpites hoje',pts:'pts',pick:'Palpite registado'},
  de:{top:'Top heute',late:'Zu spät, Tipps geschlossen',pickdup:'Du hast schon getippt',nolb:'Heute noch keine Tipps',pts:'Pkt.',pick:'Tipp gespeichert'},
  tr:{top:'Bugünün zirvesi',late:'Geç kaldın, tahminler kapandı',pickdup:'Bu tur için zaten seçtin',nolb:'Bugün henüz tahmin yok',pts:'puan',pick:'Tahmin alındı'},
  lv:{top:'Šodienas tops',late:'Par vēlu, prognozes slēgtas',pickdup:'Šajā raundā jau izvēlējies',nolb:'Šodien vēl nav prognožu',pts:'p.',pick:'Prognoze pieņemta'},
  lt:{top:'Dienos topas',late:'Per vėlu, prognozės uždarytos',pickdup:'Šiame ture jau pasirinkai',nolb:'Šiandien dar nėra prognozių',pts:'tšk.',pick:'Prognozė priimta'},
  hr:{top:'Top dana',late:'Prekasno, tipovi zatvoreni',pickdup:'Već si tipovao u ovoj rundi',nolb:'Danas još nema tipova',pts:'bod.',pick:'Tip prihvaćen'},
  sr:{top:'Top dana',late:'Prekasno, tipovi zatvoreni',pickdup:'Već si tipovao u ovoj rundi',nolb:'Danas još nema tipova',pts:'bod.',pick:'Tip prihvaćen'}
};
var CSS='#chat{width:min(100%,420px);flex:1 0 260px;display:flex;flex-direction:column;background:#0d1117;border:1px solid #1f2733;border-radius:14px;overflow:hidden;min-height:260px;max-height:70vh}'
+'#chat .hd{display:flex;justify-content:space-between;gap:8px;padding:8px 12px;font-size:12px;opacity:.7;border-bottom:1px solid #1f2733}'
+'#chat .ls{flex:1;overflow-y:auto;padding:8px 12px;display:flex;flex-direction:column;gap:6px;font-size:14px;line-height:1.35;overscroll-behavior:contain}'
+'#chat .m{word-break:break-word}#chat .m b{font-weight:700;margin-right:6px}#chat .m.me{background:#161c26;border-radius:8px;padding:2px 6px}'
+'#chat .m .rp{background:none;border:0;color:#8a93a6;cursor:pointer;font-size:12px;margin-left:6px;padding:0;opacity:.0}#chat .m:hover .rp,#chat .m:focus-within .rp{opacity:.9}'
+'@media (hover:none){#chat .m .rp{opacity:.5}}'
+'#chat .lb{flex:1;overflow-y:auto;padding:8px 12px;font-size:14px}#chat .lb div{display:flex;gap:8px;padding:3px 0}#chat .lb i{font-style:normal;opacity:.55;min-width:18px}#chat .lb span{flex:1;overflow:hidden;text-overflow:ellipsis}'
+'#chat .tb{background:none;border:1px solid #2d3748;color:#f5b83d;border-radius:8px;padding:0 8px;cursor:pointer;font-size:12px}'
+'#chat .m .ok{color:#22c55e;margin-left:4px;font-size:12px}'
+'#chat .nt{text-align:center;font-size:12px;color:#f5b83d;min-height:16px;padding:0 8px}'
+'#chat form{display:flex;gap:6px;padding:8px;border-top:1px solid #1f2733}'
+'#chat input{flex:1;min-width:0;background:#10151c;color:#fff;border:1px solid #2d3748;border-radius:10px;padding:10px;font:16px system-ui,Arial,sans-serif}'
+'#chat button.sd{background:#f5b83d;color:#111;border:0;border-radius:10px;padding:0 14px;font:700 14px system-ui,Arial,sans-serif;cursor:pointer}'
+'#chat input:disabled,#chat button.sd:disabled{opacity:.5}'
+'body.has-chat canvas{height:min(46vh,46dvh,calc((100vw - 16px)*76/54))}'
+'@media (max-height:700px) and (orientation:portrait){body.has-chat canvas{height:min(62vh,62dvh,calc((100vw - 16px)*76/54))}body.has-chat #chat{flex:none;height:320px}}'
+'@media (min-width:900px){body.has-chat #app{display:grid;grid-template-columns:auto 380px;grid-template-rows:auto 1fr;justify-content:center;align-content:center;column-gap:16px;overflow:hidden}'
+'body.has-chat canvas{height:min(calc(100vh - 170px),calc(100dvh - 170px),calc((100vw - 460px)*76/54));grid-column:1;grid-row:1}'
+'body.has-chat #ui{grid-column:1;grid-row:2}body.has-chat #chat{grid-column:2;grid-row:1/3;align-self:stretch;margin:0;max-height:none;width:auto}}'
+'@media (orientation:landscape) and (max-height:540px){body.has-chat canvas{height:min(calc(100vh - 16px),calc(100dvh - 16px));grid-column:1;grid-row:1/span 2}body.has-chat #ui{grid-column:2;grid-row:1}body.has-chat #chat{grid-column:2;grid-row:2;margin:0;width:100%;max-height:none;min-height:220px;height:auto;flex:none}}';

function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;}
function color(nick){var h=0;for(var i=0;i<nick.length;i++)h=(h*31+nick.charCodeAt(i))%360;return 'hsl('+h+',70%,66%)';}
function getToken(){try{return localStorage.getItem('cpChatToken')||'';}catch(e){return '';}}
function setToken(t){try{localStorage.setItem('cpChatToken',t);}catch(e){}}
function fmtTime(ms){var d=new Date(ms);return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}

window.CPChat={init:function(o){
  if(!/^https?:$/.test(location.protocol)||!window.WebSocket)return;
  var tx=Object.assign({},TX[o.lang]||TX.en,TX2[o.lang]||TX2.en), ev=o.onEvent||function(){};
  if(o.ph)tx.ph=String(o.ph).slice(0,60);
  var mount=document.getElementById('app');if(!mount)return;
  var st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
  var box=el('div');box.id='chat';box.hidden=true;
  var hd=el('div','hd'),hdL=el('span',null,tx.rules),hdR=el('span',null,''),tb=el('button','tb','🏆 '+tx.top);tb.type='button';tb.hidden=true;
  hd.appendChild(hdL);hd.appendChild(tb);hd.appendChild(hdR);
  var lbBox=el('div','lb');lbBox.hidden=true;var lbData=[],lbOn=false;
  function drawLb(){
    lbBox.textContent='';
    if(!lbData.length){lbBox.appendChild(el('div',null,tx.nolb));return;}
    lbData.forEach(function(r,i){var d=el('div');d.appendChild(el('i',null,String(i+1)));var n=el('span',null,r.nick+(r.nick===me?' ('+tx.you+')':''));n.style.color=color(r.nick);d.appendChild(n);d.appendChild(el('b',null,r.pts+' '+tx.pts+(r.streak>1?' 🔥'+r.streak:'')));lbBox.appendChild(d);});
  }
  tb.addEventListener('click',function(){lbOn=!lbOn;lbBox.hidden=!lbOn;ls.hidden=lbOn;if(lbOn)drawLb();else{ls.scrollTop=ls.scrollHeight;}});
  var ls=el('div','ls');ls.setAttribute('role','log');ls.setAttribute('aria-live','polite');
  var nt=el('div','nt','');
  var form=el('form'),inp=el('input'),btn=el('button','sd',tx.send);
  inp.maxLength=200;inp.placeholder=tx.ph;inp.autocomplete='off';inp.setAttribute('aria-label',tx.ph);btn.type='submit';
  form.appendChild(inp);form.appendChild(btn);
  box.appendChild(hd);box.appendChild(ls);box.appendChild(lbBox);box.appendChild(nt);box.appendChild(form);mount.appendChild(box);

  var ws=null,helloAt=0,bestRtt=1e9,syncT=0,me='',fails=0,welcomed=false,delay=1000,stick=true,noteT=0,mutedUntil=0,reported={};
  function note(t){nt.textContent=t||'';clearTimeout(noteT);if(t)noteT=setTimeout(function(){nt.textContent='';},4000);}
  ls.addEventListener('scroll',function(){stick=ls.scrollHeight-ls.scrollTop-ls.clientHeight<40;});
  function add(m){
    var row=el('div','m'+(m.nick===me?' me':''));row.dataset.id=m.id;
    var b=el('b',null,m.nick+(m.nick===me?' ('+tx.you+')':''));b.style.color=color(m.nick);
    row.appendChild(b);row.appendChild(document.createTextNode(m.text));
    if(m.pk){row.appendChild(el('span','ok','✓'));if(m.nick===me&&o.onPick&&!m.old)o.onPick(m.pk);}
    if(m.nick!==me){var r=el('button','rp','⚑');r.type='button';r.title=tx.rep;r.setAttribute('aria-label',tx.rep);r.addEventListener('click',function(){if(reported[m.id])return;reported[m.id]=1;send({t:'report',id:m.id});note(tx.reped);r.remove();});row.appendChild(r);}
    ls.appendChild(row);
    while(ls.children.length>200)ls.removeChild(ls.firstChild);
    if(stick)ls.scrollTop=ls.scrollHeight;
  }
  /* сдвиг часов сервера относительно часов устройства: берём замер с наименьшей задержкой туда-обратно */
  function sample(t0,srv,t1){
    if(!o.onSkew||!srv)return;
    var rtt=t1-t0;
    if(rtt<=bestRtt*2+50){bestRtt=Math.min(bestRtt,rtt);o.onSkew(srv+rtt/2-t1);}
  }
  function send(obj){if(ws&&ws.readyState===1)ws.send(JSON.stringify(obj));}
  function setMuted(until){mutedUntil=until;var on=until>Date.now();inp.disabled=on;btn.disabled=on;if(on)note(tx.muted+fmtTime(until));}
  function connect(){
    var url=(location.protocol==='https:'?'wss://':'ws://')+location.host+'/chat';
    try{ws=new WebSocket(url);}catch(e){return retry();}
    ws.onopen=function(){helloAt=Date.now();send({t:'hello',room:o.room,token:getToken()});};
    ws.onmessage=function(e){
      var d;try{d=JSON.parse(e.data);}catch(x){return;}
      if(o.onMsg)o.onMsg(d);
      if(d.t==='welcome'){
        sample(helloAt,d.now,Date.now());clearInterval(syncT);syncT=setInterval(function(){send({t:'sync',c:Date.now()});},30000);
        welcomed=true;fails=0;delay=1000;me=d.nick;setToken(d.token);ls.textContent='';
        d.history.forEach(function(h){h.old=true;add(h);});ls.scrollTop=ls.scrollHeight;stick=true;
        tb.hidden=!d.scored;if(o.onState)o.onState({on:true,scored:!!d.scored});
        hdR.textContent=d.online+' '+tx.online;box.hidden=false;document.body.classList.add('has-chat');note('');
        inp.disabled=false;btn.disabled=false;ev('chat_join');
      }else if(d.t==='msg')add(d.m);
      else if(d.t==='hide'){var r=ls.querySelector('[data-id="'+(+d.id)+'"]');if(r)r.remove();}
      else if(d.t==='sync')sample(d.c,d.s,Date.now());
      else if(d.t==='online')hdR.textContent=d.n+' '+tx.online;
      else if(d.t==='picked'){note(tx.pick);if(o.onPick)o.onPick(d.d);}
      else if(d.t==='result'){if(o.onResult)o.onResult(d);}
      else if(d.t==='me'){if(o.onMe)o.onMe(d);}
      else if(d.t==='lb'){lbData=d.top||[];if(lbOn)drawLb();}
      else if(d.t==='err'){
        if(d.code==='muted')setMuted(+d.until||0);
        else note(tx[d.code]||'');
      }
    };
    ws.onclose=function(){retry();};
    ws.onerror=function(){};
  }
  function retry(){
    if(!welcomed){fails++;if(fails>=2){box.hidden=true;document.body.classList.remove('has-chat');return;}}   // сервера чата нет: тихо остаёмся без чата
    else{note(tx.off);inp.disabled=true;btn.disabled=true;if(o.onState)o.onState({on:false,scored:false});}
    setTimeout(connect,delay);delay=Math.min(delay*2,30000);
  }
  form.addEventListener('submit',function(e){
    e.preventDefault();var t=inp.value.trim();if(!t||mutedUntil>Date.now())return;
    send({t:'msg',text:t});inp.value='';ev('chat_send');
  });
  api.send=send;
  connect();
}, pick:function(d){return api.send?(api.send({t:'pick',d:d}),true):false;}};
var api=window.CPChat;
})();
