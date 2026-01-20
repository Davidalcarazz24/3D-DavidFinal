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
/* Aquí se importan los módulos necesarios de Three.js y los helpers de examples */
import * as THREE from "three";
import { OrbitControls } from "jsm/controls/OrbitControls.js";
import { FBXLoader } from "jsm/loaders/FBXLoader.js";

/* =========================================================
   2) UI (Interfaz y estado)
   ========================================================= */
/* Aquí se define la ruta del modelo FBX y se crea un selector corto para el DOM */
const FBX_PATH = "./assets/models/hiphopdavid.fbx";
const $ = (s) => document.querySelector(s);

/* Aquí se capturan los botones del panel (bailar + cámaras) y el slider de luz */
const btnToggle = $("#btnToggle"),
  camFront = $("#camFront"),
  camRight = $("#camRight"),
  camLeft = $("#camLeft"),
  camBack = $("#camBack"),
  lightLevel = $("#lightLevel"),
  lightValue = $("#lightValue");

/* Aquí se crea un overlay fijo para mostrar mensajes de carga/estado sin tocar el HTML */
const statusEl = document.createElement("div");
statusEl.style.cssText =
  "position:fixed;top:12px;right:12px;z-index:9999;padding:10px 12px;border-radius:10px;background:rgba(0,0,0,.55);color:#fff;font:12px/1.35 system-ui,Arial;max-width:520px;backdrop-filter:blur(6px);";
statusEl.textContent = "Iniciando...";
document.body.appendChild(statusEl);

/* Aquí se desactivan controles hasta que el FBX esté cargado y listo */
btnToggle.disabled = true;
btnToggle.textContent = "Cargando...";
[camFront, camRight, camLeft, camBack].forEach((b) => (b.disabled = true));

/* Aquí el slider también se desactiva hasta que existan luces capturadas en la escena */
if (lightLevel) lightLevel.disabled = true;
if (lightValue) lightValue.textContent = "100%";

/* =========================================================
   3) Motor Three.js (Renderer + escena) (fix colorSpace)
   ========================================================= */
/* Aquí se crea el renderer con antialias y se activa el sistema de sombras */
const renderer = new THREE.WebGLRenderer({ canvas: $("#c"), antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

/* Aquí se fija SRGB para evitar texturas oscuras/“apagadas” en pantallas modernas */
renderer.outputColorSpace = THREE.SRGBColorSpace;

/* Aquí se crea la escena con un fondo oscuro y niebla para dar profundidad */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);
scene.fog = new THREE.Fog(0x05060a, 10, 60);

/* =========================================================
   4) Cámaras (Cámara + OrbitControls) (bloqueo para no salir del fondo)
   ========================================================= */
/* Aquí se configura la cámara principal (se ajusta con resize más abajo) */
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 600);
camera.position.set(0, 1.8, 4.5);

/* Aquí OrbitControls controla rotación y zoom, y se bloquea el paneo para no escapar del fondo */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false; /* Importante: sin paneo es más difícil salir del cilindro */
controls.minPolarAngle = 0.2;
controls.maxPolarAngle = Math.PI / 2;
controls.minDistance = 2;
controls.maxDistance = 16;  /* Importante: se limita el zoom para no atravesar el backdrop */

/* =========================================================
   5) Añadir Luces (Iluminación principal)
   ========================================================= */
/* Aquí se añaden luces base para que ring y modelo tengan lectura (sin quemar la escena) */
scene.add(new THREE.AmbientLight(0xffffff, 0.68));
scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 0.55));

/* Aquí se crean direccionales con sombras (son las que “dibujan” el volumen) */
const makeDir = (x, y, z, i) => {
  const l = new THREE.DirectionalLight(0xffffff, i);
  l.position.set(x, y, z);
  l.castShadow = true;
  l.shadow.mapSize.set(2048, 2048); /* Importante: mapa grande para sombras limpias */
  Object.assign(l.shadow.camera, { near: 0.5, far: 90, left: -30, right: 30, top: 30, bottom: -30 });
  scene.add(l);
  return l;
};
makeDir(0, 12, 12, 1.25);
makeDir(0, 12, -12, 0.85);
makeDir(-12, 12, 0, 0.95);
makeDir(12, 12, 0, 0.95);

