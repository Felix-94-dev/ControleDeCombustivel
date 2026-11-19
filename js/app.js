const KEY="controle-combustivel-v1",$=s=>document.querySelector(s),
esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])),
fresh=()=>({veiculos:[],motoristas:[],fornecedores:[],lancamentos:[],combustiveis:["DIESEL S10","DIESEL S500","GASOLINA","ETANOL"].map((nome,i)=>({id:i+1,codigo:i+1,nome}))}),
nf=(n,d=2)=>(+n).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d}),
dt=s=>s.split("-").reverse().join("/"),
by=(a,b)=>a.data.localeCompare(b.data)||a.id-b.id,
get=(t,id)=>db[t].find(x=>x.id==id),
nid=n=>Math.max(0,...db[n].map(o=>o.id))+1,
sum=(a,k)=>a.reduce((s,l)=>s+l[k],0),
MES=["","jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"],
PAL=["#1E7F55","#2F6DB5","#E9A800","#B4568A","#6B7A74","#7A5CB0"],
ENT={
 veiculos:{t:"Veículos",u:["frota","placa"],f:[{k:"frota",l:"Frota",n:1,r:1,lock:1},{k:"placa",l:"Placa",up:1,r:1},{k:"modelo",l:"Marca e modelo"},{k:"local",l:"Local de operação"},{k:"kmInicial",l:"KM inicial",n:1},{k:"motoristaId",l:"Motorista",sel:"motoristas"},{k:"ativo",l:"Ativo",chk:1}]},
 motoristas:{t:"Motoristas",u:["nome"],f:[{k:"nome",l:"Nome",r:1},{k:"ativo",l:"Ativo",chk:1}]},
 combustiveis:{t:"Combustíveis",u:["codigo"],f:[{k:"codigo",l:"Código",n:1,r:1,lock:1},{k:"nome",l:"Nome",up:1,r:1}]},
 fornecedores:{t:"Fornecedores",u:["codigo"],f:[{k:"codigo",l:"Código",n:1,r:1,lock:1},{k:"nome",l:"Nome",up:1,r:1}]}};
// Camada de dados: só load() e save() tocam o armazenamento.
// Com js/config.js preenchido usa o Supabase (login + banco); sem ele, funciona local (localStorage) para testes.
const CFG=window.SUPABASE_CONFIG||{},REMOTE=!!(CFG.url&&CFG.anonKey&&window.supabase),
sb=REMOTE?supabase.createClient(CFG.url,CFG.anonKey):null,
TABELAS=["motoristas","combustiveis","fornecedores","veiculos","lancamentos"], // ordem respeita as chaves estrangeiras
snake=k=>k.replace(/[A-Z]/g,c=>"_"+c.toLowerCase()),camel=k=>k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),
conv=(o,fn)=>Object.fromEntries(Object.entries(o).map(([k,v])=>[fn(k),v]));
let db,snap={},fila=Promise.resolve(),user=null;
if(!REMOTE){try{db=JSON.parse(localStorage.getItem(KEY))}catch{}user=localStorage.getItem("cc-user")||sessionStorage.getItem("cc-user")}
db=db||fresh();
let ed=0,pre=0;
const S={v:null,anos:new Set,meses:new Set,comb:"",forn:"",q:"",roll:0};
const tira=()=>{snap={};for(const t of TABELAS){snap[t]=new Map(db[t].map(r=>[r.id,JSON.stringify(r)]))}};
async function load(){
 const d={};
 for(const t of TABELAS){d[t]=[];for(let i=0;;i+=1000){const{data,error}=await sb.from(t).select("*").order("id").range(i,i+999);if(error)throw error;d[t].push(...data.map(r=>conv(r,camel)));if(data.length<1000)break}}
 db=d;tira()}
// Envia só o que mudou desde o último load/save (inclusões, alterações e exclusões), em fila.
function sync(){
 const up={},del={};
 for(const t of TABELAS){const at=new Map(db[t].map(r=>[r.id,r]));
  up[t]=db[t].filter(r=>snap[t].get(r.id)!==JSON.stringify(r));
  del[t]=[...snap[t].keys()].filter(id=>!at.has(id))}
 tira();
 fila=fila.then(async()=>{
  for(const t of[...TABELAS].reverse())if(del[t].length){const{error}=await sb.from(t).delete().in("id",del[t]);if(error)throw error}
  for(const t of TABELAS)if(up[t].length){const{error}=await sb.from(t).upsert(up[t].map(r=>conv(r,snake)));if(error)throw error}
 }).catch(e=>{console.error(e);toast("Erro ao gravar no banco: "+(e.message||e)+". Recarregue a página.",1)})}
