'use strict';
const APP_VERSION='8.0.1';
const STORE_KEY='firearmCatalogV5';
const CLOUD_CONFIG_KEY='firearmCatalogCloudConfigV1';
const DEFAULT_CLOUD_CONFIG={url:'https://pffjakkbrhaoqmheqogx.supabase.co',key:'sb_publishable_uXnq4YVP4FwehfzjPzk2oQ_qvJuWEBS'};
let state={firearms:[],ammo:[],maintenance:[],settings:{theme:'light',pinHash:'',migrated:false},meta:{updatedAt:''}};
let cloudClient=null,cloudUser=null,cloudChannel=null,syncTimer=null,isApplyingCloud=false,localDirty=false,lastCloudWriteAt='',syncInProgress=false,realtimeSyncTimer=null;
let accessoryDraft=[],photoDraft=[],docDraft=[];
const $=id=>document.getElementById(id);
const uid=()=>crypto.randomUUID?crypto.randomUUID():'id-'+Date.now()+'-'+Math.random().toString(16).slice(2);
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n)||0);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);
function toast(msg){$('toast').textContent=msg;$('toast').classList.remove('hidden');setTimeout(()=>$('toast').classList.add('hidden'),2600)}
function save(){
 try{
  state.meta={...(state.meta||{}),updatedAt:new Date().toISOString()};
  localStorage.setItem(STORE_KEY,JSON.stringify(state));
  localDirty=!isApplyingCloud;
  renderAll();
  if(!isApplyingCloud)scheduleCloudSave();
  return true;
 }catch(e){
  console.error(e);
  alert('The record could not be saved on this device. Remove very large photos/documents and try again. Details: '+e.message);
  return false;
 }
}

