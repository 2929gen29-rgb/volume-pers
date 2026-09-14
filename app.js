pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const APP_VER="2026.07";  // アプリのバージョン（保存データの互換管理に使用）
// ───── 白画面防止ガード ─────
window.addEventListener("error",(e)=>{if(document.getElementById("err-banner"))return;const d=document.createElement("div");d.id="err-banner";d.style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#B0433A;color:#fff;font-family:Meiryo,sans-serif;font-size:12px;padding:8px 14px;";d.textContent="エラー: "+(e.message||"不明")+"（この文言を開発者へ）";document.body.appendChild(d);});
function webglOK(){try{const c=document.createElement("canvas");return !!(window.WebGLRenderingContext&&(c.getContext("webgl")||c.getContext("experimental-webgl")));}catch(e){return false;}}
if(!webglOK()){document.body.innerHTML='<div style="max-width:520px;margin:80px auto;padding:24px;background:#fff;border:2px solid #B0433A;border-radius:12px;font-family:Meiryo;line-height:1.9"><b style="color:#B0433A">3D描画（WebGL）が利用できません。</b><br>リモートデスクトップ経由を避け、ブラウザのハードウェアアクセラレーション設定をONにして再起動してください。</div>';throw new Error("WebGL unavailable");}
const $=(q)=>document.querySelector(q);
const numv=(v,fb)=>{const n=parseFloat(v);return isFinite(n)?n:fb};
const posv=(v,fb)=>{const n=parseFloat(v);return isFinite(n)&&n>0?n:fb};

// ───── 状態 ─────
const U={
 p:{name:"サンプル計画（架空）",use:"事務所",struct:"RC",floors:3,height:12.0,
    addr:"",                     // 建物住所
    siteArea:"",                 // 敷地面積 m²（実測値・空欄なら形状から算出）
    bldgArea:"",                 // 建築面積 m²（実測値・空欄なら1F相当から算出）
    tArea:600,                   // 延床面積 m²
    consArea:"",                 // 施工床面積 m²（容積対象外含む総施工面積）
    privArea:"",                 // 専有面積 m²（分譲・賃貸の専有合計）
    units:"",                    // 戸数・室数
    note:"",                     // その他・備考
    aiIncludeAddr:false},         // AIプロンプトに住所を含めるか（既定オフ・外部送信配慮）
 site:{w:25,d:20,dx:0,dz:0,gl:0,h:[0,0,0,0],slopeDir:"flat",slopeDiff:0}, // 敷地面積≒500㎡
 blocks:[{id:1,label:"建物",f1:1,f2:3,w:20.0,d:10.0,dx:0,dz:0,ry:0}],
 road:{w:8,side:"none",dx:0,dz:0,ry:0,show:true,slope:0,
       walkDz:0,walkW:1.6,            // 前面歩道：前後位置・幅
       sideDx:0,sideDz:0,             // 側道：左右・前後の微調整
       splitWalk:false},              // true=歩道を道路と独立して動かす
 roadwork:{mixerSize:"8t",pumpSize:"m4t",mountUp:0,        // 縦列検討の車種・歩道乗り上げ幅(m)
           permitPolice:"",permitRoad:"",permitOffice:""}, // 道路使用条件メモ（警察/道路局/建設事務所）
 subsurface:[],  // 地下の支障物（経路帯・範囲マーカー）{kind,x,z,w,d,ry}
 ojt:{},         // OJT検討項目の✓状態 {key:true}
 annot:[],       // 注記（地面貼り付け）{type:"zone"|"text", x,z,w,d,ry,color,text,fsize}
 poles:{n:3,pitch:18,far:true,dx:0,dz:0,ry:0},
 demo:{w:22,d:14,h:9,dx:0,dz:0,ry:0},
 tw:{mode:"plan",step:8,crane:true,craneModel:"JCL022", craneX:18,craneZ:-2,craneJib:28,craneRot:25,radius:true,ev:true,evX:-6,evZ:null,evRy:0,fence:true,fenceH:3,fenceGate:"front",fenceAll:false,fenceDx:0,fenceDz:0,fenceRy:0,fenceW:0,fenceD:0,scaffold:true,poles:true,mixer:true,mixX:-12,mixZ:null,mixRy:0,rough:false,rufX:14,rufZ:-2,rufRy:0},
 under:{tex:null,show:true,width:40,opacity:.65,rot:0,dx:0,dz:0,pages:1,page:1,raw:null,gsiKind:"std",gsiZoom:17,gsiStatus:""},
 photo:{tex:null,show:true,width:160,opacity:.8,rot:0,dx:0,dz:0},
 nbs:[], line:false, auto:true, tab:"諸元", tabGroup:"建物", moveLayers:false,
 guide:{show:false, road:1.25, nbor:1.25},
 sun:{az:135, alt:55},
 grid:{show:false, size:1},  // グリッド表示
 roadcond:{lane:6, walk:2.5, side:"front"}, // 道路条件（車道・歩道幅員）
 cobj:[],                    // 施工オブジェクト配列（constructionObjects）
 dim:{on:false, a:null, b:null}, // 寸法線ツール（2点間）
 polyInput:{on:false, pts:[], target:null}, // 多角形入力モード
 calib:{on:false, a:null, b:null}, // 下絵スケール補正（2点）
 dxf:{ents:null, layers:{}, scale:0.001, dx:0, dz:0, raw:null}, // DXF読込（1/1000）
 geo:{elev:null, name:"", status:""},  // 住所→標高・地形
 snap:true,                  // スナップ（道路・敷鉄板へ吸着）
 sel:null,                   // 選択中オブジェクトキー
};
const _U_DEFAULT=JSON.stringify(U);  // 新規案件用の初期状態（テンプレート/スタート画面で使用）
// 施工オブジェクトの種類定義
// 施工オブジェクト定義：各タイプに sizes（クラス展開）を持たせる
//  各クラス: {key,label, w全幅, d全長, h全高, out アウトリガー張出幅(m,任意), tail テールスイング半径(m,任意), work 作業半径(m,任意)}
const COBJ_TYPES={
 mixer:{label:"ミキサー車（生コン）",color:0x5A7FAE,sizes:[
   {key:"3t",label:"3t（小型）",w:2.0,d:5.8,h:2.8},
   {key:"8t",label:"8t（中型）",w:2.5,d:7.5,h:3.5},
   {key:"10t",label:"10t（大型）",w:2.5,d:8.5,h:3.6},
 ]},
 truck:{label:"トラック（ダンプ/平）",color:0x9AA2AF,sizes:[
   {key:"2t",label:"2t",w:1.9,d:4.7,h:2.2},
   {key:"4t",label:"4t",w:2.2,d:6.2,h:2.6},
   {key:"10t",label:"10t",w:2.5,d:8.5,h:3.2},
   {key:"semi",label:"セミトレーラー",w:2.5,d:16.5,h:3.8},
 ]},
 rough:{label:"ラフタークレーン",color:0xE8B820,sizes:[
   {key:"13t",label:"13t吊",w:2.3,d:8.5,h:3.2,out:4.6,tail:3.2,work:18},
   {key:"25t",label:"25t吊",w:2.75,d:11.5,h:3.4,out:5.8,tail:3.7,work:26},
   {key:"50t",label:"50t吊",w:3.0,d:12.5,h:3.6,out:7.0,tail:4.2,work:34},
   {key:"70t",label:"70t吊",w:3.0,d:13.5,h:3.7,out:7.8,tail:4.5,work:40},
 ]},
 pump:{label:"コンクリポンプ車",color:0x4F7CC4,sizes:[
   {key:"s2t",label:"小型(2t)",w:2.0,d:6.5,h:3.2,out:4.0,work:16},
   {key:"m4t",label:"中型(4t)",w:2.3,d:9.0,h:3.6,out:5.2,work:24},
   {key:"l8t",label:"大型(8t)",w:2.5,d:11.5,h:3.8,out:6.4,work:32},
 ]},
 backhoe:{label:"バックホウ（ユンボ）",color:0xE8731A,sizes:[
   {key:"01",label:"0.1m³(ミニ)",w:1.7,d:3.8,h:2.6,tail:1.4,work:5},
   {key:"02",label:"0.2m³",w:2.0,d:5.2,h:2.9,tail:1.7,work:6.5},
   {key:"045",label:"0.45m³",w:2.5,d:7.0,h:3.0,tail:2.2,work:9},
   {key:"08",label:"0.8m³",w:2.9,d:9.5,h:3.3,tail:2.8,work:11},
 ]},
 found:{label:"基礎・解体機械",color:0xD06A2A,sizes:[
   {key:"bg",label:"BG機械（杭打機）",w:4.5,d:6.0,h:20,tail:3.5,work:6},
   {key:"puller",label:"既存杭引抜機",w:4.0,d:5.5,h:16,tail:3.2,work:5},
 ]},
 temp:{label:"仮設材・設備",color:0xD9C9A8,sizes:[
   {key:"gate",label:"仮囲いゲート",w:6.0,d:0.4,h:3.0},
   {key:"hut",label:"プレハブ詰所",w:5.4,d:3.0,h:2.8},
   {key:"plate",label:"敷鉄板",w:1.5,d:6.0,h:0.05},
   {key:"asagao",label:"朝顔(落下防止)",w:8.0,d:1.8,h:0.2},
 ]},
 guard:{label:"警備員",color:0xCFA94A,sizes:[{key:"std",label:"標準",w:0.6,d:0.6,h:1.7}]},
 walkzone:{label:"歩行帯",color:0x6EA46E,sizes:[{key:"std",label:"標準(幅2m)",w:2,d:12,h:0.05}]},
 obstacle:{label:"支障物（地上）",color:0xC0392B,sizes:[
   {key:"padmount",label:"パットマウント(地上トランス)",w:1.4,d:1.0,h:1.3},
   {key:"hydrant",label:"消火栓・水道メーター",w:0.5,d:0.5,h:0.9},
   {key:"manhole",label:"マンホール",w:0.9,d:0.9,h:0.06},
   {key:"signal",label:"信号機・道路標識",w:0.4,d:0.4,h:5.0},
   {key:"mirror",label:"カーブミラー",w:0.5,d:0.5,h:3.5},
   {key:"tree",label:"街路樹・植栽",w:3.0,d:3.0,h:6.0},
   {key:"busstop",label:"バス停",w:1.2,d:1.0,h:2.5},
   {key:"powerline",label:"架線・高圧線(揚重支障)",w:0.3,d:14,h:8.0},
 ]},
};
// 指定タイプ・クラスの寸法を引く
function cobjSize(type,sizeKey){const t=COBJ_TYPES[type];if(!t)return null;const arr=t.sizes;return arr.find(s=>s.key===sizeKey)||arr[0];}
// 地下の支障物（範囲マーカー）種類：色・ラベル
const SUBSURFACE_TYPES={
 elec:{label:"共同溝・電気埋設管",color:0xE8B020},
 water:{label:"上下水道 本管",color:0x2E8BC0},
 gas:{label:"ガス本管",color:0xE07B2C},
 subway:{label:"地下鉄・地下構造物",color:0x7A4DB0},
 contam:{label:"汚染土壌・要注意",color:0xC0392B},
};
// 注記の色プリセット（範囲マーカー・文字で共用）
const ANNOT_COLORS=[
 {key:"red",   label:"赤（危険・注意）",  hex:0xE8442B},
 {key:"amber", label:"橙（要確認）",      hex:0xF2A33C},
 {key:"green", label:"緑（安全・OK）",    hex:0x2E7D5B},
 {key:"blue",  label:"青（情報・動線）",  hex:0x2E6FBE},
 {key:"purple",label:"紫（計画・仮）",    hex:0x7A4DB0},
];
const annotColor=(k)=>(ANNOT_COLORS.find(c=>c.key===k)||ANNOT_COLORS[0]).hex;
// タワークレーン カタログ仕様（昭和 RENTAL CATALOGUE 2018より・営業概算用）
//  work=作業半径(m), cap=定格荷重(t), tail=尾部旋回半径(m), jib=ジブ長(m)
const CRANE_SPECS={
 JCL008C:{label:"昭和 JCL008C（ジブ10m/0.8t）",jib:10,work:10,cap:0.8,tail:2.1},
 JCL010:{label:"昭和 JCL010Ⅱ（ジブ10m/1.0t）",jib:10,work:10,cap:1.0,tail:2.59},
 JCL015:{label:"昭和 JCL015Ⅱ（ジブ15m/1.0t）",jib:15,work:15,cap:1.0,tail:2.38},
 JCL07175:{label:"昭和 JCL07175Ⅱ（ジブ17.5m/0.7t）",jib:17.5,work:17.5,cap:0.7,tail:2.38},
 JCL021:{label:"昭和 JCL021C・Ⅱ（ジブ21m/1.0t）",jib:21,work:21,cap:1.0,tail:2.95},
 JCL022:{label:"昭和 JCL022Ⅱ（ジブ22m/1.0t）",jib:22,work:22,cap:1.0,tail:2.58},
 JCL030:{label:"昭和 JCL030Ⅱ（ジブ30m/1.0t）",jib:30,work:30,cap:1.0,tail:2.865},
 JCL040:{label:"昭和 JCL040Ⅱ（ジブ40m/1.0t）",jib:40,work:40,cap:1.0,tail:5.8},
};
function craneSpec(k){return CRANE_SPECS[k]||CRANE_SPECS.JCL022;}
// 敷地面積（多角形敷地があればシューレース、無ければ間口×奥行）
function siteArea(){
 if(Array.isArray(U.site.poly)&&U.site.poly.length>=3){
  const p=U.site.poly;let a2=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];a2+=a.x*b.z-b.x*a.z;}
  return Math.abs(a2)/2;
 }
 return posv(U.site.w,30)*posv(U.site.d,18);
}
const USES=["共同住宅（賃貸）","共同住宅（分譲）","ホテル","事務所","店舗","倉庫・物流","病院・医療"];

// 前面道路での施工計画の検討（縦列収まり・残車道幅）
function roadworkCalc(){
 const rw=roadworkVehDims();
 const mix=rw.mix, pmp=rw.pmp;
 const front=posv(U.site.w,30);            // 敷地間口
 const roadW=posv(U.road.w,8);             // 道路幅員
 const mount=Math.max(0,numv(U.roadwork.mountUp,0)); // 歩道乗り上げ幅
 // 縦列（前後に並べる）：全長＝両車の奥行(d)＋車間2m
 const lineLen = mix.d + pmp.d + 2.0;
 const fitFront = front>0 ? front>=lineLen : null;   // 間口に縦列が収まるか
 // 横並び（幅方向）：両車の幅＋間隔0.5m
 const sideBySide = mix.w + pmp.w + 0.5;
 // 歩道乗り上げ時の残車道：道路幅 −（車幅 − 乗り上げ分）。広い方の車で評価
 const vehW = Math.max(mix.w, pmp.w);
 const occupy = Math.max(0, vehW - mount);           // 車道側に残る占有幅
 const remain = roadW - occupy;                       // 反対側に残る車道幅
 const emgOK = remain >= 4.0;                          // 緊急車両4m基準
 const passOK = remain >= 3.0;                         // 一般車すれ違い目安3m
 return {mix,pmp,front,roadW,mount,lineLen:+lineLen.toFixed(1),fitFront,
         sideBySide:+sideBySide.toFixed(1),vehW,occupy:+occupy.toFixed(1),
         remain:+remain.toFixed(1),emgOK,passOK};
}
function roadworkVehDims(){
 const mt=COBJ_TYPES.mixer, pt=COBJ_TYPES.pump;
 const mix=(mt.sizes.find(s=>s.key===U.roadwork.mixerSize)||mt.sizes[1]);
 const pmp=(pt.sizes.find(s=>s.key===U.roadwork.pumpSize)||pt.sizes[1]);
 return {mix,pmp};
}

// ───── three 初期化 ─────
const mount=$("#view");
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
mount.appendChild(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(40,1,0.5,5000);
scene.add(new THREE.HemisphereLight(0xffffff,0x9aa0a8,.75));
const sun=new THREE.DirectionalLight(0xfff4e0,1.0);
// 影の解像度：モバイルや低解像度端末では軽く、PCでは高精細に
const _isMobile=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)||Math.min(screen.width,screen.height)<768;
const _shadowRes=_isMobile?1024:2048;
sun.position.set(80,120,60);sun.castShadow=true;sun.shadow.mapSize.set(_shadowRes,_shadowRes);
Object.assign(sun.shadow.camera,{left:-140,right:140,top:140,bottom:-140,far:600});
scene.add(sun);
const ctrl={theta:Math.PI/4+.3,phi:1.05,r:150,ty:18,cx:0,cz:0,ptrs:new Map(),pinch:0,panMid:null};
let model=null, dragMap={}, dragObj=null, dragOff=new THREE.Vector3();
const ray=new THREE.Raycaster();

function groundPoint(e){
 const r=renderer.domElement.getBoundingClientRect();
 const v=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
 ray.setFromCamera(v,camera);
 const t=-ray.ray.origin.y/ray.ray.direction.y;
 return ray.ray.origin.clone().add(ray.ray.direction.clone().multiplyScalar(t));
}
// 画面のドラッグ量(px)から注視点を平行移動（カメラ方位に正しく追従）
function panBy(dxp,dyp){
 const th=ctrl.theta, ph=ctrl.phi;
 // カメラ→注視点の水平前方ベクトル（正規化）
 let fx=-Math.cos(th), fz=-Math.sin(th);
 // 画面右ベクトル（y軸まわり）：(fx,fz)→(fz,-fx)
 const rx=fz, rz=-fx;
 const k=ctrl.r*0.0015;  // 距離に応じた移動量（遠いほど速く）
 // 指を右(dxp>0)→ワールドが右に動く→注視点は-right。指を下(dyp>0)→注視点は+fwd（奥）
 ctrl.cx += (-rx*dxp + fx*dyp)*k;
 ctrl.cz += (-rz*dxp + fz*dyp)*k;
}
function dragCandidates(){const small=["crane","ev","mixer","rough","poles","demo","road","roadwalk","roadside","fence"];const out=[];
 for(const[k,o]of Object.entries(dragMap)){
  if(small.includes(k)||k.startsWith("nb:")||k.startsWith("blk:")||k.startsWith("co:")||k.startsWith("sub:")||k.startsWith("an:"))out.push(o);
  else if((k==="site"||k==="under"||k==="photo"||k==="dxf")&&U.moveLayers)out.push(o);}
 return out;}
function pickDrag(e){
 const r=renderer.domElement.getBoundingClientRect();
 const v=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
 ray.setFromCamera(v,camera);
 const hits=ray.intersectObjects(dragCandidates(),true);
 for(const h of hits){let o=h.object;while(o&&!o.userData.dragKey)o=o.parent;if(o)return o;}
 return null;
}
const el=renderer.domElement; el.style.touchAction="none";
let rotMode=false, rotStartX=0, rotStartRy=0;
function objRyKey(k){
 if(k==="crane")return ["tw","craneRot"]; if(k==="ev")return ["tw","evRy"];
 if(k==="mixer")return ["tw","mixRy"]; if(k==="rough")return ["tw","rufRy"];
 if(k==="poles")return ["poles","ry"]; if(k==="demo")return ["demo","ry"];
 if(k==="road"||k==="roadwalk"||k==="roadside")return ["road","ry"];
 if(k==="fence")return ["tw","fenceRy"];
 if(k.startsWith("nb:"))return ["nb",+k.slice(3)];
 if(k.startsWith("blk:"))return ["blk",+k.slice(4)];
 if(k.startsWith("co:"))return ["co",+k.slice(3)];
 if(k.startsWith("sub:"))return ["sub",+k.slice(4)];
 if(k.startsWith("an:"))return ["an",+k.slice(3)];
 return null;
}
function getRy(k){const r=objRyKey(k);if(!r)return 0;
 if(r[0]==="tw")return numv(U.tw[r[1]],0); if(r[0]==="poles")return numv(U.poles.ry,0); if(r[0]==="demo")return numv(U.demo.ry,0);
 if(r[0]==="road")return numv(U.road.ry,0);
 if(r[0]==="nb")return numv((U.nbs[r[1]]||{}).ry,0); if(r[0]==="blk")return numv((U.blocks[r[1]]||{}).ry,0);
 if(r[0]==="co")return numv((U.cobj[r[1]]||{}).ry,0);
 if(r[0]==="sub")return numv((U.subsurface[r[1]]||{}).ry,0);
 if(r[0]==="an")return numv((U.annot[r[1]]||{}).ry,0);
 return 0;}
function setRy(k,deg){const r=objRyKey(k);if(!r)return;deg=((deg%360)+360)%360;
 if(r[0]==="tw")U.tw[r[1]]=+deg.toFixed(0);
 else if(r[0]==="poles")U.poles.ry=+deg.toFixed(0);
 else if(r[0]==="demo")U.demo.ry=+deg.toFixed(0);
 else if(r[0]==="road")U.road.ry=+deg.toFixed(0);
 else if(r[0]==="nb"){if(U.nbs[r[1]])U.nbs[r[1]].ry=+deg.toFixed(0);}
 else if(r[0]==="blk"){if(U.blocks[r[1]])U.blocks[r[1]].ry=+deg.toFixed(0);}
 else if(r[0]==="co"){if(U.cobj[r[1]])U.cobj[r[1]].ry=+deg.toFixed(0);}
 else if(r[0]==="sub"){if(U.subsurface[r[1]])U.subsurface[r[1]].ry=+deg.toFixed(0);}
 else if(r[0]==="an"){if(U.annot[r[1]])U.annot[r[1]].ry=+deg.toFixed(0);}}
el.addEventListener("pointerdown",(e)=>{
 ctrl.ptrs.set(e.pointerId,[e.clientX,e.clientY]);el.setPointerCapture(e.pointerId);
 // 多角形入力モード：地面クリックで頂点追加
 if(U.polyInput.on&&ctrl.ptrs.size===1){const gp=groundPoint(e);
  U.polyInput.pts.push({x:+(gp.x-numv(U.site.dx,0)).toFixed(2),z:+(gp.z-numv(U.site.dz,0)).toFixed(2)});
  rebuild();renderPanel();return;}
 // 下絵スケール補正：2点クリック
 if(U.calib.on&&ctrl.ptrs.size===1){const gp=groundPoint(e);
  if(!U.calib.a){U.calib.a={x:+gp.x.toFixed(2),z:+gp.z.toFixed(2)};U.calib.b=null;}
  else if(!U.calib.b){U.calib.b={x:+gp.x.toFixed(2),z:+gp.z.toFixed(2)};
   const px=Math.hypot(U.calib.b.x-U.calib.a.x,U.calib.b.z-U.calib.a.z);
   const ans=prompt("この2点間の実際の距離（m）を入力してください：\n（現在の画面上の距離: "+px.toFixed(2)+"m）");
   const real=parseFloat(ans);
   if(isFinite(real)&&real>0&&px>0.01){U.under.width=+(numv(U.under.width,40)*(real/px)).toFixed(2);U.calib.on=false;U.calib.a=null;U.calib.b=null;toast("下絵スケールを補正しました。図面幅 ≒ "+U.under.width+"m","ok");}
  }
  else {U.calib.a={x:+gp.x.toFixed(2),z:+gp.z.toFixed(2)};U.calib.b=null;}
  rebuild();renderPanel();return;}
 // 寸法線ツール：地面の2点を順にクリック
 if(U.dim.on&&ctrl.ptrs.size===1){const gp=groundPoint(e);
  if(!U.dim.a){U.dim.a={x:+gp.x.toFixed(2),z:+gp.z.toFixed(2)};U.dim.b=null;}
  else if(!U.dim.b){U.dim.b={x:+gp.x.toFixed(2),z:+gp.z.toFixed(2)};}
  else {U.dim.a={x:+gp.x.toFixed(2),z:+gp.z.toFixed(2)};U.dim.b=null;}
  rebuild();renderBar();return;}
 if(ctrl.ptrs.size===1 && !e.shiftKey){const o=pickDrag(e);if(o){snapshot();dragObj=o;U.sel=o.userData.dragKey;
   if(e.ctrlKey||e.metaKey){rotMode=true;rotStartX=e.clientX;rotStartRy=getRy(o.userData.dragKey);}
   else{rotMode=false;const gp=groundPoint(e);dragOff.set(o.position.x-gp.x,0,o.position.z-gp.z);}
   U.auto=false;syncBtns();}else{U.sel=null;}}
});
el.addEventListener("pointermove",(e)=>{
 if(!ctrl.ptrs.has(e.pointerId))return;
 const prev=ctrl.ptrs.get(e.pointerId);ctrl.ptrs.set(e.pointerId,[e.clientX,e.clientY]);
 if(dragObj&&rotMode&&ctrl.ptrs.size===1){setRy(dragObj.userData.dragKey,rotStartRy+(e.clientX-rotStartX)*0.7);rebuild();return;}
 if(dragObj&&ctrl.ptrs.size===1){const gp=groundPoint(e);dragObj.position.x=gp.x+dragOff.x;dragObj.position.z=gp.z+dragOff.z;return;}
 if(ctrl.ptrs.size===1){
   if(e.shiftKey){ // Shift+ドラッグ＝パン（注視点を平行移動）
    panBy(e.clientX-prev[0], e.clientY-prev[1]);
    U.auto=false;
   }else{ // 通常ドラッグ＝回転
    ctrl.theta-=(e.clientX-prev[0])*.006;ctrl.phi=Math.min(1.52,Math.max(.12,ctrl.phi-(e.clientY-prev[1])*.004));U.auto=false;syncBtns();
   }
 }
 else if(ctrl.ptrs.size===2){const p=[...ctrl.ptrs.values()];
   const d=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);
   const mid=[(p[0][0]+p[1][0])/2,(p[0][1]+p[1][1])/2];
   // ピンチでズーム
   if(ctrl.pinch)ctrl.r=Math.min(800,Math.max(20,ctrl.r*(ctrl.pinch/d)));
   // 2本指の中心移動でパン（注視点を平行移動）→「見たい場所を画面中央に」
   if(ctrl.panMid)panBy(mid[0]-ctrl.panMid[0], mid[1]-ctrl.panMid[1]);
   ctrl.pinch=d; ctrl.panMid=mid; U.auto=false; syncBtns();
  }
});
const endPtr=(e)=>{ctrl.ptrs.delete(e.pointerId);ctrl.pinch=0;ctrl.panMid=null;
 if(dragObj&&!rotMode){const k=dragObj.userData.dragKey,x=dragObj.position.x,z=dragObj.position.z;
  if(k==="crane"){U.tw.craneX=+x.toFixed(1);U.tw.craneZ=+z.toFixed(1);}
  if(k==="ev"){U.tw.evX=+x.toFixed(1);U.tw.evZ=+z.toFixed(1);}
  if(k==="mixer"){U.tw.mixX=+x.toFixed(1);U.tw.mixZ=+z.toFixed(1);}
  if(k==="rough"){U.tw.rufX=+x.toFixed(1);U.tw.rufZ=+z.toFixed(1);}
  if(k==="road"||k==="roadwalk"||k==="roadside"){
    const sdx2=numv(U.site.dx,0), sdz2=numv(U.site.dz,0), sd2=posv(U.site.d,18);
    const rw2=Math.min(20,Math.max(4,numv(U.road.w,8)));
    if(k==="road"){ // 道路全体：基準(車道中心)からの差分
      const baseX=sdx2, baseZ=sdz2+sd2/2+1.6+rw2/2;
      U.road.dx=+(x-baseX).toFixed(1); U.road.dz=+(z-baseZ).toFixed(1);
    }else if(k==="roadwalk"){ // 前面歩道のみ：前後位置を独立保存
      const baseWalkZ=sdz2+sd2/2+0.8+numv(U.road.dz,0);
      U.road.walkDz=+(z-baseWalkZ).toFixed(1);
    }else if(k==="roadside"){ // 側道：左右・前後の微調整
      U.road.sideDx=+(x-sdx2).toFixed(1); U.road.sideDz=+(z-sdz2).toFixed(1);
    }
    rebuild();
  }
  if(k==="poles"){U.poles.dx=+(x-numv(U.site.dx,0)).toFixed(1);U.poles.dz=+(z-numv(U.site.dz,0)).toFixed(1);}
  if(k==="fence"){U.tw.fenceDx=+(x-numv(U.site.dx,0)).toFixed(1);U.tw.fenceDz=+(z-numv(U.site.dz,0)).toFixed(1);}
  if(k==="demo"){U.demo.dx=+(x-numv(U.site.dx,0)).toFixed(1);U.demo.dz=+(z-numv(U.site.dz,0)).toFixed(1);}
  if(k==="under"){U.under.dx=+x.toFixed(1);U.under.dz=+z.toFixed(1);}
  if(k==="photo"){U.photo.dx=+x.toFixed(1);U.photo.dz=+z.toFixed(1);}
  if(k==="site"){U.site.dx=+x.toFixed(1);U.site.dz=+z.toFixed(1);rebuild();}
  if(k.startsWith("nb:")){const n=U.nbs[+k.slice(3)];if(n){n.x=+x.toFixed(1);n.z=+z.toFixed(1);}}
  if(k.startsWith("blk:")){const b=U.blocks[+k.slice(4)];if(b){b.dx=+(x-numv(U.site.dx,0)).toFixed(1);b.dz=+(z-numv(U.site.dz,0)).toFixed(1);}}
  if(k.startsWith("co:")){const c=U.cobj[+k.slice(3)];if(c){
    let nx=+x.toFixed(1), nz=+z.toFixed(1);
    // スナップ：前面道路の歩行帯/敷鉄板ラインに近ければZを吸着、角度は道路平行(0°)へ寄せる
    if(U.snap!==false){
     const roadZ=numv(U.site.dz,0)+posv(U.site.d,18)/2+1.6+Math.min(20,Math.max(4,numv(U.road.w,8)))/2;
     if(Math.abs(nz-roadZ)<1.5){nz=+roadZ.toFixed(1);}              // 道路中心へ吸着
     // 近くの敷鉄板に平行寄せ
     U.cobj.forEach((o,oi)=>{if(o!==c&&o.type==="temp"&&o.size==="plate"){
       if(Math.hypot(numv(o.x,0)-nx,numv(o.z,0)-nz)<3){c.ry=numv(o.ry,0);}}});
    }
    c.x=nx;c.z=nz;}}
  if(k.startsWith("sub:")){const s=U.subsurface[+k.slice(4)];if(s){s.x=+x.toFixed(1);s.z=+z.toFixed(1);}}
  if(k.startsWith("an:")){const a=U.annot[+k.slice(3)];if(a){a.x=+x.toFixed(1);a.z=+z.toFixed(1);}}
  dragObj=null;renderPanel();}
 else if(dragObj&&rotMode){
   if(U.snap){const k=dragObj.userData.dragKey;const cur=getRy(k);setRy(k,Math.round(cur/15)*15);rebuild();}
   dragObj=null;rotMode=false;renderPanel();}
};
el.addEventListener("pointerup",endPtr);el.addEventListener("pointercancel",endPtr);
el.addEventListener("wheel",(e)=>{e.preventDefault(); if((e.ctrlKey||e.metaKey)&&dragObj){setRy(dragObj.userData.dragKey,getRy(dragObj.userData.dragKey)+(e.deltaY>0?5:-5));rebuild();return;}
 ctrl.r=Math.min(800,Math.max(20,ctrl.r*(1+e.deltaY*.001)));},{passive:false});
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
el.addEventListener("dblclick",(e)=>{
 if(U.polyInput.on&&U.polyInput.pts.length>=3){
  if(U.polyInput.target==="site"){
   // 敷地形状（不整形地）として確定
   U.site.poly=U.polyInput.pts.slice();
   U.polyInput.on=false; U.polyInput.pts=[]; U.polyInput.target=null;
   rebuild();renderPanel();renderBar();
  }else{
   U.blocks.push({id:Date.now(),label:"多角形",f1:1,f2:Math.max(1,Math.round(posv(U.p.floors,3))),shape:"poly",poly:U.polyInput.pts.slice(),dx:0,dz:0,ry:0});
   U.polyInput.on=false;U.polyInput.pts=[];U.polyInput.target=null;
   rebuild();renderPanel();renderBar();
  }
 }
});
addEventListener("resize",resize);resize();
(function loop(){requestAnimationFrame(loop);if(U.auto)ctrl.theta+=.0035;
 camera.position.set(ctrl.cx+ctrl.r*Math.sin(ctrl.phi)*Math.cos(ctrl.theta),ctrl.ty+ctrl.r*Math.cos(ctrl.phi),ctrl.cz+ctrl.r*Math.sin(ctrl.phi)*Math.sin(ctrl.theta));
 camera.lookAt(ctrl.cx,ctrl.ty,ctrl.cz);renderer.render(scene,camera);})();

