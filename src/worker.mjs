const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const SESSION='__Host-fgm_session',OAUTH='__Host-fgm_oauth';
const YAHOO_API='https://fantasysports.yahooapis.com/fantasy/v2/';
const TOKEN_URL='https://api.login.yahoo.com/oauth2/get_token';
const TEAM_KEY=/^(?:\d+|nba)\.l\.\d+\.t\.\d+$/;
export const staticAssets={};
function json(value,status=200,headers={}){return new Response(JSON.stringify(value),{status,headers:{...JSON_HEADERS,...headers}});}
function redirect(location,cookies=[]){const headers=new Headers({'Location':location,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});for(const cookie of cookies)headers.append('Set-Cookie',cookie);return new Response(null,{status:303,headers});}
function cookie(name,value,maxAge){return name+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+maxAge;}
function getCookie(request,name){return (request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||null;}
function base64url(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function decodeBase64(s){return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
async function keyFor(secret){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret));return crypto.subtle.importKey('raw',hash,'AES-GCM',false,['encrypt','decrypt']);}
export async function seal(value,secret){const iv=crypto.getRandomValues(new Uint8Array(12)),body=new TextEncoder().encode(JSON.stringify(value)),encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await keyFor(secret),body);const combined=new Uint8Array(12+encrypted.byteLength);combined.set(iv);combined.set(new Uint8Array(encrypted),12);return base64url(combined);}
export async function unseal(value,secret){try{if(!value||!secret)return null;const bytes=decodeBase64(value),body=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},await keyFor(secret),bytes.slice(12));return JSON.parse(new TextDecoder().decode(body));}catch{return null;}}
function user(request){return request.headers.get('oai-authenticated-user-id');}
function missingConfig(env){return ['YAHOO_CLIENT_ID','YAHOO_CLIENT_SECRET','YAHOO_REDIRECT_URI','SESSION_SECRET'].filter(k=>!env[k]);}
async function readSession(request,env){const s=await unseal(getCookie(request,SESSION),env.SESSION_SECRET);return s&&s.uid===user(request)&&s.sessionExpires>Date.now()&&s.accessToken?s:null;}
async function sessionCookie(session,env){const value=await seal(session,env.SESSION_SECRET);if(value.length>3700)throw new AppError(502,'Yahoo returned a session that is too large to store. A server-side session store is required.');return cookie(SESSION,value,60*60*24*30);}
class AppError extends Error{constructor(status,message){super(message);this.status=status;}}
function flatten(value){if(Array.isArray(value)){return Object.assign({},...value.filter(v=>v&&typeof v==='object').map(v=>Array.isArray(v)?flatten(v):v));}return value&&typeof value==='object'?value:{};}
export function resources(value,name){const found=[];function visit(node){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return;}for(const [key,val] of Object.entries(node)){if(key===name)found.push(flatten(val));visit(val);}}visit(value);const keys=new Set();return found.filter(v=>{const key=v[name+'_key'];if(!key)return true;if(keys.has(key))return false;keys.add(key);return true;});}
export function normalizeTeams(data){const games=resources(data,'game'),found=[];for(const game of games){for(const team of resources(game,'team')){if(TEAM_KEY.test(team.team_key||''))found.push({teamKey:team.team_key,leagueKey:team.team_key.split('.t.')[0],name:String(team.name||'Yahoo team').slice(0,100),season:String(game.season||'')});}}if(!found.length){for(const team of resources(data,'team'))if(TEAM_KEY.test(team.team_key||''))found.push({teamKey:team.team_key,leagueKey:team.team_key.split('.t.')[0],name:String(team.name||'Yahoo team').slice(0,100),season:''});}return [...new Map(found.map(t=>[t.teamKey,t])).values()];}
function statDefinitions(data){return new Map(resources(data,'stat').filter(s=>s.stat_id!==undefined).map(s=>[String(s.stat_id),String(s.display_name||s.abbr||s.name||'').toUpperCase()]));}
function statNumbers(entity,definitions){const list=resources(entity.player_stats||entity.team_stats||{},'stat'),result={};for(const stat of list){const label=definitions.get(String(stat.stat_id));if(!label)continue;const raw=String(stat.value??'');result[label]=raw!==''&&/^\d+(?:\.\d+)?$/.test(raw)?Number(raw):null;}return result;}
export function normalizePlayers(data,definitionData){const definitions=statDefinitions(definitionData),keys={PTS:'pts',REB:'reb',AST:'ast',ST:'stl',STL:'stl',BLK:'blk','3PTM':'three','3PM':'three',FGM:'fgm',FGA:'fga',FTM:'ftm',FTA:'fta',TO:'tov',TOV:'tov'};
 return resources(data,'player').filter(p=>p.player_key&&p.name?.full).map(p=>{const source=statNumbers(p,definitions),gp=source.GP??source['GAMES PLAYED'],stats=Object.fromEntries(['pts','reb','ast','stl','blk','three','fgm','fga','ftm','fta','tov'].map(k=>[k,null]));if(gp>0){for(const [label,key] of Object.entries(keys))if(source[label]!==undefined&&source[label]!==null)stats[key]=source[label]/gp;}
 const selected=flatten(p.selected_position),status=['IL','IL+','IR'].includes(selected.position)?selected.position:String(p.status||'Active');return {id:String(p.player_key),name:String(p.name.full).slice(0,100),position:String(p.display_position||'').slice(0,30),status:['Active','Q','DTD','O','IL','IL+','INJ','IR'].includes(status)?status:'Active',games:0,stats,source:'yahoo'};});
}
const CAT_LABELS={'FG%':'FG%','FT%':'FT%','3PTM':'3PM','3PM':'3PM',PTS:'PTS',REB:'REB',AST:'AST',ST:'STL',STL:'STL',BLK:'BLK',TO:'TOV',TOV:'TOV'};
export function normalizeMatchup(data,teamKey,definitionData){const definitions=statDefinitions(definitionData);for(const matchup of resources(data,'matchup')){const teams=resources(matchup,'team'),mine=teams.find(t=>t.team_key===teamKey),theirs=teams.find(t=>t.team_key!==teamKey);if(!mine||!theirs)continue;const values=t=>{const raw=statNumbers(t,definitions),out=Object.fromEntries(['FG%','FT%','3PM','PTS','REB','AST','STL','BLK','TOV'].map(c=>[c,null]));for(const [label,cat] of Object.entries(CAT_LABELS))if(raw[label]!==undefined)out[cat]=raw[label];return out;};return {mine:values(mine),theirs:values(theirs),opponent:String(theirs.name||'Opponent').slice(0,100),basis:'current'};}return null;}
async function tokenRequest(env,params,fetcher){const r=await fetcher(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Authorization':'Basic '+btoa(env.YAHOO_CLIENT_ID+':'+env.YAHOO_CLIENT_SECRET)},body:new URLSearchParams({...params,redirect_uri:env.YAHOO_REDIRECT_URI}).toString(),signal:AbortSignal.timeout(15000)});if(!r.ok)throw new AppError(401,'Yahoo authorization could not be renewed. Connect Yahoo again and check app permissions.');const result=await r.json();if(typeof result.access_token!=='string'||!Number.isFinite(Number(result.expires_in)))throw new AppError(502,'Yahoo returned an incomplete authorization response.');return result;}
async function authorized(request,env,fetcher){if(missingConfig(env).length)throw new AppError(503,'Yahoo setup is pending. Your manual workspace is ready.');const session=await readSession(request,env);if(!session)throw new AppError(401,'Connect Yahoo in this browser first.');let renewed=false;if(session.expiresAt<Date.now()+60000){if(!session.refreshToken)throw new AppError(401,'Your Yahoo connection expired. Connect again.');const token=await tokenRequest(env,{grant_type:'refresh_token',refresh_token:session.refreshToken},fetcher);session.accessToken=token.access_token;session.refreshToken=token.refresh_token||session.refreshToken;session.expiresAt=Date.now()+Number(token.expires_in)*1000;renewed=true;}return {session,renewed};}
async function yahoo(path,session,fetcher){const r=await fetcher(YAHOO_API+path+(path.includes('?')?'&':'?')+'format=json',{method:'GET',headers:{Authorization:'Bearer '+session.accessToken,Accept:'application/json'},signal:AbortSignal.timeout(15000)});if(r.status===401||r.status===403)throw new AppError(r.status,'Yahoo has not granted access to this data. Check Fantasy Sports read permission and reconnect.');if(r.status===429)throw new AppError(429,'Yahoo is limiting requests. Please wait a minute before syncing again.');if(!r.ok)throw new AppError(502,'Yahoo could not return league data. Try again shortly.');return r.json();}
async function ownedTeams(session,fetcher){return normalizeTeams(await yahoo('users;use_login=1/games;game_codes=nba;is_available=1/teams',session,fetcher));}
export async function handleRequest(request,env={},ctx={},fetcher=fetch){const url=new URL(request.url),path=url.pathname;let rotatedCookie=null;try{
 if(path.startsWith('/api/')){
  if(!user(request))return json({error:'Sign in to your private Fantasy GM AI site first.'},401);
  if(path==='/api/yahoo/status'&&request.method==='GET'){const missing=missingConfig(env);return json({configured:missing.length===0,connected:!!await readSession(request,env),missing,redirectUri:env.YAHOO_REDIRECT_URI||url.origin+'/api/yahoo/callback'});}
  if(path==='/api/yahoo/connect'&&request.method==='GET'){
   if(missingConfig(env).length)return redirect('/?connection=error#connection');
   const callback=new URL(env.YAHOO_REDIRECT_URI);if(callback.origin!==url.origin||callback.pathname!=='/api/yahoo/callback')throw new AppError(503,'The Yahoo callback must match this app’s origin and callback path.');
   const state=base64url(crypto.getRandomValues(new Uint8Array(32))),payload={state,uid:user(request),expires:Date.now()+10*60*1000};
   const auth=new URL('https://api.login.yahoo.com/oauth2/request_auth');auth.search=new URLSearchParams({client_id:env.YAHOO_CLIENT_ID,redirect_uri:env.YAHOO_REDIRECT_URI,response_type:'code',state,scope:'fspt-r'}).toString();
   return redirect(auth.href,[cookie(OAUTH,await seal(payload,env.SESSION_SECRET),600)]);
  }
  if(path==='/api/yahoo/callback'&&request.method==='GET'){
   const pending=await unseal(getCookie(request,OAUTH),env.SESSION_SECRET),clear=cookie(OAUTH,'',0);
   if(!pending||pending.uid!==user(request)||pending.expires<Date.now()||pending.state!==url.searchParams.get('state'))return redirect('/?connection=expired#connection',[clear]);
   if(url.searchParams.has('error'))return redirect('/?connection=denied#connection',[clear]);
   const code=url.searchParams.get('code');if(!code)return redirect('/?connection=error#connection',[clear]);
   try{const token=await tokenRequest(env,{grant_type:'authorization_code',code},fetcher),session={uid:user(request),accessToken:token.access_token,refreshToken:token.refresh_token||null,expiresAt:Date.now()+Number(token.expires_in)*1000,sessionExpires:Date.now()+30*24*60*60*1000};return redirect('/?connection=connected#connection',[clear,await sessionCookie(session,env)]);}catch{return redirect('/?connection=error#connection',[clear]);}
  }
  if(path==='/api/yahoo/disconnect'&&request.method==='POST'){if(request.headers.get('Origin')!==url.origin)return json({error:'This action must be made from your workspace.'},403);return json({disconnected:true},200,{'Set-Cookie':cookie(SESSION,'',0)});}
  if((path==='/api/yahoo/leagues'||path==='/api/yahoo/snapshot')&&request.method==='GET'){
   const {session,renewed}=await authorized(request,env,fetcher);
   rotatedCookie=renewed?await sessionCookie(session,env):null;
   const headers=rotatedCookie?{'Set-Cookie':rotatedCookie}:{};
   const teams=await ownedTeams(session,fetcher);
   if(path.endsWith('/leagues'))return json({teams},200,headers);
   const teamKey=url.searchParams.get('teamKey');if(!TEAM_KEY.test(teamKey||''))return json({error:'Choose a valid Yahoo basketball team.'},400,headers);
   const selected=teams.find(t=>t.teamKey===teamKey);if(!selected)return json({error:'That team is not available to the connected Yahoo account.'},403,headers);
   const gameKey=teamKey.split('.')[0];
   const [roster,defs]=await Promise.all([yahoo('team/'+teamKey+'/roster/players/stats',session,fetcher),yahoo('game/'+gameKey+'/stat_categories',session,fetcher)]);
   let matchup=null;const notes=['Set expected active games for each player; Yahoo imports do not include a schedule forecast.'];
   try{const board=await yahoo('league/'+selected.leagueKey+'/scoreboard',session,fetcher);matchup=normalizeMatchup(board,teamKey,defs);if(!matchup)notes.push('No current head-to-head matchup was available.');}catch{notes.push('The matchup could not be imported. Enter its category totals manually.');}
   const players=normalizePlayers(roster,defs);if(!players.length)throw new AppError(502,'Yahoo returned no recognizable roster. Your workspace has not been changed.');
   if(players.some(p=>Object.values(p.stats).some(v=>v===null)))notes.push('Some per-game averages are unavailable. Fill in missing values before using projections.');
   return json({team:selected,players,matchup,syncedAt:new Date().toISOString(),notes},200,headers);
  }
  return json({error:'This endpoint or method is not supported.'},405,{'Allow':'GET, POST'});
 }
 if(request.method!=='GET'&&request.method!=='HEAD')return json({error:'Method not allowed.'},405);
 const name=path==='/'?'/index.html':path;const assets=env.__assets||staticAssets,asset=assets[name];
 if(!asset)return new Response('Not found',{status:404,headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});
 return new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self' https://api.login.yahoo.com; frame-ancestors 'self' https://chatgpt.com"}});
 }catch(error){return json({error:error instanceof AppError?error.message:'The connection could not be completed. Please try again.'},error instanceof AppError?error.status:502,rotatedCookie?{'Set-Cookie':rotatedCookie}:{});}}
export default {fetch:handleRequest};