const save=()=>{if(REMOTE)return sync();try{localStorage.setItem(KEY,JSON.stringify(db))}catch{toast("Não foi possível gravar neste navegador. Exporte um backup.",1)}};
function toast(m,bad){const t=$("#toast");t.textContent=m;t.className=bad?"bad":"";t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,bad?6000:3500)}

// KM rodado e km/L por veículo, ignorando lançamentos com hodômetro quebrado
function stats(ls){const g={};ls.forEach(l=>(g[l.veiculoId]??=[]).push(l));let km=0,L=0;
 for(const a of Object.values(g)){const v=a.filter(l=>!l.quebrado).sort(by);if(v.length<2)continue;const k=v.at(-1).km-v[0].km;if(k>0){km+=k;L+=sum(v.slice(1),"litros")}}
 return{km,kml:km>0&&L>0?km/L:0}}
const ultimo=(v,data,ignora)=>{const a=db.lancamentos.filter(l=>l.veiculoId===v.id&&!l.quebrado&&l.data<=data&&l.id!==ignora).sort(by).at(-1);return a?a.km:v.kmInicial};

// Cadastros (veículos, motoristas, combustíveis, fornecedores)
const cell=(f,r)=>f.chk?(r[f.k]?"Ativo":"Inativo"):f.sel?(get(f.sel,r[f.k])?.nome??"Sem vínculo"):r[f.k];
const fld=f=>f.chk?`<label class=chk><input type=checkbox name=${f.k} checked> ${f.l}</label>`:`<label>${f.l}${f.sel?`<select name=${f.k}><option value="">Sem vínculo${db[f.sel].map(o=>`<option value=${o.id}>${esc(o.nome)}`).join("")}</select>`:`<input name=${f.k}${f.n?" type=number min=0 inputmode=numeric":""}${f.r?" required":""}>`}</label>`;
// Ordenação: clique no título da coluna (1º clique crescente, 2º decrescente)
const ORD={lancamentos:{k:"data",d:-1},veiculos:{k:"0",d:1},motoristas:{k:"0",d:1},combustiveis:{k:"0",d:1},fornecedores:{k:"0",d:1}},
cmp=(a,b)=>typeof a==="number"&&typeof b==="number"?a-b:String(a??"").localeCompare(String(b??""),"pt",{numeric:true}),
th=(n,k,l,cls="")=>{const o=ORD[n],on=String(o.k)===String(k);return`<th${cls?` class=${cls}`:""} tabindex=0 data-a=ord data-n=${n} data-k=${k} aria-sort="${on?(o.d>0?"ascending":"descending"):"none"}">${l}${on?(o.d>0?" ▲":" ▼"):""}`},
DICA=`<p class=dica>Dê dois cliques em uma linha para editar ou excluir.</p>`,
BDEL=`<button type=button class=del data-a=del hidden>Excluir</button>`;
function ctable(n,q=""){const c=ENT[n],o=ORD[n],rows=db[n].map(r=>({r,c:c.f.map(f=>cell(f,r))})).filter(x=>x.c.join(" ").toLowerCase().includes(q.toLowerCase())).sort((a,b)=>cmp(a.c[o.k],b.c[o.k])*o.d||cmp(a.c[0],b.c[0]));
 return rows.length?`<div class=panel><div class="scroll cards"><table><tr>${c.f.map((f,i)=>th(n,i,f.l)).join("")}${rows.map(x=>`<tr tabindex=0 data-e=1 data-n=${n} data-id=${x.r.id}>${x.c.map((v,i)=>`<td data-l="${c.f[i].l}">${esc(v)}`).join("")}`).join("")}</table></div></div>`:`<p class=empty>Nada encontrado.</p>`}
