/* =========================================================
   ÍNDICE (comentarios guía)
   =========================================================
   1) Importaciones (Three.js)
   2) UI (Interfaz y estado)
   3) Motor Three.js (Renderer + escena) (fix colorSpace)
   4) Cámaras (Cámara + OrbitControls) (bloqueo para no salir del fondo)
   5) Añadir Luces (Iluminación principal)
   6) Escenario (Grupo ground + constantes ring)
   7) Fondo tipo estadio con 4 fotos (cada imagen 1 vez en un cilindro 360)
   8) Boxeo (Construcción del ring) + suelo gris oscuro liso
   9) Focos grandes tipo torre (como la foto) en las 4 esquinas del ring
  10) Control global de luminosidad (slider/rueda)
  11) Modelo (Medidas + encuadre)
  12) Cámaras (Vistas: frente/detrás/izquierda/derecha)
  13) Escenario (Alineación ring a los pies)
  14) Carga (FBX + animación)
  15) Movimiento e interacción (Bailar/Parar)
  16) Cámaras (Interacción botones)
  17) EXTRA: Movimiento WASD
  18) Render (Resize + loop) (clamp cámara dentro del fondo)
   ========================================================= */

/* =========================================================
   1) Importaciones (Three.js)
   ========================================================= */
import * as THREE from "three";
import { OrbitControls } from "jsm/controls/OrbitControls.js";
import { FBXLoader } from "jsm/loaders/FBXLoader.js";

/* Aquí se indica la ruta del modelo FBX que se va a cargar */
const FBX_PATH = "./assets/models/hiphopdavid.fbx";

/* =========================================================
   2) UI (Interfaz y estado)
   ========================================================= */
/* Aquí se capturan los elementos del panel para poder controlarlos desde JavaScript */
const btnToggle = document.querySelector("#btnToggle");
const camFront = document.querySelector("#camFront");
const camRight = document.querySelector("#camRight");
const camLeft = document.querySelector("#camLeft");
const camBack = document.querySelector("#camBack");

/* Aquí se capturan el slider de luz y el texto del porcentaje */
const lightLevel = document.querySelector("#lightLevel");
const lightValue = document.querySelector("#lightValue");

/* Aquí se crea un overlay para mostrar estado de carga y posibles errores */
const statusEl = document.createElement("div");
statusEl.style.cssText = `
  position:fixed; top:12px; right:12px; z-index:9999;
  padding:10px 12px; border-radius:10px;
  background:rgba(0,0,0,.55); color:#fff; font:12px/1.35 system-ui,Arial;
  max-width:520px; backdrop-filter: blur(6px);
`;
statusEl.textContent = "Iniciando...";
document.body.appendChild(statusEl);

/* Aquí se bloquea la UI hasta que el modelo esté listo */
btnToggle.disabled = true;
btnToggle.textContent = "Cargando...";
[camFront, camRight, camLeft, camBack].forEach((b) => (b.disabled = true));

/* Aquí se deja el control de luz inactivo hasta capturar las luces de la escena */
if (lightLevel) lightLevel.disabled = true;
if (lightValue) lightValue.textContent = "100%";

/* =========================================================
   3) Motor Three.js (Renderer + escena)
   ========================================================= */
/* Aquí se prepara el renderer y se activan sombras */
const canvas = document.querySelector("#c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

/* Aquí se fuerza el espacio de color correcto para evitar texturas oscuras */
renderer.outputColorSpace = THREE.SRGBColorSpace;

/* Aquí se crea la escena con fondo oscuro y niebla suave */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);
scene.fog = new THREE.Fog(0x05060a, 10, 60);

/* =========================================================
   4) Cámaras (Cámara + OrbitControls) (bloqueo para no salir del fondo)
   ========================================================= */
/* Aquí se configura la cámara perspectiva */
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 600);
camera.position.set(0, 1.8, 4.5);

/* Aquí se añaden controles orbit y se limita el comportamiento */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;        /* Aquí se bloquea el paneo para no “salirse” del fondo */
controls.minPolarAngle = 0.2;
controls.maxPolarAngle = Math.PI / 2;
controls.minDistance = 2.0;
/* Aquí se deja un maxDistance relativamente bajo para no poder salir del cilindro */
controls.maxDistance = 16.0;

/* =========================================================
   5) Añadir Luces (Iluminación principal)
   ========================================================= */