/* Aquí se añade una luz cenital para rellenar sombras fuertes en el centro */
const overhead = new THREE.PointLight(0xffffff, 2.1, 90);
overhead.position.set(0, 10, 0);
overhead.castShadow = true;
scene.add(overhead);

/* =========================================================
   6) Escenario (Grupo ground + constantes ring)
   ========================================================= */
/* Aquí se mete todo dentro de ground para poder ajustar Y cuando se detectan los pies del modelo */
const ground = new THREE.Group();
scene.add(ground);

/* Aquí se respetan constantes obligatorias del ejercicio */
const RING_TOP_Y = 0.355,
  GROUND_NUDGE = 0.87;
let baseGroundY = 0;

/* =========================================================
   7) Fondo tipo estadio con 4 fotos (cada imagen 1 vez en un cilindro 360)
   ========================================================= */
/* Aquí se definen las 4 fotos del fondo (una por cuarto de cilindro, sin repetir) */
const BG = {
  front: "./assets/img/bg-front.jpg",
  right: "./assets/img/bg-right.jpg",
  back: "./assets/img/bg-back.jpg",
  left: "./assets/img/bg-left.jpg",
};

/* Aquí se define el tamaño del cilindro y el límite de cámara (para no salir del “fondo”) */
const STADIUM_R = 19,
  STADIUM_H = 14,
  STADIUM_Y = 7.2,
  CAMERA_R_LIMIT = STADIUM_R - 1.3;

/* Aquí se crea un backdrop interior con MeshBasicMaterial para que la foto no dependa de luces */
(() => {
  const grp = new THREE.Group();
  ground.add(grp);

  const tl = new THREE.TextureLoader();
  const mat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, toneMapped: false });
  const FLIP_X = true; /* Importante: evita que las fotos queden del revés desde dentro */

  /* Aquí se carga textura con SRGB y anisotropía para mejorar nitidez en ángulo */
  const load = (url, m) =>
    tl.load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace; /* Importante: colores reales */
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy?.() || 1;
      if (FLIP_X) (t.repeat.x = -1), (t.offset.x = 1); /* Importante: flip horizontal */
      m.map = t;
      m.needsUpdate = true;
    });

  /* Aquí se añade un cuarto de cilindro (Math.PI/2) para usar 4 imágenes exactas */
  const addQ = (url, start) => {
    const m = mat();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(STADIUM_R, STADIUM_R, STADIUM_H, 64, 1, true, start, Math.PI / 2), m);
    mesh.position.y = STADIUM_Y;
    grp.add(mesh);
    load(url, m);
  };

  /* Aquí se reparten los 4 lados (cada imagen se usa una vez) */
  addQ(BG.back, (7 * Math.PI) / 4);
  addQ(BG.right, Math.PI / 4);
  addQ(BG.front, (3 * Math.PI) / 4);
  addQ(BG.left, (5 * Math.PI) / 4);

  /* Aquí se añade una capa de “haze” para suavizar uniones y disimular negro */
  const haze = new THREE.Mesh(
    new THREE.CylinderGeometry(STADIUM_R + 1.2, STADIUM_R + 1.2, STADIUM_H + 2.5, 64, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x05060a, transparent: true, opacity: 0.5, side: THREE.BackSide, toneMapped: false })
  );
  haze.position.y = STADIUM_Y;
  grp.add(haze);

  /* Aquí se cierran tapa superior e inferior para no ver vacío al mirar arriba/abajo */
  const capMat = new THREE.MeshBasicMaterial({ color: 0x05060a, side: THREE.BackSide, toneMapped: false });
  const top = new THREE.Mesh(new THREE.CircleGeometry(STADIUM_R + 1.1, 64), capMat);
  top.position.y = STADIUM_Y + STADIUM_H / 2 + 0.01;
  top.rotation.x = Math.PI / 2;
  grp.add(top);

  const bot = new THREE.Mesh(new THREE.CircleGeometry(STADIUM_R + 1.1, 64), capMat);
  bot.position.y = 0.02;
  bot.rotation.x = -Math.PI / 2;
  grp.add(bot);
})();