// ───── 地形 ─────
function terrainH(x,z,sw,sd,h){ // h:[前左,前右,奥左,奥右] 前=+z
 const u=Math.min(1,Math.max(0,(x+sw/2)/sw)), v=Math.min(1,Math.max(0,(z+sd/2)/sd));
 const back=h[2]+(h[3]-h[2])*u, front=h[0]+(h[1]-h[0])*u;
 return back+(front-back)*v;
}

// ───── モデル再構築 ─────
function rebuild(){
 if(model){scene.remove(model);model.traverse(o=>{o.geometry&&o.geometry.dispose();o.material&&(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose&&m.dispose());});}
 dragMap={};
 const g=new THREE.Group(); const L=U.line; const DET=true;  // 詳細表現に一本化（概算モードは廃止）
 scene.background=new THREE.Color(L?0xffffff:0xdce6f0);
 scene.fog=L?null:new THREE.Fog(0xdce6f0,400,1100);
  sun.castShadow=!L;
 {const az=numv(U.sun.az,135)*Math.PI/180, alt=Math.max(8,numv(U.sun.alt,55))*Math.PI/180, R=180;
  sun.position.set(R*Math.cos(alt)*Math.sin(az),R*Math.sin(alt),R*Math.cos(alt)*Math.cos(az));}
 const mat=(c,o={})=>L?new THREE.MeshBasicMaterial({color:0xffffff}):new THREE.MeshLambertMaterial(Object.assign({color:c},o));
 const edge=(geo,m,col=0x16243d)=>{if(!L)return;const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo,12),new THREE.LineBasicMaterial({color:col}));e.position.copy(m.position);e.rotation.copy(m.rotation);g.add(e);};
 const box=(parent,w,h,d,c,x,y,z,o={})=>{const geo=new THREE.BoxGeometry(w,h,d);const m=new THREE.Mesh(geo,o.mat||mat(c,o));m.position.set(x,y,z);if(o.ry)m.rotation.y=o.ry;if(o.rx)m.rotation.x=o.rx;m.castShadow=!L&&o.shadow!==false;m.receiveShadow=!L;parent.add(m);if(parent===g)edge(geo,m);return m;};
 const cylm=(parent,r1,r2,h,c,x,y,z,o={})=>{const geo=new THREE.CylinderGeometry(r1,r2,h,o.seg||10);const m=new THREE.Mesh(geo,mat(c));m.position.set(x,y,z);if(o.rz)m.rotation.z=o.rz;if(o.rx)m.rotation.x=o.rx;m.castShadow=!L;parent.add(m);return m;};

 const floorsAll=Math.min(60,Math.max(1,Math.round(posv(U.p.floors,14))));
 const H=posv(U.p.height,42), fh=H/floorsAll;
 const built=U.tw.mode==="build"?Math.min(floorsAll,Math.max(1,Math.round(numv(U.tw.step,1)))):floorsAll;
 const sw=posv(U.site.w,30), sd=posv(U.site.d,18), gl=numv(U.site.gl,0), hh=U.site.h.map(v=>numv(v,0));
 const sdx=numv(U.site.dx,0), sdz=numv(U.site.dz,0);

 // 地面・道路
 const gnd=new THREE.Mesh(new THREE.PlaneGeometry(1200,1200),L?new THREE.MeshBasicMaterial({color:0xffffff}):new THREE.MeshLambertMaterial({color:0xb9bec7}));
 gnd.rotation.x=-Math.PI/2;gnd.position.y=-0.07;gnd.receiveShadow=!L;g.add(gnd);
 // ワールド座標(x,z)における地盤の高さ。敷地の外は0（元の地面）
 // 傾斜地に置いたオブジェクト（仮囲い・重機・車両・注記）を地面に接地させるために使う
 const groundY=(wx,wz)=>{
  if(Array.isArray(U.site.poly))return 0;            // 多角形敷地は平坦扱い
  const lx=wx-sdx, lz=wz-sdz;                        // 敷地ローカル座標へ
  if(Math.abs(lx)>sw/2||Math.abs(lz)>sd/2)return 0;  // 敷地外は0
  return terrainH(lx,lz,sw,sd,hh);
 };
 const rw=Math.min(20,Math.max(4,numv(U.road.w,8)));
 const roadDx=numv(U.road.dx,0), roadDz=numv(U.road.dz,0), roadRy=numv(U.road.ry,0)*Math.PI/180;
 const roadZ=sdz+sd/2+1.6+rw/2+roadDz;     // 車道中心Z（オフセット込み）
 const roadCx=sdx+roadDx;                   // 車道中心X（オフセット込み）
 // 道路表示（地図下敷きを使うときはオフにできる）
 if(U.road.show!==false){
 // ── 車道グループ（dragKey=road：ドラッグ＝全体移動 / Ctrl＝回転）──
 const roadG=new THREE.Group(); roadG.userData.dragKey="road";
 roadG.position.set(roadCx,0,roadZ); roadG.rotation.y=roadRy;
 // 前面道路の傾斜（左右方向）：道路が坂になっている場合
 const roadSlope=numv(U.road.slope,0);  // 左端→右端の高低差(m)
 if(Math.abs(roadSlope)>0.01){
  const roadLen=sw+60;
  roadG.rotation.z=Math.atan2(roadSlope,roadLen);  // 長手方向に傾ける
 }
 {const rm=new THREE.Mesh(new THREE.BoxGeometry(sw+60,0.1,rw),L?new THREE.MeshBasicMaterial({color:0xffffff}):new THREE.MeshLambertMaterial({color:0x8d929b}));rm.position.y=0.05;rm.receiveShadow=!L;roadG.add(rm);}
 if(!L && rw>=6){const cl=new THREE.Mesh(new THREE.BoxGeometry(sw+60,0.02,0.25),new THREE.MeshLambertMaterial({color:0xf2f4f6}));cl.position.y=0.07;roadG.add(cl);}
 g.add(roadG); dragMap.road=roadG;
 // ── 前面歩道グループ（dragKey=roadwalk：独立して前後移動可）──
 if(!L){
  const walkW=numv(U.road.walkW,1.6);
  const walkZbase=sdz+sd/2+0.8+roadDz;       // 既定は敷地と車道の間
  const walkZ=walkZbase+numv(U.road.walkDz,0);
  const walkG=new THREE.Group(); walkG.userData.dragKey="roadwalk";
  walkG.position.set(sdx+roadDx,0,walkZ); walkG.rotation.y=roadRy;
  const wm=new THREE.Mesh(new THREE.BoxGeometry(sw+60,0.12,walkW),new THREE.MeshLambertMaterial({color:0xe8eaee}));wm.position.y=0.07;walkG.add(wm);
  g.add(walkG); dragMap.roadwalk=walkG;
 }
 // ── 側道グループ（dragKey=roadside）──
 if(U.road.side==="left"||U.road.side==="right"){
  const sgn=(U.road.side==="left"?-1:1);
  const sideG=new THREE.Group(); sideG.userData.dragKey="roadside";
  sideG.position.set(sdx+numv(U.road.sideDx,0),0,sdz+numv(U.road.sideDz,0)); sideG.rotation.y=roadRy;
  const sm=new THREE.Mesh(new THREE.BoxGeometry(rw,0.1,sd+rw+24),L?new THREE.MeshBasicMaterial({color:0xffffff}):new THREE.MeshLambertMaterial({color:0x8d929b}));
  sm.position.set(sgn*(sw/2+1.6+rw/2),0.05,rw/2);sm.receiveShadow=!L;sideG.add(sm);
  if(!L){const sw2=new THREE.Mesh(new THREE.BoxGeometry(1.6,0.12,sd),new THREE.MeshLambertMaterial({color:0xe8eaee}));sw2.position.set(sgn*(sw/2+0.8),0.07,0);sideG.add(sw2);}
  g.add(sideG); dragMap.roadside=sideG;
 }
 }
 // グリッド表示
 if(U.grid.show&&!L){
  const gh=new THREE.GridHelper(200, Math.round(200/Math.max(0.5,numv(U.grid.size,1))), 0x9aa4b4, 0xc8cfd9);
  gh.position.set(sdx,0.02,sdz); g.add(gh);
 }
 // 歩行帯（道路条件から自動生成）：前面道路沿いの歩道部に緑帯
 let walkZone=null;
 if(!L && U.roadcond && numv(U.roadcond.walk,0)>0){
  const ww=numv(U.roadcond.walk,2.5);
  const wz=sdz+sd/2+1.6+rw+ww/2+roadDz;  // 車道の外側に歩道
  walkZone={x:sdx+roadDx,z:wz,w:sw+60,d:ww};
  box(g,sw+60,0.04,ww,0x6EA46E,sdx+roadDx,0.09,wz,{shadow:false});
 }

 // 敷地（地形メッシュ・ドラッグ可）
 const siteG=new THREE.Group();siteG.userData.dragKey="site";siteG.position.set(sdx,0,sdz);
 if(Array.isArray(U.site.poly)&&U.site.poly.length>=3){
  // ── 不整形地（多角形敷地）──
  const sp=U.site.poly;
  const shape=new THREE.Shape();
  shape.moveTo(sp[0].x,-sp[0].z);
  for(let i=1;i<sp.length;i++)shape.lineTo(sp[i].x,-sp[i].z);
  shape.closePath();
  const geo=new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI/2);            // XY平面 → 地面(XZ)へ
  geo.translate(0,0.12,0);
  const sm=new THREE.Mesh(geo,L?new THREE.MeshBasicMaterial({color:0xffffff}):new THREE.MeshLambertMaterial({color:U.tw.mode==="build"?0xb8b2a6:0xc8ccd2,side:THREE.DoubleSide}));
  sm.receiveShadow=!L;siteG.add(sm);
  // 外周ライン
  const lp=[]; sp.forEach(p=>lp.push(p.x,0.14,-p.z)); lp.push(sp[0].x,0.14,-sp[0].z);
  const lg=new THREE.BufferGeometry();lg.setAttribute("position",new THREE.BufferAttribute(new Float32Array(lp),3));
  siteG.add(new THREE.Line(lg,new THREE.LineBasicMaterial({color:L?0x8a94a8:0x6b7686})));
 }else{
  // ── 矩形敷地（従来：四隅高さで傾斜）──
  const seg=12,vts=[],idx=[];
  for(let j=0;j<=seg;j++)for(let i=0;i<=seg;i++){const x=-sw/2+sw*i/seg,z=-sd/2+sd*j/seg;vts.push(x,terrainH(x,z,sw,sd,hh)+0.12,z);}
  for(let j=0;j<seg;j++)for(let i=0;i<seg;i++){const a=j*(seg+1)+i;idx.push(a,a+seg+1,a+1,a+1,a+seg+1,a+seg+2);}
  const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.BufferAttribute(new Float32Array(vts),3));geo.setIndex(idx);geo.computeVertexNormals();
  const sm=new THREE.Mesh(geo,L?new THREE.MeshBasicMaterial({color:0xffffff}):new THREE.MeshLambertMaterial({color:U.tw.mode==="build"?0xb8b2a6:0xc8ccd2}));
  sm.receiveShadow=!L;siteG.add(sm);
  if(L){const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo,5),new THREE.LineBasicMaterial({color:0x8a94a8}));siteG.add(e);}
 }
 g.add(siteG);dragMap.site=siteG;

 // 下敷き（図面 / 周辺写真）
 const layer=(st,key,y)=>{ if(!st.show||!st.tex||L)return;
  const ar=st.tex.image?st.tex.image.height/st.tex.image.width:1, w=posv(st.width,40);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,w*ar),new THREE.MeshBasicMaterial({map:st.tex,transparent:true,opacity:numv(st.opacity,.7),depthWrite:false}));
  m.rotation.x=-Math.PI/2;m.rotation.z=numv(st.rot,0)*Math.PI/180;
  m.position.set(numv(st.dx,0),y,numv(st.dz,0));m.userData.dragKey=key;g.add(m);dragMap[key]=m;};
 layer(U.photo,"photo",0.10);
 layer(U.under,"under",0.18);

 // 近隣建物
 U.nbs.forEach((n,i)=>{
  const m=box(g,posv(n.w,10),posv(n.h,12),posv(n.d,10),0xdadde2,numv(n.x,20),posv(n.h,12)/2,numv(n.z,20));
  m.rotation.y=numv(n.ry,0)*Math.PI/180;
  m.userData.dragKey="nb:"+i;dragMap["nb:"+i]=m;
 });

 // 建物ブロック
 const isApt=U.p.use.startsWith("共同住宅"), isOff=(U.p.use==="事務所"||U.p.use==="店舗");
 let entDone=false, frontMax=0, sumFloorArea=0, maxFloors=0;
 if(U.tw.mode!=="demo") U.blocks.forEach((b,bi)=>{
  const f1=Math.max(1,Math.round(posv(b.f1,1)));
  const f2=Math.min(floorsAll,Math.max(f1,Math.round(posv(b.f2,f1))));
  const nFfull=f2-f1+1;
  // ───── 自由多角形ブロック ─────
  if(b.shape==="poly" && Array.isArray(b.poly) && b.poly.length>=3){
   const pts=b.poly; // [{x,z}...] m単位（敷地原点基準）
   // 多角形面積（シューレース公式・x-z平面）
   let area2=0; for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];area2+=p.x*q.z-q.x*p.z;}
   const area=Math.abs(area2)/2;
   sumFloorArea+=area*nFfull; maxFloors=Math.max(maxFloors,f2);
   const bTo=Math.min(f2,built); if(bTo<f1)return;
   const nF=bTo-f1+1, bh=nF*fh, y0=gl+(f1-1)*fh;
   const shape=new THREE.Shape();
   shape.moveTo(pts[0].x, -pts[0].z);  // x-z → x-(-z)でThree.jsの向きに
   for(let i=1;i<pts.length;i++)shape.lineTo(pts[i].x, -pts[i].z);
   shape.closePath();
   const eg=new THREE.ExtrudeGeometry(shape,{depth:bh,bevelEnabled:false});
   eg.rotateX(-Math.PI/2);  // XY押し出し → Y方向の高さに
   const ox=sdx+numv(b.dx,0), oz=sdz+numv(b.dz,0);
   // ── 用途別マテリアル（矩形ブロックと外観を統一）──
   let polyMat;
   if(L){polyMat=new THREE.MeshBasicMaterial({color:0xffffff});}
   else if(isApt){polyMat=new THREE.MeshLambertMaterial({color:0xcfd3d9});}                                  // 共同住宅：コンクリート調
   else if(isOff){polyMat=new THREE.MeshLambertMaterial({color:0x3a587a,transparent:true,opacity:0.62});}    // 事務所/店舗：ガラス調
   else if(U.p.use==="ホテル"){polyMat=new THREE.MeshLambertMaterial({color:0xd8d2c4});}                      // ホテル：温かいベージュ
   else if(U.p.use==="倉庫・物流"){polyMat=new THREE.MeshLambertMaterial({color:0xc2c7cd});}                  // 倉庫：金属サイディング調
   else if(U.p.use==="病院・医療"){polyMat=new THREE.MeshLambertMaterial({color:0xe6e9ec});}                  // 病院：清潔感の白
   else{polyMat=new THREE.MeshLambertMaterial({color:0xcfd3d9});}
   const pm=new THREE.Mesh(eg, polyMat);
   pm.position.set(ox,y0+0.12,oz); pm.castShadow=!L; pm.receiveShadow=!L;
   pm.userData.dragKey="blk:"+bi; g.add(pm); dragMap["blk:"+bi]=pm;
   if(L){const ee=new THREE.LineSegments(new THREE.EdgesGeometry(eg,12),new THREE.LineBasicMaterial({color:0x16243d}));ee.position.set(ox,y0+0.12,oz);g.add(ee);}
   // ── 各階の窓ライン（外周にぐるりと帯／詳細検証モードで表示・サンプル同様の見た目に）──
   if(!L && DET && nF>=1){
    // 多角形の外周ライン（閉路）をベースに、各階の窓ベルトを縁取り線で表現
    const ringPts=[]; pts.forEach(p=>ringPts.push(p.x,0,-p.z)); ringPts.push(pts[0].x,0,-pts[0].z);
    const winCol = isApt?0x3a587a : isOff?0x9fc0e8 : 0x4a6a90;
    for(let fl=0; fl<nF; fl++){
     const yWin=y0+fl*fh+fh*0.55+0.12;
     const arr=ringPts.slice(); for(let vi=1;vi<arr.length;vi+=3)arr[vi]=yWin;
     const wg=new THREE.BufferGeometry(); wg.setAttribute("position",new THREE.BufferAttribute(new Float32Array(arr),3));
     const wl=new THREE.Line(wg,new THREE.LineBasicMaterial({color:winCol,transparent:true,opacity:0.85}));
     wl.position.set(ox,0,oz); g.add(wl);
    }
   }
   // 屋上パラペット相当（簡易）
   if(bTo===f2&&U.tw.mode==="plan"&&!L){const cap=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:0.8,bevelEnabled:false}),new THREE.MeshLambertMaterial({color:isApt?0xcfd3d9:isOff?0x33425a:0xcfd3d9}));cap.geometry.rotateX(-Math.PI/2);cap.position.set(ox,y0+bh+0.12,oz);g.add(cap);}
   // 多角形建物にも足場を巻く（建物メッシュの実バウンディングボックスから・座標ズレ防止）
   if(U.tw.scaffold&&U.tw.mode==="build"&&!L){
    eg.computeBoundingBox(); const bb=eg.boundingBox;
    const pw=(bb.max.x-bb.min.x)+1.8, pd=(bb.max.z-bb.min.z)+1.8;
    const bcx=(bb.min.x+bb.max.x)/2, bcz=(bb.min.z+bb.max.z)/2;
    const sg2=new THREE.BoxGeometry(pw,bh+1.5,pd);
    const sm2=new THREE.Mesh(sg2,new THREE.MeshLambertMaterial({color:0xf4f6f8,transparent:true,opacity:.3,depthWrite:false}));
    sm2.position.set(ox+bcx,y0+(bh+1.5)/2+.1,oz+bcz);g.add(sm2);
    const ee2=new THREE.LineSegments(new THREE.EdgesGeometry(sg2),new THREE.LineBasicMaterial({color:0xaab2bf}));ee2.position.copy(sm2.position);g.add(ee2);
   }
   return;
  }
  const W=posv(b.w, Math.sqrt(posv(b.area,200)*posv(b.ratio,1.5)));
  const D=posv(b.d, Math.sqrt(posv(b.area,200)/posv(b.ratio,1.5)));
  sumFloorArea+=W*D*nFfull; maxFloors=Math.max(maxFloors,f2);
  const bTo=Math.min(f2,built); if(bTo<f1)return;
  const dx=sdx+numv(b.dx,0), dz=sdz+numv(b.dz,0), ry=numv(b.ry,0)*Math.PI/180;
  frontMax=Math.max(frontMax,dz+Math.max(W,D)/2);
  const nF=bTo-f1+1, bh=nF*fh, y0=gl+(f1-1)*fh;
  // ローカル群（原点中心）→ 回転・配置。children は dx,dz を引いたローカル座標で配置
  const bg=new THREE.Group(); bg.userData.dragKey="blk:"+bi;
  const lbox=(w,h,d,c,lx,ly,lz,o={})=>{const geo=new THREE.BoxGeometry(w,h,d);const m=new THREE.Mesh(geo,o.mat||mat(c,o));m.position.set(lx,ly,lz);m.castShadow=!L&&o.shadow!==false;m.receiveShadow=!L;bg.add(m);if(L){const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo,12),new THREE.LineBasicMaterial({color:0x16243d}));e.position.set(lx,ly,lz);bg.add(e);}return m;};
  lbox(W,1.2,D,0xb4b8be,0,gl-0.55,0); // 基礎スカート
  // 躯体色：用途連動（多角形と統一）
  const bodyCol = isOff?0x3a587a : (U.p.use==="ホテル")?0xd8d2c4 : (U.p.use==="倉庫・物流")?0xc2c7cd : (U.p.use==="病院・医療")?0xe6e9ec : 0xcfd3d9;
  const bodyOpt = isOff?{mat:new THREE.MeshLambertMaterial({color:0x3a587a,transparent:true,opacity:0.62})}:{};
  lbox(W,bh,D,bodyCol,0,y0+bh/2+0.12,0,bodyOpt);
  if(bTo===f2&&U.tw.mode==="plan"){lbox(W+0.5,0.9,D+0.5,bodyCol===0x3a587a?0x33425a:bodyCol,0,y0+bh+0.55,0);
   if(f2===floorsAll)lbox(W*0.28,3,D*0.3,bodyCol===0x3a587a?0x33425a:bodyCol,W*0.22,y0+bh+2.4,-D*0.15);}
  if(f1===1&&!entDone){lbox(Math.min(8,W*0.5),fh*0.9,0.4,0x3a587a,0,gl+fh*0.45+0.12,D/2+0.18);entDone=true;}
  if(!L&&DET){const M=new THREE.Matrix4();
   if(isApt){const mk=(geo,c,zz,yy,op)=>{const im=new THREE.InstancedMesh(geo,new THREE.MeshLambertMaterial({color:c,transparent:!!op,opacity:op||1}),nF);
     for(let i=0;i<nF;i++)im.setMatrixAt(i,M.makeTranslation(0,y0+i*fh+yy,zz));im.castShadow=true;bg.add(im);};
    mk(new THREE.BoxGeometry(W*.96,.16,1.4),0xe2e5e9,D/2+.72,fh+.05);
    mk(new THREE.BoxGeometry(W*.96,fh*.42,.06),0xf0f2f5,D/2+1.38,fh*.55,.85);
    mk(new THREE.BoxGeometry(W*.92,fh*.6,.08),0x3a587a,D/2+.06,fh*.55);
    mk(new THREE.BoxGeometry(W*.9,fh*.45,.08),0x3a587a,-D/2-.06,fh*.55);
   }else if(isOff){const im=new THREE.InstancedMesh(new THREE.BoxGeometry(W*.96,fh*.55,.08),new THREE.MeshLambertMaterial({color:0x3a587a}),nF*2);
    for(let i=0;i<nF;i++){im.setMatrixAt(i*2,M.makeTranslation(0,y0+i*fh+fh*.55,D/2+.06));im.setMatrixAt(i*2+1,M.makeTranslation(0,y0+i*fh+fh*.55,-D/2-.06));}
    bg.add(im);
   }else if(U.p.use==="倉庫・物流"){
    // 倉庫：水平サイディングのライン＋大型シャッター（1F前面）
    const sid=new THREE.InstancedMesh(new THREE.BoxGeometry(W*.98,.1,.04),new THREE.MeshLambertMaterial({color:0x9aa1a9}),nF*2);
    for(let i=0;i<nF;i++){sid.setMatrixAt(i*2,M.makeTranslation(0,y0+i*fh+fh*.5,D/2+.05));sid.setMatrixAt(i*2+1,M.makeTranslation(0,y0+i*fh+fh*.5,-D/2-.05));}
    bg.add(sid);
    const sh=Math.min(5,fh*0.85), shw=Math.min(W*0.7,8);
    const shut=new THREE.Mesh(new THREE.BoxGeometry(shw,sh,.12),new THREE.MeshLambertMaterial({color:0x6b7079}));shut.position.set(0,gl+sh/2+0.12,D/2+.07);bg.add(shut);
   }else if(U.p.use==="病院・医療"){
    // 病院：規則的な横長窓（連窓）＋明るいスパンドレル
    const win=new THREE.InstancedMesh(new THREE.BoxGeometry(W*.92,fh*.4,.06),new THREE.MeshLambertMaterial({color:0x9fc0e8,transparent:true,opacity:.8}),nF*2);
    for(let i=0;i<nF;i++){win.setMatrixAt(i*2,M.makeTranslation(0,y0+i*fh+fh*.55,D/2+.05));win.setMatrixAt(i*2+1,M.makeTranslation(0,y0+i*fh+fh*.55,-D/2-.05));}
    bg.add(win);
   }else{const nx=Math.max(3,Math.floor(W/2.4));
    const im=new THREE.InstancedMesh(new THREE.BoxGeometry(1.4,fh*.5,.08),new THREE.MeshLambertMaterial({color:0x3a587a}),nx*nF*2);let k=0;
    for(let i=0;i<nF;i++)for(let j=0;j<nx;j++){const x=-W/2+(j+.5)*(W/nx);
     if(f1+i>1){im.setMatrixAt(k++,M.makeTranslation(x,y0+i*fh+fh*.55,D/2+.06));im.setMatrixAt(k++,M.makeTranslation(x,y0+i*fh+fh*.55,-D/2-.06));}}
    im.count=k;bg.add(im);}
  }else if(L){const pts=[];  // 線画モード：窓ラインのみ
   for(let i=1;i<=nF;i++){const y=y0+i*fh;
    pts.push(-W/2,y,D/2+.01,W/2,y,D/2+.01,-W/2,y,-D/2-.01,W/2,y,-D/2-.01);
    pts.push(W/2+.01,y,-D/2,W/2+.01,y,D/2,-W/2-.01,y,-D/2,-W/2-.01,y,D/2);}
   const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.BufferAttribute(new Float32Array(pts),3));
   bg.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x5a6a85})));}
  if(U.tw.scaffold&&U.tw.mode==="build"&&!L){
   const sg2=new THREE.BoxGeometry(W+1.8,bh+1.5,D+1.8);
   const sm2=new THREE.Mesh(sg2,new THREE.MeshLambertMaterial({color:0xf4f6f8,transparent:true,opacity:.3,depthWrite:false}));
   sm2.position.set(0,y0+(bh+1.5)/2+.1,0);bg.add(sm2);
   const ee=new THREE.LineSegments(new THREE.EdgesGeometry(sg2),new THREE.LineBasicMaterial({color:0xaab2bf}));ee.position.copy(sm2.position);bg.add(ee);}
  bg.position.set(dx,0,dz); bg.rotation.y=ry; g.add(bg); dragMap["blk:"+bi]=bg;
 });
 // 既存解体フェーズ：解体予定の既存建物（ダミー）
 if(U.tw.mode==="demo"){
  const dw=posv(U.demo.w,22), dd=posv(U.demo.d,14), dh=posv(U.demo.h,9);
  const dg=new THREE.Group(); dg.userData.dragKey="demo";
  const dm=L?new THREE.MeshBasicMaterial({color:0xffffff}):new THREE.MeshLambertMaterial({color:0xb9a89a});
  const mm=new THREE.Mesh(new THREE.BoxGeometry(dw,dh,dd),dm); mm.position.y=gl+dh/2+0.12; mm.castShadow=!L; mm.receiveShadow=!L; dg.add(mm);
  const ee=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(dw,dh,dd)),new THREE.LineBasicMaterial({color:0x7a5c4a})); ee.position.y=gl+dh/2+0.12; dg.add(ee);
  // 「解体予定」を示す×印（屋根）
  if(!L){const xm=new THREE.LineBasicMaterial({color:0xB0433A});
   const xp=[-dw/2,gl+dh+0.2,-dd/2, dw/2,gl+dh+0.2,dd/2, dw/2,gl+dh+0.2,-dd/2, -dw/2,gl+dh+0.2,dd/2];
   const xg=new THREE.BufferGeometry();xg.setAttribute("position",new THREE.BufferAttribute(new Float32Array(xp),3));dg.add(new THREE.LineSegments(xg,xm));}
  dg.position.set(sdx+numv(U.demo.dx,0),0,sdz+numv(U.demo.dz,0)); dg.rotation.y=numv(U.demo.ry,0)*Math.PI/180; g.add(dg); dragMap.demo=dg;
  frontMax=Math.max(frontMax,sdz+numv(U.demo.dz,0)+dd/2);
 }
 U._stats={floorArea:sumFloorArea, maxFloors};
 // 斜線制限ガイド（道路斜線・隣地斜線の簡易可視化）
 if(U.guide.show&&!L){
  const slope=(grad,fromZ,sign)=>{ // 境界線(z=fromZ)から勾配gradで立ち上がる半透明斜面
   const len=120, hgt=len*grad;
   const geo=new THREE.PlaneGeometry(sw+40,Math.sqrt(len*len+hgt*hgt));
   const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xF2A33C,transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));
   const ang=Math.atan2(hgt,len);
   m.rotation.x=-Math.PI/2 + sign*ang;
   m.position.set(sdx,(hgt/2),fromZ+sign*len/2*Math.cos(ang));
   g.add(m);
   const lpts=[-( sw+40)/2,0,fromZ, (sw+40)/2,0,fromZ];
   const lg=new THREE.BufferGeometry();lg.setAttribute("position",new THREE.BufferAttribute(new Float32Array([sdx-(sw+40)/2,0.05,fromZ,sdx+(sw+40)/2,0.05,fromZ]),3));
   g.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0xF2A33C})));
  };
  // 道路斜線：前面道路の反対側境界から（簡易に敷地前面+道路幅で代用）
  const rw2=Math.min(20,Math.max(4,numv(U.road.w,8)));
  slope(numv(U.guide.road,1.25), sdz+sd/2+1.6+rw2, +1);   // 前面（道路側）
  // 隣地斜線：背面・側面の隣地境界から（立ち上がり20m+勾配）
  slope(numv(U.guide.nbor,1.25), sdz-sd/2, -1);           // 背面（隣地側）
 }

 const builtH=gl+built*fh;

 // 仮囲い（ゲート開口・高さ可変・全モード対応・ドラッグ移動/回転可）
 if(U.tw.fence && (U.tw.mode==="build" || U.tw.fenceAll)){
  const fG=new THREE.Group(); fG.userData.dragKey="fence";
  const fh=Math.max(2,Math.min(8,numv(U.tw.fenceH,3)));        // パネル高さ
  const gate=U.tw.fenceGate||"front";                           // ゲート位置
  // 寸法：fenceW/D が指定されていれば使用、0なら敷地寸法（＋余白）
  const fw=numv(U.tw.fenceW,0)>0 ? numv(U.tw.fenceW,0) : sw;
  const fd=numv(U.tw.fenceD,0)>0 ? numv(U.tw.fenceD,0) : sd;
  const gw=Math.min(8,Math.max(4,fw*0.3));                      // ゲート開口幅
  // 各パネルをその位置の地盤高に合わせる（傾斜地でも接地させる）
  const fOx=sdx+numv(U.tw.fenceDx,0), fOz=sdz+numv(U.tw.fenceDz,0);
  const panelY=(x,z)=>groundY(fOx+x,fOz+z);   // グループ内座標→ワールド→地盤高
  const panel=(w,x,z,ry)=>{const gy=panelY(x,z);
   const m=new THREE.Mesh(new THREE.BoxGeometry(w,fh,.1),mat(0xeef0f3));m.position.set(x,gy+fh/2+.06,z);m.rotation.y=ry||0;m.castShadow=!L;fG.add(m);
   if(!L){const cap=new THREE.Mesh(new THREE.BoxGeometry(w,.12,.16),mat(0xF2A33C));cap.position.set(x,gy+fh+.1,z);cap.rotation.y=ry||0;fG.add(cap);}}; // 上端にアンバーの笠木
  const half=fw/2;
  const edge=(side)=>{
   if(side==="front"){
    if(gate==="front"){const seg=(fw-gw)/2; panel(seg,-half+seg/2,fd/2,0); panel(seg,half-seg/2,fd/2,0);
     if(!L){[-gw/2,gw/2].forEach(gx=>{const gy2=panelY(gx,fd/2);const p=new THREE.Mesh(new THREE.BoxGeometry(.18,fh+.4,.18),mat(0x9aa1ab));p.position.set(gx,gy2+(fh+.4)/2,fd/2);fG.add(p);});}
    } else panel(fw,0,fd/2,0);
   }
   if(side==="back") panel(fw,0,-fd/2,0);
   if(side==="left"){ if(gate==="left"){const seg=(fd-gw)/2;panel(seg,-half,-fd/2+seg/2,Math.PI/2);panel(seg,-half,fd/2-seg/2,Math.PI/2);} else panel(fd,-half,0,Math.PI/2);}
   if(side==="right"){ if(gate==="right"){const seg=(fd-gw)/2;panel(seg,half,-fd/2+seg/2,Math.PI/2);panel(seg,half,fd/2-seg/2,Math.PI/2);} else panel(fd,half,0,Math.PI/2);}
  };
  edge("front");edge("back");edge("left");edge("right");
  fG.position.set(sdx+numv(U.tw.fenceDx,0),0,sdz+numv(U.tw.fenceDz,0));
  fG.rotation.y=numv(U.tw.fenceRy,0)*Math.PI/180;
  g.add(fG); dragMap.fence=fG;}

 // タワークレーン（ドラッグ可・カタログ仕様連動）
 if(U.tw.crane&&U.tw.mode==="build"){
  const spec=craneSpec(U.tw.craneModel);
  const mh=builtH+16, jib=spec.jib, work=spec.work;
  const cg=new THREE.Group();cg.userData.dragKey="crane";
  const cm=mat(0xe8731a);
  const a=(geo,x,y,z)=>{const m=new THREE.Mesh(geo,cm);m.position.set(x,y,z);m.castShadow=!L;cg.add(m);if(L){const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial({color:0x16243d}));e.position.set(x,y,z);cg.add(e);}};
  a(new THREE.BoxGeometry(4.5,.9,4.5),0,.45,0);a(new THREE.BoxGeometry(1.5,mh,1.5),0,mh/2,0);
  a(new THREE.BoxGeometry(2.1,2,2.1),0,mh+1,0);a(new THREE.BoxGeometry(jib,.8,1),jib/2-1.2,mh+2.2,0);
  a(new THREE.BoxGeometry(7,.7,1),-4.2,mh+2.2,0);a(new THREE.BoxGeometry(1.4,2,2.2),-7,mh+1.4,0);
  a(new THREE.BoxGeometry(.5,4.5,.5),0,mh+4.4,0);
  const drop=Math.max(4,mh-builtH-4);
  a(new THREE.BoxGeometry(.07,drop,.07),jib*.72,mh+2-drop/2,0);a(new THREE.BoxGeometry(.9,.9,.9),jib*.72,mh+2-drop,0);
  // 作業半径ガイド（カタログ作業半径・選択時/設定時のみ・画像出力時は非表示）
  if(U.tw.radius&&!L&&!U._exporting){
   const ring=new THREE.Mesh(new THREE.RingGeometry(work-0.5,work,72),new THREE.MeshBasicMaterial({color:0xe8731a,transparent:true,opacity:.30,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.1;cg.add(ring);
   // 尾部旋回半径
   const tring=new THREE.Mesh(new THREE.RingGeometry(spec.tail-0.25,spec.tail,48),new THREE.MeshBasicMaterial({color:0xD64545,transparent:true,opacity:.5,side:THREE.DoubleSide}));tring.rotation.x=-Math.PI/2;tring.position.y=.12;cg.add(tring);
  }
  const _krx=numv(U.tw.craneX,16), _krz=numv(U.tw.craneZ,0);
  cg.position.set(_krx,groundY(_krx,_krz)+.1,_krz);
  cg.rotation.y=numv(U.tw.craneRot,0)*Math.PI/180;
  g.add(cg);dragMap.crane=cg;}

 // ロングスパンEV（ドラッグ可）
 if(U.tw.ev&&U.tw.mode==="build"){
  const eg=new THREE.Group();eg.userData.dragKey="ev";
  const eh=builtH-gl+3;
  box(eg,.5,eh,.5,0xd0d3d8,-1.7,eh/2,0);box(eg,.5,eh,.5,0xd0d3d8,1.7,eh/2,0);
  box(eg,3.8,.4,1.9,0xd0d3d8,0,eh+.2,.1);box(eg,3.4,2.4,1.6,0xeef0f3,0,Math.max(2,(builtH-gl)*.45),.1);
  eg.position.set(numv(U.tw.evX,-6),gl,U.tw.evZ==null?frontMax+1.1:numv(U.tw.evZ,frontMax+1.1));eg.rotation.y=numv(U.tw.evRy,0)*Math.PI/180;
  g.add(eg);dragMap.ev=eg;}

 // 電柱・架線
 if(U.tw.poles&&!L&&numv(U.poles.n,3)>0){
  const pg=new THREE.Group();pg.userData.dragKey="poles";
  const pz=(U.poles.far? sd/2+1.6+rw+0.8 : sd/2+0.8);
  const n=Math.min(8,Math.max(1,Math.round(numv(U.poles.n,3)))), pitch=Math.max(6,numv(U.poles.pitch,18));
  const tops=[];
  for(let i=0;i<n;i++){const x=(i-(n-1)/2)*pitch;
   cylm(pg,.17,.22,11,0x8a8378,x,5.5,pz);
   box(pg,2,.15,.15,0x8a8378,x,10.2,pz);
   tops.push([x,10.4,pz]);}
  if(n>1){const pts=[];for(let i=0;i<tops.length-1;i++)pts.push(...tops[i],...tops[i+1]);
   const lg=new THREE.BufferGeometry();lg.setAttribute("position",new THREE.BufferAttribute(new Float32Array(pts),3));
   pg.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0x4a4f57})));}
  pg.position.set(sdx+numv(U.poles.dx,0),0,sdz+numv(U.poles.dz,0));
  g.add(pg);dragMap.poles=pg;}

 // 生コン車（ドラッグ可）
 if(U.tw.mixer&&U.tw.mode==="build"&&!L){
  const mg=new THREE.Group();mg.userData.dragKey="mixer";
  box(mg,2.4,1,7,0xe9ebee,0,1.3,0);box(mg,2.2,1.7,2.2,0x5a7fae,0,1.9,-3.1);
  cylm(mg,1.25,.8,4.4,0xf2f4f6,0,2.6,.8,{rx:Math.PI/2-.2,seg:14});
  [-2.3,0,2.3].forEach(o=>{cylm(mg,.55,.55,.4,0x2c2f33,-1.05,.55,o,{rz:Math.PI/2});cylm(mg,.55,.55,.4,0x2c2f33,1.05,.55,o,{rz:Math.PI/2});});
  mg.position.set(numv(U.tw.mixX,-12),0,U.tw.mixZ==null?roadZ:numv(U.tw.mixZ,0));mg.rotation.y=numv(U.tw.mixRy,0)*Math.PI/180;
  g.add(mg);dragMap.mixer=mg;}

 // ラフタークレーン（ドラッグ可）
 if(U.tw.rough&&U.tw.mode==="build"&&!L){
  const rg=new THREE.Group();rg.userData.dragKey="rough";
  box(rg,2.7,1.3,9,0xe8b820,0,1.1,0);box(rg,2.4,1.8,2.4,0xe8b820,0,2.4,2.8);
  [[1.9,3.6],[1.9,-3.6],[-1.9,3.6],[-1.9,-3.6]].forEach(([ox,oz])=>box(rg,.4,1,.4,0x7d7f84,ox,.5,oz));
  const bl=builtH+12;const boom=new THREE.Mesh(new THREE.BoxGeometry(.8,bl,.8),mat(0xe8b820));
  boom.geometry.translate(0,bl/2,0);boom.position.set(0,2.2,-1);boom.rotation.x=.55;boom.castShadow=!L;rg.add(boom);
  rg.position.set(numv(U.tw.rufX,14),0,numv(U.tw.rufZ,-2));rg.rotation.y=numv(U.tw.rufRy,0)*Math.PI/180;g.add(rg);dragMap.rough=rg;}

 // 添景（スケール感のための人物のみ・植栽は配置しない）
 if(!L&&U.tw.mode==="plan"){
  const hum=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,1.7,8),new THREE.MeshLambertMaterial({color:0x35435e}));
  hum.position.set(sdx+6,.85,sdz+sd/2+5.5);hum.castShadow=true;g.add(hum);}

 // ───── 施工オブジェクト（constructionObjects）─────
 function aabb(cx,cz,w,d,ry){ // 回転考慮の概算外接（軸並行近似）
  const a=Math.abs(Math.cos(ry)), b=Math.abs(Math.sin(ry));
  const ew=(w*a+d*b)/2, ed=(w*b+d*a)/2;
  return {x0:cx-ew,x1:cx+ew,z0:cz-ed,z1:cz+ed};
 }
 function overlap(A,B){return A.x0<B.x1&&A.x1>B.x0&&A.z0<B.z1&&A.z1>B.z0;}
 U.cobj.forEach((c,i)=>{
  const t=COBJ_TYPES[c.type]||COBJ_TYPES.truck;
  const sz=cobjSize(c.type,c.size)||t.sizes[0];
  const w=posv(c.w,sz.w), d=posv(c.d,sz.d), hgt=posv(c.h,sz.h);
  const ry=numv(c.ry,0)*Math.PI/180;
  // 歩行帯との干渉判定 → 警告色
  let warn=false;
  if(walkZone){const cb=aabb(numv(c.x,0),numv(c.z,0),w,d,ry);
   const wb={x0:walkZone.x-walkZone.w/2,x1:walkZone.x+walkZone.w/2,z0:walkZone.z-walkZone.d/2,z1:walkZone.z+walkZone.d/2};
   if(c.type!=="walkzone"&&overlap(cb,wb))warn=true;}
  c._warn=warn;
  const cg=new THREE.Group(); cg.userData.dragKey="co:"+i;
  const seld=(U.sel==="co:"+i);
  const col=warn?0xD64545:(seld?0xF2A33C:t.color);
  const baseMat=L?new THREE.MeshBasicMaterial({color:0xffffff}):new THREE.MeshLambertMaterial({color:col});
  if(c.type==="guard"){
   const body=new THREE.Mesh(new THREE.CylinderGeometry(.22,.26,1.5,8),baseMat);body.position.y=.75;body.castShadow=!L;cg.add(body);
   const head=new THREE.Mesh(new THREE.SphereGeometry(.22,8,8),baseMat);head.position.y=1.6;cg.add(head);
   const vest=new THREE.Mesh(new THREE.CylinderGeometry(.27,.27,.5,8),new THREE.MeshLambertMaterial({color:warn?0xD64545:0xF2C14E}));vest.position.y=1.0;cg.add(vest);
  }else if(c.type==="walkzone"||(c.type==="temp"&&c.size==="plate")){ // 帯・敷鉄板：薄板
   const cc=c.type==="walkzone"?(warn?0xD64545:0x6EA46E):0x7a808a;
   const z=new THREE.Mesh(new THREE.BoxGeometry(w,Math.max(0.05,hgt),d),new THREE.MeshLambertMaterial({color:cc,transparent:c.type==="walkzone",opacity:c.type==="walkzone"?.6:1}));z.position.y=Math.max(0.05,hgt)/2+.02;z.castShadow=!L&&c.type!=="walkzone";cg.add(z);
   const ee=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w,Math.max(0.05,hgt),d)),new THREE.LineBasicMaterial({color:c.type==="walkzone"?0x3f7a3f:0x4a4f57}));ee.position.y=z.position.y;cg.add(ee);
  }else if(c.type==="found"){ // 基礎機械：本体＋鉛直マスト
   const base=new THREE.Mesh(new THREE.BoxGeometry(w,1.6,d),baseMat);base.position.y=.8;base.castShadow=!L;cg.add(base);
   const mast=new THREE.Mesh(new THREE.BoxGeometry(.6,hgt,.6),baseMat);mast.position.set(0,hgt/2,d*0.25);mast.castShadow=!L;cg.add(mast);
   if(L){const ee=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(.6,hgt,.6)),new THREE.LineBasicMaterial({color:0x16243d}));ee.position.copy(mast.position);cg.add(ee);}
  }else if(c.type==="pump"){
   const body=new THREE.Mesh(new THREE.BoxGeometry(w,2.2,d),baseMat);body.position.y=1.4;body.castShadow=!L;cg.add(body);
   const boom=new THREE.Mesh(new THREE.BoxGeometry(.4,.4,d*1.4),new THREE.MeshLambertMaterial({color:warn?0xD64545:0x33425a}));boom.position.set(0,3.2,d*.2);boom.rotation.x=-.5;cg.add(boom);
  }else if(c.type==="rough"){ // ラフター：車体＋ブーム
   const body=new THREE.Mesh(new THREE.BoxGeometry(w,hgt*0.55,d),baseMat);body.position.y=hgt*0.3;body.castShadow=!L;cg.add(body);
   const cab=new THREE.Mesh(new THREE.BoxGeometry(w*0.9,1.6,d*0.22),baseMat);cab.position.set(0,hgt*0.55+0.8,d*0.3);cg.add(cab);
   const boomL=Math.max(8,(sz.work||16)*0.7);
   const boom=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,boomL),new THREE.MeshLambertMaterial({color:warn?0xD64545:0xC99A1A}));
   boom.position.set(0,hgt*0.55+0.6+boomL*0.18,-d*0.1);boom.rotation.x=-0.7;boom.geometry.translate(0,0,boomL/2);cg.add(boom);
  }else if(c.type==="backhoe"){ // バックホウ：履帯＋旋回体＋アーム
   const track=new THREE.Mesh(new THREE.BoxGeometry(w,0.8,d),baseMat);track.position.y=.4;track.castShadow=!L;cg.add(track);
   const turret=new THREE.Mesh(new THREE.BoxGeometry(w*0.8,1.3,d*0.6),baseMat);turret.position.set(0,1.4,-d*0.1);cg.add(turret);
   const arm=new THREE.Mesh(new THREE.BoxGeometry(.35,.35,d*0.7),new THREE.MeshLambertMaterial({color:warn?0xD64545:0xC2611F}));arm.position.set(0,2.0,d*0.35);arm.rotation.x=-0.9;cg.add(arm);
  }else if(c.type==="obstacle"){ // 地上の支障物（種類で見た目を変える）
   const oc=warn?0xD64545:t.color;
   const omat=L?baseMat:new THREE.MeshLambertMaterial({color:oc});
   if(c.size==="padmount"){ // パットマウント：緑灰の箱＋警告ラベル面
    const b=new THREE.Mesh(new THREE.BoxGeometry(w,hgt,d),L?baseMat:new THREE.MeshLambertMaterial({color:0x5E7A5E}));b.position.y=hgt/2;b.castShadow=!L;cg.add(b);
    const ee=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w,hgt,d)),new THREE.LineBasicMaterial({color:0x2c3a2c}));ee.position.y=hgt/2;cg.add(ee);
   }else if(c.size==="hydrant"){ // 消火栓：赤い短柱
    const b=new THREE.Mesh(new THREE.CylinderGeometry(w*0.4,w*0.45,hgt,8),L?baseMat:new THREE.MeshLambertMaterial({color:0xC0392B}));b.position.y=hgt/2;b.castShadow=!L;cg.add(b);
   }else if(c.size==="manhole"){ // マンホール：地面の円盤
    const b=new THREE.Mesh(new THREE.CylinderGeometry(w*0.5,w*0.5,0.06,16),L?baseMat:new THREE.MeshLambertMaterial({color:0x6b7079}));b.position.y=0.05;cg.add(b);
    const ring=new THREE.Mesh(new THREE.RingGeometry(w*0.4,w*0.5,16),new THREE.MeshBasicMaterial({color:0x3a3f47,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=0.09;cg.add(ring);
   }else if(c.size==="signal"||c.size==="mirror"){ // 信号・標識・ミラー：細柱＋頭
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.1,hgt,8),L?baseMat:new THREE.MeshLambertMaterial({color:0x888f99}));pole.position.y=hgt/2;pole.castShadow=!L;cg.add(pole);
    const head=c.size==="mirror"
      ? new THREE.Mesh(new THREE.CircleGeometry(0.5,16),new THREE.MeshLambertMaterial({color:0xE8A23C,side:THREE.DoubleSide}))
      : new THREE.Mesh(new THREE.BoxGeometry(1.0,0.35,0.15),new THREE.MeshLambertMaterial({color:0x2c3a2c}));
    head.position.y=hgt; if(c.size==="mirror")head.position.z=0.2; cg.add(head);
   }else if(c.size==="tree"){ // 街路樹：幹＋玉
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.25,hgt*0.45,8),new THREE.MeshLambertMaterial({color:0x6B5B45}));trunk.position.y=hgt*0.22;cg.add(trunk);
    const crown=new THREE.Mesh(new THREE.SphereGeometry(Math.max(w,d)*0.5,10,10),new THREE.MeshLambertMaterial({color:warn?0xD64545:0x5A8F5A}));crown.position.y=hgt*0.65;crown.castShadow=!L;cg.add(crown);
   }else if(c.size==="busstop"){ // バス停：標柱＋上屋
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,hgt,8),new THREE.MeshLambertMaterial({color:0x888f99}));pole.position.set(-w*0.3,hgt/2,0);cg.add(pole);
    const roof=new THREE.Mesh(new THREE.BoxGeometry(w,0.12,d),omat);roof.position.y=hgt;roof.castShadow=!L;cg.add(roof);
   }else if(c.size==="powerline"){ // 架線・高圧線：2本柱＋水平線（揚重支障）
    [-d/2,d/2].forEach(z=>{const p=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.12,hgt,8),new THREE.MeshLambertMaterial({color:0x888f99}));p.position.set(0,hgt/2,z);cg.add(p);});
    [-0.4,0,0.4].forEach((xo,k)=>{const ln=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,d,6),new THREE.MeshLambertMaterial({color:warn?0xD64545:0x33425a}));ln.position.set(xo,hgt-0.2-k*0.3,0);ln.rotation.x=Math.PI/2;cg.add(ln);});
    // 揚重支障の警告帯（地面）
    const warnZone=new THREE.Mesh(new THREE.PlaneGeometry(2,d),new THREE.MeshBasicMaterial({color:0xE8442B,transparent:true,opacity:0.18,side:THREE.DoubleSide}));warnZone.rotation.x=-Math.PI/2;warnZone.position.y=0.05;cg.add(warnZone);
   }else{ const b=new THREE.Mesh(new THREE.BoxGeometry(w,hgt,d),omat);b.position.y=hgt/2;b.castShadow=!L;cg.add(b); }
  }else if(c.type==="temp"){ // 仮設材
   if(c.size==="gate"){ // ゲート：2本柱＋上枠
    [-w/2+0.2,w/2-0.2].forEach(x=>{const p=new THREE.Mesh(new THREE.BoxGeometry(0.3,hgt,0.3),baseMat);p.position.set(x,hgt/2,0);cg.add(p);});
    const top=new THREE.Mesh(new THREE.BoxGeometry(w,0.4,0.3),baseMat);top.position.y=hgt;cg.add(top);
   }else if(c.size==="asagao"){ // 朝顔：設置高さ可変の傾いた庇＋ブラケット
    const mh=numv(c.mountH,4);  // 設置高さ（地上からの高さ m）
    const b=new THREE.Mesh(new THREE.BoxGeometry(w,0.12,d),new THREE.MeshLambertMaterial({color:warn?0xD64545:0xC9A14A}));
    b.position.set(0,mh,d*0.2);b.rotation.x=-0.35;b.castShadow=!L;cg.add(b);
    // 受けブラケット（斜材）2本
    if(!L){[-w*0.35,w*0.35].forEach(bx=>{const br=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,d*1.1),new THREE.MeshLambertMaterial({color:0x9aa1ab}));br.position.set(bx,mh-d*0.18,d*0.05);br.rotation.x=-0.6;cg.add(br);});}
    // 設置高さの目安ポール（地面〜朝顔）
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,mh,6),new THREE.MeshBasicMaterial({color:warn?0xD64545:0xC9A14A,transparent:true,opacity:0.5}));pole.position.set(-w/2+0.2,mh/2,0);cg.add(pole);
   }else{ // 詰所など箱
    const body=new THREE.Mesh(new THREE.BoxGeometry(w,hgt,d),baseMat);body.position.y=hgt/2;body.castShadow=!L;cg.add(body);
    const ee=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w,hgt,d)),new THREE.LineBasicMaterial({color:0x8a7f5f}));ee.position.y=hgt/2;cg.add(ee);
   }
  }else{ // ミキサー・トラック：車体＋運転台（＋ドラム）
   const body=new THREE.Mesh(new THREE.BoxGeometry(w,hgt*0.7,d),baseMat);body.position.y=hgt*0.45;body.castShadow=!L;cg.add(body);
   const cab=new THREE.Mesh(new THREE.BoxGeometry(w,hgt*0.6,d*0.22),baseMat);cab.position.set(0,hgt*0.5,-d*0.36);cg.add(cab);
   if(c.type==="mixer"){const drum=new THREE.Mesh(new THREE.CylinderGeometry(w*0.45,w*0.32,d*0.5,12),new THREE.MeshLambertMaterial({color:warn?0xD64545:0xC8CCD2}));drum.position.set(0,hgt*0.7,d*0.08);drum.rotation.x=Math.PI/2-0.25;drum.castShadow=!L;cg.add(drum);}
  }
  // ───── 干渉チェックガイド（重機選択時・画像出力時は非表示）─────
  if(seld&&!L&&!U._exporting){
   const ringMat=(cc,op)=>new THREE.MeshBasicMaterial({color:cc,transparent:true,opacity:op,side:THREE.DoubleSide});
   // A. アウトリガー最大張出（矩形ガイド）
   if(sz.out){const ow=sz.out, od=Math.max(sz.out,d*0.8);
    const g4=new THREE.Mesh(new THREE.PlaneGeometry(ow*2,od*2),ringMat(0xF2A33C,0.10));g4.rotation.x=-Math.PI/2;g4.position.y=0.05;cg.add(g4);
    const eg=new THREE.EdgesGeometry(new THREE.PlaneGeometry(ow*2,od*2));const el2=new THREE.LineSegments(eg,new THREE.LineBasicMaterial({color:0xE8731A}));el2.rotation.x=-Math.PI/2;el2.position.y=0.06;cg.add(el2);
   }
   // B. テールスイング（後端旋回半径）の円
   if(sz.tail){const ring=new THREE.Mesh(new THREE.RingGeometry(sz.tail-0.25,sz.tail,48),ringMat(0xD64545,0.5));ring.rotation.x=-Math.PI/2;ring.position.set(0,0.08,-d*0.2);cg.add(ring);}
   // C. 作業半径の目安円
   if(sz.work){const ring=new THREE.Mesh(new THREE.RingGeometry(sz.work-0.4,sz.work,64),ringMat(0x3B82C4,0.35));ring.rotation.x=-Math.PI/2;ring.position.y=0.04;cg.add(ring);}
  }
  const _cx=numv(c.x,0), _cz=numv(c.z,0);
  cg.position.set(_cx,groundY(_cx,_cz),_cz); cg.rotation.y=ry; g.add(cg); dragMap["co:"+i]=cg;
 });

 // ───── 地下の支障物（範囲マーカー：地面の色帯）─────
 if(!U._exporting){(U.subsurface||[]).forEach((s,i)=>{
  const st=SUBSURFACE_TYPES[s.kind]||SUBSURFACE_TYPES.elec;
  const w=posv(s.w,3), d=posv(s.d,14), ry=numv(s.ry,0)*Math.PI/180;
  const seld=(U.sel==="sub:"+i);
  const sg=new THREE.Group(); sg.userData.dragKey="sub:"+i;
  // 半透明の色帯（道路メッシュより上に出して隠れないように）
  const band=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({color:st.color,transparent:true,opacity:seld?0.5:0.32,side:THREE.DoubleSide,depthWrite:false}));
  band.rotation.x=-Math.PI/2; band.position.y=0.16; sg.add(band);
  // 点線風の枠（実線エッジで代用）＋中心線
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w,d)),new THREE.LineBasicMaterial({color:st.color}));
  edge.rotation.x=-Math.PI/2; edge.position.y=0.17; sg.add(edge);
  const cl=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(0.3,w*0.15),d),new THREE.MeshBasicMaterial({color:st.color,transparent:true,opacity:0.7,side:THREE.DoubleSide,depthWrite:false}));
  cl.rotation.x=-Math.PI/2; cl.position.y=0.18; sg.add(cl);
  const _sx=numv(s.x,0), _sz=numv(s.z,0);
  sg.position.set(_sx,groundY(_sx,_sz),_sz); sg.rotation.y=ry; g.add(sg); dragMap["sub:"+i]=sg;
 });}

 // ───── 注記（地面貼り付け：範囲マーカー・文字）※PNG出力にも含める ─────
 (U.annot||[]).forEach((a,i)=>{
  const col=annotColor(a.color);
  const seld=(U.sel==="an:"+i);
  const ag=new THREE.Group(); ag.userData.dragKey="an:"+i;
  if(a.type==="zone"){
   const w=posv(a.w,6), d=posv(a.d,6);
   // 塗り（ごく薄く）＋しっかりした枠線で「マーカーで囲った」感じに
   const fill=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:seld?0.34:0.2,side:THREE.DoubleSide,depthWrite:false}));
   fill.rotation.x=-Math.PI/2; fill.position.y=0.2; ag.add(fill);
   // 枠線を太く見せる（外周に細い帯4本）
   const bw=Math.min(0.3,Math.max(0.12,Math.min(w,d)*0.03));
   const mkEdge=(ew,ed,ex,ez)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(ew,ed),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.9,side:THREE.DoubleSide,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(ex,0.21,ez);ag.add(m);};
   mkEdge(w,bw,0,-d/2+bw/2); mkEdge(w,bw,0,d/2-bw/2); mkEdge(bw,d,-w/2+bw/2,0); mkEdge(bw,d,w/2-bw/2,0);
  }else{ // text
   const txt=(a.text||"注記").slice(0,40);
   const fs=Math.max(0.8,Math.min(10,posv(a.fsize,2)));  // 文字高さ(m)
   const cv=document.createElement("canvas"); const cx=cv.getContext("2d");
   const px=96; cx.font=`bold ${px}px 'Yu Gothic UI','Hiragino Sans',sans-serif`;
   const tw=Math.ceil(cx.measureText(txt).width);
   cv.width=tw+px*0.8; cv.height=px*1.6;
   const c2=cv.getContext("2d");
   c2.font=`bold ${px}px 'Yu Gothic UI','Hiragino Sans',sans-serif`;
   c2.textBaseline="middle";
   // 白の座布団（角丸・わずかに透過）→ 文字が地面色に埋もれない
   const r=px*0.3, W=cv.width, H=cv.height;
   c2.fillStyle="rgba(255,255,255,0.88)";
   c2.beginPath();c2.moveTo(r,0);c2.lineTo(W-r,0);c2.quadraticCurveTo(W,0,W,r);c2.lineTo(W,H-r);c2.quadraticCurveTo(W,H,W-r,H);c2.lineTo(r,H);c2.quadraticCurveTo(0,H,0,H-r);c2.lineTo(0,r);c2.quadraticCurveTo(0,0,r,0);c2.closePath();c2.fill();
   c2.strokeStyle="#"+col.toString(16).padStart(6,"0"); c2.lineWidth=6; c2.stroke();
   c2.fillStyle="#"+col.toString(16).padStart(6,"0");
   c2.fillText(txt, px*0.4, H/2);
   const tex=new THREE.CanvasTexture(cv); tex.anisotropy=4;
   const pw=fs*(W/H);
   const tp=new THREE.Mesh(new THREE.PlaneGeometry(pw,fs),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));
   tp.rotation.x=-Math.PI/2; tp.rotation.z=0; tp.position.y=0.22; ag.add(tp);
   if(seld){ // 選択中は薄い下線ガイド
    const ul=new THREE.Mesh(new THREE.PlaneGeometry(pw,0.15),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.5,side:THREE.DoubleSide,depthWrite:false}));
    ul.rotation.x=-Math.PI/2; ul.position.set(0,0.21,fs*0.62); ag.add(ul);
   }
  }
  const _ax=numv(a.x,0), _az=numv(a.z,0);
  ag.position.set(_ax,groundY(_ax,_az),_az); ag.rotation.y=numv(a.ry,0)*Math.PI/180;
  g.add(ag); dragMap["an:"+i]=ag;
 });

 // ───── DXF オーバーレイ（1/1000等のスケールで配置）─────
 if(U.dxf.ents&&!L){
  const sc=numv(U.dxf.scale,0.001);
  const lg=new THREE.Group(); lg.position.set(sdx+numv(U.dxf.dx,0),0.2,sdz+numv(U.dxf.dz,0)); lg.userData.dragKey="dxf";
  const colFor=(lay)=>{const li=U.dxf.layers[lay]; return (li&&li.color!=null)?li.color:0x3a4a63;};
  (U.dxf.ents.entities||[]).forEach(ent=>{
   const lay=ent.layer||"0"; const li=U.dxf.layers[lay];
   if(li&&li.show===false)return;
   const m=new THREE.LineBasicMaterial({color:colFor(lay)});
   const toXZ=(p)=>[ (p.x||0)*sc, 0, -(p.y||0)*sc ];  // DXFのY→Three.jsの-Z
   if((ent.type==="LINE"||ent.type==="LWPOLYLINE"||ent.type==="POLYLINE")&&ent.vertices&&ent.vertices.length){
    const pts=[]; ent.vertices.forEach(v=>pts.push(...toXZ(v)));
    if(ent.shape&&ent.vertices.length>2)pts.push(...toXZ(ent.vertices[0]));
    const geo=new THREE.BufferGeometry(); geo.setAttribute("position",new THREE.BufferAttribute(new Float32Array(pts),3));
    lg.add(new THREE.Line(geo,m));
   }else if(ent.type==="CIRCLE"&&ent.center){
    const seg=40,pts=[]; for(let a=0;a<=seg;a++){const th=a/seg*Math.PI*2;pts.push((ent.center.x+Math.cos(th)*ent.radius)*sc,0,-(ent.center.y+Math.sin(th)*ent.radius)*sc);}
    const geo=new THREE.BufferGeometry(); geo.setAttribute("position",new THREE.BufferAttribute(new Float32Array(pts),3));
    lg.add(new THREE.Line(geo,m));
   }else if(ent.type==="ARC"&&ent.center){
    const seg=24,pts=[],a0=ent.startAngle||0,a1=ent.endAngle||Math.PI*2; for(let a=0;a<=seg;a++){const th=a0+(a1-a0)*a/seg;pts.push((ent.center.x+Math.cos(th)*ent.radius)*sc,0,-(ent.center.y+Math.sin(th)*ent.radius)*sc);}
    const geo=new THREE.BufferGeometry(); geo.setAttribute("position",new THREE.BufferAttribute(new Float32Array(pts),3));
    lg.add(new THREE.Line(geo,m));
   }
  });
  g.add(lg); dragMap.dxf=lg;
 }

 // ───── 多角形入力中のプレビュー ─────
 if(U.polyInput.on&&U.polyInput.pts.length&&!L){
  const pp=U.polyInput.pts;
  pp.forEach(p=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.5,10,10),new THREE.MeshBasicMaterial({color:0xF2A33C}));m.position.set(sdx+p.x,0.5,sdz+p.z);g.add(m);});
  if(pp.length>=2){const lp=[];pp.forEach(p=>lp.push(sdx+p.x,0.4,sdz+p.z));
   const lg=new THREE.BufferGeometry();lg.setAttribute("position",new THREE.BufferAttribute(new Float32Array(lp),3));
   g.add(new THREE.Line(lg,new THREE.LineBasicMaterial({color:0xF2A33C})));}
 }
 // ───── スケール補正の点 ─────
 if(U.calib.a&&!L){
   const dot=(p,idx)=>{
    // 小さな球（半径0.18m）＋見やすいリング
    const m=new THREE.Mesh(new THREE.SphereGeometry(0.18,12,12),new THREE.MeshBasicMaterial({color:0xE8442B}));
    m.position.set(p.x,0.25,p.z);g.add(m);
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.35,0.5,20),new THREE.MeshBasicMaterial({color:0xE8442B,side:THREE.DoubleSide,transparent:true,opacity:0.85}));
    ring.rotation.x=-Math.PI/2;ring.position.set(p.x,0.08,p.z);g.add(ring);
   };
   dot(U.calib.a,0);
   if(U.calib.b){dot(U.calib.b,1);
    // 2点間に補助線（測っている距離を可視化）
    const lg=new THREE.BufferGeometry();lg.setAttribute("position",new THREE.BufferAttribute(new Float32Array([U.calib.a.x,0.2,U.calib.a.z, U.calib.b.x,0.2,U.calib.b.z]),3));
    g.add(new THREE.Line(lg,new THREE.LineBasicMaterial({color:0xE8442B})));
   }
 }

 // ───── 寸法線ツール ─────
 if(U.dim.a&&!L){
  const A=U.dim.a, B=U.dim.b;
  const dot=(p,c)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.4,10,10),new THREE.MeshBasicMaterial({color:c}));m.position.set(p.x,0.4,p.z);g.add(m);};
  dot(A,0xF2A33C);
  if(B){dot(B,0xF2A33C);
   const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.BufferAttribute(new Float32Array([A.x,0.4,A.z,B.x,0.4,B.z]),3));
   g.add(new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xF2A33C})));
   const dist=Math.hypot(B.x-A.x,B.z-A.z);
   U._dimDist=dist;
  } else U._dimDist=null;
 } else U._dimDist=null;

 scene.add(g);model=g;
 ctrl.ty=Math.max(builtH,H*.6)*.45;
 renderTitle();
}