const crud=n=>{const c=ENT[n];return`<h1>${c.t}</h1><form class="panel grid" data-f=crud data-n=${n}>${c.f.map(fld).join("")}<button class=go>Salvar</button><button type=button data-a=clear>Limpar</button>${BDEL}</form>${DICA}<input class=search type=search data-i=q data-n=${n} placeholder="Pesquisar em ${c.t.toLowerCase()}" aria-label="Pesquisar"><div id=tb>${ctable(n)}</div>`};
function salvaCrud(f){const n=f.dataset.n,c=ENT[n],fd=new FormData(f),r={};
 c.f.forEach(x=>{const v=fd.get(x.k);r[x.k]=x.chk?v!==null:x.sel?(v?+v:null):x.n?(+v||0):x.up?v.trim().toUpperCase():v.trim()});
 for(const x of c.f)if(x.r&&!r[x.k])return toast(`${x.l} é obrigatório.`,1);
 for(const k of c.u)if(db[n].some(o=>o.id!==ed&&String(o[k]).toLowerCase()===String(r[k]).toLowerCase()))return toast(`${c.f.find(x=>x.k===k).l} já cadastrado.`,1);
 ed?Object.assign(get(n,ed),r):db[n].push({id:nid(n),...r});
 save();toast(ed?"Alterado.":"Cadastrado.");ed=0;route()}

// Lançamentos
const rot=o=>`${o.codigo} – ${o.nome}`,
achar=(t,txt)=>{const x=txt.trim().toLowerCase();return db[t].find(o=>[rot(o),String(o.codigo),o.nome].some(s=>s.toLowerCase()===x))},
opts=t=>db[t].map(o=>`<option value="${esc(rot(o))}">`).join(""),
ultData=()=>{let d;try{d=localStorage.getItem("cc-data")}catch{}return d||new Date().toLocaleDateString("sv-SE")};
const lanc=()=>`<h1>Lançamentos</h1><form class="panel grid" data-f=lanc data-n=lancamentos>
<label>Frota<input name=frota type=number min=1 required inputmode=numeric data-i=frota></label>
<div class=info id=info></div>
<label>Data<input name=data type=date required value="${ultData()}"></label>
<label>KM atual<input name=km type=number min=0 inputmode=numeric required></label>
<label class=chk><input type=checkbox name=quebrado data-i=quebrado> Hodômetro quebrado</label>
<label>Litros<input name=litros type=number step=0.01 min=0.01 required inputmode=decimal></label>
<label>Combustível<input name=combustivel list=dl-comb required autocomplete=off placeholder="Código ou nome"><datalist id=dl-comb>${opts("combustiveis")}</datalist></label>
<label>Fornecedor<input name=fornecedor list=dl-forn required autocomplete=off placeholder="Código ou nome"><datalist id=dl-forn>${opts("fornecedores")}</datalist></label>
<label>Nota fiscal<input name=nf></label><label>Série<input name=serie></label>
<button class=go>Cadastrar</button><button type=button data-a=clear>Limpar</button>${BDEL}</form>${DICA}
<div class=bar><input class=search type=search data-i=lq placeholder="Pesquisar por frota, placa, motorista, fornecedor ou nota" aria-label="Pesquisar lançamentos"><label class=chk><input type=checkbox id=oq data-i=lq> Só hodômetro quebrado</label></div><div id=tb></div>`;
const SV={data:l=>l.data,frota:l=>get("veiculos",l.veiculoId).frota,placa:l=>get("veiculos",l.veiculoId).placa,motorista:l=>get("motoristas",l.motoristaId)?.nome,km:l=>l.quebrado?-1:l.km,litros:l=>l.litros,comb:l=>get("combustiveis",l.combustivelId)?.nome,forn:l=>get("fornecedores",l.fornecedorId)?.nome,nf:l=>l.nf},
H=[["Data","data"],["Frota","frota"],["Placa","placa"],["Motorista","motorista"],["KM","km","r"],["Litros","litros","r"],["Combustível","comb"],["Fornecedor","forn"],["Nota","nf"]];
function lrows(ls,edit){return ls.length?`<div class=panel><div class="scroll cards"><table><tr>${edit?H.map(h=>th("lancamentos",h[1],h[0],h[2])).join(""):"<th>Data<th>Frota<th>Placa<th>Motorista<th class=r>KM<th class=r>Litros<th>Combustível<th>Fornecedor<th>Nota"}</tr>`+ls.map(l=>{const v=get("veiculos",l.veiculoId);return`<tr${edit?` tabindex=0 data-e=1 data-n=lancamentos data-id=${l.id}`:""}><td data-l=Data>${dt(l.data)}<td data-l=Frota>${v.frota}<td data-l=Placa>${esc(v.placa)}<td data-l=Motorista>${esc(get("motoristas",l.motoristaId)?.nome)}<td class=r data-l=KM>${l.quebrado?`<span class=tag>Quebrado</span>`:nf(l.km,0)}<td class=r data-l=Litros>${nf(l.litros)}<td data-l=Combustível>${esc(get("combustiveis",l.combustivelId)?.nome)}<td data-l=Fornecedor>${esc(get("fornecedores",l.fornecedorId)?.nome)}<td data-l=Nota>${esc(l.nf)}${l.serie?"/"+esc(l.serie):""}`}).join("")+`</table></div></div>`:`<p class=empty>Nenhum lançamento encontrado.</p>`}
function lrefresh(){const o=ORD.lancamentos,v=db.veiculos.find(x=>x.frota==$("[name=frota]").value),q=$(".search").value.toLowerCase(),oq=$("#oq").checked;
 $("#tb").innerHTML=lrows(db.lancamentos.filter(l=>{const x=get("veiculos",l.veiculoId);return(!v||l.veiculoId===v.id)&&(!oq||l.quebrado)&&[x.frota,x.placa,get("motoristas",l.motoristaId)?.nome,get("fornecedores",l.fornecedorId)?.nome,l.nf].join(" ").toLowerCase().includes(q)}).sort((a,b)=>cmp(SV[o.k](a),SV[o.k](b))*o.d||b.id-a.id).slice(0,100),1)}
