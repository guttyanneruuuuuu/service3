// viewer.js - Walkable 3D viewer (first-person)
import * as THREE from 'three';
import { FURNITURE_MAP, THEME_MAP } from './furniture.js';

export class RoomViewer {
  constructor(canvas){
    this.canvas = canvas;
    this.state = null;
    this._initThree();
    this._initControls();
    this._animate();
  }

  _initThree(){
    const { clientWidth:w, clientHeight:h } = this.canvas.parentElement;
    this.renderer = new THREE.WebGLRenderer({ canvas:this.canvas, antialias:true, alpha:false, powerPreference:'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, w/h, 0.1, 200);
    this.camera.position.set(0, 1.6, 4);

    this.ambient = new THREE.AmbientLight(0x606080, 0.8);
    this.scene.add(this.ambient);
    this.dir = new THREE.DirectionalLight(0xffffff, 0.8);
    this.dir.position.set(6, 10, 4);
    this.dir.castShadow = true;
    this.dir.shadow.mapSize.set(1024,1024);
    this.scene.add(this.dir);
    this.hemi = new THREE.HemisphereLight(0xccddff, 0x33221a, 0.4);
    this.scene.add(this.hemi);

    // Player state
    this.player = {
      pos: new THREE.Vector3(0, 1.6, 4),
      yaw: Math.PI, // looking -z
      pitch: 0,
      vel: new THREE.Vector3(),
    };
    this.keys = {};
    this.touchMove = { x:0, y:0 };
    this.touchLook = { x:0, y:0 };

    const ro = new ResizeObserver(() => this._onResize());
    ro.observe(this.canvas.parentElement);
  }

  _onResize(){
    const { clientWidth:w, clientHeight:h } = this.canvas.parentElement;
    if(w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w/h;
    this.camera.updateProjectionMatrix();
  }

  _initControls(){
    // Desktop: pointer lock
    const c = this.canvas;
    const onKeyDown = (e) => { this.keys[e.code] = true; };
    const onKeyUp   = (e) => { this.keys[e.code] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    this._keyHandlers = { onKeyDown, onKeyUp };

    c.addEventListener('click', () => {
      if(!('ontouchstart' in window)){
        c.requestPointerLock?.();
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this._locked = (document.pointerLockElement === c);
    });
    window.addEventListener('mousemove', (e) => {
      if(!this._locked) return;
      this.player.yaw -= e.movementX * 0.0022;
      this.player.pitch = Math.max(-1.4, Math.min(1.4, this.player.pitch - e.movementY*0.0022));
    });

    // Mobile joystick
    const joystick = document.getElementById('joystick');
    const knob = joystick?.querySelector('.joystick-knob');
    const lookPad = document.getElementById('lookpad');
    if(joystick){
      let jActive=false, jStart={x:0,y:0};
      joystick.addEventListener('touchstart', (e) => {
        e.preventDefault();
        jActive = true;
        const t = e.touches[0];
        const r = joystick.getBoundingClientRect();
        jStart = { x: r.left + r.width/2, y: r.top + r.height/2 };
      });
      joystick.addEventListener('touchmove', (e) => {
        if(!jActive) return;
        e.preventDefault();
        const t = e.touches[0];
        const dx = t.clientX - jStart.x;
        const dy = t.clientY - jStart.y;
        const max = 40;
        const d = Math.min(max, Math.hypot(dx,dy));
        const ang = Math.atan2(dy,dx);
        const kx = Math.cos(ang)*d; const ky = Math.sin(ang)*d;
        knob.style.transform = `translate(${kx-24}px, ${ky-24}px)`;
        this.touchMove.x = kx/max;
        this.touchMove.y = ky/max;
      });
      const endTouch = () => {
        jActive=false;
        knob.style.transform = 'translate(-50%, -50%)';
        this.touchMove.x = 0; this.touchMove.y = 0;
      };
      joystick.addEventListener('touchend', endTouch);
      joystick.addEventListener('touchcancel', endTouch);
    }
    if(lookPad){
      let lActive=false, lStart={x:0,y:0};
      lookPad.addEventListener('touchstart', (e) => {
        e.preventDefault();
        lActive = true;
        lStart = { x:e.touches[0].clientX, y:e.touches[0].clientY };
      });
      lookPad.addEventListener('touchmove', (e) => {
        if(!lActive) return;
        e.preventDefault();
        const t = e.touches[0];
        const dx = t.clientX - lStart.x;
        const dy = t.clientY - lStart.y;
        lStart = { x:t.clientX, y:t.clientY };
        this.player.yaw -= dx * 0.006;
        this.player.pitch = Math.max(-1.4, Math.min(1.4, this.player.pitch - dy*0.006));
      });
      lookPad.addEventListener('touchend', ()=>{ lActive=false; });
    }
  }

  loadState(state){
    this.state = state;
    // clear scene
    if(this._room){ this.scene.remove(this._room); }
    this._room = new THREE.Group();
    this.scene.add(this._room);

    const size = state.size || 10;
    const height = state.height || 3;
    const half = size/2;

    const theme = THEME_MAP[state.theme] || THEME_MAP.cozy;
    this.scene.background = new THREE.Color(theme.sky);
    this.scene.fog = new THREE.Fog(theme.sky, 15, 40);
    this.ambient.color.set(theme.ambient);
    this.dir.color.set(theme.light);

    // Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(state.floorColor), roughness:0.85 })
    );
    floor.rotation.x = -Math.PI/2;
    floor.receiveShadow = true;
    this._room.add(floor);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(state.wallColor), roughness:0.9, side:THREE.DoubleSide });
    const mkWall = (w,h,pos,rot=0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w,h), wallMat);
      m.position.copy(pos); m.rotation.y = rot;
      m.receiveShadow = true; this._room.add(m); return m;
    };
    mkWall(size, height, new THREE.Vector3(0,height/2,-half));
    mkWall(size, height, new THREE.Vector3(0,height/2, half), Math.PI);
    mkWall(size, height, new THREE.Vector3(half,height/2,0), -Math.PI/2);
    mkWall(size, height, new THREE.Vector3(-half,height/2,0), Math.PI/2);
    // Ceiling
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(size,size),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(state.wallColor).multiplyScalar(1.05), side:THREE.DoubleSide, roughness:0.9 })
    );
    ceil.rotation.x = Math.PI/2; ceil.position.y = height;
    this._room.add(ceil);

    // Items
    (state.items||[]).forEach(it => {
      const def = FURNITURE_MAP[it.type];
      if(!def) return;
      const built = def.build();
      const g = built.group;
      if(built.wall && it.wallSide){
        const wallY = it.y || height/2;
        const rotByWall = {1:0, 2:-Math.PI/2, 3:Math.PI, 4:Math.PI/2};
        switch(it.wallSide){
          case 1: g.position.set(it.x, wallY, -half + 0.05); break;
          case 2: g.position.set(half - 0.05, wallY, it.z); break;
          case 3: g.position.set(it.x, wallY, half - 0.05); break;
          case 4: g.position.set(-half + 0.05, wallY, it.z); break;
        }
        g.rotation.y = rotByWall[it.wallSide] + (it.rotY||0);
      }else{
        g.position.set(it.x, it.y||0, it.z);
        g.rotation.y = it.rotY||0;
      }
      this._room.add(g);
    });

    // Spawn position (near door-like side)
    this.player.pos.set(0, 1.6, Math.min(half - 1, 3));
    this.player.yaw = Math.PI;
    this.player.pitch = 0;

    // Messages board (floating text sprites on walls - simple)
    this._messagesGroup = new THREE.Group();
    this._room.add(this._messagesGroup);
  }

  showMessages(messages){
    if(!this._messagesGroup) return;
    // clear
    while(this._messagesGroup.children.length) this._messagesGroup.remove(this._messagesGroup.children[0]);
    const half = (this.state?.size||10)/2;
    messages.slice(0, 12).forEach((m, i) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(168,85,247,0.85)';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(m.n || 'ゲスト', 20, 40);
      ctx.font = '24px sans-serif';
      const text = (m.t||'').substring(0, 38);
      ctx.fillText(text, 20, 80);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
      spr.scale.set(2, 0.5, 1);
      // place around the room
      const ang = (i / 12) * Math.PI * 2;
      spr.position.set(Math.sin(ang)*(half-1.5), 1.8 + (i%3)*0.4, Math.cos(ang)*(half-1.5));
      this._messagesGroup.add(spr);
    });
  }

  _physicsStep(dt){
    const speed = 4.0 * dt;
    let fwd = 0, strafe = 0;
    if(this.keys['KeyW'] || this.keys['ArrowUp']) fwd += 1;
    if(this.keys['KeyS'] || this.keys['ArrowDown']) fwd -= 1;
    if(this.keys['KeyA'] || this.keys['ArrowLeft']) strafe -= 1;
    if(this.keys['KeyD'] || this.keys['ArrowRight']) strafe += 1;

    fwd += -this.touchMove.y;
    strafe += this.touchMove.x;

    const dx = (Math.sin(this.player.yaw) * fwd + Math.cos(this.player.yaw) * strafe) * speed;
    const dz = (Math.cos(this.player.yaw) * fwd - Math.sin(this.player.yaw) * strafe) * speed;

    const size = this.state?.size || 10;
    const lim = size/2 - 0.4;
    this.player.pos.x = Math.max(-lim, Math.min(lim, this.player.pos.x + dx));
    this.player.pos.z = Math.max(-lim, Math.min(lim, this.player.pos.z + dz));

    // Cam update
    this.camera.position.copy(this.player.pos);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.player.yaw;
    this.camera.rotation.x = this.player.pitch;
  }

  _animate(){
    let last = performance.now();
    const tick = () => {
      this._rafId = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.1, (now-last)/1000);
      last = now;
      if(this.state) this._physicsStep(dt);
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  dispose(){
    cancelAnimationFrame(this._rafId);
    this.renderer.dispose();
    if(this._keyHandlers){
      window.removeEventListener('keydown', this._keyHandlers.onKeyDown);
      window.removeEventListener('keyup', this._keyHandlers.onKeyUp);
    }
  }
}