// ───── 案件データの保存・読込 (JSON / AES暗号化対応) ─────
function saveProjectJSON(){
 const saveState=JSON.parse(JSON.stringify(U,(k,v)=>(k==="tex"||k==="raw"||k==="ents"||k==="_warn"||k==="_stats"||k==="_dimDist"||k==="_exporting"||k==="_titleMin"||k==="_acc"||k==="_hudMin"||k==="sel"||k==="polyInput"||k==="calib"||k==="gsiStatus")?(k==="ents"?null:(k==="_warn"?undefined:null)):v));
 // 互換のためのメタ情報（将来バージョンで古いデータを安全に開くための目印）
 saveState._meta={app:"BimGen",appVer:APP_VER,schema:2,savedAt:new Date().toISOString()};
 const jsonStr=JSON.stringify(saveState,null,2);
 const dateStr=new Date().toISOString().slice(0,10).replace(/-/g,"");
 const baseName=`${U.p.name||"volume"}_${dateStr}`;
 // パスワード設定の確認
 const pw=(prompt("パスワードを設定しますか？\n設定する場合は入力してください。\n（空欄のままOKを押すと暗号化なしで保存します）")||"").trim();
 let outStr, ext;
 if(pw){
  if(typeof CryptoJS==="undefined"){toast("暗号化ライブラリ未読込のため、暗号化なしで保存します","err");outStr=jsonStr;ext=".json";}
  else{
   const encrypted=CryptoJS.AES.encrypt(jsonStr,pw).toString();
   outStr=JSON.stringify({encrypted:true,v:1,data:encrypted});
   ext=".bsjson";  // 暗号化済みファイルは拡張子で判別しやすくする
  }
 }else{outStr=jsonStr;ext=".json";}
 const blob=new Blob([outStr],{type:"application/json"});
 const a=document.createElement("a");
 a.href=URL.createObjectURL(blob);
 a.download=baseName+ext;
 a.click();
}
function loadProjectJSON(file){
 snapshot();
 if(!file)return;
 const reader=new FileReader();
 reader.onload=(e)=>{
  try{
   const raw=e.target.result;
   let parsed;
   // 暗号化ファイルの判定
   const wrapper=JSON.parse(raw);
   if(wrapper&&wrapper.encrypted===true&&wrapper.data){
    // 暗号化ファイル → パスワード入力
    if(typeof CryptoJS==="undefined"){toast("暗号化ライブラリ未読込のため、暗号化ファイルを開けません","err");return;}
    const pw=(prompt("このファイルはパスワードで保護されています。\nパスワードを入力してください：")||"").trim();
    if(!pw){toast("パスワード未入力のため読み込みを中断しました","err");return;}
    let decrypted;
    try{
     const bytes=CryptoJS.AES.decrypt(wrapper.data,pw);
     decrypted=bytes.toString(CryptoJS.enc.Utf8);
     if(!decrypted||decrypted.length<2)throw new Error("empty");
    }catch(_){toast("パスワードが違うか、ファイルが破損しています","err");return;}
    try{parsed=JSON.parse(decrypted);}
    catch(_){toast("パスワードが違うか、ファイルが破損しています","err");return;}
   }else{
    // 通常ファイル（暗号化なし）
    parsed=wrapper;
   }
   // ─── 以下は共通の展開処理 ───
   const _loadedMeta=parsed._meta||null;  // バージョン情報を退避
   const cuTex=U.under.tex,cuRaw=U.under.raw,cuPages=U.under.pages,cuPage=U.under.page,cpTex=U.photo.tex;
   Object.assign(U,parsed);
   delete U._meta;  // メタ情報はUに混ぜない
   U.under.tex=cuTex;U.under.raw=cuRaw;U.under.pages=cuPages;U.under.page=cuPage;U.photo.tex=cpTex;
   if(!U.road)U.road={w:8,side:"none"};
   if(U.road.dx==null)U.road.dx=0; if(U.road.dz==null)U.road.dz=0; if(U.road.ry==null)U.road.ry=0;
   if(U.road.walkDz==null)U.road.walkDz=0; if(U.road.walkW==null)U.road.walkW=1.6;
   if(!U.roadwork)U.roadwork={mixerSize:"8t",pumpSize:"m4t",mountUp:0,permitPolice:"",permitRoad:"",permitOffice:""};
   if(!Array.isArray(U.subsurface))U.subsurface=[];
   if(!Array.isArray(U.annot))U.annot=[];
   if(!U.ojt||typeof U.ojt!=="object")U.ojt={};
   if(U.road.sideDx==null)U.road.sideDx=0; if(U.road.sideDz==null)U.road.sideDz=0;
   if(!U.poles)U.poles={n:3,pitch:18,far:true,dx:0,dz:0,ry:0};
   if(!U.guide)U.guide={show:false,road:1.25,nbor:1.25};
   if(!U.sun)U.sun={az:135,alt:55};
   if(!U.grid)U.grid={show:false,size:1};
   if(!U.roadcond)U.roadcond={lane:6,walk:2.5,side:"front"};
   if(!U.cobj)U.cobj=[];
   if(!U.dim)U.dim={on:false,a:null,b:null};
   if(!U.polyInput)U.polyInput={on:false,pts:[],target:null};
   if(!U.calib)U.calib={on:false,a:null,b:null};
   if(U.tw&&!U.tw.craneModel)U.tw.craneModel="JCL022";
   if(U.tw){if(U.tw.fenceH==null)U.tw.fenceH=3; if(U.tw.fenceGate==null)U.tw.fenceGate="front"; if(U.tw.fenceAll==null)U.tw.fenceAll=false;
     if(U.tw.fenceDx==null)U.tw.fenceDx=0; if(U.tw.fenceDz==null)U.tw.fenceDz=0; if(U.tw.fenceRy==null)U.tw.fenceRy=0; if(U.tw.fenceW==null)U.tw.fenceW=0; if(U.tw.fenceD==null)U.tw.fenceD=0;}
   if(!U.dxf)U.dxf={ents:null,layers:{},scale:0.001,dx:0,dz:0,raw:null};
   if(U.cost)delete U.cost;  // 旧バージョンの概算単価データを破棄
   if(!U.geo)U.geo={elev:null,name:"",status:""};
   if(U.snap==null)U.snap=true;
   (U.cobj||[]).forEach(c=>{if(c.size==null){const t=COBJ_TYPES[c.type];if(t)c.size=t.sizes[0].key;}});
   if(U.p.addr==null)U.p.addr="";
   // 詳細諸元フィールドの後方互換
   ["siteArea","bldgArea","consArea","privArea","units","note"].forEach(k=>{if(U.p[k]==null)U.p[k]="";});
   if(U.p.aiIncludeAddr==null)U.p.aiIncludeAddr=false;
   if(!U.demo)U.demo={w:22,d:14,h:9,dx:0,dz:0,ry:0};
   (U.blocks||[]).forEach(b=>{if(b.w==null){const A=posv(b.area,200),r=posv(b.ratio,1.5);b.w=+Math.sqrt(A*r).toFixed(1);b.d=+Math.sqrt(A/r).toFixed(1);}if(b.ry==null)b.ry=0;});
   (U.nbs||[]).forEach(n=>{if(n.ry==null)n.ry=0;});
   rebuild();renderPanel();U.auto=false;renderBar();
   toast("案件データを読み込みました","ok");
  }catch(err){toast("読み込み失敗：ファイル形式を確認してください","err");}
 };
 reader.readAsText(file);
}
window.saveProjectJSON=saveProjectJSON;window.loadProjectJSON=loadProjectJSON;