function cloudConfig(){try{return JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY)||'null')||DEFAULT_CLOUD_CONFIG}catch{return DEFAULT_CLOUD_CONFIG}}
function setSyncStatus(text,kind=''){const el=$('syncStatus');if(!el)return;el.textContent=text;el.className='sync-pill '+kind}
function catalogCounts(c=state){return{firearms:Array.isArray(c?.firearms)?c.firearms.length:0,ammo:Array.isArray(c?.ammo)?c.ammo.length:0,maintenance:Array.isArray(c?.maintenance)?c.maintenance.length:0}}
function hasCatalogRecords(c=state){const n=catalogCounts(c);return n.firearms+n.ammo+n.maintenance>0}
function formatSyncTime(value){if(!value)return'Never';const d=new Date(value);return Number.isNaN(d.getTime())?'Unknown':d.toLocaleString()}
function renderCloudAccount(){
 const info=$('cloudAccountInfo');if(!info)return;
 if(!cloudConfig()){info.textContent='Cloud sync is not configured. Your records remain on this device.';setSyncStatus('Local only','warn')}
 else if(!cloudUser){info.textContent='Cloud connection saved. Sign in to synchronize devices.';setSyncStatus('Sign in','warn')}
 else{
  const n=catalogCounts();
  info.textContent=`Signed in as ${cloudUser.email}. This device has ${n.firearms} firearm${n.firearms===1?'':'s'}, ${n.ammo} ammunition entr${n.ammo===1?'y':'ies'}, and ${n.maintenance} maintenance record${n.maintenance===1?'':'s'}. Last cloud sync: ${formatSyncTime(lastCloudWriteAt||state.meta?.lastCloudSync)}.`;
  if(!navigator.onLine)setSyncStatus('Offline','warn');
 }
 $('signOutBtn')?.classList.toggle('hidden',!cloudUser)
}
async function initCloud(){const cfg=cloudConfig();if(!cfg?.url||!cfg?.key||!window.supabase){renderCloudAccount();return}try{cloudClient=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});const {data:{session}}=await cloudClient.auth.getSession();cloudUser=session?.user||null;let authReady=false;cloudClient.auth.onAuthStateChange(async(event,session)=>{cloudUser=session?.user||null;renderCloudAccount();if(!cloudUser)return;if(event==='TOKEN_REFRESHED'||event==='USER_UPDATED')return;if(authReady&&event==='INITIAL_SESSION')return;authReady=true;await subscribeCloud();await safeCloudSync(false)});renderCloudAccount();if(cloudUser){authReady=true;await subscribeCloud();await safeCloudSync(false)}}catch(e){console.error(e);setSyncStatus('Cloud error','err');$('cloudAccountInfo').textContent='Connection error: '+e.message}}
async function subscribeCloud(){
 if(!cloudClient||!cloudUser)return;
 if(cloudChannel)await cloudClient.removeChannel(cloudChannel);
 cloudChannel=cloudClient.channel('catalog-'+cloudUser.id)
  .on('postgres_changes',{event:'*',schema:'public',table:'catalogs',filter:`user_id=eq.${cloudUser.id}`},payload=>{
   const remoteStamp=payload?.new?.updated_at||'';
   // Ignore this device's own write and avoid a realtime feedback loop.
   if(syncInProgress||localDirty||(remoteStamp&&lastCloudWriteAt&&remoteStamp===lastCloudWriteAt))return;
   clearTimeout(realtimeSyncTimer);
   realtimeSyncTimer=setTimeout(()=>pullCloudOnly(),900);
  }).subscribe();
}
function itemTime(x){return Date.parse(x?.updatedAt||x?.date||0)||0}
function mergeDeleted(localMap={},remoteMap={}){const out={...remoteMap};for(const [id,stamp] of Object.entries(localMap||{})){if((Date.parse(stamp)||0)>=(Date.parse(out[id])||0))out[id]=stamp}return out}
function mergeArray(local=[],remote=[],deleted={}){const map=new Map();for(const x of [...remote,...local]){if(!x||!x.id)continue;const old=map.get(x.id);if(!old||itemTime(x)>=itemTime(old))map.set(x.id,x)}for(const id of Object.keys(deleted||{})){map.delete(id)}return [...map.values()]}
function mergeCatalog(local,remote){
 const localTime=Date.parse(local?.meta?.updatedAt||0)||0,remoteTime=Date.parse(remote?.meta?.updatedAt||0)||0;
 const deletedFirearms=mergeDeleted(local?.meta?.deletedFirearms,remote?.meta?.deletedFirearms);
 const deletedAmmo=mergeDeleted(local?.meta?.deletedAmmo,remote?.meta?.deletedAmmo);
 const deletedMaintenance=mergeDeleted(local?.meta?.deletedMaintenance,remote?.meta?.deletedMaintenance);
 return{
  ...remote,...local,
  firearms:mergeArray(local?.firearms,remote?.firearms,deletedFirearms),
  ammo:mergeArray(local?.ammo,remote?.ammo,deletedAmmo),
  maintenance:mergeArray(local?.maintenance,remote?.maintenance,deletedMaintenance),
  settings:{...(remote?.settings||{}),...(local?.settings||{})},
  meta:{...(remote?.meta||{}),...(local?.meta||{}),deletedFirearms,deletedAmmo,deletedMaintenance,updatedAt:new Date(Math.max(localTime,remoteTime,Date.now())).toISOString()}
 }
}
async function readCloud(){const {data,error}=await cloudClient.from('catalogs').select('data,updated_at').eq('user_id',cloudUser.id).maybeSingle();if(error)throw error;return data}
async function writeCloud(payload){const stamp=new Date().toISOString();payload.meta={...(payload.meta||{}),updatedAt:payload.meta?.updatedAt||stamp,lastCloudSync:stamp};const {error}=await cloudClient.from('catalogs').upsert({user_id:cloudUser.id,data:payload,updated_at:stamp},{onConflict:'user_id'});if(error)throw error;lastCloudWriteAt=stamp;return stamp}
function applyCloudCatalog(payload,stamp,showToast){isApplyingCloud=true;state={firearms:[],ammo:[],maintenance:[],settings:{theme:'light',pinHash:'',migrated:true},meta:{},...payload};state.meta={...(state.meta||{}),lastCloudSync:stamp||new Date().toISOString()};localStorage.setItem(STORE_KEY,JSON.stringify(state));localDirty=false;isApplyingCloud=false;renderAll();if(showToast)toast('Cloud inventory downloaded to this device.')}
async function pullCloudOnly(){
 if(!cloudClient||!cloudUser||syncInProgress||localDirty)return false;
 syncInProgress=true;
 try{
  const row=await readCloud();
  if(row?.data){applyCloudCatalog(row.data,row.updated_at,false)}
  setSyncStatus('Synced','ok');renderCloudAccount();return true;
 }catch(e){console.error(e);setSyncStatus(navigator.onLine?'Sync error':'Offline',navigator.onLine?'err':'warn');return false}
 finally{syncInProgress=false}
}
function stableJson(value){
 if(Array.isArray(value))return '['+value.map(stableJson).join(',')+']';
 if(value&&typeof value==='object'){
  return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stableJson(value[key])).join(',')+'}';
 }
 return JSON.stringify(value);
}

async function exactCloudWrite(actionLabel='Changes'){
 if(!cloudClient||!cloudUser)return false;
 clearTimeout(syncTimer);
 while(syncInProgress)await new Promise(r=>setTimeout(r,75));
 syncInProgress=true;
 setSyncStatus('Saving…','warn');
 try{
  const exact=structuredClone(state);
  const stamp=await writeCloud(exact);
  const verify=await readCloud();
  if(!verify?.data)throw new Error('Supabase did not return the saved catalog.');
  const localJson=stableJson(exact);
  const cloudJson=stableJson(verify.data);
  if(localJson!==cloudJson)throw new Error('Cloud verification did not match this device.');
  applyCloudCatalog(verify.data,verify.updated_at||stamp,false);
  localDirty=false;
  setSyncStatus('Synced','ok');
  renderCloudAccount();
  return true;
 }catch(e){
  console.error(e);
  localDirty=true;
  setSyncStatus(navigator.onLine?'Sync error':'Offline',navigator.onLine?'err':'warn');
  const info=$('cloudAccountInfo');
  if(info)info.textContent=`${actionLabel} remains on this device because cloud saving failed: ${e.message}`;
  return false;
 }finally{
  syncInProgress=false;
 }
}