function finfo(){const f=$("[name=frota]"),v=db.veiculos.find(x=>x.frota==f.value);
 $("#info").innerHTML=!f.value?"Informe a frota.":!v?`<b class=badtxt>Frota não encontrada.</b>`:!v.ativo?`<b class=badtxt>Frota inativa.</b>`:`<b>${esc(v.placa)}</b> ${esc(v.modelo)}<br>${esc(get("motoristas",v.motoristaId)?.nome??"Sem motorista vinculado")}<br>KM anterior: ${nf(ultimo(v,"9999",0),0)}`;lrefresh()}
function salvaLanc(f){const fd=Object.fromEntries(new FormData(f)),v=db.veiculos.find(x=>x.frota==fd.frota&&x.ativo);
 if(!v)return toast("Frota não encontrada ou inativa.",1);
 if(!v.motoristaId)return toast("Este veículo não tem motorista vinculado. Vincule em Veículos.",1);
 const cb=achar("combustiveis",fd.combustivel),fn=achar("fornecedores",fd.fornecedor);
 if(!cb)return toast("Combustível inválido. Escolha uma opção da lista.",1);
 if(!fn)return toast("Fornecedor inválido. Escolha uma opção da lista.",1);
 const q=!!fd.quebrado,km=q?0:+fd.km;
 if(!q){const ant=ultimo(v,fd.data,ed);if(!(km>ant))return toast(`O KM informado (${nf(km||0,0)}) precisa ser maior que o KM anterior (${nf(ant,0)}).`,1)}
 const r={veiculoId:v.id,motoristaId:v.motoristaId,data:fd.data,km,litros:+fd.litros,combustivelId:cb.id,fornecedorId:fn.id,nf:fd.nf.trim(),serie:fd.serie.trim(),quebrado:q};
 ed?Object.assign(get("lancamentos",ed),r):db.lancamentos.push({id:nid("lancamentos"),...r});
 if(!ed)try{localStorage.setItem("cc-data",fd.data)}catch{}
 save();toast(ed?"Lançamento alterado.":"Abastecimento cadastrado.");ed=0;route();
 $("[name=serie]").value=fd.serie;$("[name=frota]").focus()}

// Painel
const chip=(a,id,on,t)=>`<button class=chip data-a=${a} data-id="${id}" aria-pressed=${on}>${t??id}</button>`;
function vchips(){const q=S.q.toLowerCase();return chip("pick","all",S.v==="all","Frota toda")+db.veiculos.filter(x=>db.lancamentos.some(l=>l.veiculoId===x.id)&&`${x.frota} ${x.placa} ${x.modelo} ${get("motoristas",x.motoristaId)?.nome??""}`.toLowerCase().includes(q)).sort((a,b)=>a.frota-b.frota).map(x=>chip("pick",x.id,S.v===x.id,`${x.frota} – ${esc(x.placa)}`)).join("")}
function chart(d,line,fmt,t){const W=560,H=210,P=30,m=Math.max(...d.map(x=>x[1]),1),w=(W-2*P)/d.length,y=v=>H-28-v/m*(H-70),x=i=>P+w*i+w/2,pts=d.map((p,i)=>[i,p[1]]).filter(p=>p[1]>0);
 return`<svg viewBox="0 0 ${W} ${H}" role=img aria-label="${t}">`+(line?`<polyline fill=none stroke="var(--ln)" stroke-width=3 points="${pts.map(p=>x(p[0])+","+y(p[1])).join(" ")}"/>`:"")+d.map((p,i)=>(p[1]>0?(line?`<circle cx=${x(i)} cy=${y(p[1])} r=4.5 fill="var(--ln)"/>`:`<rect x=${x(i)-w*.35} y=${y(p[1])} width=${w*.7} height=${H-28-y(p[1])} rx=2 fill="var(--ok)"/>`)+`<text class=v x=${x(i)} y=${y(p[1])-8} text-anchor=middle>${fmt(p[1])}</text>`:"")+`<text x=${x(i)} y=${H-8} text-anchor=middle>${p[0]}</text>`).join("")+`</svg>`}
