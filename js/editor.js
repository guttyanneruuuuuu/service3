// editor.js - 3D room editor (Three.js)
import * as THREE from 'three';
import { FURNITURE_MAP, THEME_MAP } from './furniture.js';

export class RoomEditor {
  constructor(canvas, opts={}){
    this.canvas = canvas;
    this.onSelect = opts.onSelect || (()=>{});
    this.onChange = opts.onChange || (()=>{});

    this.state = {
      title: '',
      size: 10,
      height: 3,
      floorColor: '#8b6f4e',
      wallColor: '#f0e8dc',
      theme: 'cozy',
      items: [], // {id, type, x, z, rotY, wallSide, y, mesh}
    };
    this.nextId = 1;

    this._initThree();
    this._initInteraction();
    this._buildRoom();
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
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a12);
    this.scene.fog = new THREE.Fog(0x0a0a12, 25, 60);

    this.camera = new THREE.PerspectiveCamera(55, w/h, 0.1, 200);
    this._camTarget = new THREE.Vector3(0, 1, 0);
    this._camAngle = { az: Math.PI*0.25, el: Math.PI*0.3, dist: 12 };
    this._updateCamera();

    // Lights
    this.ambient = new THREE.AmbientLight(0x606080, 0.7);
    this.scene.add(this.ambient);
    this.dir = new THREE.DirectionalLight(0xffffff, 0.9);
    this.dir.position.set(6, 12, 6);
    this.dir.castShadow = true;
    this.dir.shadow.mapSize.set(1024, 1024);
    this.dir.shadow.camera.left = -15;
    this.dir.shadow.camera.right = 15;
    this.dir.shadow.camera.top = 15;
    this.dir.shadow.camera.bottom = -15;
    this.dir.shadow.camera.near = 0.5;
    this.dir.shadow.camera.far = 40;
    this.dir.shadow.bias = -0.0005;
    this.scene.add(this.dir);

    this.hemi = new THREE.HemisphereLight(0xccddff, 0x33221a, 0.4);
    this.scene.add(this.hemi);