/* =========================================================
   8) Boxeo (Construcción del ring) + suelo gris oscuro liso
   ========================================================= */
/* Aquí se construye el ring completo y se devuelve el valor de corner para colocar focos */
const createRing = () => {
  const ring = new THREE.Group();
  ground.add(ring);

  /* Aquí se crea el suelo exterior en gris oscuro liso (sin grid) */
  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 70),
    new THREE.MeshStandardMaterial({ color: 0x2f343a, roughness: 0.95, metalness: 0 })
  );
  outer.rotation.x = -Math.PI / 2;
  outer.receiveShadow = true;
  ring.add(outer);

  /* Aquí se crea la plataforma y la lona superior */
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(12, 0.35, 12),
    new THREE.MeshStandardMaterial({ color: 0x262b33, roughness: 0.95, metalness: 0 })
  );
  platform.position.y = 0.175;
  platform.castShadow = platform.receiveShadow = true;
  ring.add(platform);

  const canvasTop = new THREE.Mesh(
    new THREE.PlaneGeometry(10.6, 10.6),
    new THREE.MeshStandardMaterial({ color: 0x2e343e, roughness: 0.95, metalness: 0 })
  );
  canvasTop.rotation.x = -Math.PI / 2;
  canvasTop.position.y = RING_TOP_Y; /* Importante: altura obligatoria del canvas */
  canvasTop.receiveShadow = true;
  ring.add(canvasTop);

  /* Aquí se crea el faldón (apron) alrededor del ring */
  const matApron = new THREE.MeshStandardMaterial({ color: 0x12161d, roughness: 1, metalness: 0 });
  const apronH = 0.55,
    apronT = 0.18,
    half = 10.9 / 2;

  const front = new THREE.Mesh(new THREE.BoxGeometry(10.9, apronH, apronT), matApron);
  front.position.set(0, 0.35, half);
  front.castShadow = true;
  ring.add(front);
  const back = front.clone();
  back.position.z = -half;
  ring.add(back);

  const left = new THREE.Mesh(new THREE.BoxGeometry(apronT, apronH, 10.9), matApron);
  left.position.set(-half, 0.35, 0);
  left.castShadow = true;
  ring.add(left);
  const right = left.clone();
  right.position.x = half;
  ring.add(right);

  /* Aquí se colocan postes, cuerdas y pads (detalles del ring) */
  const corner = 5.25;
  const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.35, 20);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x0f141b, roughness: 0.55, metalness: 0.25 });
  const addPost = (x, z) => {
    const p = new THREE.Mesh(postGeo, postMat);
    p.position.set(x, 1.25, z);
    p.castShadow = true;
    ring.add(p);
  };
  addPost(-corner, -corner);
  addPost(corner, -corner);
  addPost(-corner, corner);
  addPost(corner, corner);

  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.7, metalness: 0 });
  const ropeBetween = (a, b, y) => {
    const dir = new THREE.Vector3().subVectors(b, a),
      len = dir.length(),
      mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 16), ropeMat);
    mesh.position.set(mid.x, y, mid.z);

    /* Aquí se alinea el cilindro (cuerda) hacia el segmento a-b usando quaternion */
    const up = new THREE.Vector3(0, 1, 0),
      nd = dir.clone().normalize(),
      axis = new THREE.Vector3().crossVectors(up, nd),
      axisLen = axis.length();
    if (axisLen < 1e-6) mesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0);
    else {
      axis.normalize();
      mesh.quaternion.setFromAxisAngle(axis, Math.acos(THREE.MathUtils.clamp(up.dot(nd), -1, 1)));
    }

    mesh.castShadow = true;
    ring.add(mesh);
  };

  const p1 = new THREE.Vector3(-corner, 0, -corner),
    p2 = new THREE.Vector3(corner, 0, -corner),
    p3 = new THREE.Vector3(corner, 0, corner),
    p4 = new THREE.Vector3(-corner, 0, corner);

  [0.65, 1.05, 1.45].forEach((y) => {
    ropeBetween(p1, p2, y);
    ropeBetween(p2, p3, y);
    ropeBetween(p3, p4, y);
    ropeBetween(p4, p1, y);
  });

  const padGeo = new THREE.BoxGeometry(0.3, 0.24, 0.3);
  const addPad = (x, z, mat) => {
    const pad = new THREE.Mesh(padGeo, mat);
    pad.position.set(x, 1.1, z);
    pad.castShadow = true;
    ring.add(pad);
  };
  addPad(-corner, -corner, new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.8, metalness: 0 }));
  addPad(corner, -corner, new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.8, metalness: 0 }));
  addPad(-corner, corner, new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.8, metalness: 0 }));
  addPad(corner, corner, new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.8, metalness: 0 }));

  return corner;
};