// ───── DXF 読込（dxf-parser・ビルド工程なし）─────
function loadDXF(file){
 if(!file)return;
 if(typeof DxfParser==="undefined"){toast("DXF読込ライブラリが未読込です","err");return;}
 const rd=new FileReader();
 rd.onload=(e)=>{
  try{
   const parser=new DxfParser();
   const dxf=parser.parseSync(e.target.result);
   U.dxf.ents=dxf;
   // レイヤー一覧を抽出（テーブル優先、無ければエンティティから）
   const layers={};
   if(dxf.tables&&dxf.tables.layer&&dxf.tables.layer.layers){
    Object.keys(dxf.tables.layer.layers).forEach(k=>{const l=dxf.tables.layer.layers[k];layers[k]={show:true,color:(l.color!=null?l.color:0x3a4a63)};});
   }
   (dxf.entities||[]).forEach(en=>{const k=en.layer||"0";if(!layers[k])layers[k]={show:true,color:0x3a4a63};});
   U.dxf.layers=layers;
   rebuild();renderPanel();
   toast("DXFを読み込みました（"+Object.keys(layers).length+"レイヤー / "+(dxf.entities||[]).length+"要素）。スケールと位置は『下敷き』調整と同様に合わせてください。");
  }catch(err){toast("DXF解析に失敗："+err.message,"err");}
 };
 rd.readAsText(file);
}
window.loadDXF=loadDXF;
window.toggleDxfLayer=(k,v)=>{if(U.dxf.layers[k]){U.dxf.layers[k].show=v;rebuild();}};
window.clearDXF=()=>{U.dxf.ents=null;U.dxf.layers={};rebuild();renderPanel();};

// ───── 計画地住所 → 標高・地形・ハザードマップ検索 ─────
async function fetchGeo(){
 const addr=(U.p.addr||"").trim();
 if(!addr){toast("計画地住所を入力してください","err");return;}
 U.geo.status="検索中…"; renderPanel();
 try{
  // 1) 住所→緯度経度（国土地理院ジオコーディング・CORS可）
  const gres=await fetch("https://msearch.gsi.go.jp/address-search/AddressSearch?q="+encodeURIComponent(addr));
  const gjson=await gres.json();
  if(!gjson||!gjson.length){U.geo.status="住所が見つかりませんでした。市区町村名から入れ直してください。";renderPanel();return;}
  const [lon,lat]=gjson[0].geometry.coordinates;
  U.geo.name=gjson[0].properties&&gjson[0].properties.title?gjson[0].properties.title:addr;
  U.geo.lat=lat; U.geo.lon=lon;  // 地図タイル表示に使う
  // 2) 緯度経度→標高（国土地理院標高API）
  let elevTxt="取得できず";
  try{
   const eres=await fetch(`https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${lon}&lat=${lat}&outtype=JSON`);
   const ejson=await eres.json();
   if(ejson&&ejson.elevation!=null&&ejson.elevation!=="-----"){U.geo.elev=ejson.elevation;elevTxt=ejson.elevation+" m（"+(ejson.hsrc||"")+"）";}
  }catch(_){}
  // 地形分類のざっくり判定（標高ベースの目安）
  let landform="";
  if(U.geo.elev!=null){const e=+U.geo.elev;
   landform = e<5?"低地（沖積平野の可能性。軟弱地盤・液状化に注意）":e<20?"台地〜低地の境界（要地盤調査）":e<60?"台地・段丘（比較的良好なことが多い）":"丘陵・山地（切盛造成は個別確認）";}
  U.geo.status=`緯度経度: ${lat.toFixed(5)}, ${lon.toFixed(5)}\n標高: ${elevTxt}\n地形目安: ${landform||"標高取得後に判定"}`;
  renderPanel();
 }catch(err){
  U.geo.status="取得失敗（ネットワーク制限／CORSの可能性）。下のリンクから手動でご確認ください。";
  renderPanel();
 }
}
window.fetchGeo=fetchGeo;
// 市区町村名をざっくり抽出（ハザード検索リンク用）
function cityFromAddr(a){const m=(a||"").match(/(.+?[都道府県])?(.+?[市区町村])/);return m?((m[1]||"")+(m[2]||"")):a;}
window.fetchGeo=fetchGeo;window.cityFromAddr=cityFromAddr;
// ───── 国土地理院タイルを敷地周辺に自動表示（自動化）─────
// 緯度経度→タイル小数座標（Web Mercator XYZ）
function _lonlat2tile(lon,lat,z){
 const n=Math.pow(2,z);
 const x=(lon+180)/360*n;
 const latRad=lat*Math.PI/180;
 const y=(1-Math.log(Math.tan(latRad)+1/Math.cos(latRad))/Math.PI)/2*n;
 return {x,y};
}
// 地理院タイルの種類
const GSI_TILES={
 std:{label:"標準地図",url:"std",ext:"png"},
 pale:{label:"淡色地図",url:"pale",ext:"png"},
 photo:{label:"航空写真",url:"seamlessphoto",ext:"jpg"},
};
async function loadGsiMap(){
 if(U.geo.lat==null||U.geo.lon==null){
  toast("先に「敷地・地形」タブで住所を検索してください","err");
  return;
 }
 const kind=U.under.gsiKind||"std";
 const tile=GSI_TILES[kind]||GSI_TILES.std;
 const z=U.under.gsiZoom||17;
 const N=3; // 3x3タイル
 U.under.gsiStatus="地図を取得中…"; renderPanel();
 try{
  const c=_lonlat2tile(U.geo.lon,U.geo.lat,z);
  const cx=Math.floor(c.x), cy=Math.floor(c.y);
  const half=Math.floor(N/2);
  const TS=256;
  const cv=document.createElement("canvas");
  cv.width=N*TS; cv.height=N*TS;
  const ctx=cv.getContext("2d");
  // タイルを並べて読み込む
  const loads=[];
  for(let dy=0;dy<N;dy++)for(let dx=0;dx<N;dx++){
   const tx=cx-half+dx, ty=cy-half+dy;
   // crossOrigin時のキャッシュ汚染回避のためパラメータを付与（国土地理院の推奨）
   const url=`https://cyberjapandata.gsi.go.jp/xyz/${tile.url}/${z}/${tx}/${ty}.${tile.ext}?cors=1`;
   loads.push(new Promise((res)=>{
    const img=new Image(); img.crossOrigin="anonymous";
    img.onload=()=>{ctx.drawImage(img,dx*TS,dy*TS,TS,TS);res(true);};
    img.onerror=()=>{ctx.fillStyle="#e8eaee";ctx.fillRect(dx*TS,dy*TS,TS,TS);res(false);};
    img.src=url;
   }));
  }
  const results=await Promise.all(loads);
  const okCount=results.filter(Boolean).length;
  if(okCount===0){U.under.gsiStatus="地図を取得できませんでした（通信制限の可能性）。";renderPanel();return;}
  // 実世界の1タイルの幅(m)→3タイル分が図面幅
  const mPerTile=40075016.686*Math.cos(U.geo.lat*Math.PI/180)/Math.pow(2,z);
  const totalM=mPerTile*N;
  // canvasをテクスチャ化して下敷きへ
  const tex=new THREE.CanvasTexture(cv);
  tex.needsUpdate=true;
  if(U.under.tex)U.under.tex.dispose();
  U.under.tex=tex; U.under.raw=null; U.under.pages=1; U.under.page=1;
  U.under.width=+totalM.toFixed(1);  // 実寸幅を自動セット
  U.under.show=true;
  // 敷地中心が地図中心とずれる分を補正（タイル中心と実座標の差）
  U.under.gsiStatus=`✓ ${tile.label}を表示（約${totalM.toFixed(0)}m四方 / ズーム${z}）\n出典：国土地理院`;
  U.under.gsiKind=kind; U.under.gsiZoom=z;
  rebuild(); renderPanel();
 }catch(err){
  U.under.gsiStatus="取得失敗："+(err&&err.message?err.message:"不明なエラー");
  renderPanel();
 }
}
window.loadGsiMap=loadGsiMap;
window.setGsiKind=(k)=>{U.under.gsiKind=k;renderPanel();};
window.setGsiZoom=(z)=>{U.under.gsiZoom=Math.max(14,Math.min(18,+z));renderPanel();};
// 国土地理院 地図を別タブで開く（住所があればその地名で検索）
window.openGsiMap=()=>{
 const addr=(U.p.addr||"").trim();
 if(addr){
  // 地理院地図は q= で地名検索できる
  window.open("https://maps.gsi.go.jp/#17/35.68/139.76/&q="+encodeURIComponent(addr),"_blank","noopener");
 }else{
  window.open("https://maps.gsi.go.jp/","_blank","noopener");
 }
};

// ───── 設計概要の自動読取（β）─────
async function parsePdfSummary(){
 if(!U.under.raw){toast("先に「下敷き」タブでPDFを読み込んでください","err");return;}
 const pdf=await pdfjsLib.getDocument({data:U.under.raw.slice(0)}).promise;
 let txt="";
 for(let p=1;p<=pdf.numPages;p++){const pg=await pdf.getPage(p);const tc=await pg.getTextContent();txt+=tc.items.map(i=>i.str).join(" ")+"\n";}
 const z=txt.replace(/[０-９．]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/，|,/g,"");
 if(z.replace(/\s/g,"").length<30){toast("このPDFから文字を取得できません（スキャン画像は読取不可）","err");return;}
 const num1=(re)=>{const m=z.match(re);return m?parseFloat(m[1]):null;};
 const str1=(re)=>{const m=z.match(re);return m?m[1].trim():null;};
 const found={};
 found["延床面積"]=num1(/延べ?\s*床?\s*面積[^0-9]{0,15}([0-9]+(?:\.[0-9]+)?)/);
 found["建築面積"]=num1(/建築\s*面積[^0-9]{0,15}([0-9]+(?:\.[0-9]+)?)/);
 found["敷地面積"]=num1(/敷地\s*面積[^0-9]{0,15}([0-9]+(?:\.[0-9]+)?)/);
 // 施工床面積（容積対象外を含む総施工面積。表記ゆれ多い）
 found["施工床面積"]=num1(/施工\s*床?\s*面積[^0-9]{0,15}([0-9]+(?:\.[0-9]+)?)/)||num1(/工事\s*床\s*面積[^0-9]{0,15}([0-9]+(?:\.[0-9]+)?)/);
 // 専有面積（住戸専有・専有部分など）
 found["専有面積"]=num1(/専有\s*(?:部分)?\s*面積[^0-9]{0,15}([0-9]+(?:\.[0-9]+)?)/)||num1(/住戸\s*専有[^0-9]{0,15}([0-9]+(?:\.[0-9]+)?)/);
 found["地上階数"]=num1(/地上\s*([0-9]+)\s*階/)||num1(/([0-9]+)\s*階\s*建/);
 found["高さm"]=num1(/(?:最高|建物)\s*(?:の)?\s*高さ[^0-9]{0,12}([0-9]+(?:\.[0-9]+)?)/)||num1(/高さ[^0-9]{0,12}([0-9]+(?:\.[0-9]+)?)/);
 found["戸数"]=num1(/([0-9]+)\s*戸/)||num1(/総戸数[^0-9]{0,8}([0-9]+)/)||num1(/([0-9]+)\s*(?:室|住戸)/);
 found["構造"]=/SRC|鉄骨鉄筋/.test(z)?"SRC":(/RC|鉄筋コンクリート/.test(z)?"RC":(/鉄骨造|S造/.test(z)?"S":(/木造|W造/.test(z)?"W":null)));
 found["建蔽率"]=num1(/建蔽率[^0-9]{0,10}([0-9]+(?:\.[0-9]+)?)/)||num1(/建ぺい率[^0-9]{0,10}([0-9]+(?:\.[0-9]+)?)/);
 found["容積率"]=num1(/容積率[^0-9]{0,10}([0-9]+(?:\.[0-9]+)?)/);
 // 住所（所在地・地名地番・建設地など）／都道府県から始まる行を拾う
 found["住所"]=str1(/(?:所在地|地名地番|建設地|敷地の?位置|計画地)[^぀-ヿ一-龥0-9]{0,6}([^\n　]{4,40}?)(?:\s{2,}|地域|地区|$)/)
   ||str1(/((?:北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)[^\n　]{2,30}?[0-9０-９\-‐－]+)/);
 const useMap=[
  {re:/分譲/,val:"共同住宅（分譲）"},{re:/共同住宅|マンション|アパート|賃貸/,val:"共同住宅（賃貸）"},
  {re:/ホテル|旅館|宿泊/,val:"ホテル"},{re:/事務所|オフィス/,val:"事務所"},{re:/店舗|商業|物販/,val:"店舗"},
  {re:/倉庫|物流|配送センター/,val:"倉庫・物流"},{re:/病院|医院|クリニック|診療所|医療/,val:"病院・医療"}
 ];
 found["用途"]=null; for(const{re,val}of useMap){if(re.test(z)){found["用途"]=val;break;}}
 const lines=Object.entries(found).filter(([k,v])=>v!=null).map(([k,v])=>"・"+k+"： "+v);
 if(!lines.length){toast("設計概要の数値を見つけられませんでした。手入力してください","err");return;}
 if(!confirm("PDFから読み取りました（β版・必ず原本と照合してください）\n\n"+lines.join("\n")+"\n\nこの値を諸元へ反映しますか？"))return;
 if(found["延床面積"])U.p.tArea=found["延床面積"];
 if(found["施工床面積"])U.p.consArea=found["施工床面積"];
 if(found["専有面積"])U.p.privArea=found["専有面積"];
 if(found["地上階数"])U.p.floors=found["地上階数"];
 if(found["高さm"]&&found["高さm"]>3&&found["高さm"]<250)U.p.height=found["高さm"];
 if(found["構造"])U.p.struct=found["構造"];
 if(found["用途"])U.p.use=found["用途"];
 if(found["戸数"])U.p.units=found["戸数"];
 if(found["住所"])U.p.addr=found["住所"];
 // 面積は諸元の実測値フィールドにも記録（ダッシュボード・BIM出力で優先使用）
 if(found["建築面積"]){U.p.bldgArea=found["建築面積"];const b=U.blocks[0];const r=posv(b.w,12)/Math.max(1,posv(b.d,10));b.w=+Math.sqrt(found["建築面積"]*r).toFixed(1);b.d=+Math.sqrt(found["建築面積"]/r).toFixed(1);}
 if(found["敷地面積"]){U.p.siteArea=found["敷地面積"];const r=posv(U.site.w,30)/Math.max(1,posv(U.site.d,18));U.site.w=+Math.sqrt(found["敷地面積"]*r).toFixed(1);U.site.d=+Math.sqrt(found["敷地面積"]/r).toFixed(1);}
 rebuild();renderPanel();renderTitle();
}
window.parsePdfSummary=parsePdfSummary;

// ───── PDF / 画像 読込 ─────
async function loadUnderFile(file){
 if(!file)return;
 if(file.type==="application/pdf"){
  const buf=await file.arrayBuffer();
  U.under.raw=buf;
  const pdf=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;
  U.under.pages=pdf.numPages;U.under.page=Math.min(U.under.page,pdf.numPages);
  await renderPdfPage();
 }else{
  const url=URL.createObjectURL(file);
  new THREE.TextureLoader().load(url,t=>{if(U.under.tex)U.under.tex.dispose();U.under.tex=t;U.under.raw=null;U.under.pages=1;rebuild();renderPanel();});
 }
}
async function renderPdfPage(){
 if(!U.under.raw)return;
 const pdf=await pdfjsLib.getDocument({data:U.under.raw.slice(0)}).promise;
 const page=await pdf.getPage(Math.min(Math.max(1,Math.round(U.under.page)),pdf.numPages));
 const vp=page.getViewport({scale:1});
 const scale=1800/vp.width;
 const v2=page.getViewport({scale});
 const cv=document.createElement("canvas");cv.width=v2.width;cv.height=v2.height;
 await page.render({canvasContext:cv.getContext("2d"),viewport:v2}).promise;
 if(U.under.tex)U.under.tex.dispose();
 const tex=new THREE.CanvasTexture(cv);tex.anisotropy=4;
 U.under.tex=tex;rebuild();renderPanel();
}
function loadPhotoFile(file){
 if(!file)return;
 const url=URL.createObjectURL(file);
 new THREE.TextureLoader().load(url,t=>{if(U.photo.tex)U.photo.tex.dispose();U.photo.tex=t;rebuild();renderPanel();});
}

// ───── UI ─────
const F=(l,v,fn,t="number",step)=>`<label class="f"><span>${l}</span><input type="${t}" ${step?`step="${step}"`:""} value="${v}" oninput="(${fn})(this.value)"></label>`;
const SL=(l,v,fn,mn,mx,st=1)=>`<label class="f"><span>${l}：<b style="font-family:ui-monospace">${v}</b></span><input type="range" min="${mn}" max="${mx}" step="${st}" value="${v}" oninput="(${fn})(parseFloat(this.value));this.previousElementSibling.querySelector('b').textContent=this.value"></label>`;
const CK=(l,v,fn)=>`<label class="chk"><input type="checkbox" ${v?"checked":""} onchange="(${fn})(this.checked)">${l}</label>`;
// rebuildをフレーム単位で間引く（スライダー連続操作でのカクつき防止）
let _rebuildQueued=false;
function rebuildThrottled(){
 if(_rebuildQueued)return;
 _rebuildQueued=true;
 requestAnimationFrame(()=>{ _rebuildQueued=false; rebuild(); });
}
// ───── 画面内通知（alertの代替：操作を止めない）─────
function toast(msg,type){
 let el=document.getElementById("toast");
 if(!el){el=document.createElement("div");el.id="toast";document.body.appendChild(el);}
 el.textContent=msg; el.className="show"+(type?" "+type:"");
 clearTimeout(el._t); el._t=setTimeout(()=>{el.className="";},type==="err"?4500:2600);
}
window.toast=toast;

// ───── Undo（操作の取り消し：Uのスナップショットを最大30段階保持）─────
const _hist=[]; let _histLast=0, _histKey="";
const _SNAP_SKIP=(k)=>(k==="tex"||k==="raw"||k==="ents"||k==="_warn"||k==="_stats"||k==="_dimDist"||k==="_exporting"||k==="_titleMin"||k==="_acc"||k==="_hudMin"||k==="sel"||k==="polyInput"||k==="calib"||k==="gsiStatus");
// key: 同じ操作（スライダー連続など）は700ms以内なら1回にまとめる
function snapshot(key){
 const now=Date.now();
 if(key&&key===_histKey&&now-_histLast<700){_histLast=now;return;}
 try{
  const s=JSON.stringify(U,(k,v)=>_SNAP_SKIP(k)?undefined:v);
  if(_hist.length&&_hist[_hist.length-1]===s)return;
  _hist.push(s); if(_hist.length>30)_hist.shift();
  _histKey=key||""; _histLast=now;
  const b=document.getElementById("undo-btn"); if(b)b.disabled=false;
  scheduleDraft();
 }catch(e){}
}
function undo(){
 if(!_hist.length){toast("戻せる操作がありません");return;}
 const p=JSON.parse(_hist.pop());
 // テクスチャ等の非保存オブジェクトは現状を維持
 const keep={ut:U.under.tex,ur:U.under.raw,up:U.under.pages,upg:U.under.page,pt:U.photo.tex,de:U.dxf.ents,dr:U.dxf.raw};
 Object.assign(U,p);
 U.under.tex=keep.ut;U.under.raw=keep.ur;U.under.pages=keep.up;U.under.page=keep.upg;U.photo.tex=keep.pt;U.dxf.ents=keep.de;U.dxf.raw=keep.dr;
 U.sel=null;U.polyInput={on:false,pts:[],target:null};U.calib={on:false,a:null,b:null};
 _histKey="";
 rebuild();renderPanel();renderBar();
 toast("1つ前の状態に戻しました");
}
window.undo=undo;
// ───── 自動退避（下書き）：端末内(localStorage)に直近状態を保持。閉じても復元できる ─────
const DRAFT_KEY="bimgen_draft", DRAFT_OFF="bimgen_draft_off";
let _draftT=null;
function draftEnabled(){try{return localStorage.getItem(DRAFT_OFF)!=="1";}catch(e){return false;}}
function saveDraft(){
 if(!draftEnabled())return;
 try{const s=JSON.stringify(U,(k,v)=>_SNAP_SKIP(k)?undefined:v);
  localStorage.setItem(DRAFT_KEY,JSON.stringify({savedAt:Date.now(),name:U.p.name||"",data:s}));
 }catch(e){/* 容量超過等は無視 */}
}
function scheduleDraft(){clearTimeout(_draftT);_draftT=setTimeout(saveDraft,2000);}
setInterval(saveDraft,30000);
window.addEventListener("beforeunload",saveDraft);
function readDraft(){try{const j=localStorage.getItem(DRAFT_KEY);return j?JSON.parse(j):null;}catch(e){return null;}}
function applyState(p){
 const keep={ut:U.under.tex,ur:U.under.raw,up:U.under.pages,upg:U.under.page,pt:U.photo.tex,de:U.dxf.ents,dr:U.dxf.raw};
 Object.assign(U,p);
 U.under.tex=keep.ut;U.under.raw=keep.ur;U.under.pages=keep.up;U.under.page=keep.upg;U.photo.tex=keep.pt;U.dxf.ents=keep.de;U.dxf.raw=keep.dr;
 U.sel=null;U.polyInput={on:false,pts:[],target:null};U.calib={on:false,a:null,b:null};
 if(!Array.isArray(U.annot))U.annot=[];if(!Array.isArray(U.subsurface))U.subsurface=[];if(!U.ojt)U.ojt={};
}
window.restoreDraft=()=>{
 const d=readDraft(); if(!d){toast("下書きがありません");return;}
 try{snapshot();applyState(JSON.parse(d.data));if(typeof closeStart==="function")closeStart();rebuild();renderPanel();renderBar();
  toast("前回の続きを復元しました（"+new Date(d.savedAt).toLocaleString("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})+"）","ok");
 }catch(e){toast("下書きの復元に失敗しました","err");}
};
window.setDraftEnabled=(on)=>{try{if(on)localStorage.removeItem(DRAFT_OFF);else{localStorage.setItem(DRAFT_OFF,"1");localStorage.removeItem(DRAFT_KEY);}}catch(e){}
 toast(on?"自動退避をオンにしました":"自動退避をオフにし、下書きを削除しました");};
window.clearDraft=()=>{try{localStorage.removeItem(DRAFT_KEY);}catch(e){}toast("下書きを削除しました");if(typeof openStart==="function")openStart();};
document.addEventListener("keydown",(e)=>{
 if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&(e.key==="z"||e.key==="Z")){
  const t=e.target; if(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.tagName==="SELECT"))return;
  e.preventDefault(); undo();
 }
});

