/* Ядро гонки: трасса, детерминированная физика, анализ, характеры и реплики. Общее для страницы (рисует) и сервера (решает, кто победил).
   Классический скрипт: в браузере кладёт CPRace в window, на сервере его читает vm. Используются только + - * / sqrt, поэтому результат одинаков везде.
   Менять физику и генерацию трассы нельзя без пересчёта: golden-хэш в test-race.mjs поймает любое изменение. */
(function(g){
'use strict';
var DT=1/120,WW=200,R=13,G=170,DEFLEN=3000,LEN=DEFLEN,FLOOR=LEN+70,VMAX=190;
var DEFNAMES=['bitcoin','ethereum','solana','doge','xrp','cardano','tether','bnb','ton','pepe','shiba','avax','chainlink','litecoin','moon','hodl','wagmi','degen','chad','whale','rekt','pump','dump','fomo','lambo','sats'];
function setLen(n){LEN=n|0;FLOOR=LEN+70;}
function getLen(){return LEN;}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function clamp(x,a,b){return x<a?a:x>b?b:x;}
function tri(x){x=x-Math.floor(x);return x<0.5?x*2:2-x*2;}

/* ---------- трасса ---------- */
function buildTrack(seed){
  var rng=mulberry32((seed>>>0)^0x51ed270b),pegs=[],segs=[],sl=[],pads=[],ports=[],zones=[],y=170,row=0,i,W9=[],tw=0;
  for(i=0;i<9;i++){W9.push(0.25+rng()*1.75);tw+=W9[i];}
  var dens=0.8+rng()*0.55;
  while(y<LEN-170){
    var pk=rng()*tw,type=0;while(type<8&&pk>W9[type]){pk-=W9[type];type++;}
    if(type===0){
      for(var r2=0;r2<2;r2++)for(i=0;i<(r2?2:3);i++){pegs.push({x:r2?WW*(0.375+i*0.25):WW*(0.25+i*0.25),y:y+r2*30,r:6,e:0.55});}
      y+=62;
    }else if(type===1){
      var gap=37+rng()*18;
      segs.push({x1:0,y1:y,x2:WW/2-gap/2,y2:y+34},{x1:WW,y1:y,x2:WW/2+gap/2,y2:y+34});
      y+=50;
    }else if(type===2){
      pegs.push({x:46,y:y,r:11,e:1.18,b:1},{x:WW/2,y:y+30,r:11,e:1.18,b:1},{x:WW-46,y:y,r:11,e:1.18,b:1});
      y+=62;
    }else if(type===3){
      sl.push({y:y,len:34,th:4.5,x0:40,x1:WW-40,sp:0.1+rng()*0.1,ph:rng()});
      y+=40;
    }else if(type===7){
      zones.push({k:'belt',y:y,h:34,dir:rng()<0.5?-1:1});
      y+=40;
    }else if(type===8){
      zones.push({k:'mud',y:y,h:38,dir:0});
      y+=44;
    }else if(type===5){
      pads.push({x:40+rng()*(WW-80),y:y,w:56});
      y+=34;
    }else if(type===6){
      var wk=rng()<0.5,px0=44+rng()*(WW-88);
      ports.push({x:px0,y:y,r:15,k:wk?'warp':'oops',dy:wk?(110+rng()*60):-(80+rng()*40),ex:WW-px0});
      y+=64;
    }else{
      var d=(row%2)?1:-1,x1=d>0?0:WW,x2=d>0?WW*0.6:WW*0.4;
      segs.push({x1:x1,y1:y,x2:x2,y2:y+40});
      y+=56;
    }
    row++;y+=(70+rng()*34)*dens;
  }
  /* гарантируем интригу: минимум два портала и финальный «пробой» у самого финиша */
  var fyw=[0.35,0.62],fk=['warp','oops'];
  while(ports.length<2){var qi=ports.length;ports.push({x:70+qi*100,y:LEN*fyw[qi],r:15,k:fk[qi],dy:fk[qi]==='warp'?150:-110,ex:WW-(70+qi*100)});}
  ports.push({x:WW/2,y:LEN-230,r:20,k:'oops',dy:-130,ex:WW/2});
  pads.push({x:WW/2,y:LEN-120,w:70});
  var knives=[];for(i=0;i<3;i++)knives.push({x:40+rng()*(WW-80),y:LEN*(0.2+i*0.22+rng()*0.1)});
  return {pegs:pegs,segs:segs,sl:sl,pads:pads,ports:ports,zones:zones,knives:knives};
}
function slx(s,t){return s.x0+(s.x1-s.x0)*tri(t*s.sp+s.ph);}

/* ---------- физика ---------- */
function newSim(seed,deg){
  var rng=mulberry32((seed>>>0)^0x7e57ab1e),tr=buildTrack(seed),ms=[],i;
  for(i=0;i<8;i++)ms.push({x:30+(i%4)*(WW-60)/3,y:44+(i>>2)*30+rng()*3,vx:(rng()-0.5)*14,vy:0,fin:null,trail:[],id:i,used:{},pt:-9,allin:0,knife:0,dead:0,deadT:0});
  return {seed:seed,deg:deg||[],ev3:[],t:0,tr:tr,ms:ms,camY:60,ev:[],ev2:[],kt:{},y2:0,kills:0,rp:null,lastOv:-9,cool:{},lead:-1,leadChanges:0,order:[],lastLeadAt:-9,finN:0,tick:0,stuck:{}};
}
function segHit(m,ax,ay,bx,by,th,e,vsx,sim){
  var dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy,tt=l2>0?((m.x-ax)*dx+(m.y-ay)*dy)/l2:0;tt=clamp(tt,0,1);
  var cx=ax+dx*tt,cy=ay+dy*tt,px=m.x-cx,py=m.y-cy,d2=px*px+py*py,rr_=R+th;
  if(d2>=rr_*rr_)return;
  var d=Math.sqrt(d2),nx,ny;if(d<1e-6){nx=0;ny=-1;d=0;}else{nx=px/d;ny=py/d;}
  m.x=cx+nx*rr_;m.y=cy+ny*rr_;
  var rvx=m.vx-vsx,rvy=m.vy,vn=rvx*nx+rvy*ny;
  if(vn<0){rvx-=(1+e)*vn*nx;rvy-=(1+e)*vn*ny;m.vx=vsx+rvx*0.985;m.vy=rvy*0.985;if(-vn>55)sim.ev.push({t:sim.t,id:m.id,mag:-vn,x:m.x,y:m.y});}
}
function step(sim){
  var ms=sim.ms,tr=sim.tr,i,j,k,m,t=sim.t;
  for(i=0;i<8;i++){
    m=ms[i];if(m.dead)continue;
    var gp=clamp((sim.lead>=0?ms[sim.lead].y-m.y:0)/130,0,1.6),vm_=VMAX*(1+0.9*gp);
    if(i===sim.lead){var g2=clamp((m.y-sim.y2-50)/120,0,1);gp=-0.35*g2;vm_=VMAX*(1-0.15*g2);}
    m.vy+=G*DT*(1+1.5*gp);m.vx*=0.9997;m.vy*=0.9997;
    var sp=Math.sqrt(m.vx*m.vx+m.vy*m.vy);if(sp>vm_){m.vx*=vm_/sp;m.vy*=vm_/sp;}
    if(m.knife>t){var nb=-1,nd=1e9,oo;for(oo=0;oo<8;oo++){if(oo===i||ms[oo].dead||ms[oo].fin!==null)continue;var qx=ms[oo].x-m.x,qy=ms[oo].y-m.y,qd=qx*qx+qy*qy;if(qd<nd){nd=qd;nb=oo;}}
      if(nb>=0&&nd<14000&&nd>1){var dq=Math.sqrt(nd);m.vx+=(ms[nb].x-m.x)/dq*300*DT;m.vy+=(ms[nb].y-m.y)/dq*300*DT;}}
    m.x+=m.vx*DT;m.y+=m.vy*DT;
    if(m.x<R){m.x=R;if(m.vx<0)m.vx=-m.vx*0.5;}
    if(m.x>WW-R){m.x=WW-R;if(m.vx>0)m.vx=-m.vx*0.5;}
    if(m.y>FLOOR-R){m.y=FLOOR-R;if(m.vy>0)m.vy=-m.vy*0.35;m.vx*=0.96;}
    for(k=0;k<tr.zones.length;k++){var zn=tr.zones[k];if(Math.abs(m.y-zn.y)<zn.h/2){if(zn.k==='belt')m.vx+=zn.dir*260*DT;else{m.vx*=0.985;m.vy*=0.982;if(!m.used['z'+k]){m.used['z'+k]=1;sim.ev3.push({t:t,id:i,k:'scam'});}}}}
    for(k=0;k<tr.pegs.length;k++){
      var p=tr.pegs[k],dy=m.y-p.y;if(dy>R+p.r+1||dy<-(R+p.r+1))continue;
      var dx=m.x-p.x,d2=dx*dx+dy*dy,rs=R+p.r;
      if(d2<rs*rs){
        var d=Math.sqrt(d2),nx,ny;if(d<1e-6){nx=0;ny=-1;d=0;}else{nx=dx/d;ny=dy/d;}
        m.x=p.x+nx*rs;m.y=p.y+ny*rs;
        var vn=m.vx*nx+m.vy*ny;
        if(vn<0){m.vx-=(1+p.e)*vn*nx;m.vy-=(1+p.e)*vn*ny;if(-vn>(p.b?30:55))sim.ev.push({t:t,id:m.id,mag:-vn*(p.b?1.4:1),x:m.x,y:m.y});}
      }
    }
    for(k=0;k<tr.segs.length;k++){
      var s=tr.segs[k];if(m.y<Math.min(s.y1,s.y2)-R-4||m.y>Math.max(s.y1,s.y2)+R+4)continue;
      segHit(m,s.x1,s.y1,s.x2,s.y2,2.5,0.45,0,sim);
    }
    for(k=0;k<tr.sl.length;k++){
      var q=tr.sl[k];if(m.y<q.y-R-6||m.y>q.y+R+6)continue;
      var cxs=slx(q,t),vsx=(slx(q,t+DT)-cxs)/DT;
      segHit(m,cxs-q.len,q.y,cxs+q.len,q.y,q.th,0.5,vsx,sim);
    }
  }
  for(i=0;i<8;i++){m=ms[i];if(m.dead)continue;
    for(k=0;k<tr.knives.length;k++){var kn=tr.knives[k];if(sim.kt[k]||m.knife>t||Math.abs(m.y-kn.y)>R+8)continue;var kdx=m.x-kn.x,kdy=m.y-kn.y;if(kdx*kdx+kdy*kdy<(R+9)*(R+9)){sim.kt[k]=1;m.knife=t+6;sim.ev3.push({t:t,id:i,k:'knife'});}}
    for(k=0;k<tr.pads.length;k++){var pd=tr.pads[k];if(m.used['p'+k])continue;if(Math.abs(m.y-pd.y)<9&&Math.abs(m.x-pd.x)<pd.w/2){m.used['p'+k]=1;m.vy+=170;sim.ev3.push({t:t,id:i,k:'boost'});}}
    for(k=0;k<tr.ports.length;k++){var po=tr.ports[k];if(t-m.pt<1.5||m.used['q'+k]||Math.abs(m.y-po.y)>po.r)continue;var pdx=m.x-po.x,pdy=m.y-po.y;
      if(pdx*pdx+pdy*pdy<po.r*po.r){m.pt=t;m.used['q'+k]=1;m.x=clamp(po.ex,R,WW-R);m.y=po.y+po.dy;m.vx*=0.5;sim.ev3.push({t:t,id:i,k:po.k});m.trail.length=0;break;}}
  }
  for(i=0;i<8;i++)for(j=i+1;j<8;j++){
    var a=ms[i],b=ms[j],ddx=b.x-a.x,ddy=b.y-a.y;if(a.dead||b.dead||ddy>2*R||ddy<-2*R)continue;
    var dd2=ddx*ddx+ddy*ddy;if(dd2>=4*R*R)continue;
    var dd=Math.sqrt(dd2),nnx,nny;if(dd<1e-6){nnx=1;nny=0;dd=0;}else{nnx=ddx/dd;nny=ddy/dd;}
    var ov=(2*R-dd)/2;a.x-=nnx*ov;a.y-=nny*ov;b.x+=nnx*ov;b.y+=nny*ov;
    var rvn=(b.vx-a.vx)*nnx+(b.vy-a.vy)*nny;
    if(rvn<0){var jn=-(1+0.86)*rvn/2;a.vx-=jn*nnx;a.vy-=jn*nny;b.vx+=jn*nnx;b.vy+=jn*nny;if(-rvn>70)sim.ev.push({t:t,id:i,mag:-rvn*0.8,x:(a.x+b.x)/2,y:(a.y+b.y)/2});}
    var kk=a.knife>t&&b.fin===null&&b.y>150?a:(b.knife>t&&a.fin===null&&a.y>150?b:null);
    if(kk){var vv=kk===a?b:a;vv.dead=1;vv.deadT=t;vv.vx=(vv.x<WW/2?-1:1)*140;vv.vy=-90;kk.knife=0;sim.kills++;sim.ev3.push({t:t,id:kk.id,k:'stab',v:vv.id});sim.ev.push({t:t,id:kk.id,mag:420,x:vv.x,y:vv.y});}
  }
  /* финиш, лидер, камера, застрявшие */
  var lead=-1,ly=-1,ay=0,y2=-1;
  var na=0;
  for(i=0;i<8;i++){m=ms[i];if(m.dead)continue;na++;if(m.fin===null&&m.y>=LEN){m.fin=t+DT;sim.finN++;m.rank=sim.finN;}
    if(m.y>ly){y2=ly;ly=m.y;lead=i;}else if(m.y>y2)y2=m.y;ay+=m.y;
    if(sim.tick%12===0){m.trail.push([m.x,m.y]);if(m.trail.length>9)m.trail.shift();}}
  if(lead!==sim.lead){if(sim.lead>=0&&ms[lead].y-ms[sim.lead].y>7&&t-sim.lastLeadAt>0.4&&ly>300&&ly<LEN-200){sim.leadChanges++;sim.lastLeadAt=t;}if(sim.lead<0||ms[lead].y-ms[sim.lead].y>7)sim.lead=lead;}
  sim.y2=y2;var target=(ly*0.6+(ay/Math.max(1,na))*0.4)-4;sim.camY+=(target-sim.camY)*0.05;if(sim.camY<ly-120)sim.camY=ly-120;
  if(sim.tick%6===0){
    var od=[0,1,2,3,4,5,6,7].sort(function(a,b){return ms[b].y-ms[a].y;}),rn=[0,0,0,0,0,0,0,0];
    for(i=0;i<8;i++)rn[od[i]]=i;
    if(sim.rp&&t>0.5){
      for(i=0;i<8;i++){var ra=rn[i],rpv=sim.rp[i];
        if(ra<rpv&&ra<7){var b=od[ra+1];
          if(sim.rp[b]<rpv&&ms[i].y-ms[b].y>5&&ms[i].y>200&&ms[i].y<LEN-60&&t-sim.lastOv>0.55&&t-(sim.cool[b]||-9)>2.0&&ms[i].fin===null&&ms[b].fin===null&&!ms[i].dead&&!ms[b].dead){
            sim.ev2.push({t:t,w:i,l:b,r:ra});sim.lastOv=t;sim.cool[b]=t;}}}
    }
    sim.rp=rn;
    for(i=0;i<8;i++){m=ms[i];if(!m.dead&&sim.deg[i]&&!m.allin&&t>3&&m.y>LEN*0.3&&m.y<LEN-320&&rn[i]>=5){m.allin=1;m.vy+=250;sim.ev3.push({t:t,id:i,k:'allin'});}}
  }
  sim.tick++;
  if(sim.tick%180===0){for(i=0;i<8;i++){m=ms[i];var pm=sim.stuck[i];if(!m.dead&&m.fin===null&&pm!==undefined&&m.y-pm<6){m.vx+=(m.x<WW/2?1:-1)*150;m.vy-=70;}sim.stuck[i]=m.y;}}
  sim.t+=DT;
}
function advance(sim,to){var n=0;while(sim.t<to-1e-9&&n<100000){step(sim);n++;}}


function analyze(seed,deg){
  var s=newSim(seed,deg),guard=0;
  var spSum=0,spN=0;
  while(s.finN<3&&s.t<60&&guard++<10000){advance(s,s.t+0.5);if(s.finN<1&&s.t>3){var al=s.ms.filter(function(m){return !m.dead;}).map(function(m){return m.y;}).sort(function(x,y){return y-x;});if(al.length>=5){spSum+=al[0]-al[4];spN++;}}}
  var f=s.ms.map(function(m){return m.fin===null?99:m.fin;}),idx=[0,1,2,3,4,5,6,7].sort(function(a,b){return f[a]-f[b];});
  var pc=0;s.ev3.forEach(function(x){if((x.k==='warp'||x.k==='oops')&&x.t<f[idx[0]])pc++;});
  return {win:idx[0],tf:f[idx[0]],gap:f[idx[1]]-f[idx[0]],lc:s.leadChanges,pc:pc,kc:s.kills,fn:s.finN,sp:spN?spSum/spN:0};
}

/* характеры: у каждого свои фразы и внешний вид. Для неизвестных имён (из чата) характер выбирается по хэшу имени */
var PERS={
  chad:{acc:'shades',lose:['nah. fine','fuck, again?','not like this','lag. 100% lag','who pushed me','temporary setback','it is fine. fine.','that peg was crooked'],win:['ez','too easy','see ya','built different','eat my dust','skill issue','wave to me from back there'],oops:['fuck. no','that was on purpose','did not see that','my line, my rules'],warp:['called it','as planned','calculated'],over:['sit down'],idle:['just cruising','another day, another W','i do this daily','cardio','catch me if you can','smooth'],allin:['full send','watch this']},
  degen:{acc:'band',lose:['fuck fuck fuck','one more try','mom, i broke it','i should have braked','who put that there','rematch. now','everything or nothing'],win:['lol noob','floor it','too slow, bro','full throttle baby','touch grass'],oops:['shit.. again','bad idea. do it again','why am i like this'],warp:['LFG','speed baby','faster faster'],allin:['FULL SEND','NO BRAKES','no fear','hold my beer'],over:['sent it'],idle:['no brakes, no regrets','who needs a plan','one more lap','drive it like you stole it','go go go']},
  hodl:{acc:'gem',lose:['still rolling','not giving up fuck','i will catch up','just a bump','i will not stop','slow and steady, ok?'],win:['steady wins','never lost my line','told you to hang on','patience'],oops:['i keep rolling anyway','i did not see it','still in this'],warp:['told u','patience pays','steady'],over:['steady'],idle:['steady steady','not slowing down','see you at the finish','stay calm, keep rolling','tortoise energy'],allin:['hold the line']},
  pepe:{acc:'tears',lose:['feels bad man','fuck my life','why always me','of course it is me','this is fine','the bump is mine'],win:['ez win... wait','feels good man','is this real','lol ok'],oops:['of course','fuck','classic me'],warp:['wait what','no way','am i winning?'],over:['sorry'],idle:['reeee','sad but rolling','just a frog','ribbit','please let me win once'],allin:['ribbit, full send']},
  whale:{acc:'spout',lose:['i got bumped, fuck','small fish','just a shortcut for you','whale down','i let you win','i was resting'],win:['splash','sorry little ones','move over, shrimp','out of my way','too big to stop'],oops:['accidental swerve','slippage','ice on the track'],warp:['coming through','big wave','make way'],over:['move shrimp'],idle:['i am bigger than all of you','heavy and fast','big wave coming','nobody passes me','watch the splash'],allin:['all my weight']},
  wagmi:{acc:'smile',lose:['we r gonna make it','fuck.. we got this','still positive','this is just a bump','still fun anyway'],win:['yes!','we all win','love this race','gg team'],oops:['still positive','all good, all good','temporary'],warp:['wooo','told you','up we go'],over:['gg gg'],idle:['lets go team','good luck frens','be nice, racers','everyone is a winner','good vibes only'],allin:['believe!']},
  rekt:{acc:'xeyes',lose:['done.','fuck, again','unlucky as always','knocked out again','rip me'],win:['wait, me?','is this real','did i win?','must be a bug'],oops:['i knew it','fuck','of course'],warp:['huh','how','suspicious'],over:['oh?'],idle:['pain','i have seen things','here we go again','bad luck is my brand','down bad'],allin:['why not']},
  bear:{acc:'ears',lose:['told u so','shit','it was inevitable','knew this would happen','you all crash anyway'],win:['you are all slowing down','nobody finishes','called it','grr'],oops:['called it','as expected','this is the way down'],warp:['fuck no','it is a trap','too good to be true'],over:['grr'],idle:['someone will crash','this track is cursed','you will not finish','bad vibes ahead','slow down, idiots'],allin:['reckless, all of you']}
};
var PKEYS=['chad','degen','hodl','pepe','whale','wagmi','rekt','bear'];
var PMAP={bitcoin:'chad',ethereum:'wagmi',solana:'degen',xrp:'whale',cardano:'hodl',tether:'hodl',bnb:'chad',ton:'wagmi',shiba:'pepe',avax:'bear',chainlink:'hodl',litecoin:'bear',moon:'wagmi',pepe:'pepe',rekt:'rekt',hodl:'hodl',wagmi:'wagmi',degen:'degen',chad:'chad',ape:'degen',bull:'wagmi',bear:'bear',gm:'wagmi',lambo:'chad',pump:'degen',dump:'rekt',whale:'whale',fomo:'degen',doge:'pepe',shib:'pepe',sats:'hodl',alpha:'chad'};
function persOf(name,used){
  var key=PMAP[name];
  if(!key){var h=0,i;for(i=0;i<name.length;i++)h=(h*31+name.charCodeAt(i))>>>0;key=PKEYS[h%8];}
  return key;
}
function censor(txt,mode){return mode==='full'?txt:txt.replace(/fuck/g,'f*ck').replace(/shit/g,'sh*t');}
var DEAD=['knocked out. fuck','sliced. seriously?','i was winning fuck','this is bs','et tu, brute?','not the knife','tell my family','i was so close','cheap shot','send help','that was my spot'],KILL=['out of my way','nothing personal','sorry, not sorry','gotcha','one less rival','thanks for the space','gg','just business','next','bye bye'],GOTK=['got the blade','sharp','come here','you are next','who wants some','free knife!','i am the hunter now','i got a knife, fuck you'],SCAM=['stuck in the mud. fuck','too sticky','my wheels!','mud everywhere','slow motion again','why is this sticky','i am a snail now','is this glue? fuck'],RUG=['wrong way','teleported backwards','shit, a trap','who moved the track','lost my spot','that portal lied','spun right around','no no no, not that one'],PUMPL=['warp speed','zoom','shortcut!','up we go','boost time','see you at the finish','hold on tight','new gear unlocked'],
REACT=['ouch','brutal','that was clean','who is next','not me please','i saw nothing','respect','RIP','savage','did that just happen','knife meta is real','keep your distance','watch out for the blade'],
IDLE=['who is leading','where is the finish','this track is long','watch the pegs','tight race','nobody is safe','i smell victory','my wheels are hot','keep your distance','careful with the knives','stay out of my lane','i can see the lead','somebody is gonna crash','this is intense'];
function pick(arr,h){return arr[h%arr.length];}
function speechList(ev2,ev3,mode,names,tEnd){
  /* реплики: обгон, портал, ALL IN. Проигравший ругается, выигравший подкалывает; текст берётся из характера шарика */
  var out=[],i,e,h,txt,pr;
  if(mode==='off')return out;
  function add(t,id,kind,arr,h){txt=pick(arr,h);out.push({t:t,id:id,text:censor(txt,mode),bad:/fuck|shit/.test(txt),kind:kind});}
  for(i=0;i<ev2.length;i++){
    e=ev2[i];h=((Math.floor(e.t*1000)*2654435761)^(e.l*40503)^(i*9973))>>>0;
    add(e.t,e.l,'lose',PERS[persOf(names[e.l])].lose,h);
    if(h%3!==0)add(e.t+0.12,e.w,'win',PERS[persOf(names[e.w])].win,h>>>5);
  }
  for(i=0;i<ev3.length;i++){
    e=ev3[i];if(e.t>tEnd||e.k==='boost')continue;h=((Math.floor(e.t*1000)*2246822519)^(e.id*40503)^(i*3266489917))>>>0;
    pr=PERS[persOf(names[e.id])];
    if(e.k==='allin')add(e.t,e.id,'win',pr.allin||pr.win,h);
    else if(e.k==='stab'){add(e.t,e.v,'lose',DEAD,h);add(e.t+0.15,e.id,'win',KILL,h>>>4);var wi=(h>>>9)%8;if(wi!==e.v&&wi!==e.id&&names[wi]&&(h>>>3)%3!==0)add(e.t+0.6,wi,'win',REACT,h>>>11);}
    else if(e.k==='knife')add(e.t,e.id,'win',GOTK,h);
    else if(e.k==='scam')add(e.t,e.id,'lose',SCAM,h);
    else if(e.k==='warp')add(e.t,e.id,'win',pr.warp.concat(PUMPL),h);
    else add(e.t,e.id,'lose',pr.oops.concat(RUG),h);
  }
  /* болтовня между событиями: каждые ~2 с кто-то из живых говорит своё, не перебивая остальных */
  var dead={};for(i=0;i<ev3.length;i++)if(ev3[i].k==='stab')dead[ev3[i].v]=ev3[i].t;
  var tt,ci=0;for(tt=2.4;tt<tEnd-0.8;tt+=2.1){
    h=((Math.floor(tt*1000)*2654435761)^(ci*40503))>>>0;ci++;var id=h%8,tries=0;
    while(tries<8&&(dead[id]!==undefined&&dead[id]<=tt+1.1)){id=(id+1)%8;tries++;}
    if(tries>=8||!names[id])continue;
    var busy=false;for(i=0;i<out.length;i++)if(Math.abs(out[i].t-tt)<1.0||out[i].id===id&&Math.abs(out[i].t-tt)<2.0){busy=true;break;}
    if(busy)continue;
    var pi=PERS[persOf(names[id])];add(tt,id,'win',(h>>>7)%3===0?IDLE:pi.idle,h>>>13);
  }
  out.sort(function(a,b){return a.t-b.t;});
  return out;
}

/* вариант гонки подбирается перебором: смены лидера, порталы, плотный финиш, длительность в окне [tmin,tmax] */
function planIter(seed,names,o){
  o=o||{};
  var pers=names.map(function(n){return persOf(n);}),deg=pers.map(function(p){return p==='degen';});
  var st={v:0,best:null,done:false,max:o.max||60,seed:seed,deg:deg,pers:pers,tmin:o.tmin||21,tmax:o.tmax||28,gmin:0.08,gmax:o.gmax||0.9,lc:o.lc==null?3:o.lc,pcmin:o.pcmin==null?2:o.pcmin};
  st.next=function(){
    if(st.done)return st;
    var v=st.v++,a=analyze(st.seed*131+v,st.deg);
    var score=(a.tf>=st.tmin&&a.tf<=st.tmax?0:10)+(a.gap>=st.gmin&&a.gap<=st.gmax?0:4)+Math.max(0,st.lc-a.lc)+(a.pc>=st.pcmin?0:3)+(a.sp<=230?0:Math.min(6,(a.sp-230)/60))+(a.fn>=3?0:20)+(a.kc>=1?0:2)+(a.kc<=3?0:3);
    if(!st.best||score<st.best.score)st.best={score:score,v:v,a:a,simSeed:st.seed*131+v};
    if(score===0||st.v>=st.max)st.done=true;
    return st;
  };
  return st;
}
function plan(seed,names,o){var st=planIter(seed,names,o);while(!st.done)st.next();return {simSeed:st.best.simSeed,win:st.best.a.win,tf:st.best.a.tf,gap:st.best.a.gap,lc:st.best.a.lc,pc:st.best.a.pc,deg:st.deg,pers:st.pers,score:st.best.score};}

/* замедление перед финишем: live=true мягче, чтобы цикл 40 с не переполнялся */
function warpOf(a,live){var gg=a.gap,L=live?0.9:1.0,f=live?(gg<0.2?0.45:gg<0.45?0.5:0.6):(gg<0.2?0.3:gg<0.45?0.38:0.5);return {a:Math.max(0.5,a.tf-0.8),L:L,f:f,pfin:gg<0.45,extra:L/f-L};}
g.CPRace={warpOf:warpOf,DEFLEN:DEFLEN,setLen:setLen,getLen:getLen,WW:WW,R:R,DT:DT,DEFNAMES:DEFNAMES,mulberry32:mulberry32,clamp:clamp,tri:tri,slx:slx,buildTrack:buildTrack,newSim:newSim,advance:advance,analyze:analyze,
  PERS:PERS,persOf:persOf,censor:censor,speechList:speechList,planIter:planIter,plan:plan};
})(typeof globalThis!=='undefined'?globalThis:this);
