/* Общее ядро: всё, что определяет исход раунда. Его читают и страницы (рисуют), и сервер (считает очки).
   Классический скрипт без модулей: в браузере кладёт CPEngine в window, на сервере загружается через vm.
   Менять формулы нельзя без пересчёта роликов: golden-хэши в test-engine.mjs поймают любое расхождение. */
(function(g){
'use strict';
function hash(seed,k){var x=(Math.imul(k|0,374761393)+Math.imul(seed|0,668265263))|0;x=Math.imul(x^(x>>>13),1274126177);x=x^(x>>>16);return((x>>>0)/4294967296)*2-1;}
function h01(seed,k){return(hash(seed,k)+1)/2;}
function vnoise(seed,x){var i=Math.floor(x),f=x-i,u=f*f*(3-2*f);return hash(seed,i)*(1-u)+hash(seed,i+1)*u;}

/* общий эфир: одно время для всех, отсчёт от этой даты; живой эфир всегда на seed 1 */
var EPOCH=Date.UTC(2026,9,21)/1000, LIVE_SEED=1;

/* chart: раунд 14 с, прогноз принимается до 9.5 с, итог на 10 с */
var OCT=[[18,1.0],[7,0.6],[2.6,0.34],[0.9,0.2],[0.3,0.1]];
var chart={P:14,PRED:10,LOCK:9.5,
  price:function(seed,T){var s=0;for(var i=0;i<OCT.length;i++)s+=OCT[i][1]*vnoise(seed+i*101,T/OCT[i][0]+i*37.7);return 1000+16*s;},
  roundInfo:function(seed,r){var t0=r*chart.P,line=chart.price(seed,t0),end=chart.price(seed,t0+chart.PRED);return{r:r,t0:t0,line:line,end:end,dir:end>=line?1:-1,margin:Math.abs(end-line)};},
  length:14, lock:9.5, resolveAt:10,
  /* исход раунда как +1 / -1 и очки за верный прогноз */
  outcome:function(seed,r){return chart.roundInfo(seed,r).dir;},
  points:function(outcome){return 1;}
};

/* rekt: эпизод 12 с, прогноз до 6.7 с, удар на 7.0 с, итог на 7.8 с; выживает примерно каждый 17-й */
var rekt={E:12,TI:7.0,P_SURVIVE:0.06,
  survives:function(seed,e){return h01(seed*31+1,e)<rekt.P_SURVIVE;},
  length:12, lock:6.7, resolveAt:7.8,
  /* +1 выжил, -1 разбился. Угадать «REKT» почти всегда легко, поэтому очки идут по коэффициенту: редкий исход стоит дороже */
  outcome:function(seed,e){return rekt.survives(seed,e)?1:-1;},
  points:function(outcome){return outcome===1?16:1;}
};

/* слова-прогнозы в чате: +1 / -1 (ЗАГЛАВНЫМИ, без знаков). Должны совпадать с TXT в страницах, это проверяет test-engine.mjs */
var WORDS={
  chart:{
    '1':['UP','ВВЕРХ','SUBE','SOBE','HOCH','YUKARI','AUGŠĀ','AUKŠTYN','GORE','▲','⬆'],
    '-1':['DOWN','ВНИЗ','BAJA','DESCE','RUNTER','AŞAĞI','LEJĀ','ŽEMYN','DOLJE','DOLE','▼','⬇']
  },
  rekt:{
    '1':['SURVIVE','ДОЕДЕТ','SOBREVIVE','ÜBERLEBT','KURTULUR','IZDZĪVOS','IŠGYVENS','PREŽIVI'],
    '-1':['REKT','РЕКТ']
  }
};
/* превращает «  Up!! » в 1, «down» в -1, всё остальное в 0 */
function parsePick(game,text){
  var w=WORDS[game];if(!w)return 0;
  var t=String(text).normalize('NFKC').toUpperCase().replace(/[\s.!?,;:'"()\[\]¡¿…\-_*#]+/g,' ').trim();
  if(t.length>16)return 0;
  if(w['1'].indexOf(t)>=0)return 1;
  if(w['-1'].indexOf(t)>=0)return -1;
  return 0;
}
/* текущий раунд по общему времени (секунды) */
function clock(game,nowSec){
  var d=game==='rekt'?rekt:chart,T=nowSec-EPOCH,r=Math.floor(T/d.length);
  return{r:r,u:T-r*d.length};
}

g.CPEngine={hash:hash,h01:h01,vnoise:vnoise,EPOCH:EPOCH,LIVE_SEED:LIVE_SEED,chart:chart,rekt:rekt,WORDS:WORDS,parsePick:parsePick,clock:clock};
})(typeof globalThis!=='undefined'?globalThis:this);