/* Aquí se añade una base de luz ambiental */
scene.add(new THREE.AmbientLight(0xffffff, 0.68));

/* Aquí se añade una hemisférica para suavizar sombras */
scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 0.55));

/* Aquí se crean direccionales con sombras para dar volumen al ring */
function makeDirLight(x, y, z, intensity) {
  const l = new THREE.DirectionalLight(0xffffff, intensity);
  l.position.set(x, y, z);
  l.castShadow = true;
  l.shadow.mapSize.set(2048, 2048);
  l.shadow.camera.near = 0.5;
  l.shadow.camera.far = 90;
  l.shadow.camera.left = -30;
  l.shadow.camera.right = 30;
  l.shadow.camera.top = 30;
  l.shadow.camera.bottom = -30;
  scene.add(l);
  return l;
}

makeDirLight(0, 12, 12, 1.25);
makeDirLight(0, 12, -12, 0.85);
makeDirLight(-12, 12, 0, 0.95);
makeDirLight(12, 12, 0, 0.95);

/* Aquí se añade un punto cenital */
const overhead = new THREE.PointLight(0xffffff, 2.1, 90);
overhead.position.set(0, 10.0, 0);
overhead.castShadow = true;
scene.add(overhead);

/* =========================================================
   6) Escenario (Grupo ground + constantes ring)
   ========================================================= */
/* Aquí se mete todo dentro del grupo ground para ajustar la altura de golpe */
const ground = new THREE.Group();
scene.add(ground);

/* Aquí se dejan fijas las constantes obligatorias del ring */
const RING_TOP_Y = 0.355;
const GROUND_NUDGE = 0.87;
let baseGroundY = 0;

/* =========================================================
   7) Fondo tipo estadio con 4 fotos (cada imagen 1 vez en un cilindro 360)
   ========================================================= */
/* Aquí se definen las cuatro imágenes que se van a usar en el fondo */
const BG_IMAGES = {
  front: "./assets/img/bg-front.jpg",
  right: "./assets/img/bg-right.jpg",
  back: "./assets/img/bg-back.jpg",
  left: "./assets/img/bg-left.jpg",
};

/* Aquí se guardan medidas del cilindro para poder limitar la cámara después */
const STADIUM_R = 19;
const STADIUM_H = 14;
const STADIUM_Y = 7.2;

/* Aquí se define el radio máximo permitido para la cámara (para no salir del fondo) */
const CAMERA_R_LIMIT = STADIUM_R - 1.3;

/* Aquí se crean 4 cuartos de cilindro, uno por cada imagen, sin repetir */
function createStadiumCylinder4() {
  const grp = new THREE.Group();
  ground.add(grp);

  const texLoader = new THREE.TextureLoader();

  /* Aquí se decide si se aplica un flip horizontal (útil cuando se ve espejado desde dentro) */
  const FLIP_X = true;

  /* Aquí se crea el material base para que la foto se vea siempre (no depende de luces) */
  function makePhotoMat() {
    return new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.BackSide,
      toneMapped: false,
    });
  }

  function loadTexture(url, onLoad, name) {
    texLoader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;

        const maxAniso = renderer.capabilities.getMaxAnisotropy
          ? renderer.capabilities.getMaxAnisotropy()
          : 1;
        tex.anisotropy = maxAniso;

        if (FLIP_X) {
          tex.repeat.set(-1, 1);
          tex.offset.set(1, 0);
        }

        onLoad(tex);
      },
      undefined,
      () => console.warn(`[Backdrops] No se pudo cargar: ${name} -> ${url}`)
    );
  }

  function addQuarter(name, url, thetaStart) {
    const mat = makePhotoMat();
    const geo = new THREE.CylinderGeometry(STADIUM_R, STADIUM_R, STADIUM_H, 64, 1, true, thetaStart, Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = STADIUM_Y;
    grp.add(mesh);

    loadTexture(
      url,
      (tex) => {
        mat.map = tex;
        mat.needsUpdate = true;
      },
      name
    );
  }

  /* Aquí se colocan 4 cuartos (cada imagen se usa exactamente una vez) */
  addQuarter("back", BG_IMAGES.back, (7 * Math.PI) / 4);
  addQuarter("right", BG_IMAGES.right, Math.PI / 4);
  addQuarter("front", BG_IMAGES.front, (3 * Math.PI) / 4);
  addQuarter("left", BG_IMAGES.left, (5 * Math.PI) / 4);

  /* Aquí se añade un “haze” para disimular uniones y evitar bordes negros */
  const haze = new THREE.Mesh(
    new THREE.CylinderGeometry(STADIUM_R + 1.2, STADIUM_R + 1.2, STADIUM_H + 2.5, 64, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x05060a,
      transparent: true,
      opacity: 0.5,
      side: THREE.BackSide,
      toneMapped: false,
    })
  );
  haze.position.y = STADIUM_Y;
  grp.add(haze);

  /* Aquí se cierra la parte superior para que no se vea “fuera” del cilindro */
  const topCap = new THREE.Mesh(
    new THREE.CircleGeometry(STADIUM_R + 1.1, 64),
    new THREE.MeshBasicMaterial({ color: 0x05060a, side: THREE.BackSide, toneMapped: false })
  );
  topCap.position.y = STADIUM_Y + STADIUM_H / 2 + 0.01;
  topCap.rotation.x = Math.PI / 2;
  grp.add(topCap);

  /* Aquí se cierra la parte inferior para evitar que se vea negro por debajo */
  const bottomCap = new THREE.Mesh(
    new THREE.CircleGeometry(STADIUM_R + 1.1, 64),
    new THREE.MeshBasicMaterial({ color: 0x05060a, side: THREE.BackSide, toneMapped: false })
  );
  bottomCap.position.y = 0.02;
  bottomCap.rotation.x = -Math.PI / 2;
  grp.add(bottomCap);

  return grp;
}