const RING_CORNER = createRing();

/* =========================================================
   9) Focos grandes tipo torre (como la foto) en las 4 esquinas del ring
   ========================================================= */
/* Aquí se crean 4 torres con panel emissive + SpotLight apuntando al centro */
(() => {
  const grp = new THREE.Group();
  ground.add(grp);

  /* Aquí se crea un target fijo para que los 4 focos apunten al centro */
  const target = new THREE.Object3D();
  target.position.set(0, 1.3, 0);
  ground.add(target);

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.75, metalness: 0.25 });
  const bracketMat = new THREE.MeshStandardMaterial({ color: 0x0e1116, roughness: 0.65, metalness: 0.3 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.7, metalness: 0.2 });

  /* Importante: emissive alto para simular la pantalla de focos encendida */
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xf3f4f6,
    roughness: 0.25,
    metalness: 0.05,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 3.2,
    toneMapped: false,
  });

  const POLE_H = 10.5,
    POLE_R = 0.12,
    PANEL_W = 3.2,
    PANEL_H = 1.9,
    PANEL_D = 0.22;

  const addTower = (sx, sz) => {
    /* Aquí se desplaza un poco hacia fuera para que no estorbe al ring */
    const outward = 3.2,
      x = sx * (RING_CORNER + outward),
      z = sz * (RING_CORNER + outward);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(POLE_R, POLE_R * 0.92, POLE_H, 18), poleMat);
    pole.position.set(x, POLE_H / 2, z);
    pole.castShadow = true;
    grp.add(pole);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(POLE_R * 1.35, POLE_R * 1.6, 0.35, 18), bracketMat);
    base.position.set(x, 0.18, z);
    base.castShadow = true;
    grp.add(base);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.18), bracketMat);
    arm.position.set(x, POLE_H - 0.55, z);
    arm.castShadow = true;
    grp.add(arm);

    /* Aquí se calcula el yaw para que el panel “mire” hacia el centro */
    const look = new THREE.Vector3(0, POLE_H - 0.65, 0).sub(new THREE.Vector3(x, POLE_H - 0.65, z)).normalize();
    const yaw = Math.atan2(look.x, look.z);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(PANEL_W + 0.18, PANEL_H + 0.18, PANEL_D + 0.1), frameMat);
    frame.position.set(x, POLE_H - 0.65, z);
    frame.rotation.y = yaw;
    frame.castShadow = true;
    grp.add(frame);

    const panel = new THREE.Mesh(new THREE.BoxGeometry(PANEL_W, PANEL_H, PANEL_D), lampMat);
    panel.position.set(x, POLE_H - 0.65, z);
    panel.rotation.y = yaw;
    grp.add(panel);

    /* Aquí se coloca una parrilla de “bombillas” para parecerse a la foto */
    const bulbs = new THREE.Group();
    bulbs.position.set(x, POLE_H - 0.65, z);
    bulbs.rotation.y = yaw;
    grp.add(bulbs);

    const bulbGeo = new THREE.PlaneGeometry(0.26, 0.18);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 6; c++) {
        const b = new THREE.Mesh(bulbGeo, lampMat);
        b.position.set((c / 5 - 0.5) * (PANEL_W * 0.86), (0.5 - r / 3) * (PANEL_H * 0.78), PANEL_D / 2 + 0.12);
        bulbs.add(b);
      }

    /* Importante: SpotLight con sombras para “pintar” el ring como foco de estadio */
    const spot = new THREE.SpotLight(0xffffff, 6.2, 95, THREE.MathUtils.degToRad(28), 0.35, 1.1);
    spot.position.set(x, POLE_H - 0.55, z);
    spot.target = target;
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.camera.near = 0.2;
    spot.shadow.camera.far = 140;
    grp.add(spot);

    /* Aquí se añade un relleno suave para evitar zonas totalmente negras */
    const fill = new THREE.PointLight(0xffffff, 1.35, 55);
    fill.position.set(x, POLE_H - 0.75, z);
    grp.add(fill);
  };

  addTower(-1, -1);
  addTower(1, -1);
  addTower(-1, 1);
  addTower(1, 1);
})();