function dash(){
 if(!db.lancamentos.length)return`<h1>Painel</h1><div class=panel><p class=empty>Nenhum abastecimento lançado ainda. Cadastre em Lançamentos ou veja o painel com dados de exemplo.</p><button class=go data-a=demo>Carregar dados de exemplo</button></div>`;
 if(S.v===null){S.v=db.veiculos.find(v=>db.lancamentos.some(l=>l.veiculoId===v.id))?.id??"all";S.anos=new Set([Math.max(...db.lancamentos.map(l=>+l.data.slice(0,4)))])}
 const L=db.lancamentos.filter(l=>S.v==="all"||l.veiculoId===S.v),yr=l=>+l.data.slice(0,4),mo=l=>+l.data.slice(5,7),
 anos=[...new Set(L.map(yr))].sort((a,b)=>b-a),meses=[...new Set(L.map(mo))].sort((a,b)=>a-b);
 if(S.anos.size&&!anos.some(a=>S.anos.has(a)))S.anos=new Set([anos[0]]);
 if(S.meses.size&&!meses.some(m=>S.meses.has(m)))S.meses.clear();
 const base=L.filter(l=>(!S.anos.size||S.anos.has(yr(l)))&&(!S.meses.size||S.meses.has(mo(l)))),
 gt=base.filter(l=>(!S.comb||l.combustivelId==S.comb)&&(!S.forn||l.fornecedorId==S.forn)),
 st=stats(base),v=S.v==="all"?null:get("veiculos",S.v),tot=sum(gt,"litros"),nq=base.filter(l=>l.quebrado).length,
 last=[...L].sort(by).at(-1),dead=!!v&&last.quebrado,
 digs=(dead?"––––––":String(v?last.km:0).padStart(6,"0")).split("").map(d=>`<b>${d}</b>`).join(""),
 keys=[...new Set(base.map(l=>l.data.slice(0,7)))].sort(),lab=k=>MES[+k.slice(5)]+(S.anos.size===1?"":"/"+k.slice(2,4)),
 d1=keys.map(k=>[lab(k),sum(gt.filter(l=>l.data.startsWith(k)),"litros")]),d2=keys.map(k=>[lab(k),stats(base.filter(l=>l.data.startsWith(k))).kml]),
 por=db.combustiveis.map((c,i)=>({c,i,L:sum(gt.filter(l=>l.combustivelId===c.id),"litros")})),
 vazio=`<p class=empty>Sem lançamentos neste filtro.</p>`,roll=S.roll?" roll":"";S.roll=0;
 return`<h1>Painel</h1>
<div class=panel><input class=search type=search data-i=dq value="${esc(S.q)}" placeholder="Pesquisar veículo por frota, placa, modelo ou motorista" aria-label="Pesquisar veículo"><div id=vc class=chips>${vchips()}</div></div>
<div class=panel><div class=frow>
<fieldset><legend>Ano</legend><div class=chips>${anos.map(a=>chip("ano",a,S.anos.has(a))).join("")}</div></fieldset>
<fieldset><legend>Mês</legend><div class=chips>${meses.map(m=>chip("mes",m,S.meses.has(m),MES[m])).join("")}</div></fieldset>
<label>Combustível<select data-i=comb><option value="">Todos${db.combustiveis.map(o=>`<option value=${o.id}${S.comb==o.id?" selected":""}>${esc(o.nome)}`).join("")}</select></label>
<label>Fornecedor<select data-i=forn><option value="">Todos${db.fornecedores.map(o=>`<option value=${o.id}${S.forn==o.id?" selected":""}>${esc(o.nome)}`).join("")}</select></label></div>
<small>Sem ano ou mês marcado, vale todo o histórico. Combustível e fornecedor filtram litros e valores; o km por litro usa todos os abastecimentos do período.</small></div>
<section class="panel hero"><div><span class=big>${v?"Frota "+v.frota:"Frota toda"}</span>${v?`<span class=plate>${esc(v.placa)}</span><div>${esc(v.modelo)}<br>${esc(get("motoristas",v.motoristaId)?.nome??"Sem motorista")}</div>`:`<div>${db.veiculos.filter(x=>db.lancamentos.some(l=>l.veiculoId===x.id)).length} veículos com lançamentos</div>`}</div>
${v?`<div><div class="odo${dead?" dead":""}${roll}" role=img aria-label="${dead?"Hodômetro quebrado":"KM atual "+nf(last.km,0)}">${digs}</div><small>${dead?"Hodômetro quebrado no último lançamento":"KM atual"}</small></div>`:""}
<div class=fig><b>${nf(st.km,0)}</b><span>km rodados</span></div>
<div class=fig><b>${nf(st.kml)}</b><span>km por litro</span></div>
<div class=fig><b>${nf(tot)}</b><span>litros</span></div></section>
${nq?`<p class=warn><span class=lamp></span>${nq} lançamento${nq>1?"s":""} com hodômetro quebrado ${nq>1?"ficam":"fica"} fora do cálculo de km por litro. <button class=link data-a=goQ>Ver lançamentos</button></p>`:""}
<section class=panel><h2>Litros por combustível</h2>${tot?`<div class=stack>${por.filter(p=>p.L).map(p=>`<i style="flex:${p.L};background:${PAL[p.i%PAL.length]}"></i>`).join("")}</div>`:""}<div class=leg>${por.map(p=>`<span><i class=sw style="background:${PAL[p.i%PAL.length]}"></i>${esc(p.c.nome)} <b>${nf(p.L)} L</b>${tot?" ("+nf(p.L/tot*100,0)+"%)":""}</span>`).join("")}</div></section>
<div class=two><section class=panel><h2>Litros por mês</h2>${keys.length?chart(d1,0,x=>nf(x,0),"Litros por mês"):vazio}</section>
<section class=panel><h2>Consumo médio por mês (km por litro)</h2>${keys.length?chart(d2,1,x=>nf(x),"Km por litro por mês"):vazio}</section></div>
<h2>Últimos lançamentos do filtro</h2>${lrows([...gt].sort((a,b)=>by(b,a)).slice(0,8))}`}