window.S=(path,v,re=true)=>{snapshot(path);const ks=path.split(".");let o=U;while(ks.length>1)o=o[ks.shift()];o[ks[0]]=v;if(re)rebuildThrottled();};
// ───── 折りたたみセクション（アコーディオン）─────
// 使い方：SEC("見出し", "中身HTML", { key:"一意キー", open:既定で開くか, icon:"絵文字" })
// ───── OJT検討項目（社内OJTチェックリスト 2024改訂・躯体編 から、BimGenで検討できる項目を抽出）─────
//  src: 出典（工程番号-項目番号） / how: BimGenでの確認方法
const OJT_CHECKS={
 "敷地・地形":[
  {k:"s1",src:"1-9", t:"敷地境界（官民・民々）を確認し、敷地寸法を実測値で入力したか", how:"敷地の間口・奥行・位置"},
  {k:"s2",src:"1-12",t:"敷地実測と実施設計図を照合したか", how:"下敷きタブ：図面PDFを敷いてスケール補正"},
  {k:"s3",src:"3-11",t:"近隣道路・敷地のレベル（高低差）を確認したか", how:"敷地の傾斜（かんたん設定）・道路の傾斜"},
  {k:"s4",src:"1-14",t:"道路埋設物（上下水道・ガス・電気）を調査したか", how:"施工/CAD：地下支障物マーカーで位置を記録"},
  {k:"s5",src:"1-21",t:"搬入出道路に道路占用・道路使用の必要はないか", how:"前面道路での施工計画の検討（縦列・残車道幅）"},
  {k:"s6",src:"1-20",t:"現場付近道路の通行規制はないか", how:"道路使用条件メモに記入"},
  {k:"s7",src:"1-8", t:"近隣家屋の細部調査（レベル・写真）をしたか", how:"近隣タブ：近隣建物を配置して離隔を確認"},
  {k:"s8",src:"3-4", t:"河川・池が近い場合、地下水位を確認したか", how:"住所検索→標高・ハザードマップを確認"},
 ],
 "仮設":[
  {k:"t1",src:"15-13",t:"揚重機（クレーン・リフト等）を検討し、設置届の要否を確認したか", how:"クレーン機種・位置・作業半径で建物を覆えるか"},
  {k:"t2",src:"15-7", t:"足場と建物の間隔は安全かつ作業性が適正か（図面作成時）", how:"外部足場を表示して間隔を確認"},
  {k:"t3",src:"15-9", t:"朝顔の位置・防災シート・金網を災害防止上検討したか（図面作成時）", how:"朝顔の設置高さ"},
  {k:"t4",src:"15-4", t:"昇降階段の位置を検討したか（図面作成時）", how:"施工/CAD：注記（文字）で位置を明示"},
  {k:"t5",src:"3-8",  t:"近隣への振動・騒音・飛散対策として仮囲いの高さは適切か", how:"仮囲いの高さ（2〜8m）"},
  {k:"t6",src:"2-17", t:"仮囲い・朝顔・乗入れで道路占用が必要ないか", how:"仮囲い位置と道路の関係を確認"},
  {k:"t7",src:"15-5", t:"足場脚部の地盤は良いか（埋戻し・沈下の検討）", how:"傾斜・GLとの関係を確認"},
  {k:"t8",src:"15-11",t:"台風・強風に対する対策を検討したか（図面作成時）", how:"足場・仮囲いの高さと風向きを想定"},
 ],
 "施工/CAD":[
  {k:"c1",src:"3-16", t:"杭打機・重機の重量に耐える地盤か（転倒防止・敷き鉄板）", how:"重機を配置し据付面（傾斜）を確認"},
  {k:"c2",src:"7-3",  t:"掘削着手〜完了までの埋設物（既存基礎・杭・配管）を確認したか", how:"地下支障物マーカーで範囲を記録"},
  {k:"c3",src:"8-4",  t:"材料取込の検討をしたか（仮設ステージの要否）", how:"注記（範囲）で資材置場・荷取り位置を確保"},
  {k:"c4",src:"7-1",  t:"搬入出経路に通行規制・高さ規制はないか", how:"車両を配置し道路条件・歩行帯との干渉を確認"},
 ],
};
function ojtSection(tab){
 const items=OJT_CHECKS[tab]; if(!items)return "";
 if(!U.ojt)U.ojt={};
 const done=items.filter(i=>U.ojt[i.k]).length;
 const rows=items.map(i=>`<label class="ojt-row ${U.ojt[i.k]?"done":""}"><input type="checkbox" ${U.ojt[i.k]?"checked":""} onchange="toggleOjt('${i.k}',this.checked)"><span class="ojt-t">${i.t}<small>▶ ${i.how}<span class="ojt-src">OJT ${i.src}</span></small></span></label>`).join("");
 const inner=`<div class="ojt-head"><span>${done} / ${items.length} 検討済み</span><div class="ojt-bar"><i style="width:${items.length?done/items.length*100:0}%"></i></div></div>${rows}
  <div class="hint" style="margin-top:6px">出典：社内OJTチェックリスト（2024改訂・躯体編）のうち、BimGenで図面作成時に検討できる項目。✓は案件と一緒に保存され、検討シートにも載ります。</div>`;
 return SEC(`OJT検討項目（${done}/${items.length}）`, inner, {key:"ojt-"+tab, icon:"🎓", open:false});
}
window.toggleOjt=(k,v)=>{snapshot();if(!U.ojt)U.ojt={};if(v)U.ojt[k]=true;else delete U.ojt[k];renderPanel();};
function SEC(title, inner, opt){
 opt=opt||{};
 const key=opt.key||title;
 if(!U._acc)U._acc={};
 // 初回だけ既定値を設定（以後はユーザー操作を尊重）
 if(U._acc[key]===undefined)U._acc[key]=!!opt.open;
 const open=U._acc[key];
 const icon=opt.icon?`<span style="margin-right:6px">${opt.icon}</span>`:"";
 return `<div class="sec ${open?"open":""}">
   <div class="sec-h" onclick="toggleSec('${key.replace(/'/g,"")}')">
     <span>${icon}${title}</span>
     <span class="sec-arrow">${open?"▾":"▸"}</span>
   </div>
   <div class="sec-b" style="${open?"":"display:none"}">${inner}</div>
 </div>`;
}
window.toggleSec=(key)=>{ if(!U._acc)U._acc={}; U._acc[key]=!U._acc[key]; renderPanel(); };
window.SB=(id,k,v)=>{snapshot("blk."+id+"."+k);const b=U.blocks.find(x=>x.id===id);if(b){b[k]=v;rebuild();}};
window.SN=(i,k,v)=>{snapshot("nb."+i+"."+k);if(U.nbs[i]){U.nbs[i][k]=v;rebuild();}};
window.SH=(i,v)=>{snapshot("site.h."+i);U.site.h[i]=v;rebuild();};
// ───── 敷地の傾斜をまとめて設定（実務でよくある「北が高い」等を一発で）─────
// dir: 方向（どちらが高いか）, diff: 高低差(m)
// 四隅 h[0]=前面左(南西) h[1]=前面右(南東) h[2]=奥左(北西) h[3]=奥右(北東)
//  ※3Dでは手前(+Z)が前面道路側＝南想定
window.setSlope=(dir,diff)=>{
 snapshot("slope");
 const d=numv(diff,0);
 const h=[0,0,0,0];
 switch(dir){
  case "north": h[2]=d; h[3]=d; break;                 // 奥(北)が高い
  case "south": h[0]=d; h[1]=d; break;                 // 前面(南)が高い
  case "east":  h[1]=d; h[3]=d; break;                 // 右(東)が高い
  case "west":  h[0]=d; h[2]=d; break;                 // 左(西)が高い
  case "ne":    h[3]=d; h[1]=d/2; h[2]=d/2; break;     // 北東が高い
  case "nw":    h[2]=d; h[0]=d/2; h[3]=d/2; break;     // 北西が高い
  case "flat":  break;                                  // 平坦
 }
 U.site.h=h; U.site.slopeDir=dir; U.site.slopeDiff=d;
 rebuild(); renderPanel();
};
// 敷地の高低差・勾配を計算（表示用）
function slopeInfo(){
 const hh=(U.site.h||[0,0,0,0]).map(v=>numv(v,0));
 const sw=posv(U.site.w,30), sd=posv(U.site.d,18);
 const hi=Math.max(...hh), lo=Math.min(...hh);
 const diff=hi-lo;
 // 前後方向（道路→奥）と左右方向の勾配
 const frontAvg=(hh[0]+hh[1])/2, backAvg=(hh[2]+hh[3])/2;
 const leftAvg=(hh[0]+hh[2])/2, rightAvg=(hh[1]+hh[3])/2;
 const gradeZ=sd>0?Math.abs(backAvg-frontAvg)/sd*100:0;   // 前後の勾配%
 const gradeX=sw>0?Math.abs(rightAvg-leftAvg)/sw*100:0;   // 左右の勾配%
 return {diff,hi,lo,gradeZ,gradeX,frontAvg,backAvg,leftAvg,rightAvg,
   dirZ:backAvg>frontAvg?"奥（北側）が高い":backAvg<frontAvg?"前面（道路側）が高い":"前後は水平",
   dirX:rightAvg>leftAvg?"右（東側）が高い":rightAvg<leftAvg?"左（西側）が高い":"左右は水平"};
}
window.slopeInfo=slopeInfo;
window.delB=(id)=>{snapshot();U.blocks=U.blocks.filter(b=>b.id!==id);if(U.sel&&U.sel.startsWith("blk:"))U.sel=null;rebuild();renderPanel();};
window.addB=()=>{snapshot();U.blocks.push({id:Date.now(),label:"ブロック",f1:1,f2:2,w:15,d:10,dx:0,dz:8});rebuild();renderPanel();};
window.delN=(i)=>{snapshot();U.nbs.splice(i,1);rebuild();renderPanel();};
window.addN=()=>{snapshot();U.nbs.push({x:25,z:15,w:10,d:10,h:12,ry:0});rebuild();renderPanel();};
window.setMode=(m)=>{snapshot();U.tw.mode=m;rebuild();renderPanel();};
window.addCO=(type)=>{snapshot();const t=COBJ_TYPES[type]||COBJ_TYPES.truck;const sz=t.sizes[0];const sdz2=numv(U.site.dz,0),sd2=posv(U.site.d,18);U.cobj.push({type,size:sz.key,x:numv(U.site.dx,0),z:sdz2+sd2/2+6,w:sz.w,d:sz.d,h:sz.h,ry:0});U.sel="co:"+(U.cobj.length-1);rebuild();renderPanel();};
window.delCO=(i)=>{snapshot();U.cobj.splice(i,1);if(U.sel==="co:"+i)U.sel=null;rebuild();renderPanel();};
window.addSub=(kind)=>{
 snapshot();
 const sdz2=numv(U.site.dz,0),sd2=posv(U.site.d,18);
 const rw=Math.min(20,Math.max(4,numv(U.road.w,8)));
 // 既定位置＝前面道路の中心線上（埋設物は道路下に多いため）。道路の移動オフセットも反映
 const roadZ=sdz2+sd2/2+1.6+rw/2+numv(U.road.dz,0);
 const roadX=numv(U.site.dx,0)+numv(U.road.dx,0);
 U.subsurface.push({kind,x:roadX,z:roadZ,w:Math.min(rw*0.7,3),d:Math.max(sd2,20),ry:numv(U.road.ry,0)});
 U.sel="sub:"+(U.subsurface.length-1);rebuild();renderPanel();
};
window.delSub=(i)=>{snapshot();U.subsurface.splice(i,1);if(U.sel==="sub:"+i)U.sel=null;rebuild();renderPanel();};
// ───── 注記（地面貼り付け）─────
window.addAnnotZone=()=>{snapshot();const sdz2=numv(U.site.dz,0),sd2=posv(U.site.d,18);U.annot.push({type:"zone",x:numv(U.site.dx,0),z:sdz2,w:8,d:6,ry:0,color:"red"});U.sel="an:"+(U.annot.length-1);rebuild();renderPanel();};
window.addAnnotText=()=>{const t=prompt("注記の文字を入力（40文字まで）","注意");if(t==null)return;snapshot();const sdz2=numv(U.site.dz,0);U.annot.push({type:"text",x:numv(U.site.dx,0),z:sdz2,ry:0,color:"red",text:t.slice(0,40),fsize:2.5});U.sel="an:"+(U.annot.length-1);rebuild();renderPanel();};
window.editAnnotText=(i)=>{const a=U.annot[i];if(!a)return;const t=prompt("注記の文字を編集",a.text||"");if(t==null)return;snapshot();a.text=t.slice(0,40);rebuild();renderPanel();};
window.delAnnot=(i)=>{snapshot();U.annot.splice(i,1);if(U.sel==="an:"+i)U.sel=null;rebuild();renderPanel();};
window.setCOSize=(i,key)=>{const c=U.cobj[i];if(!c)return;const sz=cobjSize(c.type,key);if(sz){snapshot();c.size=key;c.w=sz.w;c.d=sz.d;c.h=sz.h;}rebuild();renderPanel();};
window.selCO=(i)=>{U.sel="co:"+i;rebuild();renderPanel();};
window.setPage=async(v)=>{U.under.page=v;await renderPdfPage();};

// 諸元タブの自動算出チップだけを部分更新（入力フォーカスを保つ）
function updateShoshiChips(){
 const box=$("#shoshi-auto"); if(!box)return;
 const siteA = posv(U.p.siteArea,0) || siteArea();
 const tA = posv(U.p.tArea,0), bA = posv(U.p.bldgArea,0), prA = posv(U.p.privArea,0), un = Math.round(posv(U.p.units,0));
 const farCalc = siteA>0 && tA>0 ? (tA/siteA*100) : null;
 const bcrCalc = siteA>0 && bA>0 ? (bA/siteA*100) : null;
 const effRate = tA>0 && prA>0 ? (prA/tA*100) : null;
 const perUnit = un>0 && prA>0 ? (prA/un) : null;
 const chip=(label,val,unit2,col)=> val==null?"":`<div style="flex:1;min-width:78px;background:#f3f5f8;border:1px solid var(--line);border-radius:7px;padding:5px 8px"><div style="font-size:9px;color:var(--mut)">${label}</div><div style="font-family:ui-monospace;font-size:13px;font-weight:700;color:${col||"var(--navy)"}">${val}<span style="font-size:9px;font-weight:400"> ${unit2}</span></div></div>`;
 box.innerHTML = [
   chip("容積率(自動)", farCalc!=null?farCalc.toFixed(0):null, "%", farCalc>300?"#B0433A":"#2E7D5B"),
   chip("建蔽率(自動)", bcrCalc!=null?bcrCalc.toFixed(0):null, "%", bcrCalc>60?"#B0433A":"#2E7D5B"),
   chip("専有率", effRate!=null?effRate.toFixed(1):null, "%"),
   chip("戸あたり", perUnit!=null?perUnit.toFixed(1):null, "m²/戸"),
 ].join("");
}
window.updateShoshiChips=updateShoshiChips;

