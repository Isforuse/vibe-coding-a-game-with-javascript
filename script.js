const rows = 5, cols = 8, cellSize = 100, gap = 6;
const energyEl = document.getElementById('energy');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const gridEl = document.getElementById('grid');
const msgEl = document.getElementById('message');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const zombieTimerEl = document.getElementById('zombieTimer');

// === 圖片設定 ===
const IMG_MAXWELL = "https://media.tenor.com/El89itaAWsIAAAAi/maxwell.gif";
const IMG_OIIA = "https://media.tenor.com/sbfBfp3FeY8AAAAj/oia-uia.gif";
const IMG_BABABOI = "https://media1.tenor.com/m/zxV20tjLg9IAAAAd/luna-the.gif";
const IMG_APPLE_DEF = "https://media.tenor.com/if3jhnXyiaUAAAAj/apple-cat.gif";
const IMG_BOMB = "https://media.tenor.com/xtpR11_S7QgAAAAi/bomb-cat.gif";
const IMG_BOMB_EXPLODE = "https://media1.tenor.com/m/p-wIO64HN5cAAAAC/wake-up.gif";
const IMG_MIKE = "https://media.tenor.com/w-tjf_bXRgIAAAAC/mike-mikeford.gif";
const IMG_MIKE_ATTACK = "https://media.tenor.com/sgtdUGETVaYAAAAj/bonk.gif";
const IMG_ZOMBIE = "https://media.tenor.com/uXvLSFKpbyIAAAAi/glorp-cat.gif";
const IMG_ZOMBIE_ATTACK = "https://media.tenor.com/uZ_UN-KXKBIAAAAi/alien-cat.gif";
const IMG_BULLET = "https://media1.tenor.com/m/6xl6AnNRv1AAAAAd/fanny-car.gif";
const IMG_BOSS = "https://media1.tenor.com/m/vOPh5HNvKJMAAAAC/mfw.gif";
const IMG_BOSS_ATTACK = "https://media1.tenor.com/m/Ow4aJ_k2rgkAAAAd/cat-monday-left-me-broken-cat.gif";

// 割草機
const IMG_MOWER_IDLE = "https://media.tenor.com/G2p64oScTY8AAAAi/sad.gif";
const IMG_MOWER_ACTIVE = "https://media.tenor.com/XUQ0XMV45VUAAAAi/yellow-emoji.gif";

// === 角色設定 ===
const TYPES = {
  maxwell: {cost:100, hp:100, fireRate:1500, producer:false, produceRate:0,    bulletDmg:20, cooldownMs:2000},
  oiia:    {cost:50,  hp:75,  fireRate:0,    producer:true,  produceRate:3000, bulletDmg:0,  cooldownMs:2000},
  bababoi: {cost:75,  hp:300, fireRate:0,    producer:false, produceRate:0,    bulletDmg:0,  cooldownMs:2000},
  apple:   {cost:125, hp:500, fireRate:0,    producer:false, produceRate:0,    bulletDmg:0,  cooldownMs:4000},
  bomb:    {cost:150, hp:50,  fireRate:0,    producer:false, produceRate:0,    bulletDmg:0,  cooldownMs:5000},
  mike:    {cost:200, hp:300, fireRate:0,    producer:false, produceRate:0,    bulletDmg:50, cooldownMs:10000}
};

// === 關卡設定 ===
const LEVELS = [
  {zombies:5}, {zombies:10}, {zombies:15}, {zombies:20}, {zombies:30, boss:true}
];

let rafId = null;

let state = {
  energy:100,
  lives:3,
  levelIdx:0,
  paused:false,
  placingType:null,
  cooldownUntil:{},
  cells:[],
  cats:[],
  bullets:[],
  zombies:[],
  mowers:[],
  runningMowers:[], // ✅ 新增：正在推進的割草機
  lastFrame:performance.now(),
  nextSpawnAt:0,
  remainingToSpawn:0,
  levelClear:false
};