async function safeCloudSync(showToast=true){
 if(!cloudClient||!cloudUser)return false;
 if(syncInProgress)return false;
 syncInProgress=true;
 try{
  if(showToast)setSyncStatus('Checking…','warn');
  const row=await readCloud();

  if(localDirty || !row){
   syncInProgress=false;
   const ok=await exactCloudWrite('Catalog');
   if(showToast)toast(ok?'This device was saved to the cloud.':'Cloud saving failed. Check Backup & Security.');
   return ok;
  }

  if(row?.data){
   applyCloudCatalog(row.data,row.updated_at,showToast);
  }
  setSyncStatus('Synced','ok');
  renderCloudAccount();
  return true;
 }catch(e){
  console.error(e);
  setSyncStatus(navigator.onLine?'Sync error':'Offline',navigator.onLine?'err':'warn');
  const info=$('cloudAccountInfo');
  if(info)info.textContent='Cloud sync error: '+e.message;
  return false;
 }finally{
  syncInProgress=false;
 }
}

function scheduleCloudSave(){
 if(!cloudClient||!cloudUser)return;
 clearTimeout(syncTimer);
 setSyncStatus('Saving…','warn');
 syncTimer=setTimeout(()=>exactCloudWrite('Changes'),700);
}

async function commitCloudState(actionLabel='Changes'){
 return exactCloudWrite(actionLabel);
}

async function commitCloudDeletion(deletedId){
 const ok=await exactCloudWrite('Firearm deletion');
 if(!ok)return false;
 const verify=await readCloud();
 if((verify?.data?.firearms||[]).some(item=>item.id===deletedId)){
  const info=$('cloudAccountInfo');
  if(info)info.textContent='Delete verification failed: the firearm is still present in Supabase.';
  setSyncStatus('Delete error','err');
  return false;
 }
 return true;
}
async function pushCloud(){return exactCloudWrite('Changes')}
async function pullCloud(showToast=true){return safeCloudSync(showToast)}