// Backup
const bk=()=>`<h1>Backup</h1><div class=panel><p>${REMOTE?"Os dados ficam salvos no banco (Supabase). Mesmo assim, exporte uma cópia de vez em quando.":"Os dados ficam salvos neste navegador. Exporte uma cópia com frequência e guarde fora do computador."}</p><textarea id=js rows=8 aria-label="Conteúdo do backup" placeholder="O backup aparece aqui"></textarea><div class=btns><button class=go data-a=exp>Exportar backup</button><label class=file>Escolher arquivo<input type=file accept=".json" data-i=file hidden></label><button data-a=imp>Restaurar do conteúdo acima</button></div></div>`;

function demo(){if(REMOTE)return toast("Dados de exemplo só no modo local.",1);let r=7;const R=()=>(r=r*16807%2147483647)/2147483647,p2=n=>String(n).padStart(2,"0");let i=0;
 db=fresh();
 db.motoristas=["JOÃO DA SILVA","MARCOS PEREIRA","ANTÔNIO LIMA","CARLOS SOUZA"].map((nome,k)=>({id:k+1,nome,ativo:true}));
 db.fornecedores=[{id:1,codigo:1,nome:"POSTO RODOVIA"},{id:2,codigo:2,nome:"TANQUE DA FAZENDA"}];
 [[101,"QAB1C23","VW CONSTELLATION 17.230","LAVOURA",1,52000,3.1],[102,"RKT4E56","TOYOTA HILUX","ADMINISTRAÇÃO",1,38000,8.4],[103,"PLM7G89","FIAT STRADA","OFICINA",3,21000,10.8],[104,"SVE2H34","VW SAVEIRO","ALMOXARIFADO",4,15000,7.2]].forEach(([frota,placa,modelo,local,cb,ki,kpl],k)=>{
  db.veiculos.push({id:k+1,frota,placa,modelo,local,kmInicial:ki,motoristaId:k+1,ativo:true});let km=ki;
  for(let m=6;m<=11;m++)for(const d of[3,13,23]){if(m==11&&d>19)continue;const inc=380+R()*240,lt=+(inc/kpl).toFixed(2),qb=frota==103&&(m==8||m==9);km+=inc;
   db.lancamentos.push({id:++i,veiculoId:k+1,motoristaId:k+1,data:`2026-${p2(m)}-${p2(d)}`,km:qb?0:Math.round(km),litros:lt,combustivelId:cb,fornecedorId:R()<.6?1:2,nf:String(1000+i),serie:"1",quebrado:qb})}});
 S.v=null;S.meses.clear();save();route()}