/* Aquí se crea el fondo circular usando las 4 fotos (una vez cada una) */
createStadiumCylinder4();

/* =========================================================
   8) Boxeo (Construcción del ring) + suelo gris oscuro liso
   ========================================================= */
function createBoxingRing() {
  const ring = new THREE.Group();
  ground.add(ring);

  /* Aquí se crea el suelo exterior en gris oscuro liso */
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x2f343a,
    roughness: 0.95,
    metalness: 0.0,
  });

  const outer = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), floorMat);
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = 0.0;
  outer.receiveShadow = true;
  ring.add(outer);

  /* Aquí se crea la plataforma del ring */
  const matPlatform = new THREE.MeshStandardMaterial({
    color: 0x262b33,
    roughness: 0.95,
    metalness: 0.0,
  });
  const platform = new THREE.Mesh(new THREE.BoxGeometry(12, 0.35, 12), matPlatform);
  platform.position.y = 0.175;
  platform.receiveShadow = true;
  platform.castShadow = true;
  ring.add(platform);

  /* Aquí se crea la lona superior del ring */
  const matCanvas = new THREE.MeshStandardMaterial({
    color: 0x2e343e,
    roughness: 0.95,
    metalness: 0.0,
  });
  const canvasTop = new THREE.Mesh(new THREE.PlaneGeometry(10.6, 10.6), matCanvas);
  canvasTop.rotation.x = -Math.PI / 2;
  canvasTop.position.y = RING_TOP_Y;
  canvasTop.receiveShadow = true;
  ring.add(canvasTop);

  /* Aquí se crea el faldón alrededor */
  const matApron = new THREE.MeshStandardMaterial({
    color: 0x12161d,
    roughness: 1.0,
    metalness: 0.0,
  });
  const apronH = 0.55;
  const apronT = 0.18;
  const half = 10.9 / 2;

  const sideGeoA = new THREE.BoxGeometry(10.9, apronH, apronT);
  const front = new THREE.Mesh(sideGeoA, matApron);
  front.position.set(0, 0.35, half);
  front.castShadow = true;
  ring.add(front);

  const back = front.clone();
  back.position.set(0, 0.35, -half);
  ring.add(back);

  const sideGeoB = new THREE.BoxGeometry(apronT, apronH, 10.9);
  const left = new THREE.Mesh(sideGeoB, matApron);
  left.position.set(-half, 0.35, 0);
  left.castShadow = true;
  ring.add(left);

  const right = left.clone();
  right.position.set(half, 0.35, 0);
  right.castShadow = true;
  ring.add(right);

  /* Aquí se añaden los postes */
  const postMat = new THREE.MeshStandardMaterial({ color: 0x0f141b, roughness: 0.55, metalness: 0.25 });
  const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.35, 20);

  function addPost(x, z) {
    const p = new THREE.Mesh(postGeo, postMat);
    p.position.set(x, 1.25, z);
    p.castShadow = true;
    ring.add(p);
  }

  const corner = 5.25;
  addPost(-corner, -corner);
  addPost(corner, -corner);
  addPost(-corner, corner);
  addPost(corner, corner);

  /* Aquí se construyen las cuerdas */
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.7, metalness: 0.0 });
  const ropeRadius = 0.035;
  const ropeHeights = [0.65, 1.05, 1.45];

  function ropeBetween(a, b, y) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);

    const geo = new THREE.CylinderGeometry(ropeRadius, ropeRadius, len, 16);
    const mesh = new THREE.Mesh(geo, ropeMat);
    mesh.position.set(mid.x, y, mid.z);

    const up = new THREE.Vector3(0, 1, 0);
    const nd = dir.clone().normalize();
    let axis = new THREE.Vector3().crossVectors(up, nd);
    const axisLen = axis.length();

    if (axisLen < 1e-6) {
      mesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0);
    } else {
      axis.normalize();
      const angle = Math.acos(THREE.MathUtils.clamp(up.dot(nd), -1, 1));
      mesh.quaternion.setFromAxisAngle(axis, angle);
    }

    mesh.castShadow = true;
    ring.add(mesh);
  }

  const p1 = new THREE.Vector3(-corner, 0, -corner);
  const p2 = new THREE.Vector3(corner, 0, -corner);
  const p3 = new THREE.Vector3(corner, 0, corner);
  const p4 = new THREE.Vector3(-corner, 0, corner);

  for (const y of ropeHeights) {
    ropeBetween(p1, p2, y);
    ropeBetween(p2, p3, y);
    ropeBetween(p3, p4, y);
    ropeBetween(p4, p1, y);
  }

  /* Aquí se colocan los pads */
  const padGeo = new THREE.BoxGeometry(0.3, 0.24, 0.3);
  const padRed = new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.8, metalness: 0.0 });
  const padBlue = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.8, metalness: 0.0 });

  function addPad(x, z, mat) {
    const pad = new THREE.Mesh(padGeo, mat);
    pad.position.set(x, 1.1, z);
    pad.castShadow = true;
    ring.add(pad);
  }

  addPad(-corner, -corner, padRed);
  addPad(corner, -corner, padBlue);
  addPad(-corner, corner, padBlue);
  addPad(corner, corner, padRed);

  return { ring, corner };
}

