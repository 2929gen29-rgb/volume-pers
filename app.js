pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const APP_VER="2026.07";  // アプリのバージョン（保存データの互換管理に使用）
// ───── 白画面防止ガード ─────
window.addEventListener("error",(e)=>{if(document.getElementById("err-banner"))return;const d=document.createElement("div");d.id="err-banner";d.style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#B0433A;color:#fff;font-family:Meiryo,sans-serif;font-size:12px;padding:8px 14px;";d.textContent="エラー: "+(e.message||"不明")+"（この文言を開発者へ）";document.body.appendChild(d);});
function webglOK(){try{const c=document.createElement("canvas");return !!(window.WebGLRenderingContext&&(c.getContext("webgl")||c.getContext("experimental-webgl")));}catch(e){return false;}}
if(!webglOK()){document.body.innerHTML='<div style="max-width:520px;margin:80px auto;padding:24px;background:#fff;border:2px solid #B0433A;border-radius:12px;font-family:Meiryo;line-height:1.9"><b style="color:#B0433A">3D描画（WebGL）が利用できません。</b><br>リモートデスクトップ経由を避け、ブラウザのハードウェアアクセラレーション設定をONにして再起動してください。</div>';throw new Error("WebGL unavailable");}
const $=(q)=>document.querySelector(q);
const numv=(v,fb)=>{const n=parseFloat(v);return isFinite(n)?n:fb};
const posv=(v,fb)=>{const n=parseFloat(v);return isFinite(n)&&n>0?n:fb};
const UI_PREF_KEY="bimgen_ui_pref_v1";
const UI_PREF=(()=>{try{return Object.assign({fontScale:100,labelScale:100,editScope:"all"},JSON.parse(localStorage.getItem(UI_PREF_KEY)||"{}"));}catch(e){return {fontScale:100,labelScale:100,editScope:"all"};}})();
function saveUIPref(){try{localStorage.setItem(UI_PREF_KEY,JSON.stringify(UI_PREF));}catch(e){}}
function applyUIPref(){
 const fs=Math.max(85,Math.min(130,numv(UI_PREF.fontScale,100))),ls=Math.max(75,Math.min(160,numv(UI_PREF.labelScale,100)));
 document.documentElement.style.setProperty("--bim-ui-scale",(fs/100).toFixed(2));
 document.documentElement.style.setProperty("--bim-label-scale",(ls/100).toFixed(2));
 document.body&&document.body.setAttribute("data-edit-scope",UI_PREF.editScope||"all");
}
function syncSettingsValues(){
 const f=document.getElementById("set-font-val"),l=document.getElementById("set-label-val");
 if(f)f.textContent=Math.round(numv(UI_PREF.fontScale,100))+"%";
 if(l)l.textContent=Math.round(numv(UI_PREF.labelScale,100))+"%";
}
window.setUIFontScale=(v)=>{UI_PREF.fontScale=Math.max(85,Math.min(130,Math.round(numv(v,100))));saveUIPref();applyUIPref();syncSettingsValues();};
window.setLabelScale=(v)=>{UI_PREF.labelScale=Math.max(75,Math.min(160,Math.round(numv(v,100))));saveUIPref();applyUIPref();rebuild();syncSettingsValues();};
window.setEditScope=(v)=>{UI_PREF.editScope=(v==="temp"?"temp":"all");saveUIPref();applyUIPref();renderSettings();renderLayers();renderBar();toast(UI_PREF.editScope==="temp"?"仮設編集ロック：建物・敷地・道路は動きません":"編集ロックを解除しました","ok");};
applyUIPref();


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
 site:{active:true,w:25,d:20,dx:0,dz:0,gl:0,h:[0,0,0,0],slopeDir:"flat",slopeDiff:0}, // active=false で敷地なし（新規案件の初期状態で利用）
 blocks:[{id:1,label:"建物",f1:1,f2:3,w:20.0,d:10.0,dx:0,dz:0,ry:0}],
 road:{w:8,side:"none",dx:0,dz:0,ry:0,show:true,slope:0,
       walkDz:0,walkW:1.6,walkShow:false, // 前面歩道：前後位置・幅・表示（既定は道路のみ）
       sideDx:0,sideDz:0,             // 側道：左右・前後の微調整
       splitWalk:false},              // true=歩道を道路と独立して動かす
 roadwork:{mixerSize:"8t",pumpSize:"m4t",mountUp:0,        // 縦列検討の車種・歩道乗り上げ幅(m)
           permitPolice:"",permitRoad:"",permitOffice:""}, // 道路使用条件メモ（警察/道路局/建設事務所）
 subsurface:[],  // 地下の支障物（経路帯・範囲マーカー）{kind,x,z,w,d,ry}
 ojt:{},         // OJT検討項目の✓状態 {key:true}
 layers:{site:true,building:true,nbs:true,fence:true,scaffold:true,crane:true,vehicles:true,tempobj:true,safety:true,obstacles:true,cobj:true,annot:true,sub:true,roads:true,under:true},  // 表示レイヤー
 roads:[],       // 自分で引く道路 {pts:[{x,z}...](敷地原点基準), w:幅員, dx,dz}
 annot:[],       // 注記（地面貼り付け）{type:"zone"|"text", x,z,w,d,ry,color,text,fsize}
 poles:{n:3,pitch:18,far:true,dx:0,dz:0,ry:0},
 demo:{w:22,d:14,h:9,dx:0,dz:0,ry:0},
 tw:{mode:"plan",step:8,fenceShape:"rect",fencePts:[],fenceGateSeg:0,pitDepth:4,retainMargin:1,pilePitch:5,pileDia:0.8,pileLen:15,oldPiles:false,oldPitch:4,oldRot:0,oldExtend:2,oldDx:0,oldDz:0,steelPitch:7,crane:true,craneModel:"JCL022",craneHeight:0, craneX:18,craneZ:-2,craneJib:28,craneRot:25,radius:true,ev:true,evX:-6,evZ:null,evRy:0,fence:true,fenceH:3,fenceGate:"front",fenceAll:false,fenceDx:0,fenceDz:0,fenceRy:0,fenceW:0,fenceD:0,scaffold:true,poles:false,person:false,mixer:false,mixX:-12,mixZ:null,mixRy:0,rough:false,rufX:14,rufZ:-2,rufRy:0},
 under:{tex:null,show:true,width:40,opacity:.65,rot:0,dx:0,dz:0,pages:1,page:1,raw:null,gsiKind:"std",gsiZoom:17,gsiStatus:""},
 photo:{tex:null,show:true,width:160,opacity:.8,rot:0,dx:0,dz:0},
 nbs:[], line:false, auto:true, tab:"諸元", tabGroup:"建物", moveLayers:false,
 guide:{show:false, road:1.25, nbor:1.25},
 sun:{az:135, alt:55},
 grid:{show:false, size:1},  // グリッド表示
 roadcond:{lane:6, walk:2.5, side:"front"}, // 道路条件（車道・歩道幅員）
 cobj:[],                    // 施工オブジェクト配列（constructionObjects）
 dim:{on:false, a:null, b:null, base:"free"}, // 寸法線ツール（自由2点／敷地・建物・道路起算）
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
   {key:"10t",label:"10t級（概略）",w:2.2,d:7.7,h:3.1,out:4.2,tail:3.0,work:16,boomMin:7,boomMax:23},
   {key:"13t",label:"13t級（概略）",w:2.3,d:8.5,h:3.2,out:4.6,tail:3.2,work:18,boomMin:7.5,boomMax:28},
   {key:"16t",label:"16t級（概略）",w:2.4,d:9.0,h:3.2,out:5.0,tail:3.3,work:21,boomMin:8,boomMax:31},
   {key:"20t",label:"20t級（概略）",w:2.5,d:9.7,h:3.3,out:5.4,tail:3.5,work:24,boomMin:8.5,boomMax:33},
   {key:"25t",label:"25t級（概略）",w:2.75,d:11.5,h:3.4,out:5.8,tail:3.7,work:26,boomMin:9,boomMax:35},
   {key:"35t",label:"35t級（概略）",w:2.75,d:11.8,h:3.5,out:6.4,tail:4.0,work:30,boomMin:9.5,boomMax:37},
   {key:"50t",label:"50t級（概略）",w:3.0,d:12.5,h:3.6,out:7.0,tail:4.2,work:34,boomMin:10,boomMax:40},
   {key:"60t",label:"60t級（概略）",w:3.0,d:13.0,h:3.7,out:7.4,tail:4.4,work:37,boomMin:10.5,boomMax:44},
   {key:"70t",label:"70t級（概略）",w:3.0,d:13.5,h:3.7,out:7.8,tail:4.5,work:40,boomMin:11,boomMax:47},
   {key:"80t",label:"80t級（概略）",w:3.0,d:14.0,h:3.8,out:8.0,tail:4.7,work:43,boomMin:11.5,boomMax:50},
   {key:"100t",label:"100t級（概略）",w:3.2,d:15.0,h:3.9,out:8.4,tail:5.0,work:48,boomMin:12,boomMax:54},
   {key:"110t",label:"TADANO GR-1100EX（110t）",w:3.315,d:14.45,h:3.795,out:7.3,tail:4.39,work:48.3,boomMin:12.0,boomMax:56.0},
   {key:"145t",label:"TADANO GR-1450EX（145t・構内専用）",w:3.315,d:16.19,h:3.785,out:8.2,tail:4.6,work:54.0,boomMin:13.1,boomMax:61.0},
 ]},
 pump:{label:"コンクリポンプ車",color:0x4F7CC4,sizes:[
   {key:"s2t",label:"小型(2t)・ブーム16m級",w:2.0,d:6.5,h:3.2,out:4.0,work:16,boomMin:5,boomMax:16},
   {key:"m4t",label:"中型(4t)・ブーム24m級",w:2.3,d:9.0,h:3.6,out:5.2,work:24,boomMin:7,boomMax:24},
   {key:"l8t",label:"大型(8t)・ブーム32m級",w:2.5,d:11.5,h:3.8,out:6.4,work:32,boomMin:9,boomMax:32},
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
 towercrane:{label:"タワークレーン（追加）",color:0xF2A33C,sizes:[
   {key:"JCL015",label:"JCL015Ⅱ",w:2.5,d:2.5,h:14.3},
   {key:"JCL015_H",label:"JCL015Ⅱ 高自立",w:2.2,d:2.2,h:26.5},
   {key:"JCL021",label:"JCL021C・Ⅱ",w:2.8,d:2.8,h:14.4},
   {key:"JCL022",label:"JCL022Ⅱ",w:3.0,d:3.0,h:30.5},
 ]},
 safepath:{label:"安全通路（カラーコーン＋バー）",color:0xF28C28,sizes:[
   {key:"6m",label:"6m",w:1.2,d:6,h:0.8},
   {key:"12m",label:"12m",w:1.2,d:12,h:0.8},
   {key:"18m",label:"18m",w:1.2,d:18,h:0.8},
 ]},
 stage:{label:"乗入れ構台",color:0x8A7F72,sizes:[
   {key:"s",label:"小（幅6×長10m・高1.5m）",w:6,d:10,h:1.5},
   {key:"m",label:"中（幅8×長16m・高2.5m）",w:8,d:16,h:2.5},
   {key:"l",label:"大（幅10×長24m・高3.5m）",w:10,d:24,h:3.5},
 ]},
 komalift:{label:"コマリフト（小型荷揚げ機）",color:0x8A93A3,sizes:[
   {key:"h10",label:"マスト10m（〜3階・積載300kg）",w:1.2,d:1.8,h:10},
   {key:"h16",label:"マスト16m（〜5階・積載300kg）",w:1.2,d:1.8,h:16},
   {key:"h24",label:"マスト24m（〜7階・積載500kg）",w:1.4,d:2.0,h:24},
 ]},
 lsev:{label:"ロングスパンEV",color:0x4A6A9A,sizes:[
   {key:"h20",label:"マスト20m（〜6階）",w:3.2,d:5.0,h:20},
   {key:"h32",label:"マスト32m（〜10階）",w:3.2,d:5.0,h:32},
   {key:"h45",label:"マスト45m（〜14階）",w:3.2,d:5.0,h:45},
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
// 工程ごとの施工オブジェクト表示。新規配置は原則「配置した工程のみ」。
const COBJ_PHASE_DEFAULT={
 found:["demo","retain","pile"],backhoe:["demo","retain","pile"],
 towercrane:["steel","build"],rough:["steel","build"],mixer:["build"],pump:["build"],truck:["steel","build"],
 stage:["retain","pile","steel","build"],lsev:["build"],komalift:["build"],temp:["steel","build"],
 guard:["demo","retain","pile","steel","build"],walkzone:["demo","retain","pile","steel","build"],safepath:["demo","retain","pile","steel","build"],
 obstacle:["demo","retain","pile","steel","build","plan"]
};
function cobjVisibleInPhase(c,phase){
 if(!c)return false;
 // 完成フェーズは恒久支障物だけ。施工用の仮設物は強制的に非表示。
 if(phase==="plan")return c.type==="obstacle";
 if(c.phase==="all")return true;
 if(c.phase)return c.phase===phase;
 const a=COBJ_PHASE_DEFAULT[c.type];return a?a.includes(phase):true;
}
window.cobjVisibleInPhase=cobjVisibleInPhase;
// 指定タイプ・クラスの寸法を引く
function cobjSize(type,sizeKey){const t=COBJ_TYPES[type];if(!t)return null;const arr=t.sizes;return arr.find(s=>s.key===sizeKey)||arr[0];}
function migrateLegacyVehicles(){
 if(!U.tw)return;
 if(!Array.isArray(U.cobj))U.cobj=[];
 if(U.tw.mixer){
  if(!U.cobj.some(c=>c&&c.type==="mixer")){
   const sz=cobjSize("mixer",(U.roadwork&&U.roadwork.mixerSize)||"8t")||COBJ_TYPES.mixer.sizes[1],a=placementAnchor(5);
   U.cobj.push({type:"mixer",size:sz.key,x:numv(U.tw.mixX,a.x),z:U.tw.mixZ==null?a.z:numv(U.tw.mixZ,a.z),w:sz.w,d:sz.d,h:sz.h,ry:numv(U.tw.mixRy,0),phase:"build"});
  }
  U.tw.mixer=false;
 }
 if(U.tw.rough){
  if(!U.cobj.some(c=>c&&c.type==="rough")){
   const sz=cobjSize("rough","25t"),a=placementAnchor(4);
   U.cobj.push({type:"rough",size:"25t",x:numv(U.tw.rufX,a.x),z:numv(U.tw.rufZ,a.z),w:sz.w,d:sz.d,h:sz.h,ry:numv(U.tw.rufRy,0),phase:"build",boomPct:55,boomAngle:42,outPct:70});
  }
  U.tw.rough=false;
 }
}
window.migrateLegacyVehicles=migrateLegacyVehicles;
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
 JCL015:{label:"昭和 JCL015Ⅱ（ジブ15m/1.0t）",jib:15,work:15,cap:1.0,tail:2.38,selfH:14.3,maxInstallH:51,maxLift:63},
 JCL07175:{label:"昭和 JCL07175Ⅱ（ジブ17.5m/0.7t）",jib:17.5,work:17.5,cap:0.7,tail:2.38},
 JCL021:{label:"昭和 JCL021C・Ⅱ（ジブ21m/1.0t）",jib:21,work:21,cap:1.0,tail:2.95},
 JCL022:{label:"昭和 JCL022Ⅱ（ジブ22m/1.0t）",jib:22,work:22,cap:1.0,tail:2.58},
 JCL030:{label:"昭和 JCL030Ⅱ（ジブ30m/1.0t）",jib:30,work:30,cap:1.0,tail:2.865},
 JCL040:{label:"昭和 JCL040Ⅱ（ジブ40m/1.0t）",jib:40,work:40,cap:1.0,tail:5.8},
 // 円筒マスト・高自立タイプ（北川鉄工所カタログ）：φ457〜610の丸マスト、ベース小、尾部短い
 JCL012C_H:{label:"北川 JCL012C高自立（ジブ12m/1.0t・自立19.5m・丸マスト）",jib:12,work:12,cap:1.0,tail:2.0,mast:"tube",selfH:19.5,base:3.5},
 JCL015_H:{label:"北川 JCL015高自立（ジブ15m/1.0t・自立26.5m・丸マスト）",jib:15,work:15,cap:1.0,tail:3.0,mast:"tube",selfH:26.5,maxInstallH:51,maxLift:63,base:2.2},
 // 枠組足場上に自立する小型ジブクレーン（日工カタログ）
 NSA406A:{label:"日工 スリングエース NSA406A（ブーム6m/0.4t・全高10.6m）",jib:6,work:6,cap:0.4,tail:0.75,mast:"mini",selfH:10.6,base:0.9},
};
function craneSpec(k){return CRANE_SPECS[k]||CRANE_SPECS.JCL022;}
function primaryCraneHeight(spec,builtHeight){
 const s=spec||craneSpec(U.tw.craneModel),lo=s.selfH||8,hi=s.maxInstallH||63,manual=numv(U.tw.craneHeight,0);
 const want=manual>0?manual:Math.max(lo,numv(builtHeight,0)+8);
 return Math.max(lo,Math.min(hi,want));
}
// 敷地面積（多角形敷地があればシューレース、無ければ間口×奥行）
function siteArea(){
 if(U.site&&U.site.active===false)return 0;
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
// UI v4 Stage 3：模型・デジタルツイン寄りの落ち着いた色管理
if(THREE.sRGBEncoding!==undefined)renderer.outputEncoding=THREE.sRGBEncoding;
if(THREE.ACESFilmicToneMapping!==undefined)renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=.94;
mount.appendChild(renderer.domElement);
const scene=new THREE.Scene();
// 空のグラデーション（上：淡い青 → 地平：白っぽい）。テクスチャなのでPNG・検討シートにも写る
let _skyTex=null;
function skyTexture(){ if(_skyTex)return _skyTex;
 const cv=document.createElement("canvas");cv.width=4;cv.height=256;const c=cv.getContext("2d");
 const gr=c.createLinearGradient(0,0,0,256);gr.addColorStop(0,"#8293a7");gr.addColorStop(0.50,"#c7d0d9");gr.addColorStop(1,"#e9edf1");
 c.fillStyle=gr;c.fillRect(0,0,4,256);_skyTex=new THREE.CanvasTexture(cv);_skyTex.minFilter=THREE.LinearFilter;return _skyTex;}
const camera=new THREE.PerspectiveCamera(40,1,0.5,5000);
scene.add(new THREE.HemisphereLight(0xf4f7fb,0x687583,.76));
const sun=new THREE.DirectionalLight(0xffecd5,.98);
const fill=new THREE.DirectionalLight(0x86a8d8,.12);fill.position.set(-90,72,-80);scene.add(fill);
// 影の解像度：モバイルや低解像度端末では軽く、PCでは高精細に
const _isMobile=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)||Math.min(screen.width,screen.height)<768;
const _shadowRes=_isMobile?1024:2048;
sun.position.set(80,120,60);sun.castShadow=true;sun.shadow.mapSize.set(_shadowRes,_shadowRes);
sun.shadow.bias=-0.00012;sun.shadow.normalBias=0.025;
Object.assign(sun.shadow.camera,{left:-140,right:140,top:140,bottom:-140,far:600});
scene.add(sun);
const ctrl={theta:Math.PI/4+.3,phi:1.05,r:150,ty:18,cx:0,cz:0,ptrs:new Map(),pinch:0,panMid:null};
const _coarsePointer=matchMedia("(pointer:coarse)").matches;
const _tapMovePx=_coarsePointer?14:8;
const _longPressMs=_coarsePointer?650:550;
let _camTween=null;
function _camEase(t){return 1-Math.pow(1-t,3);}
function _thetaDelta(a,b){let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d;}
function cameraTween(to,dur=460){
 const reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 if(reduce||dur<=0){Object.assign(ctrl,to);_camTween=null;return;}
 const from={theta:ctrl.theta,phi:ctrl.phi,r:ctrl.r,ty:ctrl.ty,cx:ctrl.cx,cz:ctrl.cz};
 _camTween={from,to:Object.assign({},from,to),thetaD:_thetaDelta(from.theta,to.theta==null?from.theta:to.theta),start:performance.now(),dur};
}
function updateCameraTween(now){
 if(!_camTween)return;
 const t=Math.min(1,(now-_camTween.start)/_camTween.dur),e=_camEase(t),a=_camTween.from,b=_camTween.to;
 ctrl.theta=a.theta+_camTween.thetaD*e;
 for(const k of ["phi","r","ty","cx","cz"])ctrl[k]=a[k]+(b[k]-a[k])*e;
 if(t>=1)_camTween=null;
}
window.cameraTween=cameraTween;

let _selCamBase=null,_selCamKey=null,_selCueTimer=null;
function _selectionModelKey(key){
 const k=String(key||"");
 if(k.startsWith("bpt:"))return "blk:"+k.split(":")[1];
 if(k.startsWith("rpt:"))return "rd:"+k.split(":")[1];
 if(k.startsWith("fpt:"))return "fence";
 if(k.startsWith("spt:"))return "site";
 return k;
}
function _selectionLabel(key){
 const k=String(key||"");
 if(k==="crane")return "TOWER CRANE";
 if(k==="ev")return "LONG SPAN EV";
 if(k==="fence"||k.startsWith("fpt:"))return "TEMPORARY FENCE";
 if(k.startsWith("co:")){const c=U.cobj[+k.slice(3)],t=c&&COBJ_TYPES[c.type];return t?(t.label||"CONSTRUCTION OBJECT"):"CONSTRUCTION OBJECT";}
 if(k.startsWith("blk:")||k.startsWith("bpt:")){const i=+(k.startsWith("blk:")?k.slice(4):k.slice(4).split(":")[0]);return ((U.blocks[i]||{}).label||"BUILDING").toUpperCase();}
 if(k.startsWith("nb:"))return "NEIGHBOR BUILDING";
 if(k.startsWith("rd:")||k.startsWith("rpt:"))return "ROAD";
 if(k==="site"||k.startsWith("spt:"))return "SITE";
 return "OBJECT";
}
function v4SelectionCue(key,release){
 let el=document.getElementById("v4-selection-cue");
 if(!el){el=document.createElement("div");el.id="v4-selection-cue";document.body.appendChild(el);}
 clearTimeout(_selCueTimer);
 el.className="";
 el.innerHTML=release?`<small>VIEW</small><b>RELEASED</b>`:`<small>OBJECT LOCKED</small><b>${_selectionLabel(key)}</b>`;
 requestAnimationFrame(()=>el.classList.add("show",release?"release":"lock"));
 _selCueTimer=setTimeout(()=>{el.className="";},560);
}
function focusSelectionCamera(key,opt){
 const o=opt||{},mk=_selectionModelKey(key);
 if(!mk||["site","road","roadwalk","roadside"].includes(mk)||mk.startsWith("rd:"))return;
 const target=dragMap&&dragMap[mk];if(!target||target.visible===false)return;
 try{
  target.updateWorldMatrix&&target.updateWorldMatrix(true,true);
  const b3=new THREE.Box3().setFromObject(target);if(b3.isEmpty())return;
  const center=new THREE.Vector3(),size=new THREE.Vector3();b3.getCenter(center);b3.getSize(size);
  if(!_selCamBase)_selCamBase={theta:ctrl.theta,phi:ctrl.phi,r:ctrl.r,ty:ctrl.ty,cx:ctrl.cx,cz:ctrl.cz};
  _selCamKey=String(key);
  const simple=document.body.classList.contains("simple"),strength=simple?.24:.34,zoom=simple?.95:.90;
  const span=Math.max(size.x,size.y*.75,size.z,1);
  const minR=Math.max(30,Math.min(105,span*1.55));
  const to={
   theta:ctrl.theta,
   phi:Math.min(1.42,Math.max(.3,ctrl.phi)),
   r:Math.max(minR,ctrl.r*zoom),
   cx:ctrl.cx+(center.x-ctrl.cx)*strength,
   cz:ctrl.cz+(center.z-ctrl.cz)*strength,
   ty:ctrl.ty+(Math.max(.6,center.y)-ctrl.ty)*(simple?.14:.20)
  };
  cameraTween(to,o.duration||280);
  if(o.cue!==false)v4SelectionCue(key,false);
 }catch(e){}
}
function releaseSelectionCamera(opt){
 const o=opt||{},base=_selCamBase;
 _selCamBase=null;_selCamKey=null;
 if(base&&o.restore!==false)cameraTween(base,o.duration||300);
 if(o.cue!==false)v4SelectionCue("",true);
}
function clearSelection(opt){
 const o=opt||{};U.sel=null;renderSelCard();rebuild();
 releaseSelectionCamera({restore:o.restore!==false,cue:o.cue!==false,duration:o.duration||300});
 if(typeof renderMobile==="function")renderMobile();
}
window.focusSelectionCamera=focusSelectionCamera;
window.releaseSelectionCamera=releaseSelectionCamera;
window.clearSelection=clearSelection;

let model=null, dragMap={}, dragObj=null, dragOff=new THREE.Vector3(), dragStart=null, _tapCand=null, _lpTimer=null;
const ray=new THREE.Raycaster();

function groundPoint(e){
 const r=renderer.domElement.getBoundingClientRect();
 const v=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
 ray.setFromCamera(v,camera);
 const t=-ray.ray.origin.y/ray.ray.direction.y;
 return ray.ray.origin.clone().add(ray.ray.direction.clone().multiplyScalar(t));
}
function dimBasePoint(kind){
 const sdx=numv(U.site.dx,0),sdz=numv(U.site.dz,0);
 if(kind==="site")return {x:sdx,z:sdz,label:"敷地中心"};
 if(kind==="building"){
  const b=(U.blocks||[])[0];if(!b)return {x:sdx,z:sdz,label:"建物中心"};
  return {x:sdx+numv(b.dx,0),z:sdz+numv(b.dz,0),label:"建物中心"};
 }
 if(kind==="road"){
  const r=(U.roads||[])[0];
  if(r&&Array.isArray(r.pts)&&r.pts.length>=2){
   const pts=rotPts(r.pts,numv(r.ry,0)),a=pts[0],b=pts[pts.length-1];
   return {x:sdx+numv(r.dx,0)+(a.x+b.x)/2,z:sdz+numv(r.dz,0)+(a.z+b.z)/2,label:"道路中心"};
  }
  const rw=Math.min(20,Math.max(4,numv(U.road.w,8)));
  return {x:sdx+numv(U.road.dx,0),z:sdz+posv(U.site.d,18)/2+1.6+rw/2+numv(U.road.dz,0),label:"道路中心"};
 }
 return null;
}
window.setDimBase=(kind)=>{
 if(!U.dim)U.dim={on:true,a:null,b:null,base:"free"};
 U.dim.on=true;U.dim.base=kind||"free";U.dim.b=null;
 const p=dimBasePoint(U.dim.base);U.dim.a=p?{x:+p.x.toFixed(2),z:+p.z.toFixed(2)}:null;
 rebuild();renderPanel();renderBar();
 toast(p?p.label+"を起算点にしました":"自由2点：1点目をクリックしてください","ok");
};
function refDistanceText(x,z){
 const kinds=["site","building","road"],parts=[];
 for(const k of kinds){const p=dimBasePoint(k);if(p)parts.push(p.label.replace("中心","")+" "+Math.hypot(x-p.x,z-p.z).toFixed(1)+"m");}
 return parts.join(" / ");
}

// 画面のドラッグ量(px)から注視点を平行移動（カメラ方位に正しく追従）
function panBy(dxp,dyp){
 const th=ctrl.theta, ph=ctrl.phi;
 // カメラ→注視点の水平前方ベクトル（正規化）
 let fx=-Math.cos(th), fz=-Math.sin(th);
 // 画面右ベクトル（y軸まわり）：(fx,fz)→(fz,-fx)
 const rx=fz, rz=-fx;
 const k=ctrl.r*(_coarsePointer?0.00112:0.0015);  // 指操作は少し穏やかに
 // 指を右(dxp>0)→ワールドが右に動く→注視点は-right。指を下(dyp>0)→注視点は+fwd（奥）
 ctrl.cx += (rx*dxp + fx*dyp)*k;
 ctrl.cz += (rz*dxp + fz*dyp)*k;
}
function _tempDragKey(k){
 if(["crane","ev","mixer","rough","fence"].includes(k)||k.startsWith("fpt:"))return true;
 if(k.startsWith("co:")){const c=U.cobj[+k.slice(3)];return !!c&&c.type!=="obstacle";}
 return false;
}
function dragCandidates(){const small=["crane","ev","mixer","rough","poles","demo","road","roadwalk","roadside","fence"];const out=[],tempOnly=(UI_PREF.editScope==="temp");
 for(const[k,o]of Object.entries(dragMap)){
  if(tempOnly&&!_tempDragKey(k))continue;
  if(small.includes(k)||k.startsWith("nb:")||k.startsWith("blk:")||k.startsWith("co:")||k.startsWith("sub:")||k.startsWith("an:")||k.startsWith("fpt:")||k.startsWith("spt:")||k.startsWith("bpt:")||k.startsWith("rd:")||k.startsWith("rpt:"))out.push(o);
  else if(!tempOnly&&(k==="site"||k==="under"||k==="photo"||k==="dxf")&&U.moveLayers)out.push(o);}
 return out;}
function pickDrag(e){
 const r=renderer.domElement.getBoundingClientRect();
 const v=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
 ray.setFromCamera(v,camera);
 const hits=ray.intersectObjects(dragCandidates(),true);
 for(const h of hits){
  // 非表示（レイヤーで隠した）物は拾わない：親をたどって visible=false があれば無視
  let vis=true;for(let q=h.object;q;q=q.parent){if(q.visible===false){vis=false;break;}} if(!vis)continue;
  let o=h.object;while(o&&!o.userData.dragKey)o=o.parent;if(o)return o;}
 return null;
}
const el=renderer.domElement; el.style.touchAction="none"; el.style.webkitUserSelect="none"; el.style.userSelect="none"; el.style.webkitTouchCallout="none";
el.addEventListener("contextmenu",(e)=>e.preventDefault());   // 長押しの選択・コピー吹き出しを出さない
let rotMode=false, rotStartX=0, rotStartRy=0;
function objRyKey(k){
 if(k==="crane")return ["tw","craneRot"]; if(k==="ev")return ["tw","evRy"];
 if(k==="mixer")return ["tw","mixRy"]; if(k==="rough")return ["tw","rufRy"];
 if(k==="poles")return ["poles","ry"]; if(k==="demo")return ["demo","ry"];
 if(k==="under")return ["under","rot"]; if(k==="photo")return ["photo","rot"];
 if(k==="road"||k==="roadwalk"||k==="roadside")return ["road","ry"];
 if(k==="fence")return ["tw","fenceRy"];
 if(k.startsWith("nb:"))return ["nb",+k.slice(3)];
 if(k.startsWith("blk:"))return ["blk",+k.slice(4)];
 if(k.startsWith("co:"))return ["co",+k.slice(3)];
 if(k.startsWith("sub:"))return ["sub",+k.slice(4)];
 if(k.startsWith("an:"))return ["an",+k.slice(3)];
 if(k.startsWith("rd:"))return ["rd",+k.slice(3)];
 return null;
}
function getRy(k){const r=objRyKey(k);if(!r)return 0;
 if(r[0]==="tw")return numv(U.tw[r[1]],0); if(r[0]==="poles")return numv(U.poles.ry,0); if(r[0]==="demo")return numv(U.demo.ry,0);
 if(r[0]==="road")return numv(U.road.ry,0);
 if(r[0]==="under")return numv(U.under.rot,0); if(r[0]==="photo")return numv(U.photo.rot,0);
 if(r[0]==="nb")return numv((U.nbs[r[1]]||{}).ry,0); if(r[0]==="blk")return numv((U.blocks[r[1]]||{}).ry,0);
 if(r[0]==="co")return numv((U.cobj[r[1]]||{}).ry,0);
 if(r[0]==="sub")return numv((U.subsurface[r[1]]||{}).ry,0);
 if(r[0]==="an")return numv((U.annot[r[1]]||{}).ry,0);
 if(r[0]==="rd")return numv((U.roads[r[1]]||{}).ry,0);
 return 0;}
function setRy(k,deg){const r=objRyKey(k);if(!r)return;deg=((deg%360)+360)%360;
 if(r[0]==="tw")U.tw[r[1]]=+deg.toFixed(0);
 else if(r[0]==="poles")U.poles.ry=+deg.toFixed(0);
 else if(r[0]==="demo")U.demo.ry=+deg.toFixed(0);
 else if(r[0]==="road")U.road.ry=+deg.toFixed(0);
 else if(r[0]==="under")U.under.rot=+deg.toFixed(1);
 else if(r[0]==="photo")U.photo.rot=+deg.toFixed(1);
 else if(r[0]==="nb"){if(U.nbs[r[1]])U.nbs[r[1]].ry=+deg.toFixed(0);}
 else if(r[0]==="blk"){if(U.blocks[r[1]])U.blocks[r[1]].ry=+deg.toFixed(0);}
 else if(r[0]==="co"){if(U.cobj[r[1]])U.cobj[r[1]].ry=+deg.toFixed(0);}
 else if(r[0]==="sub"){if(U.subsurface[r[1]])U.subsurface[r[1]].ry=+deg.toFixed(0);}
 else if(r[0]==="an"){if(U.annot[r[1]])U.annot[r[1]].ry=+deg.toFixed(0);}
 else if(r[0]==="rd"){if(U.roads[r[1]])U.roads[r[1]].ry=+deg.toFixed(0);}}
el.addEventListener("pointerdown",(e)=>{
 _camTween=null; // 手で触れた瞬間は進行中の演出を止める（フォーカス復帰点はまだ保持）
 ctrl.ptrs.set(e.pointerId,[e.clientX,e.clientY]);el.setPointerCapture(e.pointerId);
 // 多角形入力モード：地面クリックで頂点追加
 if(U.polyInput.on&&ctrl.ptrs.size===1){const gp=groundPoint(e);
  U.polyInput.pts.push({x:+(gp.x-numv(U.site.dx,0)).toFixed(2),z:+(gp.z-numv(U.site.dz,0)).toFixed(2)});
  rebuild();renderPanel();return;}
 // 下敷きの切り取り：対角2点クリック
 if(U.under&&U.under._crop&&U.under._crop.on&&ctrl.ptrs.size===1){const gp=groundPoint(e);
  if(!U.under._crop.a){U.under._crop.a={x:gp.x,z:gp.z};renderPanel();toast("1点目を取得。対角の2点目をクリック");}
  else{cropUnder(U.under._crop.a,{x:gp.x,z:gp.z});}
  return;}
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
 if(U.dim.on&&ctrl.ptrs.size===1){const gp=groundPoint(e),base=U.dim.base||"free";
  if(base!=="free"){
   const p=dimBasePoint(base);if(p)U.dim.a={x:+p.x.toFixed(2),z:+p.z.toFixed(2)};
   U.dim.b={x:+gp.x.toFixed(2),z:+gp.z.toFixed(2)};
  }else if(!U.dim.a){U.dim.a={x:+gp.x.toFixed(2),z:+gp.z.toFixed(2)};U.dim.b=null;}
  else if(!U.dim.b){U.dim.b={x:+gp.x.toFixed(2),z:+gp.z.toFixed(2)};}
  else {U.dim.a={x:+gp.x.toFixed(2),z:+gp.z.toFixed(2)};U.dim.b=null;}
  rebuild();renderBar();renderPanel();return;}
 if(ctrl.ptrs.size===1 && !e.shiftKey){const _simple=document.body.classList.contains("simple");
  let o=pickDrag(e);
  if(_simple&&o){
   const key=o.userData.dragKey;
   _tapCand={key,x:e.clientX,y:e.clientY,t:Date.now()};
   clearTimeout(_lpTimer);_lpTimer=setTimeout(()=>{if(_tapCand&&_tapCand.key===key){_tapCand=null;U.sel=key;dragObj=null;ctrl.ptrs.clear();openObjMenu(key);}},_longPressMs);
   if(U.sel!==key){o=null;}
  }
  if(o){snapshot();dragObj=o;U.sel=o.userData.dragKey;
   if(e.ctrlKey||e.metaKey){rotMode=true;rotStartX=e.clientX;rotStartRy=getRy(o.userData.dragKey);}
   else{rotMode=false;const gp=groundPoint(e);dragOff.set(o.position.x-gp.x,0,o.position.z-gp.z);dragStart={lx:o.position.x,lz:o.position.z,gx:gp.x,gz:gp.z};}
   U.auto=false;syncBtns();renderSelCard();}else{if(U.sel){clearSelection({restore:true});}}}
});
el.addEventListener("pointermove",(e)=>{
 if(_tapCand&&Math.hypot(e.clientX-_tapCand.x,e.clientY-_tapCand.y)>_tapMovePx){_tapCand=null;clearTimeout(_lpTimer);}
 if(!ctrl.ptrs.has(e.pointerId))return;
 const prev=ctrl.ptrs.get(e.pointerId);ctrl.ptrs.set(e.pointerId,[e.clientX,e.clientY]);
 if(dragObj&&rotMode&&ctrl.ptrs.size===1){setRy(dragObj.userData.dragKey,rotStartRy+(e.clientX-rotStartX)*0.7);rebuild();return;}
 if(dragObj&&ctrl.ptrs.size===1){const gp=groundPoint(e);
  const dk=dragObj.userData.dragKey||"";
  if(dragObj.userData.parentRy!=null&&dragStart){ // 頂点ハンドル：親の回転を打ち消した差分で動かし、他の頂点へ吸着
   const th=numv(dragObj.userData.parentRy,0)*Math.PI/180, c=Math.cos(th), s=Math.sin(th);
   const pw=dragObj.parent; const ox=pw.position.x, oz=pw.position.z;
   const wx0=ox+dragStart.lx*c+dragStart.lz*s, wz0=oz-dragStart.lx*s+dragStart.lz*c;
   let wx=wx0+(gp.x-dragStart.gx), wz=wz0+(gp.z-dragStart.gz);
   if(U.snap!==false){
    let best=null,bd=0.6; for(const q of vertexWorldList(dk)){const d=Math.hypot(q.x-wx,q.z-wz);if(d<bd){bd=d;best=q;}}
    if(best){wx=best.x;wz=best.z;}else{wx=Math.round(wx*10)/10;wz=Math.round(wz*10)/10;}
   }
   const dx=wx-ox, dz=wz-oz; dragObj.position.x=dx*c-dz*s; dragObj.position.z=dx*s+dz*c;
  }else{dragObj.position.x=gp.x+dragOff.x;dragObj.position.z=gp.z+dragOff.z;}
  return;}
 if(ctrl.ptrs.size===1){
   if(_selCamBase){_selCamBase=null;_selCamKey=null;} // カメラを手で動かしたら、その視点を新しい基準にする
   if(e.ctrlKey||e.metaKey){ // Ctrl+ドラッグ＝視点回転。通常操作と明確に分離
    const rs=_coarsePointer?.00435:.006,ps=_coarsePointer?.00315:.004,dy=(e.clientY-prev[1]);
    ctrl.theta-=(e.clientX-prev[0])*rs;
    ctrl.phi=Math.min(1.52,Math.max(.12,ctrl.phi+(_coarsePointer?dy:-dy)*ps));
    U.auto=false;syncBtns();
   }else{ // 通常ドラッグ＝画面移動（パン）
    panBy(e.clientX-prev[0], e.clientY-prev[1]);
    U.auto=false;
   }
 }
 else if(ctrl.ptrs.size===2){if(_selCamBase){_selCamBase=null;_selCamKey=null;}const p=[...ctrl.ptrs.values()];
   const d=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);
   const mid=[(p[0][0]+p[1][0])/2,(p[0][1]+p[1][1])/2];
   // ピンチでズーム
   if(ctrl.pinch){const ratio=ctrl.pinch/d;ctrl.r=Math.min(800,Math.max(20,ctrl.r*Math.pow(ratio,_coarsePointer?.72:1)));}
   // 2本指の中心移動でパン（注視点を平行移動）→「見たい場所を画面中央に」
   if(ctrl.panMid)panBy(-(mid[0]-ctrl.panMid[0]), -(mid[1]-ctrl.panMid[1]));   // 指の動きに画面が付いてくる向き
   ctrl.pinch=d; ctrl.panMid=mid; U.auto=false; syncBtns();
  }
});
const endPtr=(e)=>{ctrl.ptrs.delete(e.pointerId);ctrl.pinch=0;ctrl.panMid=null;
 clearTimeout(_lpTimer);
 if(_tapCand&&Date.now()-_tapCand.t<_longPressMs&&Math.hypot(e.clientX-_tapCand.x,e.clientY-_tapCand.y)<=_tapMovePx){const k=_tapCand.key;_tapCand=null;
  if(U.sel!==k){U.sel=k;dragObj=null;rebuild();focusSelectionCamera(k,{duration:260});renderPanel();renderMobile();toast("選択しました。ドラッグで移動、長押しでメニュー");return;}}
 _tapCand=null;
 if(dragObj&&!rotMode){const k=dragObj.userData.dragKey,x=dragObj.position.x,z=dragObj.position.z;
  const _clickLike=!!(dragStart&&Math.hypot(x-dragStart.lx,z-dragStart.lz)<0.12);
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
     if(U.road.show!==false&&Math.abs(nz-roadZ)<1.5){nz=+roadZ.toFixed(1);}   // 自動道路が表示中のときだけ中心へ吸着
     // 近くの敷鉄板に平行寄せ
     U.cobj.forEach((o,oi)=>{if(o!==c&&o.type==="temp"&&o.size==="plate"){
       if(Math.hypot(numv(o.x,0)-nx,numv(o.z,0)-nz)<3){c.ry=numv(o.ry,0);}}});
    }
    if(U.snap!==false&&!ROADCLEAR_SKIP.has(c.type)){const hd=nearestRoadHeading(nx,nz);if(hd!=null)c.ry=hd;}   // なぞった道路の向きへ
    c.x=nx;c.z=nz;}}
  if(k.startsWith("sub:")){const s=U.subsurface[+k.slice(4)];if(s){s.x=+x.toFixed(1);s.z=+z.toFixed(1);}}
  if(k.startsWith("an:")){const a=U.annot[+k.slice(3)];if(a){a.x=+x.toFixed(1);a.z=+z.toFixed(1);}}
  if(k.startsWith("fpt:")){const p=U.tw.fencePts[+k.slice(4)];if(p){p.x=+x.toFixed(2);p.z=+z.toFixed(2);}}  // 位置はグループ内ローカル座標
  if(k.startsWith("spt:")){const p=(U.site.poly||[])[+k.slice(4)];if(p){p.x=+x.toFixed(2);p.z=+z.toFixed(2);}}
  if(k.startsWith("rd:")){const r=U.roads[+k.slice(3)];if(r){r.dx=+(x-numv(U.site.dx,0)).toFixed(1);r.dz=+(z-numv(U.site.dz,0)).toFixed(1);}}
  if(k.startsWith("rpt:")){const [ri,vi]=k.slice(4).split(":").map(Number);const r=U.roads[ri];const p=r&&r.pts&&r.pts[vi];if(p){p.x=+x.toFixed(2);p.z=+z.toFixed(2);}}
  if(k.startsWith("bpt:")){const [bi,vi]=k.slice(4).split(":").map(Number);const b=U.blocks[bi];const p=b&&b.poly&&b.poly[vi];if(p){p.x=+x.toFixed(2);p.z=+z.toFixed(2);}}
  dragObj=null;dragStart=null;rebuild();if(_clickLike)focusSelectionCamera(k,{duration:280});renderPanel();}
 else if(dragObj&&rotMode){
   if(U.snap){const k=dragObj.userData.dragKey;const cur=getRy(k);setRy(k,Math.round(cur/15)*15);rebuild();}
   dragObj=null;rotMode=false;renderPanel();}
};
el.addEventListener("pointerup",endPtr);el.addEventListener("pointercancel",endPtr);
el.addEventListener("wheel",(e)=>{e.preventDefault(); _camTween=null;if(_selCamBase){_selCamBase=null;_selCamKey=null;} if((e.ctrlKey||e.metaKey)&&dragObj){setRy(dragObj.userData.dragKey,getRy(dragObj.userData.dragKey)+(e.deltaY>0?5:-5));rebuild();return;}
 ctrl.r=Math.min(800,Math.max(20,ctrl.r*(1+e.deltaY*.001)));},{passive:false});
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
el.addEventListener("dblclick",(e)=>{
 if(U.polyInput.on&&U.polyInput.target==="road"&&U.polyInput.pts.length>=2){
  // 道路：開いた折れ線として確定（連続する近接点は間引く）
  const raw=U.polyInput.pts.slice(); const pts=[]; raw.forEach(p=>{const q=pts[pts.length-1];if(!q||Math.hypot(p.x-q.x,p.z-q.z)>0.3)pts.push(p);});
  if(pts.length>=2){snapshot();U.roads.push({pts,w:Math.min(20,Math.max(3,numv(U.road.w,6))),dx:0,dz:0});U.sel="rd:"+(U.roads.length-1);}
  U.polyInput.on=false;U.polyInput.pts=[];U.polyInput.target=null;
  rebuild();renderPanel();renderBar();toast("道路を追加しました。頂点をドラッグで修正、幅は敷地・地形タブで","ok");return;
 }
 if(U.polyInput.on&&U.polyInput.pts.length>=3){
  {const raw=U.polyInput.pts.slice();const d=[];raw.forEach(p=>{const q=d[d.length-1];if(!q||Math.hypot(p.x-q.x,p.z-q.z)>0.3)d.push(p);});
   if(d.length>=2){const a=d[0],b=d[d.length-1];if(Math.hypot(a.x-b.x,a.z-b.z)<=0.3)d.pop();}   // 始点と終点が重なる場合も間引く
   if(d.length<3){toast("頂点が3点未満です。もう少し打ってからダブルクリックしてください","err");return;}
   U.polyInput.pts=d;}
  if(U.polyInput.target==="site"){
   // 敷地形状（不整形地）として確定
   U.site.active=true;U.site.poly=U.polyInput.pts.slice();
   U.polyInput.on=false; U.polyInput.pts=[]; U.polyInput.target=null;
   rebuild();renderPanel();renderBar();
  }else if(U.polyInput.target==="fence"){
   // 仮囲いの任意形状として確定（敷地原点基準・fenceDx/Dz/Ry は0に戻す）
   snapshot();
   U.tw.fencePts=U.polyInput.pts.slice(); U.tw.fenceShape="poly"; U.tw.fenceDx=0; U.tw.fenceDz=0; U.tw.fenceRy=0; U.tw.fenceGateSeg=0;
   U.polyInput.on=false; U.polyInput.pts=[]; U.polyInput.target=null;
   rebuild();renderPanel();renderBar(); toast("仮囲いを任意形状で作成しました。頂点（橙の球）をドラッグで修正できます","ok");
  }else{
   U.blocks.push({id:Date.now(),label:"多角形",f1:1,f2:Math.max(1,Math.round(posv(U.p.floors,3))),shape:"poly",poly:U.polyInput.pts.slice(),dx:0,dz:0,ry:0});
   U.polyInput.on=false;U.polyInput.pts=[];U.polyInput.target=null;
   rebuild();renderPanel();renderBar();
  }
 }
});
addEventListener("resize",resize);resize();
(function loop(now){requestAnimationFrame(loop);updateCameraTween(now||performance.now());if(U.auto&&!_camTween)ctrl.theta+=.0035;
 camera.position.set(ctrl.cx+ctrl.r*Math.sin(ctrl.phi)*Math.cos(ctrl.theta),ctrl.ty+ctrl.r*Math.cos(ctrl.phi),ctrl.cz+ctrl.r*Math.sin(ctrl.phi)*Math.sin(ctrl.theta));
 camera.lookAt(ctrl.cx,ctrl.ty,ctrl.cz);renderer.render(scene,camera);})(performance.now());

// ───── 地形 ─────
function terrainH(x,z,sw,sd,h){ // h:[前左,前右,奥左,奥右] 前=+z
 const u=Math.min(1,Math.max(0,(x+sw/2)/sw)), v=Math.min(1,Math.max(0,(z+sd/2)/sd));
 const back=h[2]+(h[3]-h[2])*u, front=h[0]+(h[1]-h[0])*u;
 return back+(front-back)*v;
}

// ───── なぞり道具：頂点ハンドル・辺の長さラベル・点列の回転（rebuildから呼ぶ）─────
// 回転の向きは矩形ブロック（rotation.y=θ）と同じ：world=(x cosθ + z sinθ, -x sinθ + z cosθ)
function rotPts(pts,deg){const t=numv(deg,0)*Math.PI/180,c=Math.cos(t),s=Math.sin(t);return pts.map(p=>({x:p.x*c+p.z*s,z:-p.x*s+p.z*c}));}
const _lblCache={};
function edgeLabelSprite(text){
 let tex=_lblCache[text];
 if(!tex){const cv=document.createElement("canvas");const px=56;const c=cv.getContext("2d");c.font=`bold ${px}px sans-serif`;const w=Math.ceil(c.measureText(text).width);cv.width=w+px*0.7;cv.height=px*1.5;
  const c2=cv.getContext("2d");c2.font=`bold ${px}px sans-serif`;c2.textBaseline="middle";c2.fillStyle="rgba(255,255,255,0.92)";
  const r=px*0.35,W=cv.width,H=cv.height;c2.beginPath();c2.moveTo(r,0);c2.lineTo(W-r,0);c2.quadraticCurveTo(W,0,W,r);c2.lineTo(W,H-r);c2.quadraticCurveTo(W,H,W-r,H);c2.lineTo(r,H);c2.quadraticCurveTo(0,H,0,H-r);c2.lineTo(0,r);c2.quadraticCurveTo(0,0,r,0);c2.closePath();c2.fill();
  c2.fillStyle="#16243D";c2.fillText(text,px*0.35,H/2);tex=new THREE.CanvasTexture(cv);tex.minFilter=THREE.LinearFilter;_lblCache[text]=tex;}
 const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false,depthWrite:false,transparent:true}));
 const asp=tex.image.width/tex.image.height,ls=Math.max(.75,Math.min(1.6,numv(UI_PREF.labelScale,100)/100)); sp.scale.set(1.6*asp*ls,1.6*ls,1); return sp;
}
function addVertexTools(parent,pts,keyPrefix,yAt,color,ryDeg,showLabels){
 const n=pts.length;
 pts.forEach((p,i)=>{
  const key=keyPrefix+i, sel=(U.sel===key);
  const hm=new THREE.Mesh(new THREE.SphereGeometry(sel?0.55:0.42,12,12),new THREE.MeshLambertMaterial({color:sel?0xE8442B:color}));
  hm.position.set(p.x,yAt(p.x,p.z),p.z); hm.userData.dragKey=key; hm.userData.parentRy=numv(ryDeg,0); parent.add(hm); dragMap[key]=hm;
 });
 if(showLabels){for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n];const len=Math.hypot(b.x-a.x,b.z-a.z);if(len<0.3)continue;
  const sp=edgeLabelSprite(len.toFixed(1)+"m");const mx=(a.x+b.x)/2,mz=(a.z+b.z)/2;sp.position.set(mx,yAt(mx,mz)+0.6,mz);parent.add(sp);}}
}
function vertexWorldList(excludeKey){
 const out=[]; const sdx=numv(U.site.dx,0), sdz=numv(U.site.dz,0);
 if(U.site.active!==false&&Array.isArray(U.site.poly))U.site.poly.forEach((p,i)=>{if("spt:"+i!==excludeKey)out.push({x:sdx+p.x,z:sdz+p.z});});
 (U.blocks||[]).forEach((b,bi)=>{if(b.shape==="poly"&&Array.isArray(b.poly)){const ox=sdx+numv(b.dx,0),oz=sdz+numv(b.dz,0);rotPts(b.poly,b.ry).forEach((p,i)=>{if(`bpt:${bi}:${i}`!==excludeKey)out.push({x:ox+p.x,z:oz+p.z});});}});
 if(U.tw.fenceShape==="poly"&&Array.isArray(U.tw.fencePts)){const ox=sdx+numv(U.tw.fenceDx,0),oz=sdz+numv(U.tw.fenceDz,0);rotPts(U.tw.fencePts,U.tw.fenceRy).forEach((p,i)=>{if("fpt:"+i!==excludeKey)out.push({x:ox+p.x,z:oz+p.z});});}
 (U.roads||[]).forEach((r,ri)=>{const ox=sdx+numv(r.dx,0),oz=sdz+numv(r.dz,0);rotPts(r.pts||[],r.ry).forEach((p,i)=>{if(`rpt:${ri}:${i}`!==excludeKey)out.push({x:ox+p.x,z:oz+p.z});});});
 return out;
}

// ───── なぞった道路の残り幅判定：置いた車両・重機が道路幅のどこを占めるかを計算 ─────
//  車両はローカルx=幅(w)・z=長さ(d)、rotation.y=ry。道路は折れ線の各区間（幅W）。
//  区間に対する車両の横方向の占有帯 [d-e, d+e] を集め、道路幅 [-W/2, W/2] の中で最大の空き＝残り幅。
const ROADCLEAR_SKIP=new Set(["walkzone","guard","obstacle"]);
// 車両位置に最も近いなぞった道路区間の向き（度）を返す。道路上でなければ null
function nearestRoadHeading(cx,cz){
 const sdx=numv(U.site.dx,0), sdz=numv(U.site.dz,0); let best=null;
 (U.roads||[]).forEach(r=>{const pts=rotPts(r.pts||[],r.ry);const W=Math.min(20,Math.max(3,numv(r.w,6)));const ox=sdx+numv(r.dx,0),oz=sdz+numv(r.dz,0);
  for(let i=0;i<pts.length-1;i++){const ax=ox+pts[i].x,az=oz+pts[i].z,bx=ox+pts[i+1].x,bz=oz+pts[i+1].z;const L2=(bx-ax)**2+(bz-az)**2;if(L2<0.01)continue;
   const t=((cx-ax)*(bx-ax)+(cz-az)*(bz-az))/L2;if(t<-0.05||t>1.05)continue;const px=ax+t*(bx-ax),pz=az+t*(bz-az);const dist=Math.hypot(cx-px,cz-pz);
   if(dist<=W/2+1.5&&(!best||dist<best.dist))best={dist,deg:Math.atan2(bx-ax,bz-az)*180/Math.PI};}});   // 車両のz軸(長さ)を区間方向へ
 return best?+(((best.deg%360)+360)%360).toFixed(0):null;
}
window.nearestRoadHeading=nearestRoadHeading;
function roadClearance(){
 const res=[]; const sdx=numv(U.site.dx,0), sdz=numv(U.site.dz,0);
 (U.cobj||[]).forEach(c=>{c._roadRemain=null;});
 (U.roads||[]).forEach((r,ri)=>{
  const pts=rotPts(r.pts||[],r.ry); const W=Math.min(20,Math.max(3,numv(r.w,6))); const ox=sdx+numv(r.dx,0), oz=sdz+numv(r.dz,0);
  const bands=[], vehs=[];
  (U.cobj||[]).forEach((c,ci)=>{
   if(!cobjVisibleInPhase(c,U.tw.mode))return;
   if(ROADCLEAR_SKIP.has(c.type)||c.type==="towercrane"||c.type==="safepath")return;
   const sz=cobjSize(c.type,c.size)||{w:2.5,d:7}; const vw=posv(c.w,sz.w), vd=posv(c.d,sz.d);
   const cx=numv(c.x,0), cz=numv(c.z,0), ry=numv(c.ry,0)*Math.PI/180;
   const xax=[Math.cos(ry),-Math.sin(ry)], zax=[Math.sin(ry),Math.cos(ry)];   // three.js rotation.y の軸
   let best=null;
   for(let i=0;i<pts.length-1;i++){
    const ax=ox+pts[i].x, az=oz+pts[i].z, bx=ox+pts[i+1].x, bz=oz+pts[i+1].z;
    const L2=(bx-ax)**2+(bz-az)**2; if(L2<0.01)continue;
    const t=((cx-ax)*(bx-ax)+(cz-az)*(bz-az))/L2; if(t<-0.05||t>1.05)continue;
    const px=ax+t*(bx-ax), pz=az+t*(bz-az); const len=Math.sqrt(L2); const nx=-(bz-az)/len, nz=(bx-ax)/len;
    const d=(cx-px)*nx+(cz-pz)*nz;                                            // 中心線からの横ずれ（法線方向）
    const e=Math.abs(vw/2*(xax[0]*nx+xax[1]*nz))+Math.abs(vd/2*(zax[0]*nx+zax[1]*nz)); // 横方向の半幅
    if(Math.abs(d)-e>W/2+0.3)continue;                                        // 道路の外
    if(!best||Math.abs(d)<Math.abs(best.d))best={d,e,seg:i};
   }
   if(best){bands.push([best.d-best.e,best.d+best.e]);vehs.push({ci,d:best.d,e:best.e});}
  });
  if(!vehs.length){res.push({ri,W,n:0,remain:W,lv:"na"});return;}
  // 占有帯を統合し、道路幅内の空きの最大値を求める
  const lo=-W/2, hi=W/2; bands.sort((a,b)=>a[0]-b[0]); const merged=[];
  for(const b of bands){const cb=[Math.max(lo,b[0]),Math.min(hi,b[1])]; if(cb[1]<=cb[0])continue; const m=merged[merged.length-1]; if(m&&cb[0]<=m[1])m[1]=Math.max(m[1],cb[1]); else merged.push(cb);}
  let remain=0, cur=lo; for(const m of merged){remain=Math.max(remain,m[0]-cur);cur=Math.max(cur,m[1]);} remain=Math.max(remain,hi-cur);
  remain=+remain.toFixed(1);
  const lv=remain>=4?"ok":remain>=3?"warn":"ng";
  vehs.forEach(v=>{U.cobj[v.ci]._roadRemain={ri,remain,lv};});
  res.push({ri,W,n:vehs.length,remain,lv});
 });
 U._roadClear=res; return res;
}
window.roadClearance=roadClearance;

// ───── 工程フェーズ描画（山留め・掘削 / 杭工事 / 鉄骨建て方）※rebuildから呼ぶ ─────
//  1階を含む矩形ブロックの外形を「建物範囲」として扱う（多角形ブロックは外接矩形で近似）
function _footprints(ctx){
 const out=[];
 (U.blocks||[]).forEach(b=>{
  const f1=Math.max(1,Math.round(posv(b.f1,1))); if(f1!==1)return;
  let W,D;
  if(b.shape==="poly"&&Array.isArray(b.poly)&&b.poly.length>=3){
   const xs=b.poly.map(p=>p.x),zs=b.poly.map(p=>p.z);W=Math.max(...xs)-Math.min(...xs);D=Math.max(...zs)-Math.min(...zs);
   out.push({W,D,x:ctx.sdx+(Math.max(...xs)+Math.min(...xs))/2,z:ctx.sdz+(Math.max(...zs)+Math.min(...zs))/2,ry:0,f2:Math.round(posv(b.f2,1))});
  }else{
   W=posv(b.w,Math.sqrt(posv(b.area,200)*posv(b.ratio,1.5)));D=posv(b.d,Math.sqrt(posv(b.area,200)/posv(b.ratio,1.5)));
   out.push({W,D,x:ctx.sdx+numv(b.dx,0),z:ctx.sdz+numv(b.dz,0),ry:numv(b.ry,0)*Math.PI/180,f2:Math.round(posv(b.f2,1))});
  }
 });
 return out;
}
function buildPhase(ctx){
 const {g,L,mat,gl,fh,floorsAll,stepN,phase}=ctx;
 const fps=_footprints(ctx); if(!fps.length)return;
 const tw=U.tw;
 const grp=new THREE.Group(); g.add(grp);
 const add=(geo,c,x,y,z,ry,o={})=>{const m=new THREE.Mesh(geo,L?new THREE.MeshBasicMaterial({color:0xffffff,wireframe:true}):new THREE.MeshLambertMaterial(Object.assign({color:c},o)));m.position.set(x,y,z);m.rotation.y=ry||0;m.castShadow=!L&&!o.transparent;grp.add(m);return m;};
 const ghost=(fp)=>{ // 完成形の透かし（位置関係の把握用）
  const H=floorsAll*fh; add(new THREE.BoxGeometry(fp.W,H,fp.D),0x9fb3d1,fp.x,gl+H/2,fp.z,fp.ry,{transparent:true,opacity:0.10,depthWrite:false});
 };
 if(phase==="retain"){
  const depth=Math.max(1,numv(tw.pitDepth,4)), mg=Math.max(0.3,numv(tw.retainMargin,1.0)), wallH=depth+0.8;
  fps.forEach(fp=>{
   const W=fp.W+mg*2, D=fp.D+mg*2;
   // 掘削底（根切り底）と土の側面（暗色）
   add(new THREE.BoxGeometry(W,0.15,D),0x6b5a48,fp.x,gl-depth,fp.z,fp.ry);
   // 山留め壁（4面・鋼矢板/親杭横矢板のイメージ：GL+0.8mまで立ち上げ）
   const t=0.25, wc=0x7d8794;
   const face=(w,h,x,z,r)=>{const m=add(new THREE.BoxGeometry(w,h,t),wc,0,0,0,0);m.position.set(x,gl-depth+h/2,z);m.rotation.y=r;};
   // ローカル→回転
   const rot=(lx,lz)=>({x:fp.x+lx*Math.cos(fp.ry)-lz*Math.sin(fp.ry),z:fp.z+lx*Math.sin(fp.ry)+lz*Math.cos(fp.ry)});
   let p;
   p=rot(0,-D/2);face(W,wallH,p.x,p.z,fp.ry);  p=rot(0,D/2);face(W,wallH,p.x,p.z,fp.ry);
   p=rot(-W/2,0);face(D,wallH,p.x,p.z,fp.ry+Math.PI/2); p=rot(W/2,0);face(D,wallH,p.x,p.z,fp.ry+Math.PI/2);
   // 腹起し・切梁（1段：GL-1.5m）
   if(depth>=2.5){const y=gl-1.5, bc=0xc9a33a;
    add(new THREE.BoxGeometry(W-0.5,0.3,0.3),bc,fp.x,y,fp.z,fp.ry);
    add(new THREE.BoxGeometry(0.3,0.3,D-0.5),bc,fp.x,y,fp.z,fp.ry);
    const n=Math.max(1,Math.round(W/6)); for(let i=1;i<n;i++){const lx=-W/2+W*i/n; const q=rot(lx,0); add(new THREE.BoxGeometry(0.3,0.3,D-0.5),bc,q.x,y,q.z,fp.ry);}
   }
   // 掘削深さの寸法ラベル（注記と同じ座布団方式）
   ghost(fp);
  });
 }
 if(phase==="pile"){
  let pitch=Math.max(2,numv(tw.pilePitch,5)), dia=Math.max(0.3,numv(tw.pileDia,0.8)), len=Math.max(3,numv(tw.pileLen,15));
  const pileGrid=(fp,pt,rOff,color,opacity,yTop,tag)=>{
   const nx=Math.max(1,Math.floor(fp.W/pt)), nz=Math.max(1,Math.floor(fp.D/pt));
   const sx=(fp.W-(nx-1)*pt)/2, sz=(fp.D-(nz-1)*pt)/2;
   const rot=(lx,lz)=>({x:fp.x+lx*Math.cos(fp.ry+rOff)-lz*Math.sin(fp.ry+rOff),z:fp.z+lx*Math.sin(fp.ry+rOff)+lz*Math.cos(fp.ry+rOff)});
   const geo=new THREE.CylinderGeometry(dia/2,dia/2,len,12);
   for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const lx=-fp.W/2+sx+i*pt, lz=-fp.D/2+sz+j*pt; const q=rot(lx,lz);
    add(geo,color,q.x,gl+yTop-len/2,q.z,0,opacity<1?{transparent:true,opacity,depthWrite:false}:{});}
   return nx*nz;
  };
  let nNew=0,nOld=0;
  // 負荷上限：新設杭が300本を超える場合はピッチを自動で広げる（実演での重さ対策）
  {const est=fps.reduce((s,fp)=>s+Math.max(1,Math.floor(fp.W/pitch))*Math.max(1,Math.floor(fp.D/pitch)),0);
   if(est>300){const k=Math.sqrt(est/300);pitch=+(pitch*k).toFixed(1);U._pileNote=`表示負荷のためピッチを${pitch}mに自動調整（本数上限300）`;}else U._pileNote="";}
  fps.forEach(fp=>{
   nNew+=pileGrid(fp,pitch,0,0xb9bec7,1,0.3);              // 新設杭：杭頭がGL+0.3mに見える
   if(tw.oldPiles){ // 既存杭（撤去/残置の検討用）：赤・半透明・ピッチと角度をずらせる
    const oW=fp.W+numv(tw.oldExtend,2)*2,oD=fp.D+numv(tw.oldExtend,2)*2; let op=Math.max(2,numv(tw.oldPitch,4));
    const oEst=Math.max(1,Math.floor(oW/op))*Math.max(1,Math.floor(oD/op)); if(oEst>300)op=+(op*Math.sqrt(oEst/300)).toFixed(1);
    nOld+=pileGrid({W:oW,D:oD,x:fp.x+numv(tw.oldDx,0),z:fp.z+numv(tw.oldDz,0),ry:fp.ry},op,numv(tw.oldRot,0)*Math.PI/180,0xd64545,0.45,-0.3);
   }
   ghost(fp);
  });
  U._pileCount={n:nNew,old:nOld};
 }
 if(phase==="steel"){
  let pitch=Math.max(3,numv(tw.steelPitch,7)); const nF=Math.max(1,Math.min(floorsAll,stepN)), topY=gl+nF*fh;
  // 負荷上限：柱本数×階数が大きい場合はスパンを自動で広げる
  {const est=fps.reduce((s,fp)=>s+(Math.round(fp.W/pitch)+1)*(Math.round(fp.D/pitch)+1),0)*nF;
   if(est>1500){pitch=+(pitch*Math.sqrt(est/1500)).toFixed(1);}}
  const col=0x9a5c3a; // 錆止め塗装の鉄骨色
  fps.forEach(fp=>{
   const nx=Math.max(2,Math.round(fp.W/pitch)+1), nz=Math.max(2,Math.round(fp.D/pitch)+1);
   const px=fp.W/(nx-1), pz=fp.D/(nz-1);
   const rot=(lx,lz)=>({x:fp.x+lx*Math.cos(fp.ry)-lz*Math.sin(fp.ry),z:fp.z+lx*Math.sin(fp.ry)+lz*Math.cos(fp.ry)});
   const colGeo=new THREE.BoxGeometry(0.45,nF*fh,0.45);
   for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const q=rot(-fp.W/2+i*px,-fp.D/2+j*pz);add(colGeo,col,q.x,gl+nF*fh/2,q.z,fp.ry);}
   // 各階の梁（X方向・Z方向）
   for(let f=1;f<=nF;f++){const y=gl+f*fh-0.3;
    for(let j=0;j<nz;j++){const q=rot(0,-fp.D/2+j*pz);add(new THREE.BoxGeometry(fp.W,0.5,0.28),col,q.x,y,q.z,fp.ry);}
    for(let i=0;i<nx;i++){const q=rot(-fp.W/2+i*px,0);add(new THREE.BoxGeometry(0.28,0.5,fp.D),col,q.x,y,q.z,fp.ry);}
    // デッキプレート（床）：薄い板・半透明
    add(new THREE.BoxGeometry(fp.W,0.08,fp.D),0xb8c0cc,fp.x,y+0.3,fp.z,fp.ry,{transparent:true,opacity:0.55});
   }
   // 基礎（既存の基礎スカート相当）
   add(new THREE.BoxGeometry(fp.W,1.2,fp.D),0xb4b8be,fp.x,gl-0.55,fp.z,fp.ry);
   ghost(fp);
  });
 }
}

// ───── モデル再構築 ─────
function rebuild(){
 if(model){scene.remove(model);model.traverse(o=>{o.geometry&&o.geometry.dispose();o.material&&(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose&&m.dispose());});}
 dragMap={};
 const g=new THREE.Group(); const L=U.line; const DET=true;  // 詳細表現に一本化（概算モードは廃止）
 if(L){scene.background=new THREE.Color(0xffffff);scene.fog=null;}
 else if(U.sky!==false){scene.background=skyTexture();scene.fog=new THREE.Fog(0xcfd6de,300,940);}
 else{scene.background=new THREE.Color(0xcbd3dc);scene.fog=new THREE.Fog(0xcbd3dc,360,1020);}
  sun.castShadow=!L;
 {const az=numv(U.sun.az,135)*Math.PI/180, alt=Math.max(8,numv(U.sun.alt,55))*Math.PI/180, R=180;
  sun.position.set(R*Math.cos(alt)*Math.sin(az),R*Math.sin(alt),R*Math.cos(alt)*Math.cos(az));}
 const mat=(c,o={})=>L?new THREE.MeshBasicMaterial({color:0xffffff}):new THREE.MeshLambertMaterial(Object.assign({color:c},o));
 const edge=(geo,m,col=0x16243d)=>{if(!L)return;const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo,12),new THREE.LineBasicMaterial({color:col}));e.position.copy(m.position);e.rotation.copy(m.rotation);g.add(e);};
 const box=(parent,w,h,d,c,x,y,z,o={})=>{const geo=new THREE.BoxGeometry(w,h,d);const m=new THREE.Mesh(geo,o.mat||mat(c,o));m.position.set(x,y,z);if(o.ry)m.rotation.y=o.ry;if(o.rx)m.rotation.x=o.rx;m.castShadow=!L&&o.shadow!==false;m.receiveShadow=!L;parent.add(m);if(parent===g)edge(geo,m);return m;};
 const cylm=(parent,r1,r2,h,c,x,y,z,o={})=>{const geo=new THREE.CylinderGeometry(r1,r2,h,o.seg||10);const m=new THREE.Mesh(geo,mat(c));m.position.set(x,y,z);if(o.rz)m.rotation.z=o.rz;if(o.rx)m.rotation.x=o.rx;m.castShadow=!L;parent.add(m);return m;};

 const floorsAll=Math.min(60,Math.max(1,Math.round(posv(U.p.floors,14))));
 const H=posv(U.p.height,42), fh=H/floorsAll;
 const PH=U.tw.mode||"plan";
 const PH_GROUND=(PH==="retain"||PH==="pile");        // 地下工事フェーズ：建物は描かず地盤を透かす
 const PH_STEEL=(PH==="steel");                        // 鉄骨建て方：フレームのみ
 const stepN=Math.min(floorsAll,Math.max(1,Math.round(numv(U.tw.step,1))));
 const built=(PH==="build")?stepN:(PH_GROUND||PH_STEEL)?0:floorsAll;   // 0＝統計だけ計算して躯体は描かない
 const sw=posv(U.site.w,30), sd=posv(U.site.d,18), gl=numv(U.site.gl,0), hh=U.site.h.map(v=>numv(v,0));
 const sdx=numv(U.site.dx,0), sdz=numv(U.site.dz,0);
 const siteActive=U.site.active!==false;

 // 地面・道路
 const gnd=new THREE.Mesh(new THREE.PlaneGeometry(1200,1200),L?new THREE.MeshBasicMaterial({color:0xffffff}):new THREE.MeshLambertMaterial({color:0xaeb7c2}));
 gnd.rotation.x=-Math.PI/2;gnd.position.y=-0.07;gnd.receiveShadow=!L;g.add(gnd);
 // ワールド座標(x,z)における地盤の高さ。敷地の外は0（元の地面）
 // 傾斜地に置いたオブジェクト（仮囲い・重機・車両・注記）を地面に接地させるために使う
 const groundY=(wx,wz)=>{
  if(!siteActive)return 0;
  if(Array.isArray(U.site.poly))return 0;            // 多角形敷地は平坦扱い
  const lx=wx-sdx, lz=wz-sdz;                        // 敷地ローカル座標へ
  if(Math.abs(lx)>sw/2||Math.abs(lz)>sd/2)return 0;  // 敷地外は0
  return terrainH(lx,lz,sw,sd,hh);
 };
 const rw=Math.min(20,Math.max(4,numv(U.road.w,8)));
 const roadDx=numv(U.road.dx,0), roadDz=numv(U.road.dz,0), roadRy=numv(U.road.ry,0)*Math.PI/180;
 const roadZ=sdz+sd/2+1.6+rw/2+roadDz;     // 車道中心Z（オフセット込み）
 const roadCx=sdx+roadDx;                   // 車道中心X（オフセット込み）
 // ── 自分で引いた道路（折れ線＋幅員）：地図・図面の実際の道路をなぞったもの ──
 (U.roads||[]).forEach((r,ri)=>{
  const pts=r.pts||[]; if(pts.length<2)return;
  const w=Math.min(20,Math.max(3,numv(r.w,6))); const rg=new THREE.Group(); rg.userData.dragKey="rd:"+ri;
  const ox=sdx+numv(r.dx,0), oz=sdz+numv(r.dz,0); rg.position.set(ox,0,oz); rg.rotation.y=numv(r.ry,0)*Math.PI/180;
  const hasUnder=!!(U.under&&U.under.tex&&U.under.show!==false);
  const rmat=L?new THREE.MeshBasicMaterial({color:0xffffff}):new THREE.MeshLambertMaterial({color:(U.sel==="rd:"+ri||(U.sel||"").startsWith("rpt:"+ri+":"))?0x4B82FF:0x3f4752,transparent:hasUnder,opacity:hasUnder?0.66:1});
  const wmat=L?rmat:new THREE.MeshLambertMaterial({color:0xd9dee5,transparent:hasUnder,opacity:hasUnder?0.72:1});
  const wl=Math.max(0,numv(r.walkL,0)), wr=Math.max(0,numv(r.walkR,0));
  for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];const len=Math.hypot(b.x-a.x,b.z-a.z);if(len<0.05)continue;
   const m=new THREE.Mesh(new THREE.BoxGeometry(len,0.1,w),rmat);const mx=(a.x+b.x)/2,mz=(a.z+b.z)/2;
   m.position.set(mx,groundY(ox+mx,oz+mz)+0.055,mz);m.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);m.receiveShadow=!L;rg.add(m);
   if(!L&&w>=6){const cl=new THREE.Mesh(new THREE.BoxGeometry(len,0.02,0.25),new THREE.MeshLambertMaterial({color:0xf2f4f6}));cl.position.set(mx,groundY(ox+mx,oz+mz)+0.075,mz);cl.rotation.y=m.rotation.y;rg.add(cl);}
   // 歩道（進行方向の左右）：幅が0より大きいときだけ
   {const ang=m.rotation.y; const nx=-Math.sin(ang), nz=-Math.cos(ang); // 左法線（進行方向を右に90°回した向きの逆）
    if(wl>0){const s=new THREE.Mesh(new THREE.BoxGeometry(len,0.12,wl),wmat);s.position.set(mx+nx*(w/2+wl/2),groundY(ox+mx,oz+mz)+0.07,mz+nz*(w/2+wl/2));s.rotation.y=ang;rg.add(s);}
    if(wr>0){const s=new THREE.Mesh(new THREE.BoxGeometry(len,0.12,wr),wmat);s.position.set(mx-nx*(w/2+wr/2),groundY(ox+mx,oz+mz)+0.07,mz-nz*(w/2+wr/2));s.rotation.y=ang;rg.add(s);}}
   if(i>0){const j=new THREE.Mesh(new THREE.CylinderGeometry(w/2,w/2,0.1,24),rmat);j.position.set(a.x,groundY(ox+a.x,oz+a.z)+0.055,a.z);rg.add(j);} // 折れ点を丸く継ぐ
  }
  if(!U._exporting&&!L&&(U.sel==="rd:"+ri||(U.sel||"").startsWith("rpt:"+ri+":"))){
   addVertexTools(rg,pts,"rpt:"+ri+":",(x,z)=>groundY(ox+x,oz+z)+1.0,0x2E6FBE,r.ry,true);
  }
  g.add(rg); dragMap["rd:"+ri]=rg;
 });
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
 {const rm=new THREE.Mesh(new THREE.BoxGeometry(sw+60,0.1,rw),L?new THREE.MeshBasicMaterial({color:0xffffff}):new THREE.MeshLambertMaterial({color:0x3f4752}));rm.position.y=0.05;rm.receiveShadow=!L;roadG.add(rm);}
 if(!L && rw>=6){const cl=new THREE.Mesh(new THREE.BoxGeometry(sw+60,0.02,0.25),new THREE.MeshLambertMaterial({color:0xf2f4f6}));cl.position.y=0.07;roadG.add(cl);}
 g.add(roadG); dragMap.road=roadG;
 // ── 前面歩道グループ（dragKey=roadwalk：独立して前後移動可）※既定は非表示 ──
 if(!L&&U.road.walkShow){
  const walkW=numv(U.road.walkW,1.6);
  const walkZbase=sdz+sd/2+0.8+roadDz;       // 既定は敷地と車道の間
  const walkZ=walkZbase+numv(U.road.walkDz,0);
  const walkG=new THREE.Group(); walkG.userData.dragKey="roadwalk";
  walkG.position.set(sdx+roadDx,0,walkZ); walkG.rotation.y=roadRy;
  const wm=new THREE.Mesh(new THREE.BoxGeometry(sw+60,0.12,walkW),new THREE.MeshLambertMaterial({color:0xd9dee5}));wm.position.y=0.07;walkG.add(wm);
  g.add(walkG); dragMap.roadwalk=walkG;
 }
 // ── 側道グループ（dragKey=roadside）──
 if(U.road.side==="left"||U.road.side==="right"){
  const sgn=(U.road.side==="left"?-1:1);
  const sideG=new THREE.Group(); sideG.userData.dragKey="roadside";
  sideG.position.set(sdx+numv(U.road.sideDx,0),0,sdz+numv(U.road.sideDz,0)); sideG.rotation.y=roadRy;
  const sm=new THREE.Mesh(new THREE.BoxGeometry(rw,0.1,sd+rw+24),L?new THREE.MeshBasicMaterial({color:0xffffff}):new THREE.MeshLambertMaterial({color:0x3f4752}));
  sm.position.set(sgn*(sw/2+1.6+rw/2),0.05,rw/2);sm.receiveShadow=!L;sideG.add(sm);
  if(!L&&U.road.walkShow){const sw2=new THREE.Mesh(new THREE.BoxGeometry(1.6,0.12,sd),new THREE.MeshLambertMaterial({color:0xd9dee5}));sw2.position.set(sgn*(sw/2+0.8),0.07,0);sideG.add(sw2);}
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
  // 緑帯の表示は既定オフ（判定ロジックは維持）。roadcond.showWalk=true で表示
  if(U.roadcond.showWalk)box(g,sw+60,0.04,ww,0x6EA46E,sdx+roadDx,0.09,wz,{shadow:false});
 }

 // 敷地（地形メッシュ・ドラッグ可）
 if(siteActive){
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
  if(!U._exporting&&!L&&(U.sel==="site"||(U.sel||"").startsWith("spt:")))addVertexTools(siteG,sp,"spt:",()=>0.9,0x2E6FBE,0,true);
  const sm=new THREE.Mesh(geo,L?new THREE.MeshBasicMaterial({color:0xffffff}):new THREE.MeshLambertMaterial({color:(U.tw.mode==="build"||PH_GROUND||PH_STEEL)?0x71889d:0x7399b8,transparent:PH_GROUND,opacity:PH_GROUND?0.58:1,depthWrite:!PH_GROUND,side:THREE.DoubleSide}));
  sm.receiveShadow=!L;siteG.add(sm);
  // 外周ライン
  const lp=[]; sp.forEach(p=>lp.push(p.x,0.14,-p.z)); lp.push(sp[0].x,0.14,-sp[0].z);
  const lg=new THREE.BufferGeometry();lg.setAttribute("position",new THREE.BufferAttribute(new Float32Array(lp),3));
  siteG.add(new THREE.Line(lg,new THREE.LineBasicMaterial({color:L?0x708097:0x36536f})));
 }else{
  // ── 矩形敷地（従来：四隅高さで傾斜）──
  const seg=12,vts=[],idx=[];
  for(let j=0;j<=seg;j++)for(let i=0;i<=seg;i++){const x=-sw/2+sw*i/seg,z=-sd/2+sd*j/seg;vts.push(x,terrainH(x,z,sw,sd,hh)+0.12,z);}
  for(let j=0;j<seg;j++)for(let i=0;i<seg;i++){const a=j*(seg+1)+i;idx.push(a,a+seg+1,a+1,a+1,a+seg+1,a+seg+2);}
  const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.BufferAttribute(new Float32Array(vts),3));geo.setIndex(idx);geo.computeVertexNormals();
  const sm=new THREE.Mesh(geo,L?new THREE.MeshBasicMaterial({color:0xffffff}):new THREE.MeshLambertMaterial({color:(U.tw.mode==="build"||PH_GROUND||PH_STEEL)?0x71889d:0x7399b8,transparent:PH_GROUND,opacity:PH_GROUND?0.58:1,depthWrite:!PH_GROUND}));
  sm.receiveShadow=!L;siteG.add(sm);
  if(L){const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo,5),new THREE.LineBasicMaterial({color:0x8a94a8}));siteG.add(e);}
 }
 g.add(siteG);dragMap.site=siteG;
 }

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
  const m=box(g,posv(n.w,10),posv(n.h,12),posv(n.d,10),0xc0c7d0,numv(n.x,20),posv(n.h,12)/2,numv(n.z,20));
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
   const pts=rotPts(b.poly,b.ry); // [{x,z}...] m単位（ブロック原点基準・回転適用済み）
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
   else if(isApt){polyMat=new THREE.MeshLambertMaterial({color:0xd5dae0});}                                  // 共同住宅：コンクリート調
   else if(isOff){polyMat=new THREE.MeshLambertMaterial({color:0x3a587a,transparent:true,opacity:0.62});}    // 事務所/店舗：ガラス調
   else if(U.p.use==="ホテル"){polyMat=new THREE.MeshLambertMaterial({color:0xd8d2c4});}                      // ホテル：温かいベージュ
   else if(U.p.use==="倉庫・物流"){polyMat=new THREE.MeshLambertMaterial({color:0xc2c7cd});}                  // 倉庫：金属サイディング調
   else if(U.p.use==="病院・医療"){polyMat=new THREE.MeshLambertMaterial({color:0xe6e9ec});}                  // 病院：清潔感の白
   else{polyMat=new THREE.MeshLambertMaterial({color:0xd5dae0});}
   const pm=new THREE.Mesh(eg, polyMat);
   pm.position.set(ox,y0+0.12,oz); pm.castShadow=!L; pm.receiveShadow=!L;
   pm.userData.dragKey="blk:"+bi; g.add(pm); dragMap["blk:"+bi]=pm;
   if(!L){const pe=new THREE.LineSegments(new THREE.EdgesGeometry(eg,18),new THREE.LineBasicMaterial({color:0x6f7a88,transparent:true,opacity:.52}));pe.position.copy(pm.position);pe.renderOrder=2;g.add(pe);}
   if(!U._exporting&&!L&&(U.sel==="blk:"+bi||(U.sel||"").startsWith("bpt:"+bi+":"))){
    const hg=new THREE.Group(); hg.position.set(ox,0,oz); hg.rotation.y=numv(b.ry,0)*Math.PI/180; g.add(hg);
    addVertexTools(hg,b.poly,"bpt:"+bi+":",()=>y0+bh+0.9,0xF2A33C,b.ry,true);
   }
   if(L){const ee=new THREE.LineSegments(new THREE.EdgesGeometry(eg,12),new THREE.LineBasicMaterial({color:0x16243d}));ee.position.set(ox,y0+0.12,oz);g.add(ee);}
   // ── 各階のファサード：スラブの縁（外側に薄く出る帯）＋光沢のあるガラス帯。矩形ブロックと同じ「階が読める」見た目に ──
   if(!L && DET && nF>=1){
    const cx=pts.reduce((s,p)=>s+p.x,0)/pts.length, cz=pts.reduce((s,p)=>s+p.z,0)/pts.length;
    const mkShape=(sc)=>{const sh=new THREE.Shape();pts.forEach((p,i)=>{const x=cx+(p.x-cx)*sc,z=cz+(p.z-cz)*sc;i?sh.lineTo(x,-z):sh.moveTo(x,-z);});sh.closePath();return sh;};
    const glassCol=isOff?0x7fa8d8:(U.p.use==="ホテル")?0x6a7f9c:(U.p.use==="病院・医療")?0x9fc0e0:0x33507a;
    const glassMat=new THREE.MeshPhongMaterial({color:glassCol,shininess:110,specular:0xa8c4e8,transparent:true,opacity:isOff?0.6:0.82,depthWrite:false});
    const lipMat=new THREE.MeshLambertMaterial({color:isApt?0xe9ecf0:(U.p.use==="倉庫・物流")?0x9aa1a9:0xdfe3e8});
    const gGeo=new THREE.ExtrudeGeometry(mkShape(1.006),{depth:fh*0.58,bevelEnabled:false}); gGeo.rotateX(-Math.PI/2);
    const lGeo=new THREE.ExtrudeGeometry(mkShape(1.03),{depth:0.22,bevelEnabled:false}); lGeo.rotateX(-Math.PI/2);
    for(let fl=0; fl<nF; fl++){
     const yb=y0+0.12+fl*fh;
     const gm=new THREE.Mesh(gGeo,glassMat); gm.position.set(ox,yb+fh*0.42,oz); g.add(gm);              // ガラス帯（上側58%）
     const lm=new THREE.Mesh(lGeo,lipMat); lm.position.set(ox,yb+fh-0.22,oz); lm.castShadow=true; g.add(lm); // 階スラブの縁
     if(fl===0){const base=new THREE.Mesh(lGeo,lipMat); base.position.set(ox,yb,oz); g.add(base);}             // 基壇
    }
    // 共同住宅：前面（道路側）を向く辺にバルコニーの手すり壁
    if(isApt){const railMat=new THREE.MeshLambertMaterial({color:0xd7dbe1,transparent:true,opacity:0.9});
     for(let i=0;i<pts.length;i++){const a=pts[i],b2=pts[(i+1)%pts.length];const dz=b2.z-a.z,dx=b2.x-a.x;const len=Math.hypot(dx,dz);if(len<3)continue;
      const nx=-dz/len, nz=dx/len; const outward=(((a.x+b2.x)/2-cx)*nx+((a.z+b2.z)/2-cz)*nz)>0?1:-1; if(nz*outward<0.6)continue;
      for(let fl=0;fl<nF;fl++){const yb=y0+0.12+fl*fh; const r=new THREE.Mesh(new THREE.BoxGeometry(len-0.6,1.1,0.12),railMat);
       r.position.set(ox+(a.x+b2.x)/2+nx*outward*0.75,yb+0.55,oz+(a.z+b2.z)/2+nz*outward*0.75); r.rotation.y=-Math.atan2(dz,dx); g.add(r);}}}
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
    sm2.position.set(ox+bcx,y0+(bh+1.5)/2+.1,oz+bcz);sm2.userData.layerKey="scaffold";g.add(sm2);
    const ee2=new THREE.LineSegments(new THREE.EdgesGeometry(sg2),new THREE.LineBasicMaterial({color:0xaab2bf}));ee2.position.copy(sm2.position);ee2.userData.layerKey="scaffold";g.add(ee2);
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
  const bodyCol = isOff?0x334f6f : (U.p.use==="ホテル")?0xcbbfa9 : (U.p.use==="倉庫・物流")?0xb5bdc6 : (U.p.use==="病院・医療")?0xd7dce1 : 0xd5dae0;
  const bodyOpt = isOff?{mat:new THREE.MeshLambertMaterial({color:0x3a587a,transparent:true,opacity:0.62})}:{};
  const bodyMesh=lbox(W,bh,D,bodyCol,0,y0+bh/2+0.12,0,bodyOpt);
  if(!L){const be=new THREE.LineSegments(new THREE.EdgesGeometry(bodyMesh.geometry,18),new THREE.LineBasicMaterial({color:0x657180,transparent:true,opacity:.48}));be.position.copy(bodyMesh.position);bg.add(be);}
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
   sm2.position.set(0,y0+(bh+1.5)/2+.1,0);sm2.userData.layerKey="scaffold";bg.add(sm2);
   const ee=new THREE.LineSegments(new THREE.EdgesGeometry(sg2),new THREE.LineBasicMaterial({color:0xaab2bf}));ee.position.copy(sm2.position);bg.add(ee);}
  bg.position.set(dx,0,dz); bg.rotation.y=ry; g.add(bg); dragMap["blk:"+bi]=bg;
 });
 // 既存解体フェーズ：解体予定の既存建物（ダミー）
 if(PH_GROUND||PH_STEEL){
  buildPhase({g,L,mat,box,cylm,gl,fh,floorsAll,stepN,sdx,sdz,sw,sd,groundY,phase:PH});
 }
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
 if(U.tw.fence && (U.tw.mode==="build" || PH_GROUND || PH_STEEL)){
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
  if(U.tw.fenceShape==="poly"&&Array.isArray(U.tw.fencePts)&&U.tw.fencePts.length>=3){
   // ── 任意形状：頂点列に沿ってパネルを敷く（長い辺は約4mごとに分割して傾斜に追従）──
   const pts=U.tw.fencePts; const n=pts.length; const gseg=Math.max(0,Math.min(n-1,Math.round(numv(U.tw.fenceGateSeg,0))));
   for(let i=0;i<n;i++){
    const a=pts[i], b=pts[(i+1)%n];
    const len=Math.hypot(b.x-a.x,b.z-a.z); if(len<0.05)continue;
    const ang=-Math.atan2(b.z-a.z,b.x-a.x);            // three の rotation.y は左手系なので符号反転
    const hasGate=(gate!=="none")&&(i===gseg)&&len>gw+1;
    const segs=[]; // [t0,t1] の区間（0..1）
    if(hasGate){const g0=(len-gw)/2/len,g1=(len+gw)/2/len;segs.push([0,g0],[g1,1]);}else segs.push([0,1]);
    for(const [t0,t1] of segs){
     const L2=(t1-t0)*len; const nch=Math.max(1,Math.ceil(L2/4)); // 4mごと
     for(let c=0;c<nch;c++){const u0=t0+(t1-t0)*c/nch,u1=t0+(t1-t0)*(c+1)/nch,um=(u0+u1)/2;
      panel((u1-u0)*len,a.x+(b.x-a.x)*um,a.z+(b.z-a.z)*um,ang);}
    }
    if(hasGate&&!L){[(len-gw)/2/len,(len+gw)/2/len].forEach(t=>{const px=a.x+(b.x-a.x)*t,pz=a.z+(b.z-a.z)*t;const gy2=panelY(px,pz);
     const p=new THREE.Mesh(new THREE.BoxGeometry(.18,fh+.4,.18),mat(0x9aa1ab));p.position.set(px,gy2+(fh+.4)/2,pz);fG.add(p);});}
   }
   if(!U._exporting&&!L){const selF=(U.sel==="fence"||(U.sel||"").startsWith("fpt:"));
    addVertexTools(fG,pts,"fpt:",(x,z)=>panelY(x,z)+fh+0.5,0xF2A33C,U.tw.fenceRy,selF);}
  }else{
   edge("front");edge("back");edge("left");edge("right");
  }
  fG.position.set(sdx+numv(U.tw.fenceDx,0),0,sdz+numv(U.tw.fenceDz,0));
  fG.rotation.y=numv(U.tw.fenceRy,0)*Math.PI/180;
  g.add(fG); dragMap.fence=fG;}

 // タワークレーン（ドラッグ可・カタログ仕様連動）
 if(U.tw.crane&&(U.tw.mode==="build"||PH_STEEL)){
  const spec=craneSpec(U.tw.craneModel);
  const mh=builtH+16, jib=spec.jib, work=spec.work;
  const cg=new THREE.Group();cg.userData.dragKey="crane";
  const cm=mat(spec.mast==="mini"?0x4B82FF:0xF2A33C);
  const a=(geo,x,y,z)=>{const m=new THREE.Mesh(geo,cm);m.position.set(x,y,z);m.castShadow=!L;cg.add(m);if(L){const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial({color:0x16243d}));e.position.set(x,y,z);cg.add(e);}};
  if(spec.mast==="tube"){ // 円筒マスト・高自立：小さなベース＋丸マスト＋短い尾部（カタログ形状）
   const mhT=primaryCraneHeight(spec,builtH);
   const b2=spec.base||2.5;
   a(new THREE.BoxGeometry(b2,.4,b2),0,.2,0);
   a(new THREE.CylinderGeometry(.31,.31,mhT,20),0,mhT/2,0);
   a(new THREE.BoxGeometry(1.4,1.4,1.4),0,mhT+.7,0);
   a(new THREE.BoxGeometry(jib,.45,.6),jib/2-.6,mhT+1.5,0);
   a(new THREE.BoxGeometry(spec.tail+1,.4,.8),-(spec.tail+1)/2+.2,mhT+1.5,0);
   a(new THREE.BoxGeometry(.25,3,.25),0,mhT+3,0);
   const drop=Math.max(3,mhT-builtH-3);
   a(new THREE.BoxGeometry(.06,drop,.06),jib*.75,mhT+1.3-drop/2,0);a(new THREE.BoxGeometry(.7,.7,.7),jib*.75,mhT+1.3-drop,0);
  }else if(spec.mast==="mini"){ // 小型ジブクレーン（枠組足場上・全高10.6m）：格子柱＋起伏ブーム＋控え柱
   const H=spec.selfH||10.6, bw=spec.base||0.9;
   a(new THREE.BoxGeometry(bw,.15,bw),0,.075,0);
   [-1,1].forEach(sx=>[-1,1].forEach(sz=>a(new THREE.BoxGeometry(.08,H*0.55,.08),sx*bw/2,H*0.275,sz*bw/2)));
   for(let y=1;y<H*0.55;y+=1.2){a(new THREE.BoxGeometry(bw,.06,.06),0,y,bw/2);a(new THREE.BoxGeometry(bw,.06,.06),0,y,-bw/2);}
   a(new THREE.BoxGeometry(.5,1.2,.7),0,H*0.55+.6,0);
   const boomLen=spec.jib, ang=35*Math.PI/180;
   const boom=new THREE.Mesh(new THREE.BoxGeometry(boomLen,.18,.18),cm);boom.position.set(Math.cos(ang)*boomLen/2,H*0.55+1.2+Math.sin(ang)*boomLen/2,0);boom.rotation.z=ang;boom.castShadow=!L;cg.add(boom);
   a(new THREE.BoxGeometry(.12,H*0.45,.12),0,H*0.55+H*0.225,0);
   const tipX=Math.cos(ang)*boomLen, tipY=H*0.55+1.2+Math.sin(ang)*boomLen; const drop=Math.max(2,tipY-builtH-2);
   a(new THREE.BoxGeometry(.04,drop,.04),tipX,tipY-drop/2,0);a(new THREE.BoxGeometry(.4,.4,.4),tipX,tipY-drop,0);
  }else{ // 格子マスト（従来）
   a(new THREE.BoxGeometry(4.5,.9,4.5),0,.45,0);a(new THREE.BoxGeometry(1.5,mh,1.5),0,mh/2,0);
   a(new THREE.BoxGeometry(2.1,2,2.1),0,mh+1,0);a(new THREE.BoxGeometry(jib,.8,1),jib/2-1.2,mh+2.2,0);
   a(new THREE.BoxGeometry(7,.7,1),-4.2,mh+2.2,0);a(new THREE.BoxGeometry(1.4,2,2.2),-7,mh+1.4,0);
   a(new THREE.BoxGeometry(.5,4.5,.5),0,mh+4.4,0);
   const drop=Math.max(4,mh-builtH-4);
   a(new THREE.BoxGeometry(.07,drop,.07),jib*.72,mh+2-drop/2,0);a(new THREE.BoxGeometry(.9,.9,.9),jib*.72,mh+2-drop,0);
  }
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

 // 旧U.tw.mixer / U.tw.roughの簡易ポリゴン描画は廃止。migrateLegacyVehicles()でconstructionObjectsへ統合。

 // 添景（スケール感のための人物のみ・植栽は配置しない）
 if(!L&&U.tw.mode==="plan"&&U.tw.person){
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
  if(!cobjVisibleInPhase(c,U.tw.mode))return;
  const t=COBJ_TYPES[c.type]||COBJ_TYPES.truck;
  const sz=cobjSize(c.type,c.size)||t.sizes[0];
  const w=posv(c.w,sz.w), d=posv(c.d,sz.d), hgt=posv(c.h,sz.h);
  const ry=numv(c.ry,0)*Math.PI/180;
  // 歩行帯との干渉判定 → 警告色
  let warn=false;
  if(walkZone){const cb=aabb(numv(c.x,0),numv(c.z,0),w,d,ry);
   const wb={x0:walkZone.x-walkZone.w/2,x1:walkZone.x+walkZone.w/2,z0:walkZone.z-walkZone.d/2,z1:walkZone.z+walkZone.d/2};
   if(c.type!=="walkzone"&&c.type!=="safepath"&&overlap(cb,wb))warn=true;}
  c._warn=warn;
  const cg=new THREE.Group(); cg.userData.dragKey="co:"+i; cg.userData.cobjType=c.type;
  const seld=(U.sel==="co:"+i);
  const col=warn?0xD64545:(seld?0x4B82FF:t.color);
  const baseMat=L?new THREE.MeshBasicMaterial({color:0xffffff}):new THREE.MeshLambertMaterial({color:col});
  if(c.type==="towercrane"){
   const spec=craneSpec(c.size), mastH=Math.max(spec.selfH||8,Math.min(spec.maxInstallH||63,hgt));
   const cm=L?baseMat:new THREE.MeshLambertMaterial({color:seld?0x4B82FF:0xF2A33C});
   const addTC=(geo,x,y,z)=>{const m=new THREE.Mesh(geo,cm);m.position.set(x,y,z);m.castShadow=!L;cg.add(m);return m;};
   const bw=Math.max(1.5,Math.min(3.2,posv(sz.w,spec.base||2.4)));
   if(spec.mast==="tube"){
    addTC(new THREE.BoxGeometry(bw,.35,bw),0,.18,0);
    addTC(new THREE.CylinderGeometry(.30,.30,mastH,18),0,mastH/2,0);
   }else{
    const leg=.16,off=bw*.38;
    [[-off,-off],[-off,off],[off,-off],[off,off]].forEach(([x,z])=>addTC(new THREE.BoxGeometry(leg,mastH,leg),x,mastH/2,z));
    for(let y=1.5;y<mastH;y+=2.2){addTC(new THREE.BoxGeometry(bw*.8,.08,.08),0,y,off);addTC(new THREE.BoxGeometry(bw*.8,.08,.08),0,y,-off);addTC(new THREE.BoxGeometry(.08,.08,bw*.8),off,y,0);addTC(new THREE.BoxGeometry(.08,.08,bw*.8),-off,y,0);}
   }
   addTC(new THREE.BoxGeometry(1.4,1.2,1.4),0,mastH+.6,0);
   addTC(new THREE.BoxGeometry(spec.jib,.38,.55),spec.jib/2-.5,mastH+1.5,0);
   addTC(new THREE.BoxGeometry(spec.tail+.8,.34,.65),-(spec.tail+.8)/2+.15,mastH+1.5,0);
   addTC(new THREE.BoxGeometry(.2,2.4,.2),0,mastH+2.8,0);
   const hookX=spec.jib*.72,drop=Math.max(3,Math.min(12,mastH*.28));
   addTC(new THREE.BoxGeometry(.05,drop,.05),hookX,mastH+1.3-drop/2,0);
   addTC(new THREE.BoxGeometry(.55,.45,.55),hookX,mastH+1.3-drop,0);
   if(!L&&!U._exporting&&seld){
    const ring=new THREE.Mesh(new THREE.RingGeometry(Math.max(.2,spec.work-.35),spec.work,64),new THREE.MeshBasicMaterial({color:0x4B82FF,transparent:true,opacity:.30,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.07;ring.renderOrder=5;cg.add(ring);
    const tr=new THREE.Mesh(new THREE.RingGeometry(Math.max(.1,spec.tail-.18),spec.tail,40),new THREE.MeshBasicMaterial({color:0xD64545,transparent:true,opacity:.42,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));tr.rotation.x=-Math.PI/2;tr.position.y=.08;tr.renderOrder=5;cg.add(tr);
   }
  }else if(c.type==="safepath"){
   const lane=new THREE.Mesh(new THREE.BoxGeometry(w,.035,d),L?baseMat:new THREE.MeshLambertMaterial({color:0xEADFB9,transparent:true,opacity:.46}));lane.position.y=.025;cg.add(lane);
   const edgeMat=L?baseMat:new THREE.MeshLambertMaterial({color:0xF28C28});
   const barMat=L?baseMat:new THREE.MeshLambertMaterial({color:0xF5F7FA});
   const n=Math.max(2,Math.ceil(d/1.8)+1), dz=d/(n-1);
   for(let j=0;j<n;j++){const z=-d/2+j*dz;
    [-1,1].forEach(sx=>{const cone=new THREE.Mesh(new THREE.ConeGeometry(.15,.48,10),edgeMat);cone.position.set(sx*w/2,.24,z);cg.add(cone);});
    if(j<n-1){[-1,1].forEach(sx=>{const bar=new THREE.Mesh(new THREE.BoxGeometry(.07,.07,dz),barMat);bar.position.set(sx*w/2,.68,z+dz/2);cg.add(bar);});}
   }
   if(!L){const center=new THREE.Mesh(new THREE.BoxGeometry(.06,.04,d*.94),new THREE.MeshBasicMaterial({color:0xF2A33C,transparent:true,opacity:.75}));center.position.y=.055;cg.add(center);}
  }else if(c.type==="guard"){
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
   // ポンプ車：シャーシ＋キャブ＋ポンプ架装＋4本アウトリガー＋多関節ブーム。
   // 高密度メッシュではなく基本形状の組み合わせで、軽さを保ったままシルエットを実機寄りにする。
   const bodyMat=L?baseMat:new THREE.MeshLambertMaterial({color:warn?0xD64545:0x4F7CC4});
   const darkMat=L?baseMat:new THREE.MeshLambertMaterial({color:0x263442});
   const metalMat=L?baseMat:new THREE.MeshLambertMaterial({color:0xD9DEE5});
   const chassis=new THREE.Mesh(new THREE.BoxGeometry(w*.90,.48,d*.88),darkMat);chassis.position.y=.72;chassis.castShadow=!L;cg.add(chassis);
   const cab=new THREE.Mesh(new THREE.BoxGeometry(w*.92,1.75,d*.22),bodyMat);cab.position.set(0,1.55,-d*.34);cab.castShadow=!L;cg.add(cab);
   const glass=new THREE.Mesh(new THREE.BoxGeometry(w*.72,.68,.06),L?baseMat:new THREE.MeshLambertMaterial({color:0x38546B,transparent:true,opacity:.82}));glass.position.set(0,1.82,-d*.455);cg.add(glass);
   const deck=new THREE.Mesh(new THREE.BoxGeometry(w*.86,.72,d*.48),metalMat);deck.position.set(0,1.22,d*.10);cg.add(deck);
   const hopper=new THREE.Mesh(new THREE.CylinderGeometry(w*.30,w*.42,.9,8),bodyMat);hopper.rotation.x=Math.PI/2;hopper.position.set(0,1.45,d*.39);cg.add(hopper);
   const wheelMat=L?baseMat:new THREE.MeshLambertMaterial({color:0x20252B});
   const axleZ=[-d*.31,-d*.08,d*.27];
   axleZ.forEach(z=>[-1,1].forEach(sx=>{const wh=new THREE.Mesh(new THREE.CylinderGeometry(.48,.48,.32,10),wheelMat);wh.rotation.z=Math.PI/2;wh.position.set(sx*(w*.48),.5,z);cg.add(wh);}));
   const outPct=Math.max(0,Math.min(100,numv(c.outPct,85)))/100;
   const outSpan=w+(Math.max(w,sz.out||w)-w)*outPct;
   const beamMat=L?baseMat:new THREE.MeshLambertMaterial({color:0x56616E});
   [-d*.22,d*.27].forEach(z=>[-1,1].forEach(sx=>{
    const ext=Math.max(.15,(outSpan-w)/2),beam=new THREE.Mesh(new THREE.BoxGeometry(ext,.18,.20),beamMat);
    beam.position.set(sx*(w/2+ext/2),.58,z);cg.add(beam);
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.16,.58,.16),beamMat);leg.position.set(sx*(outSpan/2),.30,z);cg.add(leg);
    const pad=new THREE.Mesh(new THREE.BoxGeometry(.62,.08,.62),beamMat);pad.position.set(sx*(outSpan/2),.05,z);cg.add(pad);
   }));
   const pct=Math.max(0,Math.min(100,numv(c.boomPct,62)))/100;
   const total=Math.max(5,numv(sz.boomMin,6)+(numv(sz.boomMax,sz.work||20)-numv(sz.boomMin,6))*pct);
   const baseA=Math.max(15,Math.min(75,numv(c.boomAngle,48)))*Math.PI/180;
   const boomG=new THREE.Group();boomG.position.set(0,0,d*.17);boomG.rotation.y=numv(c.boomRy,0)*Math.PI/180;cg.add(boomG);
   const ratios=[.31,.27,.23,.19],angs=[baseA,baseA+.58,baseA-.22,-.38];
   let py=2.38,pz=0;
   ratios.forEach((rr,bi)=>{
    const len=total*rr,th=angs[bi],thick=Math.max(.20,.38-bi*.045);
    const bm=new THREE.Mesh(new THREE.BoxGeometry(thick,thick,len),bi<2?bodyMat:metalMat);
    bm.geometry.translate(0,0,-len/2);bm.position.set(0,py,pz);bm.rotation.x=th;bm.castShadow=!L;boomG.add(bm);
    const pin=new THREE.Mesh(new THREE.CylinderGeometry(thick*.75,thick*.75,thick*.38,8),darkMat);pin.rotation.z=Math.PI/2;pin.position.set(0,py,pz);boomG.add(pin);
    py+=Math.sin(th)*len;pz-=Math.cos(th)*len;
   });
   const hoseLen=Math.max(1.8,total*.10);const hose=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,hoseLen,7),darkMat);hose.position.set(0,py-hoseLen/2,pz);boomG.add(hose);
  }else if(c.type==="rough"){ // ラフター：多軸車体＋旋回台＋アウトリガー＋伸縮ブーム
   const yellow=L?baseMat:new THREE.MeshLambertMaterial({color:warn?0xD64545:0xE8B820});
   const dark=L?baseMat:new THREE.MeshLambertMaterial({color:0x272C33});
   const glass=L?baseMat:new THREE.MeshLambertMaterial({color:0x365169,transparent:true,opacity:.84});
   const chassis=new THREE.Mesh(new THREE.BoxGeometry(w*.90,.62,d*.82),dark);chassis.position.y=.82;chassis.castShadow=!L;cg.add(chassis);
   const carrier=new THREE.Mesh(new THREE.BoxGeometry(w*.88,.82,d*.70),yellow);carrier.position.set(0,1.20,.12);carrier.castShadow=!L;cg.add(carrier);
   const axles=d>13?4:d>10?3:2;
   for(let ai=0;ai<axles;ai++){const z=-d*.34+(d*.68)*(axles===1?0:ai/(axles-1));[-1,1].forEach(sx=>{const wh=new THREE.Mesh(new THREE.CylinderGeometry(.62,.62,.38,10),dark);wh.rotation.z=Math.PI/2;wh.position.set(sx*w*.49,.62,z);cg.add(wh);});}
   const driveCab=new THREE.Mesh(new THREE.BoxGeometry(w*.84,1.78,d*.20),yellow);driveCab.position.set(0,2.03,-d*.33);cg.add(driveCab);
   const wind=new THREE.Mesh(new THREE.BoxGeometry(w*.64,.70,.06),glass);wind.position.set(0,2.20,-d*.435);cg.add(wind);
   const turret=new THREE.Mesh(new THREE.CylinderGeometry(w*.34,w*.38,.48,12),dark);turret.position.set(0,1.72,d*.08);cg.add(turret);
   const opCab=new THREE.Mesh(new THREE.BoxGeometry(w*.42,1.55,d*.18),yellow);opCab.position.set(-w*.24,2.55,d*.13);cg.add(opCab);
   const opGlass=new THREE.Mesh(new THREE.BoxGeometry(w*.30,.62,.05),glass);opGlass.position.set(-w*.24,2.72,d*.035);cg.add(opGlass);
   const cw=new THREE.Mesh(new THREE.BoxGeometry(w*.76,.85,d*.13),dark);cw.position.set(0,2.18,d*.29);cg.add(cw);
   const outPct=Math.max(0,Math.min(100,numv(c.outPct,70)))/100;
   const outSpan=w+(Math.max(w,sz.out||w)-w)*outPct;
   [-d*.24,d*.25].forEach(z=>[-1,1].forEach(sx=>{
    const ext=Math.max(.12,(outSpan-w)/2),beam=new THREE.Mesh(new THREE.BoxGeometry(ext,.22,.25),yellow);
    beam.position.set(sx*(w/2+ext/2),.72,z);cg.add(beam);
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.18,.66,.18),dark);leg.position.set(sx*(outSpan/2),.34,z);cg.add(leg);
    const pad=new THREE.Mesh(new THREE.BoxGeometry(.70,.09,.70),dark);pad.position.set(sx*(outSpan/2),.055,z);cg.add(pad);
   }));
   const pct=Math.max(0,Math.min(100,numv(c.boomPct,55)))/100;
   const boomL=Math.max(6,numv(sz.boomMin,8)+(numv(sz.boomMax,sz.work||24)-numv(sz.boomMin,8))*pct);
   const ang=Math.max(5,Math.min(80,numv(c.boomAngle,42)))*Math.PI/180;
   const baseY=2.82,baseZ=d*.11;
   const boomG=new THREE.Group();boomG.position.set(0,0,baseZ);boomG.rotation.y=numv(c.boomRy,0)*Math.PI/180;cg.add(boomG);
   const lens=[boomL*.42,boomL*.33,boomL*.25],widths=[.58,.46,.34];
   let py=baseY,pz=0;
   lens.forEach((len,bi)=>{
    const bm=new THREE.Mesh(new THREE.BoxGeometry(widths[bi],widths[bi],len),bi===0?yellow:(L?baseMat:new THREE.MeshLambertMaterial({color:bi===1?0xD5AA27:0xE7C65A})));
    bm.geometry.translate(0,0,-len/2);bm.position.set(0,py,pz);bm.rotation.x=ang;bm.castShadow=!L;boomG.add(bm);
    py+=Math.sin(ang)*len;pz-=Math.cos(ang)*len;
   });
   const head=new THREE.Mesh(new THREE.BoxGeometry(.62,.55,.48),yellow);head.position.set(0,py,pz);boomG.add(head);
   const drop=Math.max(1.8,Math.min(8,boomL*.14));const rope=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,drop,6),dark);rope.position.set(0,py-drop/2,pz);boomG.add(rope);
   const hook=new THREE.Mesh(new THREE.BoxGeometry(.24,.34,.20),dark);hook.position.set(0,py-drop,pz);boomG.add(hook);
  }else if(c.type==="backhoe"){ // バックホウ：履帯＋旋回体＋アーム
   const track=new THREE.Mesh(new THREE.BoxGeometry(w,0.8,d),baseMat);track.position.y=.4;track.castShadow=!L;cg.add(track);
   const turret=new THREE.Mesh(new THREE.BoxGeometry(w*0.8,1.3,d*0.6),baseMat);turret.position.set(0,1.4,-d*0.1);cg.add(turret);
   const arm=new THREE.Mesh(new THREE.BoxGeometry(.35,.35,d*0.7),new THREE.MeshLambertMaterial({color:warn?0xD64545:0xC2611F}));arm.position.set(0,2.0,d*0.35);arm.rotation.x=-0.9;cg.add(arm);
  }else if(c.type==="stage"){ // 乗入れ構台：覆工板デッキ＋H鋼支柱＋乗入れスロープ
   const dk=L?baseMat:new THREE.MeshLambertMaterial({color:warn?0xD64545:0x9C8F7E});
   const deck=new THREE.Mesh(new THREE.BoxGeometry(w,0.3,d),dk);deck.position.y=hgt;deck.castShadow=!L;cg.add(deck);
   const col=L?baseMat:new THREE.MeshLambertMaterial({color:0x5b6068});
   const nx=Math.max(2,Math.round(w/3)+1), nz=Math.max(2,Math.round(d/4)+1);
   for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const p=new THREE.Mesh(new THREE.BoxGeometry(0.3,hgt,0.3),col);p.position.set(-w/2+0.3+i*(w-0.6)/(nx-1),hgt/2,-d/2+0.3+j*(d-0.6)/(nz-1));cg.add(p);}
   for(let i=0;i<nx;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(0.25,0.4,d),col);b.position.set(-w/2+0.3+i*(w-0.6)/(nx-1),hgt-0.35,0);cg.add(b);}
   const rl=Math.max(4,hgt*4); const ramp=new THREE.Mesh(new THREE.BoxGeometry(w*0.8,0.25,rl),dk);ramp.position.set(0,hgt/2,d/2+rl/2*Math.cos(Math.atan2(hgt,rl)));ramp.rotation.x=Math.atan2(hgt,rl);cg.add(ramp);
   if(!L){const rail=new THREE.MeshLambertMaterial({color:0xF2A33C});[-w/2,w/2].forEach(x=>{const h=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.9,d),rail);h.position.set(x,hgt+0.6,0);cg.add(h);});}
  }else if(c.type==="lsev"){ // ロングスパンEV：以前の仮設タブ版と同じ見た目（2本マスト＋頂部梁＋搬器）
   const mm=L?baseMat:new THREE.MeshLambertMaterial({color:warn?0xD64545:0xd0d3d8});
   const cm=L?baseMat:new THREE.MeshLambertMaterial({color:0xeef0f3});
   [-1.7,1.7].forEach(x=>{const m=new THREE.Mesh(new THREE.BoxGeometry(.5,hgt,.5),mm);m.position.set(x,hgt/2,0);m.castShadow=!L;cg.add(m);});
   const top=new THREE.Mesh(new THREE.BoxGeometry(3.8,.4,1.9),mm);top.position.set(0,hgt+.2,.1);cg.add(top);
   const cage=new THREE.Mesh(new THREE.BoxGeometry(3.4,2.4,1.6),cm);cage.position.set(0,Math.max(2,hgt*.45),.1);cage.castShadow=!L;cg.add(cage);
   for(let y=3;y<hgt;y+=3){const r=new THREE.Mesh(new THREE.BoxGeometry(3.9,.12,.12),mm);r.position.set(0,y,0);cg.add(r);}
  }else if(c.type==="komalift"){ // コマリフト（小型荷揚げ機）：1本マスト＋小さな荷台＋台車
   const mm=L?baseMat:new THREE.MeshLambertMaterial({color:warn?0xD64545:0xc9ccd2});
   const mast=new THREE.Mesh(new THREE.BoxGeometry(.32,hgt,.32),mm);mast.position.set(0,hgt/2,-d/2+.3);mast.castShadow=!L;cg.add(mast);
   for(let y=1;y<hgt;y+=1.2){const r=new THREE.Mesh(new THREE.BoxGeometry(.5,.06,.06),mm);r.position.set(0,y,-d/2+.3);cg.add(r);}
   const tray=new THREE.Mesh(new THREE.BoxGeometry(w,.12,d-.5),L?baseMat:new THREE.MeshLambertMaterial({color:0xF2A33C}));tray.position.set(0,Math.max(1.2,hgt*.35),.2);cg.add(tray);
   const base=new THREE.Mesh(new THREE.BoxGeometry(w+.3,.2,d+.3),L?baseMat:new THREE.MeshLambertMaterial({color:0x7d8794}));base.position.y=.1;cg.add(base);
   if(!L){const head=new THREE.Mesh(new THREE.BoxGeometry(.6,.3,.6),new THREE.MeshLambertMaterial({color:0x5b6a86}));head.position.set(0,hgt+.1,-d/2+.3);cg.add(head);}
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
  }else if(c.type==="mixer"){ // 生コン車：専用詳細モデル。旧箱＋単純ドラム表現は使用しない
   const cabMat=L?baseMat:new THREE.MeshLambertMaterial({color:warn?0xD64545:0xE9EDF2});
   const frameMat=L?baseMat:new THREE.MeshLambertMaterial({color:0x2B3037});
   const drumMat=L?baseMat:new THREE.MeshLambertMaterial({color:warn?0xD64545:0xD9DEE5});
   const accentMat=L?baseMat:new THREE.MeshLambertMaterial({color:0x4F7CC4});
   const glassMat=L?baseMat:new THREE.MeshLambertMaterial({color:0x365169,transparent:true,opacity:.84});
   // ラダーフレーム＋前後バンパー
   const frame=new THREE.Mesh(new THREE.BoxGeometry(w*.72,.30,d*.82),frameMat);frame.position.y=.66;frame.castShadow=!L;cg.add(frame);
   const bumperF=new THREE.Mesh(new THREE.BoxGeometry(w*.88,.28,.22),frameMat);bumperF.position.set(0,.72,-d*.47);cg.add(bumperF);
   const bumperR=new THREE.Mesh(new THREE.BoxGeometry(w*.78,.24,.18),frameMat);bumperR.position.set(0,.74,d*.45);cg.add(bumperR);
   // キャブ：下部＋上部を分け、箱感を弱める
   const cabLow=new THREE.Mesh(new THREE.BoxGeometry(w*.88,.78,d*.22),cabMat);cabLow.position.set(0,1.22,-d*.36);cabLow.castShadow=!L;cg.add(cabLow);
   const cabTop=new THREE.Mesh(new THREE.BoxGeometry(w*.82,1.05,d*.19),cabMat);cabTop.position.set(0,2.05,-d*.37);cabTop.castShadow=!L;cg.add(cabTop);
   const wind=new THREE.Mesh(new THREE.BoxGeometry(w*.62,.62,.055),glassMat);wind.position.set(0,2.18,-d*.472);cg.add(wind);
   [-1,1].forEach(sx=>{const side=new THREE.Mesh(new THREE.BoxGeometry(.055,.52,d*.09),glassMat);side.position.set(sx*w*.415,2.15,-d*.37);cg.add(side);});
   // 3軸タイヤ・ホイール
   const wheelMat=L?baseMat:new THREE.MeshLambertMaterial({color:0x1F2329});
   const hubMat=L?baseMat:new THREE.MeshLambertMaterial({color:0x9DA6B2});
   const axleZ=[-d*.31,d*.06,d*.31];
   axleZ.forEach(z=>[-1,1].forEach(sx=>{
    const wh=new THREE.Mesh(new THREE.CylinderGeometry(.48,.48,.34,14),wheelMat);wh.rotation.z=Math.PI/2;wh.position.set(sx*w*.49,.52,z);cg.add(wh);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.20,.20,.36,12),hubMat);hub.rotation.z=Math.PI/2;hub.position.copy(wh.position);cg.add(hub);
   }));
   // ドラム架台・回転ドラム（前小径→後大径のコンクリートミキサーらしいシルエット）
   const cradle=new THREE.Mesh(new THREE.BoxGeometry(w*.72,.22,d*.50),frameMat);cradle.position.set(0,1.18,d*.11);cradle.rotation.x=-.05;cg.add(cradle);
   const drum=new THREE.Mesh(new THREE.CylinderGeometry(w*.30,w*.47,d*.50,18),drumMat);drum.position.set(0,2.05,d*.08);drum.rotation.x=Math.PI/2-.20;drum.castShadow=!L;cg.add(drum);
   const band1=new THREE.Mesh(new THREE.TorusGeometry(w*.39,.055,6,18),accentMat);band1.rotation.x=Math.PI/2-.20;band1.position.set(0,2.02,-d*.02);cg.add(band1);
   const band2=new THREE.Mesh(new THREE.TorusGeometry(w*.43,.055,6,18),accentMat);band2.rotation.x=Math.PI/2-.20;band2.position.set(0,2.08,d*.15);cg.add(band2);
   // 後部ホッパー・シュート・梯子
   const hopper=new THREE.Mesh(new THREE.ConeGeometry(w*.34,.72,10,1,true),drumMat);hopper.rotation.x=Math.PI/2;hopper.position.set(0,2.28,d*.39);cg.add(hopper);
   const chute=new THREE.Mesh(new THREE.BoxGeometry(w*.42,.10,d*.30),drumMat);chute.position.set(0,1.43,d*.48);chute.rotation.x=-.42;cg.add(chute);
   const waterTank=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,w*.55,10),accentMat);waterTank.rotation.z=Math.PI/2;waterTank.position.set(0,1.18,-d*.16);cg.add(waterTank);
   const ladderMat=L?baseMat:new THREE.MeshLambertMaterial({color:0x697482});
   [-.28,.28].forEach(x=>{const rail=new THREE.Mesh(new THREE.BoxGeometry(.045,1.45,.045),ladderMat);rail.position.set(x,1.65,d*.43);cg.add(rail);});
   for(let yy=1.02;yy<=2.26;yy+=.25){const rung=new THREE.Mesh(new THREE.BoxGeometry(.62,.035,.035),ladderMat);rung.position.set(0,yy,d*.43);cg.add(rung);}
  }else{ // 一般トラック
   const body=new THREE.Mesh(new THREE.BoxGeometry(w,hgt*0.7,d),baseMat);body.position.y=hgt*0.45;body.castShadow=!L;cg.add(body);
   const cab=new THREE.Mesh(new THREE.BoxGeometry(w,hgt*0.6,d*0.22),baseMat);cab.position.set(0,hgt*0.5,-d*0.36);cg.add(cab);
  }
  // ───── 干渉チェックガイド（重機選択時・画像出力時は非表示）─────
  if(seld&&!L&&!U._exporting){
   const ringMat=(cc,op)=>new THREE.MeshBasicMaterial({color:cc,transparent:true,opacity:op,side:THREE.DoubleSide});
   // A. アウトリガー張出（現在の張出率を反映）
   if(sz.out){const pct=Math.max(0,Math.min(100,numv(c.outPct,100)))/100,ow=w+(Math.max(w,sz.out)-w)*pct,od=Math.max(d*.75,w);
    const g4=new THREE.Mesh(new THREE.PlaneGeometry(ow,od),ringMat(0xF2A33C,0.10));g4.rotation.x=-Math.PI/2;g4.position.y=0.05;cg.add(g4);
    const eg=new THREE.EdgesGeometry(new THREE.PlaneGeometry(ow,od));const el2=new THREE.LineSegments(eg,new THREE.LineBasicMaterial({color:0xE8731A}));el2.rotation.x=-Math.PI/2;el2.position.y=0.06;cg.add(el2);
   }
   // B. テールスイング（後端旋回半径）の円
   if(sz.tail){const ring=new THREE.Mesh(new THREE.RingGeometry(sz.tail-0.25,sz.tail,48),ringMat(0xD64545,0.5));ring.rotation.x=-Math.PI/2;ring.position.set(0,0.08,-d*0.2);cg.add(ring);}
   // C. 作業半径の目安円
   if(sz.work){const ring=new THREE.Mesh(new THREE.RingGeometry(sz.work-0.4,sz.work,64),ringMat(0x3B82C4,0.35));ring.rotation.x=-Math.PI/2;ring.position.y=0.04;cg.add(ring);}
  }
  const _cx=numv(c.x,0), _cz=numv(c.z,0);
  cg.position.set(_cx,groundY(_cx,_cz),_cz); cg.rotation.y=ry; g.add(cg); dragMap["co:"+i]=cg;
 });
 // なぞった道路上の車両：残り幅を計算してラベル表示
 if((U.roads||[]).length){roadClearance();
  if(!L){(U._roadClear||[]).forEach(rc=>{if(!rc.n)return;const r=U.roads[rc.ri];if(!r||!(r.pts||[]).length)return;const pts=rotPts(r.pts,r.ry);const mid=pts[Math.floor((pts.length-1)/2)];const nxt=pts[Math.min(pts.length-1,Math.floor((pts.length-1)/2)+1)];
    const mx=(mid.x+nxt.x)/2, mz=(mid.z+nxt.z)/2; const wx=sdx+numv(r.dx,0)+mx, wz=sdz+numv(r.dz,0)+mz;
    const sp=edgeLabelSprite(`道路${rc.ri+1}：幅${rc.W}m／残り${rc.remain}m`);sp.position.set(wx,groundY(wx,wz)+2.2,wz);sp.scale.multiplyScalar(1.25);
    sp.material.color.setHex(rc.lv==="ok"?0xBFE3D0:rc.lv==="warn"?0xFFE2B0:0xFFC4BC);g.add(sp);});
   U.cobj.forEach((c,i)=>{if(!cobjVisibleInPhase(c,U.tw.mode))return;const rr=c._roadRemain;if(!rr)return;const sz=cobjSize(c.type,c.size)||{h:3};
   const sp=edgeLabelSprite(`残り ${rr.remain}m`);const cx=numv(c.x,0),cz=numv(c.z,0);sp.position.set(cx,groundY(cx,cz)+posv(c.h,sz.h)+1.4,cz);sp.scale.multiplyScalar(1.15);
   sp.material.color.setHex(rr.lv==="ok"?0xBFE3D0:rr.lv==="warn"?0xFFE2B0:0xFFC4BC); g.add(sp);});}
 }else{U._roadClear=[];}

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
  if((U.dim.base||"free")!=="free"){const bp=dimBasePoint(U.dim.base);if(bp){const bs=edgeLabelSprite(bp.label);bs.position.set(A.x,1.05,A.z);bs.scale.set(4.2,1.15,1);g.add(bs);}}
  if(B){dot(B,0xF2A33C);
   const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.BufferAttribute(new Float32Array([A.x,0.4,A.z,B.x,0.4,B.z]),3));
   g.add(new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xF2A33C})));
   const dist=Math.hypot(B.x-A.x,B.z-A.z);
   U._dimDist=dist;
   const ds=edgeLabelSprite(dist.toFixed(2)+" m");ds.position.set((A.x+B.x)/2,1.15,(A.z+B.z)/2);ds.scale.set(5.2,1.45,1);g.add(ds);
  } else U._dimDist=null;
 } else U._dimDist=null;

 scene.add(g);model=g;
 // rebuildのたびに注視高さを戻さない。工程の階数変更中も現在のカメラを維持する。
 applyLayers(g);

 // UI v4 Stage 3：選択対象を3D側でも一目で分かるように、軽量な青アウトライン＋接地リングを表示
 if(!L&&!U._exporting&&U.sel){
  let sk=String(U.sel),mk=sk;
  if(sk.startsWith("bpt:"))mk="blk:"+sk.split(":")[1];
  else if(sk.startsWith("rpt:"))mk="rd:"+sk.split(":")[1];
  else if(sk.startsWith("fpt:"))mk="fence";
  else if(sk.startsWith("spt:"))mk="site";
  const target=dragMap[mk];
  if(target&&target.visible!==false){
   try{
    target.updateWorldMatrix&&target.updateWorldMatrix(true,true);
    const box3=new THREE.Box3().setFromObject(target);
    if(!box3.isEmpty()){
     const helper=new THREE.Box3Helper(box3,0x4B82FF);
     helper.material.transparent=true;helper.material.opacity=.92;helper.material.depthTest=false;helper.renderOrder=90;g.add(helper);
     if(mk==="crane"||mk==="ev"||mk.startsWith("co:")){
      const size=new THREE.Vector3(),center=new THREE.Vector3();box3.getSize(size);box3.getCenter(center);
      let rr=Math.max(.9,Math.min(5.5,Math.max(size.x,size.z)*.62+.55));
      if(mk==="crane"){const wp=new THREE.Vector3();target.getWorldPosition(wp);center.x=wp.x;center.z=wp.z;rr=1.7;}
      const ring=new THREE.Mesh(new THREE.RingGeometry(Math.max(.25,rr-.12),rr,48),new THREE.MeshBasicMaterial({color:0x4B82FF,transparent:true,opacity:.58,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));
      ring.rotation.x=-Math.PI/2;ring.position.set(center.x,Math.max(.1,box3.min.y+.08),center.z);ring.renderOrder=89;g.add(ring);
     }
    }
   }catch(e){}
  }
 }
 renderTitle();
 if(typeof scheduleDraft==="function")scheduleDraft();
}

// ───── 案件データの保存・読込 (JSON / AES暗号化対応) ─────
function saveProjectJSON(){
 const saveState=JSON.parse(JSON.stringify(U,(k,v)=>(k==="tex"||k==="raw"||k==="ents"||k==="_warn"||k==="_stats"||k==="_dimDist"||k==="_exporting"||k==="_titleMin"||k==="_acc"||k==="_hudMin"||k==="_pileCount"||k==="_pileNote"||k==="_crop"||k==="_mEdit"||k==="_snapHit"||k==="_toolsMin"||k==="_layersOpen"||k==="_roadClear"||k==="_roadRemain"||k==="sel"||k==="polyInput"||k==="calib"||k==="gsiStatus")?(k==="ents"?null:(k==="_warn"?undefined:null)):v));
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
   if(!Array.isArray(U.roads))U.roads=[];
   if(!U.layers||typeof U.layers!=="object")U.layers={}; if(typeof ensureLayers==="function")ensureLayers();
   if(!U.ojt||typeof U.ojt!=="object")U.ojt={};
   if(U.road.sideDx==null)U.road.sideDx=0; if(U.road.sideDz==null)U.road.sideDz=0;
   if(!U.poles)U.poles={n:3,pitch:18,far:true,dx:0,dz:0,ry:0};
   if(!U.guide)U.guide={show:false,road:1.25,nbor:1.25};
   if(!U.sun)U.sun={az:135,alt:55};
   if(!U.grid)U.grid={show:false,size:1};
   if(!U.roadcond)U.roadcond={lane:6,walk:2.5,side:"front"};
   if(!U.cobj)U.cobj=[];
   if(!U.dim)U.dim={on:false,a:null,b:null,base:"free"}; else if(U.dim.base==null)U.dim.base="free";
   if(!U.polyInput)U.polyInput={on:false,pts:[],target:null};
   if(!U.calib)U.calib={on:false,a:null,b:null};
   if(U.tw&&!U.tw.craneModel)U.tw.craneModel="JCL022";
   if(U.tw){if(U.tw.craneHeight==null)U.tw.craneHeight=0;if(U.tw.fenceH==null)U.tw.fenceH=3; if(U.tw.fenceGate==null)U.tw.fenceGate="front"; if(U.tw.fenceAll==null)U.tw.fenceAll=false;
     if(U.tw.fenceDx==null)U.tw.fenceDx=0; if(U.tw.fenceDz==null)U.tw.fenceDz=0; if(U.tw.fenceRy==null)U.tw.fenceRy=0; if(U.tw.fenceW==null)U.tw.fenceW=0; if(U.tw.fenceD==null)U.tw.fenceD=0;}
   if(!U.dxf)U.dxf={ents:null,layers:{},scale:0.001,dx:0,dz:0,raw:null};
   if(U.cost)delete U.cost;  // 旧バージョンの概算単価データを破棄
   if(!U.geo)U.geo={elev:null,name:"",status:""};
   if(U.snap==null)U.snap=true;
   (U.cobj||[]).forEach(c=>{if(c.size==null){const t=COBJ_TYPES[c.type];if(t)c.size=t.sizes[0].key;}if(c.type==="rough"||c.type==="pump"){if(c.boomPct==null)c.boomPct=c.type==="pump"?62:55;if(c.boomAngle==null)c.boomAngle=c.type==="pump"?48:42;if(c.boomRy==null)c.boomRy=0;if(c.outPct==null)c.outPct=c.type==="pump"?85:70;}});
   migrateLegacyVehicles();
   if(U.p.addr==null)U.p.addr="";
   U.sel=null;U._layersOpen=false;U._hudMin=true;U._titleMin=true;
   if(U.site&&U.site.active==null)U.site.active=true;
   if(isTutorialFinishCandidate(U))cacheTutorialFinishState(U);
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
 if(!addr){toast("計画地住所を入力してください","err");return false;}
 U.geo.status="検索中…"; renderPanel();
 try{
  // 1) 住所→緯度経度（国土地理院ジオコーディング・CORS可）
  const gres=await fetch("https://msearch.gsi.go.jp/address-search/AddressSearch?q="+encodeURIComponent(addr));
  const gjson=await gres.json();
  if(!gjson||!gjson.length){U.geo.status="住所が見つかりませんでした。市区町村名から入れ直してください。";renderPanel();return false;}
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
  return true;
 }catch(err){
  U.geo.status="取得失敗（ネットワーク制限／CORSの可能性）。下のリンクから手動でご確認ください。";
  renderPanel();
  return false;
 }
}
window.fetchGeo=fetchGeo;
async function fetchGeoAndMap(){
 const ok=await fetchGeo();
 if(!ok)return false;
 U.tabGroup="2";U.tab="下敷き";renderPanel();
 await loadGsiMap();
 view("top",{instant:true});
 toast("住所から国土地理院の地図を取得しました。次にプランPDFを読み込めます。","ok");
 return true;
}
window.fetchGeoAndMap=fetchGeoAndMap;
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
  setUnderMoveMode(true);renderPanel();
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
// ───── 下敷きのトリミング：画面上の対角2点で範囲を指定し、その部分だけを切り出して貼り直す ─────
let _underOrig=null;   // 切り取り前（元に戻す用）
function underLocalFromWorld(wx,wz){
 // ワールド → 下敷き平面のローカル(x,y)。平面は rotation.x=-π/2, rotation.z=rot、位置(dx,dz)
 const th=numv(U.under.rot,0)*Math.PI/180, c=Math.cos(th), s=Math.sin(th);
 const X=wx-numv(U.under.dx,0), Y=-(wz-numv(U.under.dz,0));
 return {x:X*c+Y*s, y:-X*s+Y*c};
}
function underWorldFromLocal(lx,ly){
 const th=numv(U.under.rot,0)*Math.PI/180, c=Math.cos(th), s=Math.sin(th);
 return {x:numv(U.under.dx,0)+(lx*c-ly*s), z:numv(U.under.dz,0)-(lx*s+ly*c)};
}
function cropUnder(p1,p2){
 const tex=U.under.tex; if(!tex||!tex.image){toast("下敷きがありません","err");return;}
 const img=tex.image, IW=img.width||img.naturalWidth, IH=img.height||img.naturalHeight;
 if(!IW||!IH){toast("画像サイズを取得できません","err");return;}
 const w=posv(U.under.width,40), h=w*IH/IW;
 const a=underLocalFromWorld(p1.x,p1.z), b=underLocalFromWorld(p2.x,p2.z);
 // ローカル→画素（画像上端が local y=+h/2）
 const px=(lx)=>Math.round((lx+w/2)/w*IW), py=(ly)=>Math.round((h/2-ly)/h*IH);
 let x0=Math.max(0,Math.min(px(a.x),px(b.x))), x1=Math.min(IW,Math.max(px(a.x),px(b.x)));
 let y0=Math.max(0,Math.min(py(a.y),py(b.y))), y1=Math.min(IH,Math.max(py(a.y),py(b.y)));
 if(x1-x0<8||y1-y0<8){toast("範囲が小さすぎます。もう少し広く2点を指定してください","err");return;}
 const cv=document.createElement("canvas"); cv.width=x1-x0; cv.height=y1-y0;
 try{cv.getContext("2d").drawImage(img,x0,y0,x1-x0,y1-y0,0,0,cv.width,cv.height);}catch(e){toast("この画像は切り取れません（外部画像の制限）","err");return;}
 if(!_underOrig)_underOrig={tex,width:U.under.width,dx:U.under.dx,dz:U.under.dz,raw:U.under.raw,pages:U.under.pages,page:U.under.page};
 // 切り取り後の中心（ローカル）→ ワールドへ。幅は比例
 const cxl=((x0+x1)/2/IW)*w-w/2, cyl=h/2-((y0+y1)/2/IH)*h;
 const wc=underWorldFromLocal(cxl,cyl);
 const ntex=new THREE.CanvasTexture(cv); ntex.anisotropy=4;
 U.under.tex=ntex; U.under.width=+(w*(x1-x0)/IW).toFixed(2); U.under.dx=+wc.x.toFixed(2); U.under.dz=+wc.z.toFixed(2);
 U.under.raw=null; U.under.pages=1; U.under.page=1;   // 切り取り後はページ切替不可（元に戻すと復活）
 U.under._crop=null; rebuild(); renderPanel(); toast("下敷きを切り取りました（元に戻せます）","ok");
}
window.startUnderCrop=()=>{if(!U.under.tex){toast("先に下敷きを読み込んでください","err");return;}U.under._crop={on:true,a:null};view("top");renderPanel();toast("切り取る範囲の対角2点を、下敷きの上でクリック（Escで中止）");};
window.cancelUnderCrop=()=>{U.under._crop=null;renderPanel();};
window.restoreUnder=()=>{if(!_underOrig)return;if(U.under.tex&&U.under.tex!==_underOrig.tex&&U.under.tex.dispose)U.under.tex.dispose();
 U.under.tex=_underOrig.tex;U.under.width=_underOrig.width;U.under.dx=_underOrig.dx;U.under.dz=_underOrig.dz;U.under.raw=_underOrig.raw;U.under.pages=_underOrig.pages;U.under.page=_underOrig.page;_underOrig=null;rebuild();renderPanel();toast("切り取り前に戻しました","ok");};
async function loadUnderFile(file){
 _underOrig=null; U.under._crop=null;
 if(!file)return;
 if(file.type==="application/pdf"){
  const buf=await file.arrayBuffer();
  U.under.raw=buf;
  const pdf=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;
  U.under.pages=pdf.numPages;U.under.page=Math.min(U.under.page,pdf.numPages);
  await renderPdfPage();
 }else{
  const url=URL.createObjectURL(file);
  new THREE.TextureLoader().load(url,t=>{if(U.under.tex)U.under.tex.dispose();U.under.tex=t;U.under.raw=null;U.under.pages=1;setUnderMoveMode(true);renderPanel();toast("下地操作をONにしました。ドラッグ＝移動 / Ctrl＋ドラッグ＝回転","ok");});
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
 U.under.tex=tex;setUnderMoveMode(true);
 renderPanel();
 toast("下地操作をONにしました。ドラッグ＝移動 / Ctrl＋ドラッグ＝回転","ok");
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
window.addEventListener("error",(e)=>{try{toast("エラー："+(e.message||"不明")+"（F12で詳細）","err");}catch(_){}});
window.addEventListener("unhandledrejection",(e)=>{try{toast("エラー："+((e.reason&&e.reason.message)||"処理に失敗しました"),"err");}catch(_){}});

// ───── Undo（操作の取り消し：Uのスナップショットを最大30段階保持）─────
const _hist=[]; let _histLast=0, _histKey="";
const _SNAP_SKIP=(k)=>(k==="tex"||k==="raw"||k==="ents"||k==="_warn"||k==="_stats"||k==="_dimDist"||k==="_exporting"||k==="_titleMin"||k==="_acc"||k==="_hudMin"||k==="_pileCount"||k==="_pileNote"||k==="_crop"||k==="_mEdit"||k==="_snapHit"||k==="_toolsMin"||k==="_layersOpen"||k==="_roadClear"||k==="_roadRemain"||k==="sel"||k==="polyInput"||k==="calib"||k==="gsiStatus");
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
 const ub=document.getElementById("undo-btn");if(ub)ub.disabled=!_hist.length;
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
  if(isTutorialFinishCandidate(U))localStorage.setItem(TUTORIAL_FINISH_KEY,s);
 }catch(e){/* 容量超過等は無視 */}
}
function scheduleDraft(){clearTimeout(_draftT);_draftT=setTimeout(saveDraft,2000);}
setInterval(saveDraft,15000);
window.addEventListener("beforeunload",saveDraft);
window.addEventListener("pagehide",saveDraft);                       // iOS/Android：タブ切替・閉じる
document.addEventListener("visibilitychange",()=>{if(document.hidden)saveDraft();});
function readDraft(){try{const j=localStorage.getItem(DRAFT_KEY);return j?JSON.parse(j):null;}catch(e){return null;}}
const TUTORIAL_FINISH_KEY="bimgen_tutorial_finish_profile_v1";
function isTutorialFinishCandidate(p){
 try{
  return !!(p&&p.p&&p.site&&p.tw
   &&Math.round(numv(p.p.floors,0))>=10
   &&Array.isArray(p.site.poly)&&p.site.poly.length>=6
   &&Array.isArray(p.nbs)&&p.nbs.length>=2
   &&Array.isArray(p.cobj)&&p.cobj.some(x=>x&&x.type==="lsev")
   &&p.cobj.some(x=>x&&x.type==="mixer")
   &&p.cobj.some(x=>x&&x.type==="pump")
   &&p.tw.crane===true&&p.tw.fence===true
   &&Array.isArray(p.roads)&&p.roads.length>0);
 }catch(e){return false;}
}
function cacheTutorialFinishState(p){
 if(!isTutorialFinishCandidate(p))return false;
 try{
  const s=JSON.stringify(p,(k,v)=>_SNAP_SKIP(k)?undefined:v);
  localStorage.setItem(TUTORIAL_FINISH_KEY,s);return true;
 }catch(e){return false;}
}
function readTutorialFinishState(){
 try{
  const own=localStorage.getItem(TUTORIAL_FINISH_KEY);
  if(own){const p=JSON.parse(own);if(isTutorialFinishCandidate(p))return p;}
  const d=readDraft();
  if(d&&d.data){const p=JSON.parse(d.data);if(isTutorialFinishCandidate(p)){cacheTutorialFinishState(p);return p;}}
 }catch(e){}
 return null;
}
window.cacheTutorialFinishState=cacheTutorialFinishState;
function applyState(p){
 const keep={ut:U.under.tex,ur:U.under.raw,up:U.under.pages,upg:U.under.page,pt:U.photo.tex,de:U.dxf.ents,dr:U.dxf.raw};
 Object.assign(U,p);
 U.under.tex=keep.ut;U.under.raw=keep.ur;U.under.pages=keep.up;U.under.page=keep.upg;U.photo.tex=keep.pt;U.dxf.ents=keep.de;U.dxf.raw=keep.dr;
 U.sel=null;U._layersOpen=false;U._hudMin=true;U._titleMin=true;U.polyInput={on:false,pts:[],target:null};U.calib={on:false,a:null,b:null};
 if(!Array.isArray(U.annot))U.annot=[];if(!Array.isArray(U.subsurface))U.subsurface=[];if(!U.ojt)U.ojt={};if(!Array.isArray(U.roads))U.roads=[];
 if(U.site&&U.site.active==null)U.site.active=true;
 migrateLegacyVehicles();
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
 const tg=e.target; const inField=tg&&(tg.tagName==="INPUT"||tg.tagName==="TEXTAREA"||tg.tagName==="SELECT");
 if(U.polyInput&&U.polyInput.on&&!inField){
  if(e.key==="Escape"){U.polyInput.on=false;U.polyInput.pts=[];U.polyInput.target=null;rebuild();renderPanel();renderBar();toast("なぞりを中止しました");e.preventDefault();return;}
  if(e.key==="Backspace"||e.key==="Delete"){if(U.polyInput.pts.length){U.polyInput.pts.pop();rebuild();renderPanel();renderBar();toast("1点戻しました（"+U.polyInput.pts.length+"点）");}e.preventDefault();return;}
 }
 if(e.key==="Escape"&&typeof _sheet!=="undefined"&&_sheet&&!inField){closeSheet();return;}
 if(e.key==="Escape"&&U.under&&U.under._crop&&!inField){U.under._crop=null;renderPanel();toast("切り取りを中止しました");return;}
 if(e.key==="Escape"&&U.sel&&!inField){clearSelection({restore:true});return;}
 if((e.key==="Delete"||e.key==="Backspace")&&U.sel&&!inField&&!(U.polyInput&&U.polyInput.on)){e.preventDefault();deleteSel();return;}
 if((e.ctrlKey||e.metaKey)&&(e.key==="d"||e.key==="D")&&U.sel&&!inField){e.preventDefault();duplicateSel();return;}
 if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&(e.key==="z"||e.key==="Z")){
  const t=e.target; if(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.tagName==="SELECT"))return;
  e.preventDefault(); undo();
 }
});

window.S=(path,v,re=true)=>{snapshot(path);const ks=path.split(".");let o=U;while(ks.length>1)o=o[ks.shift()];o[ks[0]]=v;
 if(path==="tw.fenceGateSeg"){if(v<0){U.tw.fenceGate="none";}else{if(U.tw.fenceGate==="none")U.tw.fenceGate="front";}}
 if(re)rebuildThrottled();};
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
// 仮囲いセクション（矩形／任意形状）：各工程フェーズで共用
function fenceSectionHtml(){
 const poly=(U.tw.fenceShape==="poly"), n=(U.tw.fencePts||[]).length, drawing=(U.polyInput.on&&U.polyInput.target==="fence");
 let h=CK("仮囲いを表示",U.tw.fence,"(v)=>S('tw.fence',v)");
 if(!U.tw.fence)return h;
 h+=`<div style="padding-left:10px">
  <div style="display:flex;gap:6px;margin:4px 0 8px">
   <button class="btn ${!poly?"active":""}" style="flex:1;font-size:11px" onclick="snapshot();U.tw.fenceShape='rect';rebuild();renderPanel()">矩形</button>
   <button class="btn ${poly?"active":""}" style="flex:1;font-size:11px" onclick="snapshot();U.tw.fenceShape='poly';if(!(U.tw.fencePts||[]).length)fenceFromSite(1);rebuild();renderPanel()">任意形状（なぞる）</button>
  </div>
  ${SL("パネル高さ m",U.tw.fenceH,"(v)=>S('tw.fenceH',v)",2,8,0.5)}`;
 if(poly){
  h+=drawing
   ?`<div style="background:#FFF3DD;border:1.5px dashed var(--amber);border-radius:8px;padding:8px 10px;font-size:11.5px;line-height:1.7"><b>仮囲いをなぞり中（${U.polyInput.pts.length}点）</b><br>図面・地面をクリックして頂点を打ち、<b>ダブルクリックで閉じる</b>。<button class="btn" style="margin-top:6px;font-size:11px" onclick="U.polyInput.on=false;U.polyInput.pts=[];U.polyInput.target=null;rebuild();renderPanel();renderBar()">中止</button></div>`
   :`<button class="addbtn" style="margin-bottom:6px" onclick="U.polyInput.on=true;U.polyInput.target='fence';U.polyInput.pts=[];renderPanel();renderBar()">✏️ 図面をなぞって囲いを描く（クリック→ダブルクリックで閉じる）</button>
     <div class="grid2" style="margin-bottom:6px">
      <button class="btn" style="font-size:11px" onclick="snapshot();fenceFromSite(1);rebuild();renderPanel()">敷地の外周から作る</button>
      <button class="btn" style="font-size:11px" onclick="snapshot();fenceFromSite(-1)||fenceFromSite(1);rebuild();renderPanel()">敷地より1m内側</button>
     </div>
     <div style="font-size:11px;color:var(--navy);font-weight:700;margin:2px 0 4px">頂点 ${n} 点　　外周 ${fencePerimeter().toFixed(1)} m</div>
     <div class="hint" style="margin:0 0 6px">橙の球（頂点）をドラッグで修正。囲い全体はパネルをドラッグ／Ctrl＋ドラッグで回転。</div>
     <label class="f"><span>ゲート（出入口）を置く辺</span><select onchange="S('tw.fenceGateSeg',+this.value)"><option value="-1" ${U.tw.fenceGate==="none"?"selected":""}>開口なし</option>${Array.from({length:n},(_,i)=>`<option value="${i}" ${U.tw.fenceGate!=="none"&&Math.round(numv(U.tw.fenceGateSeg,0))===i?"selected":""}>辺 ${i+1}（${fenceSegLen(i).toFixed(1)}m）</option>`).join("")}</select></label>
     <div class="grid2"><button class="btn" style="font-size:11px" onclick="snapshot();fenceAddVertex();rebuild();renderPanel()">＋ 頂点を追加</button><button class="btn" style="font-size:11px;color:#B0433A" onclick="snapshot();fenceRemoveVertex();rebuild();renderPanel()">－ 最後の頂点を削除</button></div>`;
 }else{
  h+=`<label class="f"><span>ゲート（出入口）位置</span><select onchange="S('tw.fenceGate',this.value)">
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
   ${SL("回転 °（1度刻み）",U.tw.fenceRy,"(v)=>S('tw.fenceRy',v)",0,359,1)}
   <button class="btn" style="width:100%;margin-top:4px;font-size:11px;color:#B0433A" onclick="snapshot();U.tw.fenceW=0;U.tw.fenceD=0;U.tw.fenceDx=0;U.tw.fenceDz=0;U.tw.fenceRy=0;rebuild();renderPanel()">↺ 仮囲いの位置と寸法をリセット</button>`;
 }
 return h+`</div>`;
}
// 敷地外周（矩形／多角形）から仮囲い頂点を作る。inset: 外周からの内側オフセット(m)。
function fenceFromSite(inset){
 inset=numv(inset,0);
 if(U.site.active===false){toast("先に敷地を作成してください","err");return false;}
 if(Array.isArray(U.site.poly)&&U.site.poly.length>=3){
  U.tw.fencePts=U.site.poly.map(p=>({x:+p.x.toFixed(2),z:+p.z.toFixed(2)}));   // 多角形敷地：そのまま（オフセットは手で頂点を動かす）
 }else{
  const w=posv(U.site.w,25)/2-inset, d=posv(U.site.d,20)/2-inset; if(w<1||d<1)return false;
  U.tw.fencePts=[{x:-w,z:-d},{x:w,z:-d},{x:w,z:d},{x:-w,z:d}];
 }
 U.tw.fenceShape="poly"; U.tw.fenceDx=0; U.tw.fenceDz=0; U.tw.fenceRy=0; U.tw.fenceGateSeg=2; return true;
}
function fenceSegLen(i){const p=U.tw.fencePts||[];if(p.length<2)return 0;const a=p[i],b=p[(i+1)%p.length];return Math.hypot(b.x-a.x,b.z-a.z);}
function fencePerimeter(){const p=U.tw.fencePts||[];let s=0;for(let i=0;i<p.length;i++)s+=fenceSegLen(i);return s;}
function fenceAddVertex(){const p=U.tw.fencePts||[];if(p.length<2)return;const a=p[p.length-1],b=p[0];p.push({x:+((a.x+b.x)/2).toFixed(2),z:+((a.z+b.z)/2).toFixed(2)});}
function fenceRemoveVertex(){const p=U.tw.fencePts||[];if(p.length>3)p.pop();else toast("頂点は3点以上必要です","err");}
window.fenceFromSite=fenceFromSite;window.fenceAddVertex=fenceAddVertex;window.fenceRemoveVertex=fenceRemoveVertex;window.fenceSegLen=fenceSegLen;window.fencePerimeter=fencePerimeter;
// 各タブ冒頭の「このタブでやること」
const TAB_DESC={
 "諸元":["案件情報から始める","案件名と計画地住所を入力。住所から国土地理院の地図まで一気に取得できます。"],
 "形状":["建物の形を作る","建物を追加して、幅・奥行・階数を入れ、3Dを見ながら位置を合わせます。"],
 "敷地・地形":["敷地と道路を合わせる","敷地形状 → 前面道路 → 必要なら高低差、の順で進めます。"],
 "近隣":["周辺建物を置く","隣接建物は必要な時だけ。高さと離隔を入れて3Dで確認します。"],
 "下敷き":["地図・プランPDFを敷く","案件住所の地図を確認し、プランPDFを読み込んで敷地・建物をなぞる準備をします。"],
 "仮設":["施工の流れと仮設","工程を選び、まずクレーンと仮囲い。必要に応じて足場・EV・車両を追加します。"],
 "施工/CAD":["重機・車両・注記","必要なものだけ追加して3D上で配置。細かい補助機能は最後でOKです。"],
 "検討":["結果を確認して出力","要検討・注意を確認し、最後に検討シート・画像・BIMへ出力します。"],
};
const TAB_QUICK={
 "下敷き":["元図を置く","縮尺を合わせる","真上で確認"],
 "敷地・地形":["敷地を決める","道路を合わせる","高低差は必要時"],
 "形状":["建物を追加","寸法・階数","3Dで位置調整"],
 "諸元":["案件名・住所","地図を取得","規模を入力"],
 "近隣":["近隣を追加","高さ・離隔","必要な時だけ"],
 "仮設":["工程を選ぶ","TC・仮囲い","3Dで配置"],
 "施工/CAD":["必要物を追加","3Dで動かす","注記・補助は最後"],
 "検討":["要検討を見る","必要なら修正","出力・共有"],
};
const TAB_SYS={"下敷き":"BASE","敷地・地形":"TRACE","形状":"TRACE","諸元":"DATA","近隣":"CONTEXT","仮設":"PLAN","施工/CAD":"PLAN","検討":"REVIEW"};
const SEC_GUIDE={
 "基本情報":["MAIN","まずここ","案件名・用途・構造・階数を入力"],
 "面積（実測値を優先・空欄は自動）":["OPTION","分かれば","実測値がある項目だけ入力。空欄でも自動算出"],
 "その他・備考":["OPTION","必要なら","案件固有の条件・申し送りを残す"],
 "計画地・公共データ照会":["MAIN","住所から","住所検索・標高・地図取得"],
 "敷地 寸法・形状":["MAIN","まずここ","敷地の幅・奥行、または多角形を設定"],
 "敷地 位置・地盤・高低差":["OPTION","必要なら","GL・敷地位置・高低差を調整"],
 "道路・歩道・電柱":["MAIN","次に","前面道路の幅・位置・歩道を設定"],
 "前面道路での施工計画の検討":["CHECK","確認","生コン車・ポンプ車の収まりと残車道幅"],
 "斜線制限ガイド":["CHECK","確認","法規の目安を3Dで確認"],
 "日当たり・日影検討":["OPTION","必要なら","太陽位置を変えて日影を確認"],
 "仮囲い（任意）":["OPTION","必要なら","既存解体時の仮囲いを設定"],
 "揚重・クレーン":["MAIN","まずここ","工程・タワークレーン・ラフターを設定"],
 "仮囲い・足場":["MAIN","次に","仮囲いと外部足場を設定"],
 "車両・その他":["OPTION","必要なら","EV・生コン車などを追加"],
 "補助ツール（寸法・グリッド・道路条件・DXF）":["ADV","詳細","寸法・グリッド・DXFなどの補助機能"],
};
function tabDesc(tab){
 const d=TAB_DESC[tab];if(!d)return "";
 const q=TAB_QUICK[tab]||[];
 return `<div class="tab-desc v4-brief v4-brief2">
   <div class="td-head"><small>${TAB_SYS[tab]||"WORK"} / THIS TAB</small><b>${d[0]}</b></div>
   <span class="td-copy">${d[1]}</span>
   <div class="td-flow td-flow2">${q.map((x,i)=>`<span class="${i===0?"main":""}"><i>${i===0?"START":String(i+1).padStart(2,"0")}</i><b>${x}</b></span>`).join("")}</div>
  </div>`;
}
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
 const icon=opt.icon?`<span class="sec-icon">${opt.icon}</span>`:"";
 const gd=SEC_GUIDE[title]||null;
 const g=gd?`<span class="sec-guide"><i class="${gd[0].toLowerCase()}">${gd[1]}</i><small>${gd[2]}</small></span>`:"";
 return `<div class="sec ${open?"open":""} ${gd?"guided":""}">
   <div class="sec-h" onclick="toggleSec('${key.replace(/'/g,"")}')">
     <span class="sec-title">${icon}<b>${title}</b>${g}</span>
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
function placementAnchor(extra=3){
 const sdx=numv(U.site&&U.site.dx,0),sdz=numv(U.site&&U.site.dz,0);
 if(!U.site||U.site.active!==false)return {x:sdx,z:sdz+posv(U.site.d,18)/2+extra};
 const b=(U.blocks||[])[0];
 if(b){
  let depth=posv(b.d,10);
  if(b.shape==="poly"&&Array.isArray(b.poly)&&b.poly.length){const zs=b.poly.map(p=>numv(p.z,0));depth=Math.max(2,Math.max(...zs)-Math.min(...zs));}
  return {x:sdx+numv(b.dx,0),z:sdz+numv(b.dz,0)+Math.min(8,Math.max(3,depth/2+2))};
 }
 return {x:numv(ctrl&&ctrl.cx,0),z:numv(ctrl&&ctrl.cz,0)+Math.max(2,extra)};
}
window.placementAnchor=placementAnchor;
window.setPrimaryCrane=(v)=>{
 if(v&&U.site.active===false){const a=placementAnchor(0);U.tw.craneX=a.x;U.tw.craneZ=a.z;}
 S('tw.crane',!!v);
};
window.clearSite=()=>{
 snapshot();U.site.active=false;U.site.poly=null;if(U.sel==="site"||(U.sel||"").startsWith("spt:"))U.sel=null;
 const a=placementAnchor(0);if(!U.tw.crane){U.tw.craneX=a.x;U.tw.craneZ=a.z;}
 _selCamBase=null;_selCamKey=null;rebuild();renderPanel();toast("敷地を削除しました。重機・仮設物は建物または画面中央付近に追加されます。","ok");
};
window.restoreSite=()=>{snapshot();U.site.active=true;U.site.poly=null;rebuild();renderPanel();toast("矩形敷地を表示しました。寸法を入力するか、図面から多角形でなぞれます。","ok");};
window.delB=(id)=>{snapshot();U.blocks=U.blocks.filter(b=>b.id!==id);if(U.sel&&U.sel.startsWith("blk:"))U.sel=null;_selCamBase=null;_selCamKey=null;rebuild();renderPanel();};
window.addB=()=>{snapshot();U.blocks.push({id:Date.now(),label:"ブロック",f1:1,f2:2,w:15,d:10,dx:0,dz:8});rebuild();renderPanel();};
window.delN=(i)=>{snapshot();U.nbs.splice(i,1);rebuild();renderPanel();};
window.addN=()=>{snapshot();U.nbs.push({x:25,z:15,w:10,d:10,h:12,ry:0});rebuild();renderPanel();};
const V4_PHASE_META={
 demo:{no:"01",en:"DEMOLITION",ja:"既存解体"},
 retain:{no:"02",en:"EXCAVATION",ja:"山留め・掘削"},
 pile:{no:"03",en:"PILE WORK",ja:"杭工事"},
 steel:{no:"04",en:"STEEL FRAME",ja:"鉄骨建て方"},
 build:{no:"05",en:"STRUCTURE",ja:"躯体・仮設"},
 plan:{no:"06",en:"COMPLETE",ja:"完成"}
};
let _phaseFxToken=0;
function v4PhaseSceneTransition(next){
 if(!V4_PHASE_META[next]||U.tw.mode===next)return;
 const token=++_phaseFxToken,from=V4_PHASE_META[U.tw.mode]||{no:"--",en:"",ja:""},to=V4_PHASE_META[next];
 const reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 snapshot();
 if(reduce){U.tw.mode=next;U.sel=null;_selCamBase=null;_selCamKey=null;rebuild();renderPanel();if(typeof renderMobile==="function")renderMobile();return;}
 let el=document.getElementById("v4-phase-scene");
 if(!el){el=document.createElement("div");el.id="v4-phase-scene";document.body.appendChild(el);}
 el.className="";
 el.innerHTML=`<div class="v4ps-scan"></div><div class="v4ps-main">
   <small>CONSTRUCTION SEQUENCE</small>
   <div class="v4ps-route"><span>${from.no}</span><i>→</i><b>${to.no}</b></div>
   <h2>${to.en}</h2><p>${to.ja}</p>
  </div><div class="v4ps-line"><i></i></div>`;
 document.body.classList.add("phase-switching");
 requestAnimationFrame(()=>el.classList.add("show"));
 const baseR=ctrl.r;
 cameraTween({theta:ctrl.theta+.025,r:Math.min(800,baseR*1.025)},170);
 setTimeout(()=>{
  if(token!==_phaseFxToken)return;
  U.tw.mode=next;
  {const sk=String(U.sel||"");let keep=true;
   if(sk.startsWith("co:")){const c=U.cobj[+sk.slice(3)];keep=!!c&&cobjVisibleInPhase(c,next);}
   else if(sk==="crane")keep=(next==="build"||next==="steel");
   else if(sk==="ev")keep=(next==="build");
   else if(sk==="fence"||sk.startsWith("fpt:"))keep=(next!=="plan");
   if(!keep){U.sel=null;_selCamBase=null;_selCamKey=null;}
  }
  rebuild();renderPanel();if(typeof renderMobile==="function")renderMobile();
  el.classList.add("swap");cameraTween({theta:ctrl.theta-.025,r:baseR},300);
 },145);
 setTimeout(()=>{if(token===_phaseFxToken){el.classList.add("out");document.body.classList.remove("phase-switching");}},500);
 setTimeout(()=>{if(token===_phaseFxToken){el.className="";el.innerHTML="";}},760);
}
window.v4PhaseSceneTransition=v4PhaseSceneTransition;
window.setMode=(m)=>v4PhaseSceneTransition(m);
window.addCO=(type)=>{if(U.tw.mode==="plan"&&type!=="obstacle"){toast("完成フェーズでは仮設物を配置しません。工程を施工中へ戻してください","err");return;}snapshot();const t=COBJ_TYPES[type]||COBJ_TYPES.truck;
 const preferred={rough:"25t",pump:"m4t",mixer:"8t",truck:"4t"}[type];
 const sz=(preferred&&cobjSize(type,preferred))||t.sizes[0];
 const a=placementAnchor(5),nx0=a.x,nz0=a.z;const hd=(U.snap!==false)?nearestRoadHeading(nx0,nz0):null;
 const obj={type,size:sz.key,x:nx0,z:nz0,w:sz.w,d:sz.d,h:sz.h,ry:hd!=null?hd:0,phase:U.tw.mode};
 if(type==="rough"){obj.boomPct=55;obj.boomAngle=42;obj.boomRy=0;obj.outPct=70;}
 if(type==="pump"){obj.boomPct=62;obj.boomAngle=48;obj.boomRy=0;obj.outPct=85;}
 U.cobj.push(obj);U.sel="co:"+(U.cobj.length-1);rebuild();renderPanel();focusSelectionCamera(U.sel,{duration:220});};
window.addTowerCrane=(model="JCL015")=>{snapshot();const t=COBJ_TYPES.towercrane,sz=t.sizes.find(s=>s.key===model)||t.sizes[0],spec=craneSpec(sz.key);
 const i=(U.cobj||[]).filter(c=>c.type==="towercrane").length,a=placementAnchor(2);
 const bx=U.site.active===false?a.x:numv(U.tw.craneX,0),bz=U.site.active===false?a.z:numv(U.tw.craneZ,0);
 U.cobj.push({type:"towercrane",size:sz.key,x:bx+i*4,z:bz,w:sz.w,d:sz.d,h:spec.selfH||sz.h,ry:numv(U.tw.craneRot,0),phase:(U.tw.mode==="steel"?"steel":"build")});
 U.sel="co:"+(U.cobj.length-1);rebuild();renderPanel();focusSelectionCamera(U.sel,{duration:240});if(typeof renderMobile==="function")renderMobile();
 toast("追加タワークレーンを配置しました。ドラッグで位置調整できます","ok");
};
window.delCO=(i)=>{snapshot();U.cobj.splice(i,1);if(U.sel==="co:"+i)U.sel=null;_selCamBase=null;_selCamKey=null;rebuild();renderPanel();};
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
window.delSub=(i)=>{snapshot();U.subsurface.splice(i,1);if(U.sel==="sub:"+i)U.sel=null;_selCamBase=null;_selCamKey=null;rebuild();renderPanel();};
// ───── 注記（地面貼り付け）─────
window.addAnnotZone=()=>{snapshot();const sdz2=numv(U.site.dz,0),sd2=posv(U.site.d,18);U.annot.push({type:"zone",x:numv(U.site.dx,0),z:sdz2,w:8,d:6,ry:0,color:"red"});U.sel="an:"+(U.annot.length-1);rebuild();renderPanel();};
window.addAnnotText=()=>{const t=prompt("注記の文字を入力（40文字まで）","注意");if(t==null)return;snapshot();const sdz2=numv(U.site.dz,0);U.annot.push({type:"text",x:numv(U.site.dx,0),z:sdz2,ry:0,color:"red",text:t.slice(0,40),fsize:2.5});U.sel="an:"+(U.annot.length-1);rebuild();renderPanel();};
window.editAnnotText=(i)=>{const a=U.annot[i];if(!a)return;const t=prompt("注記の文字を編集",a.text||"");if(t==null)return;snapshot();a.text=t.slice(0,40);rebuild();renderPanel();};
window.delAnnot=(i)=>{snapshot();U.annot.splice(i,1);if(U.sel==="an:"+i)U.sel=null;_selCamBase=null;_selCamKey=null;rebuild();renderPanel();};
window.setCOSize=(i,key)=>{const c=U.cobj[i];if(!c)return;const sz=cobjSize(c.type,key);if(sz){snapshot();c.size=key;c.w=sz.w;c.d=sz.d;c.h=(c.type==="towercrane"?(craneSpec(key).selfH||sz.h):sz.h);if(c.type==="rough"||c.type==="pump"){if(c.boomPct==null)c.boomPct=60;if(c.boomAngle==null)c.boomAngle=45;if(c.boomRy==null)c.boomRy=0;if(c.outPct==null)c.outPct=80;}}rebuild();renderPanel();};
window.setCOParam=(i,k,v)=>{const c=U.cobj[i];if(!c)return;const n=parseFloat(v);if(!isFinite(n))return;snapshot("co."+i+"."+k);c[k]=n;rebuildThrottled();};
window.setCOHeight=(i,v)=>{const c=U.cobj[i];if(!c)return;const n=parseFloat(v);if(!isFinite(n))return;const spec=c.type==="towercrane"?craneSpec(c.size):null;const lo=spec&&spec.selfH?spec.selfH:0.1,hi=spec&&spec.maxInstallH?spec.maxInstallH:80;snapshot("co."+i+".h");c.h=Math.max(lo,Math.min(hi,n));rebuild();renderPanel();if(typeof renderMobile==="function")renderMobile();};
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

window.jumpTab=(group,tab)=>{U.tabGroup=group;U.tab=tab;renderPanel();};

function renderPanel(){
 // 実務フロー：①案件情報 → ②地図・PDF・トレース → ③仮設 → ④検討
 // 「どの機能カテゴリか」ではなく「実務で何をする順か」で入口を固定する。
 const TAB_LABEL={"下敷き":"地図・PDF","敷地・地形":"敷地・道路","形状":"建物","諸元":"案件情報","近隣":"近隣","仮設":"工程・TC・仮囲い","施工/CAD":"配置・重機","検討":"判定・出力"};
 const TAB_GROUPS=[
   {key:"1", label:"案件", tabs:["諸元"]},
   {key:"2", label:"図面・敷地", tabs:["下敷き","敷地・地形","形状","近隣"]},
   {key:"3", label:"仮設", tabs:["仮設","施工/CAD"]},
   {key:"4", label:"検討", tabs:["検討"]},
 ];
 // 旧グループ名からの読み替え（保存済み案件との互換）
 if(!U.tabGroup||!TAB_GROUPS.some(g=>g.key===U.tabGroup)){const g=TAB_GROUPS.find(g=>g.tabs.includes(U.tab));U.tabGroup=g?g.key:"2";}
 const curG=TAB_GROUPS.find(g=>g.key===U.tabGroup)||TAB_GROUPS[1];
 if(!curG.tabs.includes(U.tab))U.tab=curG.tabs[0];
 const GROUP_EN={"1":"PROJECT","2":"BASE","3":"PLAN","4":"REVIEW"};
 const groupBar=TAB_GROUPS.map(g=>`<div data-group="${g.key}" class="tg step ${U.tabGroup===g.key?"on":""}" onclick="U.tabGroup='${g.key}';U.tab='${g.tabs[0]}';v4PanelStage('${g.key}','${g.label}');renderPanel()"><span class="step-n">${g.key}</span><span class="step-l">${g.label}</span><small class="step-e">${GROUP_EN[g.key]||""}</small></div>`).join("");
 const subBar=curG.tabs.length>1
   ? `<div id="subtabs">${curG.tabs.map(t=>`<div data-tab="${t}" class="${U.tab===t?"on":""}" onclick="U.tab='${t}';renderPanel()">${TAB_LABEL[t]||t}</div>`).join("")}</div>`
   : "";
 const FLOW_NAV=[
   ["1","諸元","01","案件",!!(U.p.name&& !String(U.p.name).startsWith("新規案件") && posv(U.p.floors,0))],
   ["2","下敷き","02","地図",!!(U.under&&U.under.gsiStatus&&String(U.under.gsiStatus).startsWith("✓"))],
   ["2","下敷き","03","PDF",!!(U.under&&U.under.raw)],
   ["2","敷地・地形","04","敷地",siteArea()>0],
   ["2","形状","05","建物",!!(U.blocks&&U.blocks.length)],
   ["3","仮設","06","仮設",!!(U.tw&&(U.tw.mode!=="plan"||U.tw.crane||U.tw.fence||U.tw.scaffold||(U.cobj&&U.cobj.length)))]
 ];
 const commandBar=`<div id="project-command" class="compact">
   <span class="pc-flow-label">PJ FLOW</span>
   <div class="pc-flow pc-flow-inline">${FLOW_NAV.map(([g,t,n,l,done])=>`<button class="${U.tab===t?"on":""} ${done?"done":""}" onclick="jumpTab('${g}','${t}')"><i>${done?"✓":n}</i><b>${l}</b></button>`).join("")}</div>
  </div>`;
 $("#tabs").innerHTML=`<div id="tabgroups">${groupBar}</div>${subBar}${commandBar}`;
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
  <label class="f"><span>計画地住所</span><input type="text" placeholder="例：東京都文京区白山1丁目…" value="${(U.p.addr||"").replace(/"/g,"&quot;")}" oninput="S('p.addr',this.value,false);U.geo.lat=null;U.geo.lon=null;U.geo.name='';U.geo.status='';renderTitle()"></label>
  <div class="project-map-action"><button class="addbtn project-map-btn" onclick="fetchGeoAndMap()">🗺 住所から国土地理院地図を取得 →</button><small>住所検索 → 標高取得 → 地図表示まで自動で進みます</small></div>
  <label class="f"><span>用途（ファサード連動）</span><select onchange="S('p.use',this.value)">${USES.map(o=>`<option ${U.p.use===o?"selected":""}>${o}</option>`).join("")}</select></label>
  <div class="grid2">
   <label class="f"><span>地上階数</span><input type="number" value="${U.p.floors}" oninput="S('p.floors',this.value)"></label>
   <label class="f"><span>建物高さ m</span><input type="number" value="${U.p.height}" oninput="S('p.height',this.value)"></label>
   <label class="f"><span>建蔽率 限度%</span><input type="number" step="5" min="0" max="100" placeholder="例 60→80（緩和）" value="${U.p.bcrLimit||""}" oninput="S('p.bcrLimit',parseFloat(this.value)||0,false);renderTitle()"></label>
   <label class="f"><span>容積率 限度%</span><input type="number" step="10" min="0" max="1500" placeholder="例 300" value="${U.p.farLimit||""}" oninput="S('p.farLimit',parseFloat(this.value)||0,false);renderTitle()"></label>
   <label class="f"><span>緩和メモ</span><input type="text" placeholder="例 耐火建築物+角地 +20%" value="${(U.p.bcrNote||"").replace(/"/g,"&quot;")}" oninput="S('p.bcrNote',this.value,false)"></label>
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
   ${SL("回転 °（1度刻み）",numv(b.ry,0),`(v)=>SB(${b.id},'ry',v)`,0,359,1)}
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
  let secGeo=`<div class="project-address-ref"><small>案件情報の計画地住所</small><b>${_esc(U.p.addr||"未入力")}</b></div>
  ${U.p.addr?`<div class="grid2" style="margin-bottom:6px"><button class="btn" onclick="fetchGeo()">📍 標高を更新</button><button class="btn primary" onclick="fetchGeoAndMap()">🗺 地図を取得</button></div>`:`<button class="addbtn" onclick="jumpTab('1','諸元')">→ まず案件情報で住所を入力</button>`}`;
  if(U.geo.status){secGeo+=`<div style="background:#EEF3FA;border-radius:7px;padding:7px 9px;font-size:11px;line-height:1.7;color:#1E3A5F;white-space:pre-wrap;margin-bottom:6px">${U.geo.name?("📍 "+U.geo.name+"\n"):""}${U.geo.status}</div>`;}
  if(U.p.addr){secGeo+=`<div style="font-size:10.5px;color:var(--mut);margin-bottom:3px">▼ ${city||"計画地"}の公開情報を検索（別タブ）</div>
   <div style="display:flex;flex-direction:column;gap:4px">
    <a href="https://www.google.com/search?q=${ge(city+" 都市計画情報 用途地域")}" target="_blank" rel="noopener" style="font-size:11.5px;color:#2552A0">🔎 都市計画・用途地域</a>
    <a href="https://www.google.com/search?q=${ge(city+" ハザードマップ")}" target="_blank" rel="noopener" style="font-size:11.5px;color:#2552A0">🔎 ハザードマップ</a>
    <a href="https://disaportal.gsi.go.jp/" target="_blank" rel="noopener" style="font-size:11.5px;color:#2552A0">🔎 重ねるハザードマップ（国交省）</a>
    <a href="https://www.google.com/search?q=${ge(city+" 地盤 ボーリング 柱状図")}" target="_blank" rel="noopener" style="font-size:11.5px;color:#2552A0">🔎 周辺の地盤・ボーリングデータ</a>
   </div>`;}
  // ② 敷地寸法・形状
  let secSite=`<div class="site-state-row">${U.site.active===false?`<button class="btn primary" onclick="restoreSite()">＋ 矩形敷地を作る</button><span>現在：敷地なし</span>`:`<button class="btn btn-danger" onclick="clearSite()">敷地を削除</button><span>不要なら消してOK</span>`}</div>
  ${U.site.active===false?`<div class="hint site-empty-hint">敷地を削除しても建物・PDF・仮設は残ります。重機や仮設物の追加位置も、存在しない初期敷地ではなく建物／画面中央を基準にします。</div>`:""}
  <div class="grid2">
   <label class="f"><span>敷地 間口 m</span><input type="number" value="${U.site.w}" oninput="S('site.w',this.value)"></label>
   <label class="f"><span>敷地 奥行 m</span><input type="number" value="${U.site.d}" oninput="S('site.d',this.value)"></label>
  </div>
  <div style="font-size:11px;font-weight:700;color:var(--mut);margin:6px 0 2px">敷地形状（不整形地・旗竿地など）</div>
  ${Array.isArray(U.site.poly)&&U.site.poly.length>=3
    ? `<div style="background:#EEF6EF;border:1.5px solid #2E7D5B;border-radius:8px;padding:7px 10px;font-size:11.5px;line-height:1.6">多角形敷地（${U.site.poly.length}頂点）で表示中。<br><button class="btn" style="margin-top:5px;color:#B0433A" onclick="U.site.poly=null;rebuild();renderPanel()">矩形敷地に戻す</button></div>`
    : (U.polyInput.on&&U.polyInput.target==="site"
       ? `<div style="background:#FFF3DD;border:1.5px dashed var(--amber);border-radius:8px;padding:8px 10px;font-size:11.5px;line-height:1.7"><b>敷地形状の入力モード中</b><br>下絵・地面をクリックして敷地外周の頂点を打ち、<b>ダブルクリックで閉じる</b>と敷地になります。<br>現在 ${U.polyInput.pts.length} 点<br><button class="btn" style="margin-top:6px" onclick="U.polyInput.pts.pop();rebuild();renderPanel()">1つ戻す</button> <button class="btn" style="margin-top:6px;color:#B0433A" onclick="U.polyInput.on=false;U.polyInput.pts=[];U.polyInput.target=null;rebuild();renderPanel();renderBar()">中止</button></div>`
       : `${Array.isArray(U.site.poly)?`<div class="hint" style="margin:0 0 6px">敷地をクリックで選択すると<b>青い頂点</b>が出ます。ドラッグで修正、辺の長さも表示。<button class="btn" style="font-size:11px;margin-left:6px" onclick="U.sel='site';rebuild();renderPanel()">頂点を表示</button></div>`:""}<button class="addbtn" onclick="U.site.active=true;U.polyInput.on=true;U.polyInput.target='site';U.polyInput.pts=[];renderPanel();renderBar()">✏️ 敷地を多角形で描く</button><div class="hint">配置図PDFを下敷きにして敷地境界をなぞると、不整形地も正確に再現できます。</div>`)}`;
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
  const drawingRoad=(U.polyInput.on&&U.polyInput.target==="road");
 let secRoad=`<div style="font-size:11px;font-weight:700;color:#2552A0;margin-bottom:4px">実際の道路をなぞって入れる（地図・図面どおり）</div>
  ${drawingRoad
   ?`<div style="background:#FFF3DD;border:1.5px dashed var(--amber);border-radius:8px;padding:8px 10px;font-size:11.5px;line-height:1.7;margin-bottom:6px"><b>道路をなぞり中（${U.polyInput.pts.length}点）</b><br>道路の<b>中心線</b>に沿ってクリック、<b>ダブルクリックで確定</b>（閉じません）。<button class="btn" style="margin-top:6px;font-size:11px" onclick="U.polyInput.on=false;U.polyInput.pts=[];U.polyInput.target=null;rebuild();renderPanel();renderBar()">中止</button></div>`
   :`<button class="addbtn" style="margin-bottom:6px" onclick="U.polyInput.on=true;U.polyInput.target='road';U.polyInput.pts=[];renderPanel();renderBar()">✏️ 道路の中心線をなぞる（クリック→ダブルクリック）</button>`}
  ${(U.roads||[]).map((r,i)=>{const sel=(U.sel==="rd:"+i||(U.sel||"").startsWith("rpt:"+i+":"));let len=0;for(let k=0;k<(r.pts||[]).length-1;k++)len+=Math.hypot(r.pts[k+1].x-r.pts[k].x,r.pts[k+1].z-r.pts[k].z);
    return `<div class="card" style="${sel?'border-color:#F2A33C;background:#FFFBF0':''}" onclick="U.sel='rd:${i}';rebuild();renderPanel()">
     <div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:11.5px">道路 ${i+1}　${len.toFixed(0)}m・${(r.pts||[]).length}点</b><button class="del" onclick="event.stopPropagation();snapshot();U.roads.splice(${i},1);U.sel=null;rebuild();renderPanel()">削除</button></div>
     ${SL("幅員 m",r.w,`(v)=>{U.roads[${i}].w=v;rebuildThrottled();}`,3,20,0.5)}
     <div class="grid2">${SL("歩道 左 m",numv(r.walkL,0),`(v)=>{U.roads[${i}].walkL=v;rebuildThrottled();}`,0,6,0.5)}${SL("歩道 右 m",numv(r.walkR,0),`(v)=>{U.roads[${i}].walkR=v;rebuildThrottled();}`,0,6,0.5)}</div>
     <div style="font-size:10px;color:var(--mut)">選択中は青い頂点をドラッグで修正（他の角に吸着）。道路全体は面をドラッグで移動。歩道は0で非表示。</div></div>`;}).join("")}
  ${(U.roads||[]).length?`<div class="hint" style="margin:0 0 8px">※道路使用検討（縦列・残車道幅）は下の「前面道路 幅員」の値で計算します。実道路の幅を合わせてください。</div>`:""}
  <div style="border-top:1px solid var(--hair);margin:8px 0"></div>
  <div style="font-size:11px;font-weight:700;color:var(--mut);margin-bottom:4px">自動の前面道路（敷地の前に自動配置）</div>
  ${CK("自動の前面道路を表示する",U.road.show!==false,"(v)=>S('road.show',v)")}
  ${U.road.show!==false?CK("自動道路の歩道も表示する",!!U.road.walkShow,"(v)=>S('road.walkShow',v)"):""}
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
  <div style="background:rgba(242,163,60,.09);border:1px solid rgba(242,163,60,.35);border-radius:10px;padding:9px 11px;margin-bottom:8px;font-size:11px;line-height:1.7">
   <b>地図のスクショから道路を起こす手順</b><br>① 地図（Googleマップ等）を<b>スケールバーが写るように</b>スクショして上から読み込む<br>② 下の「2点で縮尺を合わせる」で、スケールバーの両端をクリック → その長さ（例 20m）を入力<br>③ 上部の道具「🛣 道路」で、地図の道路の中心をなぞる → 幅員を入れる<br>④ 「▭ 敷地」「🏢 建物」も同じ地図の上でなぞる<br><span style="color:var(--mut)">※スクショ利用は社内検討用に限り、資料に載せる場合は出典の扱いに注意</span></div>
  <div style="background:rgba(46,111,190,.06);border:1px solid rgba(46,111,190,.25);border-radius:10px;padding:9px 11px;margin-bottom:8px">
   <div style="font-size:11px;font-weight:700;color:#2552A0;margin-bottom:4px">🗺 国（国土地理院）の地図を自動で敷く</div>
   ${(U.geo.lat!=null)
     ? `<div style="font-size:10.5px;color:var(--mut);line-height:1.6;margin-bottom:6px">検索済み地点：${U.geo.name||""}<br>この周辺の地図を自動取得して下敷きにします。</div>
        <div class="grid2" style="margin-bottom:6px">
         <label class="f"><span>地図種類</span><select onchange="setGsiKind(this.value)">${Object.keys(GSI_TILES).map(k=>`<option value="${k}" ${(U.under.gsiKind||"std")===k?"selected":""}>${GSI_TILES[k].label}</option>`).join("")}</select></label>
         <label class="f"><span>詳しさ(14-18)</span><input type="number" min="14" max="18" value="${U.under.gsiZoom||17}" oninput="setGsiZoom(this.value)"></label>
        </div>
        <button class="btn primary" style="width:100%;font-size:12px" onclick="loadGsiMap()">この地点の地図を取得して敷く</button>`
     : `<div style="font-size:10.5px;color:var(--mut);line-height:1.7;margin-bottom:6px">まず①「案件」で<b>計画地住所</b>を入力してください。住所から標高・地図まで一度に取得できます。</div>
        <button class="btn" style="width:100%;font-size:11.5px" onclick="jumpTab('1','諸元')">→ ① 案件情報へ</button>`}
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
  ${U.under._crop&&U.under._crop.on
    ? `<div style="background:#FFF3DD;border:1.5px dashed var(--amber);border-radius:8px;padding:8px 10px;font-size:11.5px;line-height:1.7;margin:6px 0"><b>✂ 切り取り中</b>：残したい範囲の<b>対角2点</b>を下敷きの上でクリック。${U.under._crop.a?"1点目取得済み → 2点目を…":"1点目を…"}<button class="btn" style="margin-left:8px;font-size:11px" onclick="cancelUnderCrop()">中止(Esc)</button></div>`
    : `<div class="grid2" style="margin:6px 0"><button class="btn" style="font-size:11.5px;border:1.5px solid var(--navy)" onclick="startUnderCrop()">✂ 範囲を切り取る（2点）</button>${_underOrig?`<button class="btn" style="font-size:11.5px" onclick="restoreUnder()">↺ 切り取り前に戻す</button>`:`<span></span>`}</div>
       <div class="hint" style="margin:-2px 0 6px">図面の枠・備考・表題欄など不要な部分を外して、必要な範囲だけを残せます。位置と縮尺はそのまま保たれます。</div>`}
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
  const PHASES=[["demo","既存解体","🏚"],["retain","山留め・掘削","⛏"],["pile","杭工事","🔩"],["steel","鉄骨建て方","🏗"],["build","躯体・仮設","🚧"],["plan","完成","🏢"]];
  h=`<div style="font-size:11px;font-weight:700;color:var(--mut);margin-bottom:4px">工程フェーズ（施工の流れ順）</div>
  <div class="phase-grid">${PHASES.map(([k,l,ic])=>`<button class="btn phase ${U.tw.mode===k?"active":""}" onclick="setMode('${k}')"><span>${ic}</span>${l}</button>`).join("")}</div>`;;
  if(U.tw.mode==="plan"){
   h += `<div class="phase-complete-note"><b>🏢 完成フェーズ</b><span>仮囲い・足場・クレーン・重機・安全通路などの仮設物は自動で非表示になります。</span></div>`;
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
   +CK("仮囲い（ゲート付き）",U.tw.fence,"(v)=>S('tw.fence',v)")
   +`<button class="place-link" onclick="jumpTab('3','施工/CAD')"><span>PLACE OBJECTS</span><b>解体重機・車両を配置する →</b></button>`;
  }
  if(U.tw.mode==="retain"){
   const pc=U._pileCount;
   h+=`<div class="hint" style="margin:0 0 8px">建物範囲の外周に山留め壁を立て、掘削底までを表示。地盤を透かして地下の状況を確認できます（腹起し・切梁は掘削2.5m以上で1段表示）。</div>`
   +SL("掘削深さ（根切り底 GL-）m",U.tw.pitDepth,"(v)=>S('tw.pitDepth',v)",1,12,0.5)
   +SL("山留め壁の余裕（建物外周から）m",U.tw.retainMargin,"(v)=>S('tw.retainMargin',v)",0.3,3,0.1)
   +`<div style="border-top:1px solid var(--hair);margin:8px 0"></div>`
   +fenceSectionHtml()
   +`<button class="place-link" onclick="jumpTab('3','施工/CAD')"><span>PLACE OBJECTS</span><b>バックホウ・搬出車両を配置する →</b></button>`
   +`<div class="hint">検討の観点：近隣建物との離隔、地下埋設物、残土搬出の車両動線。<b>OJT 3-3〜3-11</b></div>`;
  }
  else if(U.tw.mode==="pile"){
   const pc=U._pileCount||{n:0,old:0};
   h+=`<div class="hint" style="margin:0 0 8px">建物範囲に新設杭を格子配置（灰色）。既存杭をONにすると赤・半透明で重ね、<b>干渉・撤去要否</b>を立体で確認できます。</div>`
   +`<div class="grid3">${SL("杭ピッチ m",U.tw.pilePitch,"(v)=>S('tw.pilePitch',v)",2,10,0.5)}${SL("杭径 m",U.tw.pileDia,"(v)=>S('tw.pileDia',v)",0.3,2.5,0.1)}${SL("杭長 m",U.tw.pileLen,"(v)=>S('tw.pileLen',v)",3,60,1)}</div>`
   +`<div style="font-size:11px;color:var(--navy);font-weight:700;margin:2px 0 6px">新設杭 ${pc.n} 本${U.tw.oldPiles?`　／　既存杭 <span style="color:#B0433A">${pc.old} 本</span>`:""}</div>`
   +(U._pileNote?`<div style="font-size:10px;color:#C77F1A;margin:-4px 0 6px">${U._pileNote}</div>`:"")
   +`<div style="border-top:1px solid var(--hair);margin:8px 0"></div>`
   +CK("既存杭を重ねて表示（赤・半透明）",U.tw.oldPiles,"(v)=>S('tw.oldPiles',v)")
   +(U.tw.oldPiles?`<div style="padding-left:10px">${SL("既存杭ピッチ m",U.tw.oldPitch,"(v)=>S('tw.oldPitch',v)",2,10,0.5)}${SL("既存杭の角度ずれ °",U.tw.oldRot,"(v)=>S('tw.oldRot',v)",0,90,1)}
      <div class="grid2">${SL("既存範囲の拡がり m",U.tw.oldExtend,"(v)=>S('tw.oldExtend',v)",0,10,0.5)}${SL("既存の位置ずれ 左右 m",U.tw.oldDx,"(v)=>S('tw.oldDx',v)",-10,10,0.5)}</div>${SL("既存の位置ずれ 前後 m",U.tw.oldDz,"(v)=>S('tw.oldDz',v)",-10,10,0.5)}</div>`:"")
   +`<div style="border-top:1px solid var(--hair);margin:8px 0"></div>`
   +fenceSectionHtml()
   +`<button class="place-link" onclick="jumpTab('3','施工/CAD')"><span>PLACE OBJECTS</span><b>杭打機・基礎重機を配置する →</b></button>`
   +`<div class="hint">杭位置は配置の当たりを立体確認するための概算表示です。正確な位置は杭伏図で。<b>OJT 3-16・7-3</b></div>`;
  }
  else if(U.tw.mode==="steel"){
   h+=`<div class="hint" style="margin:0 0 8px">鉄骨の柱・梁・デッキを建て方の進捗に応じて表示。クレーンの作業半径で最遠の柱まで届くかを確認できます。</div>`
   +SL("建て方の進捗（〜階）",U.tw.step,"(v)=>S('tw.step',v)",1,Math.max(1,Math.round(posv(U.p.floors,14))),1)
   +SL("柱スパン（目安）m",U.tw.steelPitch,"(v)=>S('tw.steelPitch',v)",3,12,0.5)
   +`<div style="border-top:1px solid var(--hair);margin:8px 0"></div>`
   +`<div id="tutorial-tc-control">${CK("タワークレーン（ドラッグ移動可）",U.tw.crane,"(v)=>setPrimaryCrane(v)")}</div>`
   +(U.tw.crane?`<div style="padding-left:10px"><label class="f"><span>機種（カタログ仕様）</span><select onchange="S('tw.craneModel',this.value)">${Object.keys(CRANE_SPECS).map(k=>`<option value="${k}" ${U.tw.craneModel===k?"selected":""}>${k}　作業半径${CRANE_SPECS[k].work}m／${CRANE_SPECS[k].cap}t</option>`).join("")}</select></label>${craneSpec(U.tw.craneModel).mast==="tube"?SL("設置高さ m",primaryCraneHeight(craneSpec(U.tw.craneModel),posv(U.p.height,42)/Math.max(1,posv(U.p.floors,1))*Math.max(1,numv(U.tw.step,1))),"(v)=>S('tw.craneHeight',v)",craneSpec(U.tw.craneModel).selfH,craneSpec(U.tw.craneModel).maxInstallH||51,0.5):""}${SL("旋回 °",U.tw.craneRot,"(v)=>S('tw.craneRot',v)",0,360,5)}</div>`:"")
   +`<button class="addbtn tc-add" onclick="addTowerCrane('JCL015')">＋ タワークレーンをもう1台追加</button>`
   +fenceSectionHtml()
   +`<div class="hint">検討の観点：揚重機の作業半径と定格荷重、建て方順序、強風時対策。<b>OJT 15-13・19章</b> を参照。</div>`;
  }
  else if(U.tw.mode==="build"){
   const secCrane = SL("躯体の進捗（〜階）",U.tw.step,"(v)=>S('tw.step',v)",1,Math.max(1,Math.round(posv(U.p.floors,14))),1)
    +`<div id="tutorial-tc-control">${CK("タワークレーン（ドラッグ移動可）",U.tw.crane,"(v)=>setPrimaryCrane(v)")}</div>`
    +(U.tw.crane?`<div style="padding-left:10px"><label class="f"><span>機種（カタログ仕様）</span><select onchange="S('tw.craneModel',this.value)">${Object.keys(CRANE_SPECS).map(k=>`<option value="${k}" ${U.tw.craneModel===k?"selected":""}>${CRANE_SPECS[k].label}</option>`).join("")}</select></label><div style="font-size:10px;color:#2552A0;margin:-2px 0 4px">作業半径 ${craneSpec(U.tw.craneModel).work}m ／ 定格 ${craneSpec(U.tw.craneModel).cap}t ／ 尾部 ${craneSpec(U.tw.craneModel).tail}m</div>${craneSpec(U.tw.craneModel).mast==="tube"?SL("設置高さ m",primaryCraneHeight(craneSpec(U.tw.craneModel),posv(U.p.height,42)/Math.max(1,posv(U.p.floors,1))*Math.max(1,numv(U.tw.step,1))),"(v)=>S('tw.craneHeight',v)",craneSpec(U.tw.craneModel).selfH,craneSpec(U.tw.craneModel).maxInstallH||51,0.5):""}${SL("旋回 °",U.tw.craneRot,"(v)=>S('tw.craneRot',v)",0,360,5)}${CK("作業半径・尾部旋回の円",U.tw.radius,"(v)=>S('tw.radius',v)")}</div>`:"")
    +`<button class="addbtn tc-add" onclick="addTowerCrane('JCL015')">＋ タワークレーンをもう1台追加</button><div class="hint">追加TCは独立して位置・機種・高さを調整できます。</div>`;
   const secFence = fenceSectionHtml()
    +CK("外部足場＋養生シート",U.tw.scaffold,"(v)=>S('tw.scaffold',v)");
   const secPlace = `<button class="place-link big" onclick="jumpTab('3','施工/CAD')"><span>OBJECT LIBRARY</span><b>重機・車両・LSEV・朝顔・安全通路を配置 →</b><small>配置物は「配置・重機」に集約しました</small></button>`;
   h += SEC("揚重・クレーン", secCrane, {key:"tw-crane", icon:"🏗", open:true})
      + SEC("仮囲い・足場", secFence, {key:"tw-fence", icon:"🚧", open:true})
      + secPlace;
  }
  const secAux=CK("電柱・架線（前面道路）",U.tw.poles,"(v)=>S('tw.poles',v)")
   +CK("スケール用の人物を置く",!!U.tw.person,"(v)=>S('tw.person',v)")
   +`<div class="hint">普段は閉じたままでOK。必要な時だけ表示します。</div>`;
  h+=SEC("その他の表示",secAux,{key:"tw-aux",icon:"⋯",open:false});
 }
 if(U.tab==="施工/CAD"){
  const COBJ_CATS=[
    {key:"heavy",code:"01",name:"重機・クレーン",sub:"揚重・掘削・杭",keys:["towercrane","rough","backhoe","found"]},
    {key:"vehicle",code:"02",name:"車両",sub:"生コン・ポンプ・搬入",keys:["mixer","pump","truck"]},
    {key:"temp",code:"03",name:"仮設設備",sub:"EV・朝顔・構台",keys:["safepath","stage","lsev","komalift","temp"]},
    {key:"safety",code:"04",name:"安全・支障物",sub:"警備・歩行帯・現地物",keys:["guard","walkzone","obstacle"]}
  ];
  if(!window.__bimgenCobjCat||!COBJ_CATS.some(c=>c.key===window.__bimgenCobjCat))window.__bimgenCobjCat="heavy";
  const cat=COBJ_CATS.find(c=>c.key===window.__bimgenCobjCat)||COBJ_CATS[0];
  h=`<div class="obj-command"><div><small>OBJECT LIBRARY / ${cat.code}</small><b>配置する物を選ぶ</b><span>工程に応じて必要な物だけ置く。配置後は3Dで直接動かします。</span></div><button onclick="toggleLayers()">LAYER</button></div>
    <div class="obj-cats">${COBJ_CATS.map(c=>`<button class="${c.key===cat.key?"on":""}" onclick="window.__bimgenCobjCat='${c.key}';renderPanel()"><i>${c.code}</i><b>${c.name}</b><small>${c.sub}</small></button>`).join("")}</div>
    <div class="obj-add-grid">${cat.keys.filter(k=>COBJ_TYPES[k]).map(k=>`<button onclick="addCO('${k}')"><span>＋</span><b>${COBJ_TYPES[k].label}</b><small>${COBJ_TYPES[k].sizes[0].label||""}</small></button>`).join("")}</div>`;
  {const _phaseItems=U.cobj.map((c,i)=>({c,i})).filter(o=>cobjVisibleInPhase(o.c,U.tw.mode)),_hidden=U.cobj.length-_phaseItems.length;
   h+=`<details class="obj-placed" ${window.__bimgenPlacedOpen?"open":""} ontoggle="window.__bimgenPlacedOpen=this.open"><summary><span>PLACED / この工程の配置済み</span><b>${_phaseItems.length}</b>${_hidden?`<small>他工程 ${_hidden}</small>`:""}</summary><div>${_phaseItems.length?_phaseItems.map(({c,i})=>{const t=COBJ_TYPES[c.type]||{},s=cobjSize(c.type,c.size)||{};return `<button class="obj-row ${U.sel==="co:"+i?"on":""}" onclick="selCO(${i});focusSelectionCamera('co:${i}',{duration:220})"><span><b>${t.label||c.type}</b><small>${s.label||c.size||""}　X ${numv(c.x,0).toFixed(1)} / Z ${numv(c.z,0).toFixed(1)}</small></span><i>→</i></button>`;}).join(""):`<div class="obj-empty">この工程にはまだ配置物がありません。</div>`}</div></details>`;
  }
  h+=`<div style="margin-top:6px">${CK("スナップ（道路・敷鉄板に吸着／15°刻み回転）",U.snap,"(v)=>S('snap',v,false)")}</div>`;
  // 補助ツール（寸法線・グリッド・道路条件・DXF）を折りたたみに集約
  let secTools=`<div style="font-size:10.5px;font-weight:600;color:var(--mut);margin-bottom:3px">寸法・起算距離</div>
   ${CK("寸法計測モード",U.dim.on,"(v)=>{S('dim.on',v,false);if(!v){U.dim.a=null;U.dim.b=null;}rebuild();renderBar();}")}
   <div class="dim-origin"><button class="${(U.dim.base||"free")==="free"?"on":""}" onclick="setDimBase('free')">自由2点</button><button class="${U.dim.base==="site"?"on":""}" onclick="setDimBase('site')">敷地中心から</button><button class="${U.dim.base==="building"?"on":""}" onclick="setDimBase('building')">建物中心から</button><button class="${U.dim.base==="road"?"on":""}" onclick="setDimBase('road')">道路中心から</button></div>
   ${U._dimDist!=null?`<div class="dim-result"><small>MEASURED DISTANCE</small><b>${U._dimDist.toFixed(2)} m</b></div>`:(U.dim.on?`<div class="hint">${(U.dim.base||"free")==="free"?"1点目→2点目の順にクリック":"起算点は固定済み。測りたい位置をクリックしてください。"}</div>`:"")}
   <div style="border-top:1px solid var(--hair);margin:8px 0 6px"></div>
   <div style="font-size:10.5px;font-weight:600;color:var(--mut);margin-bottom:3px">グリッド</div>
   ${CK("グリッド表示",U.grid.show,"(v)=>S('grid.show',v)")}
   ${U.grid.show?SL("グリッド間隔 m",U.grid.size,"(v)=>S('grid.size',v)",0.5,10,0.5):""}
   <div style="border-top:1px solid var(--hair);margin:8px 0 6px"></div>
   <div style="font-size:10.5px;font-weight:600;color:var(--mut);margin-bottom:3px">道路条件（歩行帯・干渉判定）</div>
   ${SL("車道 幅員 m",U.roadcond.lane,"(v)=>{S('roadcond.lane',v,false);S('road.w',v);}",4,20,0.5)}
   ${SL("歩道 幅員 m",U.roadcond.walk,"(v)=>S('roadcond.walk',v)",0,6,0.5)}
   ${CK("歩行帯を緑帯で表示",!!U.roadcond.showWalk,"(v)=>S('roadcond.showWalk',v)")}
   <div class="hint">歩道幅から歩行帯を判定し、重機が重なると赤く警告します（緑帯は非表示でも判定は働きます）。</div>
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
 if(U.tab==="検討"){
  const cs=collectChecks(); const ico={ok:"●",warn:"▲",ng:"✕",na:"－"}; const col={ok:"#2E7D5B",warn:"#C77F1A",ng:"#B0433A",na:"#6A7385"};
  const nNg=cs.filter(c=>c.lv==="ng").length,nW=cs.filter(c=>c.lv==="warn").length;
  h=`<div style="display:flex;gap:8px;margin-bottom:10px">
    <div style="flex:1;text-align:center;padding:8px;border-radius:10px;background:rgba(46,125,91,.09);color:#2E7D5B"><b style="font-size:20px;display:block">${cs.filter(c=>c.lv==="ok").length}</b><span style="font-size:10.5px">OK</span></div>
    <div style="flex:1;text-align:center;padding:8px;border-radius:10px;background:rgba(242,163,60,.12);color:#C77F1A"><b style="font-size:20px;display:block">${nW}</b><span style="font-size:10.5px">注意</span></div>
    <div style="flex:1;text-align:center;padding:8px;border-radius:10px;background:rgba(176,67,58,.09);color:#B0433A"><b style="font-size:20px;display:block">${nNg}</b><span style="font-size:10.5px">要検討</span></div></div>`
  +cs.map(c=>`<div class="card" style="padding:9px 11px;border-left:4px solid ${col[c.lv]}"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b style="font-size:12px">${ico[c.lv]} ${c.label}</b><span style="font-family:ui-monospace;font-size:12px;font-weight:700;color:${col[c.lv]}">${c.val}</span></div><div style="font-size:11px;color:var(--mut);margin-top:3px">${c.note}</div></div>`).join("")
  +`<div class="hint" style="margin:0 0 10px">目安判定です。正式な可否は関係機関・法規で確認してください。道路使用の詳細は「② なぞる → 敷地・道路」の道路使用検討へ。</div>`
  +`<div style="font-size:11px;font-weight:700;color:var(--mut);margin:6px 0 4px">出力</div>
    <div class="grid2" style="margin-bottom:6px"><button class="btn primary" onclick="exportSheet()">📄 検討シート（A4）</button><button class="btn" onclick="savePNG()">🖼 PNG画像</button></div>
    <div class="grid2" style="margin-bottom:6px"><button class="btn" style="border:1.5px solid #2E7D5B;color:#2E7D5B" onclick="exportIFC()">🧱 IFC出力（GLOOBE等）</button><button class="btn" onclick="exportOBJ()">OBJ/JSON出力</button></div>
    <div class="grid2" style="margin-bottom:10px"><button class="btn" onclick="aiPromptMenu()">✨ AIプロンプト</button><span></span></div>
    <div class="hint" style="margin:-4px 0 10px">IFC（IFC2X3）には、階（階高付き）・各階の床スラブと概算ボリューム・屋上スラブ・敷地（多角形・標高・緯度経度・住所）・諸元のプロパティ・近隣建物・仮囲い・クレーン・重機・道路が入ります。BIM側での階設定・敷地入力の手間を減らせます。</div>`;
  // OJT：全タブ分をまとめて
  const allT=Object.keys(OJT_CHECKS); const tot=allT.reduce((s,t)=>s+OJT_CHECKS[t].length,0), done=allT.reduce((s,t)=>s+OJT_CHECKS[t].filter(i=>U.ojt&&U.ojt[i.k]).length,0);
  h+=`<div style="font-size:11px;font-weight:700;color:var(--mut);margin:6px 0 4px">🎓 OJT検討項目　${done} / ${tot}</div>`+allT.map(t=>ojtSection(t)).join("");
  $("#body").innerHTML=tabDesc("検討")+h; renderSelCard(); return;
 }
 h=tabDesc(U.tab)+h+ojtSection(U.tab);
 $("#body").innerHTML=h;
 renderSelCard();
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
 // 1b) なぞった道路の残り幅（車両がある道路だけ）
 (U._roadClear||[]).forEach(r=>{if(r.n>0)out.push({cat:"道路使用",label:`道路${r.ri+1} 残り幅`,val:`${r.remain}m（幅${r.W}m・${r.n}台）`,lv:r.lv,
   note:r.lv==="ok"?"緊急車両4m確保":r.lv==="warn"?"すれ違い3m可・緊急車両4m未満":"3m未満→片側交互通行・道路使用許可・誘導員"});});
 // 2) 敷地勾配
 try{const si=slopeInfo();const g=Math.max(si.gradeZ,si.gradeX);
  if(si.diff>=0.05)out.push({cat:"地形",label:"敷地勾配",val:`高低差${si.diff.toFixed(2)}m / ${g.toFixed(1)}%`,lv:g>10?"ng":(g>5?"warn":"ok"),
    note:g>10?"造成計画・重機据付面の確保":(g>5?"土工事・擁壁の検討":"問題なし")});
  const rs=Math.abs(numv(U.road.slope,0));if(rs>=0.05){const rg=rs/(posv(U.site.w,25)+10)*100;
    out.push({cat:"地形",label:"道路勾配",val:`${rg.toFixed(1)}%`,lv:rg>8?"warn":"ok",note:rg>8?"生コン車・重機の据付に注意":"問題なし"});}
 }catch(e){}
 // 3) 歩行帯干渉
 const phaseObjs=(U.cobj||[]).filter(c=>cobjVisibleInPhase(c,U.tw.mode));
 const nWarn=phaseObjs.filter(c=>c._warn).length;
 if(phaseObjs.length)out.push({cat:"施工",label:"歩行帯との干渉",val:nWarn?`${nWarn}台が干渉`:"干渉なし",lv:nWarn?"ng":"ok",note:nWarn?"配置変更または歩行者誘導計画":"問題なし"});
 // 4) 法規（建蔽率・容積率：目安値と比較）
 try{const site=posv(U.p.siteArea,0)||siteArea();const st=U._stats||{floorArea:0};
  const tFloor=posv(U.p.tArea,0)||st.floorArea;
  let bcArea=posv(U.p.bldgArea,0);
  if(!bcArea){U.blocks.forEach(b=>{if(Math.max(1,Math.round(posv(b.f1,1)))===1)bcArea+=posv(b.w,10)*posv(b.d,10);});}
  if(site>0){const bcr=bcArea/site*100,far=tFloor/site*100;
   const bl=posv(U.p.bcrLimit,0), fl=posv(U.p.farLimit,0);   // 任意の限度（緩和込み）。0なら目安判定
   if(bl>0)out.push({cat:"法規",label:`建蔽率（限度${bl}%）`,val:`${bcr.toFixed(0)}%`,lv:bcr>bl?"ng":(bcr>bl-5?"warn":"ok"),note:bcr>bl?"限度超過→建築面積の見直し":(bcr>bl-5?"限度まで余裕5%未満":"限度内")});
   else out.push({cat:"法規",label:"建蔽率",val:`${bcr.toFixed(0)}%`,lv:bcr>80?"ng":(bcr>60?"warn":"ok"),note:bcr>60?"用途地域の限度を確認（諸元で限度%を入力可）":"目安内"});
   if(fl>0)out.push({cat:"法規",label:`容積率（限度${fl}%）`,val:`${far.toFixed(0)}%`,lv:far>fl?"ng":(far>fl-20?"warn":"ok"),note:far>fl?"限度超過→延床の見直し":(far>fl-20?"限度まで余裕20%未満":"限度内")});
   else out.push({cat:"法規",label:"容積率",val:`${far.toFixed(0)}%`,lv:far>500?"ng":(far>300?"warn":"ok"),note:far>500?"用途地域の限度を超える可能性大":(far>300?"用途地域の限度を確認（諸元で限度%を入力可）":"目安内")});}
 }catch(e){}
 return out;
}
window.collectChecks=collectChecks;
function closeRightSurfaces(except){
 if(except!=="hud")U._hudMin=true;
 if(except!=="title")U._titleMin=true;
 if(except!=="layers"){U._layersOpen=false;const x=document.getElementById("layers");if(x)x.style.display="none";}
 if(except!=="sel"){const x=document.getElementById("selcard");if(x)x.style.display="none";}
 if(except!=="settings"&&typeof closeSettings==="function")closeSettings();
}
window.closeRightSurfaces=closeRightSurfaces;
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
 if(U._hudMin===undefined)U._hudMin=true;   // PC/スマホとも初期折りたたみ
 const cs=collectChecks();
 const ico={ok:"●",warn:"▲",ng:"✕",na:"－"};
 const cls={ok:"ok",warn:"warn",ng:"ng",na:"na"};
 const nNg=cs.filter(c=>c.lv==="ng").length,nW=cs.filter(c=>c.lv==="warn").length,nOk=cs.filter(c=>c.lv==="ok").length;
 const head=nNg?`<span class="ng">REVIEW ${String(nNg).padStart(2,"0")}</span>`:(nW?`<span class="warn">CAUTION ${String(nW).padStart(2,"0")}</span>`:`<span class="ok">ALL CLEAR</span>`);
 el.innerHTML=`<div class="hud-h"><div class="hud-title"><small>PROJECT CHECK</small><b>検討判定</b></div>${head}<span id="hud-toggle" title="折りたたむ">${U._hudMin?"＋":"－"}</span></div>
  ${U._hudMin?"":`<div class="hud-b"><div class="hud-summary"><span class="ok"><small>OK</small><b>${String(nOk).padStart(2,"0")}</b></span><span class="warn"><small>CAUTION</small><b>${String(nW).padStart(2,"0")}</b></span><span class="ng"><small>REVIEW</small><b>${String(nNg).padStart(2,"0")}</b></span></div>${cs.map(c=>`<div class="hud-row ${cls[c.lv]}" title="${c.note}"><span class="hud-i">${ico[c.lv]}</span><span class="hud-l">${c.label}</span><span class="hud-v">${c.val}</span></div>`).join("")}
  <div class="hud-f">INITIAL REVIEW / 正式な可否は関係機関・法規で確認</div></div>`}`;
 const t=document.getElementById("hud-toggle");if(t)t.onclick=()=>{const opening=!!U._hudMin;U._hudMin=!U._hudMin;if(opening)closeRightSurfaces("hud");renderHUD();renderTitle();};
}
window.renderHUD=renderHUD;
function renderTitle(){
 const _te=document.getElementById("title");if(_te)_te.style.display="";
 renderHUD(); if(typeof renderSelCard==="function")renderSelCard(); if(document.body.classList.contains("simple")&&typeof renderMobile==="function")renderMobile();
 const modeLabel={build:`仮設計画イメージ（${Math.min(U.p.floors,U.tw.step)}階 躯体時）`,demo:"既存解体フェーズ ― 重機配置検討",retain:`山留め・掘削フェーズ（GL-${numv(U.tw.pitDepth,4)}m）`,pile:"杭工事フェーズ ― 杭配置・既存杭の重ね合わせ",steel:`鉄骨建て方フェーズ（〜${Math.min(U.p.floors,U.tw.step)}階）`,plan:"BimGen ― 営業概算BIM"}[U.tw.mode]||"BimGen";
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
 $("#title").innerHTML=`<div class="h" style="display:flex;justify-content:space-between;align-items:center"><span>${modeLabel}</span><span id="title-toggle" style="cursor:pointer;padding:0 4px;font-size:13px" onclick="const opening=!!U._titleMin;U._titleMin=!U._titleMin;if(opening)closeRightSurfaces('title');renderTitle()">${U._titleMin?"＋":"−"}</span></div><div class="b" style="${U._titleMin?"display:none":""}">
  <div style="font-weight:700;font-size:12px;border-bottom:1px solid var(--line);padding-bottom:4px;margin-bottom:4px">${U.p.name||"（物件名未入力）"}</div>
  <table><tr><td>用途・構造</td><td>${U.p.use}・${U.p.struct}造</td></tr>
  ${U.p.addr?`<tr><td>所在地</td><td>${U.p.addr.replace(/</g,"&lt;")}</td></tr>`:""}
  <tr><td>規模</td><td>地上${Math.round(posv(U.p.floors,0))}階　H=${posv(U.p.height,0)}m${un>0?`　${un}戸`:""}</td></tr>
  <tr><td>構成</td><td>${U.blocks.map(b=>`${b.label}${b.f1}-${b.f2}F`).join("＋")}</td></tr></table>${dash}
  ${U.p.note?`<div style="margin-top:5px;font-size:9.5px;color:var(--mut);border-top:1px dotted var(--line);padding-top:4px">${U.p.note.replace(/</g,"&lt;").replace(/\n/g,"<br>")}</div>`:""}
  <div style="margin-top:5px;font-size:9px;color:var(--mut)">※検討用イメージであり実際の建物・施工計画とは異なります</div></div>`;
}
function syncBtns(){renderBar();}
function view(k,opt){const H=posv(U.p.height,42),o=opt||{};
 const t={theta:ctrl.theta,phi:ctrl.phi,r:ctrl.r,ty:Math.max(3,H*.22),cx:numv(U.site.dx,0),cz:numv(U.site.dz,0)};
 if(k==="bird"){t.theta=Math.PI/4+.28;t.phi=.9;t.r=Math.max(H*2.2,130);}
 if(k==="eye"){t.phi=1.45;t.r=Math.max(H*1.7,95);}
 if(k==="front"){t.theta=Math.PI/2;t.phi=1.35;t.r=Math.max(H*2,115);}
 if(k==="top"){t.theta=Math.PI/4;t.phi=.14;t.r=Math.max(H*2,130);}
 U.auto=false;
 if(o.instant){Object.assign(ctrl,t);_camTween=null;}
 else if(o.intro){
  Object.assign(ctrl,{theta:t.theta-.28,phi:Math.max(.5,t.phi-.16),r:t.r*1.28,cx:t.cx,cz:t.cz,ty:t.ty+Math.max(2,H*.06)});
  cameraTween(t,o.duration||900);
 }else cameraTween(t,o.duration||460);
 renderBar();
}
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
  generator:"BimGen", appVersion:APP_VER, schema:"bsbim-2", exportedAt:new Date().toISOString(),
  coordinateSystem:{units:"m", up:"Y", ground:"XZ", origin:"site center (site.origin)", frontRoadSide:"+Z",
    rotation:"degrees, three.js rotation.y (positive: +X toward -Z)", note:"vehicle local X=width, Z=length"},
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
  road:{width_m:posv(U.road.w,8), side:U.road.side, autoRoadShown:U.road.show!==false, sidewalkShown:!!U.road.walkShow, sidewalkWidth_m:numv(U.road.walkW,1.6),
        offset_m:{dx:numv(U.road.dx,0),dz:numv(U.road.dz,0)}, rotation_deg:numv(U.road.ry,0)},
  roadUse:(()=>{try{const r=roadworkCalc();return {mixer:U.roadwork.mixerSize,pump:U.roadwork.pumpSize,mountUp_m:numv(U.roadwork.mountUp,0),
        lineLength_m:r.lineLen, frontage_m:r.front, fitsFrontage:r.fitFront, remainingLane_m:r.remain, emergency4mOK:r.emgOK, passing3mOK:r.passOK,
        permits:{police:U.roadwork.permitPolice||"",roadAdmin:U.roadwork.permitRoad||"",office:U.roadwork.permitOffice||""}};}catch(e){return null;}})(),
  geo:{elevation_m:U.geo&&U.geo.elev!=null?U.geo.elev:null, label:U.geo?U.geo.name:"", lat:U.geo&&U.geo.lat!=null?U.geo.lat:null, lon:U.geo&&U.geo.lon!=null?U.geo.lon:null,
       mapTile:U.under&&U.under.gsiKind?{provider:"国土地理院 地理院タイル",kind:U.under.gsiKind,zoom:U.under.gsiZoom}:null},
  underlay:U.under&&U.under.tex?{width_m:posv(U.under.width,40),rotation_deg:numv(U.under.rot,0),offset_m:{dx:numv(U.under.dx,0),dz:numv(U.under.dz,0)},opacity:numv(U.under.opacity,.7)}:null,
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
  roads_traced:(U.roads||[]).map((r,i)=>{const rc=(U._roadClear||[]).find(x=>x.ri===i);return {id:"road"+(i+1), width_m:numv(r.w,6), sidewalk_m:{left:numv(r.walkL,0),right:numv(r.walkR,0)},
    offset_m:{dx:numv(r.dx,0),dz:numv(r.dz,0)}, rotation_deg:numv(r.ry,0), centerline_m:(r.pts||[]).map(p=>({x:numv(p.x,0),z:numv(p.z,0)})),
    clearance:rc&&rc.n?{vehicles:rc.n,remaining_m:rc.remain,level:rc.lv}:null};}),
  constructionObjects:(U.cobj||[]).map((c,i)=>{const t=COBJ_TYPES[c.type]||{};const sz=cobjSize(c.type,c.size)||{};return {id:"obj"+(i+1), type:c.type, label:t.label||c.type, sizeKey:c.size, sizeLabel:sz.label||null,
    width_m:posv(c.w,sz.w||0), length_m:posv(c.d,sz.d||0), height_m:posv(c.h,sz.h||0), outrigger_m:sz.out||null, tailSwing_m:sz.tail||null, workRadius_m:sz.work||null,
    x_m:numv(c.x,0), z_m:numv(c.z,0), rotation_deg:numv(c.ry,0), walkZoneConflict:!!c._warn, roadClearance:c._roadRemain?{road:"road"+(c._roadRemain.ri+1),remaining_m:c._roadRemain.remain,level:c._roadRemain.lv}:null};}),
  temporaryWorks:{phase:U.tw.mode||"plan", progressFloor:Math.round(numv(U.tw.step,1)),
    towerCrane:U.tw.crane?Object.assign({model:U.tw.craneModel, x_m:numv(U.tw.craneX,0), z_m:numv(U.tw.craneZ,0), jib_m:numv(U.tw.craneJib,0), rotation_deg:numv(U.tw.craneRot,0)},CRANE_SPECS[U.tw.craneModel]||{}):null,
    scaffold:!!U.tw.scaffold, asagaoHeight_m:numv(U.tw.mountH,0)||null, longSpanElevator:U.tw.ev?{x_m:numv(U.tw.evX,0),z_m:numv(U.tw.evZ,0)}:null,
    excavation:{depth_m:numv(U.tw.pitDepth,4), retainingMargin_m:numv(U.tw.retainMargin,1)},
    piles:{pitch_m:numv(U.tw.pilePitch,5), diameter_m:numv(U.tw.pileDia,0.8), length_m:numv(U.tw.pileLen,15), count:U._pileCount?U._pileCount.n:null,
      existing:U.tw.oldPiles?{pitch_m:numv(U.tw.oldPitch,4),rotation_deg:numv(U.tw.oldRot,0),extend_m:numv(U.tw.oldExtend,2),offset_m:{dx:numv(U.tw.oldDx,0),dz:numv(U.tw.oldDz,0)},count:U._pileCount?U._pileCount.old:null}:null},
    steel:{columnPitch_m:numv(U.tw.steelPitch,7)}, poles:!!U.tw.poles},
  neighbors:(U.nbs||[]).map((n,i)=>({id:"nb"+(i+1), x_m:numv(n.x,0), z_m:numv(n.z,0), width_m:posv(n.w,10), depth_m:posv(n.d,10), height_m:posv(n.h,12), rotation_deg:numv(n.ry,0)})),
  demolition:U.tw.mode==="demo"&&U.demo?{offset_m:{dx:numv(U.demo.dx,0),dz:numv(U.demo.dz,0)},width_m:posv(U.demo.w,0)||null,depth_m:posv(U.demo.d,0)||null,height_m:posv(U.demo.h,0)||null}:null,
  checks:(typeof collectChecks==="function"?collectChecks():[]).map(c=>({category:c.cat,item:c.label,value:c.val,level:c.lv,note:c.note})),
  ojt:Object.entries(OJT_CHECKS).flatMap(([tab,arr])=>arr.map(i=>({key:i.k,source:"OJT "+i.src,tab,item:i.t,done:!!(U.ojt&&U.ojt[i.k])}))),
  layers:U.layers||null,
  fence:U.tw.fence?{shape:U.tw.fenceShape==="poly"?"polygon":"rect", height_m:numv(U.tw.fenceH,3), gate:U.tw.fenceGate||"front",
    offset_m:{dx:numv(U.tw.fenceDx,0),dz:numv(U.tw.fenceDz,0)}, rotation_deg:numv(U.tw.fenceRy,0),
    points_m:U.tw.fenceShape==="poly"?(U.tw.fencePts||[]).map(p=>({x:numv(p.x,0),z:numv(p.z,0)})):null,
    size_m:U.tw.fenceShape==="poly"?null:{w:numv(U.tw.fenceW,0)||posv(U.site.w,25),d:numv(U.tw.fenceD,0)||posv(U.site.d,20)}}:null,
  subsurface:(U.subsurface||[]).map(s=>({kind:s.kind, x_m:numv(s.x,0), z_m:numv(s.z,0),
    width_m:posv(s.w,3), length_m:posv(s.d,14), rotation_deg:numv(s.ry,0)}))
 };
}
// ───── IFC 出力（IFC2X3・GLOOBE等のBIMソフトへ）─────
//  構成：IfcProject > IfcSite（敷地多角形・標高・緯度経度・住所）> IfcBuilding（諸元Pset）> IfcBuildingStorey×階（階高）
//        各階：IfcSlab（床）＋ IfcBuildingElementProxy（階のボリューム）。敷地直下：近隣建物・仮囲い・クレーン・施工オブジェクト（Proxy）
//  座標：IFC X=東=world X、IFC Y=北=−world Z、IFC Z=上。単位 m。
function ifcExport(){
 const E=[]; let n=0;
 const add=(s)=>{n++;E.push("#"+n+"="+s+";");return "#"+n;};
 const S=(t)=>{ // IFC文字列：' を '' に、非ASCIIは \X2\..\X0\（UTF-16BE）
  t=String(t==null?"":t); let out="",buf="";const flush=()=>{if(buf){out+="\\X2\\"+buf+"\\X0\\";buf="";}};
  for(const ch of t){const c=ch.codePointAt(0);if(c<128){flush();out+=(ch==="'"?"''":ch);}else{buf+=c.toString(16).toUpperCase().padStart(4,"0");}}
  flush();return "'"+out+"'";};
 const R=(v)=>{const x=+(+v).toFixed(4);let s=String(x);if(!s.includes(".")&&!s.includes("E"))s+=".";return s;};
 const A="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
 const guid=()=>{let g=A[Math.floor(Math.random()*4)];for(let i=1;i<22;i++)g+=A[Math.floor(Math.random()*64)];return "'"+g+"'";};
 const P2=(x,y)=>add(`IFCCARTESIANPOINT((${R(x)},${R(y)}))`);
 const P3=(x,y,z)=>add(`IFCCARTESIANPOINT((${R(x)},${R(y)},${R(z)}))`);
 const toIFC=(wx,wz)=>({x:wx,y:-wz});
 // 基本
 const person=add("IFCPERSON($,$,$,$,$,$,$,$)"), org=add(`IFCORGANIZATION($,${S("BimGen")},$,$,$)`);
 const po=add(`IFCPERSONANDORGANIZATION(${person},${org},$)`), app=add(`IFCAPPLICATION(${org},${S(APP_VER)},${S("BimGen")},${S("BimGen")})`);
 const ts=Math.floor(Date.now()/1000);
 const OH=add(`IFCOWNERHISTORY(${po},${app},$,.ADDED.,$,$,$,${ts})`);
 const dX=add("IFCDIRECTION((1.,0.,0.))"), dZ=add("IFCDIRECTION((0.,0.,1.))"), o3=P3(0,0,0);
 const wcs=add(`IFCAXIS2PLACEMENT3D(${o3},${dZ},${dX})`);
 const ctx=add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${wcs},$)`);
 const uL=add("IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)"),uA=add("IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)"),uV=add("IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)"),uAng=add("IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)");
 const units=add(`IFCUNITASSIGNMENT((${uL},${uA},${uV},${uAng}))`);
 const meta=buildBIMMeta();
 const proj=add(`IFCPROJECT(${guid()},${OH},${S(U.p.name||"BimGen Project")},${S("BimGenから出力した初期検討モデル（概算）")},$,$,$,(${ctx}),${units})`);
 // 配置ユーティリティ
 const place=(parent,x,y,z)=>{const p=P3(x,y,z);const ax=add(`IFCAXIS2PLACEMENT3D(${p},${dZ},${dX})`);return add(`IFCLOCALPLACEMENT(${parent||"$"},${ax})`);};
 const extrude=(pts2,z0,h)=>{ // pts2: [{x,y}] IFC座標（閉じない）。z0 から h 押し出し
  const ids=pts2.map(p=>P2(p.x,p.y)); const poly=add(`IFCPOLYLINE((${ids.join(",")},${ids[0]}))`);
  const prof=add(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${poly})`);
  const ax=add(`IFCAXIS2PLACEMENT3D(${P3(0,0,z0)},${dZ},${dX})`);
  const solid=add(`IFCEXTRUDEDAREASOLID(${prof},${ax},${dZ},${R(h)})`);
  const shape=add(`IFCSHAPEREPRESENTATION(${ctx},'Body','SweptSolid',(${solid}))`);
  return add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${shape}))`);};
 const rectPts=(cx,cz,w,d,ryDeg)=>{const t=numv(ryDeg,0)*Math.PI/180,c=Math.cos(t),s=Math.sin(t);
  return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([lx,lz])=>toIFC(cx+lx*c+lz*s,cz-lx*s+lz*c));};
 const pset=(obj,name,props)=>{const ps=props.filter(p=>p[1]!=null&&p[1]!=="").map(p=>add(`IFCPROPERTYSINGLEVALUE(${S(p[0])},$,${typeof p[1]==="number"?`IFCREAL(${R(p[1])})`:`IFCTEXT(${S(p[1])})`},$)`));
  if(!ps.length)return; const set=add(`IFCPROPERTYSET(${guid()},${OH},${S(name)},$,(${ps.join(",")}))`); add(`IFCRELDEFINESBYPROPERTIES(${guid()},${OH},$,$,(${obj}),${set})`);};
 // 敷地
 const sdx=numv(U.site.dx,0), sdz=numv(U.site.dz,0), gl=numv(U.site.gl,0);
 const sitePts=Array.isArray(U.site.poly)&&U.site.poly.length>=3?U.site.poly.map(p=>toIFC(sdx+p.x,sdz+p.z)):rectPts(sdx,sdz,posv(U.site.w,25),posv(U.site.d,20),0);
 const dms=(deg)=>{const sg=deg<0?-1:1;const a=Math.abs(deg);const d=Math.floor(a),m=Math.floor((a-d)*60),s=Math.floor(((a-d)*60-m)*60),us=Math.round((((a-d)*60-m)*60-s)*1e6);return `(${sg*d},${sg*m},${sg*s},${sg*us})`;};
 const lat=U.geo&&U.geo.lat!=null?dms(U.geo.lat):"$", lon=U.geo&&U.geo.lon!=null?dms(U.geo.lon):"$";
 const addr=add(`IFCPOSTALADDRESS($,$,$,$,(${S(U.p.addr||"")}),$,$,$,$,${S("JP")})`);
 const sitePl=place(null,0,0,0);
 const siteShape=extrude(sitePts,gl-0.3,0.3);
 const site=add(`IFCSITE(${guid()},${OH},${S("敷地")},${S(U.p.addr||"")},$,${sitePl},${siteShape},$,.ELEMENT.,${lat},${lon},${U.geo&&U.geo.elev!=null?R(U.geo.elev):"$"},$,${addr})`);
 add(`IFCRELAGGREGATES(${guid()},${OH},$,$,${proj},(${site}))`);
 pset(site,"BimGen_Site",[["敷地面積_m2",meta.site.area_m2],["間口_m",meta.site.width_m],["奥行_m",meta.site.depth_m],["設計GL_m",gl],["高低差_m",meta.site.slope.heightDiff_m],["勾配前後_pct",meta.site.slope.gradeFrontBack_pct],["勾配左右_pct",meta.site.slope.gradeLeftRight_pct],["前面道路幅員_m",meta.road.width_m],["標高_m",meta.geo.elevation_m],["住所",U.p.addr||""]]);
 // 建物
 const bldPl=place(sitePl,0,0,0);
 const bld=add(`IFCBUILDING(${guid()},${OH},${S(U.p.name||"建物")},${S(U.p.use||"")},$,${bldPl},$,$,.ELEMENT.,${R(gl)},$,${addr})`);
 add(`IFCRELAGGREGATES(${guid()},${OH},$,$,${site},(${bld}))`);
 const b=meta.building;
 pset(bld,"BimGen_Building",[["用途",U.p.use],["構造",U.p.struct],["階数",b.floorsAbove],["最高高さ_m",b.totalHeight_m],["階高_m",b.typicalFloorHeight_m],["延床面積_m2",b.totalFloorArea_m2],["建築面積_m2",b.buildingArea_m2],["施工床面積_m2",b.constructionFloorArea_m2],["専有面積_m2",b.privateArea_m2],["戸数",b.units],["建蔽率_pct",meta.legal.buildingCoverage_pct],["容積率_pct",meta.legal.floorAreaRatio_pct],["備考",U.p.note||""]]);
 // 階
 const nF=b.floorsAbove, fh=b.typicalFloorHeight_m; const storeys=[];
 for(let f=1;f<=nF;f++){const el=gl+(f-1)*fh;const pl=place(bldPl,0,0,el);const st=add(`IFCBUILDINGSTOREY(${guid()},${OH},${S(f+"F")},$,$,${pl},$,$,.ELEMENT.,${R(el)})`);storeys.push({f,st,pl,el});}
 add(`IFCRELAGGREGATES(${guid()},${OH},$,$,${bld},(${storeys.map(s=>s.st).join(",")}))`);
 // 各階：床スラブ＋ボリューム
 const blockPts=(bk)=>{const ox=sdx+numv(bk.dx,0),oz=sdz+numv(bk.dz,0);
  if(bk.shape==="poly"&&Array.isArray(bk.poly)&&bk.poly.length>=3)return rotPts(bk.poly,bk.ry).map(p=>toIFC(ox+p.x,oz+p.z));
  return rectPts(ox,oz,posv(bk.w,10),posv(bk.d,10),bk.ry);};
 storeys.forEach(s=>{const els=[];
  (U.blocks||[]).forEach((bk,bi)=>{const f1=Math.max(1,Math.round(posv(bk.f1,1))),f2=Math.max(f1,Math.round(posv(bk.f2,1)));if(s.f<f1||s.f>f2)return;
   const pts=blockPts(bk);
   const slab=add(`IFCSLAB(${guid()},${OH},${S((bk.label||"建物")+" "+s.f+"F 床")},$,$,${place(s.pl,0,0,0)},${extrude(pts,0,0.2)},$,.FLOOR.)`);
   const vol=add(`IFCBUILDINGELEMENTPROXY(${guid()},${OH},${S((bk.label||"建物")+" "+s.f+"F ボリューム")},${S("概算ボリューム（壁・柱の詳細なし）")},$,${place(s.pl,0,0,0)},${extrude(pts,0.2,fh-0.2)},$,$)`);
   pset(vol,"BimGen_Block",[["ブロック",bk.label||""],["階",s.f],["形状",bk.shape==="poly"?"多角形":"矩形"],["回転_deg",numv(bk.ry,0)]]);
   els.push(slab,vol);
   if(s.f===f2){const roof=add(`IFCSLAB(${guid()},${OH},${S((bk.label||"建物")+" 屋上スラブ")},$,$,${place(s.pl,0,0,fh)},${extrude(pts,0,0.2)},$,.ROOF.)`);els.push(roof);}
  });
  if(els.length)add(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${guid()},${OH},$,$,(${els.join(",")}),${s.st})`);
 });
 // 敷地直下：近隣・仮囲い・クレーン・施工オブジェクト（Proxy）
 const siteEls=[];
 (U.nbs||[]).forEach((nb,i)=>{const pr=add(`IFCBUILDINGELEMENTPROXY(${guid()},${OH},${S("近隣建物 "+(i+1))},${S("周辺建物（参考）")},$,${place(sitePl,0,0,0)},${extrude(rectPts(numv(nb.x,0),numv(nb.z,0),posv(nb.w,10),posv(nb.d,10),nb.ry),0,posv(nb.h,12))},$,$)`);siteEls.push(pr);});
 if(U.tw.fence){const fh2=numv(U.tw.fenceH,3);const fx=sdx+numv(U.tw.fenceDx,0),fz=sdz+numv(U.tw.fenceDz,0);
  if(U.tw.fenceShape==="poly"&&(U.tw.fencePts||[]).length>=3){const pts=rotPts(U.tw.fencePts,U.tw.fenceRy);const n2=pts.length;
   for(let i=0;i<n2;i++){const a2=pts[i],b2=pts[(i+1)%n2];const len=Math.hypot(b2.x-a2.x,b2.z-a2.z);if(len<0.05)continue;const ang=Math.atan2(-(b2.z-a2.z),b2.x-a2.x)*180/Math.PI;
    const pr=add(`IFCBUILDINGELEMENTPROXY(${guid()},${OH},${S("仮囲い 辺"+(i+1))},${S("仮設・仮囲いパネル")},$,${place(sitePl,0,0,0)},${extrude(rectPts(fx+(a2.x+b2.x)/2,fz+(a2.z+b2.z)/2,len,0.1,ang),0,fh2)},$,$)`);siteEls.push(pr);}}
  else{const fw=numv(U.tw.fenceW,0)||posv(U.site.w,25)+2,fd=numv(U.tw.fenceD,0)||posv(U.site.d,20)+2;
   const pr=add(`IFCBUILDINGELEMENTPROXY(${guid()},${OH},${S("仮囲い（矩形）")},${S("仮設・仮囲い外形")},$,${place(sitePl,0,0,0)},${extrude(rectPts(fx,fz,fw,fd,U.tw.fenceRy),0,fh2)},$,$)`);siteEls.push(pr);}}
 if(U.tw.crane){const cs=CRANE_SPECS[U.tw.craneModel]||{};const pr=add(`IFCBUILDINGELEMENTPROXY(${guid()},${OH},${S("タワークレーン "+(U.tw.craneModel||""))},${S((cs.label||"")+" 作業半径"+(cs.work||"-")+"m 定格"+(cs.cap||"-")+"t")},$,${place(sitePl,0,0,0)},${extrude(rectPts(numv(U.tw.craneX,0),numv(U.tw.craneZ,0),2.5,2.5,0),0,posv(U.p.height,30)+8)},$,$)`);
  pset(pr,"BimGen_Crane",[["機種",U.tw.craneModel],["作業半径_m",cs.work],["定格荷重_t",cs.cap],["尾部旋回_m",cs.tail],["ジブ長_m",cs.jib]]);siteEls.push(pr);}
 (U.cobj||[]).forEach((c,i)=>{const t=COBJ_TYPES[c.type]||{};const sz=cobjSize(c.type,c.size)||{};const w=posv(c.w,sz.w||2),d=posv(c.d,sz.d||5),h=posv(c.h,sz.h||2);
  const pr=add(`IFCBUILDINGELEMENTPROXY(${guid()},${OH},${S((t.label||c.type)+" "+(sz.label||""))},${S("施工オブジェクト（仮設・重機・車両）")},$,${place(sitePl,0,0,0)},${extrude(rectPts(numv(c.x,0),numv(c.z,0),w,d,c.ry),0,h)},$,$)`);
  pset(pr,"BimGen_ConstructionObject",[["種別",t.label||c.type],["サイズ",sz.label||c.size],["幅_m",w],["長さ_m",d],["高さ_m",h],["向き_deg",numv(c.ry,0)]]);siteEls.push(pr);});
 (U.roads||[]).forEach((r,i)=>{const pts=rotPts(r.pts||[],r.ry);const ox=sdx+numv(r.dx,0),oz=sdz+numv(r.dz,0);const W=numv(r.w,6);
  for(let k=0;k<pts.length-1;k++){const a2=pts[k],b2=pts[k+1];const len=Math.hypot(b2.x-a2.x,b2.z-a2.z);if(len<0.05)continue;const ang=Math.atan2(-(b2.z-a2.z),b2.x-a2.x)*180/Math.PI;
   const pr=add(`IFCBUILDINGELEMENTPROXY(${guid()},${OH},${S("道路"+(i+1)+" 区間"+(k+1))},${S("なぞった道路（幅員"+W+"m）")},$,${place(sitePl,0,0,0)},${extrude(rectPts(ox+(a2.x+b2.x)/2,oz+(a2.z+b2.z)/2,len,W,ang),-0.1,0.1)},$,$)`);siteEls.push(pr);}});
 if(siteEls.length)add(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${guid()},${OH},$,$,(${siteEls.join(",")}),${site})`);
 // 判定・メモをプロジェクトのPsetに
 pset(proj,"BimGen_Checks",meta.checks.map(c=>[c.item+"（"+c.category+"）",c.value+" / "+({ok:"OK",warn:"注意",ng:"要検討",na:"-"})[c.level]+" / "+c.note]));
 const d=new Date();
 const head=`ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0]','BimGen initial study model'),'2;1');
FILE_NAME(${S((U.p.name||"BimGen")+".ifc")},'${d.toISOString().slice(0,19)}',(${S("BimGen")}),(${S("")}),${S("BimGen "+APP_VER)},${S("BimGen")},'');
FILE_SCHEMA(('IFC2X3'));
ENDSEC;
DATA;
`;
 return head+E.join("\n")+"\nENDSEC;\nEND-ISO-10303-21;\n";
}
window.exportIFC=()=>{
 try{const txt=ifcExport();_dl(`${(U.p.name||"BimGen").replace(/[\\/:*?"<>|]/g,"_")}.ifc`,txt,"application/x-step");
  toast("IFC（IFC2X3）を出力しました。GLOOBE等で「IFC読込」してください。階・床・ボリューム・敷地・仮設が入っています","ok");}
 catch(e){toast("IFC出力に失敗："+(e&&e.message||"不明"),"err");}
};
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
 a.download=`${U.p.name||"BimGen"}_${({build:"仮設計画",demo:"既存解体",retain:"山留め掘削",pile:"杭工事",steel:"鉄骨建て方"})[U.tw.mode]||(U.line?"線画下絵":"パース")}.png`;
 a.click();
}
// ───── 検討シート出力（A4横1枚のHTML：印刷→PDF可。打合せ・報告・OJT記録用）─────
function _shot(viewKey){
 // 指定視点で1枚撮影して dataURL を返す（UIは呼び出し側で隠す）
 const save={theta:ctrl.theta,phi:ctrl.phi,r:ctrl.r,cx:ctrl.cx,cz:ctrl.cz,ty:ctrl.ty,auto:U.auto};
 view(viewKey,{instant:true});
 camera.position.set(ctrl.cx+ctrl.r*Math.sin(ctrl.phi)*Math.cos(ctrl.theta),ctrl.ty+ctrl.r*Math.cos(ctrl.phi),ctrl.cz+ctrl.r*Math.sin(ctrl.phi)*Math.sin(ctrl.theta));
 camera.lookAt(ctrl.cx,ctrl.ty,ctrl.cz); renderer.render(scene,camera);
 const url=renderer.domElement.toDataURL("image/jpeg",0.86);
 Object.assign(ctrl,{theta:save.theta,phi:save.phi,r:save.r,cx:save.cx,cz:save.cz,ty:save.ty}); U.auto=save.auto;
 return url;
}
const _esc=(s)=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
function exportSheet(){
 // ポップアップ制限対策：クリック直後に空タブを確保（後で内容を書き込む）
 let pop=null; try{pop=window.open("","_blank");}catch(e){pop=null;}
 if(pop){try{pop.document.write("<title>検討シートを作成中…</title><p style='font-family:sans-serif;padding:24px;color:#555'>検討シートを作成しています…</p>");}catch(e){}}
 toast("検討シートを作成中…");
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
 const visibleCobj=(U.cobj||[]).filter(c=>cobjVisibleInPhase(c,U.tw.mode));
 const cobjRows=visibleCobj.map(c=>{const t=COBJ_TYPES[c.type];const sz=cobjSize(c.type,c.size)||{};return `<tr><td>${_esc(t?t.label:c.type)}</td><td>${_esc(sz.label||c.size||"")}</td><td class="n">${numv(c.x,0).toFixed(1)}, ${numv(c.z,0).toFixed(1)}</td><td>${c._warn?'<span class="ng">歩行帯と干渉</span>':"—"}</td></tr>`;}).join("");
 const annotRows=(U.annot||[]).map(a=>`<tr><td>${a.type==="zone"?"範囲":"文字"}</td><td>${_esc((ANNOT_COLORS.find(c=>c.key===a.color)||{}).label||a.color)}</td><td>${_esc(a.type==="text"?a.text:`${posv(a.w,6)}m × ${posv(a.d,6)}m`)}</td><td class="n">${numv(a.x,0).toFixed(1)}, ${numv(a.z,0).toFixed(1)}</td></tr>`).join("");
 const subRows=(U.subsurface||[]).map(s=>`<tr><td>${_esc((SUBSURFACE_TYPES[s.kind]||{}).label||s.kind)}</td><td class="n">${posv(s.w,3)}m × ${posv(s.d,14)}m</td><td class="n">${numv(s.x,0).toFixed(1)}, ${numv(s.z,0).toFixed(1)}</td></tr>`).join("");
 const html=`<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>検討シート ${_esc(U.p.name)}</title>
<style>
@page{size:A4 landscape;margin:12mm}
body{font-family:-apple-system,"Hiragino Sans","Yu Gothic UI",Meiryo,sans-serif;color:#172236;margin:0;padding:14px;font-size:10.5px;background:#F3F6FA}
h1{font-size:19px;margin:2px 0 0;color:#fff;letter-spacing:.01em}
.hd{display:flex;justify-content:space-between;align-items:flex-end;background:linear-gradient(135deg,#111B2C,#1E304B);color:#fff;border-radius:9px;padding:10px 12px;margin-bottom:9px;border-left:4px solid #F2A33C}
.meta{font-size:9.5px;color:#B9C6D8;text-align:right;line-height:1.5}
.grid{display:grid;grid-template-columns:1.15fr 1fr;gap:12px}
.imgs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.imgs>div{background:#fff;border:1px solid #DCE3EC;border-radius:8px;padding:4px;box-shadow:0 3px 10px rgba(24,39,63,.05)}
.imgs img{width:100%;max-height:248px;object-fit:cover;border-radius:5px;display:block}
.imgs small{display:block;font-size:8.5px;color:#66758A;margin:3px 2px 0;font-weight:600}
h2{font-size:11px;margin:9px 0 4px;color:#16243D;border-left:3px solid #F2A33C;padding-left:6px;letter-spacing:.01em}
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
<div class="hd"><div><div style="font-size:8px;color:#7FA4DD;letter-spacing:.16em;font-weight:700">BimGen / PROJECT REVIEW SHEET</div><h1>${_esc(U.p.name||"（案件名未入力）")}</h1></div>
<div class="meta">作成日 ${ymd}　／　作成者 ＿＿＿＿＿＿<br>${_esc(U.p.addr||"")}</div></div>
<div class="imgs"><div><img src="${imgBird}"><small>鳥瞰（仮設計画イメージ）</small></div><div><img src="${imgTop}"><small>配置（真上）</small></div></div>
<div class="grid"><div>
<h2>検討判定</h2>
<div class="sum"><div class="a"><b>${checks.filter(c=>c.lv==="ok").length}</b>OK</div><div class="b"><b>${checks.filter(c=>c.lv==="warn").length}</b>注意</div><div class="c"><b>${checks.filter(c=>c.lv==="ng").length}</b>要検討</div></div>
<table><tr><th>区分</th><th>項目</th><th>値</th><th>判定</th><th>所見</th></tr>
${checks.map(c=>`<tr><td>${_esc(c.cat)}</td><td>${_esc(c.label)}</td><td class="n">${_esc(c.val)}</td><td class="${c.lv}">${lvLabel[c.lv]}</td><td>${_esc(c.note)}</td></tr>`).join("")}</table>
${(U.roads||[]).length?`<h2>なぞった道路（地図・図面から）</h2><table><tr><th>道路</th><th>幅員</th><th>歩道 左/右</th><th>延長</th><th>車両</th><th>残り幅</th><th>判定</th></tr>${(U.roads||[]).map((r,i)=>{let len=0;for(let k=0;k<(r.pts||[]).length-1;k++)len+=Math.hypot(r.pts[k+1].x-r.pts[k].x,r.pts[k+1].z-r.pts[k].z);const c=(U._roadClear||[]).find(x=>x.ri===i)||{n:0,remain:numv(r.w,6),lv:"na"};
  return `<tr><td>道路 ${i+1}</td><td class="n">${numv(r.w,6)} m</td><td class="n">${numv(r.walkL,0)} / ${numv(r.walkR,0)} m</td><td class="n">${len.toFixed(0)} m</td><td class="n">${c.n} 台</td><td class="n">${c.n?c.remain+" m":"—"}</td><td class="${c.lv}">${c.n?lvLabel[c.lv]:"—"}</td></tr>`;}).join("")}</table>`:""}
${rc?`<h2>道路使用検討（生コン車＋ポンプ車）</h2><table class="kv">
<tr><td>車種</td><td>ミキサー ${_esc(rc.mix.label||U.roadwork.mixerSize)} ／ ポンプ ${_esc(rc.pmp.label||U.roadwork.pumpSize)}</td></tr>
<tr><td>縦列必要長 / 敷地間口</td><td class="n">${rc.lineLen} m / ${rc.front} m → <span class="${rc.fitFront?"ok":"ng"}">${rc.fitFront?"収まる":"収まらない"}</span></td></tr>
<tr><td>道路幅員 / 歩道乗り上げ</td><td class="n">${rc.roadW} m / ${rc.mount} m</td></tr>
<tr><td>残車道幅</td><td class="n">${rc.remain} m → <span class="${rc.emgOK?"ok":(rc.passOK?"warn":"ng")}">${rc.emgOK?"緊急車両4m確保":(rc.passOK?"すれ違い可・緊急車両4m未満":"3m未満・片側交互通行")}</span></td></tr>
${(U.roadwork.permitPolice||U.roadwork.permitRoad||U.roadwork.permitOffice)?`<tr><td>許可条件メモ</td><td>${_esc([U.roadwork.permitPolice&&"警察："+U.roadwork.permitPolice,U.roadwork.permitRoad&&"道路管理者："+U.roadwork.permitRoad,U.roadwork.permitOffice&&"建設事務所："+U.roadwork.permitOffice].filter(Boolean).join(" ／ "))}</td></tr>`:""}
</table>`:""}
<h2>この工程で表示中の施工オブジェクト（${visibleCobj.length}）</h2>
${cobjRows?`<table><tr><th>種別</th><th>サイズ</th><th>位置 X,Z (m)</th><th>備考</th></tr>${cobjRows}</table>`:`<div style="color:#6A7385">なし</div>`}
</div><div>
<h2>諸元</h2><table class="kv">
<tr><td>用途・構造</td><td>${_esc(U.p.use)}・${_esc(U.p.struct)}造</td></tr>
<tr><td>規模</td><td>地上${Math.round(posv(U.p.floors,0))}階　最高高さ ${posv(U.p.height,0)} m${posv(U.p.units,0)?`　${Math.round(posv(U.p.units,0))}戸`:""}</td></tr>
<tr><td>敷地面積</td><td class="n">${site.toFixed(1)} m²${posv(U.p.siteArea,0)?"":"（形状から算出）"}</td></tr>
<tr><td>建築面積 / 建蔽率</td><td class="n">${bcArea.toFixed(1)} m² / <span class="${posv(U.p.bcrLimit,0)?(bcr>posv(U.p.bcrLimit,0)?"ng":"ok"):(bcr>80?"ng":bcr>60?"warn":"ok")}">${bcr.toFixed(0)}%</span>${posv(U.p.bcrLimit,0)?`（限度 ${posv(U.p.bcrLimit,0)}%${U.p.bcrNote?"・"+_esc(U.p.bcrNote):""}）`:""}</td></tr>
<tr><td>延床面積 / 容積率</td><td class="n">${tFloor.toFixed(1)} m² / <span class="${posv(U.p.farLimit,0)?(far>posv(U.p.farLimit,0)?"ng":"ok"):(far>500?"ng":far>300?"warn":"ok")}">${far.toFixed(0)}%</span>${posv(U.p.farLimit,0)?`（限度 ${posv(U.p.farLimit,0)}%）`:""}${posv(U.p.tArea,0)?"":"（形状概算）"}</td></tr>
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
 if(pop){
  try{pop.document.open();pop.document.write(html);pop.document.close();toast("検討シートを別タブで開き、ファイルも保存しました","ok");}
  catch(e){try{pop.location=url;}catch(e2){}toast("検討シートを保存しました","ok");}
 }else{
  toast("検討シートを保存しました。別タブが開かない場合はブラウザのポップアップを許可してください（ダウンロードしたHTMLを開いても同じ内容です）","ok");
 }
}
window.exportSheet=exportSheet;
// ───── スタート画面・テンプレート（新規案件を1クリックで起こす）─────
// 各テンプレートは東京の典型的な敷地条件を想定した現実的な初期値
const TEMPLATES=[
 {key:"office5", icon:"🏢", name:"事務所ビル 5階", sub:"間口20m×奥行18m／前面道路8m",
  p:{use:"事務所",struct:"S",floors:5,height:20,tArea:950}, site:{w:20,d:18}, blocks:[{id:1,label:"建物",f1:1,f2:5,w:16,d:12,dx:0,dz:0,ry:0}], road:{w:8},
  tw:{mode:"build",step:3,crane:true,craneModel:"JCL015",craneX:11,craneZ:-3,fence:true,fenceH:3,fenceGate:"front",scaffold:true},
  cobj:[{type:"mixer",size:"8t",x:-6,z:14,ry:90},{type:"pump",size:"m4t",x:4,z:14,ry:90},{type:"lsev",size:"h20",x:-8,z:7,ry:0}]},
 {key:"hotel9", icon:"🏨", name:"ホテル 9階", sub:"間口22m×奥行20m／前面道路10m",
  p:{use:"ホテル",struct:"RC",floors:9,height:30,tArea:2600,units:80}, site:{w:22,d:20}, blocks:[{id:1,label:"客室棟",f1:1,f2:9,w:18,d:14,dx:0,dz:-1,ry:0}], road:{w:10},
  tw:{mode:"build",step:5,crane:true,craneModel:"JCL022",craneX:0,craneZ:-1,fence:true,fenceH:3,fenceGate:"front",scaffold:true},
  cobj:[{type:"mixer",size:"8t",x:-7,z:15.5,ry:90},{type:"pump",size:"m4t",x:3,z:15.5,ry:90},{type:"lsev",size:"h32",x:-10,z:8,ry:0},{type:"guard",size:"std",x:8,z:11,ry:0}]},
 {key:"apt8", icon:"🏘", name:"共同住宅 8階", sub:"間口14m×奥行22m／前面道路6m（狭小地）",
  p:{use:"共同住宅（賃貸）",struct:"RC",floors:8,height:24,tArea:1200,units:24}, site:{w:14,d:22}, blocks:[{id:1,label:"建物",f1:1,f2:8,w:10,d:15,dx:0,dz:0,ry:0}], road:{w:6},
  tw:{mode:"build",step:4,crane:true,craneModel:"JCL022",craneX:9,craneZ:-4,fence:true,fenceH:3,fenceGate:"front",scaffold:true},
  cobj:[{type:"mixer",size:"8t",x:-5,z:16,ry:90},{type:"pump",size:"m4t",x:4,z:16,ry:90},{type:"lsev",size:"h32",x:-6,z:12.5,ry:0}]},
 {key:"shop3", icon:"🏬", name:"店舗 3階", sub:"間口18m×奥行15m／前面道路12m",
  p:{use:"店舗",struct:"S",floors:3,height:13,tArea:480}, site:{w:18,d:15}, blocks:[{id:1,label:"建物",f1:1,f2:3,w:15,d:11,dx:0,dz:0,ry:0}], road:{w:12}},
 {key:"wh2", icon:"🏭", name:"倉庫・物流 2階", sub:"間口40m×奥行30m／前面道路10m",
  p:{use:"倉庫・物流",struct:"S",floors:2,height:12,tArea:1600}, site:{w:40,d:30}, blocks:[{id:1,label:"建物",f1:1,f2:2,w:34,d:24,dx:0,dz:0,ry:0}], road:{w:10},
  tw:{mode:"steel",step:2,crane:false,craneModel:"JCL030",craneX:24,fence:true,fenceH:3,fenceGate:"front",scaffold:false},
  cobj:[{type:"rough",size:"50t",x:0,z:-6,ry:0},{type:"truck",size:"10t",x:-12,z:20,ry:90},{type:"stage",size:"m",x:14,z:8,ry:0}]},
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
// BIM連携用フルサンプル：出力(bim.json/OBJ/検討シート)の全項目に値が入る案件
const BIM_SAMPLE={
 p:{name:"（BIM連携サンプル）八王子 明神町 共同住宅計画",use:"共同住宅（賃貸）",struct:"RC",floors:8,height:24.5,addr:"東京都八王子市明神町3丁目",
    siteArea:512.4,bldgArea:288.0,tArea:1980.0,consArea:2150.0,privArea:1560.0,units:36,note:"BIM連携検証用のフルサンプル。全項目に値を入れてある。数値は架空。"},
 site:{w:24,d:22,dx:0,dz:0,gl:0.3,h:[0,0,1.4,1.1],slopeDir:"north",slopeDiff:1.4,
    poly:[{x:-12,z:-11},{x:12,z:-11},{x:12,z:6},{x:7,z:11},{x:-12,z:11}]},
 blocks:[{id:1,label:"住棟",f1:1,f2:8,w:14,d:11,dx:-3,dz:-2.5,ry:0},
         {id:2,label:"低層（エントランス・駐輪）",f1:1,f2:1,shape:"poly",poly:[{x:0,z:0},{x:5,z:0},{x:5,z:4},{x:2,z:4},{x:2,z:6},{x:0,z:6}],dx:5,dz:4,ry:0}],
 road:{w:6,side:"none",dx:0,dz:0,ry:0,show:false,slope:0.4,walkShow:false,walkW:1.6},
 roads:[{pts:[{x:-40,z:15},{x:-5,z:15},{x:25,z:15}],w:6,walkL:1.5,walkR:0,dx:0,dz:0,ry:0},
        {pts:[{x:16,z:15},{x:16,z:-30}],w:4,walkL:0,walkR:0,dx:0,dz:0,ry:0}],
 roadwork:{mixerSize:"8t",pumpSize:"m4t",mountUp:0.5,permitPolice:"道路使用許可（1号）要協議・誘導員2名",permitRoad:"道路占用：仮囲い乗り出し30cm・朝顔",permitOffice:"事前協議 10/上旬"},
 tw:{mode:"build",step:4,crane:true,craneModel:"JCL022",craneX:10,craneZ:1,craneJib:28,craneRot:30,fence:true,fenceH:3,fenceGate:"front",fenceShape:"poly",
     fencePts:[{x:-12.5,z:-11.5},{x:12.5,z:-11.5},{x:12.5,z:6.3},{x:7.3,z:11.5},{x:-12.5,z:11.5}],fenceGateSeg:3,scaffold:true,poles:false,person:false,
     pitDepth:5,retainMargin:1.0,pilePitch:4.5,pileDia:1.0,pileLen:18,oldPiles:true,oldPitch:3.6,oldRot:15,oldExtend:1.5,oldDx:0.8,oldDz:-0.5,steelPitch:7,ev:false},
 cobj:[{type:"mixer",size:"8t",x:-8,z:13.4,ry:90},{type:"pump",size:"m4t",x:1,z:13.4,ry:90},{type:"rough",size:"25t",x:-1,z:9.5,ry:90},
       {type:"stage",size:"s",x:7,z:-6,ry:0},{type:"lsev",size:"h32",x:-6,z:6,ry:90},{type:"guard",size:"std",x:-3,z:11.5,ry:0},
       {type:"walkzone",size:"std",x:-16,z:19.5,ry:90},{type:"temp",size:"plate",x:-1,z:9.5,ry:90},{type:"temp",size:"hut",x:-8,z:-9.5,ry:0}],
 subsurface:[{kind:"gas",x:0,z:17,w:1.2,d:60,ry:90},{kind:"water",x:0,z:19,w:1.5,d:60,ry:90},{kind:"elec",x:-9,z:-2,w:2,d:12,ry:0}],
 annot:[{type:"text",x:11,z:-13.5,ry:0,color:"red",text:"TC旋回範囲 隣地上空注意",fsize:2},
        {type:"zone",x:7,z:-6,w:7,d:11,ry:0,color:"amber"},{type:"text",x:7,z:-13.5,ry:0,color:"amber",text:"乗入れ構台・荷取り",fsize:1.6},
        {type:"zone",x:-6,z:6,w:6,d:4,ry:0,color:"blue"},{type:"text",x:-6,z:-13.5,ry:0,color:"blue",text:"LSEV 搬入動線（西側）",fsize:1.4},
        {type:"text",x:-8,z:17,ry:0,color:"green",text:"生コン打設 敷地側に縦列",fsize:1.6}],
 nbs:[{x:-19,z:-2,w:9,d:16,h:16,ry:0},{x:20,z:-6,w:7,d:12,h:9,ry:0},{x:0,z:-22,w:20,d:10,h:12,ry:0}],
 geo:{lat:35.6615,lon:139.3390,elev:118.2,name:"東京都八王子市明神町3丁目",status:""},
 ojt:{s1:true,s3:true,s4:true,s5:true,t1:true,t2:true,t5:true,c2:true,c4:true},
 layers:{site:true,building:true,nbs:true,fence:true,crane:true,cobj:true,annot:true,sub:true,roads:true,under:true},
 roadcond:{lane:6,walk:1.5,side:"front",showWalk:false},
 under:{show:false},
};
window.openBimSample=()=>{
 resetToDefault();
 deepMerge(U,{p:BIM_SAMPLE.p,site:BIM_SAMPLE.site,road:BIM_SAMPLE.road,roadwork:BIM_SAMPLE.roadwork,tw:BIM_SAMPLE.tw,geo:BIM_SAMPLE.geo,layers:BIM_SAMPLE.layers,roadcond:BIM_SAMPLE.roadcond});
 ["blocks","roads","cobj","subsurface","annot","nbs"].forEach(k=>{U[k]=JSON.parse(JSON.stringify(BIM_SAMPLE[k]));});
 U.site.poly=JSON.parse(JSON.stringify(BIM_SAMPLE.site.poly)); U.site.h=BIM_SAMPLE.site.h.slice(); U.tw.fencePts=JSON.parse(JSON.stringify(BIM_SAMPLE.tw.fencePts));
 U.ojt=Object.assign({},BIM_SAMPLE.ojt); U.tw.person=false; U.tw.poles=false; U.road.walkShow=false;
 U.tab="検討"; U.tabGroup="4";
 closeStart(); rebuild();renderPanel();renderBar();view("bird");
 toast("BIM連携用フルサンプルを開きました。出力▾→BIM出力 で全項目入りの bim.json が出ます","ok");
};
// 実案件ベースデモ：2026-09-24 ユーザー確定版 #5 を正とする。
// 公開リポジトリには番地・緯度経度などの個別識別情報を持ち込まず、計画条件・形状・施工配置だけを反映。
const REAL_DEMO_REV="20260924-5";
const REAL_DEMO={
 p:{name:"実案件ベースデモ（都内・共同住宅12階）",use:"共同住宅（分譲）",struct:"RC",floors:12,height:37,addr:"",
    siteArea:"200.83",bldgArea:"142.12",tArea:"1485.3",consArea:"1668",privArea:"1170",units:"21",
    note:"実案件の計画条件を匿名化したデモ。塔状比4超の狭小地・前面道路下に地下鉄あり。",
    aiIncludeAddr:false,bcrLimit:100,farLimit:600,bcrNote:"商業地域・防火地域内耐火建築物"},
 site:{w:15.6,d:14,dx:0,dz:0,gl:0,h:[0,0,0,0],slopeDir:"flat",slopeDiff:0,
    poly:[{x:-8.1,z:8.4},{x:1.5,z:8.4},{x:7.5,z:8.4},{x:7.8,z:-4.4},{x:2.6,z:-5},{x:2.4,z:-5},{x:-5.4,z:-5.4},{x:-8.2,z:-5.6}]},
 blocks:[{id:1,label:"住棟",f1:1,f2:12,w:13.2,d:10.2,dx:-0.8,dz:1.5,ry:0}],
 road:{w:16.3,side:"none",dx:0,dz:0,ry:0,show:false,slope:0,walkDz:0,walkW:1.6,walkShow:false,sideDx:0,sideDz:0,splitWalk:false},
 roadwork:{mixerSize:"8t",pumpSize:"m4t",mountUp:0,permitPolice:"",permitRoad:"",permitOffice:""},
 roads:[{pts:[{x:-41.56,z:15.86},{x:38.7,z:16.26}],w:14,walkL:2,walkR:0,dx:.7,dz:1.6,ry:0}],
 subsurface:[{kind:"subway",x:-2.9,z:17.8,w:12,d:70,ry:90}],
 annot:[
   {type:"text",x:-27.6,z:16,ry:0,color:"red",text:"地下鉄直下：杭長の検討要",fsize:1.6},
   {type:"text",x:-.7,z:-8,ry:0,color:"amber",text:"TC 建物内設置（塔状比4超）",fsize:1.4},
   {type:"text",x:.1,z:21.9,ry:0,color:"green",text:"生コン 敷地側に縦列（道路使用許可）",fsize:1.4}
 ],
 nbs:[{x:15.5,z:2,w:14,d:13,h:36,ry:0},{x:-16.5,z:2,w:14,d:13,h:27,ry:0}],
 tw:{mode:"build",step:10,fenceShape:"poly",fencePts:[{x:-8.1,z:8.4},{x:-1.84,z:8.42},{x:7.5,z:8.4},{x:7.8,z:-4.4},{x:2.6,z:-5},{x:2.4,z:-5},{x:-5.4,z:-5.4},{x:-8.2,z:-5.6}],fenceGateSeg:1,
    pitDepth:4,retainMargin:1,pilePitch:4,pileDia:1,pileLen:39,oldPiles:false,oldPitch:4,oldRot:0,oldExtend:2,oldDx:0,oldDz:0,steelPitch:7,
    crane:true,craneModel:"JCL015_H",craneHeight:0,craneX:-6,craneZ:7,craneJib:15,craneRot:270,radius:true,
    ev:false,evX:3.1,evZ:8.1,evRy:0,fence:true,fenceH:3,fenceGate:"front",fenceAll:false,fenceDx:0,fenceDz:0,fenceRy:0,fenceW:0,fenceD:0,
    scaffold:true,poles:false,person:false,mixer:false,mixX:-12,mixZ:16.8,mixRy:0,rough:false,rufX:14,rufZ:-2,rufRy:0},
 cobj:[
   {type:"mixer",size:"8t",x:-4.8,z:13.6,ry:90,phase:"build"},
   {type:"pump",size:"m4t",x:3.7,z:13.5,ry:270,phase:"build"},
   {type:"guard",size:"std",x:-10,z:10,ry:0,phase:"build"},
   {type:"walkzone",size:"std",x:0,z:10.2,ry:90,phase:"build"},
   {type:"lsev",size:"h32",x:3.2,z:7.3,w:3.2,d:5,h:32,ry:182,phase:"build"},
   {type:"temp",size:"asagao",x:2.5,z:8.7,w:8,d:1.8,h:.2,ry:0,phase:"build",mountH:21},
   {type:"temp",size:"asagao",x:-4,z:8.9,w:8,d:1.8,h:.2,ry:0,phase:"build",mountH:12},
   {type:"temp",size:"asagao",x:2.5,z:8.8,w:8,d:1.8,h:.2,ry:0,phase:"build",mountH:12},
   {type:"temp",size:"asagao",x:-3.7,z:8.7,w:8,d:1.8,h:.2,ry:0,phase:"build",mountH:21},
   {type:"obstacle",size:"tree",x:-2.4,z:11.2,w:3,d:3,h:6,ry:0,phase:"build"},
   {type:"safepath",size:"18m",x:-.1,z:15.7,w:1.2,d:18,h:.8,ry:90,phase:"build"}
 ],
 ojt:{s1:true,s3:true,s5:true,t1:true,t5:true,t6:true},
 layers:{site:true,building:true,nbs:true,fence:true,scaffold:true,crane:true,vehicles:true,tempobj:true,safety:true,obstacles:true,annot:true,sub:true,roads:true,under:true,cobj:true},
 roadcond:{lane:6,walk:2.5,side:"front"}
};
function loadRealDemoState(tutorial){
 resetToDefault();
 deepMerge(U,{p:REAL_DEMO.p,site:REAL_DEMO.site,road:REAL_DEMO.road,roadwork:REAL_DEMO.roadwork,tw:REAL_DEMO.tw,layers:REAL_DEMO.layers,roadcond:REAL_DEMO.roadcond});
 ["blocks","roads","cobj","subsurface","annot","nbs"].forEach(k=>{U[k]=JSON.parse(JSON.stringify(REAL_DEMO[k]));});
 U.site.poly=JSON.parse(JSON.stringify(REAL_DEMO.site.poly));U.site.h=[0,0,0,0];U.tw.fencePts=JSON.parse(JSON.stringify(REAL_DEMO.tw.fencePts));U.ojt=Object.assign({},REAL_DEMO.ojt);
 U.road.walkShow=false;U.tw.person=false;U.tw.poles=false;U.snap=false;
 if(tutorial){
  // 教材として一つずつ作る。完成形の正は REAL_DEMO のまま保持。
  U.blocks=[];U.cobj=[];U.subsurface=[];U.annot=[];U.nbs=[];
  U.tw.crane=false;U.tw.fence=false;U.tw.scaffold=false;U.tw.ev=false;U.tw.rough=false;U.tw.mixer=false;
  U.layers.under=false;U.layers.site=true;U.layers.building=true;U.layers.nbs=false;U.layers.annot=false;U.layers.sub=false;
  U.tab="形状";U.tabGroup="2";
 }else{U.tab="仮設";U.tabGroup="3";}
 closeStart();rebuild();renderPanel();renderBar();view(tutorial?"bird":"bird",{instant:true});
}
async function loadTutorialFinishedProject(skipped){
 const saved=readTutorialFinishState();
 if(saved){
  resetToDefault();
  applyState(JSON.parse(JSON.stringify(saved)));
  U.auto=false;U.sel=null;
  U.tab="施工/CAD";U.tabGroup="3";
  ensureLayers();Object.keys(LAYER_DEFAULTS).forEach(k=>U.layers[k]=true);
  rebuild();renderPanel();renderBar();
  if(U.geo&&U.geo.lat!=null&&U.geo.lon!=null){
   try{await loadGsiMap();}catch(e){}
  }
  view("bird",{intro:true,duration:720});
  saveDraft();
  toast(skipped?"チュートリアルをスキップしました。保存済みの完成案件を開きました。":"チュートリアル完了。保存済みの完成案件を開きました。","ok");
  return true;
 }
 // 公開コードには実在住所・座標を埋め込まず、完成形の匿名デモをフォールバックにする。
 loadRealDemoState(false);
 U.layers.nbs=true;U.layers.annot=true;U.layers.sub=true;U.layers.roads=true;U.layers.fence=true;U.layers.crane=true;U.layers.tempobj=true;U.layers.vehicles=true;U.layers.safety=true;U.layers.obstacles=true;
 rebuild();renderPanel();renderBar();view("bird",{intro:true,duration:720});
 toast("完成案件を表示しました。地図まで同じ状態にするには、完成版案件ファイルを一度読み込むとこの端末に記憶されます。","ok");
 return false;
}
window.loadTutorialFinishedProject=loadTutorialFinishedProject;

window.openRealDemo=()=>{
 const loadDemo=()=>{
  try{
   const d=readDraft();
   if(d&&d.data){const p=JSON.parse(d.data);cacheTutorialFinishState(p);}
  }catch(e){}
  cacheTutorialFinishState(U);
  loadRealDemoState(true);
  setTimeout(()=>startRealTutorial(),1180);
 };
 if(typeof window.v4DemoEnter==="function")window.v4DemoEnter(loadDemo);else loadDemo();
};
function resetToDefault(){
 // U を初期状態に戻す（テクスチャ等は破棄）
 const def=JSON.parse(_U_DEFAULT);
 if(U.under.tex&&U.under.tex.dispose)U.under.tex.dispose();
 if(U.photo.tex&&U.photo.tex.dispose)U.photo.tex.dispose();
 Object.assign(U,def);
 U.sel=null;U._layersOpen=false;U._hudMin=true;U._titleMin=true;
 _hist.length=0;
}
function deepMerge(t,s){for(const k in s){if(s[k]&&typeof s[k]==="object"&&!Array.isArray(s[k])&&t[k]&&typeof t[k]==="object"){deepMerge(t[k],s[k]);}else t[k]=s[k];}return t;}
window.newBlank=()=>{
 resetToDefault();
 U.p.name="新規案件（図面から）"; U.blocks=[]; U.site.active=false;U.site.poly=null; U.road.show=false; U.road.walkShow=false; U.tw.person=false; U.tw.fence=false; U.tw.crane=false; U.tw.scaffold=false; U.tw.ev=false; U.tw.mixer=false; U.tw.poles=false; U.nbs=[];
 U.tab="諸元"; U.tabGroup="1";
 closeStart(); rebuild();renderPanel();renderBar();view("bird");
 toast("新規案件を開始しました。まず案件情報と住所を入力してください。住所から地図をそのまま取得できます。","ok");
};
window.newFromTemplate=(key)=>{
 const tp=TEMPLATES.find(t=>t.key===key); if(!tp)return;
 resetToDefault();
 U.p.name="新規案件（"+tp.name+"）";
 deepMerge(U,{p:tp.p,site:tp.site,road:tp.road||{},tw:tp.tw||{}}); U.road.walkShow=false; U.tw.person=false; U.tw.poles=false;
 U.blocks=JSON.parse(JSON.stringify(tp.blocks)); U.cobj=tp.cobj?JSON.parse(JSON.stringify(tp.cobj)):[];
 U.tab="仮設";U.tabGroup="3";
 closeStart(); rebuild();renderPanel();renderBar();view("bird");
 if(document.body.classList.contains("simple")){toast(tp.name+"：画面を回して、下の「工程」「仮設」を触ってみてください","ok");}
 else toast(tp.name+" のサンプルで開始しました。諸元タブで案件名・住所を入力してください","ok");
};
window.openDemoCase=()=>{
 resetToDefault();
 deepMerge(U,DEMO_CASE); U.road.walkShow=false; U.tw.person=false; U.tw.poles=false;
 U.blocks=JSON.parse(JSON.stringify(DEMO_CASE.blocks));U.cobj=JSON.parse(JSON.stringify(DEMO_CASE.cobj));
 U.annot=JSON.parse(JSON.stringify(DEMO_CASE.annot));U.nbs=JSON.parse(JSON.stringify(DEMO_CASE.nbs));
 U.tab="仮設";U.tabGroup="施工";
 closeStart(); rebuild();renderPanel();renderBar();view("bird");
 toast("デモ案件を開きました（傾斜地・仮囲い・クレーン・注記入り）","ok");
};
function closeStart(){document.body.classList.remove("start-open");setLeftPanelCollapsed(true);const s=document.getElementById("start");if(s){s.classList.add("hide");setTimeout(()=>{s.style.display="none";},260);}}
window.closeStart=closeStart;
// ───── 実案件 GUIDE MODE：ボタンを覚えさせず、1アクションずつ体験 ─────
const REAL_TUTORIAL={active:false,step:0,traceI:0,complete:false,loading:false,allow:null,target:null};
async function tutorialLoadPlan(){
 if(!REAL_TUTORIAL.active||REAL_TUTORIAL.step!==2||REAL_TUTORIAL.loading)return;
 REAL_TUTORIAL.loading=true;tutorialRender();
 try{
  const res=await fetch("./tutorial-plan.pdf");
  if(!res.ok)throw new Error("PDF "+res.status);
  const buf=await res.arrayBuffer();
  if(!REAL_TUTORIAL.active||REAL_TUTORIAL.step!==2)return;
  U.under.raw=buf;U.under.pages=1;U.under.page=1;
  U.under.show=true;U.under.width=52;U.under.opacity=.94;U.under.rot=0;U.under.dx=0;U.under.dz=0;
  U.layers.under=true;U.layers.site=false;
  await renderPdfPage();
  if(!REAL_TUTORIAL.active||REAL_TUTORIAL.step!==2)return;
  view("top",{instant:true});v4Nudge("SAMPLE PDF / LOADED");tutorialSetStep(3);
 }catch(err){toast("サンプルPDFを読み込めませんでした。通信を確認して再試行してください","err");}
 finally{REAL_TUTORIAL.loading=false;if(REAL_TUTORIAL.active&&REAL_TUTORIAL.step===2)tutorialRender();}
}
function tutorialTraceWorld(){
 const b=REAL_DEMO.blocks[0],hw=b.w/2,hd=b.d/2;
 return [{x:b.dx-hw,z:b.dz-hd},{x:b.dx+hw,z:b.dz-hd},{x:b.dx+hw,z:b.dz+hd},{x:b.dx-hw,z:b.dz+hd}];
}
function tutorialScreenPoint(p){
 const v=new THREE.Vector3(p.x,.55,p.z).project(camera),r=renderer.domElement.getBoundingClientRect();
 return {x:r.left+(v.x+1)*.5*r.width,y:r.top+(1-v.y)*.5*r.height};
}
function clearTutorialTrace(){const e=document.getElementById("rt-trace-layer");if(e)e.remove();}
function renderTutorialTrace(){
 clearTutorialTrace();if(!REAL_TUTORIAL.active||![3,5].includes(REAL_TUTORIAL.step))return;
 const pts=(REAL_TUTORIAL.step===5?[{x:REAL_DEMO.tw.craneX,z:REAL_DEMO.tw.craneZ}]:tutorialTraceWorld()).map(tutorialScreenPoint),root=document.createElement("div");root.id="rt-trace-layer";
 const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox",`0 0 ${innerWidth} ${innerHeight}`);
 for(let i=1;i<=Math.min(REAL_TUTORIAL.traceI,pts.length-1);i++){const l=document.createElementNS("http://www.w3.org/2000/svg","line");l.setAttribute("x1",pts[i-1].x);l.setAttribute("y1",pts[i-1].y);l.setAttribute("x2",pts[i].x);l.setAttribute("y2",pts[i].y);l.setAttribute("class","rt-trace-line");svg.appendChild(l);}
 root.appendChild(svg);
 pts.forEach((p,i)=>{const d=document.createElement("button");d.className="rt-trace-dot "+(REAL_TUTORIAL.step===5||i===REAL_TUTORIAL.traceI?"current":i<REAL_TUTORIAL.traceI?"done":"next");d.style.left=p.x+"px";d.style.top=p.y+"px";d.setAttribute("aria-label",REAL_TUTORIAL.step===5?"タワークレーンをここに配置":"建物の頂点 "+(i+1));d.innerHTML=`<i>${REAL_TUTORIAL.step===5?"TC":i+1}</i>`;d.disabled=REAL_TUTORIAL.step===3&&i!==REAL_TUTORIAL.traceI;d.onclick=()=>REAL_TUTORIAL.step===5?tutorialPlaceCrane():tutorialTraceHit(i);root.appendChild(d);});
 document.body.appendChild(root);
}
window.tutorialTraceHit=(i)=>{
 if(!REAL_TUTORIAL.active||REAL_TUTORIAL.step!==3||i!==REAL_TUTORIAL.traceI)return;
 const p=tutorialTraceWorld()[i];
 U.polyInput.pts.push({x:+(p.x-numv(U.site.dx,0)).toFixed(2),z:+(p.z-numv(U.site.dz,0)).toFixed(2)});
 REAL_TUTORIAL.traceI++;rebuild();renderTutorialTrace();v4Nudge("POINT "+REAL_TUTORIAL.traceI+" / 4");
 if(REAL_TUTORIAL.traceI>=4){setTimeout(()=>{
  if(!REAL_TUTORIAL.active||REAL_TUTORIAL.step!==3)return;
  U.blocks.push({id:Date.now(),label:"住棟",f1:1,f2:Math.max(1,Math.round(posv(U.p.floors,12))),shape:"poly",poly:U.polyInput.pts.slice(),dx:0,dz:0,ry:0});
  U.polyInput.on=false;U.polyInput.pts=[];U.polyInput.target=null;U.layers.site=true;U.layers.building=true;
  rebuild();clearTutorialTrace();v4Nudge("BUILDING OUTLINE / COMPLETE");setTimeout(()=>tutorialSetStep(4),520);
 },220);}
};
function tutorialPrepareStep(n){
 REAL_TUTORIAL.allow=null;REAL_TUTORIAL.target=null;clearTutorialTrace();
 if(n===0){U.tabGroup="1";U.tab="諸元";U.layers.under=false;renderPanel();rebuild();view("bird",{instant:true});}
 if(n===1){U.tabGroup="1";U.tab="諸元";renderPanel();view("bird",{instant:true});}
 if(n===2){U.tabGroup="1";U.tab="下敷き";renderPanel();U.layers.site=false;rebuild();view("top",{instant:true});}
 if(n===3){U.tabGroup="2";U.tab="形状";U.polyInput.on=true;U.polyInput.target=null;U.polyInput.pts=[];renderPanel();U.layers.under=true;U.layers.site=false;rebuild();view("top",{instant:true});REAL_TUTORIAL.traceI=0;setTimeout(renderTutorialTrace,80);}
 if(n===4){
  U.layers.under=false;U.layers.site=true;U.layers.building=true;U.tw.mode="build";U.tw.step=10;U.tw.crane=false;U.tabGroup="3";U.tab="仮設";
  renderPanel();rebuild();view("bird",{instant:true});REAL_TUTORIAL.target="#tutorial-tc-control";REAL_TUTORIAL.allow="#tutorial-tc-control";
 }
  if(n===5){U.tw.crane=false;renderPanel();rebuild();view("bird",{instant:true});setTimeout(renderTutorialTrace,80);}
}
// The placement dot is rendered after the crane has been selected.
const REAL_TUTORIAL_STEPS=[
 {code:"01 / PROJECT DATA",title:"まず、案件情報を開きます。",body:"案件名・用途・構造・階数など、設計概要を最初に確認します。青く光っている「案件情報」を押してください。"},
 {code:"02 / DESIGN SUMMARY",title:"設計概要を入れます。",body:"今回はサンプルなので入力済みです。RC造・12階・高さ37mなど、ここが3Dの基本条件になります。",action:"入力済みの設計概要を確認 →"},
 {code:"03 / SAMPLE PLAN",title:"案件プランPDFを入れます。",body:"チュートリアル用の配置計画図を用意してあります。押すと図面が下敷きとして表示されます。",action:"サンプル案件プランPDFを読み込む"},
 {code:"04 / TRACE BUILDING",title:"建物の形をなぞります。",body:"図面上に出る青い点を 1 → 4 の順に押してください。指示された点以外は操作できません。"},
 {code:"05 / TEMPORARY WORKS",title:"仮設を選びます。",body:"今回はタワークレーンを選択します。左の青く光る項目をONにしてください。"},
  {code:"06 / PLACE CRANE",title:"タワークレーンを配置します。",body:"建物のそばに表示されたTCの点を押してください。配置を確認して完成です。"}
];
function tutorialRender(){
 let el=document.getElementById("real-tutorial");if(!el){el=document.createElement("div");el.id="real-tutorial";document.body.appendChild(el);}
 if(!REAL_TUTORIAL.active){el.remove();return;}
 const s=REAL_TUTORIAL_STEPS[REAL_TUTORIAL.step],simple=document.body.classList.contains("simple");
 if(REAL_TUTORIAL.complete){
  el.innerHTML=`<button class="rt-skip" onclick="exitRealTutorial(false)">自由操作へ</button><div class="rt-card complete"><small>GUIDED PROJECT / COMPLETE</small><h2>基本的な施工計画が<br><em>完成しました。</em></h2><p>案件情報 → 図面 → トレース → 仮設配置。ここからは全機能を自由に触れます。</p><button class="rt-primary" onclick="exitRealTutorial(false)">自由操作を始める <b>→</b></button></div>`;
  return;
 }
 let action="";
 if(REAL_TUTORIAL.step===1)action=`<button class="rt-primary" onclick="tutorialSetStep(2)">${s.action}<b>→</b></button>`;
 if(REAL_TUTORIAL.step===2)action=`<button class="rt-primary" onclick="tutorialLoadPlan()" ${REAL_TUTORIAL.loading?"disabled":""}>${REAL_TUTORIAL.loading?"PDFを読み込み中…":s.action}<b>→</b></button>`;
 if(REAL_TUTORIAL.step===0)action=`<button class="rt-primary" onclick="tutorialSetStep(1)">案件情報を確認する <b>→</b></button>`;
 if(REAL_TUTORIAL.step===4)action=`<button class="rt-primary" onclick="tutorialSelectCrane()">タワークレーンを選択 <b>→</b></button>`;
 if(REAL_TUTORIAL.step===5)action=`<button class="rt-primary" onclick="tutorialPlaceCrane()">この位置にタワークレーンを配置 <b>→</b></button>`;
 el.innerHTML=`<button class="rt-skip" onclick="exitRealTutorial(true)">チュートリアルをスキップ <small>ESC</small></button><div class="rt-progress" aria-label="${REAL_TUTORIAL.step+1} / ${REAL_TUTORIAL_STEPS.length}">${REAL_TUTORIAL_STEPS.map((_,i)=>`<i class="${i<REAL_TUTORIAL.step?"done":i===REAL_TUTORIAL.step?"on":""}"></i>`).join("")}</div><div class="rt-card"><small>${REAL_TUTORIAL.step+1} / ${REAL_TUTORIAL_STEPS.length} · GUIDED PROJECT / ${s.code}</small><h2>${s.title}</h2><p>${s.body}</p>${action||'<div class="rt-wait"><i></i><span>青く光っている場所だけ操作できます</span></div>'}</div>`;
 setTimeout(tutorialHighlight,30);
}
function tutorialHighlight(){
 document.querySelectorAll(".tutorial-target").forEach(x=>x.classList.remove("tutorial-target"));
 if(!REAL_TUTORIAL.active||!REAL_TUTORIAL.target)return;
 const t=document.querySelector(REAL_TUTORIAL.target);if(t){t.classList.add("tutorial-target");try{t.scrollIntoView({block:"center",behavior:"smooth"});}catch(e){}}
}
window.tutorialSetStep=(n)=>{if(!REAL_TUTORIAL.active)return;REAL_TUTORIAL.step=n;REAL_TUTORIAL.complete=false;tutorialPrepareStep(n);tutorialRender();};
window.tutorialSelectCrane=()=>{if(REAL_TUTORIAL.active&&REAL_TUTORIAL.step===4){U.tw.crane=true;tutorialSetStep(5);}};
window.tutorialPlaceCrane=()=>{if(!REAL_TUTORIAL.active||REAL_TUTORIAL.step!==5)return;U.tw.craneX=REAL_DEMO.tw.craneX;U.tw.craneZ=REAL_DEMO.tw.craneZ;U.tw.crane=true;tutorialComplete();};
function tutorialComplete(){
 if(!REAL_TUTORIAL.active)return;REAL_TUTORIAL.complete=true;REAL_TUTORIAL.allow=null;REAL_TUTORIAL.target=null;clearTutorialTrace();U.tw.crane=true;U.tw.craneModel="JCL015_H";U.sel="crane";rebuild();renderPanel();renderBar();focusSelectionCamera("crane",{duration:620});v4Nudge("TOWER CRANE / SET");tutorialRender();
}
window.startRealTutorial=()=>{
 REAL_TUTORIAL.active=true;REAL_TUTORIAL.loading=false;REAL_TUTORIAL.step=0;REAL_TUTORIAL.traceI=0;REAL_TUTORIAL.complete=false;document.body.classList.add("tutorial-mode");tutorialPrepareStep(0);tutorialRender();
};
window.exitRealTutorial=async(skipped)=>{
 REAL_TUTORIAL.active=false;REAL_TUTORIAL.complete=false;REAL_TUTORIAL.allow=null;REAL_TUTORIAL.target=null;document.body.classList.remove("tutorial-mode");clearTutorialTrace();
 const e=document.getElementById("real-tutorial");if(e)e.remove();document.querySelectorAll(".tutorial-target").forEach(x=>x.classList.remove("tutorial-target"));
 U.polyInput.on=false;U.polyInput.pts=[];U.polyInput.target=null;
 await loadTutorialFinishedProject(!!skipped);
};
document.addEventListener("pointerdown",(e)=>{
 if(!REAL_TUTORIAL.active)return;
 if(e.target.closest("#real-tutorial")||e.target.closest(".rt-trace-dot.current")||e.target.closest(".tutorial-target"))return;
 const allow=REAL_TUTORIAL.allow&&e.target.closest(REAL_TUTORIAL.allow);
 if(allow)return;
 e.preventDefault();e.stopImmediatePropagation();
 const card=document.querySelector("#real-tutorial .rt-card");if(card){card.classList.remove("blocked");void card.offsetWidth;card.classList.add("blocked");}
},true);
document.addEventListener("click",(e)=>{
 if(!REAL_TUTORIAL.active||REAL_TUTORIAL.complete)return;
 if(REAL_TUTORIAL.allow&&e.target.closest(REAL_TUTORIAL.allow)){
  if(REAL_TUTORIAL.step===0)setTimeout(()=>tutorialSetStep(1),100);
  else if(REAL_TUTORIAL.step===4)setTimeout(()=>{if(REAL_TUTORIAL.active&&U.tw.crane)tutorialSetStep(5);},140);
 }
},true);
document.addEventListener("wheel",(e)=>{if(REAL_TUTORIAL.active){e.preventDefault();e.stopImmediatePropagation();}},{capture:true,passive:false});
document.addEventListener("keydown",(e)=>{
 if(!REAL_TUTORIAL.active)return;
 if(e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();exitRealTutorial(true);return;}
 e.preventDefault();e.stopImmediatePropagation();
},true);
window.addEventListener("resize",()=>{if(REAL_TUTORIAL.active&&[3,5].includes(REAL_TUTORIAL.step))setTimeout(renderTutorialTrace,30);});

// ───── 初めての方向けガイド（ツアー）：デモ案件を開いて5ステップを順に案内 ─────
const TOUR_STEPS=[
 {t:"① 3Dの動かし方",b:"空白をドラッグ＝画面移動、Ctrl＋ドラッグ＝視点回転。物の上はドラッグ＝移動、Ctrl＋ドラッグ＝その物を回転。ホイール／2本指で拡大縮小します。",do:()=>{view("bird");}},
 {t:"② 検討判定（右下）",b:"OK／注意／要検討が常に出ます。行にマウスを乗せると対処の目安。今は「要検討」がある狭小地の例です。",do:()=>{U._hudMin=false;renderHUD();}},
 {t:"③ 左の段階バー",b:"①案件 → ②図面・敷地 → ③仮設 → ④検討。案件情報から地図・PDF、敷地と建物をなぞり、最後に仮設をじっくり詰めます。",do:()=>{U.tabGroup="3";U.tab="仮設";renderPanel();}},
 {t:"④ 上の道具でなぞる",b:"敷地・建物・道路・仮囲いは、地図や図面の上をクリックしてなぞります。Backspaceで1点戻す、Escで中止。",do:()=>{view("top");}},
 {t:"⑤ 出力と保存",b:"④「検討・出力」→ 📄検討シートでA4横1枚に。💾保存で案件ファイル。作業中の内容はこの端末に自動退避されます。",do:()=>{U.tabGroup="4";U.tab="検討";renderPanel();view("bird");}},
];
let _tourI=0;
window.startTour=()=>{openDemoCase();_tourI=0;setTimeout(()=>renderTour(),350);};
window.tourNext=(d)=>{_tourI+=d;if(_tourI<0)_tourI=0;if(_tourI>=TOUR_STEPS.length){endTour();return;}renderTour();};
window.endTour=()=>{const el=document.getElementById("tour");if(el)el.style.display="none";try{localStorage.setItem("bimgen_tour_done","1");}catch(e){}toast("ガイド終了。右上「＋ 新規」からいつでもやり直せます","ok");};
function renderTour(){
 let el=document.getElementById("tour");if(!el){el=document.createElement("div");el.id="tour";document.body.appendChild(el);}
 const s=TOUR_STEPS[_tourI];if(!s)return;try{s.do&&s.do();}catch(e){}
 el.style.display="";
 el.innerHTML=`<div class="tour-h"><span>はじめてガイド　${_tourI+1} / ${TOUR_STEPS.length}</span><span class="sc-x" onclick="endTour()">✕</span></div>
  <div class="tour-b"><b>${s.t}</b><p>${s.b}</p>
  <div class="tour-f"><button class="btn" ${_tourI===0?"disabled":""} onclick="tourNext(-1)">← 前へ</button><span class="tour-dots">${TOUR_STEPS.map((_,i)=>`<i class="${i===_tourI?"on":""}"></i>`).join("")}</span><button class="btn primary" onclick="tourNext(1)">${_tourI===TOUR_STEPS.length-1?"おわり":"次へ →"}</button></div></div>`;
}
// ───── 初回オンボーディング（1画面）とコーチ表示 ─────
function _onbDone(){try{return localStorage.getItem("bimgen_onb")==="1";}catch(e){return true;}}
function _onbMark(){try{localStorage.setItem("bimgen_onb","1");}catch(e){}}
window.closeOnb=()=>{const o=document.getElementById("onb");if(o)o.remove();_onbMark();};
window.openOnb=()=>{
 let o=document.getElementById("onb");if(!o){o=document.createElement("div");o.id="onb";document.body.appendChild(o);}
 o.innerHTML=`<div class="onb-card"><h1>図面・地図を、その場で3Dに。</h1><p>まずはサンプルを開いて、指で回してみてください。工程を切り替えたり、クレーンや車両を動かせます。</p>
  <button class="onb-main" onclick="closeOnb();openRealDemo()"><b>実案件で見る</b><small>都内・共同住宅12階（狭小地・地下鉄直下）— 仮囲い・クレーン・生コン車まで入った状態</small></button>
  <div class="onb-row"><button class="onb-sub" onclick="closeOnb();newFromTemplate('apt8');coach(1)">共同住宅 8階</button><button class="onb-sub" onclick="closeOnb();newFromTemplate('office5');coach(1)">事務所ビル 5階</button></div>
  <button class="onb-skip" onclick="closeOnb();openStart()">他のサンプル・自分で作る ▸</button></div>`;
};
let _coachT=null;
window.coach=(step)=>{
 let c=document.getElementById("coach");if(!c){c=document.createElement("div");c.id="coach";document.body.appendChild(c);c.onclick=()=>{c.className="";};}
 clearTimeout(_coachT);
 const simple=document.body.classList.contains("simple");
 if(step===1){c.className="show top";c.innerHTML=`指1本で回す・2本で寄せる<small>${simple?"次に、下の「工程」を押してみてください":"次に、左の「③ 仮設を計画」で工程を切り替えてみてください"}</small>`;_coachT=setTimeout(()=>coach(2),6000);}
 else if(step===2){c.className="show bottom";c.innerHTML=`${simple?"下の「工程」で施工の状態が変わります":"工程フェーズを切り替えると施工の状態が変わります"}<small>${simple?"「仮設」でクレーン・車両をON、タップして動かせます":"仮設タブでクレーン・車両を配置し、3D上でドラッグできます"}</small>`;_coachT=setTimeout(()=>{c.className="";},9000);}
 else c.className="";
};
// ───── BimGen UI v4 / Stage 1：スタート体験・モーション基盤 ─────
const V4_PHASE_NO={demo:"01",retain:"02",pile:"03",steel:"04",build:"05",plan:"06"};
let _v4FxTimer=null,_v4NudgeTimer=null;
window.v4PhaseFlash=(key,label)=>{
 let el=document.getElementById("v4-phase-flash");
 if(!el){el=document.createElement("div");el.id="v4-phase-flash";document.body.appendChild(el);}
 clearTimeout(_v4FxTimer);
 el.className="";
 el.innerHTML=`<span>PHASE ${V4_PHASE_NO[key]||"--"}</span><b>${label||""}</b><small>CONSTRUCTION SEQUENCE</small>`;
 requestAnimationFrame(()=>el.classList.add("show"));
 _v4FxTimer=setTimeout(()=>el.classList.remove("show"),720);
};
window.v4DemoEnter=(run)=>{
 let el=document.getElementById("v4-demo-enter");
 if(!el){el=document.createElement("div");el.id="v4-demo-enter";document.body.appendChild(el);}
 el.className="";
 el.innerHTML=`<div class="v4de-grid"></div><div class="v4de-inner">
   <div class="v4de-code">REAL PROJECT / 01</div>
   <div class="v4de-line"></div>
   <h2>CONSTRUCTION<br><span>PLAN ONLINE</span></h2>
   <p>都内共同住宅 / RC12F</p>
   <div class="v4de-meta"><span>3D MODEL</span><span>TEMP WORKS</span><span>PROJECT CHECK</span></div>
   <div class="v4de-load"><i></i></div>
  </div>`;
 requestAnimationFrame(()=>el.classList.add("show"));
 setTimeout(()=>{try{run&&run();}catch(e){console.error(e);}},260);
 setTimeout(()=>{if(typeof view==="function")view("bird",{intro:true,duration:980});},860);
 setTimeout(()=>el.classList.add("out"),1010);
 setTimeout(()=>{el.className="";el.innerHTML="";},1370);
};
window.v4PanelStage=(key,label)=>{
 if(document.body.classList.contains("simple"))return;
 let el=document.getElementById("v4-panel-stage");
 if(!el){el=document.createElement("div");el.id="v4-panel-stage";document.body.appendChild(el);}
 const en=({"1":"PROJECT","2":"BASE","3":"PLAN","4":"REVIEW"})[key]||"";
 el.innerHTML=`<small>STAGE ${String(key).padStart(2,"0")} / ${en}</small><b>${label||""}</b>`;
 el.className="";
 requestAnimationFrame(()=>el.classList.add("show"));
 clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove("show"),520);
};
window.v4Nudge=(txt)=>{
 let el=document.getElementById("v4-nudge");
 if(!el){el=document.createElement("div");el.id="v4-nudge";document.body.appendChild(el);}
 clearTimeout(_v4NudgeTimer);el.textContent=txt;el.className="show";
 _v4NudgeTimer=setTimeout(()=>el.className="",620);
};
window.v4NewProject=()=>{
 const go=()=>{
  closeStart();
  if(document.body.classList.contains("simple")){openSheet("edit");}
  else{newBlank();U.tabGroup="1";U.tab="諸元";renderPanel();view("bird",{intro:true,duration:720});}
 };
 let el=document.getElementById("v4-new-enter");
 if(!el){el=document.createElement("div");el.id="v4-new-enter";document.body.appendChild(el);}
 el.innerHTML=`<div><small>NEW PROJECT / 02</small><b>PROJECT<br><span>SETUP</span></b><i></i></div>`;
 el.className="show";
 setTimeout(go,260);setTimeout(()=>el.classList.add("out"),480);setTimeout(()=>{el.className="";el.innerHTML="";},760);
};
window.openStart=()=>{
 document.body.classList.add("start-open");
 setLeftPanelCollapsed(true);
 closeSettings();U._layersOpen=false;renderLayers();U.sel=null;renderSelCard();
 let s=document.getElementById("start");
 if(!s){s=document.createElement("div");s.id="start";document.body.appendChild(s);}
 s.className="v4-start";
 const d=(draftEnabled&&draftEnabled())?readDraft():null;
 const resume=d?`<button class="v4-resume" onclick="restoreDraft()"><span>RESUME</span><b>前回の続きから</b><small>${_esc(d.name||"（案件名未入力）")}</small></button>`:"";
 s.innerHTML=`<div class="v4-start-card">
  <div class="v4-start-top">
   <div class="v4-brand"><span class="v4-brand-mark">BG</span><div><b>BimGen</b><small>CONSTRUCTION COMMAND INTERFACE</small></div></div>
   <button class="v4-x" onclick="closeStart()" aria-label="閉じる">×</button>
  </div>

  <div class="v4-hero">
   <div class="v4-kicker">3D CONSTRUCTION PLANNING / EARLY STAGE</div>
   <h1>図面から、<br><em>施工を考える。</em></h1>
   <p>図面・地図を立体化し、工程と仮設をその場で動かす。<br>営業・施工の初期検討を、ひとつの3D画面で。</p>
  </div>

  <div class="v4-entry-grid">
   <button class="v4-entry real" onclick="openRealDemo()">
    <span class="v4-entry-no">01</span><span class="v4-entry-tag">REAL PROJECT</span>
    <b>実案件で<br>BimGenを体験する。</b>
    <small>GUIDED PROJECT / 6 STEP<br>案件情報 → PDF → 敷地・建物 → 仮設</small>
    <i>START TUTORIAL <strong>→</strong></i>
   </button>
   <button class="v4-entry new" onclick="v4NewProject()">
    <span class="v4-entry-no">02</span><span class="v4-entry-tag">NEW PROJECT</span>
    <b>自分の案件を<br>3Dで立ち上げる。</b>
    <small>諸元から簡易作成 / 図面・地図から作成<br>あとから詳細編集できます</small>
    <i>CREATE PROJECT <strong>→</strong></i>
   </button>
  </div>

  <div class="v4-cap">
   <div><span>01</span><b>3D化</b><small>DRAWING → MODEL</small></div>
   <div><span>02</span><b>施工検討</b><small>PLAN → SIMULATE</small></div>
   <div><span>03</span><b>条件判定</b><small>CHECK → REVIEW</small></div>
   <div><span>04</span><b>共有</b><small>OUTPUT → SHARE</small></div>
  </div>

  ${resume}

  <details class="v4-more">
   <summary><span>OTHER ENTRY</span> その他のサンプル・保存データを開く <b>＋</b></summary>
   <div class="v4-more-body">
    <div class="v4-sample-grid">${TEMPLATES.map((t,i)=>`<button class="v4-sample" onclick="newFromTemplate('${t.key}')"><span>${String(i+1).padStart(2,"0")}</span><b>${t.name}</b><small>${t.sub}</small></button>`).join("")}</div>
    <div class="v4-subactions">
     <button onclick="openDemoCase()">DEMO CASE<small>傾斜地・仮囲い・クレーン入り</small></button>
     <button onclick="openBimSample()">BIM FULL SAMPLE<small>BIM出力・検討シート検証用</small></button>
     <button onclick="document.getElementById('json-file').click();closeStart()">OPEN FILE<small>.json / .bsjson</small></button>
     <button onclick="startTour()">QUICK GUIDE<small>ガイド付きで操作を見る</small></button>
    </div>
   </div>
  </details>

  <div class="v4-credit"><span>PLANNED / DESIGNED / DEVELOPED IN-HOUSE</span><b>企画・設計・開発　日本建設株式会社 東京支店 営業部 伊藤 絃</b><small>実務で感じた課題を起点に、一から内製した業務改善ツール</small></div>
 </div>`;
 s.style.display="";s.classList.remove("hide");
 requestAnimationFrame(()=>s.classList.add("ready"));
};

// ───── レイヤー / 表示・編集スコープ ─────
const LAYER_DEFAULTS={site:true,building:true,nbs:true,fence:true,scaffold:true,crane:true,vehicles:true,tempobj:true,safety:true,obstacles:true,annot:true,sub:true,roads:true,under:true,cobj:true};
const _VEHICLE_TYPES=new Set(["mixer","pump","truck","rough","backhoe","found"]);
const _TEMP_TYPES=new Set(["stage","lsev","komalift","temp"]);
const _SAFETY_TYPES=new Set(["guard","walkzone","safepath"]);
const LAYER_DEF=[
 ["site","敷地", (k,o)=>k==="site"],
 ["building","建物", (k,o)=>k.startsWith("blk:")],
 ["roads","道路・歩道", (k,o)=>k.startsWith("rd:")||k==="road"||k==="roadwalk"||k==="roadside"],
 ["nbs","近隣建物・既存", (k,o)=>k.startsWith("nb:")||k==="demo"],
 ["fence","仮囲い", (k,o)=>k==="fence"],
 ["scaffold","足場・養生", (k,o)=>o&&o.userData&&o.userData.layerKey==="scaffold"],
 ["crane","タワークレーン", (k,o)=>k==="crane"||(k.startsWith("co:")&&o&&o.userData&&o.userData.cobjType==="towercrane")],
 ["vehicles","重機・車両", (k,o)=>k==="mixer"||k==="rough"||(k.startsWith("co:")&&o&&o.userData&&_VEHICLE_TYPES.has(o.userData.cobjType))],
 ["tempobj","仮設設備", (k,o)=>k==="ev"||(k.startsWith("co:")&&o&&o.userData&&_TEMP_TYPES.has(o.userData.cobjType))],
 ["safety","安全通路・警備", (k,o)=>k.startsWith("co:")&&o&&o.userData&&_SAFETY_TYPES.has(o.userData.cobjType)],
 ["obstacles","地上支障物", (k,o)=>k.startsWith("co:")&&o&&o.userData&&o.userData.cobjType==="obstacle"],
 ["annot","注記", (k,o)=>k.startsWith("an:")],
 ["sub","地下支障物", (k,o)=>k.startsWith("sub:")],
 ["under","下敷き・写真", (k,o)=>k==="under"||k==="photo"],
];
function ensureLayers(){
 if(!U.layers||typeof U.layers!=="object")U.layers={};
 Object.keys(LAYER_DEFAULTS).forEach(k=>{if(U.layers[k]==null)U.layers[k]=LAYER_DEFAULTS[k];});
}
function applyLayers(root){
 ensureLayers();
 const L=U.layers||{},off=LAYER_DEF.filter(d=>L[d[0]]===false),legacyCobjOff=L.cobj===false;
 root.traverse(o=>{
  const ud=o.userData||{},k=ud.dragKey||"";
  if(legacyCobjOff&&k.startsWith("co:")){o.visible=false;return;}
  if(ud.layerKey&&L[ud.layerKey]===false){o.visible=false;return;}
  if(k&&off.some(d=>d[2](k,o)))o.visible=false;
 });
}
window.toggleLayer=(key,v)=>{ensureLayers();U.layers[key]=v;rebuild();renderLayers();if(typeof renderMobile==="function")renderMobile();};
window.setLayerPreset=(name)=>{
 ensureLayers();
 const on=(keys)=>{LAYER_DEF.forEach(d=>U.layers[d[0]]=keys.includes(d[0]));U.layers.cobj=true;};
 if(name==="all")LAYER_DEF.forEach(d=>U.layers[d[0]]=true);
 else if(name==="model")on(["site","building","roads"]);
 else if(name==="temp")on(["site","building","roads","fence","scaffold","crane","vehicles","tempobj","safety"]);
 else if(name==="context")on(["site","building","roads","nbs","obstacles","annot","sub","under"]);
 U.layers.cobj=true;rebuild();renderLayers();if(typeof renderMobile==="function")renderMobile();
};
window.renderLayers=()=>{
 let el=document.getElementById("layers"); if(!el){el=document.createElement("div");el.id="layers";document.body.appendChild(el);}
 if(!U._layersOpen){el.style.display="none";return;}
 ensureLayers();el.style.display="";
 const L=U.layers||{},scope=UI_PREF.editScope||"all";
 const group=(title,keys)=>`<div class="ly-group"><small>${title}</small>${LAYER_DEF.filter(d=>keys.includes(d[0])).map(d=>`<label class="ly-row"><input type="checkbox" ${L[d[0]]!==false?"checked":""} onchange="toggleLayer('${d[0]}',this.checked)"><span>${d[1]}</span></label>`).join("")}</div>`;
 el.innerHTML=`<div class="ly-head"><div><small>DISPLAY / EDIT CONTROL</small><b>レイヤー</b></div><button onclick="U._layersOpen=false;renderLayers()">×</button></div>
  <div class="ly-presets"><button onclick="setLayerPreset('all')">ALL<small>全部</small></button><button onclick="setLayerPreset('model')">MODEL<small>建物</small></button><button onclick="setLayerPreset('temp')">PLAN<small>施工</small></button><button onclick="setLayerPreset('context')">SITE<small>周辺</small></button></div>
  <div class="ly-lock"><span><small>EDIT LOCK</small><b>動かせる物</b></span><button class="${scope==="all"?"on":""}" onclick="setEditScope('all')">すべて</button><button class="${scope==="temp"?"on":""}" onclick="setEditScope('temp')">仮設物だけ</button></div>
  <div class="ly-body">${group("MODEL",["site","building","roads","nbs"])}${group("TEMPORARY WORKS",["fence","scaffold","crane","vehicles","tempobj","safety"])}${group("CONTEXT",["obstacles","annot","sub","under"])}</div>`;
};
window.toggleLayers=()=>{
 const opening=!U._layersOpen;U._layersOpen=opening;
 if(opening){closeRightSurfaces("layers");U._layersOpen=true;U.sel=null;renderSelCard();closeSettings();renderHUD();renderTitle();}
 renderLayers();
};
window.closeSettings=()=>{const e=document.getElementById("settings");if(e)e.classList.remove("open");};
window.renderSettings=()=>{
 const el=document.getElementById("settings");if(!el||!el.classList.contains("open"))return;
 const fs=Math.round(numv(UI_PREF.fontScale,100)),ls=Math.round(numv(UI_PREF.labelScale,100)),scope=UI_PREF.editScope||"all";
 el.innerHTML=`<div class="set-card"><div class="set-top"><div><small>SYSTEM SETTINGS / DISPLAY</small><b>表示と操作</b><span>説明書を読まなくても見やすい画面に調整</span></div><button onclick="closeSettings()">×</button></div>
  <div class="set-grid">
   <section><em>01 / TEXT</em><h3>画面の文字サイズ</h3><p>左パネル・上部操作・設定カードの表示倍率。</p><div class="set-range"><input type="range" min="85" max="130" step="5" value="${fs}" oninput="setUIFontScale(this.value)"><b id="set-font-val">${fs}%</b></div><div class="set-presets"><button onclick="setUIFontScale(90);renderSettings()">小</button><button onclick="setUIFontScale(100);renderSettings()">標準</button><button onclick="setUIFontScale(115);renderSettings()">大</button><button onclick="setUIFontScale(130);renderSettings()">特大</button></div></section>
   <section><em>02 / 3D LABEL</em><h3>3D寸法・ラベル</h3><p>寸法値・道路幅・起算点など3D上の文字だけ変更。</p><div class="set-range"><input type="range" min="75" max="160" step="5" value="${ls}" oninput="setLabelScale(this.value)"><b id="set-label-val">${ls}%</b></div><div class="set-presets"><button onclick="setLabelScale(85);renderSettings()">小</button><button onclick="setLabelScale(100);renderSettings()">標準</button><button onclick="setLabelScale(125);renderSettings()">大</button><button onclick="setLabelScale(150);renderSettings()">特大</button></div></section>
   <section class="wide"><em>03 / EDIT LOCK</em><h3>誤操作を防ぐ</h3><p>仮設計画中に建物や敷地をうっかり動かさないためのロック。</p><div class="set-mode"><button class="${scope==="all"?"on":""}" onclick="setEditScope('all')"><small>ALL OBJECTS</small><b>すべて動かす</b></button><button class="${scope==="temp"?"on":""}" onclick="setEditScope('temp')"><small>TEMP ONLY</small><b>仮設物だけ動かす</b></button></div></section>
  </div>
  <div class="set-foot"><button onclick="UI_PREF.fontScale=100;UI_PREF.labelScale=100;UI_PREF.editScope='all';saveUIPref();applyUIPref();rebuild();renderSettings();renderBar()">RESET / 標準に戻す</button><span>設定はこの端末に保存されます</span></div></div>`;
};
window.openSettings=()=>{
 closeRightSurfaces("settings");U._layersOpen=false;renderLayers();U.sel=null;renderSelCard();
 let el=document.getElementById("settings");if(!el){el=document.createElement("div");el.id="settings";document.body.appendChild(el);el.addEventListener("pointerdown",e=>{if(e.target===el)closeSettings();});}
 el.classList.add("open");renderSettings();
};
function ensureSettingsLauncher(){
 let b=document.getElementById("settings-fixed");
 if(!b){b=document.createElement("button");b.id="settings-fixed";b.type="button";b.setAttribute("aria-label","設定");b.title="文字サイズ・レイヤー・編集ロック";b.innerHTML="<span>⚙</span><small>SETTINGS</small>";b.onclick=()=>openSettings();document.body.appendChild(b);}
}
ensureSettingsLauncher();



// ───── キャンバス上の描く道具（どのタブにいても使える） ─────
function startDraw(target){
 // target: site / block / road / fence
 if(U.polyInput.on&&U.polyInput.target===target){U.polyInput.on=false;U.polyInput.pts=[];U.polyInput.target=null;rebuild();renderPanel();renderBar();return;}
 U.polyInput.on=true;U.polyInput.pts=[];U.polyInput.target=(target==="block"?null:target);
 if(target==="site"){U.site.active=true;U.tabGroup="2";U.tab="敷地・地形";}
 if(target==="block"){U.tabGroup="2";U.tab="形状";}
 if(target==="road"){U.tabGroup="2";U.tab="敷地・地形";}
 if(target==="fence"){U.tabGroup="3";U.tab="仮設";U.tw.fence=true;}
 view("top"); renderPanel(); renderBar();
 const msg={site:"敷地の外周を",block:"建物の外周を",road:"道路の中心線を",fence:"仮囲いの線を"}[target];
 toast(msg+"クリックでなぞり、ダブルクリックで確定");
}
window.startDraw=startDraw;
function _toolsPos(){try{return JSON.parse(localStorage.getItem("bimgen_tools_pos")||"null");}catch(e){return null;}}
function _toolsSave(p){try{localStorage.setItem("bimgen_tools_pos",JSON.stringify(p));}catch(e){}}
window.toolsReset=()=>{try{localStorage.removeItem("bimgen_tools_pos");}catch(e){}const el=document.getElementById("tools");if(el){el.style.left="";el.style.top="";el.style.right="";el.style.bottom="";el.style.transform="";}};
window.toolsToggle=()=>{U._toolsMin=!U._toolsMin;renderTools();};
function renderTools(){
 if(typeof renderUnderControl==="function")renderUnderControl();
 let el=document.getElementById("tools");
 if(!el){el=document.createElement("div");el.id="tools";document.body.appendChild(el);
  // つまみをドラッグで移動
  let drag=null;
  el.addEventListener("pointerdown",(e)=>{const g=e.target.closest(".tool-grip");if(!g)return;e.preventDefault();const r=el.getBoundingClientRect();drag={dx:e.clientX-r.left,dy:e.clientY-r.top};el.setPointerCapture(e.pointerId);});
  el.addEventListener("pointermove",(e)=>{if(!drag)return;const x=Math.max(0,Math.min(innerWidth-60,e.clientX-drag.dx)),y=Math.max(0,Math.min(innerHeight-40,e.clientY-drag.dy));el.style.left=x+"px";el.style.top=y+"px";el.style.right="auto";el.style.bottom="auto";el.style.transform="none";});
  el.addEventListener("pointerup",(e)=>{if(!drag)return;drag=null;_toolsSave({x:parseFloat(el.style.left),y:parseFloat(el.style.top)});});
  const p=_toolsPos(); if(p&&isFinite(p.x)&&isFinite(p.y)){el.style.left=Math.min(p.x,innerWidth-80)+"px";el.style.top=Math.min(p.y,innerHeight-50)+"px";el.style.right="auto";el.style.bottom="auto";el.style.transform="none";}
 }
 if(U._toolsMin){el.innerHTML=`<div class="tool-grp"><span class="tool-grip" title="ドラッグで移動">⋮⋮</span><button class="tool" style="min-width:auto" onclick="toolsToggle()" title="道具を表示"><span>✎</span>道具</button></div>`;return;}
 const on=(t)=>U.polyInput.on&&((t==="block"&&U.polyInput.target==null)||U.polyInput.target===t);
 const b=(t,ic,lab)=>`<button class="tool ${on(t)?"on":""}" title="${lab}（クリック→ダブルクリックで確定）" onclick="startDraw('${t}')"><span>${ic}</span>${lab}</button>`;
 el.innerHTML=`<div class="tool-grp"><span class="tool-grip" title="ドラッグで移動／ダブルクリックで初期位置" ondblclick="toolsReset()">⋮⋮</span>${b("site","▭","敷地")}${b("block","▣","建物")}${b("road","═","道路")}${b("fence","▦","仮囲い")}</div>
  <div class="tool-grp">
   <button class="tool ${U.dim.on?"on":""}" title="2点クリックで距離を測る" onclick="S('dim.on',!U.dim.on,false);if(!U.dim.on){U.dim.a=null;U.dim.b=null;}rebuild();renderBar()"><span>↔</span>寸法</button>
   <button class="tool ${U.snap!==false?"on":""}" title="頂点・道路への吸着、15°刻み回転" onclick="U.snap=!U.snap;renderBar();renderPanel()"><span>⌖</span>吸着</button>
   <button class="tool ${U.moveLayers?"on":""}" title="PDF・地図を操作：ドラッグ＝移動 / Ctrl＋ドラッグ＝回転" onclick="setUnderMoveMode(!U.moveLayers)"><span>✥</span>下地を動かす</button>
   <button class="tool" title="道具をしまう" onclick="toolsToggle()" style="min-width:34px"><span>▾</span><span style="font-size:0"></span></button>
  </div>
  ${U.polyInput.on?`<div class="tool-hint">なぞり中：${U.polyInput.pts.length}点　<b>ダブルクリックで確定</b>　<a href="#" onclick="if(U.polyInput.pts.length){U.polyInput.pts.pop();rebuild();renderPanel();renderBar();}return false">↩ 1点戻す</a><a href="#" onclick="U.polyInput.on=false;U.polyInput.pts=[];U.polyInput.target=null;rebuild();renderPanel();renderBar();return false">中止(Esc)</a></div>`:""}`;
}
window.renderTools=renderTools;

function setUnderMoveMode(on){
 U.moveLayers=!!on;
 if(U.moveLayers&&U.under&&U.under.tex){
  U.sel="under";U.auto=false;
  closeRightSurfaces("sel");
  renderSelCard(true);view("top",{instant:true});
 }else if(U.sel==="under"){U.sel=null;renderSelCard();}
 rebuild();renderBar();renderUnderControl();
}
window.setUnderMoveMode=setUnderMoveMode;
function renderUnderControl(){
 let el=document.getElementById("under-control");
 if(!el){el=document.createElement("div");el.id="under-control";document.body.appendChild(el);}
 const has=!!(U.under&&U.under.tex&&U.under.show!==false);
 if(!has||document.body.classList.contains("simple")){el.style.display="none";return;}
 el.style.display="";
 const on=!!U.moveLayers;
 el.className=on?"on":"";
 el.innerHTML=`<button class="under-main" onclick="setUnderMoveMode(${!on})"><span>✥</span><b>${on?"下地操作中":"下地を動かす"}</b><small>${on?"ドラッグ＝移動　Ctrl＋ドラッグ＝回転":"PDF / 地理院地図を選択"}</small></button>${on?`<button class="under-done" onclick="setUnderMoveMode(false)">完了</button>`:""}`;
}
window.renderUnderControl=renderUnderControl;

// ───── 選択中の物の属性カード（右上バーの下）：クリックした物のパラメータだけを出す ─────
let _selCardKey=null;
function renderSelCard(force){
 let el=document.getElementById("selcard");
 if(!el){el=document.createElement("div");el.id="selcard";document.body.appendChild(el);}
 const k=U.sel; if(!k){el.style.display="none";_selCardKey=null;return;}
 if(_selCardKey!==k){closeRightSurfaces("sel");U._hudMin=true;U._titleMin=true;const h=document.getElementById("hud");if(h)h.style.display="none";const t=document.getElementById("title");if(t)t.style.display="none";}
 // 同じ物を表示中でカード内を操作している最中（スライダー等）は作り直さない
 if(!force&&_selCardKey===k&&el.contains(document.activeElement))return;
 _selCardKey=k;
 let title="",body="",del="";
 const rowSL=(lab,val,fn,mn,mx,st)=>SL(lab,val,fn,mn,mx,st);
 if(k.startsWith("co:")){const i=+k.slice(3),c=U.cobj[i];if(!c){el.style.display="none";return;}const t=COBJ_TYPES[c.type]||{label:c.type,sizes:[]};
  title=t.label;
  const mech=(c.type==="rough"||c.type==="pump");
  const szNow=cobjSize(c.type,c.size)||{};
  const boomPct=Math.max(0,Math.min(100,numv(c.boomPct,c.type==="pump"?62:55)));
  const boomAngle=Math.max(5,Math.min(80,numv(c.boomAngle,c.type==="pump"?48:42)));
  const outPct=Math.max(0,Math.min(100,numv(c.outPct,c.type==="pump"?85:70)));
  const boomLen=(szNow.boomMin!=null&&szNow.boomMax!=null)?(szNow.boomMin+(szNow.boomMax-szNow.boomMin)*boomPct/100):null;
  body=`<label class="f"><span>サイズ</span><select onchange="setCOSize(${i},this.value)">${(t.sizes||[]).map(s=>`<option value="${s.key}" ${c.size===s.key?"selected":""}>${s.label}</option>`).join("")}</select></label>
   ${c.type==="towercrane"?rowSL("設置高さ m",numv(c.h,craneSpec(c.size).selfH),`(v)=>setCOHeight(${i},v)`,craneSpec(c.size).selfH,craneSpec(c.size).maxInstallH||51,.5):""}
   ${mech?`<div class="machine-controls"><small>WORKING CONFIGURATION</small>
     ${rowSL("ブーム伸長 "+(boomLen!=null?"（約"+boomLen.toFixed(1)+"m）":""),boomPct,`(v)=>setCOParam(${i},'boomPct',v)`,0,100,5)}
     ${rowSL("ブーム角度 °",boomAngle,`(v)=>setCOParam(${i},'boomAngle',v)`,5,80,1)}
     ${rowSL("ブーム旋回 °",((numv(c.boomRy,0)%360)+360)%360,`(v)=>setCOParam(${i},'boomRy',v)`,0,359,1)}
     ${rowSL("アウトリガー張出 %",outPct,`(v)=>setCOParam(${i},'outPct',v)`,0,100,5)}
     <div class="machine-note">低ポリ施工検討モデル。外形・可動状態の確認用で、実機寸法はメーカー資料で最終確認してください。</div>
    </div>`:""}
   ${rowSL("向き °",numv(c.ry,0),`(v)=>{snapshot('co.ry.${i}');U.cobj[${i}].ry=v;rebuildThrottled();}`,0,359,1)}
   <div class="sc-refdist">📏 ${refDistanceText(numv(c.x,0),numv(c.z,0))}</div>
   ${c._warn?`<div style="font-size:11px;color:#B0433A;font-weight:700">⚠ 歩行帯と干渉しています</div>`:""}
   ${c._roadRemain?`<div style="font-size:11px;font-weight:700;color:${c._roadRemain.lv==="ok"?"#2E7D5B":c._roadRemain.lv==="warn"?"#C77F1A":"#B0433A"}">道路${c._roadRemain.ri+1}：残り幅 ${c._roadRemain.remain}m</div>`:""}`;
  del=`delCO(${i})`;}
 else if(k.startsWith("an:")){const i=+k.slice(3),a=U.annot[i];if(!a){el.style.display="none";return;}
  title=a.type==="zone"?"範囲マーカー":"文字注記";
  body=`<label class="f"><span>色</span><select onchange="U.annot[${i}].color=this.value;rebuild();renderPanel()">${ANNOT_COLORS.map(c=>`<option value="${c.key}" ${a.color===c.key?"selected":""}>${c.label}</option>`).join("")}</select></label>`
   +(a.type==="zone"?`<div class="grid2">${rowSL("幅 m",posv(a.w,6),`(v)=>{U.annot[${i}].w=v;rebuildThrottled();}`,1,40,0.5)}${rowSL("奥行 m",posv(a.d,6),`(v)=>{U.annot[${i}].d=v;rebuildThrottled();}`,1,40,0.5)}</div>`
    :`<button class="btn" style="width:100%;margin:4px 0" onclick="editAnnotText(${i})">✎ 文字を編集：「${(a.text||"").slice(0,12)}」</button>${rowSL("文字サイズ m",posv(a.fsize,2.5),`(v)=>{U.annot[${i}].fsize=v;rebuildThrottled();}`,0.8,10,0.5)}`);
  del=`delAnnot(${i})`;}
 else if(k.startsWith("sub:")){const i=+k.slice(4),s=U.subsurface[i];if(!s){el.style.display="none";return;}
  title=((SUBSURFACE_TYPES[s.kind]||{}).label||"地下支障物");
  body=`<div class="grid2">${rowSL("幅 m",posv(s.w,3),`(v)=>{U.subsurface[${i}].w=v;rebuildThrottled();}`,0.5,20,0.5)}${rowSL("長さ m",posv(s.d,14),`(v)=>{U.subsurface[${i}].d=v;rebuildThrottled();}`,2,80,1)}</div>`;
  del=`delSub(${i})`;}
 else if(k.startsWith("rd:")||k.startsWith("rpt:")){const i=+(k.startsWith("rd:")?k.slice(3):k.slice(4).split(":")[0]),r=U.roads[i];if(!r){el.style.display="none";return;}
  title="道路 "+(i+1)+"（なぞった道路）";
  const rc=(U._roadClear||[]).find(x=>x.ri===i);
  body=(rc&&rc.n?`<div style="font-size:12px;font-weight:700;color:${rc.lv==="ok"?"#2E7D5B":rc.lv==="warn"?"#C77F1A":"#B0433A"};margin-bottom:4px">残り幅 ${rc.remain}m（車両${rc.n}台）</div>`:"")
   +`${rowSL("幅員 m",r.w,`(v)=>{U.roads[${i}].w=v;rebuildThrottled();}`,3,20,0.5)}${rowSL("回転 °（1度刻み・Ctrl+ドラッグも可）",numv(r.ry,0),`(v)=>{snapshot('rd.ry.${i}');U.roads[${i}].ry=v;rebuildThrottled();}`,0,359,1)}<div class="grid2">${rowSL("歩道 左 m",numv(r.walkL,0),`(v)=>{U.roads[${i}].walkL=v;rebuildThrottled();}`,0,6,0.5)}${rowSL("歩道 右 m",numv(r.walkR,0),`(v)=>{U.roads[${i}].walkR=v;rebuildThrottled();}`,0,6,0.5)}</div><div style="font-size:10.5px;color:var(--mut)">青い頂点をドラッグで修正。面をドラッグで全体移動。</div>`;
  del=`snapshot();U.roads.splice(${i},1);U.sel=null;rebuild();renderPanel()`;}
 else if(k.startsWith("blk:")||k.startsWith("bpt:")){const i=+(k.startsWith("blk:")?k.slice(4):k.slice(4).split(":")[0]),b=U.blocks[i];if(!b){el.style.display="none";return;}
  const isPoly=(b.shape==="poly"&&Array.isArray(b.poly));
  title=(b.label||"建物")+(isPoly?"（多角形）":"");
  body=`<div class="grid2"><label class="f"><span>開始階</span><input type="number" value="${b.f1}" oninput="SB(${b.id},'f1',this.value)"></label><label class="f"><span>終了階</span><input type="number" value="${b.f2}" oninput="SB(${b.id},'f2',this.value)"></label></div>`
   +(isPoly?"":`<div class="grid2"><label class="f"><span>間口 m</span><input type="number" step="0.1" value="${b.w}" oninput="SB(${b.id},'w',this.value)"></label><label class="f"><span>奥行 m</span><input type="number" step="0.1" value="${b.d}" oninput="SB(${b.id},'d',this.value)"></label></div>`)
   +rowSL("回転 °（1度刻み）",numv(b.ry,0),`(v)=>SB(${b.id},'ry',v)`,0,359,1);
  del=`delB(${b.id})`;}
 else if(k.startsWith("nb:")){const i=+k.slice(3),n=U.nbs[i];if(!n){el.style.display="none";return;}
  title="近隣建物";
  body=`<div class="grid3">${rowSL("幅",posv(n.w,8),`(v)=>SN(${i},'w',v)`,2,60,0.5)}${rowSL("奥行",posv(n.d,10),`(v)=>SN(${i},'d',v)`,2,60,0.5)}${rowSL("高さ",posv(n.h,10),`(v)=>SN(${i},'h',v)`,3,100,0.5)}</div>`;
  del=`delN(${i})`;}
 else if(k==="fence"||k.startsWith("fpt:")){
  title="仮囲い"+(U.tw.fenceShape==="poly"?`（任意形状・${(U.tw.fencePts||[]).length}頂点・${fencePerimeter().toFixed(0)}m）`:"（矩形）");
  body=rowSL("パネル高さ m",U.tw.fenceH,"(v)=>S('tw.fenceH',v)",2,8,0.5)+`<div class="grid2"><button class="btn" style="font-size:11px" onclick="U.tabGroup='3';U.tab='仮設';renderPanel()">詳細を開く</button><button class="btn" style="font-size:11px" onclick="startDraw('fence')">なぞり直す</button></div>`;}
 else if(k==="crane"){const cs=CRANE_SPECS[U.tw.craneModel]||{};
  title="タワークレーン";
  body=`<label class="f"><span>機種</span><select onchange="S('tw.craneModel',this.value)">${Object.keys(CRANE_SPECS).map(m=>`<option value="${m}" ${U.tw.craneModel===m?"selected":""}>${m}　作業半径${CRANE_SPECS[m].work}m／${CRANE_SPECS[m].cap}t</option>`).join("")}</select></label><div style="font-size:11px;color:var(--mut)">作業半径 ${cs.work||"-"}m・尾部旋回 ${cs.tail||"-"}m</div>`;}
 else if(k==="under"){
  title="下地（PDF・地理院地図）";
  body=`<div class="under-control-note"><b>ドラッグ＝移動</b><span>Ctrl＋ドラッグ＝回転</span></div>
   ${rowSL("回転 °",numv(U.under.rot,0),"(v)=>{snapshot('under.rot');U.under.rot=v;rebuildThrottled();}",0,359,1)}
   ${rowSL("透過度",numv(U.under.opacity,.65),"(v)=>{U.under.opacity=v;rebuildThrottled();}",.1,1,.05)}
   <button class="btn btn-secondary" style="width:100%" onclick="view('top')">真上（配置）で見る</button>`;}
 else if(k==="photo"){
  title="周辺写真";
  body=`<div class="under-control-note"><b>ドラッグ＝移動</b><span>Ctrl＋ドラッグ＝回転</span></div>
   ${rowSL("回転 °",numv(U.photo.rot,0),"(v)=>{snapshot('photo.rot');U.photo.rot=v;rebuildThrottled();}",0,359,1)}
   ${rowSL("透過度",numv(U.photo.opacity,.8),"(v)=>{U.photo.opacity=v;rebuildThrottled();}",.1,1,.05)}`;}
 else if(k==="site"||k.startsWith("spt:")){
  title="敷地"+(Array.isArray(U.site.poly)?`（多角形・${U.site.poly.length}頂点・${siteArea().toFixed(0)}㎡）`:`（${posv(U.site.w,25)}×${posv(U.site.d,20)}m）`);
  body=Array.isArray(U.site.poly)?`<div style="font-size:10.5px;color:var(--mut)">青い頂点をドラッグで修正。辺の長さを表示中。</div>`:`<div class="grid2">${rowSL("間口 m",U.site.w,"(v)=>S('site.w',v)",5,120,0.5)}${rowSL("奥行 m",U.site.d,"(v)=>S('site.d',v)",5,120,0.5)}</div>`;}
 else {el.style.display="none";return;}
 if(U._layersOpen){U._layersOpen=false;const ly=document.getElementById("layers");if(ly)ly.style.display="none";}
 el.style.display="";
 const dupOK=/^(co:|an:|sub:|nb:|rd:|rpt:|blk:|bpt:)/.test(k);
 el.innerHTML=`<div class="sc-h"><div class="sc-title"><small>OBJECT SELECTED</small><span>${title}</span></div><span class="sc-x" onclick="clearSelection({restore:true})">✕</span></div><div class="sc-b">${body}<div class="sc-actions">${dupOK?`<button class="btn btn-secondary" onclick="duplicateSel()">複製</button>`:""}${del?`<button class="btn btn-danger" onclick="${del}">削除</button>`:""}</div><div class="hint">Delete＝削除　Ctrl+D＝複製　Esc＝選択解除　↶で戻せます</div></div>`;
}
window.renderSelCard=renderSelCard;
// 選択中の物を複製（少しずらして配置）／削除
window.duplicateSel=()=>{const k=U.sel;if(!k)return;snapshot();const cp=(o)=>JSON.parse(JSON.stringify(o));
 if(k.startsWith("co:")){const c=U.cobj[+k.slice(3)];if(!c)return;const d=cp(c);delete d._warn;delete d._roadRemain;d.x=numv(d.x,0)+2;d.z=numv(d.z,0)+2;U.cobj.push(d);U.sel="co:"+(U.cobj.length-1);}
 else if(k.startsWith("an:")){const a=U.annot[+k.slice(3)];if(!a)return;const d=cp(a);d.x=numv(d.x,0)+2;d.z=numv(d.z,0)+2;U.annot.push(d);U.sel="an:"+(U.annot.length-1);}
 else if(k.startsWith("sub:")){const s=U.subsurface[+k.slice(4)];if(!s)return;const d=cp(s);d.x=numv(d.x,0)+2;d.z=numv(d.z,0)+2;U.subsurface.push(d);U.sel="sub:"+(U.subsurface.length-1);}
 else if(k.startsWith("nb:")){const nb=U.nbs[+k.slice(3)];if(!nb)return;const d=cp(nb);d.x=numv(d.x,0)+3;d.z=numv(d.z,0)+3;U.nbs.push(d);U.sel="nb:"+(U.nbs.length-1);}
 else if(k.startsWith("rd:")||k.startsWith("rpt:")){const i=+(k.startsWith("rd:")?k.slice(3):k.slice(4).split(":")[0]);const r=U.roads[i];if(!r)return;const d=cp(r);d.dx=numv(d.dx,0)+3;d.dz=numv(d.dz,0)+3;U.roads.push(d);U.sel="rd:"+(U.roads.length-1);}
 else if(k.startsWith("blk:")||k.startsWith("bpt:")){const i=+(k.startsWith("blk:")?k.slice(4):k.slice(4).split(":")[0]);const b=U.blocks[i];if(!b)return;const d=cp(b);d.id=Math.max(0,...U.blocks.map(x=>+x.id||0))+1;d.dx=numv(d.dx,0)+3;d.dz=numv(d.dz,0)+3;d.label=(b.label||"建物")+" コピー";U.blocks.push(d);U.sel="blk:"+(U.blocks.length-1);}
 else{toast("この物は複製できません");return;}
 rebuild();renderPanel();toast("複製しました（2〜3mずらして配置）","ok");};
window.deleteSel=()=>{const k=U.sel;if(!k)return;snapshot();
 if(k==="ev"){U.tw.ev=false;}
 else if(k==="crane"){U.tw.crane=false;}
 else if(k.startsWith("co:"))U.cobj.splice(+k.slice(3),1);
 else if(k.startsWith("an:"))U.annot.splice(+k.slice(3),1);
 else if(k.startsWith("sub:"))U.subsurface.splice(+k.slice(4),1);
 else if(k.startsWith("nb:"))U.nbs.splice(+k.slice(3),1);
 else if(k.startsWith("rd:")||k.startsWith("rpt:"))U.roads.splice(+(k.startsWith("rd:")?k.slice(3):k.slice(4).split(":")[0]),1);
 else if(k.startsWith("blk:")||k.startsWith("bpt:")){const i=+(k.startsWith("blk:")?k.slice(4):k.slice(4).split(":")[0]);U.blocks.splice(i,1);}
 else{toast("この物はここから削除できません");return;}
 U.sel=null;_selCamBase=null;_selCamKey=null;rebuild();renderPanel();toast("削除しました（↶で戻せます）");};

// ───── スマホ簡易モード（見る→回す→工程→判定→検討シート）：表示の差し替えのみ ─────
//  条件：タッチ端末 かつ 画面幅 ≤ 820px。localStorage bimgen_ui="full" で PC版UIに固定可
function isTouchPhone(){return matchMedia("(pointer:coarse)").matches&&Math.min(innerWidth,innerHeight)<=820&&innerWidth<=820;}
function simplePreferred(){ try{localStorage.removeItem("bimgen_ui");}catch(e){} return isTouchPhone(); }   // 起動時は毎回「簡易」
window.setSimpleUI=(on)=>{
 document.body.classList.toggle("simple",!!on);
 document.body.classList.toggle("touch-full",!on&&isTouchPhone());
 if(on){U._mEdit=false;}
 closeSheet(); renderMobile(); renderBar(); renderPill(); setTimeout(resize,60);
 if(!on)toast("詳細編集（PC版UI）です。右上パネルは整理し、左の編集パネルを優先表示します");
};
// 詳細版のときスマホ画面に常時出す「簡易表示へ戻る」ピル
function renderPill(){
 let p=document.getElementById("mpill");
 if(!p){p=document.createElement("button");p.id="mpill";p.className="btn";p.textContent="簡易表示へ戻る";p.onclick=()=>setSimpleUI(true);document.body.appendChild(p);}
 p.style.display=(isTouchPhone()&&!document.body.classList.contains("simple")&&!document.body.classList.contains("present"))?"":"none";
}
window.renderPill=renderPill;
// 閲覧／編集モード（簡易モードのみ有効。起動時は閲覧）
window.toggleEditMode=(v)=>{U._mEdit=(v==null)?!U._mEdit:!!v;if(!U._mEdit){U.sel=null;renderSelCard();}renderMobile();toast(U._mEdit?"✏ 編集モード：物をドラッグで移動、Ctrl／2本指なしでも回転はシートから":"🔒 閲覧モード：ドラッグは視点回転だけ");};
// 画面表示のリセット（視点・ズーム・シート・選択・道具バー位置。iOSの自動ズームも解除）
window.resetDisplay=()=>{
 closeSheet(); U.sel=null; U.polyInput={on:false,pts:[],target:null}; U.calib={on:false,a:null,b:null}; if(U.under)U.under._crop=null;
 if(typeof toolsReset==="function")toolsReset();
 ctrl.theta=Math.PI/4+.3; ctrl.phi=1.05; ctrl.ty=18; U.auto=false; view("bird");
 try{const m=document.querySelector('meta[name="viewport"]');if(m){const c=m.getAttribute("content");m.setAttribute("content",c+", maximum-scale=1.0");setTimeout(()=>m.setAttribute("content",c),350);}}catch(e){}
 rebuild(); renderPanel(); renderBar(); renderMobile(); toast("画面表示を初期状態に戻しました","ok");
};
let _sheet=null,_lastSheet=null,_dock=null;
function closeSheet(){if(_sheet&&_sheet!=="obj")_lastSheet=_sheet;_sheet=null;const s=document.getElementById("msheet");if(s)s.classList.remove("open");const b=document.getElementById("mback");if(b)b.classList.remove("open");renderMobile();}
window.closeSheet=closeSheet;
function closeMobileDock(){_dock=null;document.body.classList.remove("dock-open");const d=document.getElementById("mdock");if(d)d.classList.remove("open");renderMobile();}
window.closeMobileDock=closeMobileDock;
window.openMobileDock=(k,force)=>{
 if(!k)return;
 if(!force&&_dock===k){closeMobileDock();return;}
 if(_sheet){_sheet=null;const s=document.getElementById("msheet");if(s)s.classList.remove("open");const b=document.getElementById("mback");if(b)b.classList.remove("open");}
 _dock=k;U._mEdit=true;document.body.classList.add("dock-open");renderMobile();
};
window.openSheet=(k)=>{
 if(!k)return;
 if(k==="phase"||k==="temp"||k==="view"){openMobileDock(k);return;}
 if(_sheet===k){closeSheet();return;}
 _dock=null;document.body.classList.remove("dock-open");
 const d=document.getElementById("mdock");if(d)d.classList.remove("open");
 _sheet=k;if(k!=="obj")_lastSheet=k;U._mEdit=true;renderMobile();
};
// 仮設シート用：指定タイプの車両を1台だけON/OFF、移動・回転
function _cobjIdx(type){let last=-1;(U.cobj||[]).forEach((c,i)=>{if(c.type===type&&cobjVisibleInPhase(c,U.tw.mode))last=i;});return last;}
window.mToggleCO=(type,size)=>{const i=_cobjIdx(type);if(i>=0){snapshot();U.cobj.splice(i,1);U.sel=null;_selCamBase=null;_selCamKey=null;rebuild();renderPanel();}else{addCO(type);const k=U.cobj.length-1;if(size&&U.cobj[k]){const sz=cobjSize(type,size);if(sz){U.cobj[k].size=size;U.cobj[k].w=sz.w;U.cobj[k].d=sz.d;U.cobj[k].h=sz.h;}}rebuild();}renderMobile();};
window.mDockSelectCO=(type,size)=>{
 let i=_cobjIdx(type);
 if(i<0){
  addCO(type);i=U.cobj.length-1;
  if(size&&U.cobj[i]){const sz=cobjSize(type,size);if(sz){U.cobj[i].size=size;U.cobj[i].w=sz.w;U.cobj[i].d=sz.d;U.cobj[i].h=sz.h;}}
 }
 if(i>=0){U.sel="co:"+i;U._mEdit=true;rebuild();focusSelectionCamera("co:"+i,{duration:240});renderPanel();renderMobile();}
};
window.mDockPowerCO=(type,size)=>{
 const i=_cobjIdx(type);
 if(i>=0){snapshot();U.cobj.splice(i,1);const sk=String(U.sel||"");if(sk==="co:"+i)U.sel=null;else if(sk.startsWith("co:")){const si=+sk.slice(3);if(si>i)U.sel="co:"+(si-1);}_selCamBase=null;_selCamKey=null;rebuild();renderPanel();renderMobile();return;}
 mDockSelectCO(type,size);
};
window.mDockCrane=(power)=>{
 if(power===false){if(U.tw.crane){S("tw.crane",false);}if(U.sel==="crane")U.sel=null;renderMobile();return;}
 if(!U.tw.crane)S("tw.crane",true);
 U.sel="crane";U._mEdit=true;rebuild();focusSelectionCamera("crane",{duration:240});renderPanel();renderMobile();
};
window.mDockFence=(power)=>{
 if(power===false){if(U.tw.fence)S("tw.fence",false);if(String(U.sel||"").startsWith("fence")||String(U.sel||"").startsWith("fpt:"))U.sel=null;renderMobile();return;}
 if(!U.tw.fence)S("tw.fence",true);
 U.sel="fence";U._mEdit=true;rebuild();renderPanel();renderMobile();
};
window.mDockEV=(power)=>{
 if(power===false){if(U.tw.ev)S("tw.ev",false);if(U.sel==="ev")U.sel=null;renderMobile();return;}
 if(!U.tw.ev)S("tw.ev",true);
 U.sel="ev";U._mEdit=true;rebuild();focusSelectionCamera("ev",{duration:240});renderPanel();renderMobile();
};
window.mDockScaffold=()=>{S("tw.scaffold",!U.tw.scaffold);renderMobile();};
window.mDockAddTower=()=>{addTowerCrane("JCL015");U._mEdit=true;renderMobile();};
window.mDockAddSafety=()=>{addCO("safepath");const i=U.cobj.length-1;U._mEdit=true;if(i>=0){U.sel="co:"+i;focusSelectionCamera(U.sel,{duration:220});}renderMobile();};

window.mMoveCO=(type,dx,dz)=>{const i=_cobjIdx(type);if(i<0)return;snapshot("mco."+type);U.cobj[i].x=+(numv(U.cobj[i].x,0)+dx).toFixed(1);U.cobj[i].z=+(numv(U.cobj[i].z,0)+dz).toFixed(1);U.sel="co:"+i;rebuildThrottled();};
window.mRotCO=(type,d)=>{const i=_cobjIdx(type);if(i<0)return;snapshot("mcor."+type);U.cobj[i].ry=((numv(U.cobj[i].ry,0)+d)%360+360)%360;U.sel="co:"+i;rebuildThrottled();};
window.mCrane=(k,d)=>{snapshot("mcrane."+k);if(k==="x")U.tw.craneX=+(numv(U.tw.craneX,16)+d).toFixed(1);if(k==="z")U.tw.craneZ=+(numv(U.tw.craneZ,0)+d).toFixed(1);if(k==="r")U.tw.craneRot=((numv(U.tw.craneRot,0)+d)%360+360)%360;rebuildThrottled();};
// かんたん案件作成（スマホ）
window.quickCreate=()=>{
 const g=(id)=>document.getElementById(id);const v=(id,fb)=>{const e=g(id);const n=parseFloat(e&&e.value);return isFinite(n)&&n>0?n:fb;};
 const name=(g("qc-name")&&g("qc-name").value.trim())||"新規案件（かんたん作成）";
 const use=(g("qc-use")&&g("qc-use").value)||"共同住宅（賃貸）", st=(g("qc-struct")&&g("qc-struct").value)||"RC";
 const fl=Math.round(v("qc-floors",5)), bw=v("qc-bw",12), bd=v("qc-bd",10), sw=v("qc-sw",18), sd=v("qc-sd",16), rw=v("qc-rw",6);
 resetToDefault();
 U.p.name=name;U.p.use=use;U.p.struct=st;U.p.floors=fl;U.p.height=+(fl*(st==="S"?3.6:3.1)).toFixed(1);U.p.tArea=+(bw*bd*fl*0.95).toFixed(0);
 U.site.w=sw;U.site.d=sd;U.road.w=rw;U.road.show=true;U.road.walkShow=false;U.tw.person=false;U.tw.poles=false;
 U.blocks=[{id:1,label:"建物",f1:1,f2:fl,w:bw,d:bd,dx:0,dz:0,ry:0}];
 U.tw.mode="build";U.tw.step=Math.max(1,Math.round(fl*0.6));U.tw.fence=true;U.tw.fenceShape="rect";U.tw.crane=true;U.tw.craneX=Math.round(bw/2+4);U.tw.craneZ=0;U.tw.scaffold=true;
 U.cobj=[];U._mEdit=true;
 closeStart();rebuild();renderPanel();renderBar();view("bird",{intro:true,duration:820});openMobileDock("temp",true);
 toast("3Dを作りました。下の仮設ドックからクレーンや車両を置いてみてください","ok");
};
function _selInfo(){const k=U.sel;if(!k)return null;
 if(k.startsWith("co:")){const c=U.cobj[+k.slice(3)];if(!c)return null;const t=COBJ_TYPES[c.type]||{};return {kind:"co",i:+k.slice(3),label:t.label||c.type,sizes:t.sizes||[],cur:c.size};}
 if(k==="crane")return {kind:"crane",label:"タワークレーン"};
 if(k==="ev")return {kind:"ev",label:"ロングスパンEV"};
 if(k==="fence"||k.startsWith("fpt:"))return {kind:"fence",label:"仮囲い"};
 if(k.startsWith("blk:"))return {kind:"blk",i:+k.slice(4),label:(U.blocks[+k.slice(4)]||{}).label||"建物"};
 if(k.startsWith("an:"))return {kind:"an",i:+k.slice(3),label:"注記"};
 if(k.startsWith("nb:"))return {kind:"nb",i:+k.slice(3),label:"近隣建物"};
 if(k.startsWith("rd:"))return {kind:"rd",i:+k.slice(3),label:"道路"};
 return {kind:"other",label:"選択中"};}
window.mSelMove=(dx,dz)=>{const s=_selInfo();if(!s)return;snapshot("msel");
 if(s.kind==="co"){const c=U.cobj[s.i];c.x=+(numv(c.x,0)+dx).toFixed(1);c.z=+(numv(c.z,0)+dz).toFixed(1);}
 else if(s.kind==="crane"){U.tw.craneX=+(numv(U.tw.craneX,16)+dx).toFixed(1);U.tw.craneZ=+(numv(U.tw.craneZ,0)+dz).toFixed(1);}
 else if(s.kind==="ev"){U.tw.evX=+(numv(U.tw.evX,-6)+dx).toFixed(1);U.tw.evZ=+(numv(U.tw.evZ,0)+dz).toFixed(1);}
 else if(s.kind==="fence"){U.tw.fenceDx=+(numv(U.tw.fenceDx,0)+dx).toFixed(1);U.tw.fenceDz=+(numv(U.tw.fenceDz,0)+dz).toFixed(1);}
 else if(s.kind==="blk"){const b=U.blocks[s.i];b.dx=+(numv(b.dx,0)+dx).toFixed(1);b.dz=+(numv(b.dz,0)+dz).toFixed(1);}
 else if(s.kind==="an"){const a=U.annot[s.i];a.x=+(numv(a.x,0)+dx).toFixed(1);a.z=+(numv(a.z,0)+dz).toFixed(1);}
 else if(s.kind==="nb"){const n=U.nbs[s.i];n.x=+(numv(n.x,0)+dx).toFixed(1);n.z=+(numv(n.z,0)+dz).toFixed(1);}
 else if(s.kind==="rd"){const r=U.roads[s.i];r.dx=+(numv(r.dx,0)+dx).toFixed(1);r.dz=+(numv(r.dz,0)+dz).toFixed(1);}
 rebuildThrottled();};
window.mSelRot=(d)=>{const k=U.sel;if(!k)return;if(!objRyKey(k)){toast("この物は回転できません");return;}snapshot("mselr");setRy(k,((getRy(k)+d)%360+360)%360);rebuildThrottled();};
window.mSelSize=(key)=>{const s=_selInfo();if(!s||s.kind!=="co")return;setCOSize(s.i,key);renderMobile();};
window.mSelType=(type)=>{const s=_selInfo();if(!s||s.kind!=="co")return;snapshot();const c=U.cobj[s.i];const t=COBJ_TYPES[type];if(!t)return;const sz=t.sizes[0];c.type=type;c.size=sz.key;c.w=sz.w;c.d=sz.d;c.h=sz.h;rebuild();renderPanel();renderMobile();};
window.openObjMenu=(key)=>{U.sel=key;_sheet="obj";rebuild();focusSelectionCamera(key,{duration:260});renderPanel();renderMobile();};
function renderMobile(){
 const on=document.body.classList.contains("simple");
 let top=document.getElementById("mtop"),bar=document.getElementById("mbar"),sheet=document.getElementById("msheet"),back=document.getElementById("mback"),dock=document.getElementById("mdock");
 if(!top){top=document.createElement("div");top.id="mtop";document.body.appendChild(top);}
 if(!bar){bar=document.createElement("div");bar.id="mbar";document.body.appendChild(bar);}
 if(!dock){dock=document.createElement("div");dock.id="mdock";document.body.appendChild(dock);}
 if(!back){back=document.createElement("div");back.id="mback";back.onclick=closeSheet;document.body.appendChild(back);}
 if(!sheet){sheet=document.createElement("div");sheet.id="msheet";document.body.appendChild(sheet);
  // 下スワイプで閉じる
  let y0=null;sheet.addEventListener("touchstart",(e)=>{y0=e.touches[0].clientY;},{passive:true});
  sheet.addEventListener("touchend",(e)=>{if(y0==null)return;const dy=e.changedTouches[0].clientY-y0;y0=null;if(dy>60&&sheet.scrollTop<=0)closeSheet();},{passive:true});}
 renderPill();
 if(!on){top.style.display="none";bar.style.display="none";dock.classList.remove("open");sheet.classList.remove("open");back.classList.remove("open");document.body.classList.remove("dock-open");return;}
 top.style.display="";bar.style.display="";
 const cs=(typeof collectChecks==="function")?collectChecks():[];const nNg=cs.filter(c=>c.lv==="ng").length,nW=cs.filter(c=>c.lv==="warn").length;
 const badge=nNg?`<button class="mb ng" onclick="openSheet('check')">要検討 ${nNg}${nW?"・注意 "+nW:""}</button>`:(nW?`<button class="mb warn" onclick="openSheet('check')">注意 ${nW}</button>`:`<button class="mb ok" onclick="openSheet('check')">判定OK</button>`);
 const PH={demo:"既存解体",retain:"山留め・掘削",pile:"杭工事",steel:"鉄骨建て方",build:"躯体・仮設",plan:"完成"};
 const si=_selInfo();
 const mode=`<span class="mmode ${si?"edit":""}" title="物はタップで選択。選択中だけ操作できます"><small>${si?"EDIT MODE":"VIEW MODE"}</small>${si?si.label:"LOCKED"}</span>`;
 top.innerHTML=`<button class="mt-btn" onclick="openStart()" title="案件を開く">≡</button><div class="mt-title"><b>${(U.p.name||"BimGen").slice(0,20)}</b><span>${PH[U.tw.mode]||""}</span></div>${mode}${badge}`;
 const tabs=[["phase","工程","01"],["temp","仮設","02"],["view","表示","03"],["edit","編集","04"]];
 bar.innerHTML=tabs.map(t=>`<button class="mbtn ${((_dock===t[0])||(_sheet===t[0]))?"on":""}" onclick="${t[0]==="edit"?"openSheet('edit')":"openMobileDock('"+t[0]+"')"}"><span>${t[2]}</span>${t[1]}</button>`).join("");
 let ab=document.getElementById("mact");if(!ab){ab=document.createElement("div");ab.id="mact";document.body.appendChild(ab);}
 if(si&&!_sheet){
  ab.style.display="flex";
  const detailKey=(si.kind==="crane")?U.tw.craneModel:(si.kind==="co"&&U.cobj[si.i]?((U.cobj[si.i].type||"")+"|"+(U.cobj[si.i].size||"")):si.kind);
  const controlKey=String(U.sel||"")+"|"+detailKey;
  if(ab.dataset.controlKey!==controlKey){
   ab.dataset.controlKey=controlKey;
   const sub=(si.kind==="crane")?(U.tw.craneModel+" · R "+((CRANE_SPECS[U.tw.craneModel]||{}).work||"-")+"m"):(si.kind==="co"&&U.cobj[si.i]?((COBJ_TYPES[U.cobj[si.i].type]||{}).label||"OBJECT"):"MOVE / ROTATE");
   ab.innerHTML=`<div class="oc-shell">
    <div class="oc-head"><div><span>OBJECT CONTROL</span><b>${si.label}</b><small>${sub}</small></div><button class="oc-close" onclick="clearSelection({restore:true})" aria-label="操作を終了">×</button></div>
    <div class="oc-body">
     <div class="oc-dpad">
      <button class="oc-key oc-up" onclick="mSelMove(0,-1);v4Nudge('Z −1.0m')" aria-label="上へ">↑</button>
      <button class="oc-key oc-left" onclick="mSelMove(-1,0);v4Nudge('X −1.0m')" aria-label="左へ">←</button>
      <span class="oc-core">MOVE<small>1.0m</small></span>
      <button class="oc-key oc-right" onclick="mSelMove(1,0);v4Nudge('X +1.0m')" aria-label="右へ">→</button>
      <button class="oc-key oc-down" onclick="mSelMove(0,1);v4Nudge('Z +1.0m')" aria-label="下へ">↓</button>
     </div>
     <div class="oc-side">
      <button class="oc-rot" onclick="mSelRot(-15);v4Nudge('ROT −15°')">↺<small>−15°</small></button>
      <button class="oc-rot" onclick="mSelRot(15);v4Nudge('ROT +15°')">↻<small>+15°</small></button>
      <button class="oc-detail" onclick="openObjMenu(U.sel)">DETAIL</button>
     </div>
    </div>
   </div>`;
  }
 }
 else {ab.style.display="none";ab.dataset.controlKey="";}
 let pk=document.getElementById("mpeek");if(!pk){pk=document.createElement("button");pk.id="mpeek";document.body.appendChild(pk);
  let py=null;pk.addEventListener("touchstart",(e)=>{py=e.touches[0].clientY;},{passive:true});pk.addEventListener("touchend",(e)=>{if(py!=null&&py-e.changedTouches[0].clientY>20){openSheet(_lastSheet);}py=null;},{passive:true});
  pk.onclick=()=>openSheet(_lastSheet);}
 const NAMES={edit:"編集",check:"判定",obj:"選択中の物",layers:"レイヤー",catalog:"配置"};
 if(!_sheet&&_lastSheet&&!si&&NAMES[_lastSheet]){pk.style.display="";pk.textContent="▲ "+NAMES[_lastSheet]+" を再表示";}else pk.style.display="none";

 // 3Dを見ながら使う工程・仮設・表示は、大きなシートではなくフローティングドックに描画
 if(_dock){
  document.body.classList.add("dock-open");
  dock.dataset.dock=_dock;
  let dh="";
  if(_dock==="phase"){
   const ps=[["demo","01","解体"],["retain","02","山留"],["pile","03","杭"],["steel","04","鉄骨"],["build","05","躯体"],["plan","06","完成"]];
   dh=`<div class="md-head"><span>PHASE</span><b>工程を切り替える</b><button onclick="closeMobileDock()">×</button></div>
    <div class="md-scroll">${ps.map(([k,n,l])=>`<button class="md-cmd ${U.tw.mode===k?"on":""}" onclick="setMode('${k}');renderMobile()"><small>${n}</small><b>${l}</b></button>`).join("")}
    ${(U.tw.mode==="build"||U.tw.mode==="steel")?`<div class="md-step"><small>STEP</small><button onclick="S('tw.step',Math.max(1,Math.round(numv(U.tw.step,1))-1));renderMobile()">−</button><b>${Math.min(Math.round(posv(U.p.floors,1)),Math.round(numv(U.tw.step,1)))}F</b><button onclick="S('tw.step',Math.min(Math.round(posv(U.p.floors,1)),Math.round(numv(U.tw.step,1))+1));renderMobile()">＋</button></div>`:""}</div>`;
  }else if(_dock==="temp"){
   if(U.tw.mode==="plan"){
    dh=`<div class="md-head"><span>TEMPORARY WORKS</span><b>完成フェーズ</b><button onclick="closeMobileDock()">×</button></div><div class="md-complete"><b>仮設物は完成時に自動で外れます</b><span>クレーン・足場・重機・安全通路を編集する場合は施工工程へ戻ります。</span><button onclick="setMode('build')">05 躯体・仮設へ戻る</button></div>`;
   }else{
   const item=(key,label,sub,on,main,power)=>`<div class="md-item ${on?"on":""}"><button class="md-main" onclick="${main}"><small>${key}</small><b>${label}</b><span>${sub}</span></button><button class="md-power ${on?"on":""}" onclick="event.stopPropagation();${power}" aria-label="${label}を${on?"OFF":"ON"}">${on?"●":"○"}</button></div>`;
   dh=`<div class="md-head"><span>TEMPORARY WORKS</span><b>工程の基本仮設</b><button onclick="closeMobileDock()">×</button></div>
    <div class="md-scroll">
     ${item("TC","クレーン",U.tw.crane?(U.tw.craneModel||"ON"):"OFF",!!U.tw.crane,"mDockCrane()","mDockCrane("+(!U.tw.crane)+")")}
     ${item("FN","仮囲い",U.tw.fence?"ON":"OFF",!!U.tw.fence,"mDockFence()","mDockFence("+(!U.tw.fence)+")")}
     ${item("SC","足場",U.tw.scaffold?"ON":"OFF",!!U.tw.scaffold,"mDockScaffold()","mDockScaffold()")}
     <div class="md-item add"><button class="md-main" onclick="openSheet('catalog')"><small>ADD</small><b>配置する</b><span>重機・車両・仮設物</span></button></div>
    </div>`;
   }
  }else if(_dock==="view"){
   const vb=(key,label,fn,on)=>`<button class="md-cmd ${on?"on":""}" onclick="${fn}"><small>${key}</small><b>${label}</b></button>`;
   dh=`<div class="md-head"><span>VIEW CONTROL</span><b>視点・表示</b><button onclick="closeMobileDock()">×</button></div>
    <div class="md-scroll">
     ${vb("BIRD","鳥瞰","view('bird')",false)}
     ${vb("FRONT","正面","view('front')",false)}
     ${vb("EYE","目線","view('eye')",false)}
     ${vb("TOP","真上","view('top')",false)}
     ${vb("AUTO",U.auto?"回転停止":"自動回転","U.auto=!U.auto;renderBar();renderMobile()",!!U.auto)}
     ${vb("LAYER","レイヤー","openSheet('layers')",false)}
     ${vb("RESET","リセット","resetDisplay()",false)}
     ${vb("FULL","全画面","closeMobileDock();togglePresent()",false)}
    </div>`;
  }
  dock.innerHTML=dh;dock.classList.add("open");
 }else{
  dock.classList.remove("open");document.body.classList.remove("dock-open");
 }

 sheet.dataset.sheet=_sheet||"";
 if(!_sheet){sheet.classList.remove("open");back.classList.remove("open");return;}
 let h="",title="";
 if(_sheet==="phase"){title="工程フェーズ";
  const PHASES=[["demo","既存解体"],["retain","山留め・掘削"],["pile","杭工事"],["steel","鉄骨建て方"],["build","躯体・仮設"],["plan","完成"]];
  h=`<div class="ms-grid">${PHASES.map(([k,l])=>`<button class="ms-btn ${U.tw.mode===k?"on":""}" onclick="setMode('${k}');closeSheet();renderMobile()">${l}</button>`).join("")}</div>
   ${(U.tw.mode==="build"||U.tw.mode==="steel")?`<div class="ms-h">進捗（〜階）</div><div class="ms-row"><button class="ms-btn" onclick="S('tw.step',Math.max(1,Math.round(numv(U.tw.step,1))-1));renderMobile()">−</button><div class="ms-val">${Math.min(Math.round(posv(U.p.floors,1)),Math.round(numv(U.tw.step,1)))} 階</div><button class="ms-btn" onclick="S('tw.step',Math.min(Math.round(posv(U.p.floors,1)),Math.round(numv(U.tw.step,1))+1));renderMobile()">＋</button></div>`:""}
   <div class="ms-note">工程を変えると、山留め・杭・鉄骨・躯体・完成の状態に3Dが切り替わります。</div>`;
 }else if(_sheet==="temp"){title="仮設を触る";
  const has=(t)=>_cobjIdx(t)>=0; const cr=U.tw.crane;
  const ctl=(t)=>has(t)?`<button class="ms-sq ms-w" onclick="U.sel='co:'+_cobjIdx('${t}');closeSheet();rebuild()">選択</button>`:``;
  const row=(label,on,fn,ctrl)=>`<div class="ms-line"><button class="ms-tg ${on?"on":""}" onclick="${fn}">${label}</button>${ctrl}</div>`;
  h=`<div class="ms-note" style="margin:0 0 4px">ONで置く → 「選択」か3D上でタップ → ドラッグで移動。下の操作バーで回転、長押しで種類・削除。</div>
   ${row("クレーン",cr,`S('tw.crane',${!cr});renderMobile()`,cr?`<button class="ms-sq ms-w" onclick="U.sel='crane';closeSheet();rebuild()">選択</button>`:``)}
   ${cr?`<div class="ms-line"><select class="ms-sel" onchange="S('tw.craneModel',this.value)">${Object.keys(CRANE_SPECS).map(m=>`<option value="${m}" ${U.tw.craneModel===m?"selected":""}>${m}（作業半径${CRANE_SPECS[m].work}m・${CRANE_SPECS[m].cap}t）</option>`).join("")}</select></div>`:""}
   ${row("仮囲い",U.tw.fence,`S('tw.fence',${!U.tw.fence});renderMobile()`,``)}
   ${row("足場",U.tw.scaffold,`S('tw.scaffold',${!U.tw.scaffold});renderMobile()`,``)}
   ${row("生コン車",has("mixer"),"mToggleCO('mixer','8t')",ctl("mixer"))}
   ${row("ポンプ車",has("pump"),"mToggleCO('pump','m4t')",ctl("pump"))}
   ${row("LSEV",has("lsev")||!!U.tw.ev,(U.tw.ev?`S('tw.ev',false);renderMobile()`:(has("lsev")?"mToggleCO('lsev','h32')":`S('tw.ev',true);renderMobile()`)),U.tw.ev?`<button class="ms-sq ms-w" onclick="U.sel='ev';closeSheet();rebuild()">選択</button>`:ctl("lsev"))}
   ${row("ラフター",has("rough"),"mToggleCO('rough','25t')",ctl("rough"))}`;
 }else if(_sheet==="view"){title="表示";
  h=`<div class="ms-h">視点</div><div class="ms-grid">${[["bird","鳥瞰"],["front","正面"],["eye","目線"],["top","真上"]].map(([k,l])=>`<button class="ms-btn" onclick="view('${k}');closeSheet()">${l}</button>`).join("")}</div>
   <div class="ms-row"><button class="ms-btn" onclick="U.auto=!U.auto;renderBar();renderMobile()">${U.auto?"自動回転 停止":"自動回転"}</button><button class="ms-btn" onclick="closeSheet();togglePresent()">全画面</button></div>
   <div class="ms-row"><button class="ms-btn primary" onclick="resetDisplay()">画面表示をリセット</button></div>
   <div class="ms-h">表示するもの</div><div class="ms-list">${LAYER_DEF.map(d=>`<label class="ms-chk"><input type="checkbox" ${(U.layers||{})[d[0]]!==false?"checked":""} onchange="toggleLayer('${d[0]}',this.checked);renderMobile()"><span>${d[1]}</span></label>`).join("")}</div>`;
 }else if(_sheet==="catalog"){title="配置・重機";
  const CATS=[
   ["重機",["towercrane","rough","backhoe","found"]],
   ["車両",["mixer","pump","truck"]],
   ["仮設",["safepath","stage","lsev","komalift","temp"]],
   ["安全",["guard","walkzone","obstacle"]]
  ];
  h=`<div class="ms-note">ここから追加 → 3D上で選択 → OBJECT CONTROLで移動・回転。工程ごとに配置物は分かれます。</div>`
   +CATS.map(([n,ks])=>`<div class="ms-h">${n}</div><div class="ms-catalog">${ks.map(k=>`<button onclick="addCO('${k}');closeSheet();renderMobile()"><b>＋ ${COBJ_TYPES[k].label}</b><small>${COBJ_TYPES[k].sizes[0].label||""}</small></button>`).join("")}</div>`).join("");
 }else if(_sheet==="layers"){title="レイヤー・編集";
  h=`<div class="ms-h">表示プリセット</div><div class="ms-grid"><button class="ms-btn" onclick="setLayerPreset('all');renderMobile()">全部</button><button class="ms-btn" onclick="setLayerPreset('model');renderMobile()">建物</button><button class="ms-btn" onclick="setLayerPreset('temp');renderMobile()">施工計画</button><button class="ms-btn" onclick="setLayerPreset('context');renderMobile()">周辺条件</button></div>
   <div class="ms-h">動かせる物</div><div class="ms-row"><button class="ms-btn ${UI_PREF.editScope==="all"?"on":""}" onclick="setEditScope('all');renderMobile()">すべて</button><button class="ms-btn ${UI_PREF.editScope==="temp"?"on":""}" onclick="setEditScope('temp');renderMobile()">仮設物だけ</button></div>
   <div class="ms-h">個別表示</div><div class="ms-list">${LAYER_DEF.map(d=>`<label class="ms-chk"><input type="checkbox" ${(U.layers||{})[d[0]]!==false?"checked":""} onchange="toggleLayer('${d[0]}',this.checked);renderMobile()"><span>${d[1]}</span></label>`).join("")}</div>`;
 }else if(_sheet==="check"){title="検討判定";
  const ico={ok:"●",warn:"▲",ng:"✕",na:"－"};
  h=`<div class="ms-list">${cs.map(c=>`<div class="ms-check ${c.lv}"><div class="ms-ci">${ico[c.lv]}</div><div class="ms-ct"><b>${c.label}</b><span class="ms-cv">${c.val}</span><small>${c.note}</small></div></div>`).join("")||'<div class="ms-note">判定項目がありません</div>'}</div>
   <div class="ms-row"><button class="ms-btn primary" onclick="closeSheet();exportSheet()">検討シート（A4）</button><button class="ms-btn" onclick="closeSheet();savePNG()">画像を保存</button></div>
   <div class="ms-note">目安判定です。正式な可否は関係機関・法規で確認してください。</div>`;
 }else if(_sheet==="obj"){const s=_selInfo();title=s?s.label:"選択";
  if(!s){h='<div class="ms-note">物を選択してから開いてください。</div>';}
  else{
   h=`<div class="ms-h">動かす・回す</div><div class="ms-line"><button class="ms-sq" onclick="mSelMove(-1,0)">←</button><button class="ms-sq" onclick="mSelMove(1,0)">→</button><button class="ms-sq" onclick="mSelMove(0,-1)">↑</button><button class="ms-sq" onclick="mSelMove(0,1)">↓</button><button class="ms-sq" onclick="mSelRot(15)">↻</button><button class="ms-sq" onclick="mSelRot(-15)">↺</button></div>`;
   if(s.kind==="co"){
    const co=U.cobj[s.i];
    h+=`<div class="ms-h">サイズ</div><div class="ms-wrap">${s.sizes.map(z=>`<button class="ms-chip ${s.cur===z.key?"on":""}" onclick="mSelSize('${z.key}')">${z.label}</button>`).join("")}</div>
     ${co.type==="towercrane"?`<div class="ms-h">設置高さ</div><div class="ms-row"><input class="ms-height" type="number" step="0.5" min="${craneSpec(co.size).selfH||1}" max="${craneSpec(co.size).maxInstallH||51}" value="${numv(co.h,craneSpec(co.size).selfH||10)}" onchange="setCOHeight(${s.i},this.value)"> <span class="ms-unit">m</span></div>`:""}
     <div class="ms-h">種類を変える</div><div class="ms-wrap">${Object.keys(COBJ_TYPES).filter(t=>!["walkzone","guard","obstacle"].includes(t)).map(t=>`<button class="ms-chip ${U.cobj[s.i].type===t?"on":""}" onclick="mSelType('${t}')">${COBJ_TYPES[t].label}</button>`).join("")}</div>`;
   }
   if(s.kind==="crane"){h+=`<div class="ms-h">機種</div><div class="ms-wrap">${Object.keys(CRANE_SPECS).map(m=>`<button class="ms-chip ${U.tw.craneModel===m?"on":""}" onclick="S('tw.craneModel','${m}');renderMobile()">${m}<small>半径${CRANE_SPECS[m].work}m</small></button>`).join("")}</div>`;}
   h+=`<div class="ms-row">${(s.kind==="ev"||s.kind==="crane")?"":`<button class="ms-btn" onclick="duplicateSel();renderMobile()">複製</button>`}<button class="ms-btn danger" onclick="deleteSel();closeSheet()">${(s.kind==="ev"||s.kind==="crane")?"非表示（OFF）":"削除"}</button><button class="ms-btn" onclick="U.sel=null;closeSheet();rebuild()">選択解除</button></div>`;
  }
 }else if(_sheet==="edit"){title="編集・案件";
  const uses=["共同住宅（賃貸）","共同住宅（分譲）","事務所","店舗","ホテル","倉庫・物流","病院・医療"];
  h=`<div class="ms-grid">
   <button class="ms-btn" onclick="closeSheet();openStart()">サンプル・実案件を開く</button>
   <button class="ms-btn" onclick="closeSheet();document.getElementById('json-file').click()">ファイルを開く</button>
   <button class="ms-btn" onclick="closeSheet();restoreDraft()">前回の続き</button>
   <button class="ms-btn" onclick="closeSheet();saveProjectJSON()">保存</button></div>
   <div class="qc v4-qc"><div class="v4-qc-head"><small>NEW PROJECT / INITIAL PARAMETERS</small><b>3Dの初期条件を設定</b><span>必要最低限だけ入力。作成後に3Dを見ながら詳細を詰められます。</span></div>
    <div class="v4-qc-section"><em>PROJECT</em><label>案件名<input id="qc-name" type="text" placeholder="例 ○○町 計画" value="${(U.p.name||"").replace(/"/g,"&quot;")}"></label>
    <div class="qc-2"><label>用途<select id="qc-use">${uses.map(u=>`<option ${U.p.use===u?"selected":""}>${u}</option>`).join("")}</select></label><label>構造<select id="qc-struct">${["RC","S","SRC","W"].map(s=>`<option ${U.p.struct===s?"selected":""}>${s}</option>`).join("")}</select></label></div></div>
    <div class="v4-qc-section"><em>BUILDING</em><div class="qc-3"><label>階数<input id="qc-floors" type="number" inputmode="numeric" value="${Math.round(posv(U.p.floors,5))}"></label><label>幅 <small>m</small><input id="qc-bw" type="number" inputmode="decimal" value="${posv((U.blocks[0]||{}).w,12)}"></label><label>奥行 <small>m</small><input id="qc-bd" type="number" inputmode="decimal" value="${posv((U.blocks[0]||{}).d,10)}"></label></div></div>
    <div class="v4-qc-section"><em>SITE / ROAD</em><div class="qc-3"><label>敷地間口 <small>m</small><input id="qc-sw" type="number" inputmode="decimal" value="${posv(U.site.w,18)}"></label><label>敷地奥行 <small>m</small><input id="qc-sd" type="number" inputmode="decimal" value="${posv(U.site.d,16)}"></label><label>道路幅員 <small>m</small><input id="qc-rw" type="number" inputmode="decimal" value="${posv(U.road.w,6)}"></label></div></div>
    <button class="v4-qc-create" onclick="quickCreate()"><span>CREATE 3D MODEL</span><b>この条件で3Dを作る</b><i>→</i></button></div>
   <div class="ms-h">詳細編集</div>
   <div class="ms-note">なぞる・寸法入力・注記などはPC版UIで行えます。スマホでも一時的に切り替えられます。</div>
   <div class="ms-row"><button class="ms-btn" onclick="setSimpleUI(false)">詳細編集（PC版UI）へ</button><button class="ms-btn" onclick="closeSheet();undo()">↶ 元に戻す</button></div>`;
 }
 sheet.innerHTML=`<div class="ms-top"><div class="ms-grip"></div><div class="ms-title">${title}</div><button class="ms-x" onclick="closeSheet()" aria-label="閉じる">×</button></div>${h}`;
 sheet.classList.add("open"); back.classList.add("open");
}
window.renderMobile=renderMobile;
// 起動時に判定して適用。判定・工程が変わったら再描画
document.addEventListener("DOMContentLoaded",()=>{if(simplePreferred())document.body.classList.add("simple");U._mEdit=false;renderMobile();});
if(document.readyState!=="loading"){if(simplePreferred())document.body.classList.add("simple");U._mEdit=false;renderMobile();}
window.addEventListener("resize",()=>{
 document.body.classList.toggle("touch-full",!document.body.classList.contains("simple")&&isTouchPhone());
 if(document.body.classList.contains("simple")&&!_sheet)renderMobile();
});

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
 if(typeof renderPill==="function")renderPill(); setTimeout(resize,50);
};
document.addEventListener("keydown",(e)=>{if(e.key==="Escape"&&document.body.classList.contains("present"))window.togglePresent();});
function renderBar(){
 const mn=(label,items,style)=>`<div class="mn"><button class="btn btn-ghost" onclick="toggleMenu(this)">${label} ▾</button><div class="mn-pop">${items.map(i=>i?`<button class="mn-item ${i.on?"on":""}" onclick="closeMenus();${i.fn}">${i.on?"✓ ":""}${i.label}</button>`:'<div class="mn-sep"></div>').join("")}</div></div>`;
 $("#bar").innerHTML=`
  <button class="btn btn-secondary" onclick="openStart()" title="テンプレート／デモ／ファイルから案件を開く">＋ 新規</button>
  <button class="btn" id="undo-btn" onclick="undo()" title="1つ前の状態に戻す（Ctrl+Z）" ${_hist.length?"":"disabled"}>↶ 戻す</button>
  <button class="btn" onclick="togglePresent()" title="パネルを隠して3Dを全画面に（顧客・会議用）">プレゼン</button>
  ${mn("視点",[
    {label:"鳥瞰",fn:"view('bird')"},{label:"正面",fn:"view('front')"},{label:"アイレベル",fn:"view('eye')"},{label:"真上（配置）",fn:"view('top')"},null,
    {label:"自動回転",fn:"U.auto=!U.auto;renderBar()",on:U.auto}])}
  ${mn("表示",[
    {label:"グリッド",fn:"U.grid.show=!U.grid.show;rebuild();renderBar()",on:U.grid.show},
    {label:"下地操作（ドラッグ移動 / Ctrl回転）",fn:"U.moveLayers=!U.moveLayers;if(U.moveLayers&&U.under&&U.under.tex){U.sel='under';U.auto=false;renderSelCard(true);view('top',{instant:true});}else if(!U.moveLayers&&U.sel==='under'){U.sel=null;renderSelCard();}rebuild();renderBar()",on:U.moveLayers},
    {label:"仮設物だけ動かす",fn:"setEditScope(UI_PREF.editScope==='temp'?'all':'temp')",on:UI_PREF.editScope==="temp"},
    {label:"線画（AI下絵）",fn:"U.line=!U.line;rebuild();renderBar()",on:U.line},null,
    {label:"吸着（頂点・道路・15°回転）",fn:"U.snap=!U.snap;renderBar();renderPanel()",on:U.snap!==false},null,
    {label:"レイヤー（表示の絞り込み）",fn:"toggleLayers()",on:!!U._layersOpen},null,
    {label:"空と霧（見た目）",fn:"U.sky=(U.sky===false);rebuild();renderBar()",on:U.sky!==false},null,
    {label:"スマホ簡易表示へ戻る",fn:"setSimpleUI(true)",on:document.body.classList.contains("simple")}])}
  <button class="btn" onclick="saveProjectJSON()" title="案件を保存（暗号化可）">保存</button>
  <button class="btn" onclick="document.getElementById('json-file').click()" title="保存した案件を開く">読込</button>
  <input type="file" id="json-file" accept=".json,.bsjson" style="display:none" onchange="loadProjectJSON(this.files[0]); this.value=''">
  <button class="btn primary" onclick="exportSheet()" title="判定・諸元・画像・注記をA4横1枚にまとめて出力（印刷→PDF可）">検討シート</button>
  ${mn("出力",[
    {label:"PNG画像を保存",fn:"savePNG()"},
    {label:"IFC出力（GLOOBE等のBIMへ）",fn:"exportIFC()"},
    {label:"BIM出力（OBJ/MTL/JSON）",fn:"exportOBJ()"},
    {label:"AIプロンプト生成",fn:"aiPromptMenu()"},null,
    {label:"意見・要望を送る",fn:"openFeedback()"}])}`;
}
const _renderBarOrig=renderBar; renderBar=function(){_renderBarOrig();renderTools();};
(function installCommandMotion(){
 if(window.__bimgenMotionInstalled)return;window.__bimgenMotionInstalled=true;
 document.addEventListener("pointerdown",(e)=>{
  if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const t=e.target.closest("button,#subtabs div,#tabgroups .tg,.obj-row,.pc-flow button,.ly-row");
  if(!t||t.disabled)return;t.classList.remove("ui-action-fire");void t.offsetWidth;t.classList.add("ui-action-fire");setTimeout(()=>t.classList.remove("ui-action-fire"),210);
 },{passive:true});
})();

window.toggleMenu=(btn)=>{
 const m=btn.parentElement;const pop=m.querySelector(".mn-pop");const was=m.classList.contains("open");
 closeMenus(); if(was||!pop)return;
 m.classList.add("open");
 let portal=document.getElementById("mn-portal");if(!portal){portal=document.createElement("div");portal.id="mn-portal";document.body.appendChild(portal);}
 portal.innerHTML="";const clone=pop.cloneNode(true);clone.classList.add("mn-pop-portal");portal.appendChild(clone);
 const r=btn.getBoundingClientRect();const w=Math.min(300,innerWidth-16);
 let left=Math.min(Math.max(8,r.right-w),innerWidth-w-8);
 portal.style.left=left+"px";portal.style.top=(r.bottom+6)+"px";portal.style.width=w+"px";portal.classList.add("open");
};
window.closeMenus=()=>{document.querySelectorAll(".mn.open").forEach(x=>x.classList.remove("open"));const p=document.getElementById("mn-portal");if(p){p.classList.remove("open");p.innerHTML="";}};
document.addEventListener("pointerdown",(e)=>{if(!e.target.closest(".mn")&&!e.target.closest("#mn-portal"))closeMenus();});
function setLeftPanelCollapsed(closed){
 const p=$("#panel"),w=$("#pwrap"),a=$("#parr"),h=$("#phead");
 if(!p||!w)return;
 p.classList.toggle("collapsed",!!closed);
 w.style.display=closed?"none":"";
 if(a)a.textContent=closed?"▶":"▲";
 if(h)h.setAttribute("aria-expanded",closed?"false":"true");
}
window.setLeftPanelCollapsed=setLeftPanelCollapsed;
$("#phead").addEventListener("click",()=>setLeftPanelCollapsed(!$("#panel").classList.contains("collapsed")));
U._titleMin = true;U._hudMin=true;U._layersOpen=false;  // 起動時は右側パネルを閉じる
setLeftPanelCollapsed(true);                           // 最初の案件表示も3Dを主役にする
renderBar();renderPanel();rebuild();
setTimeout(()=>{const d=$("#drag");if(d)d.style.display="none";},9000);