/* =========================================================
   10) Control global de luminosidad (slider/rueda)
   ========================================================= */
/* Aquí se captura cada luz de la escena con su intensidad base para escalar todo a la vez */
const lightBases = [];
let lightPct = 100;

const updateLightUI = () => {
  if (lightValue) lightValue.textContent = `${Math.round(lightPct)}%`;
  if (lightLevel) lightLevel.value = String(Math.round(lightPct));
};

const applyLightPct = () => {
  const mul = lightPct / 100;
  lightBases.forEach((it) => (it.light.intensity = it.base * mul));
  updateLightUI();
};

const setLightPct = (v) => ((lightPct = THREE.MathUtils.clamp(v, 20, 250)), applyLightPct());

(() => {
  /* Aquí se recorren objetos para localizar luces y guardar su base */
  lightBases.length = 0;
  scene.traverse((o) => o?.isLight && typeof o.intensity === "number" && lightBases.push({ light: o, base: o.intensity }));

  /* Aquí se activan eventos del slider (arrastre y rueda) */
  if (lightLevel) {
    lightLevel.disabled = !lightBases.length;
    updateLightUI();
    lightLevel.addEventListener("input", () => setLightPct(+lightLevel.value));
    lightLevel.addEventListener("wheel", (e) => (e.preventDefault(), setLightPct(lightPct + (e.deltaY > 0 ? -5 : 5))), {
      passive: false,
    });
  }

  /* Aquí se aplica el porcentaje inicial */
  applyLightPct();
})();

/* =========================================================
   11) Modelo (Medidas + encuadre)
   ========================================================= */
/* Aquí se guardan variables de modelo/animación y medidas para cámara */
const tmpBox = new THREE.Box3();
let model = null,
  mixer = null,
  action = null,
  isPlaying = false,
  modelCenter = new THREE.Vector3(0, 1, 0),
  modelRadius = 1,
  faceY = 1.6,
  modelHeight = 1.75;

/* Aquí se escala el modelo a 1.75m, se centra, y se calcula radio/altura */
const autoFrameObject = (obj) => {
  const box = new THREE.Box3().setFromObject(obj),
    size = new THREE.Vector3();
  box.getSize(size);

  obj.scale.multiplyScalar(1.75 / Math.max(size.y, 1e-6)); /* Importante: altura deseada */
  box.setFromObject(obj);

  const c = new THREE.Vector3();
  box.getCenter(c);
  obj.position.x -= c.x;
  obj.position.z -= c.z;

  box.setFromObject(obj);
  const h = box.max.y - box.min.y;
  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);

  return { center: sphere.center.clone(), radius: Math.max(sphere.radius, 0.001), faceY: box.min.y + h * 0.85, height: h };
};

/* =========================================================
   12) Cámaras (Vistas: frente/detrás/izquierda/derecha)
   ========================================================= */
