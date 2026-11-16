import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { Layout, Landmark } from "./layout";
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
  layout?: Layout;
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
  private positions: T.Vector3[];
  private walls: { x: number; z: number; w: number; d: number }[] = [];
  private decoration: {
    asset: string;
    x: number;
    z: number;
    y: number;
    size: number;
    rotation: number;
  }[] = [];
  private envTarget?: T.WebGLRenderTarget;
  private assetsLoaded=false;
  private lastPose='';
  private dirty=true;
  private lastFrame=0;
  constructor(
    private host: HTMLElement,
    private options: Options,
  ) {
    this.positions = options.layout
      ? options.layout.landmarks.map((p) => new T.Vector3(p.x, 0, p.z))
      : positions;
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
    this.scene.add(
      new T.HemisphereLight(
        "#d9edff",
        "#82745b",
        options.layout?.version === 2 ? 0.7 : 2,
      ),
    );
    if (options.layout) {
      const room = new RoomEnvironment();
      const pmrem = new T.PMREMGenerator(this.renderer);
      this.envTarget = pmrem.fromScene(room, 0.04);
      this.scene.environment = this.envTarget.texture;
      this.scene.environmentIntensity = 0.65;
      room.dispose();
      pmrem.dispose();
    }
    const sun = new T.DirectionalLight(
      "#fff0d4",
      options.layout ? (options.environment === "house" ? 2.1 : 0.65) : 3.5,
    );
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
    if (options.layout) this.buildFurnishedEnvironment();
    else this.buildEnvironment();
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
      this.dirty=true;
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
      group.position.copy(this.positions[i]);
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
      sprite.position.y = this.options.layout
        ? 2.5
        : this.options.environment === "house"
          ? 2.35
          : 4.4;
      sprite.scale.set(0.65, 0.65, 1);
      group.add(sprite);
      this.scene.add(group);
      this.markers.push(group);
    }
  }
  private buildFurnishedEnvironment() {
    const house = this.options.environment === "house";
    const cream = this.mat("#dfd5c0", 0, 0.82),
      walnut = this.mat("#4f3424", 0, 0.42),
      brass = this.mat("#b1955c", 0.78, 0.27);
    this.box(
      25,
      0.22,
      32,
      0,
      -0.14,
      0,
      this.pbr(house ? "herringbone_parquet" : "concrete_floor_02", 5),
    );
    const zoneColors = ["#254d43", "#8a6646", "#354f69", "#964f3c"];
    const centers = [
      [-7, -8.5],
      [7, -8.5],
      [-7, 8.5],
      [7, 8.5],
    ];
    const wall = (
      w: number,
      h: number,
      d: number,
      x: number,
      z: number,
      m: T.Material,
    ) => {
      this.box(w, h, d, x, h / 2, z, m);
      this.walls.push({ w, d, x, z });
    };
    const plaque = (
      text: string,
      x: number,
      y: number,
      z: number,
      rotation = 0,
    ) => {
      const c = document.createElement("canvas");
      c.width = 768;
      c.height = 192;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#273a30";
      ctx.fillRect(0, 0, 768, 192);
      ctx.strokeStyle = "#c3ac73";
      ctx.lineWidth = 5;
      ctx.strokeRect(12, 12, 744, 168);
      ctx.fillStyle = "#f0e3b9";
      ctx.font = "34px Georgia";
      ctx.textAlign = "center";
      ctx.fillText(text, 384, 109);
      const tex = new T.CanvasTexture(c);
      tex.colorSpace = T.SRGBColorSpace;
      this.textures.push(tex);
      const sign = new T.Mesh(
        new T.PlaneGeometry(2.5, 0.62),
        new T.MeshStandardMaterial({ map: tex, roughness: 0.7 }),
      );
      sign.position.set(x, y, z);
      sign.rotation.y = rotation;
      this.scene.add(sign);
    };
    if (house) {
      wall(25, 4.8, 0.25, 0, -15.8, cream);
      wall(25, 4.8, 0.25, 0, 15.8, cream);
      const ceiling = this.box(25, 0.16, 32, 0, 4.85, 0, this.mat("#e9e0ce"));
      ceiling.castShadow = false;
      // Four furnished rooms around a broad, navigable crossing. Door openings remain clear.
      for (const x of [-2, 2])
        for (const sign of [-1, 1]) {
          wall(0.24, 4.8, 4.2, x, sign * 4.1, cream);
          wall(0.24, 4.8, 5.5, x, sign * 13.05, cream);
          this.box(0.32, 0.7, 4.1, x, 4.45, sign * 8.25, cream);
          for (const z of [sign * 6.2, sign * 10.3]) {
            this.box(0.4, 4.1, 0.14, x, 2.05, z, walnut);
            this.box(0.46, 0.16, 0.22, x, 0.08, z, brass);
          }
        }
      for (const x of [-7, 7]) {
        wall(10, 4.8, 0.25, x, 0, cream);
      }
      // Outside walls alternate full-height windows and plaster piers.
      for (const x of [-12.4, 12.4]) {
        wall(0.25, 1, 32, x, 0, cream);
        this.box(0.28, 0.6, 32, x, 4.5, 0, cream);
        for (let z = -15; z <= 15; z += 3) {
          wall(0.35, 4.8, 0.28, x, z, cream);
          this.box(0.38, 0.08, 3, x, 1.1, z + 1.5, walnut);
          this.box(0.2, 0.07, 3, x, 3.9, z + 1.5, walnut);
          this.box(0.15, 2.8, 0.08, x, 2.5, z + 1.5, walnut);
        }
      }
      for (const [zone, [cx, cz]] of centers.entries()) {
        const color = zoneColors[zone];
        this.box(
          9.8,
          1.05,
          0.13,
          cx,
          0.53,
          cz < 0 ? -15.6 : 15.6,
          this.mat(color),
        );
        this.box(9.8, 0.07, 0.2, cx, 1.07, cz < 0 ? -15.5 : 15.5, brass);
        this.box(8.6, 0.035, 9.8, cx, 0.02, cz, this.mat(color, 0, 1), true);
        for (const side of [-1, 1])
          this.box(0.04, 0.015, 9.3, cx + side * 4.1, 0.047, cz, brass);
        for (const side of [-1, 1])
          this.box(8.2, 0.015, 0.04, cx, 0.047, cz + side * 4.65, brass);
        // Coffered ceiling and wall panelling make zones recognisable at eye level.
        for (const z of [cz - 4.5, cz, cz + 4.5])
          this.box(10, 0.2, 0.18, cx, 4.68, z, walnut);
        for (let b = 0; b < 5; b++) {
          this.box(
            1.65,
            0.65,
            0.08,
            cx - 3.9 + b * 1.95,
            0.54,
            cz < 0 ? -15.49 : 15.49,
            walnut,
          );
          this.box(
            1.5,
            0.5,
            0.09,
            cx - 3.9 + b * 1.95,
            0.54,
            cz < 0 ? -15.43 : 15.43,
            this.mat(color),
          );
        }
        this.painting(
          cx,
          2.65,
          cz < 0 ? -15.5 : 15.5,
          cz < 0 ? 0 : Math.PI,
          zone,
        );
        const light = new T.PointLight("#ffdc9e", 35, 14, 2);
        light.position.set(cx, 3.8, cz);
        this.scene.add(light);
        this.decoration.push({
          asset: "Chandelier_01",
          x: cx,
          z: cz,
          y: 3.65,
          size: 1.6,
          rotation: 0,
        });
        this.decoration.push({
          asset: "potted_plant_01",
          x: cx < 0 ? -11 : 11,
          z: cz < 0 ? -14 : 14,
          y: 0,
          size: 2.2,
          rotation: zone,
        });
        this.decoration.push({
          asset: "book_encyclopedia_set_01",
          x: cx < 0 ? -11 : 11,
          z: cz < 0 ? -8 : 8,
          y: 0.95,
          size: 1.2,
          rotation: Math.PI / 2,
        });
        this.box(
          0.9,
          0.9,
          2,
          cx < 0 ? -11 : 11,
          0.45,
          cz < 0 ? -8 : 8,
          walnut,
          true,
        );
        const title =
          this.options.layout!.landmarks[zone * 4]?.zone ||
          ["Jade library", "Amber study", "Blue salon", "Terracotta gallery"][
            zone
          ];
        plaque(
          title,
          cx < 0 ? -1.83 : 1.83,
          3.4,
          cz,
          cx < 0 ? Math.PI / 2 : -Math.PI / 2,
        );
      }
      this.decoration.push({
        asset: "vintage_grandfather_clock_01",
        x: 0,
        z: -14.4,
        y: 0,
        size: 2.8,
        rotation: 0,
      });
      this.decoration.push({
        asset: "ornate_mirror_01",
        x: 0,
        z: 15.45,
        y: 1.2,
        size: 2.1,
        rotation: Math.PI,
      });
      // Garden silhouettes use detailed leaf geometry from the bundled plant scans.
      this.box(70, 0.1, 70, 0, -0.3, 0, this.mat("#59684d"));
      for (const x of [-16, 16])
        for (const z of [-12, -4, 4, 12])
          this.decoration.push({
            asset: "potted_plant_02",
            x,
            z,
            y: 0,
            size: 4.2,
            rotation: z,
          });
      this.box(3.6, 0.02, 31, 0, 0.005, 0, this.pbr("concrete_floor_02", 5));
      for (const x of [-1.6, 1.6])
        this.box(0.04, 0.025, 31, x, 0.025, 0, brass);
    } else {
      this.box(80, 0.15, 80, 0, -0.3, 0, this.mat("#333f36"));
      this.box(3.7, 0.04, 32, 0, 0.01, 0, this.pbr("brick_wall_001", 7));
      for (const [zone, [cx, cz]] of centers.entries()) {
        const color = zoneColors[zone];
        // Curved fabric roofs: striped individual panels sag naturally between the supports.
        for (let stripe = 0; stripe < 16; stripe++) {
          const g = new T.PlaneGeometry(0.625, 13, 4, 32);
          const a = g.attributes.position;
          for (let n = 0; n < a.count; n++) {
            const lx = a.getX(n) + stripe * 0.625 - 4.6875;
            const lz = a.getY(n);
            a.setXYZ(
              n,
              lx,
              4.6 -
                Math.abs(lx) * 0.16 -
                0.16 * Math.sin(((lz + 6.5) / 13) * Math.PI),
              lz,
            );
          }
          g.computeVertexNormals();
          const roof = new T.Mesh(
            g,
            new T.MeshStandardMaterial({
              color: stripe % 2 ? "#d8c8a6" : color,
              side: T.DoubleSide,
              roughness: 1,
            }),
          );
          roof.position.set(cx, 0, cz);
          roof.castShadow = true;
          roof.receiveShadow = true;
          this.scene.add(roof);
        }
        for (const dx of [-4.8, 4.8])
          for (const dz of [-6.3, 6.3]) {
            this.cylinder(0.09, 0.075, 3.9, cx + dx, 1.95, cz + dz, brass);
            this.walls.push({ x: cx + dx, z: cz + dz, w: 0.18, d: 0.18 });
          }
        // Scalloped valances and woven side rails, instead of identical pyramids.
        for (let n = 0; n < 20; n++) {
          const scallop = new T.Mesh(
            new T.SphereGeometry(0.25, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
            this.mat(n % 2 ? color : "#d8c8a6"),
          );
          scallop.rotation.z = Math.PI;
          scallop.scale.set(1, 0.8, 0.15);
          scallop.position.set(cx - 4.75 + n * 0.5, 3.8, cz + 6.4);
          this.scene.add(scallop);
        }
        const outer = cx < 0 ? cx - 4.7 : cx + 4.7;
        this.box(0.12, 0.9, 12.6, outer, 0.45, cz, this.mat(color), true);
        for (let n = 0; n < 22; n++)
          this.box(0.18, 0.65, 0.035, outer, 0.48, cz - 6 + n * 0.57, brass);
        plaque(
          this.options.layout!.landmarks[zone * 4]?.zone || "Memory market",
          cx,
          3.05,
          cz + 6.42,
        );
        this.decoration.push({
          asset: "potted_plant_02",
          x: outer,
          z: cz < 0 ? -14 : 14,
          y: 0,
          size: 2.2,
          rotation: zone,
        });
        const light = new T.PointLight("#ffb968", 45, 16, 2);
        light.position.set(cx, 3.3, cz);
        this.scene.add(light);
        this.decoration.push({
          asset: "Lantern_01",
          x: cx,
          z: cz,
          y: 3.3,
          size: 0.65,
          rotation: 0,
        });
      }
      // Catenary festoon lights create a strong central route.
      for (const z of [-13, -6, 1, 8, 14]) {
        for (let n = 0; n < 25; n++) {
          const x = -11 + (n * 22) / 24;
          const y = 4.6 - 0.9 * Math.sin((n / 24) * Math.PI);
          const lamp = new T.Mesh(
            new T.SphereGeometry(0.075, 12, 10),
            new T.MeshStandardMaterial({
              color: "#fff0bd",
              emissive: "#ffb556",
              emissiveIntensity: 2.5,
            }),
          );
          lamp.position.set(x, y, z);
          this.scene.add(lamp);
        }
        const points = Array.from(
          { length: 49 },
          (_, n) =>
            new T.Vector3(
              -11 + (n * 22) / 48,
              4.65 - 0.9 * Math.sin((n / 48) * Math.PI),
              z,
            ),
        );
        const wire = new T.Mesh(
          new T.TubeGeometry(
            new T.CatmullRomCurve3(points),
            48,
            0.015,
            6,
            false,
          ),
          this.mat("#342a21"),
        );
        this.scene.add(wire);
      }
      const wheel = new T.Group();
      wheel.position.set(0, 9, -23);
      this.scene.add(wheel);
      for (const depth of [-0.6, 0.6]) {
        const ring = new T.Mesh(new T.TorusGeometry(6.6, 0.09, 12, 128), brass);
        ring.position.z = depth;
        wheel.add(ring);
      }
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6;
        const spoke = new T.Mesh(
          new T.CylinderGeometry(0.045, 0.045, 13.2, 12),
          cream,
        );
        spoke.rotation.z = angle;
        wheel.add(spoke);
        const cabin = new T.Group();
        cabin.position.set(Math.cos(angle) * 6.6, Math.sin(angle) * 6.6, 0);
        const body = new T.Mesh(
          new RoundedBoxGeometry(1, 1.1, 1, 4, 0.12),
          this.mat(zoneColors[i % 4]),
        );
        body.position.y = -0.3;
        cabin.add(body);
        const lid = new T.Mesh(
          new T.SphereGeometry(0.73, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
          brass,
        );
        lid.scale.y = 0.5;
        lid.position.y = 0.3;
        cabin.add(lid);
        wheel.add(cabin);
        this.animations.push(() => {
          cabin.rotation.z = -wheel.rotation.z;
        });
      }
      this.animations.push((dt) => (wheel.rotation.z += dt * 0.018));
      for (const x of [-3, 3]) {
        const leg = this.cylinder(0.2, 0.16, 10, x, 4.6, -23, cream);
        leg.rotation.z = x > 0 ? 0.32 : -0.32;
      }
      for (const x of [-15, 15])
        for (const z of [-14, -7, 0, 7, 14])
          this.decoration.push({
            asset: "potted_plant_02",
            x,
            z,
            y: 0,
            size: 3.5,
            rotation: z,
          });
    }
    for (const p of this.options.layout!.landmarks) {
      if (p.elevation) {
        const stone = this.pbr("concrete_floor_02", 1);
        this.box(
          1.35,
          p.elevation,
          1.2,
          p.x,
          p.elevation / 2,
          p.z,
          stone,
          true,
        );
        this.box(1.48, 0.06, 1.33, p.x, p.elevation + 0.02, p.z, brass, true);
      }
    }
  }
  private painting(
    x: number,
    y: number,
    z: number,
    rotation: number,
    theme: number,
  ) {
    const c = document.createElement("canvas");
    c.width = 768;
    c.height = 512;
    const ctx = c.getContext("2d")!;
    const skies = [
      ["#b7c9b8", "#e1cd99"],
      ["#d4a66c", "#e6d0a2"],
      ["#91aebc", "#d0d8cb"],
      ["#b6846f", "#d5ad83"],
    ];
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, skies[theme][0]);
    gradient.addColorStop(1, skies[theme][1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 768, 512);
    for (let layer = 0; layer < 5; layer++) {
      ctx.fillStyle = ["#829180", "#657f73", "#45665e", "#304d43", "#283b32"][
        layer
      ];
      ctx.beginPath();
      ctx.moveTo(0, 512);
      for (let i = 0; i <= 768; i += 8)
        ctx.lineTo(
          i,
          260 +
            layer * 40 +
            Math.sin(i * 0.009 + theme + layer * 1.7) * 35 +
            Math.sin(i * 0.017 + layer) * 22,
        );
      ctx.lineTo(768, 512);
      ctx.fill();
    }
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    this.textures.push(tex);
    const frame = new T.Group();
    frame.position.set(x, y, z);
    frame.rotation.y = rotation;
    const painting = new T.Mesh(
      new T.PlaneGeometry(3.1, 2),
      new T.MeshStandardMaterial({ map: tex, roughness: 0.9 }),
    );
    frame.add(painting);
    const mat = this.mat("#a68b50", 0.7, 0.3);
    for (const side of [-1, 1]) {
      const vertical = new T.Mesh(
        new RoundedBoxGeometry(0.11, 2.2, 0.1, 3, 0.025),
        mat,
      );
      vertical.position.set(side * 1.61, 0, 0);
      frame.add(vertical);
      const horizontal = new T.Mesh(
        new RoundedBoxGeometry(3.3, 0.11, 0.1, 3, 0.025),
        mat,
      );
      horizontal.position.set(0, side * 1.05, 0);
      frame.add(horizontal);
    }
    this.scene.add(frame);
  }
  private async loadFurnishedModels() {
    const loader = new GLTFLoader();
    const cache = new Map<string, Promise<T.Group>>();
    let failures = 0;
    const requests = [
      ...this.options.layout!.landmarks.map((p) => ({
        asset: p.asset,
        x: p.x,
        z: p.z,
        y: p.elevation + 0.05,
        size: p.size,
        rotation: p.rotation,
      })),
      ...this.decoration,
    ];
    for (const id of new Set(requests.map((r) => r.asset)))
      cache.set(
        id,
        loader
          .loadAsync(
            `${import.meta.env.BASE_URL}assets/models/${id}/model.gltf`,
          )
          .then((g) => g.scene),
      );
    await Promise.all(
      [...cache].map(async ([id, promise]) => {
        try {
          const template = await promise;
          if (this.disposed) {
            this.disposeObject(template);
            return;
          }
          for (const r of requests.filter((r) => r.asset === id)) {
            const model = template.clone(true);
            const bounds = new T.Box3().setFromObject(model);
            const size = bounds.getSize(new T.Vector3());
            const center = bounds.getCenter(new T.Vector3());
            const scale = r.size / Math.max(size.x, size.y, size.z);
            model.scale.setScalar(scale);
            model.position.set(
              -center.x * scale,
              -bounds.min.y * scale,
              -center.z * scale,
            );
            const group = new T.Group();
            group.add(model);
            group.position.set(r.x, r.y, r.z);
            group.rotation.y = r.rotation;
            group.traverse((o) => {
              if (o instanceof T.Mesh) {
                o.castShadow = true;
                o.receiveShadow = true;
              }
            });
            this.scene.add(group);
          }
        } catch {
          failures++;
        }
      }),
    );
    if (!this.disposed) {
      this.assetsLoaded=true;this.dirty=true;this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true;
      if (failures)
        this.options.onError(
          `${failures} detailed assets could not load. Restore the bundled asset files.`,
        );
      this.options.onReady();
    }
  }
  private async loadModels() {
    if (this.options.layout) {
      await this.loadFurnishedModels();
      return;
    }
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
    this.dirty=true;
    this.markers.forEach((g) => {
      g.children[1].visible = !test;
    });
  }
  setVisited(indices: number[]) {
    this.dirty=true;
    this.markers.forEach((g, i) => {
      ((g.children[0] as T.Mesh).material as T.MeshBasicMaterial).color.set(
        indices.includes(i) ? "#76bd9b" : "#d9ba77",
      );
    });
  }
  jump(index: number) {
    const p = this.positions[index];
    if (!p) return;
    const direction = this.options.layout ? (p.z > 0 ? -1 : 1) : 1;
    this.camera.position.set(p.x, 1.7, p.z + direction * 2.4);
    this.yaw = direction === 1 ? 0 : Math.PI;
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
    const now=performance.now();if(now-this.lastFrame<33)return;this.lastFrame=now;
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
          !this.positions.some(
            (p) => Math.abs(p.x - nx) < 1.45 && Math.abs(p.z - nz) < 1.6,
          ) &&
          !this.walls.some(
            (w) =>
              Math.abs(w.x - nx) < w.w / 2 + 0.3 &&
              Math.abs(w.z - nz) < w.d / 2 + 0.3,
          );
        if (can(this.camera.position.x + v.x, this.camera.position.z))
          this.camera.position.x += v.x;
        if (can(this.camera.position.x, this.camera.position.z + v.z))
          this.camera.position.z += v.z;
      }
    }
    let nearest: number | null = null;
    let distance = 3.8;
    this.positions.slice(0, this.options.count).forEach((p, i) => {
      const d = Math.hypot(
        p.x - this.camera.position.x,
        p.z - this.camera.position.z,
      );
      const blocked = this.walls.some((w) => {
        for (let n = 1; n < 10; n++) {
          const t = n / 10;
          const x = p.x + (this.camera.position.x - p.x) * t;
          const z = p.z + (this.camera.position.z - p.z) * t;
          if (Math.abs(w.x - x) < w.w / 2 && Math.abs(w.z - z) < w.d / 2)
            return true;
        }
        return false;
      });
      if (d < distance && !blocked) {
        distance = d;
        nearest = i;
      }
    });
    if (this.near !== nearest) {
      this.near = nearest;
      this.options.onNear(nearest);
    }
    const animate=this.interactive&&(!this.options.layout||this.camera.position.z<0);
    if(animate)this.animations.forEach((fn) => fn(dt));
    const pose=[this.camera.position.x,this.camera.position.z,this.yaw,this.pitch].join(',');
    if(this.assetsLoaded&&!this.dirty&&(!animate||!this.animations.length)&&pose===this.lastPose)return;
    this.lastPose=pose;this.dirty=false;
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
    this.envTarget?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