/* Aquí se construye el ring completo y se guarda el valor de corner */
const ringBuilt = createBoxingRing();
const RING_CORNER = ringBuilt.corner;

/* =========================================================
   9) Focos grandes tipo torre (como la foto) en las 4 esquinas del ring
   ========================================================= */
/* Aquí se crea una torre alta con una pantalla de focos rectangular en la parte superior */
function createFloodlightTowers() {
  const grp = new THREE.Group();
  ground.add(grp);

  /* Aquí se crea un target común en el centro del ring */
  const target = new THREE.Object3D();
  target.position.set(0, 1.3, 0);
  ground.add(target);

  /* Aquí se definen materiales parecidos a una farola de estadio */
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.75, metalness: 0.25 });
  const bracketMat = new THREE.MeshStandardMaterial({ color: 0x0e1116, roughness: 0.65, metalness: 0.30 });

  /* Aquí se define el material de los focos, con emisión para que parezcan encendidos */
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xf3f4f6,
    roughness: 0.25,
    metalness: 0.05,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 3.2,
    toneMapped: false,
  });

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.7, metalness: 0.20 });

  /* Aquí se definen medidas aproximadas para parecerse a la foto */
  const POLE_H = 10.5;
  const POLE_R = 0.12;

  const PANEL_W = 3.2;
  const PANEL_H = 1.9;
  const PANEL_D = 0.22;

  /* Aquí se crea una torre completa (poste + brazo + panel + luces reales) */
  function addTower(signX, signZ) {
    /* Aquí se coloca un poco fuera de la esquina para dar espacio al cono */
    const outward = 3.2;
    const x = signX * (RING_CORNER + outward);
    const z = signZ * (RING_CORNER + outward);

    /* Aquí se añade el poste principal */
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(POLE_R, POLE_R * 0.92, POLE_H, 18),
      poleMat
    );
    pole.position.set(x, POLE_H / 2, z);
    pole.castShadow = true;
    grp.add(pole);

    /* Aquí se añade un pequeño bloque de base */
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(POLE_R * 1.35, POLE_R * 1.6, 0.35, 18),
      bracketMat
    );
    base.position.set(x, 0.18, z);
    base.castShadow = true;
    grp.add(base);

    /* Aquí se añade un brazo superior para sostener el panel */
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.18), bracketMat);
    arm.position.set(x, POLE_H - 0.55, z);
    arm.castShadow = true;
    grp.add(arm);

    /* Aquí se decide hacia dónde mira el panel (hacia el centro del ring) */
    const look = new THREE.Vector3(0, POLE_H - 0.65, 0).sub(new THREE.Vector3(x, POLE_H - 0.65, z)).normalize();
    const yaw = Math.atan2(look.x, look.z);

    /* Aquí se crea el marco del panel */
    const frame = new THREE.Mesh(new THREE.BoxGeometry(PANEL_W + 0.18, PANEL_H + 0.18, PANEL_D + 0.10), frameMat);
    frame.position.set(x, POLE_H - 0.65, z);
    frame.rotation.y = yaw;
    frame.castShadow = true;
    grp.add(frame);

    /* Aquí se crea el panel “blanco” que simula el conjunto de focos */
    const panel = new THREE.Mesh(new THREE.BoxGeometry(PANEL_W, PANEL_H, PANEL_D), lampMat);
    panel.position.set(x, POLE_H - 0.65, z);
    panel.rotation.y = yaw;
    panel.castShadow = false;
    grp.add(panel);

    /* Aquí se dibuja una parrilla de luminarias pequeñas en el frontal del panel */
    const bulbs = new THREE.Group();
    bulbs.position.set(x, POLE_H - 0.65, z);
    bulbs.rotation.y = yaw;
    grp.add(bulbs);

    const bulbGeo = new THREE.PlaneGeometry(0.26, 0.18);
    const bulbRows = 4;
    const bulbCols = 6;

    for (let r = 0; r < bulbRows; r++) {
      for (let c = 0; c < bulbCols; c++) {
        const bulb = new THREE.Mesh(bulbGeo, lampMat);
        const u = (c / (bulbCols - 1) - 0.5) * (PANEL_W * 0.86);
        const v = (0.5 - r / (bulbRows - 1)) * (PANEL_H * 0.78);
        bulb.position.set(u, v, PANEL_D / 2 + 0.12);
        bulbs.add(bulb);
      }
    }

    /* Aquí se añade la luz real que ilumina el ring (spot grande como foco de estadio) */
    const spot = new THREE.SpotLight(
      0xffffff,
      6.2,
      95,
      THREE.MathUtils.degToRad(28),
      0.35,
      1.1
    );
    spot.position.set(x, POLE_H - 0.55, z);
    spot.target = target;

    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.camera.near = 0.2;
    spot.shadow.camera.far = 140;

    grp.add(spot);

    /* Aquí se añade un fill suave para que el foco no quede “cortado” en sombras duras */
    const fill = new THREE.PointLight(0xffffff, 1.35, 55);
    fill.position.set(x, POLE_H - 0.75, z);
    fill.castShadow = false;
    grp.add(fill);

    return { pole, panel, spot, fill };
  }

  /* Aquí se crean las 4 torres (una por esquina) */
  addTower(-1, -1);
  addTower(1, -1);
  addTower(-1, 1);
  addTower(1, 1);

  return grp;
}