// Onde cada cadastro é usado (impede excluir o que tem vínculo)
const USO={veiculos:[["lancamentos","veiculoId"]],motoristas:[["veiculos","motoristaId"],["lancamentos","motoristaId"]],combustiveis:[["lancamentos","combustivelId"]],fornecedores:[["lancamentos","fornecedorId"]]};
const tog=(s,x)=>s.has(x)?s.delete(x):s.add(x);
const A={
 demo,
 sair(){if(REMOTE)sb.auth.signOut();localStorage.removeItem("cc-user");sessionStorage.removeItem("cc-user");user=null;delete document.body.dataset.auth;location.hash="";$("main").innerHTML="";$("#login input").focus()},
 clear(){ed=0;route()},
 ord(el){const n=el.dataset.n,k=el.dataset.k,o=ORD[n];ORD[n]=String(o.k)===k?{k,d:-o.d}:{k,d:1};n==="lancamentos"?lrefresh():$("#tb").innerHTML=ctable(n,$(".search").value);
  const h=$(`th[data-n=${n}][data-k="${k}"]`);if(h)h.focus()},
 del(){if(!ed)return;const n=$("main form").dataset.n,uso=USO[n]?.map(([t,c])=>db[t].filter(x=>x[c]===ed).length).reduce((a,b)=>a+b,0)||0;
  if(uso)return toast(`Não é possível excluir: este cadastro é usado em ${uso} registro(s).${db[n][0]&&"ativo"in db[n][0]?" Desmarque \"Ativo\" em vez de excluir.":""}`,1);
  if(!confirm("Excluir este registro? Essa ação não pode ser desfeita."))return;
  db[n]=db[n].filter(x=>x.id!==ed);save();toast("Excluído.");ed=0;route()},
 edit(el){const n=el.dataset.n,r=get(n,el.dataset.id),f=$("main form");ed=r.id;
  if(n==="lancamentos"){f.frota.value=get("veiculos",r.veiculoId).frota;["data","km","litros","nf","serie"].forEach(k=>f[k].value=r[k]||"");f.combustivel.value=rot(get("combustiveis",r.combustivelId));f.fornecedor.value=rot(get("fornecedores",r.fornecedorId));f.quebrado.checked=r.quebrado;f.km.disabled=r.quebrado;f.frota.readOnly=true;finfo()}
  else ENT[n].f.forEach(x=>{const e=f[x.k];x.chk?e.checked=r[x.k]:e.value=r[x.k]??"";if(x.lock)e.readOnly=true});
  const b=f.querySelector(".go");b.textContent="Alterar";b.classList.add("ed");f.querySelector("[data-a=del]").hidden=false;f.scrollIntoView({block:"nearest"})},
 pick(el){S.v=el.dataset.id==="all"?"all":+el.dataset.id;S.roll=1;route()},
 ano(el){tog(S.anos,+el.dataset.id);route()},
 mes(el){tog(S.meses,+el.dataset.id);route()},
 goQ(){pre=1;location.hash="lancamentos"},
 exp(){const j=JSON.stringify(db);$("#js").value=j;const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([j],{type:"application/json"}));a.download=`Backup_ControleFrota_${new Date().toISOString().slice(0,16).replace(/[-:T]/g,"")}.json`;a.click()},
 imp(el){if(!el.dataset.c){el.dataset.c=1;el.textContent="Clique de novo para substituir todos os dados";return}
  try{const d=JSON.parse($("#js").value);if(!Object.keys(fresh()).every(k=>Array.isArray(d[k])))throw 0;db=d;S.v=null;S.meses.clear();save();toast("Backup restaurado.");route()}
  catch{toast("Conteúdo de backup inválido.",1);el.textContent="Restaurar do conteúdo acima";delete el.dataset.c}}};