// === 工具 ===
function imgOnErrorFallback(img, label){
  img.onerror=null;
  img.replaceWith(Object.assign(document.createElement('div'),{
    textContent:label, style:"width:60px;height:60px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:#1f2937"
  }));
}
function cellXY(r,c){
  const x = gap + c*(cellSize+gap);
  const y = gap + r*(cellSize+gap);
  return {x,y};
}
function aabb(ax,ay,aw,ah,bx,by,bw,bh){
  return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by;
}
function updateHPBar(obj) {
  if(!obj.hpFill) return;
  const ratio = Math.max(0, obj.hp / obj.maxHp);
  obj.hpFill.style.width = (ratio * 100) + "%";
  if(ratio > 0.6) obj.hpFill.style.background = "green";
  else if(ratio > 0.3) obj.hpFill.style.background = "orange";
  else obj.hpFill.style.background = "red";
}

// === 初始化 Grid (包含割草機在 col=0) ===
function setupGrid(){
  gridEl.innerHTML = '';
  state.cells = [];
  state.mowers = [];

  for(let r=0;r<rows;r++){
    const rowArr=[];
    state.cells.push(rowArr);

    for(let c=0;c<cols;c++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;

      if(c===0){
        rowArr.push({type:'mowerSlot'});
      }else{
        cell.addEventListener('click', onCellClick);
        rowArr.push(null);
      }
      gridEl.appendChild(cell);
    }

    // === 割草機元素 ===
    const mowerEl = document.createElement('img');
    mowerEl.src = IMG_MOWER_IDLE;
    mowerEl.alt = 'mower';
    mowerEl.className = 'mower';
    mowerEl.style.width = "90px";
    mowerEl.style.height = "90px";
    mowerEl.style.position = "absolute";

    const {x,y} = cellXY(r,0);
    mowerEl.style.left = x + "px";
    mowerEl.style.top  = y + "px";

    gridEl.appendChild(mowerEl);

    state.mowers.push({row:r, col:0, active:false, el:mowerEl, img:mowerEl});
  }

  gridEl.style.setProperty('--rows', rows);
  gridEl.style.setProperty('--cols', cols);
}

// === HUD ===
function setHUD(){
  energyEl.textContent = state.energy;
  livesEl.textContent = state.lives;
  levelEl.textContent = state.levelIdx+1;
}

// === 卡片 ===
function selectCard(type){
  if(state.paused) return;
  document.querySelectorAll('.card').forEach(c=>c.classList.remove('selected'));
  const card = document.querySelector(`.card[data-type="${type}"]`);
  if(card && !card.classList.contains('disabled')){
    card.classList.add('selected');
    state.placingType = type;
  }
}
function updateCardStates(){
  Object.keys(TYPES).forEach(type=>{
    const card = document.querySelector(`.card[data-type="${type}"]`);
    if(!card) return;
    const canAfford = state.energy >= TYPES[type].cost;
    const notCooldown = performance.now() >= (state.cooldownUntil[type]||0);
    card.classList.toggle('disabled', !(canAfford && notCooldown));
  });
}

// === 放置角色 ===
function onCellClick(e){
  const r = +e.currentTarget.dataset.row;
  const c = +e.currentTarget.dataset.col;
  if(c===0) return;
  if(!state.placingType || state.paused) return;
  if(state.cells[r][c]) return;

  const type = state.placingType;
  const def = TYPES[type];
  if(state.energy < def.cost) return;
  if(performance.now() < (state.cooldownUntil[type]||0)) return;

  state.energy -= def.cost;
  setHUD();

  const catEl = document.createElement('div');
  catEl.className = 'entity';
  const img = document.createElement('img');
  if(type==='maxwell') img.src = IMG_MAXWELL;
  if(type==='oiia')    img.src = IMG_OIIA;
  if(type==='bababoi') img.src = IMG_BABABOI;
  if(type==='apple')   img.src = IMG_APPLE_DEF;
  if(type==='bomb')    img.src = IMG_BOMB;
  if(type==='mike')    img.src = IMG_MIKE;
  img.alt = type;
  img.onerror = ()=>imgOnErrorFallback(img, type);
  catEl.appendChild(img);

  const hpBar = document.createElement('div');
  hpBar.className = 'hp-bar';
  const hpFill = document.createElement('div');
  hpFill.className = 'hp-fill';
  hpBar.appendChild(hpFill);
  catEl.appendChild(hpBar);

  const pos = cellXY(r,c);
  catEl.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
  gridEl.appendChild(catEl);

  const cat = {
    row:r,col:c,type,hp:def.hp,maxHp:def.hp,
    el:catEl,hpFill:hpFill,
    lastFire:0,lastProduce:0,
    placedAt:performance.now(),
    attacking:false
  };
  updateHPBar(cat);

  state.cats.push(cat);
  state.cells[r][c] = cat;

  state.cooldownUntil[type] = performance.now() + def.cooldownMs;
  updateCardStates();
}