/* Aquí se ajusta la cámara según el tamaño del modelo para encuadre correcto */
const setCameraView = (view) => {
  const dist = Math.max(
    modelRadius * 2.7,
    (modelHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))) * 1.25
  );

  /* Importante: target en mundo, porque el modelo se mueve con WASD */
  const cx = (model ? model.position.x : 0) + modelCenter.x,
    cz = (model ? model.position.z : 0) + modelCenter.z,
    cy = (model ? model.position.y : 0) + faceY;

  controls.target.set(cx, cy, cz);

  if (view === "front") camera.position.set(cx, cy, cz + dist);
  if (view === "back") camera.position.set(cx, cy, cz - dist);
  if (view === "left") camera.position.set(cx - dist, cy, cz);
  if (view === "right") camera.position.set(cx + dist, cy, cz);

  camera.near = Math.max(0.01, modelRadius / 120);
  camera.far = Math.max(220, modelRadius * 260);
  camera.updateProjectionMatrix();
  controls.update();
};

/* =========================================================
   13) Escenario (Alineación ring a los pies)
   ========================================================= */
/* Aquí se calcula el minY del modelo y se ajusta ground para que los pies caigan en la lona */
const lockRingToFeetOnce = (obj) => {
  obj.updateMatrixWorld(true);
  tmpBox.setFromObject(obj);
  baseGroundY = tmpBox.min.y - RING_TOP_Y + GROUND_NUDGE; /* Importante: fórmula obligatoria */
  ground.position.y = baseGroundY;
};

/* =========================================================
   14) Carga (FBX + animación)
   ========================================================= */
/* Aquí se carga el FBX y se prepara el mixer para reproducir/pausar */
statusEl.textContent = "Cargando hiphopdavid.fbx...";
new FBXLoader().load(
  FBX_PATH,
  (obj) => {
    model = obj;

    /* Aquí se activan sombras en las mallas del modelo */
    model.traverse((n) => n.isMesh && ((n.castShadow = true), (n.receiveShadow = true)));

    model.position.set(0, 0, 0);
    scene.add(model);

    /* Aquí se encuadra automáticamente */
    const framed = autoFrameObject(model);
    modelCenter = framed.center;
    modelRadius = framed.radius;
    faceY = framed.faceY;
    modelHeight = framed.height;
    setCameraView("front");

    /* Aquí se comprueba que el FBX trae animación */
    if (!obj.animations?.length) {
      statusEl.textContent = "El FBX cargó pero no trae animación dentro.";
      btnToggle.textContent = "Sin animación";
      btnToggle.disabled = true;
      return;
    }

    /* Aquí se crea el mixer y se deja pausada la animación al inicio */
    mixer = new THREE.AnimationMixer(model);
    action = mixer.clipAction(obj.animations[0]);
    action.reset();
    action.play();
    action.paused = true;
    isPlaying = false;

    /* Aquí se fuerza un update para fijar pose y después se alinea el ring a los pies */
    mixer.update(0);
    lockRingToFeetOnce(model);

    /* Aquí se habilita UI al finalizar carga */
    btnToggle.disabled = false;
    btnToggle.textContent = "Bailar";
    statusEl.textContent = "Listo.";
    [camFront, camRight, camLeft, camBack].forEach((b) => (b.disabled = false));
  },
  (xhr) => xhr?.total && (statusEl.textContent = `Cargando hiphopdavid.fbx... ${((xhr.loaded / xhr.total) * 100).toFixed(1)}%`),
  (err) => (
    console.error(err),
    (statusEl.textContent = "Error cargando el FBX. Se debe revisar Live Server y la ruta ./assets/models/hiphopdavid.fbx."),
    (btnToggle.textContent = "Error"),
    (btnToggle.disabled = true)
  )
);

/* =========================================================
   15) Movimiento e interacción (Bailar/Parar)
   ========================================================= */
/* Aquí se alterna play/pause sin reiniciar la animación */
btnToggle.addEventListener("click", () => {
  if (!action) return;
  isPlaying = !isPlaying;
  action.paused = !isPlaying;
  btnToggle.textContent = isPlaying ? "Parar" : "Bailar";
  btnToggle.classList.toggle("is-playing", isPlaying);
  statusEl.textContent = isPlaying ? "Bailando." : "Parado.";
});

/* =========================================================
   16) Cámaras (Interacción botones)
   ========================================================= */
/* Aquí se conectan botones a setCameraView */
camFront.addEventListener("click", () => setCameraView("front"));
camBack.addEventListener("click", () => setCameraView("back"));
camLeft.addEventListener("click", () => setCameraView("left"));
camRight.addEventListener("click", () => setCameraView("right"));