createFloodlightTowers();

/* =========================================================
   10) Control global de luminosidad (slider/rueda)
   ========================================================= */
const lightBases = [];
let lightPct = 100;

function updateLightUI() {
  if (lightValue) lightValue.textContent = `${Math.round(lightPct)}%`;
  if (lightLevel) lightLevel.value = String(Math.round(lightPct));
}

function applyLightPct() {
  const mul = lightPct / 100;
  for (const it of lightBases) it.light.intensity = it.base * mul;
  updateLightUI();
}

function setLightPct(nextPct) {
  lightPct = THREE.MathUtils.clamp(nextPct, 20, 250);
  applyLightPct();
}

function initLightControl() {
  lightBases.length = 0;
  scene.traverse((o) => {
    if (o && o.isLight && typeof o.intensity === "number") {
      lightBases.push({ light: o, base: o.intensity });
    }
  });

  if (lightLevel) {
    lightLevel.disabled = lightBases.length === 0;
    updateLightUI();

    lightLevel.addEventListener("input", () => {
      setLightPct(Number(lightLevel.value));
    });

    lightLevel.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const dir = e.deltaY > 0 ? -1 : 1;
        setLightPct(lightPct + dir * 5);
      },
      { passive: false }
    );
  }

  applyLightPct();
}