// === 子彈 ===
function fireBullet(cat){
  const bEl = document.createElement('div');
  bEl.className = 'bullet';
  const img = document.createElement('img');
  img.src = IMG_BULLET; img.alt='bullet';
  img.onerror = ()=>imgOnErrorFallback(img,'•');
  bEl.appendChild(img);
  gridEl.appendChild(bEl);
  const {x,y} = cellXY(cat.row, cat.col);
  const bx = x + 60;
  const by = y + 35;
  bEl.style.transform = `translate(${bx}px, ${by}px)`;
  state.bullets.push({x:bx,y:by,row:cat.row,spd:0.35,el:bEl,alive:true,damage:TYPES[cat.type].bulletDmg});
}
function removeBullet(b){ b.alive=false; b.el.remove(); }

// === 殭屍 ===
function spawnZombie(){
  if(state.remainingToSpawn<=0) return;
  const r = Math.floor(Math.random()*rows);
  const level = state.levelIdx+1;
  const baseHp = 100 + (level-1)*50;
  const speedMult = Math.pow(1.1, level-1);
  const hp = baseHp;
  const spd = (cellSize / 100000) * speedMult;
  const atk = 10;

  const zEl = document.createElement('div');
  zEl.className = 'zombie';
  const img = document.createElement('img');
  img.src = IMG_ZOMBIE; img.alt='zombie';
  img.onerror = ()=>imgOnErrorFallback(img,'Z');
  zEl.appendChild(img);

  const hpBar = document.createElement('div');
  hpBar.className = 'hp-bar';
  const hpFill = document.createElement('div');
  hpFill.className = 'hp-fill';
  hpBar.appendChild(hpFill);
  zEl.appendChild(hpBar);

  gridEl.appendChild(zEl);
  const {x,y} = cellXY(r, cols-1);
  const z = {row:r, x: x + 600, y, hp, maxHp:hp, spd, atk, el:zEl, img:img, hpFill:hpFill, stopped:false, boss:false};
  updateHPBar(z);
  positionZombie(z);
  state.zombies.push(z);
  state.remainingToSpawn--;
}

function spawnBoss(){
  const r = Math.floor(Math.random()*rows);
  const zEl = document.createElement('div');
  zEl.className = 'zombie boss';
  const img = document.createElement('img');
  img.src = IMG_BOSS; img.alt='boss';
  img.onerror = ()=>imgOnErrorFallback(img,'B');
  zEl.appendChild(img);

  const hpBar = document.createElement('div');
  hpBar.className = 'hp-bar';
  const hpFill = document.createElement('div');
  hpFill.className = 'hp-fill';
  hpBar.appendChild(hpFill);
  zEl.appendChild(hpBar);

  gridEl.appendChild(zEl);
  const {x,y} = cellXY(r, cols-1);

  const z = {
    row:r,
    x: x + 600,
    y,
    hp:2000,         // ✅ 血量變 2000
    maxHp:2000,
    spd:(cellSize/80000), 
    atk:30,          // ✅ 攻擊力變 50
    el:zEl,
    img:img,
    hpFill:hpFill,
    stopped:false,
    boss:true
  };

  updateHPBar(z);
  positionZombie(z);
  state.zombies.push(z);
}

function positionZombie(z){
  z.el.style.transform = `translate(${z.x}px, ${z.y}px)`;
}
function removeZombie(z){
  z.el.remove();
  state.zombies = state.zombies.filter(zz=>zz!==z);
}

// === 爆炸（BombCat） ===
function explodeBombCat(cat){
  const boom = document.createElement('img');
  boom.src = IMG_BOMB_EXPLODE;
  boom.className = "explosion";
  const {x,y} = cellXY(cat.row, cat.col);
  boom.style.position = "absolute";
  boom.style.left = (x + cellSize/2 - 50) + "px";
  boom.style.top  = (y + cellSize/2 - 50) + "px";
  boom.style.width = "100px";
  boom.style.height = "100px";
  boom.style.pointerEvents = "none";
  gridEl.appendChild(boom);
  setTimeout(()=>boom.remove(), 1000);

  state.zombies.slice().forEach(z=>{
    if(z.row===cat.row) removeZombie(z);
  });

  removeCat(cat);
}