    // Raycasting
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    // ResizeObserver
    const ro = new ResizeObserver(() => this._onResize());
    ro.observe(this.canvas.parentElement);
    window.addEventListener('resize', ()=>this._onResize());
  }

  _onResize(){
    const { clientWidth:w, clientHeight:h } = this.canvas.parentElement;
    if(w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w/h;
    this.camera.updateProjectionMatrix();
  }

  _updateCamera(){
    const { az, el, dist } = this._camAngle;
    const x = Math.sin(az) * Math.cos(el) * dist;
    const y = Math.sin(el) * dist + 0.5;
    const z = Math.cos(az) * Math.cos(el) * dist;
    this.camera.position.set(x + this._camTarget.x, y + this._camTarget.y, z + this._camTarget.z);
    this.camera.lookAt(this._camTarget);
  }

  _buildRoom(){
    // clear old room objects
    if(this._room){ this.scene.remove(this._room); this._room.traverse(o=>{ o.geometry?.dispose?.(); o.material?.dispose?.(); }); }
    this._room = new THREE.Group();
    this.scene.add(this._room);

    const size = this.state.size;
    const height = this.state.height;
    const half = size/2;

    const theme = THEME_MAP[this.state.theme] || THEME_MAP.cozy;

    // Floor
    const floorGeom = new THREE.PlaneGeometry(size, size);
    const floorMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.state.floorColor),
      roughness: 0.85,
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.receiveShadow = true;
    floor.name = 'floor';
    this._room.add(floor);

    // Walls (slightly see-through when camera behind)
    const wallMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.state.wallColor),
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const mkWall = (w,h) => new THREE.Mesh(new THREE.PlaneGeometry(w,h), wallMat);
    const wallN = mkWall(size, height); wallN.position.set(0, height/2, -half); wallN.name='wallN';
    const wallS = mkWall(size, height); wallS.position.set(0, height/2, half); wallS.rotation.y=Math.PI; wallS.name='wallS';
    const wallE = mkWall(size, height); wallE.position.set(half, height/2, 0); wallE.rotation.y=-Math.PI/2; wallE.name='wallE';
    const wallW = mkWall(size, height); wallW.position.set(-half, height/2, 0); wallW.rotation.y=Math.PI/2; wallW.name='wallW';
    this._walls = [wallN, wallS, wallE, wallW];
    this._walls.forEach(w => { w.receiveShadow = true; this._room.add(w); });

    // Ceiling (only visible from below)
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(size,size), new THREE.MeshStandardMaterial({color: new THREE.Color(this.state.wallColor).multiplyScalar(1.1), side:THREE.DoubleSide, roughness:0.9}));
    ceil.rotation.x = Math.PI/2;
    ceil.position.y = height;
    ceil.receiveShadow = true;
    this._room.add(ceil);

    // Grid helper (subtle)
    const grid = new THREE.GridHelper(size, size, 0x888888, 0x444444);
    grid.material.opacity = 0.15;
    grid.material.transparent = true;
    grid.position.y = 0.01;
    this._room.add(grid);

    // Theme lighting adjustments
    this.scene.background = new THREE.Color(theme.sky);
    this.scene.fog.color.set(theme.sky);
    this.ambient.color.set(theme.ambient);
    this.dir.color.set(theme.light);

    // Placeholder pointer disc (shows where we'll drop)
    if(!this._dropIndicator){
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.4, 0.5, 32),
        new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent:true, opacity:0.8, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI/2;
      ring.position.y = 0.02;
      ring.visible = false;
      this._dropIndicator = ring;
      this.scene.add(ring);
    }

    // Re-place existing items
    this.state.items.forEach(it => this._applyItemTransform(it));

    // Selection box
    if(!this._selectBox){
      this._selectBox = new THREE.Box3Helper(new THREE.Box3(), 0xa855f7);
      this._selectBox.visible = false;
      this.scene.add(this._selectBox);
    }
  }

  _initInteraction(){
    const c = this.canvas;
    let isDown = false;
    let pointerStart = {x:0,y:0};
    let lastPointer = {x:0,y:0};
    let mode = null; // 'rotate' | 'drag'
    let pinchDist = 0;

    const getPointerLocal = (ev) => {
      const rect = c.getBoundingClientRect();
      const t = ev.touches ? ev.touches[0] : ev;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top, cx:t.clientX, cy:t.clientY };
    };

    // Pointer down
    const onDown = (ev) => {
      ev.preventDefault?.();
      if(ev.touches && ev.touches.length === 2){
        const dx = ev.touches[0].clientX - ev.touches[1].clientX;
        const dy = ev.touches[0].clientY - ev.touches[1].clientY;
        pinchDist = Math.hypot(dx, dy);
        mode = 'pinch';
        return;
      }
      const p = getPointerLocal(ev);
      pointerStart = { x:p.cx, y:p.cy };
      lastPointer = { x:p.cx, y:p.cy };
      isDown = true;

      // Right-click or 2-finger -> rotate camera
      // Otherwise: pick item
      if(ev.button === 2 || ev.ctrlKey){
        mode = 'rotate';
      }else{
        // test if we clicked an item
        const picked = this._pickItem(p.x, p.y);
        if(picked){
          this._setSelected(picked);
          mode = 'drag';
          this._dragOffset = new THREE.Vector3();
          const ground = this._groundPointAt(p.x, p.y);
          if(ground) this._dragOffset.set(picked.x - ground.x, 0, picked.z - ground.z);
        }else{
          this._setSelected(null);
          mode = 'rotate';
        }
      }
    };

    const onMove = (ev) => {
      if(!isDown) return;
      ev.preventDefault?.();
      if(mode === 'pinch' && ev.touches && ev.touches.length===2){
        const dx = ev.touches[0].clientX - ev.touches[1].clientX;
        const dy = ev.touches[0].clientY - ev.touches[1].clientY;
        const d = Math.hypot(dx, dy);
        if(pinchDist){
          this._camAngle.dist *= (pinchDist/d);
          this._camAngle.dist = Math.max(3, Math.min(25, this._camAngle.dist));
          this._updateCamera();
        }
        pinchDist = d;
        return;
      }
      const p = getPointerLocal(ev);
      const dx = p.cx - lastPointer.x;
      const dy = p.cy - lastPointer.y;
      lastPointer = { x:p.cx, y:p.cy };

      if(mode === 'rotate'){
        this._camAngle.az -= dx * 0.008;
        this._camAngle.el = Math.max(0.1, Math.min(Math.PI/2 - 0.1, this._camAngle.el - dy*0.008));
        this._updateCamera();
      } else if(mode === 'drag' && this._selected){
        const ground = this._groundPointAt(p.x, p.y);
        if(ground){
          let nx = ground.x + (this._dragOffset?.x||0);
          let nz = ground.z + (this._dragOffset?.z||0);
          const lim = this.state.size/2 - 0.3;
          nx = Math.max(-lim, Math.min(lim, nx));
          nz = Math.max(-lim, Math.min(lim, nz));
          this._selected.x = nx; this._selected.z = nz;
          this._applyItemTransform(this._selected);
          this._updateSelectBox();
        }
      }
    };

    const onUp = (ev) => {
      if(!isDown) return;
      const moved = Math.hypot((ev.changedTouches?.[0]?.clientX || ev.clientX) - pointerStart.x,
                                (ev.changedTouches?.[0]?.clientY || ev.clientY) - pointerStart.y);
      isDown = false;
      if(mode === 'drag'){
        this.onChange();
      }
      mode = null;
      if(moved < 5 && this._selected){
        // quick tap with selection -> emit callback for popup menu
        this.onSelect(this._selected, {x: ev.changedTouches?.[0]?.clientX || ev.clientX, y: ev.changedTouches?.[0]?.clientY || ev.clientY});
      }
    };

    // Wheel zoom
    c.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      this._camAngle.dist *= (1 + Math.sign(ev.deltaY)*0.08);
      this._camAngle.dist = Math.max(3, Math.min(25, this._camAngle.dist));
      this._updateCamera();
    }, { passive:false });

    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    c.addEventListener('touchstart', onDown, { passive:false });
    c.addEventListener('touchmove', onMove, { passive:false });
    c.addEventListener('touchend', onUp);
  }

  _groundPointAt(x, y){
    const { clientWidth:w, clientHeight:h } = this.canvas;
    this.pointer.set((x/w)*2 - 1, -(y/h)*2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const target = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
    return this.raycaster.ray.intersectPlane(plane, target) ? target : null;
  }

  _pickItem(x, y){
    const { clientWidth:w, clientHeight:h } = this.canvas;
    this.pointer.set((x/w)*2 - 1, -(y/h)*2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // gather candidate meshes (descend item groups)
    const candidates = [];
    this.state.items.forEach(it => {
      if(it.mesh) it.mesh.traverse(ch => { if(ch.isMesh) { ch.userData.__item = it; candidates.push(ch); }});
    });
    const hits = this.raycaster.intersectObjects(candidates, false);
    if(hits.length){
      return hits[0].object.userData.__item || null;
    }
    return null;
  }

  _setSelected(item){
    this._selected = item;
    if(!this._selectBox) return;
    if(item && item.mesh){
      this._updateSelectBox();
      this._selectBox.visible = true;
    }else{
      this._selectBox.visible = false;
    }
  }
  _updateSelectBox(){
    if(!this._selected?.mesh) return;
    const box = new THREE.Box3().setFromObject(this._selected.mesh);
    this._selectBox.box.copy(box);
  }

  _applyItemTransform(item){
    if(!item.mesh){
      const def = FURNITURE_MAP[item.type];
      if(!def) return;
      const built = def.build();
      item.mesh = built.group;
      item._size = built.size;
      item._wall = built.wall || false;
      // tag all meshes
      item.mesh.traverse(ch => { if(ch.isMesh) ch.userData.__item = item; });
      this._room.add(item.mesh);
    }
    // Position
    if(item._wall && item.wallSide){
      const half = this.state.size/2 - 0.05;
      const wallY = (item.y || this.state.height/2);
      const rotByWall = {1:0, 2:-Math.PI/2, 3:Math.PI, 4:Math.PI/2};
      switch(item.wallSide){
        case 1: item.mesh.position.set(item.x, wallY, -half); break;
        case 2: item.mesh.position.set(half, wallY, item.z); break;
        case 3: item.mesh.position.set(item.x, wallY, half); break;
        case 4: item.mesh.position.set(-half, wallY, item.z); break;
      }
      item.mesh.rotation.y = rotByWall[item.wallSide] + (item.rotY||0);
    }else{
      item.mesh.position.set(item.x, item.y||0, item.z);
      item.mesh.rotation.y = item.rotY || 0;
    }
  }

  // === Public API ===
  addItem(type, x=0, z=0){
    const def = FURNITURE_MAP[type];
    if(!def) return null;
    const item = {
      id: this.nextId++,
      type,
      x: x, z: z, rotY: 0, wallSide: 0, y: 0,
    };
    if(def.build().wall){
      item.wallSide = 1;
      item.y = this.state.height/2;
      // get first free-ish position along wall
      item.x = 0; item.z = 0;
    }
    this.state.items.push(item);
    this._applyItemTransform(item);
    this._setSelected(item);
    this.onChange();
    return item;
  }

  rotateSelected(){
    if(!this._selected) return;
    this._selected.rotY = (this._selected.rotY || 0) + Math.PI/2;
    this._applyItemTransform(this._selected);
    this._updateSelectBox();
    this.onChange();
  }
  duplicateSelected(){
    if(!this._selected) return;
    const s = this._selected;
    const copy = {
      id: this.nextId++,
      type: s.type,
      x: s.x + 0.5, z: s.z + 0.5, rotY: s.rotY, wallSide: s.wallSide, y: s.y,
    };
    this.state.items.push(copy);
    this._applyItemTransform(copy);
    this._setSelected(copy);
    this.onChange();
  }
  deleteSelected(){
    if(!this._selected) return;
    const s = this._selected;
    this._room.remove(s.mesh);
    s.mesh?.traverse?.(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    this.state.items = this.state.items.filter(it => it !== s);
    this._setSelected(null);
    this.onChange();
  }

  setSize(size){
    this.state.size = size;
    // clamp items
    const lim = size/2 - 0.3;
    this.state.items.forEach(it => {
      it.x = Math.max(-lim, Math.min(lim, it.x));
      it.z = Math.max(-lim, Math.min(lim, it.z));
    });
    this._buildRoom();
    this.onChange();
  }
  setHeight(h){ this.state.height = h; this._buildRoom(); this.onChange(); }
  setFloorColor(c){ this.state.floorColor = c; this._buildRoom(); this.onChange(); }
  setWallColor(c){ this.state.wallColor = c; this._buildRoom(); this.onChange(); }
  setTheme(id){
    const t = THEME_MAP[id]; if(!t) return;
    this.state.theme = id;
    this.state.floorColor = t.floor;
    this.state.wallColor = t.wall;
    this._buildRoom();
    this.onChange();
  }
  setTitle(t){ this.state.title = t; this.onChange(); }

  getState(){ return JSON.parse(JSON.stringify({
    title:this.state.title, size:this.state.size, height:this.state.height,
    floorColor:this.state.floorColor, wallColor:this.state.wallColor, theme:this.state.theme,
    items: this.state.items.map(it => ({ type:it.type, x:it.x, z:it.z, rotY:it.rotY, wallSide:it.wallSide, y:it.y })),
  })); }
  loadState(s){
    // clear
    this.state.items.forEach(it => { if(it.mesh){ this._room.remove(it.mesh); }});
    this.state.items = [];
    Object.assign(this.state, {
      title: s.title || '',
      size: s.size || 10,
      height: s.height || 3,
      floorColor: s.floorColor || '#8b6f4e',
      wallColor: s.wallColor || '#f0e8dc',
      theme: s.theme || 'cozy',
    });
    this._buildRoom();
    (s.items || []).forEach(it => {
      const item = {
        id: this.nextId++,
        type: it.type, x: it.x, z: it.z, rotY: it.rotY||0, wallSide: it.wallSide||0, y: it.y||0,
      };
      this.state.items.push(item);
      this._applyItemTransform(item);
    });
  }

  _animate(){
    const tick = () => {
      this._rafId = requestAnimationFrame(tick);
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  dispose(){
    cancelAnimationFrame(this._rafId);
    this.renderer.dispose();
  }
}