initLightControl();

/* =========================================================
   11) Modelo (Medidas + encuadre)
   ========================================================= */
const tmpBox = new THREE.Box3();

let modelCenter = new THREE.Vector3(0, 1, 0);
let modelRadius = 1.0;
let faceY = 1.6;
let modelHeight = 1.75;

function autoFrameObject(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);

  const height = Math.max(size.y, 1e-6);
  const desiredHeight = 1.75;
  obj.scale.multiplyScalar(desiredHeight / height);

  box.setFromObject(obj);
  const center = new THREE.Vector3();
  box.getCenter(center);
  obj.position.x -= center.x;
  obj.position.z -= center.z;

  box.setFromObject(obj);
  const h = box.max.y - box.min.y;
  const faceYLocal = box.min.y + h * 0.85;

  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);

  return { center: sphere.center.clone(), radius: Math.max(sphere.radius, 0.001), faceY: faceYLocal, height: h };
}

/* =========================================================
   12) Cámaras (Vistas: frente/detrás/izquierda/derecha)
   ========================================================= */
function setCameraView(view) {
  const distByRadius = modelRadius * 2.7;
  const distByHeight = (modelHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))) * 1.25;
  const dist = Math.max(distByRadius, distByHeight);

  const cx = (model ? model.position.x : 0) + modelCenter.x;
  const cz = (model ? model.position.z : 0) + modelCenter.z;
  const cy = (model ? model.position.y : 0) + faceY;

  controls.target.set(cx, cy, cz);
  const camY = cy;

  if (view === "front") camera.position.set(cx, camY, cz + dist);
  if (view === "back") camera.position.set(cx, camY, cz - dist);
  if (view === "left") camera.position.set(cx - dist, camY, cz);
  if (view === "right") camera.position.set(cx + dist, camY, cz);

  camera.near = Math.max(0.01, modelRadius / 120);
  camera.far = Math.max(220, modelRadius * 260);
  camera.updateProjectionMatrix();
  controls.update();
}

/* =========================================================
   13) Escenario (Alineación ring a los pies)
   ========================================================= */
function lockRingToFeetOnce(obj) {
  obj.updateMatrixWorld(true);
  tmpBox.setFromObject(obj);
  const minY = tmpBox.min.y;

  baseGroundY = minY - RING_TOP_Y + GROUND_NUDGE;
  ground.position.y = baseGroundY;
}

/* =========================================================
   14) Carga (FBX + animación)
   ========================================================= */
const loader = new FBXLoader();

let model = null;
let mixer = null;
let action = null;
let isPlaying = false;

statusEl.textContent = "Cargando hiphopdavid.fbx...";

loader.load(
  FBX_PATH,
  (obj) => {
    model = obj;

    model.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
      }
    });

    model.position.set(0, 0, 0);
    scene.add(model);

    const framed = autoFrameObject(model);
    modelCenter = framed.center;
    modelRadius = framed.radius;
    faceY = framed.faceY;
    modelHeight = framed.height;

    setCameraView("front");

    if (!obj.animations || obj.animations.length === 0) {
      statusEl.textContent = "El FBX cargó pero no trae animación dentro.";
      btnToggle.textContent = "Sin animación";
      btnToggle.disabled = true;
      return;
    }

    mixer = new THREE.AnimationMixer(model);
    action = mixer.clipAction(obj.animations[0]);

    action.reset();
    action.play();
    action.paused = true;
    isPlaying = false;

    mixer.update(0);
    lockRingToFeetOnce(model);

    btnToggle.disabled = false;
    btnToggle.textContent = "Bailar";
    statusEl.textContent = "Listo.";

    [camFront, camRight, camLeft, camBack].forEach((b) => (b.disabled = false));
  },
  (xhr) => {
    if (xhr && xhr.total) {
      const pct = ((xhr.loaded / xhr.total) * 100).toFixed(1);
      statusEl.textContent = `Cargando hiphopdavid.fbx... ${pct}%`;
    }
  },
  (err) => {
    console.error(err);
    statusEl.textContent =
      "Error cargando el FBX. Se debe revisar Live Server y la ruta ./assets/models/hiphopdavid.fbx.";
    btnToggle.textContent = "Error";
    btnToggle.disabled = true;
  }
);