// === 主迴圈 ===
function tick(dt){
  if(state.paused) return;

  // 貓咪行為
  state.cats.slice().forEach(cat=>{
    if(cat.type==='maxwell'){
      if(performance.now() - cat.lastFire >= TYPES.maxwell.fireRate){
        cat.lastFire = performance.now();
        fireBullet(cat);
      }
    }
    if(cat.type==='oiia'){
      const now = Date.now();
      if(now - cat.lastProduce >= TYPES.oiia.produceRate){
        cat.lastProduce = now;
        state.energy += 25;
        setHUD(); updateCardStates();
      }
    }
    if(cat.type==='bomb'){
      const hasZombie = state.zombies.some(z=>z.row===cat.row);
      if(hasZombie && performance.now()-cat.placedAt>=2000){
        explodeBombCat(cat);
      }
    }
    if(cat.type==='mike'){
      let attacking = false;
      for(const z of state.zombies){
        if(z.row!==cat.row) continue;
        const {x:cx,y:cy} = cellXY(cat.row, cat.col);
        if(aabb(z.x, z.y, 80, 80, cx, cy, cellSize, cellSize)){
          z.hp -= TYPES.mike.bulletDmg * dt/1000;
          updateHPBar(z);
          if(z.hp<=0) removeZombie(z);
          attacking = true;
        }
      }
      const img = cat.el.querySelector("img");
      if(attacking && cat.el.querySelector("img").src !== IMG_MIKE_ATTACK){
            cat.el.querySelector("img").src = IMG_MIKE_ATTACK;
        }
      if(!attacking && cat.el.querySelector("img").src !== IMG_MIKE){
            cat.el.querySelector("img").src = IMG_MIKE;
  }
    }
  });

  // 子彈移動
  state.bullets.forEach(b=>{
    if(!b.alive) return;
    b.x += b.spd * dt * (cellSize/100);
    b.el.style.transform = `translate(${b.x}px, ${b.y}px)`;
    if(b.x > gap + cols*(cellSize+gap)){ removeBullet(b); return; }
    for(const z of state.zombies){
      if(z.row!==b.row) continue;
      if(aabb(b.x,b.y,30,30, z.x+20,z.y+10,60,60)){
        z.hp -= b.damage;
        updateHPBar(z);
        removeBullet(b);
        if(z.hp<=0) removeZombie(z);
        break;
      }
    }
  });
  state.bullets = state.bullets.filter(b=>b.alive);

  // 殭屍移動/攻擊/割草機觸發/越界扣命
  state.zombies.slice().forEach(z=>{
    if(!z.stopped) z.x -= z.spd * dt * (cellSize);
    positionZombie(z);

    let blocking = null;
    for(const cat of state.cats){
      if(cat.row!==z.row) continue;
      const {x:cx,y:cy} = cellXY(cat.row, cat.col);
      if(aabb(z.x+10,z.y+10,60,60, cx,cy,cellSize,cellSize)){ blocking = cat; break; }
    }
    if(blocking){
      if(!z.stopped){
    if(z.boss){
      z.img.src = IMG_BOSS_ATTACK;  // ✅ Boss 攻擊圖
    }else{
      z.img.src = IMG_ZOMBIE_ATTACK;
    }
  }
      z.stopped = true;
      blocking.hp -= z.atk * dt/1000;
      updateHPBar(blocking);
      if(blocking.hp<=0){
        removeCat(blocking);
        z.stopped = false;
        z.img.src = IMG_ZOMBIE;
      }
    }else{
      if(z.stopped){ z.img.src = IMG_ZOMBIE; }
      z.stopped = false;
    }

    // 觸發割草機
    for(const mower of state.mowers){
      if(mower.active) continue;
      if(z.row===mower.row && z.x < gap){
        mower.active = true;
        mower.img.src = IMG_MOWER_ACTIVE;
        state.runningMowers.push({row:mower.row, x:parseInt(mower.el.style.left), el:mower.el, speed:0.4});
      }
    }

    // 沒割草機且越界 → 扣命
    if(z.x < gap - 40){
      removeZombie(z);
      state.lives -= 1; setHUD();
      if(state.lives<=0){ gameOver(); }
    }
  });

  // === 割草機推進 ===
  state.runningMowers.slice().forEach(m=>{
    m.x += m.speed * dt;
    m.el.style.left = m.x + "px";

    state.zombies.slice().forEach(z=>{
      if(z.row === m.row && z.x < m.x + 60){
        removeZombie(z);
      }
    });

    if(m.x > cols*(cellSize+gap)){
      m.el.remove();
      state.runningMowers = state.runningMowers.filter(mm=>mm!==m);
    }
  });

  // 殭屍產生
  if(state.remainingToSpawn>0 && performance.now()>=state.nextSpawnAt){
    spawnZombie();
    const wait = 2000 + Math.random()*3000;
    state.nextSpawnAt = performance.now()+wait;
  }

  if(state.remainingToSpawn>0){
    const remain = Math.max(0, Math.ceil((state.nextSpawnAt - performance.now())/1000));
    zombieTimerEl.textContent = remain + "s";
  }else{
    zombieTimerEl.textContent = "--";
  }

if(state.remainingToSpawn<=0 && !state.levelClear){
  const info = LEVELS[state.levelIdx];
  if(info.boss && !state.bossSpawned){
    // 如果是 Boss 關卡，等普通殭屍刷完才生 Boss
    spawnBoss();
    state.bossSpawned = true;
  } else if(state.zombies.length===0){
    // 沒 Boss 或 Boss 已經死 → 過關
    state.levelClear = true;
    setTimeout(()=>advanceLevel(), 800);
  }
}
}