function renderPanel(){
 // 2階層タブ：3グループ → 各グループのサブタブ
 const TAB_GROUPS=[
   {key:"建物", icon:"🏢", tabs:["諸元","形状"]},
   {key:"敷地・環境", icon:"🗺️", tabs:["敷地・地形","近隣","下敷き"]},
   {key:"施工", icon:"🚧", tabs:["仮設","施工/CAD"]},
 ];
 if(!U.tabGroup)U.tabGroup="建物";
 const curG=TAB_GROUPS.find(g=>g.key===U.tabGroup)||TAB_GROUPS[0];
 // 現在のタブがグループ外なら、グループ先頭に合わせる
 if(!curG.tabs.includes(U.tab))U.tab=curG.tabs[0];
 // 上段：グループ
 const groupBar=TAB_GROUPS.map(g=>`<div class="tg ${U.tabGroup===g.key?"on":""}" onclick="U.tabGroup='${g.key}';U.tab='${g.tabs[0]}';renderPanel()">${g.icon} ${g.key}</div>`).join("");
 // 下段：サブタブ（グループ内に複数あるときだけ表示）
 const subBar=curG.tabs.length>1
   ? `<div id="subtabs">${curG.tabs.map(t=>`<div class="${U.tab===t?"on":""}" onclick="U.tab='${t}';renderPanel()">${t}</div>`).join("")}</div>`
   : "";
 $("#tabs").innerHTML=`<div id="tabgroups">${groupBar}</div>${subBar}`;
 let h="";
 if(U.tab==="諸元"){
  // 自動算出プレビュー用の値
  const siteA = posv(U.p.siteArea,0) || siteArea();
  const tA = posv(U.p.tArea,0);
  const bA = posv(U.p.bldgArea,0);
  const prA = posv(U.p.privArea,0);
  const un = Math.round(posv(U.p.units,0));
  const farCalc = siteA>0 && tA>0 ? (tA/siteA*100) : null;       // 容積率
  const bcrCalc = siteA>0 && bA>0 ? (bA/siteA*100) : null;       // 建蔽率
  const effRate = tA>0 && prA>0 ? (prA/tA*100) : null;           // 専有率（レンタブル比）
  const perUnit = un>0 && prA>0 ? (prA/un) : null;               // 戸あたり専有面積
  const chip=(label,val,unit2,col)=> val==null?"":`<div style="flex:1;min-width:78px;background:#f3f5f8;border:1px solid var(--line);border-radius:7px;padding:5px 8px"><div style="font-size:9px;color:var(--mut)">${label}</div><div style="font-family:ui-monospace;font-size:13px;font-weight:700;color:${col||"var(--navy)"}">${val}<span style="font-size:9px;font-weight:400"> ${unit2}</span></div></div>`;
  const auto = [
    chip("容積率(自動)", farCalc!=null?farCalc.toFixed(0):null, "%", farCalc>300?"#B0433A":"#2E7D5B"),
    chip("建蔽率(自動)", bcrCalc!=null?bcrCalc.toFixed(0):null, "%", bcrCalc>60?"#B0433A":"#2E7D5B"),
    chip("専有率", effRate!=null?effRate.toFixed(1):null, "%"),
    chip("戸あたり", perUnit!=null?perUnit.toFixed(1):null, "m²/戸"),
  ].join("");
  const autoBox = `<div id="shoshi-auto" style="display:flex;flex-wrap:wrap;gap:5px;margin:8px 0">${auto}</div>`;

  const secBasic=`<label class="f"><span>物件名</span><input type="text" value="${(U.p.name||"").replace(/"/g,"&quot;")}" oninput="S('p.name',this.value,false);renderTitle()"></label>
  <label class="f"><span>建物住所</span><input type="text" placeholder="例：愛知県名古屋市中区…" value="${(U.p.addr||"").replace(/"/g,"&quot;")}" oninput="S('p.addr',this.value,false);renderTitle()"></label>
  <label class="f"><span>用途（ファサード連動）</span><select onchange="S('p.use',this.value)">${USES.map(o=>`<option ${U.p.use===o?"selected":""}>${o}</option>`).join("")}</select></label>
  <div class="grid2">
   <label class="f"><span>地上階数</span><input type="number" value="${U.p.floors}" oninput="S('p.floors',this.value)"></label>
   <label class="f"><span>建物高さ m</span><input type="number" value="${U.p.height}" oninput="S('p.height',this.value)"></label>
   <label class="f"><span>構造</span><select onchange="S('p.struct',this.value,false);renderTitle()">${["RC","SRC","S","W","CFT"].map(o=>`<option ${U.p.struct===o?"selected":""}>${o}</option>`).join("")}</select></label>
   <label class="f"><span>戸数・室数</span><input type="number" placeholder="戸" value="${U.p.units}" oninput="S('p.units',this.value,false);renderTitle();updateShoshiChips()"></label>
  </div>`;
  const secArea=`<div class="grid2">
   <label class="f"><span>敷地面積 m²</span><input type="number" placeholder="空欄=形状から" value="${U.p.siteArea}" oninput="S('p.siteArea',this.value,false);renderTitle();updateShoshiChips()"></label>
   <label class="f"><span>建築面積 m²</span><input type="number" placeholder="空欄=1F相当" value="${U.p.bldgArea}" oninput="S('p.bldgArea',this.value,false);renderTitle();updateShoshiChips()"></label>
   <label class="f"><span>延床面積 m²</span><input type="number" value="${U.p.tArea}" oninput="S('p.tArea',this.value,false);renderTitle();updateShoshiChips()"></label>
   <label class="f"><span>施工床面積 m²</span><input type="number" placeholder="容積対象外含む" value="${U.p.consArea}" oninput="S('p.consArea',this.value,false);renderTitle();updateShoshiChips()"></label>
   <label class="f"><span>専有面積 m²</span><input type="number" placeholder="分譲/賃貸の専有計" value="${U.p.privArea}" oninput="S('p.privArea',this.value,false);renderTitle();updateShoshiChips()"></label>
  </div>
  ${autoBox}
  <div class="hint">敷地面積を空欄にすると敷地形状から、建築面積を空欄にすると1F相当から自動計算します。容積率・建蔽率・専有率・戸あたり面積はリアルタイムで算出されます。</div>`;
  const secNote=`<label class="f" style="align-items:flex-start"><span>メモ</span><textarea rows="2" style="resize:vertical;font-family:inherit" placeholder="特記事項・地区計画・条件など" oninput="S('p.note',this.value,false);renderTitle()">${(U.p.note||"").replace(/</g,"&lt;")}</textarea></label>
  <label class="f" style="margin-top:4px"><span>AIプロンプトに住所を含める</span><input type="checkbox" ${U.p.aiIncludeAddr?"checked":""} onchange="S('p.aiIncludeAddr',this.checked,false)"></label>
  <div class="hint">「AIパース下書き」で生成するプロンプトは外部のAIツールに貼り付けて使います。住所も外部送信され得るため、機密案件では<b>オフのまま</b>を推奨します（既定オフ）。</div>`;

  h = SEC("基本情報", secBasic, {key:"sho-basic", icon:"📋", open:true})
    + SEC("面積（実測値を優先・空欄は自動）", secArea, {key:"sho-area", icon:"📐", open:true})
    + SEC("その他・備考", secNote, {key:"sho-note", icon:"📝", open:false});
 }
 if(U.tab==="形状"){
  h=U.blocks.map((b,bi)=>{
   const isPoly=(b.shape==="poly"&&Array.isArray(b.poly));
   let polyArea=0; if(isPoly){let a2=0;for(let i=0;i<b.poly.length;i++){const p=b.poly[i],q=b.poly[(i+1)%b.poly.length];a2+=p.x*q.z-q.x*p.z;}polyArea=Math.abs(a2)/2;}
   return `<div class="card">
   <div style="display:flex;justify-content:space-between;margin-bottom:5px">
    <input type="text" value="${b.label}" style="width:110px;font-weight:700;padding:4px 7px" oninput="SB(${b.id},'label',this.value)">
    <button class="del" onclick="delB(${b.id})">削除</button>
   </div>
   <div class="grid2">
    <label class="f"><span>開始階</span><input type="number" value="${b.f1}" oninput="SB(${b.id},'f1',this.value)"></label>
    <label class="f"><span>終了階</span><input type="number" value="${b.f2}" oninput="SB(${b.id},'f2',this.value)"></label>
    ${isPoly?"":`<label class="f"><span>間口 m</span><input type="number" step="0.1" value="${b.w}" oninput="SB(${b.id},'w',this.value)"></label>
    <label class="f"><span>奥行 m</span><input type="number" step="0.1" value="${b.d}" oninput="SB(${b.id},'d',this.value)"></label>`}
   </div>
   ${isPoly?`<div class="hint" style="margin:0 0 4px">自由多角形（${b.poly.length}頂点）　1層面積 ≒ <b>${polyArea.toFixed(1)} m²</b></div>`:`<div class="hint" style="margin:0 0 4px">床面積 ≒ <b>${(posv(b.w,10)*posv(b.d,10)).toFixed(1)} m²</b>（間口×奥行）</div>`}
   ${SL("位置 左右",b.dx,`(v)=>SB(${b.id},'dx',v)`,-30,30,0.5)}
   ${SL("位置 前後",b.dz,`(v)=>SB(${b.id},'dz',v)`,-30,30,0.5)}
  </div>`;}).join("")
  +(U.blocks.length===0?`<div class="hint" style="background:#FFF3DD;border:1px solid var(--amber);border-radius:8px;padding:8px 10px;margin-bottom:8px">建物ブロックがありません。下のボタンで矩形を追加するか、多角形入力で建物を作成してください。</div>`:"")
  +`<button class="addbtn" onclick="addB()">＋ 矩形ブロックを追加</button>`
  +`<div style="border-top:1px solid var(--line);margin:10px 0 6px"></div>
   <div style="font-size:11px;font-weight:700;color:var(--mut);margin-bottom:3px">形状タイプ：自由多角形（L字・雁行など）</div>`
  +(U.polyInput.on
    ? `<div style="background:#FFF3DD;border:1.5px dashed var(--amber);border-radius:8px;padding:8px 10px;font-size:11.5px;line-height:1.7"><b>多角形入力モード中</b><br>下絵・敷地の上をクリックして頂点を打ち、<b>ダブルクリックで閉じる</b>と建物になります。<br>現在 ${U.polyInput.pts.length} 点${U.polyInput.pts.length>=3?"（閉じられます）":"（あと"+(3-U.polyInput.pts.length)+"点以上）"}<br><button class="btn" style="margin-top:6px" onclick="U.polyInput.pts.pop();rebuild();renderPanel()">1つ戻す</button> <button class="btn" style="margin-top:6px;color:#B0433A" onclick="U.polyInput.on=false;U.polyInput.pts=[];rebuild();renderPanel();renderBar()">中止</button></div>`
    : `<button class="addbtn" onclick="U.polyInput.on=true;U.polyInput.pts=[];renderPanel();renderBar()">✏️ 多角形入力を開始（頂点クリック→ダブルクリックで閉じる）</button><div class="hint">配置図PDFを下敷きにして外周をなぞると、正確な平面形状と延床面積が得られます。</div>`)
  +`<div class="hint">建物はドラッグ＝移動／<b>Ctrl＋ドラッグ＝回転</b>。</div>`;
 }
 if(U.tab==="敷地・地形"){
  const city=cityFromAddr(U.p.addr||"");
  const ge=encodeURIComponent;
  // ① 計画地住所・公共データ照会
  let secGeo=`<input type="text" value="${(U.p.addr||"").replace(/"/g,"&quot;")}" placeholder="例：東京都北区上十条3丁目" oninput="S('p.addr',this.value,false)" style="margin-bottom:6px">
  <button class="addbtn" style="margin-bottom:6px" onclick="fetchGeo()">📍 地盤・標高情報を取得</button>`;
  if(U.geo.status){secGeo+=`<div style="background:#EEF3FA;border-radius:7px;padding:7px 9px;font-size:11px;line-height:1.7;color:#1E3A5F;white-space:pre-wrap;margin-bottom:6px">${U.geo.name?("📍 "+U.geo.name+"\n"):""}${U.geo.status}</div>`;}
  if(U.p.addr){secGeo+=`<div style="font-size:10.5px;color:var(--mut);margin-bottom:3px">▼ ${city||"計画地"}の公開情報を検索（別タブ）</div>
   <div style="display:flex;flex-direction:column;gap:4px">
    <a href="https://www.google.com/search?q=${ge(city+" 都市計画情報 用途地域")}" target="_blank" rel="noopener" style="font-size:11.5px;color:#2552A0">🔎 都市計画・用途地域</a>
    <a href="https://www.google.com/search?q=${ge(city+" ハザードマップ")}" target="_blank" rel="noopener" style="font-size:11.5px;color:#2552A0">🔎 ハザードマップ</a>
    <a href="https://disaportal.gsi.go.jp/" target="_blank" rel="noopener" style="font-size:11.5px;color:#2552A0">🔎 重ねるハザードマップ（国交省）</a>
    <a href="https://www.google.com/search?q=${ge(city+" 地盤 ボーリング 柱状図")}" target="_blank" rel="noopener" style="font-size:11.5px;color:#2552A0">🔎 周辺の地盤・ボーリングデータ</a>
   </div>`;}
  // ② 敷地寸法・形状
  let secSite=`<div class="grid2">
   <label class="f"><span>敷地 間口 m</span><input type="number" value="${U.site.w}" oninput="S('site.w',this.value)"></label>
   <label class="f"><span>敷地 奥行 m</span><input type="number" value="${U.site.d}" oninput="S('site.d',this.value)"></label>
  </div>
  <div style="font-size:11px;font-weight:700;color:var(--mut);margin:6px 0 2px">敷地形状（不整形地・旗竿地など）</div>
  ${Array.isArray(U.site.poly)&&U.site.poly.length>=3
    ? `<div style="background:#EEF6EF;border:1.5px solid #2E7D5B;border-radius:8px;padding:7px 10px;font-size:11.5px;line-height:1.6">多角形敷地（${U.site.poly.length}頂点）で表示中。<br><button class="btn" style="margin-top:5px;color:#B0433A" onclick="U.site.poly=null;rebuild();renderPanel()">矩形敷地に戻す</button></div>`
    : (U.polyInput.on&&U.polyInput.target==="site"
       ? `<div style="background:#FFF3DD;border:1.5px dashed var(--amber);border-radius:8px;padding:8px 10px;font-size:11.5px;line-height:1.7"><b>敷地形状の入力モード中</b><br>下絵・地面をクリックして敷地外周の頂点を打ち、<b>ダブルクリックで閉じる</b>と敷地になります。<br>現在 ${U.polyInput.pts.length} 点<br><button class="btn" style="margin-top:6px" onclick="U.polyInput.pts.pop();rebuild();renderPanel()">1つ戻す</button> <button class="btn" style="margin-top:6px;color:#B0433A" onclick="U.polyInput.on=false;U.polyInput.pts=[];U.polyInput.target=null;rebuild();renderPanel();renderBar()">中止</button></div>`
       : `<button class="addbtn" onclick="U.polyInput.on=true;U.polyInput.target='site';U.polyInput.pts=[];renderPanel();renderBar()">✏️ 敷地を多角形で描く</button><div class="hint">配置図PDFを下敷きにして敷地境界をなぞると、不整形地も正確に再現できます。</div>`)}`;
  // ③ 位置・地盤（GL・高低差）
  let secPos=`${SL("敷地位置 左右",U.site.dx,"(v)=>S('site.dx',v)",-80,80,0.5)}
  ${SL("敷地位置 前後",U.site.dz,"(v)=>S('site.dz',v)",-80,80,0.5)}
  <div style="font-size:10px;color:#2552A0;margin:-2px 0 6px">スライダーのほか、右上「表示▾→敷地/下敷き移動モード」をONにすると3D上で敷地を直接ドラッグできます。</div>
  ${SL("建物GL（設計地盤）m",U.site.gl,"(v)=>S('site.gl',v)",-3,4,0.1)}
  ${(()=>{const si=slopeInfo();if(si.diff<0.05)return "";
    return `<div style="font-size:10px;color:var(--mut);margin:-2px 0 6px;line-height:1.6">傾斜地では建物は水平に建ち、このGLが基準高さになります（実際の造成と同じ考え方）。仮囲い・重機・車両は地形に沿って接地します。</div>`;})()}
  <div style="font-size:11px;font-weight:700;color:var(--mut);margin:8px 0 3px">敷地の傾斜（かんたん設定）</div>
  <div class="grid2" style="margin-bottom:5px">
   <label class="f"><span>高い方向</span><select onchange="setSlope(this.value,${numv(U.site.slopeDiff,0)||1})">
    <option value="flat" ${!U.site.slopeDir||U.site.slopeDir==="flat"?"selected":""}>平坦</option>
    <option value="north" ${U.site.slopeDir==="north"?"selected":""}>奥（北）が高い</option>
    <option value="south" ${U.site.slopeDir==="south"?"selected":""}>前面（南・道路側）が高い</option>
    <option value="east" ${U.site.slopeDir==="east"?"selected":""}>右（東）が高い</option>
    <option value="west" ${U.site.slopeDir==="west"?"selected":""}>左（西）が高い</option>
    <option value="ne" ${U.site.slopeDir==="ne"?"selected":""}>北東が高い</option>
    <option value="nw" ${U.site.slopeDir==="nw"?"selected":""}>北西が高い</option>
   </select></label>
   <label class="f"><span>高低差 m</span><input type="number" step="0.1" min="0" max="8" value="${numv(U.site.slopeDiff,0)}" oninput="setSlope('${U.site.slopeDir||"north"}',this.value)"></label>
  </div>
  ${(()=>{const si=slopeInfo();
    if(si.diff<0.05)return `<div style="font-size:10.5px;color:var(--mut);padding:5px 0">ほぼ平坦（高低差 ${si.diff.toFixed(2)}m）</div>`;
    const warn=si.gradeZ>10||si.gradeX>10;
    const caution=si.gradeZ>5||si.gradeX>5;
    const col=warn?"#B0433A":caution?"#C77F1A":"#2E7D5B";
    const bg=warn?"rgba(176,67,58,.07)":caution?"rgba(242,163,60,.09)":"rgba(46,125,91,.07)";
    return `<div style="background:${bg};border:1px solid ${col}33;border-radius:8px;padding:8px 10px;margin-bottom:6px">
      <div style="font-size:12px;font-weight:700;color:${col};margin-bottom:3px">高低差 ${si.diff.toFixed(2)} m</div>
      <table style="font-size:10.5px;line-height:1.7;color:var(--ink)">
       <tr><td style="color:var(--mut);padding-right:8px">前後（道路→奥）</td><td style="font-family:ui-monospace">${si.gradeZ.toFixed(1)}%</td><td style="padding-left:6px;color:var(--mut)">${si.dirZ}</td></tr>
       <tr><td style="color:var(--mut);padding-right:8px">左右</td><td style="font-family:ui-monospace">${si.gradeX.toFixed(1)}%</td><td style="padding-left:6px;color:var(--mut)">${si.dirX}</td></tr>
      </table>
      ${warn?`<div style="font-size:10px;color:${col};margin-top:4px;font-weight:600">⚠ 勾配10%超：造成計画・重機据付面の確保を要検討</div>`:caution?`<div style="font-size:10px;color:${col};margin-top:4px">土工事・擁壁の検討が必要な勾配です</div>`:""}
     </div>`;})()}
  <div style="font-size:11px;font-weight:700;color:var(--mut);margin:6px 0 2px">四隅の地盤高で微調整 m${Array.isArray(U.site.poly)?'<span style="color:var(--mut);font-weight:400">（矩形のみ）</span>':''}</div>
  ${SL("前面・左",U.site.h[0],"(v)=>SH(0,v)",-4,4,0.1)}
  ${SL("前面・右",U.site.h[1],"(v)=>SH(1,v)",-4,4,0.1)}
  ${SL("奥・左",U.site.h[2],"(v)=>SH(2,v)",-4,4,0.1)}
  ${SL("奥・右",U.site.h[3],"(v)=>SH(3,v)",-4,4,0.1)}`;
  // ④ 道路・歩道・側道
  let secRoad=`${CK("道路を表示する",U.road.show!==false,"(v)=>S('road.show',v)")}
  <div style="font-size:10px;color:var(--mut);margin:-2px 0 8px">地図や図面を下敷きにして道路もそこに写っている場合は、オフにすると重なりません。</div>
  ${SL("前面道路 幅員 m",U.road.w,"(v)=>S('road.w',v)",4,20,0.5)}
  ${SL("道路の傾斜（左→右の高低差 m）",U.road.slope,"(v)=>S('road.slope',v)",-3,3,0.1)}
  ${(()=>{const rs=numv(U.road.slope,0);if(Math.abs(rs)<0.05)return `<div style="font-size:10px;color:var(--mut);margin:-2px 0 6px">道路は水平です。坂道の場合は上のスライダーで高低差を設定。</div>`;
    const len=posv(U.site.w,25)+10;const grade=Math.abs(rs)/len*100;
    return `<div style="font-size:10.5px;color:${grade>8?"#B0433A":"#2552A0"};margin:-2px 0 6px;font-weight:600">道路勾配 約${grade.toFixed(1)}%（${rs>0?"右":"左"}が高い）${grade>8?" ⚠ 生コン車・重機の据付に注意":""}</div>`;})()}
  <label class="f"><span>側道</span><select onchange="S('road.side',this.value)"><option value="none" ${U.road.side==="none"?"selected":""}>なし</option><option value="left" ${U.road.side==="left"?"selected":""}>左側</option><option value="right" ${U.road.side==="right"?"selected":""}>右側</option></select></label>
  <div style="font-size:11px;font-weight:700;color:var(--mut);margin:8px 0 2px">道路パーツの個別調整（3Dでドラッグも可）</div>
  ${SL("道路全体 前後",U.road.dz,"(v)=>S('road.dz',v)",-30,30,0.5)}
  ${SL("道路全体 左右",U.road.dx,"(v)=>S('road.dx',v)",-30,30,0.5)}
  ${SL("道路 回転 °",U.road.ry,"(v)=>S('road.ry',v)",0,360,5)}
  ${SL("前面歩道 前後オフセット",U.road.walkDz,"(v)=>S('road.walkDz',v)",-10,10,0.5)}
  ${SL("前面歩道 幅 m",U.road.walkW,"(v)=>S('road.walkW',v)",0.5,6,0.5)}
  ${U.road.side!=="none"?SL("側道 前後オフセット",U.road.sideDz,"(v)=>S('road.sideDz',v)",-20,20,0.5)+SL("側道 左右オフセット",U.road.sideDx,"(v)=>S('road.sideDx',v)",-20,20,0.5):""}
  <div style="font-size:11px;font-weight:700;color:var(--mut);margin:8px 0 2px">電柱</div>
  ${SL("電柱 本数",U.poles.n,"(v)=>S('poles.n',v)",0,8,1)}
  ${SL("電柱 間隔 m",U.poles.pitch,"(v)=>S('poles.pitch',v)",8,40,1)}
  ${CK("電柱を道路の向こう側に",U.poles.far,"(v)=>S('poles.far',v)")}
  <div class="hint">3Dビュー上で車道・歩道・側道それぞれを<b>直接ドラッグ</b>でも動かせます（車道はCtrl＋ドラッグで回転）。</div>`;
  // ⑤ 斜線制限
  let secSlant=`${CK("道路斜線・隣地斜線ガイドを表示",U.guide.show,"(v)=>S('guide.show',v)")}
  ${U.guide.show?`${SL("道路斜線 勾配",U.guide.road,"(v)=>S('guide.road',v)",1,2,0.05)}${SL("隣地斜線 勾配",U.guide.nbor,"(v)=>S('guide.nbor',v)",1,2.5,0.05)}<div class="hint">橙の半透明面が斜線制限の目安です。建物がこの面を突き抜けていないか視覚確認できます（簡易表示・正式判定は設計でご確認ください）。住居系1.25・商業系1.5が目安。</div>`:""}`;
  // ⑥ 日影
  let secSun=`${SL("太陽の方位 °（0=北 90=東 180=南）",U.sun.az,"(v)=>S('sun.az',v)",0,360,5)}
  ${SL("太陽高度 °",U.sun.alt,"(v)=>S('sun.alt',v)",8,85,1)}
  <div class="hint">影の落ち方で近隣への日影影響をざっくり確認できます。</div>`;

  // ⑦ 前面道路での施工計画の検討（縦列収まり・残車道幅・道路使用条件）
  const rwc=roadworkCalc();
  const mt=COBJ_TYPES.mixer, pt=COBJ_TYPES.pump;
  const ok=(b)=>b?'<span style="color:#2E7D5B;font-weight:700">○</span>':'<span style="color:#B0433A;font-weight:700">×</span>';
  const judge=(label,val,good)=>`<div style="display:flex;justify-content:space-between;font-size:11.5px;padding:3px 0"><span style="color:var(--mut)">${label}</span><span style="font-family:ui-monospace">${val} ${good==null?"":ok(good)}</span></div>`;
  let secWork=`<div style="font-size:10.5px;color:var(--mut);margin-bottom:4px">生コン車とポンプ車を前面に配置する際の収まりを概算チェックします。</div>
  <div class="grid2">
   <label class="f"><span>生コン車</span><select onchange="S('roadwork.mixerSize',this.value,false);renderPanel()">${mt.sizes.map(s=>`<option value="${s.key}" ${U.roadwork.mixerSize===s.key?"selected":""}>${s.label}（${s.w}×${s.d}m）</option>`).join("")}</select></label>
   <label class="f"><span>ポンプ車</span><select onchange="S('roadwork.pumpSize',this.value,false);renderPanel()">${pt.sizes.map(s=>`<option value="${s.key}" ${U.roadwork.pumpSize===s.key?"selected":""}>${s.label}（${s.w}×${s.d}m）</option>`).join("")}</select></label>
  </div>
  <div style="background:#f3f5f8;border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin:6px 0">
   <div style="font-size:10.5px;font-weight:700;color:var(--navy);margin-bottom:3px">縦列配置（前後に2台）</div>
   ${judge("必要な縦列長",rwc.lineLen+" m",null)}
   ${judge("敷地間口 "+rwc.front+"m に収まる",rwc.fitFront==null?"—":(rwc.fitFront?"収まる":"はみ出す"),rwc.fitFront)}
  </div>
  ${SL("歩道へ乗り上げる幅 m",U.roadwork.mountUp,"(v)=>{S('roadwork.mountUp',v,false);renderPanel()}",0,3,0.5)}
  <div style="background:#f3f5f8;border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin:6px 0">
   <div style="font-size:10.5px;font-weight:700;color:var(--navy);margin-bottom:3px">乗り上げ時の残り車道幅（幅員${rwc.roadW}m）</div>
   ${judge("車道側の占有幅",rwc.occupy+" m",null)}
   ${judge("残る車道幅",rwc.remain+" m",null)}
   ${judge("緊急車両 通行可（4m基準）",rwc.emgOK?"確保":"不足",rwc.emgOK)}
   ${judge("一般車 すれ違い（3m目安）",rwc.passOK?"可能":"困難",rwc.passOK)}
  </div>
  <div class="hint">概算チェックです。実際の可否は道路管理者・所轄警察の判断によります。車間2m・横間隔0.5mで計算。</div>
  <div style="font-size:11px;font-weight:700;color:var(--mut);margin:8px 0 3px">道路使用条件メモ（窓口で条件が異なります）</div>
  <label class="f"><span>所轄警察署（道路使用許可）</span><textarea rows="2" style="resize:vertical;font-family:inherit;font-size:11.5px" placeholder="例：作業時間9-17時、ガードマン2名、片側交互通行…" oninput="S('roadwork.permitPolice',this.value,false)">${(U.roadwork.permitPolice||"").replace(/</g,"&lt;")}</textarea></label>
  <label class="f"><span>道路管理者（道路占用許可）</span><textarea rows="2" style="resize:vertical;font-family:inherit;font-size:11.5px" placeholder="例：占用範囲、復旧条件、歩道養生…" oninput="S('roadwork.permitRoad',this.value,false)">${(U.roadwork.permitRoad||"").replace(/</g,"&lt;")}</textarea></label>
  <label class="f"><span>建設事務所・その他</span><textarea rows="2" style="resize:vertical;font-family:inherit;font-size:11.5px" placeholder="例：協議事項、近隣条件、搬入経路指定…" oninput="S('roadwork.permitOffice',this.value,false)">${(U.roadwork.permitOffice||"").replace(/</g,"&lt;")}</textarea></label>`;
  // 地図リンク（APIキー不要・別タブでGoogleマップを開く）
  if(U.p.addr){
   const ga=encodeURIComponent(U.p.addr);
   secWork+=`<div style="font-size:11px;font-weight:700;color:var(--mut);margin:8px 0 3px">周辺地図（別タブで開く）</div>
   <div style="display:flex;flex-direction:column;gap:4px">
    <a href="https://www.google.com/maps/search/?api=1&query=${ga}" target="_blank" rel="noopener" style="font-size:11.5px;color:#2552A0">🗺 Googleマップで計画地を開く（周辺確認）</a>
    <a href="https://www.google.com/maps/dir/?api=1&destination=${ga}" target="_blank" rel="noopener" style="font-size:11.5px;color:#2552A0">🚚 計画地への搬入ルートを調べる</a>
   </div>
   <div class="hint">地図はGoogleマップを別タブで開きます（このアプリには地図データを取り込みません）。ズームやストリートビューで前面道路・周辺状況を確認できます。</div>`;
  }else{
   secWork+=`<div class="hint" style="margin-top:8px">「諸元」タブまたは上の「計画地」に住所を入れると、周辺地図リンクが表示されます。</div>`;
  }

  h = SEC("計画地・公共データ照会", secGeo, {key:"site-geo", icon:"📍", open:false})
    + SEC("敷地 寸法・形状", secSite, {key:"site-dim", icon:"📐", open:true})
    + SEC("敷地 位置・地盤・高低差", secPos, {key:"site-pos", icon:"⛰", open:false})
    + SEC("道路・歩道・電柱", secRoad, {key:"site-road", icon:"🛣", open:true})
    + SEC("前面道路での施工計画の検討", secWork, {key:"site-work", icon:"🚧", open:false})
    + SEC("斜線制限ガイド", secSlant, {key:"site-slant", icon:"📏", open:false})
    + SEC("日当たり・日影検討", secSun, {key:"site-sun", icon:"☀", open:false});
 }
 if(U.tab==="下敷き"){
  h=`<div class="hint" style="margin:0 0 8px">配置図・設計概要図の<b>PDFまたは画像</b>を敷地に下敷き表示。視点「真上(配置)」で縮尺と位置を合わせ、ブロックを重ねます。</div>
  <input type="file" accept="application/pdf,image/*" style="font-size:11px;width:100%;margin-bottom:8px" onchange="loadUnderFile(this.files[0])">
  <div style="background:rgba(46,111,190,.06);border:1px solid rgba(46,111,190,.25);border-radius:10px;padding:9px 11px;margin-bottom:8px">
   <div style="font-size:11px;font-weight:700;color:#2552A0;margin-bottom:4px">🗺 国（国土地理院）の地図を自動で敷く</div>
   ${(U.geo.lat!=null)
     ? `<div style="font-size:10.5px;color:var(--mut);line-height:1.6;margin-bottom:6px">検索済み地点：${U.geo.name||""}<br>この周辺の地図を自動取得して下敷きにします。</div>
        <div class="grid2" style="margin-bottom:6px">
         <label class="f"><span>地図種類</span><select onchange="setGsiKind(this.value)">${Object.keys(GSI_TILES).map(k=>`<option value="${k}" ${(U.under.gsiKind||"std")===k?"selected":""}>${GSI_TILES[k].label}</option>`).join("")}</select></label>
         <label class="f"><span>詳しさ(14-18)</span><input type="number" min="14" max="18" value="${U.under.gsiZoom||17}" oninput="setGsiZoom(this.value)"></label>
        </div>
        <button class="btn primary" style="width:100%;font-size:12px" onclick="loadGsiMap()">この地点の地図を取得して敷く</button>`
     : `<div style="font-size:10.5px;color:var(--mut);line-height:1.7;margin-bottom:6px">まず「敷地・地形」タブで<b>住所を検索</b>すると、その地点の地図をここで自動取得できます。</div>
        <button class="btn" style="width:100%;font-size:11.5px" onclick="U.tabGroup='敷地・環境';U.tab='敷地・地形';renderBar();renderPanel()">→ 敷地・地形タブへ（住所検索）</button>`}
   ${U.under.gsiStatus?`<div style="font-size:10px;color:#2552A0;white-space:pre-line;margin-top:6px;line-height:1.6">${U.under.gsiStatus}</div>`:""}
   <div style="font-size:9.5px;color:var(--mut);margin-top:6px;border-top:1px solid rgba(46,111,190,.15);padding-top:5px">出典：国土地理院（<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener" style="color:#2552A0">地理院タイル一覧</a>）。地図を含む資料には出典明記が必要です。手動で範囲を選びたい場合は <a href="#" onclick="openGsiMap();return false" style="color:#2552A0">地図を別タブで開く</a>。</div>
  </div>
  ${U.under.raw?`<button class="addbtn" style="margin-bottom:8px" onclick="parsePdfSummary()">📄 設計概要を自動読取（β）→ 諸元へ反映</button>`:""}
  ${U.under.pages>1?`<label class="f"><span>PDFページ（全${U.under.pages}p）</span><input type="number" min="1" max="${U.under.pages}" value="${U.under.page}" oninput="setPage(this.value)"></label>`:""}
  ${CK("下敷きを表示",U.under.show,"(v)=>S('under.show',v)")}
  <div style="border-top:1px solid var(--line);margin:8px 0 4px"></div>
  <div style="font-size:11px;font-weight:700;color:var(--mut);margin-bottom:3px">キャリブレーション（正確な縮尺合わせ）</div>
  ${U.calib.on
    ? `<div style="background:#EEF3FA;border:1.5px dashed #2552A0;border-radius:8px;padding:8px 10px;font-size:11.5px;line-height:1.7"><b>スケール補正モード中</b><br>下絵上の「実寸が分かる2点」（例：通り芯間や既知の寸法線の端点）をクリックすると、実際の距離を入力する画面が出ます。<br>${U.calib.a?"1点目を取得。2点目をクリック…":"1点目をクリック…"}<br><button class="btn" style="margin-top:6px;color:#B0433A" onclick="U.calib.on=false;U.calib.a=null;U.calib.b=null;rebuild();renderPanel()">中止</button></div>`
    : `<button class="addbtn" onclick="U.calib.on=true;U.calib.a=null;U.calib.b=null;renderPanel()">📐 2点で実寸を指定して縮尺を自動補正</button>`}
  ${SL("図面の幅 = 実寸 m",U.under.width,"(v)=>S('under.width',v)",5,200,0.5)}
  ${SL("回転 °（建物の傾きを軸に合わせる）",U.under.rot,"(v)=>S('under.rot',v)",0,360,1)}
  ${SL("透過度",U.under.opacity,"(v)=>S('under.opacity',v)",0.1,1,0.05)}
  <div class="hint">図面はドラッグで位置合わせ。スケール補正→回転→位置の順に合わせると正確になぞれます。PDFは1ページ目から表示（ページ指定可）。</div>`;
 }
 if(U.tab==="近隣"){
  h=`<div class="hint" style="margin:0 0 8px">該当住所の<b>Googleマップ航空写真のスクリーンショット</b>を読み込み、広域の下敷きにします（社内検討用・出典明記）。距離ツールで測った幅を「写真の幅」に入れると縮尺が合います。</div>
  <input type="file" accept="image/*" style="font-size:11px;width:100%;margin-bottom:8px" onchange="loadPhotoFile(this.files[0])">
  ${CK("周辺写真を表示",U.photo.show,"(v)=>S('photo.show',v)")}
  ${SL("写真の幅 = 実寸 m",U.photo.width,"(v)=>S('photo.width',v)",30,600,5)}
  ${SL("回転 °",U.photo.rot,"(v)=>S('photo.rot',v)",-180,180,1)}
  ${SL("透過度",U.photo.opacity,"(v)=>S('photo.opacity',v)",0.1,1,0.05)}
  <div style="border-top:1px solid var(--line);margin:8px 0"></div>
  <div style="font-size:11px;font-weight:700;color:var(--mut);margin-bottom:4px">近隣建物ボリューム（ドラッグで配置）</div>
  ${U.nbs.map((n,i)=>`<div class="card"><div style="display:flex;justify-content:space-between"><b style="font-size:12px">近隣 ${i+1}</b><button class="del" onclick="delN(${i})">削除</button></div>
   <div class="grid3">
    <label class="f"><span>間口m</span><input type="number" value="${n.w}" oninput="SN(${i},'w',this.value)"></label>
    <label class="f"><span>奥行m</span><input type="number" value="${n.d}" oninput="SN(${i},'d',this.value)"></label>
    <label class="f"><span>高さm</span><input type="number" value="${n.h}" oninput="SN(${i},'h',this.value)"></label>
   </div></div>`).join("")}
  <button class="addbtn" onclick="addN()">＋ 近隣建物を追加</button>
  <div class="hint">写真の上に近隣ボリュームを置けば、日当たり・見え方・揚重範囲の近隣説明に使えます。ドラッグ＝移動／Ctrl＋ドラッグ＝回転。</div>`;
 }
 if(U.tab==="仮設"){
  h=`<div style="display:flex;gap:5px;margin-bottom:9px">
   <button class="btn ${U.tw.mode==="plan"?"active":""}" style="flex:1;padding:7px 4px;font-size:11px" onclick="setMode('plan')">完成</button>
   <button class="btn ${U.tw.mode==="demo"?"active":""}" style="flex:1;padding:7px 4px;font-size:11px" onclick="setMode('demo')">既存解体</button>
   <button class="btn ${U.tw.mode==="build"?"active":""}" style="flex:1;padding:7px 4px;font-size:11px" onclick="setMode('build')">施工中</button></div>`;
  if(U.tw.mode==="plan"){
   const secPlanFence = CK("仮囲いを表示（完成イメージにも重ねる）",U.tw.fenceAll,"(v)=>S('tw.fenceAll',v)")
    +(U.tw.fenceAll?`<div style="padding-left:10px">
       ${SL("パネル高さ m",U.tw.fenceH,"(v)=>S('tw.fenceH',v)",2,8,0.5)}
       <label class="f"><span>ゲート（出入口）位置</span><select onchange="S('tw.fenceGate',this.value)">
         <option value="front" ${U.tw.fenceGate==="front"?"selected":""}>前面（道路側）</option>
         <option value="left" ${U.tw.fenceGate==="left"?"selected":""}>左側</option>
         <option value="right" ${U.tw.fenceGate==="right"?"selected":""}>右側</option>
         <option value="none" ${U.tw.fenceGate==="none"?"selected":""}>開口なし（全周閉鎖）</option>
       </select></label></div>`:"")
    +`<div class="hint">完成パースは通常そのまま見せますが、近隣説明で「工事中の囲い」を見せたい時に使えます。重機・足場は「施工中」モードで。</div>`;
   h += SEC("仮囲い（任意）", secPlanFence, {key:"tw-planfence", icon:"🚧", open:false});
  }
  if(U.tw.mode==="demo"){
   h+=`<div class="hint" style="margin:0 0 8px">解体予定の既存建物（赤×印）を表示。重機をドラッグ配置して解体計画を検討できます。新築ボリュームは非表示になります。</div>`
   +`<div style="font-size:11px;font-weight:700;color:var(--mut);margin:4px 0 2px">既存建物（解体予定）</div>`
   +`<div class="grid3">
     <label class="f"><span>間口 m</span><input type="number" step="0.5" value="${U.demo.w}" oninput="S('demo.w',this.value)"></label>
     <label class="f"><span>奥行 m</span><input type="number" step="0.5" value="${U.demo.d}" oninput="S('demo.d',this.value)"></label>
     <label class="f"><span>高さ m</span><input type="number" step="0.5" value="${U.demo.h}" oninput="S('demo.h',this.value)"></label>
    </div>`
   +`<div style="border-top:1px solid var(--line);margin:8px 0"></div>`
   +CK("ラフタークレーン（ドラッグ可）",U.tw.rough,"(v)=>S('tw.rough',v)")
   +CK("仮囲い（ゲート付き）",U.tw.fence,"(v)=>S('tw.fence',v)")
   +CK("生コン車／ダンプ（ドラッグ可）",U.tw.mixer,"(v)=>S('tw.mixer',v)")
   +`<div class="hint">Ctrl＋ドラッグで重機の向きを回転できます。</div>`;
  }
  else if(U.tw.mode==="build"){
   const secCrane = SL("躯体の進捗（〜階）",U.tw.step,"(v)=>S('tw.step',v)",1,Math.max(1,Math.round(posv(U.p.floors,14))),1)
    +CK("タワークレーン（ドラッグ移動可）",U.tw.crane,"(v)=>S('tw.crane',v)")
    +(U.tw.crane?`<div style="padding-left:10px"><label class="f"><span>機種（カタログ仕様）</span><select onchange="S('tw.craneModel',this.value)">${Object.keys(CRANE_SPECS).map(k=>`<option value="${k}" ${U.tw.craneModel===k?"selected":""}>${CRANE_SPECS[k].label}</option>`).join("")}</select></label><div style="font-size:10px;color:#2552A0;margin:-2px 0 4px">作業半径 ${craneSpec(U.tw.craneModel).work}m ／ 定格 ${craneSpec(U.tw.craneModel).cap}t ／ 尾部 ${craneSpec(U.tw.craneModel).tail}m</div>${SL("旋回 °",U.tw.craneRot,"(v)=>S('tw.craneRot',v)",0,360,5)}${CK("作業半径・尾部旋回の円",U.tw.radius,"(v)=>S('tw.radius',v)")}</div>`:"")
    +CK("ラフタークレーン（ドラッグ可）",U.tw.rough,"(v)=>S('tw.rough',v)");
   const secFence = CK("仮囲いを表示",U.tw.fence,"(v)=>S('tw.fence',v)")
    +(U.tw.fence?`<div style="padding-left:10px">
       ${SL("パネル高さ m",U.tw.fenceH,"(v)=>S('tw.fenceH',v)",2,8,0.5)}
       <label class="f"><span>ゲート（出入口）位置</span><select onchange="S('tw.fenceGate',this.value)">
         <option value="front" ${U.tw.fenceGate==="front"?"selected":""}>前面（道路側）</option>
         <option value="left" ${U.tw.fenceGate==="left"?"selected":""}>左側</option>
         <option value="right" ${U.tw.fenceGate==="right"?"selected":""}>右側</option>
         <option value="none" ${U.tw.fenceGate==="none"?"selected":""}>開口なし（全周閉鎖）</option>
       </select></label>
       <div style="font-size:10.5px;font-weight:700;color:var(--mut);margin:6px 0 2px">図面に合わせる（3Dで直接ドラッグ／Ctrl＋ドラッグ回転も可）</div>
       ${SL("囲い 間口 m（0=敷地に合わせる）",U.tw.fenceW,"(v)=>S('tw.fenceW',v)",0,60,0.5)}
       ${SL("囲い 奥行 m（0=敷地に合わせる）",U.tw.fenceD,"(v)=>S('tw.fenceD',v)",0,60,0.5)}
       ${SL("位置 左右",U.tw.fenceDx,"(v)=>S('tw.fenceDx',v)",-30,30,0.5)}
       ${SL("位置 前後",U.tw.fenceDz,"(v)=>S('tw.fenceDz',v)",-30,30,0.5)}
       ${SL("回転 °",U.tw.fenceRy,"(v)=>S('tw.fenceRy',v)",0,360,5)}
       <button class="btn" style="width:100%;margin-top:4px;font-size:11px;color:#B0433A" onclick="U.tw.fenceW=0;U.tw.fenceD=0;U.tw.fenceDx=0;U.tw.fenceDz=0;U.tw.fenceRy=0;rebuild();renderPanel()">↺ 仮囲いを敷地基準にリセット</button>
       </div>`:"")
    +CK("外部足場＋養生シート",U.tw.scaffold,"(v)=>S('tw.scaffold',v)");
   const secVeh = CK("ロングスパンEV（ドラッグ可）",U.tw.ev,"(v)=>S('tw.ev',v)")
    +CK("生コン車（ドラッグ可）",U.tw.mixer,"(v)=>S('tw.mixer',v)")
    +`<div class="hint">出入口・詰所・資材置場などは「施工/CAD」タブの施工オブジェクト（仮囲いゲート・警備員ほか）をドラッグ配置できます。</div>`;
   h += SEC("揚重・クレーン", secCrane, {key:"tw-crane", icon:"🏗", open:true})
      + SEC("仮囲い・足場", secFence, {key:"tw-fence", icon:"🚧", open:true})
      + SEC("車両・その他", secVeh, {key:"tw-veh", icon:"🚚", open:false});
  }
  h+=CK("電柱・架線（前面道路）",U.tw.poles,"(v)=>S('tw.poles',v)")
  +`<div class="hint">ドラッグ＝移動／<b>Ctrl＋ドラッグ＝向き回転</b>。作業半径円で揚重範囲を確認できます。</div>`;
 }
 if(U.tab==="施工/CAD"){
  // 施工オブジェクトを追加（カテゴリ別に整理して選びやすく）
  const COBJ_CATS=[
    {name:"🏗 重機・クレーン", keys:["rough","backhoe","found"]},
    {name:"🚚 車両", keys:["mixer","pump","truck"]},
    {name:"🚧 仮設・人員", keys:["temp","guard","walkzone"]},
    {name:"⚠ 支障物", keys:["obstacle"]},
  ];
  h=`<div style="font-size:11px;font-weight:700;color:var(--mut);margin:0 0 6px">施工オブジェクトを追加</div>`;
  h+=COBJ_CATS.map(cat=>{
    const btns=cat.keys.filter(k=>COBJ_TYPES[k]).map(k=>`<button class="btn" style="font-size:10.5px;padding:6px 8px" onclick="addCO('${k}')">＋${COBJ_TYPES[k].label}</button>`).join("");
    return `<div style="margin-bottom:7px"><div style="font-size:10px;color:var(--mut);font-weight:600;margin-bottom:3px">${cat.name}</div><div style="display:flex;flex-wrap:wrap;gap:5px">${btns}</div></div>`;
  }).join("");
  h+=`<div style="border-top:1px solid var(--hair);margin:8px 0"></div>`;
  if(U.cobj.length){h+=`<div style="font-size:11px;font-weight:700;color:var(--mut);margin-bottom:5px">配置済み（${U.cobj.length}）</div>`+U.cobj.map((c,i)=>{
    const t=COBJ_TYPES[c.type]; const sz=cobjSize(c.type,c.size)||{};
    const seld=(U.sel==="co:"+i);
    const opts=(t&&t.sizes.length>1)?`<select style="padding:4px 6px;font-size:11px;margin:4px 0" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()" onchange="setCOSize(${i},this.value)">${t.sizes.map(s=>`<option value="${s.key}" ${c.size===s.key?"selected":""}>${s.label}（${s.w}×${s.d}m）</option>`).join("")}</select>`:"";
    const guide=[];
    if(sz.out)guide.push(`張出${sz.out}m`); if(sz.tail)guide.push(`尾部旋回${sz.tail}m`); if(sz.work)guide.push(`作業半径${sz.work}m`);
    return `<div class="card" style="${c._warn?'border-color:#D64545;background:#FDF1F1':(seld?'border-color:#F2A33C;background:#FFFBF0':'')}" onclick="selCO(${i})">
    <div style="display:flex;justify-content:space-between;align-items:center">
     <b style="font-size:11.5px">${seld?"▸ ":""}${t?t.label:c.type}${c._warn?' <span style="color:#D64545">⚠歩行帯と干渉</span>':''}</b>
     <button class="del" onclick="event.stopPropagation();delCO(${i})">削除</button></div>
    ${opts}
    ${(c.type==="temp"&&c.size==="asagao")?`<div onclick="event.stopPropagation()">${SL("設置高さ m",numv(c.mountH,4),"(v)=>{U.cobj["+i+"].mountH=v;rebuild()}",2,40,0.5)}</div>`:""}
    <div style="font-size:10px;color:var(--mut);font-family:ui-monospace">基準点 X=${numv(c.x,0).toFixed(1)}m Z=${numv(c.z,0).toFixed(1)}m ${numv(c.ry,0)}°</div>
    ${guide.length?`<div style="font-size:10px;color:#2552A0;margin-top:2px">ガイド: ${guide.join(" / ")}${seld?"（表示中）":"（選択で表示）"}</div>`:""}
   </div>`;}).join("");}
  else h+=`<div class="hint">ボタンで重機・車両・仮設材を配置。<b>クリックで選択</b>すると干渉ガイド（張出・旋回・作業半径）が表示され、サイズも変更できます。ドラッグ＝移動／Ctrl＋ドラッグ＝回転。歩行帯に重機が重なると赤警告します。</div>`;
  h+=`<div style="margin-top:6px">${CK("スナップ（道路・敷鉄板に吸着／15°刻み回転）",U.snap,"(v)=>S('snap',v,false)")}</div>`;
  // 補助ツール（寸法線・グリッド・道路条件・DXF）を折りたたみに集約
  let secTools=`<div style="font-size:10.5px;font-weight:600;color:var(--mut);margin-bottom:3px">寸法線</div>
   ${CK("寸法計測モード（地面を2点クリック）",U.dim.on,"(v)=>{S('dim.on',v,false);if(!v){U.dim.a=null;U.dim.b=null;}rebuild();renderBar();}")}
   ${U._dimDist!=null?`<div style="font-family:ui-monospace;font-size:14px;font-weight:700;color:var(--navy)">距離 = ${U._dimDist.toFixed(2)} m</div>`:(U.dim.on?`<div class="hint">1点目→2点目の順にクリックしてください。</div>`:"")}
   <div style="border-top:1px solid var(--hair);margin:8px 0 6px"></div>
   <div style="font-size:10.5px;font-weight:600;color:var(--mut);margin-bottom:3px">グリッド</div>
   ${CK("グリッド表示",U.grid.show,"(v)=>S('grid.show',v)")}
   ${U.grid.show?SL("グリッド間隔 m",U.grid.size,"(v)=>S('grid.size',v)",0.5,10,0.5):""}
   <div style="border-top:1px solid var(--hair);margin:8px 0 6px"></div>
   <div style="font-size:10.5px;font-weight:600;color:var(--mut);margin-bottom:3px">道路条件（歩行帯・干渉判定）</div>
   ${SL("車道 幅員 m",U.roadcond.lane,"(v)=>{S('roadcond.lane',v,false);S('road.w',v);}",4,20,0.5)}
   ${SL("歩道 幅員 m",U.roadcond.walk,"(v)=>S('roadcond.walk',v)",0,6,0.5)}
   <div class="hint">緑の歩行帯が自動生成され、重機が重なると赤く警告します。</div>
   <div style="border-top:1px solid var(--hair);margin:8px 0 6px"></div>
   <div style="font-size:10.5px;font-weight:600;color:var(--mut);margin-bottom:3px">CAD図面（DXF）読込</div>
   <input type="file" accept=".dxf" style="font-size:11px;width:100%;margin-bottom:6px" onchange="loadDXF(this.files[0])">`;
  if(U.dxf.ents){
   secTools+=SL("スケール（DXF単位→m）",U.dxf.scale,"(v)=>S('dxf.scale',v)",0.0005,0.01,0.0005).replace('ui-monospace">','ui-monospace">×')
   +`<div style="font-size:10px;color:var(--mut);margin-bottom:4px">図面がmm作図なら0.001（1/1000）が目安。位置は右上「表示▾→敷地/下敷き移動モード」ONでドラッグ。</div>
   <div style="font-size:11px;font-weight:700;color:var(--mut);margin:6px 0 3px">レイヤー表示</div>`
   +Object.keys(U.dxf.layers).map(k=>`<label class="chk" style="font-size:11px"><input type="checkbox" ${U.dxf.layers[k].show!==false?"checked":""} onchange="toggleDxfLayer('${k.replace(/'/g,"\\\\'")}',this.checked)">${k}</label>`).join("")
   +`<button class="btn" style="margin-top:6px;color:#B0433A;border:1px solid #E3B5B5" onclick="clearDXF()">DXFをクリア</button>`;
  }else secTools+=`<div class="hint">DXF（LINE/POLYLINE/CIRCLE/ARC）を線画として重ねます。配置図・平面図のトレース下地に。</div>`;
  h+=SEC("補助ツール（寸法・グリッド・道路条件・DXF）", secTools, {key:"cad-tools", icon:"🛠", open:false});
  // 地下の支障物（範囲マーカー）
  h+=`<div style="border-top:1px solid var(--line);margin:10px 0 6px"></div>
   <div style="font-size:11px;font-weight:700;color:var(--mut);margin-bottom:4px">地下の支障物（経路帯・範囲マーカー）</div>
   <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px">`
   +Object.keys(SUBSURFACE_TYPES).map(k=>`<button class="btn" style="font-size:10.5px;padding:6px 7px;border-left:4px solid #${SUBSURFACE_TYPES[k].color.toString(16).padStart(6,"0")}" onclick="addSub('${k}')">＋${SUBSURFACE_TYPES[k].label}</button>`).join("")
   +`</div>`;
  if((U.subsurface||[]).length){h+=U.subsurface.map((s,i)=>{
    const st=SUBSURFACE_TYPES[s.kind]||SUBSURFACE_TYPES.elec; const seld=(U.sel==="sub:"+i);
    return `<div class="card" style="${seld?'border-color:#F2A33C;background:#FFFBF0':''}" onclick="U.sel='sub:${i}';rebuild();renderPanel()">
     <div style="display:flex;justify-content:space-between;align-items:center">
      <b style="font-size:11.5px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#${st.color.toString(16).padStart(6,"0")};margin-right:5px"></span>${st.label}</b>
      <button class="del" onclick="event.stopPropagation();delSub(${i})">削除</button></div>
     <div class="grid2" style="margin-top:4px">
      <label class="f"><span>幅 m</span><input type="number" value="${posv(s.w,3)}" onclick="event.stopPropagation()" oninput="U.subsurface[${i}].w=parseFloat(this.value)||1;rebuild()"></label>
      <label class="f"><span>長さ m</span><input type="number" value="${posv(s.d,14)}" onclick="event.stopPropagation()" oninput="U.subsurface[${i}].d=parseFloat(this.value)||1;rebuild()"></label>
     </div>
     <div style="font-size:10px;color:var(--mut);font-family:ui-monospace">基準点 X=${numv(s.x,0).toFixed(1)} Z=${numv(s.z,0).toFixed(1)} ${numv(s.ry,0)}°</div>
    </div>`;}).join("");
  }else h+=`<div class="hint">現地調査で判明した埋設物の<b>おおよその経路・範囲</b>を色帯で配置できます。ドラッグ＝移動／Ctrl＋ドラッグ＝回転。幅・長さで帯の大きさを調整。<b>あくまで参考表示で、正確な位置は各管理者への照会が必要です。</b></div>`;
  // 注記（地面貼り付け：範囲・文字）
  h+=`<div style="border-top:1px solid var(--line);margin:12px 0 6px"></div>
   <div style="font-size:11px;font-weight:700;color:var(--mut);margin-bottom:4px">注記（図に書き込む・OJT/申し送り用）</div>
   <div style="display:flex;gap:6px;margin-bottom:6px">
    <button class="btn" style="flex:1;border:1.5px solid var(--amber)" onclick="addAnnotZone()">＋ 範囲で囲う</button>
    <button class="btn" style="flex:1;border:1.5px solid var(--amber)" onclick="addAnnotText()">＋ 文字を置く</button>
   </div>`;
  if((U.annot||[]).length){h+=U.annot.map((a,i)=>{
    const seld=(U.sel==="an:"+i); const hex="#"+annotColor(a.color).toString(16).padStart(6,"0");
    const colorSel=`<select onclick="event.stopPropagation()" onchange="U.annot[${i}].color=this.value;rebuild();renderPanel()" style="font-size:11px">${ANNOT_COLORS.map(c=>`<option value="${c.key}" ${a.color===c.key?"selected":""}>${c.label}</option>`).join("")}</select>`;
    return `<div class="card" style="${seld?'border-color:#F2A33C;background:#FFFBF0':''}" onclick="U.sel='an:${i}';rebuild();renderPanel()">
     <div style="display:flex;justify-content:space-between;align-items:center">
      <b style="font-size:11.5px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${hex};margin-right:5px"></span>${a.type==="zone"?"範囲マーカー":"文字：「"+(a.text||"").slice(0,10)+"」"}</b>
      <button class="del" onclick="event.stopPropagation();delAnnot(${i})">削除</button></div>
     <label class="f" style="margin-top:4px"><span>色</span>${colorSel}</label>
     ${a.type==="zone"
       ? `<div class="grid2"><label class="f"><span>幅 m</span><input type="number" value="${posv(a.w,6)}" onclick="event.stopPropagation()" oninput="U.annot[${i}].w=parseFloat(this.value)||1;rebuild()"></label><label class="f"><span>奥行 m</span><input type="number" value="${posv(a.d,6)}" onclick="event.stopPropagation()" oninput="U.annot[${i}].d=parseFloat(this.value)||1;rebuild()"></label></div>`
       : `<button class="btn" style="width:100%;margin-bottom:4px" onclick="event.stopPropagation();editAnnotText(${i})">✎ 文字を編集</button><label class="f"><span>文字サイズ m</span><input type="number" step="0.5" value="${posv(a.fsize,2.5)}" onclick="event.stopPropagation()" oninput="U.annot[${i}].fsize=parseFloat(this.value)||2;rebuild()"></label>`}
     <div style="font-size:10px;color:var(--mut);font-family:ui-monospace">X=${numv(a.x,0).toFixed(1)} Z=${numv(a.z,0).toFixed(1)} ${numv(a.ry,0)}°</div>
    </div>`;}).join("");
  }else h+=`<div class="hint">検討意図や注意点を図に直接書き込めます。<b>範囲で囲う</b>＝色枠でエリアを強調、<b>文字を置く</b>＝任意位置にラベル。地面に貼り付くので視点を回しても位置が保たれ、PNG出力にも写ります。ドラッグ＝移動／Ctrl＋ドラッグ＝回転。<b>OJTでの申し送りや、なぜこの配置かの説明に。</b></div>`;
 }
 h+=ojtSection(U.tab);
 $("#body").innerHTML=h;
}
// ───── 検討判定HUD（左下）：OK/注意/NGを3D画面上に常時表示 ─────
// 判定項目を集約（検討シート出力でも共用）
function collectChecks(){
 const out=[];
 // 1) 道路使用（生コン車＋ポンプ車）
 try{const r=roadworkCalc();
  out.push({cat:"道路使用",label:"縦列（ミキサー+ポンプ）",val:`必要${r.lineLen}m / 間口${r.front}m`,lv:r.fitFront===null?"na":(r.fitFront?"ok":"ng"),
    note:r.fitFront?"間口内に収まる":"間口に収まらない→分割搬入・横並び検討"});
  out.push({cat:"道路使用",label:"残車道幅",val:`${r.remain}m（道路${r.roadW}m）`,lv:r.emgOK?"ok":(r.passOK?"warn":"ng"),
    note:r.emgOK?"緊急車両4m確保":(r.passOK?"すれ違い3m可・緊急車両4m未満":"3m未満→片側交互通行・道路使用許可要")});
 }catch(e){}
 // 2) 敷地勾配
 try{const si=slopeInfo();const g=Math.max(si.gradeZ,si.gradeX);
  if(si.diff>=0.05)out.push({cat:"地形",label:"敷地勾配",val:`高低差${si.diff.toFixed(2)}m / ${g.toFixed(1)}%`,lv:g>10?"ng":(g>5?"warn":"ok"),
    note:g>10?"造成計画・重機据付面の確保":(g>5?"土工事・擁壁の検討":"問題なし")});
  const rs=Math.abs(numv(U.road.slope,0));if(rs>=0.05){const rg=rs/(posv(U.site.w,25)+10)*100;
    out.push({cat:"地形",label:"道路勾配",val:`${rg.toFixed(1)}%`,lv:rg>8?"warn":"ok",note:rg>8?"生コン車・重機の据付に注意":"問題なし"});}
 }catch(e){}
 // 3) 歩行帯干渉
 const nWarn=(U.cobj||[]).filter(c=>c._warn).length;
 if((U.cobj||[]).length)out.push({cat:"施工",label:"歩行帯との干渉",val:nWarn?`${nWarn}台が干渉`:"干渉なし",lv:nWarn?"ng":"ok",note:nWarn?"配置変更または歩行者誘導計画":"問題なし"});
 // 4) 法規（建蔽率・容積率：目安値と比較）
 try{const site=posv(U.p.siteArea,0)||siteArea();const st=U._stats||{floorArea:0};
  const tFloor=posv(U.p.tArea,0)||st.floorArea;
  let bcArea=posv(U.p.bldgArea,0);
  if(!bcArea){U.blocks.forEach(b=>{if(Math.max(1,Math.round(posv(b.f1,1)))===1)bcArea+=posv(b.w,10)*posv(b.d,10);});}
  if(site>0){const bcr=bcArea/site*100,far=tFloor/site*100;
   out.push({cat:"法規",label:"建蔽率",val:`${bcr.toFixed(0)}%`,lv:bcr>80?"ng":(bcr>60?"warn":"ok"),note:bcr>60?"用途地域の限度を確認":"目安内"});
   out.push({cat:"法規",label:"容積率",val:`${far.toFixed(0)}%`,lv:far>500?"ng":(far>300?"warn":"ok"),note:far>500?"用途地域の限度を超える可能性大":(far>300?"用途地域の限度を確認":"目安内")});}
 }catch(e){}
 return out;
}
window.collectChecks=collectChecks;
function renderHUD(){
 let el=document.getElementById("hud");
 if(!el){
  // 右下スタック（HUDを上・タイトルカードを下に積む）
  let st=document.getElementById("br-stack");
  if(!st){st=document.createElement("div");st.id="br-stack";document.body.appendChild(st);const t=document.getElementById("title");if(t)st.appendChild(t);}
  el=document.createElement("div");el.id="hud";st.insertBefore(el,st.firstChild);
 }
 if(U.tw.mode==="demo"){el.style.display="none";return;}
 el.style.display="";
 const cs=collectChecks();
 const ico={ok:"●",warn:"▲",ng:"✕",na:"－"};
 const cls={ok:"ok",warn:"warn",ng:"ng",na:"na"};
 const nNg=cs.filter(c=>c.lv==="ng").length,nW=cs.filter(c=>c.lv==="warn").length;
 const head=nNg?`<span class="ng">要検討 ${nNg}件</span>`:(nW?`<span class="warn">注意 ${nW}件</span>`:`<span class="ok">判定OK</span>`);
 el.innerHTML=`<div class="hud-h"><span>検討判定</span>${head}<span id="hud-toggle" title="折りたたむ">${U._hudMin?"＋":"－"}</span></div>
  ${U._hudMin?"":`<div class="hud-b">${cs.map(c=>`<div class="hud-row ${cls[c.lv]}" title="${c.note}"><span class="hud-i">${ico[c.lv]}</span><span class="hud-l">${c.label}</span><span class="hud-v">${c.val}</span></div>`).join("")}
  <div class="hud-f">目安判定です。正式な可否は関係機関・法規で確認</div></div>`}`;
 const t=document.getElementById("hud-toggle");if(t)t.onclick=()=>{U._hudMin=!U._hudMin;renderHUD();};
}
window.renderHUD=renderHUD;
function renderTitle(){
 renderHUD();
 const modeLabel={build:`仮設計画イメージ（${Math.min(U.p.floors,U.tw.step)}階 躯体時）`,demo:"既存解体フェーズ ― 重機配置検討",plan:"BimGen ― 営業概算BIM"}[U.tw.mode]||"BimGen";
 const st=U._stats||{floorArea:0,maxFloors:0};
 // 敷地面積・建築面積は実測値（諸元入力）を優先、空欄なら形状から算出
 const site = posv(U.p.siteArea,0) || siteArea();
 let bcArea = posv(U.p.bldgArea,0);
 if(!bcArea){ U.blocks.forEach(b=>{const f1=Math.max(1,Math.round(posv(b.f1,1)));if(f1===1){const W=posv(b.w,Math.sqrt(posv(b.area,200)*posv(b.ratio,1.5)));const D=posv(b.d,Math.sqrt(posv(b.area,200)/posv(b.ratio,1.5)));bcArea+=W*D;}}); }
 // 延床は実測値（諸元）を優先、空欄なら形状概算
 const tFloor = posv(U.p.tArea,0) || st.floorArea;
 const far=site>0?(tFloor/site*100):0, bcr=site>0?(bcArea/site*100):0;
 const barColor=(v,limit)=>v>limit?"#B0433A":"#2E7D5B";
 // 追加指標
 const prA=posv(U.p.privArea,0), un=Math.round(posv(U.p.units,0)), consA=posv(U.p.consArea,0);
 const effRate = tFloor>0&&prA>0 ? (prA/tFloor*100) : null;
 const perUnit = un>0&&prA>0 ? (prA/un) : null;
 const row=(label,val)=>`<div style="display:flex;justify-content:space-between"><span style="color:var(--mut);font-size:10px">${label}</span><b style="font-family:ui-monospace;font-size:11px">${val}</b></div>`;
 const rowC=(label,val,col)=>`<div style="display:flex;justify-content:space-between"><span style="color:var(--mut);font-size:10px">${label}</span><b style="font-family:ui-monospace;font-size:11px;color:${col}">${val}</b></div>`;
 const extra =
   (consA>0?row("施工床面積",consA.toFixed(0)+" m²"):"")
   +(prA>0?row("専有面積",prA.toFixed(0)+" m²"):"")
   +(effRate!=null?row("専有率",effRate.toFixed(1)+" %"):"")
   +(un>0?row("戸数・室数",un+" 戸"):"")
   +(perUnit!=null?row("戸あたり専有",perUnit.toFixed(1)+" m²"):"");
 const dash=U.tw.mode==="demo"?"":`<div style="margin-top:6px;border-top:1px dashed var(--line);padding-top:5px">
   ${row("延床面積"+(posv(U.p.tArea,0)?"":"(概算)"), tFloor.toFixed(0)+" m²")}
   ${row("建築面積"+(posv(U.p.bldgArea,0)?"":"(1F相当)"), bcArea.toFixed(0)+" m²")}
   ${rowC("建蔽率", bcr.toFixed(0)+" %", barColor(bcr,60))}
   ${rowC("容積率", far.toFixed(0)+" %", barColor(far,300))}
   ${extra}
   <div style="font-size:8.5px;color:var(--mut);margin-top:2px">敷地${site.toFixed(0)}m²${posv(U.p.siteArea,0)?"(入力値)":"(形状から)"}に対する値${posv(U.p.tArea,0)?"":"・延床は形状概算"}</div></div>`;
 $("#title").innerHTML=`<div class="h" style="display:flex;justify-content:space-between;align-items:center"><span>${modeLabel}</span><span id="title-toggle" style="cursor:pointer;padding:0 4px;font-size:13px" onclick="U._titleMin=!U._titleMin;renderTitle()">${U._titleMin?"＋":"−"}</span></div><div class="b" style="${U._titleMin?"display:none":""}">
  <div style="font-weight:700;font-size:12px;border-bottom:1px solid var(--line);padding-bottom:4px;margin-bottom:4px">${U.p.name||"（物件名未入力）"}</div>
  <table><tr><td>用途・構造</td><td>${U.p.use}・${U.p.struct}造</td></tr>
  ${U.p.addr?`<tr><td>所在地</td><td>${U.p.addr.replace(/</g,"&lt;")}</td></tr>`:""}
  <tr><td>規模</td><td>地上${Math.round(posv(U.p.floors,0))}階　H=${posv(U.p.height,0)}m${un>0?`　${un}戸`:""}</td></tr>
  <tr><td>構成</td><td>${U.blocks.map(b=>`${b.label}${b.f1}-${b.f2}F`).join("＋")}</td></tr></table>${dash}
  ${U.p.note?`<div style="margin-top:5px;font-size:9.5px;color:var(--mut);border-top:1px dotted var(--line);padding-top:4px">${U.p.note.replace(/</g,"&lt;").replace(/\n/g,"<br>")}</div>`:""}
  <div style="margin-top:5px;font-size:9px;color:var(--mut)">※検討用イメージであり実際の建物・施工計画とは異なります</div></div>`;
}
function syncBtns(){renderBar();}
function view(k){const H=posv(U.p.height,42);
 if(k==="bird"){ctrl.phi=.9;ctrl.r=Math.max(H*2.2,130);}
 if(k==="eye"){ctrl.phi=1.45;ctrl.r=Math.max(H*1.7,95);}
 if(k==="front"){ctrl.theta=Math.PI/2;ctrl.phi=1.35;ctrl.r=Math.max(H*2,115);}
 if(k==="top"){ctrl.phi=.14;ctrl.r=Math.max(H*2,130);}
 // 注視点を敷地中心へリセット（パンで動かした視点を戻す）
 ctrl.cx=numv(U.site.dx,0); ctrl.cz=numv(U.site.dz,0);
 U.auto=false;renderBar();}