/* =========================================================
   15) Movimiento e interacción (Bailar/Parar)
   ========================================================= */
btnToggle.addEventListener("click", () => {
  if (!action) return;

  if (isPlaying) {
    action.paused = true;
    isPlaying = false;
    btnToggle.textContent = "Bailar";
    btnToggle.classList.remove("is-playing");
    statusEl.textContent = "Parado.";
  } else {
    action.paused = false;
    isPlaying = true;
    btnToggle.textContent = "Parar";
    btnToggle.classList.add("is-playing");
    statusEl.textContent = "Bailando.";
  }
});

/* =========================================================
   16) Cámaras (Interacción botones)
   ========================================================= */
camFront.addEventListener("click", () => setCameraView("front"));
camBack.addEventListener("click", () => setCameraView("back"));
camLeft.addEventListener("click", () => setCameraView("left"));
camRight.addEventListener("click", () => setCameraView("right"));

/* =========================================================
   17) EXTRA: Movimiento WASD
   ========================================================= */
const keys = { w: false, a: false, s: false, d: false };

const vForward = new THREE.Vector3();
const vRight = new THREE.Vector3();
const vMove = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const MOVE_SPEED = 2.8;
const RING_LIMIT = 4.9;

window.addEventListener(
  "keydown",
  (e) => {
    if (e.code === "KeyW") keys.w = true;
    if (e.code === "KeyA") keys.a = true;
    if (e.code === "KeyS") keys.s = true;
    if (e.code === "KeyD") keys.d = true;

    if (e.code === "KeyW" || e.code === "KeyA" || e.code === "KeyS" || e.code === "KeyD") {
      e.preventDefault();
    }
  },
  { passive: false }
);

window.addEventListener(
  "keyup",
  (e) => {
    if (e.code === "KeyW") keys.w = false;
    if (e.code === "KeyA") keys.a = false;
    if (e.code === "KeyS") keys.s = false;
    if (e.code === "KeyD") keys.d = false;

    if (e.code === "KeyW" || e.code === "KeyA" || e.code === "KeyS" || e.code === "KeyD") {
      e.preventDefault();
    }
  },
  { passive: false }
);

function updateWASD(dt) {
  if (!model) return;

  const f = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
  const r = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  if (f === 0 && r === 0) return;

  camera.getWorldDirection(vForward);
  vForward.y = 0;
  if (vForward.lengthSq() < 1e-6) return;
  vForward.normalize();

  vRight.crossVectors(vForward, UP).normalize();

  vMove.set(0, 0, 0);
  vMove.addScaledVector(vForward, f);
  vMove.addScaledVector(vRight, r);
  if (vMove.lengthSq() < 1e-6) return;
  vMove.normalize();

  model.position.x += vMove.x * MOVE_SPEED * dt;
  model.position.z += vMove.z * MOVE_SPEED * dt;

  model.position.x = THREE.MathUtils.clamp(model.position.x, -RING_LIMIT, RING_LIMIT);
  model.position.z = THREE.MathUtils.clamp(model.position.z, -RING_LIMIT, RING_LIMIT);

  model.rotation.y = Math.atan2(vMove.x, vMove.z);

  const cx = model.position.x + modelCenter.x;
  const cz = model.position.z + modelCenter.z;
  const cy = model.position.y + faceY;
  controls.target.set(cx, cy, cz);
}

/* =========================================================
   18) Render (Resize + loop) (clamp cámara dentro del fondo)
   ========================================================= */
/* Aquí se fuerza que la cámara no pueda salir del cilindro de fotos */
function clampCameraInsideBackdrop() {
  const x = camera.position.x;
  const z = camera.position.z;
  const r = Math.hypot(x, z);

  if (r > CAMERA_R_LIMIT) {
    const k = CAMERA_R_LIMIT / Math.max(r, 1e-6);
    camera.position.x *= k;
    camera.position.z *= k;
  }

  const yMin = 0.35;
  const yMax = STADIUM_Y + STADIUM_H / 2 - 0.4;
  camera.position.y = THREE.MathUtils.clamp(camera.position.y, yMin, yMax);
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", onResize);
onResize();

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();

  updateWASD(dt);

  controls.update();

  /* Aquí se aplica el bloqueo final para que el ratón no permita “salirse” de las fotos */
  clampCameraInsideBackdrop();

  if (mixer) mixer.update(dt);

  ground.position.y = baseGroundY;

  renderer.render(scene, camera);
}
animate();