function load(){
 try{const raw=localStorage.getItem(STORE_KEY);if(raw)state={...state,...JSON.parse(raw)};migrateLegacy()}catch(e){console.error(e);toast('Could not read saved data.')}
 applyTheme();renderAll();if(state.settings.pinHash)lock();
}
function migrateLegacy(){
 if(state.settings.migrated)return;
 const keys=['firearmCatalogV4','firearm_catalog_v4','firearmCatalog','catalog','gunCatalog'];
 for(const key of keys){try{
  const raw=localStorage.getItem(key);if(!raw)continue;const data=JSON.parse(raw);
  const arr=Array.isArray(data)?data:(data.firearms||data.catalog||[]);
  if(!Array.isArray(arr)||!arr.length)continue;
  for(const x of arr){
   if(state.firearms.some(f=>(f.serial||'')&&(f.serial===x.serial)))continue;
   state.firearms.push({
    id:uid(),type:x.type||x.itemType||'Other',condition:x.condition||'Good',
    make:x.make||x.manufacturer||'',model:x.model||x.name||x.itemName||'Unknown',
    serial:x.serial||x.serialNumber||'',caliber:x.caliber||'',purchaseDate:x.purchaseDate||x.dateAcquired||'',
    purchasePrice:Number(x.purchasePrice||x.price||0),value:Number(x.value||x.estimatedValue||0),
    location:x.location||x.storageLocation||'',source:x.source||x.purchaseSource||'',status:x.status||'Owned',
    notes:x.notes||'',accessories:(x.accessories||x.attachments||[]).map(a=>({id:uid(),type:a.type||'Accessory',name:a.name||a.model||'',serial:a.serial||'',value:Number(a.value||0)})),
    photos:x.photos||[],docs:x.docs||[],createdAt:x.createdAt||x.saved||new Date().toISOString(),updatedAt:new Date().toISOString()
   });
  }
  break;
 }catch(e){}}
 state.settings.migrated=true;localStorage.setItem(STORE_KEY,JSON.stringify(state));
}
function applyTheme(){document.documentElement.dataset.theme=state.settings.theme==='dark'?'dark':''}
function goPage(name){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===name));document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.page===name));window.scrollTo(0,0);renderAll()}
window.goPage=goPage;
$('tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(b)goPage(b.dataset.page)});
$('themeBtn').onclick=()=>{state.settings.theme=state.settings.theme==='dark'?'light':'dark';applyTheme();save()};
function counts(){return{items:state.firearms.length,acc:state.firearms.reduce((n,f)=>n+(f.accessories?.length||0),0),rounds:state.ammo.reduce((n,a)=>n+Number(a.qty||0),0),value:state.firearms.reduce((n,f)=>n+Number(f.value||0)+(f.accessories||[]).reduce((s,a)=>s+Number(a.value||0),0),0)}}
function renderAll(){renderDashboard();renderInventory();renderAmmo();renderMaintenance();renderReports();renderStorage()}
function renderDashboard(){
 const c=counts();$('statFirearms').textContent=c.items;$('statAccessories').textContent=c.acc;$('statRounds').textContent=c.rounds.toLocaleString();$('statValue').textContent=money(c.value);
 const recent=[...state.firearms].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,3);
 $('recentInventory').innerHTML=recent.length?recent.map(itemCard).join(''):'<div class="empty">No items yet. Tap “Add” to begin.</div>';
 const alerts=getAlerts().slice(0,4);$('dashAlerts').innerHTML=alerts.length?alerts.map(alertHtml).join(''):'<div class="empty">No maintenance alerts.</div>';
 const types={};state.firearms.forEach(f=>types[f.type]=(types[f.type]||0)+1);const max=Math.max(1,...Object.values(types));
 $('typeChart').innerHTML=Object.keys(types).length?Object.entries(types).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="chart-row"><div class="chart-label">${esc(k)}</div><div class="bar" style="width:${Math.max(3,v/max*70)}%"></div><div class="chart-count">${v}</div></div>`).join(''):'<div class="empty">Add inventory to see collection statistics.</div>';
}
function itemCard(f){
 const img=f.photos?.[0]?.data||'';
 return `<div class="item-card"><div class="item-top">${img?`<img class="thumb" src="${img}" alt="">`:`<div class="thumb"></div>`}<div class="item-main"><div class="item-title">${esc([f.make,f.model].filter(Boolean).join(' ')||'Unnamed item')}</div><span class="badge">${esc(f.type)}</span><span class="badge">${esc(f.caliber||'No caliber')}</span><span class="badge">${esc(f.condition||'')}</span></div></div><div class="item-details"><div><b>Serial</b>${esc(f.serial||'Not entered')}</div><div><b>Location</b>${esc(f.location||'Not entered')}</div><div><b>Value</b>${money(f.value)}</div></div><div class="item-actions"><button class="btn small" onclick="viewFirearm('${f.id}')">View / Edit</button><button class="btn secondary small" onclick="duplicateFirearm('${f.id}')">Duplicate</button><button class="btn danger small" onclick="deleteFirearm('${f.id}')">Delete</button></div></div>`;
}
function renderInventory(){
 let q=$('searchInventory').value.toLowerCase(),type=$('filterType').value,cond=$('filterCondition').value,sort=$('sortInventory').value;
 let items=state.firearms.filter(f=>{const text=JSON.stringify(f).toLowerCase();return(!q||text.includes(q))&&(!type||f.type===type)&&(!cond||f.condition===cond)});
 items.sort((a,b)=>sort==='name'?(`${a.make} ${a.model}`).localeCompare(`${b.make} ${b.model}`):sort==='value'?Number(b.value)-Number(a.value):sort==='date'?String(b.purchaseDate).localeCompare(String(a.purchaseDate)):String(b.updatedAt).localeCompare(String(a.updatedAt)));
 $('inventoryCount').textContent=`${items.length} of ${state.firearms.length} items`;$('inventoryList').innerHTML=items.length?items.map(itemCard).join(''):'<div class="card empty">No matching inventory.</div>';
}
['searchInventory','filterType','filterCondition','sortInventory'].forEach(id=>$(id).addEventListener('input',renderInventory));
function resetFirearm(){
 $('firearmForm').reset();$('firearmId').value='';$('firearmModalTitle').textContent='Add Firearm';$('fCondition').value='Excellent';$('fStatus').value='Owned';accessoryDraft=[];photoDraft=[];docDraft=[];renderDrafts();
}
window.openFirearm=()=>{resetFirearm();$('firearmModal').classList.remove('hidden')};
window.viewFirearm=id=>{const f=state.firearms.find(x=>x.id===id);if(!f)return;resetFirearm();$('firearmModalTitle').textContent='Edit Firearm';$('firearmId').value=f.id;const map={fType:'type',fCondition:'condition',fMake:'make',fModel:'model',fSerial:'serial',fCaliber:'caliber',fPurchaseDate:'purchaseDate',fPurchasePrice:'purchasePrice',fValue:'value',fLocation:'location',fSource:'source',fStatus:'status',fNotes:'notes'};for(const [id,k] of Object.entries(map))$(id).value=f[k]??'';accessoryDraft=structuredClone(f.accessories||[]);photoDraft=structuredClone(f.photos||[]);docDraft=structuredClone(f.docs||[]);renderDrafts();$('firearmModal').classList.remove('hidden')};
window.duplicateFirearm=id=>{const f=state.firearms.find(x=>x.id===id);if(!f)return;const copy=structuredClone(f);copy.id=uid();copy.serial='';copy.model+=' (Copy)';copy.createdAt=copy.updatedAt=new Date().toISOString();state.firearms.push(copy);save();toast('Item duplicated. Add the correct serial number.')};
window.deleteFirearm=async id=>{if(confirm('Delete this firearm and its linked records?')){clearTimeout(syncTimer);const stamp=new Date().toISOString();state.meta={...(state.meta||{}),deletedFirearms:{...(state.meta?.deletedFirearms||{}),[id]:stamp}};const linked=state.maintenance.filter(x=>x.firearmId===id).map(x=>x.id);if(linked.length){state.meta.deletedMaintenance={...(state.meta.deletedMaintenance||{})};linked.forEach(mid=>state.meta.deletedMaintenance[mid]=stamp)}state.firearms=state.firearms.filter(x=>x.id!==id);state.maintenance=state.maintenance.filter(x=>x.firearmId!==id);if(!save())return;clearTimeout(syncTimer);renderAll();if(cloudUser){const ok=await commitCloudDeletion(id);toast(ok?'Firearm permanently deleted from the cloud.':'Deleted on this device only. Check Backup & Security for the exact cloud error.')}else toast('Firearm deleted on this device.')}};
$('addAccessoryBtn').onclick=()=>{const name=$('accName').value.trim();if(!name)return alert('Enter the accessory make/model.');accessoryDraft.push({id:uid(),type:$('accType').value,name,serial:$('accSerial').value.trim(),value:Number($('accValue').value||0)});$('accName').value=$('accSerial').value=$('accValue').value='';renderDrafts()};
function renderDrafts(){
 $('accessoryDraft').innerHTML=accessoryDraft.map((a,i)=>`<div class="file-chip"><span><b>${esc(a.type)}:</b> ${esc(a.name)} ${a.serial?`— ${esc(a.serial)}`:''}</span><button class="btn danger small" type="button" onclick="removeAcc(${i})">Remove</button></div>`).join('');
 $('photoDraft').innerHTML=photoDraft.map((p,i)=>`<div class="preview"><img src="${p.data}" alt=""><button type="button" onclick="removePhoto(${i})">×</button></div>`).join('');
 $('docDraft').innerHTML=docDraft.map((d,i)=>`<div class="file-chip"><span>${esc(d.name)} <small>${Math.round((d.size||0)/1024)} KB</small></span><span><button class="btn secondary small" type="button" onclick="downloadDoc(${i})">Open</button> <button class="btn danger small" type="button" onclick="removeDoc(${i})">Remove</button></span></div>`).join('');
}
window.removeAcc=i=>{accessoryDraft.splice(i,1);renderDrafts()};window.removePhoto=i=>{photoDraft.splice(i,1);renderDrafts()};window.removeDoc=i=>{docDraft.splice(i,1);renderDrafts()};
window.downloadDoc=i=>{const d=docDraft[i],a=document.createElement('a');a.href=d.data;a.download=d.name;a.click()};
function readFile(file,max=2500000){return new Promise((resolve,reject)=>{if(file.size>max)return reject(new Error(`${file.name} is too large. Maximum is ${Math.round(max/1e6)} MB.`));const r=new FileReader();r.onload=()=>resolve({id:uid(),name:file.name,type:file.type,size:file.size,data:r.result});r.onerror=reject;r.readAsDataURL(file)})}
$('fPhotos').onchange=async e=>{try{for(const f of e.target.files)photoDraft.push(await readFile(f,3500000));renderDrafts()}catch(err){alert(err.message)}e.target.value=''};
$('fDocs').onchange=async e=>{try{for(const f of e.target.files)docDraft.push(await readFile(f,5000000));renderDrafts()}catch(err){alert(err.message)}e.target.value=''};
$('firearmForm').onsubmit=async e=>{e.preventDefault();const id=$('firearmId').value||uid(),old=state.firearms.find(f=>f.id===id);const f={id,type:$('fType').value,condition:$('fCondition').value,make:$('fMake').value.trim(),model:$('fModel').value.trim(),serial:$('fSerial').value.trim(),caliber:$('fCaliber').value.trim(),purchaseDate:$('fPurchaseDate').value,purchasePrice:Number($('fPurchasePrice').value||0),value:Number($('fValue').value||0),location:$('fLocation').value.trim(),source:$('fSource').value.trim(),status:$('fStatus').value,notes:$('fNotes').value.trim(),accessories:structuredClone(accessoryDraft),photos:structuredClone(photoDraft),docs:structuredClone(docDraft),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};const duplicate=state.firearms.find(x=>x.id!==id&&f.serial&&x.serial.toLowerCase()===f.serial.toLowerCase());if(duplicate&&!confirm('Another item uses this serial number. Save anyway?'))return;const i=state.firearms.findIndex(x=>x.id===id);i>=0?state.firearms[i]=f:state.firearms.push(f);if(state.meta?.deletedFirearms?.[id])delete state.meta.deletedFirearms[id];if(!save())return;closeModal('firearmModal');goPage('inventory');toast('Firearm saved on this device.');if(cloudUser){clearTimeout(syncTimer);const ok=await commitCloudState('Firearm update');toast(ok?'Firearm saved and synced.':'Saved on this device only. Open Backup & Security to see the cloud error.')}};
function renderAmmo(){const q=$('searchAmmo').value.toLowerCase();const list=state.ammo.filter(a=>JSON.stringify(a).toLowerCase().includes(q)).sort((a,b)=>a.caliber.localeCompare(b.caliber));const rounds=state.ammo.reduce((n,a)=>n+Number(a.qty),0);$('ammoSummary').textContent=`${rounds.toLocaleString()} rounds in ${state.ammo.length} entries`;$('ammoList').innerHTML=list.length?list.map(a=>`<div class="item-card"><div class="item-title">${esc(a.caliber)} — ${esc(a.brand||'Unbranded')}</div><span class="badge">${esc(a.type||'Unspecified')}</span><div class="item-details"><div><b>Quantity</b>${Number(a.qty).toLocaleString()}</div><div><b>Lot</b>${esc(a.lot||'Not entered')}</div><div><b>Location</b>${esc(a.location||'Not entered')}</div></div><div class="item-actions"><button class="btn small" onclick="editAmmo('${a.id}')">Edit</button><button class="btn danger small" onclick="deleteAmmo('${a.id}')">Delete</button></div></div>`).join(''):'<div class="card empty">No ammunition records.</div>'}
$('searchAmmo').oninput=renderAmmo;
window.openAmmo=()=>{$('ammoForm').reset();$('ammoId').value='';$('ammoModalTitle').textContent='Add Ammunition';$('ammoModal').classList.remove('hidden')};
window.editAmmo=id=>{const a=state.ammo.find(x=>x.id===id);if(!a)return;openAmmo();$('ammoModalTitle').textContent='Edit Ammunition';const map={ammoId:'id',aCaliber:'caliber',aBrand:'brand',aType:'type',aQty:'qty',aLot:'lot',aLocation:'location',aDate:'date',aCost:'cost',aNotes:'notes'};for(const [i,k] of Object.entries(map))$(i).value=a[k]??''};
window.deleteAmmo=async id=>{if(confirm('Delete this ammunition record?')){const stamp=new Date().toISOString();state.meta={...(state.meta||{}),deletedAmmo:{...(state.meta?.deletedAmmo||{}),[id]:stamp}};state.ammo=state.ammo.filter(x=>x.id!==id);if(!save())return;if(cloudUser)await pushCloud()}};
$('ammoForm').onsubmit=e=>{e.preventDefault();const id=$('ammoId').value||uid(),a={id,caliber:$('aCaliber').value.trim(),brand:$('aBrand').value.trim(),type:$('aType').value.trim(),qty:Number($('aQty').value),lot:$('aLot').value.trim(),location:$('aLocation').value.trim(),date:$('aDate').value,cost:Number($('aCost').value||0),notes:$('aNotes').value.trim(),updatedAt:new Date().toISOString()};const i=state.ammo.findIndex(x=>x.id===id);i>=0?state.ammo[i]=a:state.ammo.push(a);if(state.meta?.deletedAmmo?.[id])delete state.meta.deletedAmmo[id];save();closeModal('ammoModal');toast('Ammunition saved.')};
function firearmName(id){const f=state.firearms.find(x=>x.id===id);return f?[f.make,f.model].filter(Boolean).join(' '):'Deleted item'}
function getAlerts(){const now=new Date(today()+'T00:00:00');return state.maintenance.filter(m=>m.due).map(m=>({...m,days:Math.ceil((new Date(m.due+'T00:00:00')-now)/86400000)})).filter(m=>m.days<=30).sort((a,b)=>a.days-b.days)}
function alertHtml(m){return `<div class="alert ${m.days<0?'overdue':''}"><b>${esc(firearmName(m.firearmId))}</b><br>${esc(m.type)} ${m.days<0?`overdue by ${Math.abs(m.days)} day(s)`:m.days===0?'due today':`due in ${m.days} day(s)`}</div>`}
function renderMaintenance(){const alerts=getAlerts();$('maintenanceAlerts').innerHTML='<h2>Upcoming Alerts</h2>'+(alerts.length?alerts.map(alertHtml).join(''):'<div class="empty">No upcoming maintenance within 30 days.</div>');const list=[...state.maintenance].sort((a,b)=>String(b.date).localeCompare(String(a.date)));$('maintenanceList').innerHTML=list.length?list.map(m=>`<div class="item-card"><div class="item-title">${esc(firearmName(m.firearmId))}</div><span class="badge">${esc(m.type)}</span><div class="item-details"><div><b>Service Date</b>${esc(m.date)}</div><div><b>Next Due</b>${esc(m.due||'Not scheduled')}</div><div><b>Cost</b>${money(m.cost)}</div></div><p>${esc(m.notes||'')}</p><div class="item-actions"><button class="btn small" onclick="editMaintenance('${m.id}')">Edit</button><button class="btn danger small" onclick="deleteMaintenance('${m.id}')">Delete</button></div></div>`).join(''):'<div class="card empty">No maintenance records.</div>'}
window.openMaintenance=()=>{if(!state.firearms.length){alert('Add a firearm first.');return}$('maintenanceForm').reset();$('mId').value='';$('maintenanceModalTitle').textContent='Add Maintenance';$('mDate').value=today();populateFirearms();$('maintenanceModal').classList.remove('hidden')};
function populateFirearms(){const val=$('mFirearm').value;$('mFirearm').innerHTML='<option value="">Select firearm</option>'+state.firearms.map(f=>`<option value="${f.id}">${esc([f.make,f.model,f.serial&&'('+f.serial+')'].filter(Boolean).join(' '))}</option>`).join('');$('mFirearm').value=val}
window.editMaintenance=id=>{const m=state.maintenance.find(x=>x.id===id);if(!m)return;openMaintenance();$('maintenanceModalTitle').textContent='Edit Maintenance';const map={mId:'id',mFirearm:'firearmId',mType:'type',mDate:'date',mDue:'due',mRounds:'rounds',mCost:'cost',mBy:'by',mNotes:'notes'};for(const [i,k] of Object.entries(map))$(i).value=m[k]??''};
window.deleteMaintenance=async id=>{if(confirm('Delete this maintenance record?')){const stamp=new Date().toISOString();state.meta={...(state.meta||{}),deletedMaintenance:{...(state.meta?.deletedMaintenance||{}),[id]:stamp}};state.maintenance=state.maintenance.filter(x=>x.id!==id);if(!save())return;if(cloudUser)await pushCloud()}};
$('maintenanceForm').onsubmit=e=>{e.preventDefault();const id=$('mId').value||uid(),m={id,firearmId:$('mFirearm').value,type:$('mType').value,date:$('mDate').value,due:$('mDue').value,rounds:Number($('mRounds').value||0),cost:Number($('mCost').value||0),by:$('mBy').value.trim(),notes:$('mNotes').value.trim(),updatedAt:new Date().toISOString()};const i=state.maintenance.findIndex(x=>x.id===id);i>=0?state.maintenance[i]=m:state.maintenance.push(m);if(state.meta?.deletedMaintenance?.[id])delete state.meta.deletedMaintenance[id];save();closeModal('maintenanceModal');toast('Maintenance record saved.')};
function renderReports(){const c=counts();$('reportItems').textContent=c.items;$('reportAccessories').textContent=c.acc;$('reportRounds').textContent=c.rounds.toLocaleString();$('reportValue').textContent=money(c.value);$('reportTable').innerHTML=state.firearms.map(f=>`<tr><td>${esc(f.type)}</td><td>${esc([f.make,f.model].filter(Boolean).join(' '))}</td><td>${esc(f.serial)}</td><td>${esc(f.caliber)}</td><td>${esc(f.location)}</td><td>${money(f.value)}</td></tr>`).join('')}
$('csvBtn').onclick=()=>{const rows=[['Type','Manufacturer','Model','Serial','Caliber','Condition','Purchase Date','Purchase Price','Estimated Value','Location','Status','Notes'],...state.firearms.map(f=>[f.type,f.make,f.model,f.serial,f.caliber,f.condition,f.purchaseDate,f.purchasePrice,f.value,f.location,f.status,f.notes])];downloadBlob(rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n'),'firearm_catalog_report.csv','text/csv')};
function downloadBlob(data,name,type='application/octet-stream'){const blob=data instanceof Blob?data:new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function backupObject(){return{app:'Firearm Catalog V5',version:APP_VERSION,exportedAt:new Date().toISOString(),data:state}}
$('exportBtn').onclick=()=>downloadBlob(JSON.stringify(backupObject(),null,2),`firearm_catalog_v5_backup_${today()}.json`,'application/json');
async function hashText(text){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function encryptBackup(pass){const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']),key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt']),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(backupObject())));return JSON.stringify({format:'FCBAK1',salt:btoa(String.fromCharCode(...salt)),iv:btoa(String.fromCharCode(...iv)),data:btoa(String.fromCharCode(...new Uint8Array(cipher)))})}
async function decryptBackup(obj,pass){const salt=Uint8Array.from(atob(obj.salt),c=>c.charCodeAt(0)),iv=Uint8Array.from(atob(obj.iv),c=>c.charCodeAt(0)),data=Uint8Array.from(atob(obj.data),c=>c.charCodeAt(0)),base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']),key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['decrypt']),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,data);return JSON.parse(new TextDecoder().decode(plain))}
$('encryptedExportBtn').onclick=async()=>{const p=prompt('Create a strong backup passphrase. You will need it to restore the file.');if(!p)return;try{downloadBlob(await encryptBackup(p),`firearm_catalog_v5_encrypted_${today()}.fcbak`,'application/json');toast('Encrypted backup created.')}catch(e){alert('Encryption failed: '+e.message)}};
$('importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{let obj=JSON.parse(await file.text());if(obj.format==='FCBAK1'){const p=prompt('Enter the backup passphrase.');if(!p)return;obj=await decryptBackup(obj,p)}const imported=obj.data||obj;if(Array.isArray(imported))imported={firearms:imported,ammo:[],maintenance:[],settings:state.settings};if(!Array.isArray(imported.firearms))throw new Error('This is not a recognized backup.');if(confirm(`Import ${imported.firearms.length} firearm record(s)? This replaces current local data.`)){state={firearms:imported.firearms||[],ammo:imported.ammo||[],maintenance:imported.maintenance||[],settings:{...state.settings,...(imported.settings||{}),migrated:true}};save();toast('Backup restored.')}}catch(err){alert('Could not import backup: '+err.message)}e.target.value=''};
$('setPinBtn').onclick=async()=>{const p=$('newPin').value;if(!/^\d{4,12}$/.test(p))return alert('Use 4 to 12 digits.');state.settings.pinHash=await hashText(p);$('newPin').value='';save();toast('PIN set.')};
$('removePinBtn').onclick=async()=>{if(!state.settings.pinHash)return toast('No PIN is set.');const p=prompt('Enter current PIN to remove it.');if(await hashText(p||'')!==state.settings.pinHash)return alert('Incorrect PIN.');state.settings.pinHash='';save();toast('PIN removed.')};
function lock(){if(state.settings.pinHash){$('unlockPin').value='';$('lockScreen').classList.remove('hidden');setTimeout(()=>$('unlockPin').focus(),100)}}
$('lockBtn').onclick=()=>state.settings.pinHash?lock():goPage('backup');
$('unlockBtn').onclick=async()=>{if(await hashText($('unlockPin').value)===state.settings.pinHash){$('lockScreen').classList.add('hidden');$('unlockPin').value=''}else alert('Incorrect PIN.')};$('unlockPin').addEventListener('keydown',e=>{if(e.key==='Enter')$('unlockBtn').click()});
function renderStorage(){const bytes=new Blob([JSON.stringify(state)]).size;$('storageInfo').textContent=`App version ${APP_VERSION} • ${state.firearms.length} firearms • ${state.ammo.length} ammunition entries • ${state.maintenance.length} maintenance records • approximately ${(bytes/1024/1024).toFixed(2)} MB stored.`}
$('eraseBtn').onclick=()=>{const text=prompt('Type ERASE to permanently remove all local catalog data.');if(text==='ERASE'){localStorage.removeItem(STORE_KEY);state={firearms:[],ammo:[],maintenance:[],settings:{theme:'light',pinHash:'',migrated:true}};save();toast('All local data erased.')}};
$('updateBtn').onclick=async()=>{try{if('serviceWorker'in navigator){const r=await navigator.serviceWorker.getRegistration();await r?.update()}location.reload()}catch(e){location.reload()}};
window.closeModal=id=>$(id).classList.add('hidden');
document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.add('hidden')}));

$('syncStatus').onclick=()=>$('cloudModal').classList.remove('hidden');
$('cloudAccountBtn').onclick=()=>{const c=cloudConfig()||{};$('cloudUrl').value=c.url||'';$('cloudKey').value=c.key||'';$('cloudModal').classList.remove('hidden')};
$('saveCloudConfigBtn').onclick=async()=>{const url=$('cloudUrl').value.trim().replace(/\/$/,'');const key=$('cloudKey').value.trim();if(!/^https:\/\/.+\.supabase\.co$/.test(url)||key.length<40)return alert('Enter a valid Supabase project URL and anon/publishable key.');localStorage.setItem(CLOUD_CONFIG_KEY,JSON.stringify({url,key}));toast('Cloud connection saved.');closeModal('cloudModal');location.reload()};
$('removeCloudConfigBtn').onclick=()=>{if(confirm('Remove the cloud connection from this device? Local catalog data will remain.')){localStorage.removeItem(CLOUD_CONFIG_KEY);location.reload()}};
$('cloudSignInBtn').onclick=async()=>{if(!cloudClient)return alert('Save the Supabase connection first.');const email=$('cloudEmail').value.trim(),password=$('cloudPassword').value;const {error}=await cloudClient.auth.signInWithPassword({email,password});if(error)return alert(error.message);closeModal('cloudModal');toast('Signed in. Starting sync…')};
$('cloudSignUpBtn').onclick=async()=>{if(!cloudClient)return alert('Save the Supabase connection first.');const email=$('cloudEmail').value.trim(),password=$('cloudPassword').value;if(password.length<6)return alert('Use a password with at least 6 characters.');const {error}=await cloudClient.auth.signUp({email,password});if(error)return alert(error.message);alert('Account created. Check your email if confirmation is enabled, then sign in.')};
$('syncNowBtn').onclick=async()=>{if(!cloudUser)return $('cloudModal').classList.remove('hidden');await safeCloudSync(true)};
$('signOutBtn').onclick=async()=>{if(cloudClient){await cloudClient.auth.signOut();cloudUser=null;renderCloudAccount();toast('Signed out.')}};
window.addEventListener('online',()=>{renderCloudAccount();if(cloudUser)safeCloudSync(false)});window.addEventListener('offline',()=>setSyncStatus('Offline','warn'));

if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.error));
load();
initCloud();