/* =========================================================
   17) EXTRA: Movimiento WASD
   ========================================================= */
/* Aquí el movimiento se calcula relativo a la cámara para que W sea “hacia donde mira” */
const keys = { w: false, a: false, s: false, d: false };
const vForward = new THREE.Vector3(),
  vRight = new THREE.Vector3(),
  vMove = new THREE.Vector3(),
  UP = new THREE.Vector3(0, 1, 0);

const MOVE_SPEED = 2.8,
  RING_LIMIT = 4.9;

/* Aquí se capturan teclas y se evita scroll en el navegador */
const keyEvt = (down) => (e) => {
  if (e.code === "KeyW") keys.w = down;
  if (e.code === "KeyA") keys.a = down;
  if (e.code === "KeyS") keys.s = down;
  if (e.code === "KeyD") keys.d = down;
  if (e.code === "KeyW" || e.code === "KeyA" || e.code === "KeyS" || e.code === "KeyD") e.preventDefault();
};
addEventListener("keydown", keyEvt(true), { passive: false });
addEventListener("keyup", keyEvt(false), { passive: false });

/* Aquí se actualiza el movimiento con dt, se limita al ring y se actualiza el target */
const updateWASD = (dt) => {
  if (!model) return;

  const f = (keys.w ? 1 : 0) - (keys.s ? 1 : 0),
    r = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  if (!f && !r) return;

  camera.getWorldDirection(vForward);
  vForward.y = 0;
  if (vForward.lengthSq() < 1e-6) return;
  vForward.normalize();

  vRight.crossVectors(vForward, UP).normalize();
  vMove.set(0, 0, 0).addScaledVector(vForward, f).addScaledVector(vRight, r);
  if (vMove.lengthSq() < 1e-6) return;
  vMove.normalize();

  model.position.x = THREE.MathUtils.clamp(model.position.x + vMove.x * MOVE_SPEED * dt, -RING_LIMIT, RING_LIMIT);
  model.position.z = THREE.MathUtils.clamp(model.position.z + vMove.z * MOVE_SPEED * dt, -RING_LIMIT, RING_LIMIT);

  /* Aquí se rota el modelo hacia la dirección de avance */
  model.rotation.y = Math.atan2(vMove.x, vMove.z);

  /* Aquí se mantiene el orbit target sobre la cara mientras se mueve */
  controls.target.set(model.position.x + modelCenter.x, model.position.y + faceY, model.position.z + modelCenter.z);
};

/* =========================================================
   18) Render (Resize + loop) (clamp cámara dentro del fondo)
   ========================================================= */
/* Aquí se restringe la cámara al interior del cilindro para que no aparezca negro */
const clampCameraInsideBackdrop = () => {
  const r = Math.hypot(camera.position.x, camera.position.z);
  if (r > CAMERA_R_LIMIT) {
    const k = CAMERA_R_LIMIT / Math.max(r, 1e-6);
    camera.position.x *= k;
    camera.position.z *= k;
  }
  camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.35, STADIUM_Y + STADIUM_H / 2 - 0.4);
};

/* Aquí se reajusta renderer y cámara con el tamaño de la ventana */
const onResize = () => (
  renderer.setSize(innerWidth, innerHeight, false),
  (camera.aspect = innerWidth / innerHeight),
  camera.updateProjectionMatrix()
);
addEventListener("resize", onResize);
onResize();

/* Aquí se usa clock para tener delta time estable */
const clock = new THREE.Clock();

/* Aquí se ejecuta el bucle de render y se actualiza todo en orden */
(function anim() {
  requestAnimationFrame(anim);

  const dt = clock.getDelta();

  updateWASD(dt);               /* Importante: movimiento antes del render */
  controls.update();            /* Importante: damping del orbit */
  clampCameraInsideBackdrop();  /* Importante: nunca salir del fondo */

  if (mixer) mixer.update(dt);  /* Importante: animación ligada a dt */

  ground.position.y = baseGroundY; /* Importante: mantiene el ajuste de altura */

  renderer.render(scene, camera);
})();
