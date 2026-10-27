'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const DB_KEY = 'pace-local-demo-v1', SESSION_KEY = 'pace-local-demo-user-v1';
  const status = $('cloudStatus'), feed = $('friendFeed'), ownTracks = $('myTracks'), requests = $('friendRequests');
  const emptyDB = () => ({users:{}, friendships:[], pendingTracks:[]});
  function readDB(){try{const value=JSON.parse(localStorage.getItem(DB_KEY)||'null');return value&&value.users?{...emptyDB(),...value}:emptyDB();}catch{return emptyDB();}}
  let db=readDB(), user=null;
  const setStatus=text=>{status.textContent=text;};
  const normalized=name=>name.normalize('NFKC').trim().toLocaleLowerCase();
  const uniqueId=()=>globalThis.crypto?.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
  function persist(){try{localStorage.setItem(DB_KEY,JSON.stringify(db));return true;}catch{setStatus('本機儲存空間不足，請匯出軌跡並清理瀏覽器空間。');return false;}}
  function updateAccount(){
    $('accountButton').textContent=user?'登出':'本機登入';
    const avatar=$('accountAvatar');
    avatar.textContent=user?(user.avatar?'':user.nickname.slice(0,1).toUpperCase()):'我';
    avatar.style.backgroundImage=user?.avatar?`url("${user.avatar}")`:'';
    avatar.classList.toggle('has-account-avatar',!!user?.avatar);
    const mobileAccount=$('mobileAccountButton'),mobileAvatar=$('mobileAccountAvatar');
    if(mobileAccount){mobileAccount.textContent=user?'↪':'＋';mobileAccount.setAttribute('aria-label',user?'登出本機帳號':'本機登入');}
    if(mobileAvatar){mobileAvatar.textContent=user?(user.avatar?'':user.nickname.slice(0,1).toUpperCase()):'我';mobileAvatar.style.backgroundImage=user?.avatar?`url("${user.avatar}")`:'';mobileAvatar.classList.toggle('has-account-avatar',!!user?.avatar);}
    window.dispatchEvent(new CustomEvent('pace:set-runner-avatar',{detail:{dataUrl:user?.avatar||''}}));
    if(user){setStatus(`已以「${user.nickname}」模擬登入；紀錄只保存在此瀏覽器。`);renderSocial();}
  }
  function signIn(nickname){
    const display=nickname.normalize('NFKC').trim().replace(/\s+/g,' ');
    if(!display){$('authMessage').textContent='請輸入暱稱。';return;}
    const id=normalized(display);
    if(!db.users[id]) db.users[id]={id,nickname:display,tracks:[],createdAt:new Date().toISOString()};
    else db.users[id].nickname=display;
    user=db.users[id];
    try{localStorage.setItem(SESSION_KEY,id);}catch{}
    persist();$('authDialog').close();updateAccount();flushPending();
  }
  $('accountButton').addEventListener('click',()=>{
    if(user){user=null;try{localStorage.removeItem(SESSION_KEY);}catch{}updateAccount();renderSocial();setStatus('已登出本機模擬帳號。軌跡仍保留在此瀏覽器。');}
    else{$('authNickname').value='';$('authMessage').textContent='這是本機展示帳號，不需要密碼；資料會保存在目前瀏覽器的 LocalStorage。';$('authDialog').showModal();}
  });
  $('accountAvatar').addEventListener('click',()=>{if(!user){$('authDialog').showModal();return;}$('runnerPhotoInput').click();});
  $('mobileAccountButton')?.addEventListener('click',()=>$('accountButton').click());
  $('mobileAccountAvatar')?.addEventListener('click',()=>$('accountAvatar').click());
  window.addEventListener('pace:runner-avatar-updated',event=>{
    if(!user||!event.detail?.dataUrl)return;
    user.avatar=event.detail.dataUrl;db.users[user.id].avatar=user.avatar;persist();
    const avatar=$('accountAvatar');avatar.textContent='';avatar.style.backgroundImage=`url("${user.avatar}")`;avatar.classList.add('has-account-avatar');
    const mobileAvatar=$('mobileAccountAvatar');if(mobileAvatar){mobileAvatar.textContent='';mobileAvatar.style.backgroundImage=`url("${user.avatar}")`;mobileAvatar.classList.add('has-account-avatar');}
    setStatus(`「${user.nickname}」的帳號頭貼與地圖小人頭像已更新。`);
  });
  $('closeAuth').addEventListener('click',()=>$('authDialog').close());
  $('authForm').addEventListener('submit',event=>{event.preventDefault();signIn($('authNickname').value);});
  function renderSocial(){
    if(!user){ownTracks.innerHTML='<p class="feed-empty">登入並載入或上傳軌跡後會顯示在這裡。</p>';feed.innerHTML='<p class="feed-empty">登入後即可查看好友分享的運動摘要。</p>';requests.replaceChildren();return;}
    const mine=db.users[user.id]?.tracks||[];
    renderTrackCards(ownTracks,mine.map(track=>({...track,owner:user.nickname})),true);
    const friendIds=new Set(db.friendships.filter(f=>f.status==='accepted'&&(f.from===user.id||f.to===user.id)).map(f=>f.from===user.id?f.to:f.from));
    const friendTracks=[];
    friendIds.forEach(id=>(db.users[id]?.tracks||[]).forEach(track=>friendTracks.push({...track,owner:db.users[id].nickname})));
    friendTracks.sort((a,b)=>b.calories-a.calories||new Date(b.startedAt)-new Date(a.startedAt));
    renderTrackCards(feed,friendTracks,false);
    renderFriendRequests(friendIds);
  }
  function renderTrackCards(root,tracks,isMine){
    root.replaceChildren();
    if(!tracks.length){root.innerHTML=`<p class="feed-empty">${isMine?'尚無已儲存的軌跡。載入模擬資料、完成 GPS 運動或上傳檔案即可保存。':'好友還沒有已儲存的運動紀錄。'}</p>`;return;}
    tracks.sort((a,b)=>isMine?new Date(b.startedAt)-new Date(a.startedAt):b.calories-a.calories);
    tracks.forEach((track,index)=>{
      const card=document.createElement('article');card.className='feed-card';
      const title=document.createElement('strong');title.textContent=`${isMine?'':`${index+1}. ${track.owner} · `}${track.title}`;
      const details=document.createElement('p');details.textContent=`${new Date(track.startedAt).toLocaleString('zh-TW')}　${(track.distanceMeters/1000).toFixed(2)} km　${Math.round(track.durationSeconds/60)} 分鐘　${track.calories} kcal`;
      const mapButton=document.createElement('button');mapButton.className='export';mapButton.textContent='地圖查看';mapButton.onclick=()=>{if(window.PaceTrackDemo&&track.points?.length){window.PaceTrackDemo.show(track.points);$('exercise').scrollIntoView({behavior:'smooth'});}else setStatus('這筆紀錄沒有可顯示的 GPS 點。');};
      card.append(title,details,mapButton);
      if(isMine){const exportButton=document.createElement('button');exportButton.className='export';exportButton.textContent='匯出 JSON';exportButton.onclick=()=>exportLocalTrack(track);card.append(exportButton);}
      root.append(card);
    });
  }
  function trackExportStats(track){const points=track.points||[];let interruptions=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],ta=Number(a.t??a.timestamp),tb=Number(b.t??b.timestamp),segmentChanged=Number.isFinite(+a.segment)&&Number.isFinite(+b.segment)&&a.segment!==b.segment;if(segmentChanged||(Number.isFinite(ta)&&Number.isFinite(tb)&&tb-ta>30000))interruptions++;}return{straightLineMeters:+(points.length>1?MoveCore.distance(points[0],points.at(-1)):0).toFixed(1),interruptions};}
  function exportLocalTrack(track){const payload={...track,...trackExportStats(track)},url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='pace-track.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function renderFriendRequests(friendIds){
    requests.replaceChildren();
    [...friendIds].forEach(id=>{const item=document.createElement('div');item.className='friend-request';item.textContent=`好友 · ${db.users[id]?.nickname||'本機使用者'}`;requests.append(item);});
    db.friendships.filter(f=>f.status==='pending'&&(f.to===user.id||f.from===user.id)).forEach(request=>{
      const isIncoming=request.to===user.id, otherId=isIncoming?request.from:request.to;
      const item=document.createElement('div');item.className='friend-request';
      const label=document.createElement('span');label.textContent=isIncoming?`${db.users[otherId]?.nickname||'本機使用者'} 邀請你成為好友`:`已邀請 ${db.users[otherId]?.nickname||'本機使用者'}，等待接受`;
      item.append(label);
      if(isIncoming){const button=document.createElement('button');button.className='export';button.textContent='接受';button.onclick=()=>{request.status='accepted';request.acceptedAt=new Date().toISOString();persist();renderSocial();setStatus(`已和「${db.users[otherId]?.nickname}」成為好友。`);};item.append(button);}
      requests.append(item);
    });
    if(!requests.children.length)requests.innerHTML='<p class="feed-empty">目前沒有好友或待處理邀請。</p>';
  }
  $('friendForm').addEventListener('submit',event=>{
    event.preventDefault();if(!user){$('authDialog').showModal();return;}
    const nickname=$('friendNickname').value.normalize('NFKC').trim(),targetId=normalized(nickname);
    if(!db.users[targetId]){setStatus('找不到這個本機暱稱。請先在此瀏覽器登入該暱稱建立模擬帳號。');return;}
    if(targetId===user.id){setStatus('不能將自己加為好友。');return;}
    const existing=db.friendships.find(f=>(f.from===user.id&&f.to===targetId)||(f.from===targetId&&f.to===user.id));
    if(existing?.status==='accepted'){setStatus('你們已經是好友。');return;}
    if(existing?.status==='pending'&&existing.to===user.id){existing.status='accepted';existing.acceptedAt=new Date().toISOString();setStatus(`已和「${db.users[targetId].nickname}」成為好友。`);}
    else if(!existing){db.friendships.push({id:uniqueId(),from:user.id,to:targetId,status:'pending',createdAt:new Date().toISOString()});setStatus(`已送出好友邀請給「${db.users[targetId].nickname}」。`);}
    persist();$('friendNickname').value='';renderSocial();
  });
  $('refreshFeed').addEventListener('click',()=>{db=readDB();const id=localStorage.getItem(SESSION_KEY);user=id?db.users[id]||null:null;updateAccount();renderSocial();setStatus(user?`「${user.nickname}」的本機資料已重新整理。`:'請先輸入暱稱模擬登入。');});
  function saveTrack(record,title){
    const track={id:String(record.id||uniqueId()),title,startedAt:record.date||new Date().toISOString(),durationSeconds:Math.max(0,Math.round(record.seconds||0)),distanceMeters:Math.max(0,Number(record.meters)||0),calories:Math.max(0,Math.round(record.kcal??MoveCore.calories(record.met||4.8,record.weight||60,record.seconds||0))),points:record.points||[]};
    if(user){
      const list=db.users[user.id].tracks,existing=list.findIndex(item=>item.id===track.id);
      if(existing>=0)list[existing]=track;else list.unshift(track);
      persist();setStatus(`「${user.nickname}」的軌跡已保存在此瀏覽器。`);renderSocial();
    }else{
      db.pendingTracks.push({track,title});persist();setStatus('軌跡已加入本機待儲存清單；輸入暱稱登入後會存入該帳號。');
    }
    return track;
  }
  function flushPending(){
    if(!user||!db.pendingTracks.length)return;
    const pending=db.pendingTracks.splice(0),list=db.users[user.id].tracks;
    pending.forEach(item=>{const track={...item.track,title:item.title||item.track.title};const index=list.findIndex(existing=>existing.id===track.id);if(index>=0)list[index]=track;else list.unshift(track);});
    persist();renderSocial();setStatus(`已將 ${pending.length} 筆待儲存軌跡存入「${user.nickname}」的本機帳號。`);
  }
  window.addEventListener('pace:track-saved',event=>saveTrack(event.detail,'GPS 運動'));
  window.addEventListener('pace:track-loaded',event=>saveTrack(event.detail,event.detail.title||'載入的 GPS 軌跡'));

  $('trackFile').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    if(!user){setStatus('上傳前請先輸入暱稱登入。');$('authDialog').showModal();event.target.value='';return;}
    try{
      const text=await file.text();let points=[];
      if(file.name.toLowerCase().endsWith('.gpx')){
        const xml=new DOMParser().parseFromString(text,'application/xml');if(xml.querySelector('parsererror'))throw Error('GPX 格式無法解析');
        points=[...xml.querySelectorAll('trkpt')].map((node,i)=>({lat:+node.getAttribute('lat'),lng:+node.getAttribute('lon'),accuracy:10,t:Date.parse(node.querySelector('time')?.textContent||'')||i*5000}));
      }else{
        const data=JSON.parse(text),raw=Array.isArray(data)?data:(data.points||data.track?.points);if(!Array.isArray(raw))throw Error('JSON 必須包含 points 陣列');
        points=raw.map((p,i)=>{const rawTime=p.t??p.timestamp??p.time??i*5000,n=Number(rawTime),parsed=Number.isFinite(n)?n:Date.parse(rawTime);return{lat:+(p.lat??p.latitude),lng:+(p.lng??p.lon??p.longitude),accuracy:+(p.accuracy??10),t:Number.isFinite(parsed)?(parsed>0&&parsed<1e12?parsed*1000:parsed):i*5000};});
      }
      if(points.length<2)throw Error('軌跡至少需要兩個 GPS 點');
      const valid=[];let previous=null,meters=0,segment=-1;
      for(const point of points){const result=MoveCore.accept(previous,point);if(!result.ok)continue;if(result.break)segment++;if(previous)meters+=result.meters;valid.push({...point,segment});previous=point;}
      if(valid.length<2)throw Error('沒有足夠的有效 GPS 點，請確認座標、時間與精度欄位');
      const seconds=Math.max(0,(valid.at(-1).t-valid[0].t)/1000),record={id:uniqueId(),date:new Date(valid[0].t).toISOString(),seconds,meters,met:4.8,weight:60,points:valid};
      saveTrack(record,file.name.replace(/\.(gpx|json)$/i,''));setStatus(`已儲存 ${valid.length} 個有效點、${(meters/1000).toFixed(2)} km 的軌跡。`);
    }catch(error){setStatus(error.message||'無法讀取這份 GPS 軌跡檔。');}finally{event.target.value='';}
  });
  const savedId=(()=>{try{return localStorage.getItem(SESSION_KEY);}catch{return null;}})();
  if(savedId&&db.users[savedId])user=db.users[savedId];
  updateAccount();renderSocial();
  window.PaceCloud={saveTrack};
})();