const I={
 frota:finfo,lq:lrefresh,mostra(t){t.form.senha.type=t.checked?"text":"password"},
 quebrado(t){t.form.km.disabled=t.checked;if(t.checked)t.form.km.value=""},
 q(t){$("#tb").innerHTML=ctable(t.dataset.n,t.value)},
 dq(t){S.q=t.value;$("#vc").innerHTML=vchips()},
 comb(t){S.comb=t.value;route()},forn(t){S.forn=t.value;route()},
 file(t){t.files[0]?.text().then(x=>$("#js").value=x)}};
let ultimoClique={};
document.addEventListener("click",e=>{
 const tr=e.target.closest("tr[data-e]");
 if(tr){const k=tr.dataset.n+":"+tr.dataset.id,t=Date.now();if(ultimoClique.k===k&&t-ultimoClique.t<450){ultimoClique={};A.edit(tr)}else ultimoClique={k,t};return}
 const el=e.target.closest("[data-a]");if(el)A[el.dataset.a](el)});
document.addEventListener("keydown",e=>{if(e.key!=="Enter")return;const t=e.target;if(t.matches("tr[data-e]"))A.edit(t);else if(t.matches("th[data-a]"))A.ord(t)});
document.addEventListener("input",e=>{const i=e.target.dataset.i;if(i)I[i](e.target)});
document.addEventListener("submit",e=>{e.preventDefault();({lanc:salvaLanc,crud:salvaCrud,login:entrar})[e.target.dataset.f](e.target)});

// Login: Supabase Auth (e-mail e senha) quando configurado; senão, usuário de teste local.
// Usuário sem @ vira usuario@DOMINIO (o Supabase exige formato de e-mail, mas ninguém precisa de e-mail real).
const DOM=CFG.dominio||"frota.app",mail=u=>{u=u.trim().toLowerCase();return u.includes("@")?u:u+"@"+DOM},nomeDe=e=>e.split("@")[0],
USERS={felix:{nome:"Felix",senha:"123456"}},sess=()=>user;
async function entrar(f){$("#lerr").hidden=true;const b=f.querySelector(".go");
 if(REMOTE){b.disabled=true;
  const{data,error}=await sb.auth.signInWithPassword({email:mail(f.usuario.value),password:f.senha.value});b.disabled=false;
  if(error){$("#lerr").hidden=false;f.senha.value="";f.senha.focus();return}
  f.reset();f.senha.type="password";return iniciar(nomeDe(data.user.email))}
 const u=USERS[f.usuario.value.trim().toLowerCase()];
 if(!u||u.senha!==f.senha.value){$("#lerr").hidden=false;f.senha.value="";f.senha.focus();return}
 localStorage.setItem("cc-user",u.nome);f.reset();f.senha.type="password";iniciar(u.nome)}
async function iniciar(nome){
 if(REMOTE)try{await load()}catch(e){console.error(e);toast("Não foi possível carregar os dados: "+(e.message||e),1);return}
 user=nome;document.body.dataset.auth=1;$("#nome").textContent=nome;route()}

const PG={painel:dash,lancamentos:lanc,veiculos:()=>crud("veiculos"),motoristas:()=>crud("motoristas"),combustiveis:()=>crud("combustiveis"),fornecedores:()=>crud("fornecedores"),backup:bk};
function route(){const p=PG[location.hash.slice(1)]?location.hash.slice(1):"painel";
 $("main").innerHTML=PG[p]();document.body.dataset.p=p;
 document.querySelectorAll("nav a").forEach(a=>a.hash.slice(1)===p?a.setAttribute("aria-current","page"):a.removeAttribute("aria-current"));
 if(p==="lancamentos"){if(pre){$("#oq").checked=true;if(S.v!==null&&S.v!=="all")$("[name=frota]").value=get("veiculos",S.v).frota;pre=0}finfo();if(matchMedia("(pointer:fine)").matches)$("[name=frota]").focus()}}
onhashchange=()=>{ed=0;if(sess())route()};
(async()=>{
 if(REMOTE){const{data}=await sb.auth.getSession();if(data.session)return iniciar(nomeDe(data.session.user.email))}
 else if(user)return iniciar(user);
 if(matchMedia("(pointer:fine)").matches)$("#login input").focus()})();
