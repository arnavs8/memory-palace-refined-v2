import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
export const ASSETS = [
  "ArmChair_01",
  "wooden_table_02",
  "Sofa_01",
  "CoffeeTable_01",
  "ClassicConsole_01",
  "ClassicNightstand_01",
  "Rockingchair_01",
  "SchoolDesk_01",
  "SchoolChair_01",
  "Barrel_01",
  "Lantern_01",
  "Ukulele_01",
  "Camera_01",
  "Chandelier_01",
  "Ottoman_01",
  "Shelf_01",
];
export const ANCHOR_NAMES = [
  "The reading chair",
  "The oak table",
  "The velvet sofa",
  "The coffee table",
  "The console",
  "The nightstand",
  "The rocking chair",
  "The writing desk",
  "The school chair",
  "The barrel",
  "The lantern",
  "The ukulele",
  "The camera",
  "The chandelier",
  "The ottoman",
  "The shelf",
];
export const CARNIVAL_NAMES = [
  "Ticket booth",
  "Ring toss",
  "The carousel",
  "Prize counter",
  "Candy stall",
  "Fortune teller",
  "Music corner",
  "Game arcade",
  "Rest stop",
  "Barrel toss",
  "Lantern lane",
  "The bandstand",
  "Photo booth",
  "Ferris wheel",
  "Velvet lounge",
  "Curiosity shop",
];
export const positions = Array.from(
  { length: 16 },
  (_, i) =>
    new T.Vector3(
      [-7.5, -2.5, 2.5, 7.5][i % 4],
      0,
      [-9, -3, 3, 9][Math.floor(i / 4)],
    ),
);
type Options = {
  environment: "house" | "carnival";
  count: number;
  onSelect: (index: number) => void;
  onNear: (index: number | null) => void;
  onReady: () => void;
  onError: (message: string) => void;
  quality: "high" | "balanced";
};
export class PalaceScene {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(66, 1, 0.1, 180);
  renderer: T.WebGLRenderer;
  private markers: T.Group[] = [];
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private dragging = false;
  private disposed = false;
  private frame = 0;
  private near: number | null = null;
  private clock = new T.Clock();
  private abort = new AbortController();
  private resize: ResizeObserver;
  private interactive = true;
  private animations: ((dt: number) => void)[] = [];
  private textures: T.Texture[] = [];
  constructor(
    private host: HTMLElement,
    private options: Options,
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, options.quality === "high" ? 2 : 1.25),
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    host.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "3D memory palace. WASD to walk, drag to look, E to interact.",
    );
    this.renderer.domElement.tabIndex = 0;
    this.scene.background = new T.Color(
      options.environment === "house" ? "#d4dfdd" : "#202e47",
    );
    this.scene.fog = new T.Fog(this.scene.background, 35, 100);
    this.camera.position.set(0, 1.7, 13);
    this.scene.add(new T.HemisphereLight("#d9edff", "#82745b", 2));
    const sun = new T.DirectionalLight("#fff0d4", 3.5);
    sun.position.set(-12, 20, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(options.quality === "high" ? 2048 : 1024);
    Object.assign(sun.shadow.camera, {
      left: -22,
      right: 22,
      top: 22,
      bottom: -22,
      far: 60,
    });
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    this.buildEnvironment();
    this.makeMarkers();
    void this.loadModels();
    const signal = this.abort.signal;
    const canvas = this.renderer.domElement;
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (e.button !== 0) return;
        canvas.focus();
        this.dragging = true;
        canvas.setPointerCapture(e.pointerId);
      },
      { signal },
    );
    canvas.addEventListener(
      "pointerup",
      () => {
        this.dragging = false;
      },
      { signal },
    );
    canvas.addEventListener(
      "pointermove",
      (e) => {
        if (
          this.interactive &&
          (this.dragging || document.pointerLockElement === canvas)
        ) {
          this.yaw -= e.movementX * 0.0025;
          this.pitch = T.MathUtils.clamp(
            this.pitch - e.movementY * 0.0025,
            -1.3,
            1.3,
          );
        }
      },
      { signal },
    );
    window.addEventListener(
      "keydown",
      (e) => {
        if (
          !this.interactive ||
          (e.target instanceof HTMLElement &&
            e.target.matches("input,textarea,select"))
        )
          return;
        if (
          [
            "KeyW",
            "KeyA",
            "KeyS",
            "KeyD",
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
          ].includes(e.code)
        ) {
          e.preventDefault();
          this.keys.add(e.code);
        }
        if (e.code === "KeyE" && !e.repeat && this.near !== null)
          this.options.onSelect(this.near);
      },
      { signal },
    );
    window.addEventListener("keyup", (e) => this.keys.delete(e.code), {
      signal,
    });
    window.addEventListener("blur", () => this.keys.clear(), { signal });
    document.addEventListener("pointerlockchange", () => this.keys.clear(), {
      signal,
    });
    canvas.addEventListener(
      "webglcontextlost",
      (e) => {
        e.preventDefault();
        options.onError(
          "Graphics context lost. Return to the library and reopen the palace.",
        );
      },
      { signal },
    );
    this.resize = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    });
    this.resize.observe(host);
    this.tick();
  }
  private mat(color: string, metalness = 0, roughness = 0.6) {
    return new T.MeshStandardMaterial({ color, metalness, roughness });
  }
  private box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: T.Material,
    round = false,
  ) {
    const m = new T.Mesh(
      round
        ? new RoundedBoxGeometry(w, h, d, 3, 0.06)
        : new T.BoxGeometry(w, h, d),
      material,
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }
  private cylinder(
    r: number,
    rt: number,
    h: number,
    x: number,
    y: number,
    z: number,
    material: T.Material,
  ) {
    const m = new T.Mesh(new T.CylinderGeometry(rt, r, h, 48), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }
  private pbr(id: string, repeat: number) {
    const loader = new T.TextureLoader();
    const material = this.mat("#ffffff");
    for (const [channel, property] of [
      ["diff", "map"],
      ["nor_gl", "normalMap"],
      ["rough", "roughnessMap"],
    ] as const) {
      const tex = loader.load(
        `${import.meta.env.BASE_URL}assets/textures/${id}_${channel}.jpg`,
      );
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      tex.repeat.set(repeat, repeat);
      tex.anisotropy = 8;
      if (channel === "diff") tex.colorSpace = T.SRGBColorSpace;
      material[property] = tex;
      this.textures.push(tex);
    }
    return material;
  }
  private buildEnvironment() {
    const house = this.options.environment === "house";
    const brass = this.mat("#bd9252", 0.75, 0.25);
    const white = this.mat("#e9e2ce");
    const dark = this.mat("#233d38");
    this.box(
      25,
      0.25,
      32,
      0,
      -0.15,
      0,
      this.pbr(
        house ? "herringbone_parquet" : "concrete_floor_02",
        house ? 4 : 7,
      ),
    );
    if (house) {
      this.box(25, 5, 0.3, 0, 2.5, -16, white);
      this.box(0.3, 5, 32, -12.5, 2.5, 0, white);
      this.box(0.3, 1.1, 32, 12.5, 0.55, 0, dark);
      const ceiling = this.box(25, 0.15, 32, 0, 5.15, 0, this.mat("#f4f0e5"));
      ceiling.castShadow = false;
      for (const z of [-12, -6, 0, 6, 12])
        this.box(25, 0.24, 0.22, 0, 4.97, z, this.mat("#b8ac90"));
      for (let z = -14; z <= 14; z += 4) {
        this.box(0.3, 5, 0.22, 12.5, 2.5, z, dark);
        this.box(0.15, 0.15, 4, 12.5, 4, z + 2, dark);
      }
      for (let z = -12; z <= 12; z += 6) {
        this.box(0.12, 1.8, 2, -12.28, 2.65, z, brass);
        this.box(
          0.15,
          1.6,
          1.8,
          -12.18,
          2.65,
          z,
          this.mat(["#ac6b45", "#4b776c", "#a7a18c"][((z + 12) / 6) % 3]),
        );
      }
      this.box(25, 0.18, 0.18, 0, 4.8, -15.7, brass);
      this.box(0.18, 0.18, 32, -12.25, 4.8, 0, brass);
      for (const x of [-10, 10])
        for (const z of [-13, 0, 13]) {
          this.cylinder(0.17, 0.17, 4.8, x, 2.4, z, white);
          this.cylinder(0.27, 0.27, 0.18, x, 0.1, z, brass);
        }
      for (const z of [-9, 3])
        this.box(
          20,
          0.025,
          4,
          0,
          0.01,
          z,
          this.mat(z === -9 ? "#53766a" : "#b08465"),
        );
      for (let i = 0; i < 5; i++) {
        this.box(0.7, 0.1, 3, -11.8, 0.8 + i * 0.7, -7, dark);
        for (let b = 0; b < 12; b++)
          this.box(
            0.45,
            0.45,
            0.18,
            -11.8,
            1.08 + i * 0.7,
            -8.3 + b * 0.22,
            this.mat(["#576b56", "#a88255", "#6f3d35"][b % 3]),
          );
      }
      for (const z of [-12, 0, 12]) {
        const l = new T.PointLight("#ffcf86", 18, 10, 2);
        l.position.set(0, 4, z);
        this.scene.add(l);
        this.cylinder(0.7, 0.5, 0.2, 0, 4.5, z, brass);
        this.cylinder(
          0.5,
          0.5,
          0.05,
          0,
          4.38,
          z,
          new T.MeshStandardMaterial({
            color: "#fff2d2",
            emissive: "#ffcf86",
            emissiveIntensity: 2,
          }),
        );
      }
      // Garden outside the glazed east facade.
      this.box(24, 0.15, 50, 25, -0.3, 0, this.mat("#667b4f"));
      for (let z = -20; z < 25; z += 5) this.tree(18 + Math.sin(z) * 3, z);
    } else {
      this.box(8, 0.025, 30, 0, 0.01, 0, this.mat("#8f665e"));
      for (let i = 0; i < 16; i++) {
        const p = positions[i];
        const color = ["#b95751", "#527e76", "#a58144", "#64648e"][i % 4];
        this.box(3.8, 0.75, 2.6, p.x, 0.38, p.z, this.mat(color), true);
        for (const dx of [-1.7, 1.7])
          this.cylinder(0.055, 0.055, 3, p.x + dx, 1.5, p.z - 0.8, brass);
        const roof = new T.Mesh(
          new T.ConeGeometry(2.7, 1.3, 4),
          this.mat(color),
        );
        roof.rotation.y = Math.PI / 4;
        roof.position.set(p.x, 3.3, p.z);
        roof.castShadow = true;
        this.scene.add(roof);
        for (let b = 0; b < 7; b++) {
          const orb = new T.Mesh(
            new T.SphereGeometry(0.07, 12, 8),
            new T.MeshStandardMaterial({
              color: "#fff1c3",
              emissive: "#ffb957",
              emissiveIntensity: 3,
            }),
          );
          orb.position.set(p.x - 1.6 + b * 0.53, 2.75, p.z + 1.35);
          this.scene.add(orb);
        }
      }
      const wheel = new T.Group();
      wheel.position.set(0, 8, -22);
      this.scene.add(wheel);
      for (const r of [6, 6.3]) {
        const ring = new T.Mesh(new T.TorusGeometry(r, 0.08, 10, 128), brass);
        wheel.add(ring);
      }
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8;
        const spoke = new T.Mesh(
          new T.CylinderGeometry(0.035, 0.035, 12, 8),
          white,
        );
        spoke.rotation.z = a;
        wheel.add(spoke);
        const gondola = new T.Mesh(
          new RoundedBoxGeometry(0.9, 1, 0.7, 2, 0.08),
          this.mat(["#b95751", "#598a84", "#d8b76d"][i % 3]),
        );
        gondola.position.set(Math.cos(a) * 6, Math.sin(a) * 6, 0);
        wheel.add(gondola);
      }
      this.animations.push((dt) => {
        wheel.rotation.z += dt * 0.025;
      });
      for (const x of [-3, 3]) {
        const leg = this.cylinder(0.18, 0.18, 9, x, 4, -21.8, white);
        leg.rotation.z = x > 0 ? 0.35 : -0.35;
      }
      for (let z = -15; z <= 15; z += 5) {
        this.tree(-16, z);
        this.tree(16, z);
      }
      for (const x of [-11, 11])
        for (let z = -12; z <= 12; z += 6) {
          this.cylinder(0.08, 0.08, 4, x, 2, z, brass);
          const l = new T.PointLight("#ffd591", 16, 9, 2);
          l.position.set(x, 3.8, z);
          this.scene.add(l);
          const globe = new T.Mesh(
            new T.SphereGeometry(0.25, 24, 16),
            new T.MeshStandardMaterial({
              color: "#fff0bd",
              emissive: "#ffc96d",
              emissiveIntensity: 2,
            }),
          );
          globe.position.copy(l.position);
          this.scene.add(globe);
        }
    }
  }
  private tree(x: number, z: number) {
    this.cylinder(0.2, 0.13, 3, x, 1.5, z, this.mat("#735a3c"));
    for (let i = 0; i < 3; i++) {
      const leaves = new T.Mesh(
        new T.SphereGeometry(1.5 - i * 0.2, 24, 20),
        this.mat(["#3e5d40", "#52754b", "#638453"][i]),
      );
      leaves.scale.set(1, 1.2, 1);
      leaves.position.set(x + Math.sin(i) * 0.5, 3 + i * 0.65, z);
      leaves.castShadow = true;
      this.scene.add(leaves);
    }
  }
  private makeMarkers() {
    for (let i = 0; i < this.options.count; i++) {
      const group = new T.Group();
      group.position.copy(positions[i]);
      const ring = new T.Mesh(
        new T.TorusGeometry(1.35, 0.025, 8, 64),
        new T.MeshBasicMaterial({ color: "#d9ba77" }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      group.add(ring);
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#173c33";
      ctx.beginPath();
      ctx.arc(64, 64, 55, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#d9ba77";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = "500 46px sans-serif";
      ctx.fillStyle = "#fff8e5";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1).padStart(2, "0"), 64, 66);
      const tex = new T.CanvasTexture(canvas);
      this.textures.push(tex);
      const sprite = new T.Sprite(
        new T.SpriteMaterial({ map: tex, depthTest: false }),
      );
      sprite.position.y = this.options.environment === "house" ? 2.35 : 4.4;
      sprite.scale.set(0.65, 0.65, 1);
      group.add(sprite);
      this.scene.add(group);
      this.markers.push(group);
    }
  }
  private async loadModels() {
    const loader = new GLTFLoader();
    let failures = 0;
    await Promise.all(
      ASSETS.map(async (id, i) => {
        try {
          const gltf = await loader.loadAsync(
            `${import.meta.env.BASE_URL}assets/models/${id}/model.gltf`,
          );
          if (this.disposed) {
            this.disposeObject(gltf.scene);
            return;
          }
          const model = gltf.scene;
          const bounds = new T.Box3().setFromObject(model);
          const size = bounds.getSize(new T.Vector3());
          const center = bounds.getCenter(new T.Vector3());
          const scale =
            (["Sofa_01", "Shelf_01"].includes(id) ? 2.8 : 1.6) /
            Math.max(size.x, size.y, size.z);
          model.scale.setScalar(scale);
          const p = positions[i];
          model.position.set(
            p.x - center.x * scale,
            (this.options.environment === "house" ? 0 : 0.8) -
              bounds.min.y * scale,
            p.z - center.z * scale,
          );
          model.traverse((o) => {
            if (o instanceof T.Mesh) {
              o.castShadow = true;
              o.receiveShadow = true;
            }
          });
          this.scene.add(model);
        } catch {
          failures++;
        }
      }),
    );
    if (!this.disposed) {
      if (failures)
        this.options.onError(
          `${failures} props failed to load. Reinstall or restore the bundled assets.`,
        );
      this.options.onReady();
    }
  }
  setInteractive(value: boolean) {
    this.interactive = value;
    this.keys.clear();
    if (!value && document.pointerLockElement) document.exitPointerLock();
  }
  setTest(test: boolean) {
    this.markers.forEach((g) => {
      g.children[1].visible = !test;
    });
  }
  setVisited(indices: number[]) {
    this.markers.forEach((g, i) => {
      ((g.children[0] as T.Mesh).material as T.MeshBasicMaterial).color.set(
        indices.includes(i) ? "#76bd9b" : "#d9ba77",
      );
    });
  }
  jump(index: number) {
    const p = positions[index];
    if (!p) return;
    this.camera.position.set(p.x, 1.7, p.z + 2.4);
    this.yaw = 0;
    this.pitch = -0.08;
  }
  async lock() {
    try {
      await this.renderer.domElement.requestPointerLock();
    } catch {
      this.options.onError(
        "Mouse capture is unavailable. Drag in the scene to look around.",
      );
    }
  }
  private tick = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    if (this.interactive) {
      const x =
        Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
        Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"));
      const z =
        Number(this.keys.has("KeyS") || this.keys.has("ArrowDown")) -
        Number(this.keys.has("KeyW") || this.keys.has("ArrowUp"));
      const v = new T.Vector3(x, 0, z);
      if (v.lengthSq()) {
        v.normalize()
          .applyAxisAngle(new T.Vector3(0, 1, 0), this.yaw)
          .multiplyScalar(dt * 4);
        const can = (nx: number, nz: number) =>
          Math.abs(nx) < 11.4 &&
          Math.abs(nz) < 14.5 &&
          !positions.some(
            (p) => Math.abs(p.x - nx) < 1.45 && Math.abs(p.z - nz) < 1.6,
          );
        if (can(this.camera.position.x + v.x, this.camera.position.z))
          this.camera.position.x += v.x;
        if (can(this.camera.position.x, this.camera.position.z + v.z))
          this.camera.position.z += v.z;
      }
    }
    let nearest: number | null = null;
    let distance = 3.8;
    positions.slice(0, this.options.count).forEach((p, i) => {
      const d = Math.hypot(
        p.x - this.camera.position.x,
        p.z - this.camera.position.z,
      );
      if (d < distance) {
        distance = d;
        nearest = i;
      }
    });
    if (this.near !== nearest) {
      this.near = nearest;
      this.options.onNear(nearest);
    }
    this.animations.forEach((fn) => fn(dt));
    this.renderer.render(this.scene, this.camera);
  };
  private disposeObject(root: T.Object3D) {
    root.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.Sprite) {
        if (o instanceof T.Mesh) o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          for (const value of Object.values(m))
            if (value instanceof T.Texture) value.dispose();
          m.dispose();
        }
      }
    });
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.abort.abort();
    this.resize.disconnect();
    if (document.pointerLockElement === this.renderer.domElement)
      document.exitPointerLock();
    this.disposeObject(this.scene);
    this.textures.forEach((t) => t.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