// ───── BIM連携：OBJ / メタデータ出力（GLOOBE等へのブリッジ）─────
function _dl(filename, text, mime){
 const blob=new Blob([text],{type:mime||"text/plain"});
 const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=filename; a.click();
}
// 建物・地形のメタ情報を集計（GLOOBEでボリュームを起こす数値根拠）
function buildBIMMeta(){
 const floorsAll=Math.min(60,Math.max(1,Math.round(posv(U.p.floors,14))));
 const H=posv(U.p.height,42), fh=+(H/floorsAll).toFixed(3);
 const site = posv(U.p.siteArea,0) || siteArea();
 const st=U._stats||{floorArea:0,maxFloors:0};
 let bcAuto=0; U.blocks.forEach(b=>{const f1=Math.max(1,Math.round(posv(b.f1,1)));if(f1===1){
   if(b.shape==="poly"&&Array.isArray(b.poly)){let a2=0;for(let i=0;i<b.poly.length;i++){const p=b.poly[i],q=b.poly[(i+1)%b.poly.length];a2+=p.x*q.z-q.x*p.z;}bcAuto+=Math.abs(a2)/2;}
   else{const W=posv(b.w,12),D=posv(b.d,10);bcAuto+=W*D;}}});
 const bcArea = posv(U.p.bldgArea,0) || bcAuto;
 const tFloor = posv(U.p.tArea,0) || st.floorArea;
 const prA=posv(U.p.privArea,0), consA=posv(U.p.consArea,0), un=Math.round(posv(U.p.units,0));
 return {
  generator:"BuildSight", schema:"bsbim-1", exportedAt:new Date().toISOString(),
  project:{name:U.p.name, use:U.p.use, structure:U.p.struct, address:U.p.addr||"", note:U.p.note||""},
  building:{floorsAbove:floorsAll, totalHeight_m:H, typicalFloorHeight_m:fh,
            totalFloorArea_m2:+tFloor.toFixed(1), buildingArea_m2:+bcArea.toFixed(1),
            constructionFloorArea_m2:consA>0?+consA.toFixed(1):null,
            privateArea_m2:prA>0?+prA.toFixed(1):null,
            units:un>0?un:null,
            efficiencyRatio_pct:(tFloor>0&&prA>0)?+(prA/tFloor*100).toFixed(1):null,
            areaPerUnit_m2:(un>0&&prA>0)?+(prA/un).toFixed(1):null,
            floorArea_source:posv(U.p.tArea,0)?"input":"estimated",
            buildingArea_source:posv(U.p.bldgArea,0)?"input":"estimated"},
  site:{width_m:posv(U.site.w,30), depth_m:posv(U.site.d,18), area_m2:+site.toFixed(1),
        area_source:posv(U.p.siteArea,0)?"input":"geometry",
        polygon_m:Array.isArray(U.site.poly)?U.site.poly:null,
        groundLevel_m:numv(U.site.gl,0), cornerLevels_m:U.site.h.map(v=>numv(v,0)),
        slope:{heightDiff_m:+slopeInfo().diff.toFixed(2), gradeFrontBack_pct:+slopeInfo().gradeZ.toFixed(1),
               gradeLeftRight_pct:+slopeInfo().gradeX.toFixed(1), direction:U.site.slopeDir||"flat"},
        roadSlope_m:numv(U.road.slope,0),
        origin:{dx:numv(U.site.dx,0), dz:numv(U.site.dz,0)}},
  legal:{buildingCoverage_pct:site>0?+(bcArea/site*100).toFixed(1):null,
         floorAreaRatio_pct:site>0?+(tFloor/site*100).toFixed(1):null},
  road:{width_m:posv(U.road.w,8), side:U.road.side},
  geo:{elevation_m:U.geo&&U.geo.elev!=null?U.geo.elev:null, label:U.geo?U.geo.name:""},
  blocks:U.blocks.map(b=>({label:b.label, fromFloor:b.f1, toFloor:b.f2,
    shape:b.shape==="poly"?"polygon":"box",
    width_m:b.shape==="poly"?null:posv(b.w,10), depth_m:b.shape==="poly"?null:posv(b.d,10),
    polygon_m:b.shape==="poly"?(b.poly||[]):null,
    offset_m:{dx:numv(b.dx,0), dz:numv(b.dz,0)}, rotation_deg:numv(b.ry,0)})),
  // 注記（地面貼り付け）と地下支障物：将来のBIM連携で位置つきメモとして活用できるよう出力
  annotations:(U.annot||[]).map(a=>({kind:a.type, text:a.type==="text"?(a.text||""):null,
    color:a.color, x_m:numv(a.x,0), z_m:numv(a.z,0),
    width_m:a.type==="zone"?posv(a.w,6):null, depth_m:a.type==="zone"?posv(a.d,6):null,
    rotation_deg:numv(a.ry,0)})),
  subsurface:(U.subsurface||[]).map(s=>({kind:s.kind, x_m:numv(s.x,0), z_m:numv(s.z,0),
    width_m:posv(s.w,3), length_m:posv(s.d,14), rotation_deg:numv(s.ry,0)}))
 };
}
// 用途別マテリアル色（OBJ/MTL用・RGB 0-1）
function bimUseColor(){
 const use=U.p.use;
 if(use.startsWith("共同住宅"))return [0.81,0.83,0.85];
 if(use==="事務所"||use==="店舗")return [0.23,0.35,0.48];
 if(use==="ホテル")return [0.85,0.82,0.77];
 if(use==="倉庫・物流")return [0.76,0.78,0.80];
 if(use==="病院・医療")return [0.90,0.91,0.93];
 return [0.81,0.83,0.85];
}
// ───── AI連携：画像生成AI / 3D生成AI 向けプロンプト自動生成（日英併記）─────
// 用途・構造・外装の日英対訳
const AI_USE={
 "共同住宅（賃貸）":{ja:"賃貸集合住宅",en:"rental apartment building",fac:"バルコニーが連続する住宅ファサード／コンクリート打放し調",facEn:"residential facade with continuous balconies, exposed concrete tone"},
 "共同住宅（分譲）":{ja:"分譲マンション",en:"condominium",fac:"整然としたバルコニーと手摺／落ち着いた外装",facEn:"orderly balconies with railings, refined exterior"},
 "ホテル":{ja:"ホテル",en:"hotel",fac:"規則的な客室窓が並ぶ／温かみのある外装",facEn:"regular grid of guest-room windows, warm-toned cladding"},
 "事務所":{ja:"オフィスビル",en:"office building",fac:"ガラスカーテンウォール／反射する水平連窓",facEn:"glass curtain wall, reflective horizontal ribbon windows"},
 "店舗":{ja:"店舗ビル",en:"retail/commercial building",fac:"1階に大きなショーウィンドウ／ガラス主体",facEn:"large ground-floor shopfront glazing, glass-dominant facade"},
 "倉庫・物流":{ja:"物流倉庫",en:"logistics warehouse",fac:"金属サイディング外装／大型シャッター",facEn:"metal siding facade, large roll-up shutter doors"},
 "病院・医療":{ja:"病院",en:"hospital",fac:"清潔感のある白い外装／連続した横長窓",facEn:"clean white exterior, continuous horizontal windows"}
};
const AI_STRUCT={RC:{ja:"鉄筋コンクリート造",en:"reinforced concrete (RC)"},SRC:{ja:"鉄骨鉄筋コンクリート造",en:"steel-reinforced concrete (SRC)"},S:{ja:"鉄骨造",en:"steel frame (S)"},W:{ja:"木造",en:"timber (wood)"},CFT:{ja:"CFT造",en:"concrete-filled steel tube (CFT)"}};

function buildAIPrompts(){
 const m=buildBIMMeta();
 const u=AI_USE[U.p.use]||{ja:U.p.use,en:U.p.use,fac:"",facEn:""};
 const s=AI_STRUCT[U.p.struct]||{ja:U.p.struct,en:U.p.struct};
 const fl=m.building.floorsAbove, H=m.building.totalHeight_m, fh=m.building.typicalFloorHeight_m;
 // 代表ブロックの寸法（最大の矩形ブロック）
 let W=0,D=0; U.blocks.forEach(b=>{if(b.shape!=="poly"){const w=posv(b.w,0),d=posv(b.d,0);if(w*d>W*D){W=w;D=d;}}});
 const dimJa = (W&&D)?`間口約${W.toFixed(0)}m × 奥行約${D.toFixed(0)}m`:"不整形（多角形）平面";
 const dimEn = (W&&D)?`approx. ${W.toFixed(0)}m wide × ${D.toFixed(0)}m deep`:"irregular (polygonal) footprint";
 // 住所はAI（外部サーバー）へ送られ得るため、既定では含めない（諸元の任意スイッチでON）
 const addrJa = (U.p.aiIncludeAddr && U.p.addr)?`／所在地：${U.p.addr}`:"";
 const roadJa = `前面道路 幅員約${m.road.width_m}m`;
 const roadEn = `front road approx. ${m.road.width_m}m wide`;

 // ① 画像生成AI向け（外観パース・写実）
 const imgJa =
`建築外観パース、写実的、${u.ja}、地上${fl}階建、最高高さ約${H}m（基準階高さ約${fh}m）、${dimJa}、${s.ja}${addrJa}。`+
`外観：${u.fac}。${roadJa}に面する。昼光、晴天、人物と植栽を少々、プロの建築ビジュアライゼーション、高精細、アイレベルのアングル。`;
 const imgEn =
`Architectural exterior rendering, photorealistic, ${u.en}, ${fl} stories above ground, max height approx. ${H}m (typical floor ${fh}m), footprint ${dimEn}, ${s.en}. `+
`Facade: ${u.facEn}. Faces a ${roadEn}. Daylight, clear sky, subtle people and greenery, professional architectural visualization, high detail, eye-level view.`;

 // ② 3D生成AI（Blender MCP等）向け：構築手順の指示
 const blocksDesc = U.blocks.map((b,i)=>{
   if(b.shape==="poly")return `- ブロック${i+1}「${b.label}」：多角形平面、${b.f1}〜${b.f2}階`;
   return `- ブロック${i+1}「${b.label}」：${posv(b.w,10).toFixed(0)}m×${posv(b.d,10).toFixed(0)}m、${b.f1}〜${b.f2}階`;
 }).join("\n");
 const d3Ja =
`# Blender等で以下の建物ボリュームを作成してください（営業概算・寸法は近似）
建物用途：${u.ja}（${s.ja}）
規模：地上${fl}階、最高高さ約${H}m、基準階高さ約${fh}m
延床面積：約${m.building.totalFloorArea_m2}㎡、建築面積：約${m.building.buildingArea_m2}㎡
敷地：約${m.site.area_m2}㎡、${roadJa}
構成ブロック：
${blocksDesc}
外装イメージ：${u.fac}
手順の目安：1) 各ブロックを直方体/押し出しで作成 2) 階数×階高で高さを設定 3) 外装マテリアルを用途に合わせて設定 4) 道路・地面を簡易に配置。寸法は概算のため、最終はGLOOBE等のBIMで精査します。`;
 const d3En =
`# Create the following building volume in Blender (early-stage estimate, approximate dimensions)
Use: ${u.en} (${s.en})
Scale: ${fl} stories above ground, max height ~${H}m, typical floor height ~${fh}m
Total floor area ~${m.building.totalFloorArea_m2} m2, building area ~${m.building.buildingArea_m2} m2
Site ~${m.site.area_m2} m2, ${roadEn}
Blocks:
${U.blocks.map((b,i)=>b.shape==="poly"?`- Block${i+1} "${b.label}": polygonal footprint, floors ${b.f1}-${b.f2}`:`- Block${i+1} "${b.label}": ${posv(b.w,10).toFixed(0)}m x ${posv(b.d,10).toFixed(0)}m, floors ${b.f1}-${b.f2}`).join("\n")}
Facade: ${u.facEn}
Steps: 1) Create each block as a box/extrusion 2) Set height = floors x floor-height 3) Assign facade material per use 4) Add simple road and ground plane. Dimensions are approximate; final coordination in BIM (e.g., GLOOBE).`;

 return {
  meta:{project:U.p.name, use:u.ja, generatedAt:new Date().toISOString(),
        note:"BimGenの入力諸元から自動生成した補助プロンプトです。寸法は営業概算であり設計値ではありません。"},
  imagePrompt:{ja:imgJa, en:imgEn},
  model3dPrompt:{ja:d3Ja, en:d3En}
 };
}
function exportOBJ(){
 if(typeof THREE.OBJExporter==="undefined"){
  alert("OBJExporterが読み込まれていません。\nindex.htmlの<head>に\nhttps://unpkg.com/three@0.128.0/examples/js/exporters/OBJExporter.js\nを追加してください。");
  return;
 }
 try{
  const wasExporting=U._exporting, wasGrid=U.grid.show;
  U._exporting=true; if(U.grid.show)U.grid.show=false; rebuild();  // ガイド・グリッドを除いた純粋形状で出力
  const exporter=new THREE.OBJExporter();
  let objStr=exporter.parse(scene);
  const dateStr=new Date().toISOString().slice(0,10).replace(/-/g,"");
  const base=`${U.p.name||"BimGen"}_BIM_${dateStr}`;
  // MTL（用途別の素材色）を付与し、OBJ先頭にmtllib参照を挿入
  const [r,gg,bb]=bimUseColor();
  const mtl=`# BuildSight material\nnewmtl bs_use\nKa ${r.toFixed(3)} ${gg.toFixed(3)} ${bb.toFixed(3)}\nKd ${r.toFixed(3)} ${gg.toFixed(3)} ${bb.toFixed(3)}\nKs 0.050 0.050 0.050\nd 1.0\nillum 2\n`;
  if(!/mtllib/.test(objStr)) objStr=`mtllib ${base}.mtl\nusemtl bs_use\n`+objStr;
  U._exporting=wasExporting; U.grid.show=wasGrid; rebuild();  // 復帰
  // 4点セットで出力：OBJ（形状）/ MTL（素材）/ JSON（メタ情報）/ AIプロンプト（txt）
  const ai=buildAIPrompts();
  const aiTxt=
`════════ 画像生成AI 向けプロンプト（Midjourney / DALL-E 等）════════
【日本語】
${ai.imagePrompt.ja}

【English】
${ai.imagePrompt.en}

════════ 3D生成AI 向けプロンプト（Blender MCP 等）════════
【日本語】
${ai.model3dPrompt.ja}

【English】
${ai.model3dPrompt.en}

──────────────────────────────
${ai.meta.note}
生成元：BimGen ／ 物件：${ai.meta.project} ／ ${ai.meta.generatedAt}`;
  _dl(base+".obj", objStr, "text/plain");
  _dl(base+".mtl", mtl, "text/plain");
  _dl(base+".bim.json", JSON.stringify(buildBIMMeta(),null,2), "application/json");
  _dl(base+"_AIプロンプト.txt", aiTxt, "text/plain");
  toast("BIM出力 4ファイル（OBJ/MTL/JSON/プロンプト）を保存しました","ok");
 }catch(err){toast("OBJ出力に失敗："+err.message,"err");}
}
window.exportOBJ=exportOBJ;
// onclick/onchangeから呼ばれるが公開漏れだった関数を明示エクスポート（難読化・モジュール化耐性）
window.loadUnderFile=loadUnderFile;
window.loadPhotoFile=loadPhotoFile;
window.savePNG=savePNG;