// === 其他功能 ===
function removeCat(cat){
  state.cells[cat.row][cat.col] = null;
  cat.el.remove();
  state.cats = state.cats.filter(c=>c!==cat);
}
function energyTicker(){
  if(!state.paused){
    state.energy += 25;
    setHUD(); updateCardStates();
  }
}
function showMessage(text){ msgEl.textContent = text; msgEl.classList.remove('hidden'); }
function hideMessage(){ msgEl.classList.add('hidden'); }

function startLevel(idx){
  state.levelIdx = idx;
  setHUD();

  state.cats.slice().forEach(removeCat); state.cats = [];
  state.bullets.slice().forEach(removeBullet); state.bullets = [];
  state.zombies.slice().forEach(removeZombie); state.zombies = [];
  state.levelClear = false;
  state.bossSpawned = false;

  setupGrid();

  const info = LEVELS[idx];
  state.remainingToSpawn = info.zombies;
  state.nextSpawnAt = 0;

  showMessage(`Level ${idx+1} begins! Zombies are faster and stronger!`);
  setTimeout(()=>hideMessage(), 1500);

  setTimeout(() => {
    if(state.remainingToSpawn > 0){
      state.nextSpawnAt = performance.now()+2000;
    }
    if(info.boss){ setTimeout(()=>spawnBoss(), 3000); }
  }, 5000);
}
function advanceLevel(){
  if(state.levelIdx===LEVELS.length-1){
    showMessage("Victory! You cleared all 5 levels!");
    pauseBtn.disabled=true; resumeBtn.disabled=true;
    cancelAnimationFrame(rafId);
    return;
  }
  showMessage("Level Complete!");
  setTimeout(()=>{ hideMessage(); startLevel(state.levelIdx+1); }, 1200);
}
function gameOver(){
  showMessage("Game Over");
  state.paused = true;
  pauseBtn.disabled = true;
  resumeBtn.disabled = true;
  if(rafId) cancelAnimationFrame(rafId);
}

// === 迴圈 ===
function loop(t){
  const dt = t - state.lastFrame; state.lastFrame = t;
  tick(dt);
  rafId = requestAnimationFrame(loop);
}

// === 綁定 ===
function handleCardClicks(){
  document.querySelectorAll('.card').forEach(card=>{
    const type = card.dataset.type;
    card.addEventListener('click', ()=>selectCard(type));
  });
}

// === 啟動 ===
function init(){
  setupGrid();
  setHUD();
  handleCardClicks();

  energyTicker();
  setInterval(energyTicker, 2000);

  startLevel(0);

  requestAnimationFrame(t=>{
    state.lastFrame=t;
    rafId = requestAnimationFrame(loop);
  });
  updateCardStates();
}

function onPause(){ state.paused = true; pauseBtn.disabled = true; resumeBtn.disabled = false; showMessage("Paused"); }
function onResume(){ state.paused = false; pauseBtn.disabled = false; resumeBtn.disabled = true; hideMessage(); }

pauseBtn.addEventListener('click', onPause);
resumeBtn.addEventListener('click', onResume);

init();