// AIプロンプトをその場でコピー（画像生成 or 3D生成を選択）
function copyAIPrompt(kind){
 const ai=buildAIPrompts();
 let txt;
 if(kind==="img") txt=`【画像生成AI向け】\n${ai.imagePrompt.ja}\n\n[English]\n${ai.imagePrompt.en}`;
 else txt=`【3D生成AI向け（Blender MCP等）】\n${ai.model3dPrompt.ja}\n\n[English]\n${ai.model3dPrompt.en}`;
 const done=()=>toast((kind==="img"?"画像生成AI":"3D生成AI")+"向けプロンプトをコピーしました","ok");
 if(navigator.clipboard&&navigator.clipboard.writeText){
  navigator.clipboard.writeText(txt).then(done).catch(()=>{prompt("以下をコピーしてください：",txt);});
 }else{prompt("以下をコピーしてください：",txt);}
}
window.copyAIPrompt=copyAIPrompt;

// AIプロンプトの種類を選んでコピー
function aiPromptMenu(){
 const ok=confirm("AIパース用プロンプトを生成します。\n\n「OK」＝画像生成AI向け（Midjourney/DALL-E等の外観パース）\n「キャンセル」＝3D生成AI向け（Blender MCP等の構築指示）");
 copyAIPrompt(ok?"img":"3d");
}
window.aiPromptMenu=aiPromptMenu;

// ───── 意見・要望（社内フォームを別タブで開く）─────
// ▼ここに社内のGoogleフォーム等のURLを設定してください（空欄なら案内のみ表示）
const FEEDBACK_URL="";  // 例: "https://forms.gle/xxxxxxxx"
function openFeedback(){
 if(FEEDBACK_URL){
  window.open(FEEDBACK_URL,"_blank","noopener");
 }else{
  alert("意見・要望フォームは未設定です。\n\nGoogleフォーム等を作成し、app.js の FEEDBACK_URL にそのURLを設定すると、このボタンからフォームを開けるようになります。\n\n（このアプリ自体は意見データを送受信しません。フォームは別タブで開くだけです）");
 }
}
window.openFeedback=openFeedback;

function savePNG(){
 // クリーン出力：UI（パネル・バー・表題・ヒント）とグリッドを一時非表示にして純粋な3Dのみ出力
 const ui=["#panel","#bar","#title","#drag"].map(s=>$(s)).filter(Boolean);
 const prevDisp=ui.map(e=>e.style.display);
 const prevGrid=U.grid.show;
 U._exporting=true;
 ui.forEach(e=>e.style.display="none");
 if(U.grid.show){U.grid.show=false;}
 rebuild();  // ガイド非表示・グリッド非表示で再構築
 renderer.render(scene,camera);
 const url=renderer.domElement.toDataURL("image/png");
 // 復帰
 U._exporting=false;
 U.grid.show=prevGrid; rebuild();
 ui.forEach((e,i)=>e.style.display=prevDisp[i]);
 const a=document.createElement("a");
 a.href=url;
 a.download=`${U.p.name||"BimGen"}_${U.tw.mode==="build"?"仮設計画":U.tw.mode==="demo"?"既存解体":U.line?"線画下絵":"パース"}.png`;
 a.click();
}
// ───── 検討シート出力（A4横1枚のHTML：印刷→PDF可。打合せ・報告・OJT記録用）─────
function _shot(viewKey){
 // 指定視点で1枚撮影して dataURL を返す（UIは呼び出し側で隠す）
 const save={theta:ctrl.theta,phi:ctrl.phi,r:ctrl.r,cx:ctrl.cx,cz:ctrl.cz,ty:ctrl.ty,auto:U.auto};
 view(viewKey);
 camera.position.set(ctrl.cx+ctrl.r*Math.sin(ctrl.phi)*Math.cos(ctrl.theta),ctrl.ty+ctrl.r*Math.cos(ctrl.phi),ctrl.cz+ctrl.r*Math.sin(ctrl.phi)*Math.sin(ctrl.theta));
 camera.lookAt(ctrl.cx,ctrl.ty,ctrl.cz); renderer.render(scene,camera);
 const url=renderer.domElement.toDataURL("image/jpeg",0.86);
 Object.assign(ctrl,{theta:save.theta,phi:save.phi,r:save.r,cx:save.cx,cz:save.cz,ty:save.ty}); U.auto=save.auto;
 return url;
}
const _esc=(s)=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
function exportSheet(){
 // 3D撮影（グリッド・ガイド非表示）
 const prevGrid=U.grid.show; U._exporting=true; if(U.grid.show)U.grid.show=false; rebuild();
 const imgBird=_shot("bird"), imgTop=_shot("top");
 U._exporting=false; U.grid.show=prevGrid; rebuild(); renderBar();
 // データ収集
 const checks=collectChecks(); const si=slopeInfo(); let rc=null; try{rc=roadworkCalc();}catch(e){}
 const site=posv(U.p.siteArea,0)||siteArea(); const st=U._stats||{floorArea:0};
 const tFloor=posv(U.p.tArea,0)||st.floorArea; let bcArea=posv(U.p.bldgArea,0);
 if(!bcArea){U.blocks.forEach(b=>{if(Math.max(1,Math.round(posv(b.f1,1)))===1)bcArea+=posv(b.w,10)*posv(b.d,10);});}
 const far=site>0?tFloor/site*100:0, bcr=site>0?bcArea/site*100:0;
 const d=new Date(); const ymd=`${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`;
 const lvLabel={ok:"OK",warn:"注意",ng:"要検討",na:"—"};
 const crane=CRANE_SPECS[U.tw.craneModel]||null;
 const cobjRows=(U.cobj||[]).map(c=>{const t=COBJ_TYPES[c.type];const sz=cobjSize(c.type,c.size)||{};return `<tr><td>${_esc(t?t.label:c.type)}</td><td>${_esc(sz.label||c.size||"")}</td><td class="n">${numv(c.x,0).toFixed(1)}, ${numv(c.z,0).toFixed(1)}</td><td>${c._warn?'<span class="ng">歩行帯と干渉</span>':"—"}</td></tr>`;}).join("");
 const annotRows=(U.annot||[]).map(a=>`<tr><td>${a.type==="zone"?"範囲":"文字"}</td><td>${_esc((ANNOT_COLORS.find(c=>c.key===a.color)||{}).label||a.color)}</td><td>${_esc(a.type==="text"?a.text:`${posv(a.w,6)}m × ${posv(a.d,6)}m`)}</td><td class="n">${numv(a.x,0).toFixed(1)}, ${numv(a.z,0).toFixed(1)}</td></tr>`).join("");
 const subRows=(U.subsurface||[]).map(s=>`<tr><td>${_esc((SUBSURFACE_TYPES[s.kind]||{}).label||s.kind)}</td><td class="n">${posv(s.w,3)}m × ${posv(s.d,14)}m</td><td class="n">${numv(s.x,0).toFixed(1)}, ${numv(s.z,0).toFixed(1)}</td></tr>`).join("");
 const html=`<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>検討シート ${_esc(U.p.name)}</title>
<style>
@page{size:A4 landscape;margin:12mm}
body{font-family:-apple-system,"Hiragino Sans","Yu Gothic UI",Meiryo,sans-serif;color:#1A2740;margin:0;padding:18px;font-size:11px;background:#fff}
h1{font-size:18px;margin:0;color:#16243D;letter-spacing:.02em}
.hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #F2A33C;padding-bottom:6px;margin-bottom:10px}
.meta{font-size:10px;color:#6A7385;text-align:right;line-height:1.5}
.grid{display:grid;grid-template-columns:1.15fr 1fr;gap:12px}
.imgs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.imgs img{width:100%;max-height:255px;object-fit:cover;border:1px solid #DDE2EA;border-radius:6px;display:block}
.imgs small{display:block;font-size:9px;color:#6A7385;margin-top:2px}
h2{font-size:11.5px;margin:10px 0 4px;color:#16243D;border-left:3px solid #F2A33C;padding-left:6px}
table{border-collapse:collapse;width:100%;font-size:10.5px}
th,td{border:1px solid #DDE2EA;padding:3px 6px;text-align:left;vertical-align:top}
th{background:#EEF2F8;font-weight:600;color:#2E4057;font-size:10px}
td.n{font-family:ui-monospace,Consolas,monospace;white-space:nowrap}
.kv td:first-child{color:#6A7385;width:34%}
.ok{color:#2E7D5B;font-weight:700}.warn{color:#C77F1A;font-weight:700}.ng{color:#B0433A;font-weight:700}
.sum{display:flex;gap:8px;margin:4px 0 8px}
.sum div{flex:1;border-radius:6px;padding:6px 8px;font-size:10px;text-align:center}
.sum .a{background:#EEF6F1;color:#2E7D5B}.sum .b{background:#FFF6E6;color:#C77F1A}.sum .c{background:#FBEDEC;color:#B0433A}
.sum b{display:block;font-size:16px}
.note{font-size:9px;color:#6A7385;margin-top:10px;border-top:1px solid #DDE2EA;padding-top:5px;line-height:1.6}
.sign{display:flex;gap:10px;margin-top:8px;font-size:9.5px}
.sign div{flex:1;border:1px solid #DDE2EA;border-radius:4px;padding:4px 6px;height:28px;color:#6A7385}
.bar{position:fixed;top:8px;right:8px;background:#16243D;color:#fff;border:none;padding:8px 14px;border-radius:99px;font-size:12px;cursor:pointer}
@media print{.bar{display:none}body{padding:0}}
</style></head><body>
<button class="bar" onclick="window.print()">🖨 印刷 / PDF保存</button>
<div class="hd"><div><div style="font-size:9.5px;color:#6A7385;letter-spacing:.1em">BimGen 検討シート</div><h1>${_esc(U.p.name||"（案件名未入力）")}</h1></div>
<div class="meta">作成日 ${ymd}　／　作成者 ＿＿＿＿＿＿<br>${_esc(U.p.addr||"")}</div></div>
<div class="imgs"><div><img src="${imgBird}"><small>鳥瞰（仮設計画イメージ）</small></div><div><img src="${imgTop}"><small>配置（真上）</small></div></div>
<div class="grid"><div>
<h2>検討判定</h2>
<div class="sum"><div class="a"><b>${checks.filter(c=>c.lv==="ok").length}</b>OK</div><div class="b"><b>${checks.filter(c=>c.lv==="warn").length}</b>注意</div><div class="c"><b>${checks.filter(c=>c.lv==="ng").length}</b>要検討</div></div>
<table><tr><th>区分</th><th>項目</th><th>値</th><th>判定</th><th>所見</th></tr>
${checks.map(c=>`<tr><td>${_esc(c.cat)}</td><td>${_esc(c.label)}</td><td class="n">${_esc(c.val)}</td><td class="${c.lv}">${lvLabel[c.lv]}</td><td>${_esc(c.note)}</td></tr>`).join("")}</table>
${rc?`<h2>道路使用検討（生コン車＋ポンプ車）</h2><table class="kv">
<tr><td>車種</td><td>ミキサー ${_esc(rc.mix.label||U.roadwork.mixerSize)} ／ ポンプ ${_esc(rc.pmp.label||U.roadwork.pumpSize)}</td></tr>
<tr><td>縦列必要長 / 敷地間口</td><td class="n">${rc.lineLen} m / ${rc.front} m → <span class="${rc.fitFront?"ok":"ng"}">${rc.fitFront?"収まる":"収まらない"}</span></td></tr>
<tr><td>道路幅員 / 歩道乗り上げ</td><td class="n">${rc.roadW} m / ${rc.mount} m</td></tr>
<tr><td>残車道幅</td><td class="n">${rc.remain} m → <span class="${rc.emgOK?"ok":(rc.passOK?"warn":"ng")}">${rc.emgOK?"緊急車両4m確保":(rc.passOK?"すれ違い可・緊急車両4m未満":"3m未満・片側交互通行")}</span></td></tr>
${(U.roadwork.permitPolice||U.roadwork.permitRoad||U.roadwork.permitOffice)?`<tr><td>許可条件メモ</td><td>${_esc([U.roadwork.permitPolice&&"警察："+U.roadwork.permitPolice,U.roadwork.permitRoad&&"道路管理者："+U.roadwork.permitRoad,U.roadwork.permitOffice&&"建設事務所："+U.roadwork.permitOffice].filter(Boolean).join(" ／ "))}</td></tr>`:""}
</table>`:""}
<h2>配置した施工オブジェクト（${(U.cobj||[]).length}）</h2>
${cobjRows?`<table><tr><th>種別</th><th>サイズ</th><th>位置 X,Z (m)</th><th>備考</th></tr>${cobjRows}</table>`:`<div style="color:#6A7385">なし</div>`}
</div><div>
<h2>諸元</h2><table class="kv">
<tr><td>用途・構造</td><td>${_esc(U.p.use)}・${_esc(U.p.struct)}造</td></tr>
<tr><td>規模</td><td>地上${Math.round(posv(U.p.floors,0))}階　最高高さ ${posv(U.p.height,0)} m${posv(U.p.units,0)?`　${Math.round(posv(U.p.units,0))}戸`:""}</td></tr>
<tr><td>敷地面積</td><td class="n">${site.toFixed(1)} m²${posv(U.p.siteArea,0)?"":"（形状から算出）"}</td></tr>
<tr><td>建築面積 / 建蔽率</td><td class="n">${bcArea.toFixed(1)} m² / <span class="${bcr>80?"ng":bcr>60?"warn":"ok"}">${bcr.toFixed(0)}%</span></td></tr>
<tr><td>延床面積 / 容積率</td><td class="n">${tFloor.toFixed(1)} m² / <span class="${far>500?"ng":far>300?"warn":"ok"}">${far.toFixed(0)}%</span>${posv(U.p.tArea,0)?"":"（形状概算）"}</td></tr>
<tr><td>建物構成</td><td>${_esc(U.blocks.map(b=>`${b.label} ${b.f1}-${b.f2}F（${posv(b.w,0)}×${posv(b.d,0)}m）`).join("、"))}</td></tr>
</table>
<h2>敷地・地形・道路</h2><table class="kv">
<tr><td>敷地寸法</td><td class="n">間口 ${posv(U.site.w,0)} m × 奥行 ${posv(U.site.d,0)} m</td></tr>
<tr><td>設計GL</td><td class="n">${numv(U.site.gl,0).toFixed(2)} m</td></tr>
<tr><td>敷地高低差 / 勾配</td><td class="n">${si.diff.toFixed(2)} m / 前後 ${si.gradeZ.toFixed(1)}%・左右 ${si.gradeX.toFixed(1)}%${si.diff>=0.05?`（${_esc(si.dirZ)}）`:"（平坦）"}</td></tr>
<tr><td>前面道路</td><td class="n">幅員 ${posv(U.road.w,0)} m${U.road.side!=="none"?`　側道あり（${U.road.side==="left"?"左":"右"}）`:""}${Math.abs(numv(U.road.slope,0))>=0.05?`　道路傾斜 ${numv(U.road.slope,0)} m`:""}</td></tr>
${U.geo&&U.geo.elev!=null?`<tr><td>標高（国土地理院）</td><td class="n">${_esc(U.geo.elev)} m　${_esc(U.geo.name||"")}</td></tr>`:""}
</table>
<h2>仮設計画</h2><table class="kv">
<tr><td>タワークレーン</td><td>${U.tw.crane?`${_esc(U.tw.craneModel)}${crane?`（作業半径 ${crane.work}m・定格 ${crane.cap}t）`:""}`:"なし"}</td></tr>
<tr><td>仮囲い</td><td>${U.tw.fence?`高さ ${numv(U.tw.fenceH,3)} m・ゲート ${({front:"前面",left:"左",right:"右",none:"なし"})[U.tw.fenceGate||"front"]}`:"なし"}</td></tr>
<tr><td>外部足場</td><td>${U.tw.scaffold?"あり":"なし"}</td></tr>
</table>
${(()=>{const all=Object.entries(OJT_CHECKS).flatMap(([tab,arr])=>arr.map(i=>({...i,tab})));const done=all.filter(i=>U.ojt&&U.ojt[i.k]);if(!done.length&&!all.length)return "";
 return `<h2>OJT検討項目（${done.length}/${all.length} 検討済み）</h2><table><tr><th>状態</th><th>項目</th><th>出典</th></tr>${all.map(i=>`<tr><td class="${U.ojt&&U.ojt[i.k]?"ok":""}">${U.ojt&&U.ojt[i.k]?"✓":"□"}</td><td>${_esc(i.t)}</td><td class="n">OJT ${_esc(i.src)}</td></tr>`).join("")}</table>`;})()}
${annotRows?`<h2>注記・申し送り（${(U.annot||[]).length}）</h2><table><tr><th>種別</th><th>色</th><th>内容</th><th>位置 X,Z (m)</th></tr>${annotRows}</table>`:""}
${subRows?`<h2>地下支障物（参考）</h2><table><tr><th>種別</th><th>幅×長</th><th>位置 X,Z (m)</th></tr>${subRows}</table>`:""}
<div class="sign"><div>確認者</div><div>上長確認</div><div>備考</div></div>
</div></div>
<div class="note">※本シートはBimGenによる初期検討の目安であり、正式な設計・施工計画・法規適合・許認可の可否を保証するものではありません。判定は一般的な基準による概算です。地図を含む場合の出典：国土地理院。</div>
</body></html>`;
 const blob=new Blob([html],{type:"text/html;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a"); a.href=url; a.download=`${(U.p.name||"BimGen").replace(/[\\/:*?"<>|]/g,"_")}_検討シート.html`; a.click();
 setTimeout(()=>{const w=window.open(url,"_blank");if(!w)toast("検討シートを保存しました（ブラウザで開いて印刷→PDF）","ok");else toast("検討シートを保存し、別タブで開きました","ok");},200);
}
window.exportSheet=exportSheet;
// ───── スタート画面・テンプレート（新規案件を1クリックで起こす）─────
// 各テンプレートは東京の典型的な敷地条件を想定した現実的な初期値
const TEMPLATES=[
 {key:"office5", icon:"🏢", name:"事務所ビル 5階", sub:"間口20m×奥行18m／前面道路8m",
  p:{use:"事務所",struct:"S",floors:5,height:20,tArea:950}, site:{w:20,d:18}, blocks:[{id:1,label:"建物",f1:1,f2:5,w:16,d:12,dx:0,dz:0,ry:0}], road:{w:8}},
 {key:"apt8", icon:"🏘", name:"共同住宅 8階", sub:"間口14m×奥行22m／前面道路6m（狭小地）",
  p:{use:"共同住宅（賃貸）",struct:"RC",floors:8,height:24,tArea:1200,units:24}, site:{w:14,d:22}, blocks:[{id:1,label:"建物",f1:1,f2:8,w:10,d:15,dx:0,dz:0,ry:0}], road:{w:6}},
 {key:"shop3", icon:"🏬", name:"店舗 3階", sub:"間口18m×奥行15m／前面道路12m",
  p:{use:"店舗",struct:"S",floors:3,height:13,tArea:480}, site:{w:18,d:15}, blocks:[{id:1,label:"建物",f1:1,f2:3,w:15,d:11,dx:0,dz:0,ry:0}], road:{w:12}},
 {key:"wh2", icon:"🏭", name:"倉庫・物流 2階", sub:"間口40m×奥行30m／前面道路10m",
  p:{use:"倉庫・物流",struct:"S",floors:2,height:12,tArea:1600}, site:{w:40,d:30}, blocks:[{id:1,label:"建物",f1:1,f2:2,w:34,d:24,dx:0,dz:0,ry:0}], road:{w:10}, tw:{craneModel:"JCL030",craneX:24}},
 {key:"hosp6", icon:"🏥", name:"病院・医療 6階", sub:"間口30m×奥行26m／前面道路10m",
  p:{use:"病院・医療",struct:"RC",floors:6,height:24,tArea:2500}, site:{w:30,d:26}, blocks:[{id:1,label:"建物",f1:1,f2:6,w:24,d:18,dx:0,dz:0,ry:0}], road:{w:10}, tw:{craneModel:"JCL030",craneX:22}},
];
// デモ案件：傾斜・地図なし・仮囲い・クレーン・重機・注記が入った状態（実演用）
const DEMO_CASE={
 p:{name:"（デモ）〇〇町 共同住宅計画",use:"共同住宅（賃貸）",struct:"RC",floors:8,height:24,tArea:1200,units:24,addr:""},
 site:{w:14,d:22,dx:0,dz:0,gl:0,h:[0,0,1.2,1.2],slopeDir:"north",slopeDiff:1.2},
 blocks:[{id:1,label:"建物",f1:1,f2:8,w:10,d:15,dx:0,dz:0,ry:0}],
 road:{w:6,slope:0},
 tw:{mode:"build",crane:true,craneModel:"JCL022",craneX:9,craneZ:-4,fence:true,fenceH:3,fenceGate:"front",scaffold:true},
 cobj:[{type:"mixer",size:"8t",x:-6,z:16,ry:0},{type:"pump",size:"m4t",x:5,z:16,ry:0}],
 annot:[{type:"text",x:9,z:5,ry:0,color:"red",text:"クレーン旋回注意",fsize:2},
        {type:"zone",x:-8,z:-6,w:5,d:6,ry:0,color:"amber"},
        {type:"text",x:-8,z:-6,ry:0,color:"amber",text:"資材置場",fsize:1.6}],
 nbs:[{x:-13,z:0,w:8,d:14,h:15,ry:0},{x:13,z:2,w:8,d:12,h:9,ry:0}],
};
function resetToDefault(){
 // U を初期状態に戻す（テクスチャ等は破棄）
 const def=JSON.parse(_U_DEFAULT);
 if(U.under.tex&&U.under.tex.dispose)U.under.tex.dispose();
 if(U.photo.tex&&U.photo.tex.dispose)U.photo.tex.dispose();
 Object.assign(U,def);
 _hist.length=0;
}
function deepMerge(t,s){for(const k in s){if(s[k]&&typeof s[k]==="object"&&!Array.isArray(s[k])&&t[k]&&typeof t[k]==="object"){deepMerge(t[k],s[k]);}else t[k]=s[k];}return t;}
window.newFromTemplate=(key)=>{
 const tp=TEMPLATES.find(t=>t.key===key); if(!tp)return;
 resetToDefault();
 U.p.name="新規案件（"+tp.name+"）";
 deepMerge(U,{p:tp.p,site:tp.site,road:tp.road||{},tw:tp.tw||{}});
 U.blocks=JSON.parse(JSON.stringify(tp.blocks));
 U.tab="諸元";U.tabGroup="建物";
 closeStart(); rebuild();renderPanel();renderBar();view("bird");
 toast(tp.name+" のテンプレートで開始しました。諸元タブで案件名・住所を入力してください","ok");
};
window.openDemoCase=()=>{
 resetToDefault();
 deepMerge(U,DEMO_CASE);
 U.blocks=JSON.parse(JSON.stringify(DEMO_CASE.blocks));U.cobj=JSON.parse(JSON.stringify(DEMO_CASE.cobj));
 U.annot=JSON.parse(JSON.stringify(DEMO_CASE.annot));U.nbs=JSON.parse(JSON.stringify(DEMO_CASE.nbs));
 U.tab="仮設";U.tabGroup="施工";
 closeStart(); rebuild();renderPanel();renderBar();view("bird");
 toast("デモ案件を開きました（傾斜地・仮囲い・クレーン・注記入り）","ok");
};
function closeStart(){const s=document.getElementById("start");if(s){s.classList.add("hide");setTimeout(()=>{s.style.display="none";},260);}}
window.closeStart=closeStart;
window.openStart=()=>{
 let s=document.getElementById("start");
 if(!s){s=document.createElement("div");s.id="start";document.body.appendChild(s);}
 s.innerHTML=`<div class="start-card">
  <div class="start-head"><div class="start-logo">BimGen</div><div class="start-sub">案件をどう始めますか？</div></div>
  <div class="start-sec">テンプレートから新規（用途と敷地の目安を選ぶだけ）</div>
  <div class="start-grid">${TEMPLATES.map(t=>`<button class="start-tpl" onclick="newFromTemplate('${t.key}')"><span class="start-ico">${t.icon}</span><b>${t.name}</b><small>${t.sub}</small></button>`).join("")}</div>
  ${(()=>{const d=readDraft();if(!d||!draftEnabled())return "";const t=new Date(d.savedAt).toLocaleString("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
    return `<button class="start-act resume" onclick="restoreDraft()">⟲ 前回の続きから<small>自動退避 ${t}　${_esc(d.name||"（案件名未入力）")}</small></button>`;})()}
  <div class="start-row">
   <button class="start-act demo" onclick="openDemoCase()">▶ デモ案件を開く<small>傾斜地・仮囲い・クレーン・注記が入った状態</small></button>
   <button class="start-act" onclick="document.getElementById('json-file').click();closeStart()">📂 保存した案件を開く<small>.json / .bsjson</small></button>
   <button class="start-act" onclick="closeStart()">→ このまま続ける<small>現在の内容を編集</small></button>
  </div>
  <div class="start-foot">この画面は右上「＋ 新規」からいつでも開けます。数値はあとから全て変更できます。<br>
   <label style="display:inline-flex;align-items:center;gap:5px;margin-top:6px;cursor:pointer"><input type="checkbox" ${draftEnabled()?"checked":""} onchange="setDraftEnabled(this.checked);openStart()" style="accent-color:var(--amber)">作業中の内容をこの端末に自動退避する（共用PCではオフ推奨）</label>${readDraft()&&draftEnabled()?`　<a href="#" onclick="clearDraft();return false" style="color:var(--mut)">下書きを削除</a>`:""}</div>
 </div>`;
 s.style.display="";s.classList.remove("hide");
};

// ───── プレゼン表示（パネル・バーを隠して3Dを全面に。顧客・会議用）─────
window.togglePresent=()=>{
 const on=!document.body.classList.contains("present");
 document.body.classList.toggle("present",on);
 let x=document.getElementById("present-exit");
 if(on){
  if(!x){x=document.createElement("button");x.id="present-exit";x.className="btn";x.textContent="✕ 編集に戻る";x.onclick=()=>window.togglePresent();document.body.appendChild(x);}
  x.style.display="";
  toast("プレゼン表示：画面をドラッグで回転、ホイールで拡大。Escで戻る");
 }else if(x){x.style.display="none";}
 setTimeout(resize,50);
};
document.addEventListener("keydown",(e)=>{if(e.key==="Escape"&&document.body.classList.contains("present"))window.togglePresent();});
function renderBar(){
 const mn=(label,items,style)=>`<div class="mn"><button class="btn" style="${style||""}" onclick="toggleMenu(this)">${label} ▾</button><div class="mn-pop">${items.map(i=>i?`<button class="mn-item ${i.on?"on":""}" onclick="closeMenus();${i.fn}">${i.on?"✓ ":""}${i.label}</button>`:'<div class="mn-sep"></div>').join("")}</div></div>`;
 $("#bar").innerHTML=`
  <button class="btn" onclick="openStart()" title="テンプレート／デモ／ファイルから案件を開く" style="border:1.5px solid var(--amber);font-weight:700">＋ 新規</button>
  <button class="btn" id="undo-btn" onclick="undo()" title="1つ前の状態に戻す（Ctrl+Z）" ${_hist.length?"":"disabled"} style="font-weight:700">↶ 戻す</button>
  <button class="btn" onclick="togglePresent()" title="パネルを隠して3Dを全画面に（顧客・会議用）" style="border:1.5px solid var(--navy)">▶ プレゼン</button>
  ${mn("視点",[
    {label:"鳥瞰",fn:"view('bird')"},{label:"正面",fn:"view('front')"},{label:"アイレベル",fn:"view('eye')"},{label:"真上（配置）",fn:"view('top')"},null,
    {label:"自動回転",fn:"U.auto=!U.auto;renderBar()",on:U.auto}])}
  ${mn("表示",[
    {label:"グリッド",fn:"U.grid.show=!U.grid.show;rebuild();renderBar()",on:U.grid.show},
    {label:"敷地/下敷き移動モード",fn:"U.moveLayers=!U.moveLayers;renderBar()",on:U.moveLayers},
    {label:"線画（AI下絵）",fn:"U.line=!U.line;rebuild();renderBar()",on:U.line}])}
  <button class="btn" onclick="saveProjectJSON()" style="border:1.5px solid var(--amber)" title="案件を保存（暗号化可）">💾 保存</button>
  <button class="btn" onclick="document.getElementById('json-file').click()" style="border:1.5px solid var(--amber)" title="保存した案件を開く">📂 読込</button>
  <input type="file" id="json-file" accept=".json,.bsjson" style="display:none" onchange="loadProjectJSON(this.files[0]); this.value=''">
  <button class="btn primary" onclick="exportSheet()" title="判定・諸元・画像・注記をA4横1枚にまとめて出力（印刷→PDF可）">📄 検討シート</button>
  ${mn("出力",[
    {label:"PNG画像を保存",fn:"savePNG()"},
    {label:"BIM出力（OBJ/MTL/JSON）",fn:"exportOBJ()"},
    {label:"AIプロンプト生成",fn:"aiPromptMenu()"},null,
    {label:"💬 意見・要望を送る",fn:"openFeedback()"}],"border:1.5px solid #2E7D5B;color:#2E7D5B")}`;
}
window.toggleMenu=(btn)=>{const m=btn.parentElement;const was=m.classList.contains("open");closeMenus();if(!was)m.classList.add("open");};
window.closeMenus=()=>{document.querySelectorAll(".mn.open").forEach(x=>x.classList.remove("open"));};
document.addEventListener("pointerdown",(e)=>{if(!e.target.closest(".mn"))closeMenus();});
$("#phead").addEventListener("click",()=>{const w=$("#pwrap");const off=w.style.display==="none";w.style.display=off?"":"none";$("#parr").textContent=off?"▲":"▼";});
U._titleMin = (window.innerWidth < 720);  // モバイルは初期最小化
renderBar();renderPanel();rebuild();
setTimeout(()=>{const d=$("#drag");if(d)d.style.display="none";},9000);
