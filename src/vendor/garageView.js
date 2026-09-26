// src/render/garageView.ts
import * as T10 from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// src/render/garageEnvironment.ts
import * as T9 from "three";

// src/art/skin.ts
var OS_SKIN = typeof location !== "undefined" && new URLSearchParams(location.search).get("skin") === "os" || globalThis.__studioOs === true;
var OS = {
  n0: "#14121a",
  n1: "#241f2e",
  n2: "#3a3244",
  n3: "#55495e",
  n4: "#736579",
  glow0: "#2a4a5c",
  glow1: "#4a8fa8",
  glow2: "#7fd4e8",
  calm1: "#1a6b78",
  calm2: "#35c9d9",
  calm3: "#b8f4ff",
  warm: "#e0a52e",
  lamp: "#ffd68c"
};

// src/render/worldArt.ts
import * as T from "three";
var INK = {
  paper: "#f3f0e8",
  wall: "#e1d9c8",
  trim: "#f5eddb",
  floor: "#dfd4be",
  grout: "#c9c0ac",
  glass: "#48565c",
  glassLight: "#64737a",
  wood: "#b99059",
  woodEdge: "#8d693f",
  metal: "#393f3d",
  leaf: "#87934e",
  leafLight: "#9daa64",
  lawn: "#a3ac72",
  earth: "#6d7151",
  water: "#91adbe",
  land: "#d8d3a7",
  teal: "#368c87",
  amber: "#d4a24e",
  navy: "#101e2b",
  skin: "#d7a87b",
  hair: "#393329",
  /*
   * **Selection, which used to be `teal` and was never a material.** One
   * colour was answering two questions: what a plant, a shirt and a pane of
   * glass are made of, and which station the player has hold of (§9.2).
   * Splitting them is what lets §12.3 take the hue off the interface without
   * taking the leaves off the plants. It is --ink rather than a hue because a
   * graphite primary leaves nothing saturated to inherit, and on a daylight
   * floor ink is the highest-contrast mark available anyway.
   */
  select: "#24333b"
};
var materials = /* @__PURE__ */ new Map();
function material(colour) {
  let m = materials.get(colour);
  if (!m) {
    m = new T.MeshStandardMaterial({ color: colour, roughness: 0.88, metalness: 0, flatShading: true });
    materials.set(colour, m);
  }
  return m;
}
var finishes = /* @__PURE__ */ new Map();
function sharedMaterial(key, build) {
  let m = finishes.get(key);
  if (!m) {
    m = build();
    finishes.set(key, m);
  }
  return m;
}
var cube = new T.BoxGeometry(1, 1, 1);
var round = new T.CylinderGeometry(1, 1, 1, 8);
var leaf = new T.IcosahedronGeometry(1, 0);
var ball = new T.IcosahedronGeometry(1, 1);
function box(parent, x, y, z, w, h, d, colour, shadow = true) {
  const mesh = new T.Mesh(cube, material(colour));
  mesh.position.set(x, y + h / 2, z);
  mesh.scale.set(w, h, d);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function cylinder(parent, x, y, z, radius, height, colour) {
  const mesh = new T.Mesh(round, material(colour));
  mesh.position.set(x, y + height / 2, z);
  mesh.scale.set(radius, height, radius);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function sphere(parent, x, y, z, radius, colour, faceted = false) {
  const mesh = new T.Mesh(faceted ? leaf : ball, material(colour));
  mesh.position.set(x, y, z);
  mesh.scale.setScalar(radius);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function tree(parent, x, z, size = 1) {
  cylinder(parent, x, 0, z, size * 0.1, size * 0.75, INK.woodEdge);
  const crown = sphere(parent, x, size * 1.05, z, size * 0.58, INK.leaf, true);
  crown.scale.y *= 1.35;
}
function planter(parent, x, z, size = 0.55) {
  box(parent, x, 0, z, size, size * 0.55, size, INK.trim);
  const shrub = sphere(parent, x, size, z, size * 0.55, INK.leaf, true);
  shrub.scale.y *= 1.25;
}
function hedge(parent, x, z, w, d) {
  box(parent, x, 0, z, w + 0.15, 0.22, d + 0.15, INK.trim);
  box(parent, x, 0.22, z, w, 0.43, d, INK.leaf);
}
function line(parent, points, colour, opacity = 1) {
  const geometry = new T.BufferGeometry().setFromPoints(points);
  const mesh = new T.Line(geometry, new T.LineBasicMaterial({ color: colour, transparent: true, opacity }));
  mesh.userData.ownGeometry = true;
  mesh.userData.ownMaterial = true;
  parent.add(mesh);
  return mesh;
}
function slab(parent, poly, y, thickness, colour, holes = []) {
  const shape = new T.Shape(poly.map(([x, z]) => new T.Vector2(x, z)));
  for (const hole of holes) shape.holes.push(new T.Path(hole.map(([x, z]) => new T.Vector2(x, z))));
  const geometry = new T.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.rotateX(Math.PI / 2);
  const mesh = new T.Mesh(geometry, material(colour));
  mesh.position.y = y + thickness;
  mesh.receiveShadow = true;
  mesh.userData.ownGeometry = true;
  parent.add(mesh);
  return mesh;
}
function wall(parent, a, b, y, h, t, colour, lit = true) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const mesh = box(parent, (a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, Math.hypot(dx, dz), h, t, colour, lit);
  mesh.rotation.y = -Math.atan2(dz, dx);
  return mesh;
}
var EMPTY = new T.Matrix4().makeScale(0, 0, 0);
function showSeatInstances(instances, visible) {
  const touched = /* @__PURE__ */ new Set();
  for (const at of instances) {
    at.mesh.setMatrixAt(at.index, visible ? at.matrix : EMPTY);
    touched.add(at.mesh);
  }
  for (const mesh of touched) mesh.instanceMatrix.needsUpdate = true;
}
function placeInstances(instances, delta) {
  const touched = /* @__PURE__ */ new Set();
  const out = new T.Matrix4();
  for (const at of instances) {
    at.mesh.setMatrixAt(at.index, out.multiplyMatrices(delta, at.matrix));
    touched.add(at.mesh);
  }
  for (const mesh of touched) mesh.instanceMatrix.needsUpdate = true;
}
function batchArt(root, seats, props) {
  root.updateMatrixWorld(true);
  const batches = /* @__PURE__ */ new Map();
  const owner = /* @__PURE__ */ new Map();
  const part = /* @__PURE__ */ new Map();
  root.traverse((node) => {
    if (!(node instanceof T.Mesh) || node.userData.dynamic || node.userData.hit) return;
    let p = node.parent;
    let seat;
    let prop2;
    while (p && p !== root) {
      if (p.userData.dynamic) return;
      if (seat === void 0 && typeof p.userData.seat === "number") seat = p.userData.seat;
      if (prop2 === void 0 && typeof p.userData.prop === "string") prop2 = p.userData.prop;
      p = p.parent;
    }
    if (node.userData.ownGeometry || Array.isArray(node.material)) return;
    if (seat !== void 0) owner.set(node, seat);
    if (prop2 !== void 0) part.set(node, prop2);
    const key = `${node.geometry.uuid}:${node.material.uuid}:${node.castShadow}`;
    if (!batches.has(key)) batches.set(key, { geometry: node.geometry, material: node.material, meshes: [] });
    batches.get(key).meshes.push(node);
  });
  const inverse = root.matrixWorld.clone().invert();
  for (const batch of batches.values()) {
    if (batch.meshes.length < 2) continue;
    const instanced = new T.InstancedMesh(batch.geometry, batch.material, batch.meshes.length);
    instanced.castShadow = batch.meshes[0].castShadow;
    instanced.receiveShadow = true;
    batch.meshes.forEach((mesh, i) => {
      const matrix = inverse.clone().multiply(mesh.matrixWorld);
      instanced.setMatrixAt(i, matrix);
      const seat = owner.get(mesh);
      if (seats && seat !== void 0) {
        const list = seats.get(seat) ?? [];
        list.push({ mesh: instanced, index: i, matrix });
        seats.set(seat, list);
      }
      const prop2 = part.get(mesh);
      if (props && prop2 !== void 0) {
        const list = props.get(prop2) ?? [];
        list.push({ mesh: instanced, index: i, matrix });
        props.set(prop2, list);
      }
      mesh.removeFromParent();
    });
    instanced.instanceMatrix.needsUpdate = true;
    root.add(instanced);
  }
}

// src/render/projectPlate.ts
import * as T2 from "three";

// src/art/coverPixels.ts
var COVER_SIZE = 32;
var FAMILY_TABLE = [
  { skyTop: "#2F7FD1", skyBottom: "#9ED8F7", far: "#6A93B8", ground: "#4C9A3E", groundLit: "#7CC456", groundDark: "#4A5A12", road: "#C9A96E", water: "#3E8FD6", lamp: "#FFE66D" },
  // day
  { skyTop: "#3A2A6A", skyBottom: "#F08A5D", far: "#7A4C86", ground: "#2E5A3A", groundLit: "#4E8A52", groundDark: "#1A3A50", road: "#A0785A", water: "#6A5A9A", lamp: "#FFD07A" },
  // dusk
  { skyTop: "#0B1230", skyBottom: "#4A3A7A", far: "#26305A", ground: "#1A3F3A", groundLit: "#2E6A5E", groundDark: "#3A1A3A", road: "#4A5A7A", water: "#1E3D6E", lamp: "#F4E8A8" },
  // night
  { skyTop: "#3D8FD6", skyBottom: "#FBE7B0", far: "#9A5A7A", ground: "#D98A4A", groundLit: "#F0C98A", groundDark: "#7A3A5A", road: "#B07A4A", water: "#56B0C8", lamp: "#FFF1A8" },
  // desert
  { skyTop: "#6FA8E8", skyBottom: "#F0C8EC", far: "#8E7CC8", ground: "#D6E9F3", groundLit: "#FFFFFF", groundDark: "#7A9AB8", road: "#B8C8D8", water: "#4FA8D8", lamp: "#FFE9A0" },
  // ice
  { skyTop: "#2A1A4A", skyBottom: "#4EA86B", far: "#2B6A4A", ground: "#4A2E1A", groundLit: "#6A4A2A", groundDark: "#2A1A0A", road: "#6E6A3A", water: "#7ED957", lamp: "#D8F5A0" },
  // toxic
  { skyTop: "#FF7EB3", skyBottom: "#FFF0B8", far: "#C86AA8", ground: "#6FD3C0", groundLit: "#A9EBDD", groundDark: "#2A9A9A", road: "#F5D0E6", water: "#7FC8F0", lamp: "#FFF3B0" },
  // candy
  { skyTop: "#2A0A0A", skyBottom: "#F0A83A", far: "#5E1F1F", ground: "#4A2A3A", groundLit: "#6A3A4A", groundDark: "#1A1A3A", road: "#8A5A3A", water: "#B03A2A", lamp: "#FFB35C" }
  // ember
];
var INK2 = "#1B1B22";
var WHITE = "#FFFFFF";
var SPRITES = {
  /* Sixteen rows: a rocket that doubled would be off the top of the box. */
  rocket: {
    rows: [
      "......W......",
      ".....WWW.....",
      "....WWRWW....",
      "....WWRWW....",
      "...WWWRWWW...",
      "...WWBBBWW...",
      "...WBBBBBW...",
      "...WWBBBWW...",
      "...WWWWWWW...",
      "..WWWWWWWWW..",
      "..WWWWWWWWW..",
      ".RRWWWWWWWRR.",
      "RRRWWWWWWWRRR",
      "RRR..WWW..RRR",
      ".....YYY.....",
      "....YOOOY...."
    ],
    colours: { W: "#F2F2F2", R: "#E23D3D", B: "#4FA3E8", Y: "#FFD23F", O: "#FF7A1F" }
  },
  /* The second arcade subject. Nine rows, so it doubles. */
  saucer: {
    rows: [
      "....CCCCC....",
      "...CLLLLLC...",
      "..CCCCCCCCC..",
      ".GGGGGGGGGGG.",
      "GGMGGMGGMGGMG",
      "GGGGGGGGGGGGG",
      ".GGGGGGGGGGG.",
      "..YY.....YY..",
      "...Y.......Y."
    ],
    colours: { C: "#5ED4F0", L: "#E8FCFF", G: "#B7C2CC", M: "#E255B4", Y: "#FFE66D" }
  },
  die: {
    rows: [
      "..IIIIIIIS",
      ".IIIIIIIIS",
      "IIKIIIKIIS",
      "IIIIIIIIIS",
      "IIIIKIIIIS",
      "IIIIIIIIIS",
      "IIKIIIKIIS",
      "IIIIIIIIIS",
      "IIIIIIIISS",
      "IIIIIIIIS."
    ],
    colours: { I: "#F5EEDC", K: "#202020", S: "#B9AE93" }
  },
  /* Fifteen rows, point up. The first pass drew it diagonally at twelve, which
     put the blade across a corner and the hilt nowhere near the ground. */
  sword: {
    rows: [
      "......S......",
      ".....SSS.....",
      "....SSLSS....",
      "....SSLSS....",
      "....SSLSS....",
      "....SSLSS....",
      "....SSLSS....",
      "....SSLSS....",
      ".GGGGGGGGGGG.",
      ".GG.......GG.",
      ".....BBB.....",
      ".....BBB.....",
      ".....BBB.....",
      "....GGGGG....",
      ".....GGG....."
    ],
    colours: { S: "#C9D3DC", L: "#FFFFFF", G: "#E0B341", B: "#7A4A2A" }
  },
  /* The second rpg subject. */
  castle: {
    rows: [
      "......R........",
      "......R........",
      "......RRRR.....",
      ".S.S.....S.S...",
      ".SSS.....SSS...",
      ".SSS.....SSS...",
      ".SSWS....SWSS..",
      ".SSSS....SSSS..",
      "S.S.S.S.S.S.S.S",
      "SSSSSSSSSSSSSSS",
      "SSSWSSSSSSSWSSS",
      "SSSSSSSSSSSSSSS",
      "SSSSSSDDDSSSSSS",
      "SSSSSSDDDSSSSSS",
      "SSSSSSDDDSSSSSS"
    ],
    colours: { S: "#9AA5AE", W: "#FFD23F", D: "#6B4A2E", R: "#E23D3D" }
  },
  monitor: {
    rows: [
      "GGGGGGGGGGGGGGG",
      "GDDDDDDDDDDDDDG",
      "GDDDDDDDDDDDYDG",
      "GDDDDDDDDDDDYDG",
      "GDDDDDDDDDDEYDG",
      "GDDDDDDDDDEEYDG",
      "GDDDDDDDDEEEYDG",
      "GDDDDDDDEEEEYDG",
      "GDDDDDDEEEEEYDG",
      "GDDDDDEEEEEEYDG",
      "GDDDDDDDDDDDDDG",
      "GGGGGGGGGGGGGGG",
      "......GGG......",
      "......GGG......",
      "..GGGGGGGGGGG.."
    ],
    colours: { G: "#8E9AA6", D: "#1E2A33", E: "#5FD37A", Y: "#FFD23F" }
  },
  tent: {
    rows: [
      ".......P.......",
      "......PRR......",
      "......P........",
      ".......C.......",
      "......CCC......",
      ".....CCCCC.....",
      "....CCCCCCC....",
      "...CCCDDDCCC...",
      "..CCCCDDDCCCC..",
      ".CCCCCDDDCCCCC.",
      "CCCCCCDDDCCCCCC",
      "CCCCCCDDDCCCCCC",
      "CCCCCCDDDCCCCCC",
      "BBBBBBBBBBBBBBB",
      "BBBBBBBBBBBBBBB"
    ],
    colours: { C: "#D96A3A", D: "#2A2018", P: "#4A4A55", R: "#E23D3D", B: "#6B4A2E" }
  },
  kart: {
    rows: [
      "....RRRRR....",
      "...RWWWWRR...",
      "..RRRRRRRRR..",
      ".RRRRRRRRRRRY",
      "RRRRRRRRRRRRR",
      "RRKKRRRRRKKRR",
      ".KHKK...KHKK.",
      "..KK.....KK.."
    ],
    colours: { R: "#E23D3D", W: "#BFE6FF", K: "#202020", H: "#9AA0A6", Y: "#FFD23F" }
  },
  gem: {
    rows: [
      "...CCCC...",
      "..CLLCCC..",
      ".CLLCCCCC.",
      "CLLCCCCCCD",
      "CLCCCCCCDD",
      ".CCCCCCDD.",
      "..CCCCDD..",
      "...CCDD...",
      "....DD...."
    ],
    colours: { C: "#3FC1E8", L: "#E6FBFF", D: "#1E6FA8" }
  },
  blob: {
    rows: [
      "...YYYY...",
      "..YYYYYY..",
      ".YYWKYWKY.",
      "YYYYYYYYYY",
      "YYYKYYYYKY",
      "YYYYKKKKYY",
      ".YYYYYYYY.",
      "..YY..YY..",
      ".KK....KK."
    ],
    colours: { Y: "#FFC53D", W: "#FFFFFF", K: "#202020" }
  },
  ghost: {
    rows: [
      "..GGGGG..",
      ".GGGGGGGS",
      "GGKGGGKGS",
      "GGKGGGKGS",
      "GGGGGGGGS",
      "GGGGGGGGS",
      "GGGGGGGGS",
      "GGGGGGGGS",
      "GG.GGG.GS",
      "G...G...S"
    ],
    colours: { G: "#ECEFF8", K: "#202020", S: "#C4CBE6" }
  },
  barn: {
    rows: [
      ".......D.......",
      "......DDD......",
      ".....DDDDD.....",
      "....DDDDDDD....",
      "...DDDDDDDDD...",
      "..DDDDDDDDDDD..",
      ".DDDDDDDDDDDDD.",
      "RRRRRRRRRRRRRRR",
      "RRRRRWWWRRRRRRR",
      "RRRRRWWWRRRRRRR",
      "RRRRRRRRRRRRRRR",
      "RRRRWWWWWWWRRRR",
      "RRRRWRRRRRWRRRR",
      "RRRRWRRRRRWRRRR",
      "RRRRWWWWWWWRRRR"
    ],
    colours: { D: "#5A4A4A", R: "#C0392B", W: "#F5EEDC" }
  }
};
var SUBJECTS = {
  arcade: ["rocket", "saucer"],
  roguelike: ["die"],
  rpg: ["sword", "castle"],
  tycoon: ["monitor"],
  survival: ["tent"],
  racer: ["kart"],
  puzzle: ["gem"],
  platformer: ["blob"],
  horror: ["ghost"],
  farming: ["barn"]
};
var ARRANGEMENT = [
  { horizon: 22, x: 16, flip: false, scale: 2 },
  { horizon: 25, x: 16, flip: true, scale: 2 },
  { horizon: 21, x: 12, flip: false, scale: 2 },
  { horizon: 24, x: 19, flip: true, scale: 2 }
];
function paintCover(spec) {
  const N = COVER_SIZE;
  const palette = [];
  const index = /* @__PURE__ */ new Map();
  const cells = new Uint8Array(N * N);
  const idx = (colour) => {
    let i = index.get(colour);
    if (i === void 0) {
      i = palette.length;
      palette.push(colour);
      index.set(colour, i);
    }
    return i;
  };
  const put = (x, y, colour) => {
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    cells[y * N + x] = idx(colour);
  };
  const family = FAMILY_TABLE[spec.family % FAMILY_TABLE.length];
  const place = ARRANGEMENT[spec.layout % ARRANGEMENT.length];
  const horizon = place.horizon;
  const join = Math.floor(horizon * 0.42);
  for (let y = 0; y < horizon; y++) {
    for (let x = 0; x < N; x++) {
      const top = y < join ? true : y < join + 3 ? (x + y) % 2 === 0 : false;
      put(x, y, top ? family.skyTop : family.skyBottom);
    }
  }
  const sky = spec.scene % SCENES_IN_PAINTER;
  if (sky === 0) {
    disc(put, place.flip ? 6 : 26, 5, 3, family.lamp);
  } else if (sky === 1) {
    disc(put, place.flip ? 7 : 25, 6, 3, "#E28A6C");
    for (let x = -5; x <= 5; x++) if (Math.abs(x) > 1) put((place.flip ? 7 : 25) + x, 6 + (x < 0 ? 1 : 0), "#F2D6C4");
  } else if (sky === 2) {
    for (const [x, y] of [[3, 2], [10, 5], [19, 2], [28, 4], [7, 9], [24, 8], [30, 11], [14, 11]]) put(x, y, WHITE);
  } else {
    cloud(put, place.flip ? 22 : 3, 4);
    cloud(put, place.flip ? 4 : 21, 9);
  }
  const back = spec.backdrop % BACKDROPS_IN_PAINTER;
  if (back === 0) {
    for (let x = 0; x < N; x++) {
      const h2 = Math.max(7 - Math.abs(x - 6), 5 - Math.abs(x - 17), 8 - Math.abs(x - 27), 0);
      for (let y = horizon - h2; y < horizon; y++) put(x, y, family.far);
    }
  } else if (back === 1) {
    const buildings = [[1, 3, 5], [5, 4, 8], [10, 3, 4], [14, 4, 7], [19, 3, 6], [23, 4, 9], [28, 3, 5]];
    for (const [x0, w2, h2] of buildings) {
      for (let x = x0; x < x0 + w2; x++) for (let y = horizon - h2; y < horizon; y++) put(x, y, family.far);
      for (let y = horizon - h2 + 1; y < horizon - 1; y += 2) put(x0 + 1, y, "#FFD23F");
    }
  } else if (back === 2) {
    for (const x of [2, 7, 12, 17, 22, 27]) {
      put(x, horizon - 1, "#3A2A1E");
      put(x, horizon - 2, "#3A2A1E");
      disc(put, x, horizon - 4, 2, family.far);
    }
  }
  for (let y = horizon; y < N; y++) for (let x = 0; x < N; x++) put(x, y, family.ground);
  const ground = spec.pattern % PATTERNS_IN_PAINTER;
  if (ground === 0) {
    for (let y = horizon; y < N; y++) for (let x = 0; x < N; x++) if ((x * 7 + y * 13) % 11 === 0) put(x, y, family.groundLit);
  } else if (ground === 1) {
    const depth = N - horizon;
    for (let y = horizon; y < N; y++) {
      const t = (y - horizon) / Math.max(1, depth - 1);
      const half = 3 + t * 6;
      for (let x = Math.round(16 - half); x <= Math.round(16 + half); x++) put(x, y, family.road);
      if ((y - horizon) % 3 === 1) put(16, y, "#F2E9C8");
    }
  } else if (ground === 2) {
    const shore = horizon + Math.max(2, Math.floor((N - horizon) * 0.35));
    for (let y = shore; y < N; y++) for (let x = 0; x < N; x++) put(x, y, family.water);
    for (let y = shore + 1; y < N; y += 3) for (let x = y % 2 * 2; x < N; x += 7) {
      put(x, y, WHITE);
      put(x + 1, y, WHITE);
    }
  } else {
    for (let y = horizon; y < N; y++) for (let x = 0; x < N; x++) {
      if (((x >> 1) + (y >> 1)) % 2 === 0) put(x, y, family.groundLit);
    }
  }
  for (let x = 0; x < N; x++) put(x, horizon, family.groundDark);
  const choices = SUBJECTS[spec.genre];
  const sprite = SPRITES[choices[spec.subject % choices.length]];
  const rows = sprite.rows.length;
  const cols = Math.max(...sprite.rows.map((r) => r.length));
  const scale = place.scale === 2 && rows * 2 <= horizon - 1 && cols * 2 <= N - 4 ? 2 : 1;
  const h = rows * scale;
  const w = cols * scale;
  const ox = w >= N - 4 ? Math.floor((N - w) / 2) : Math.max(2, Math.min(N - 2 - w, place.x - Math.floor(w / 2)));
  const oy = horizon + 1 - h;
  const cellAt = (r, c) => {
    if (r < 0 || r >= h || c < 0 || c >= w) return null;
    const sr = Math.floor(r / scale);
    const sc = Math.floor(c / scale);
    const row = sprite.rows[sr];
    const col = place.flip ? cols - 1 - sc : sc;
    if (col < 0 || col >= row.length) return null;
    return row[col] === "." ? null : row[col];
  };
  const solid = (r, c) => cellAt(r, c) !== null;
  for (let x = ox - 1; x <= ox + w; x++) {
    if (x >= 0 && x < N) put(x, horizon + 1, family.groundDark);
  }
  for (let r = -1; r <= h; r++) {
    for (let c = -1; c <= w; c++) {
      if (solid(r, c)) continue;
      if (solid(r - 1, c) || solid(r + 1, c) || solid(r, c - 1) || solid(r, c + 1)) put(ox + c, oy + r, INK2);
    }
  }
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ch = cellAt(r, c);
      if (ch !== null) put(ox + c, oy + r, sprite.colours[ch] ?? INK2);
    }
  }
  return { size: N, palette, cells };
}
var SCENES_IN_PAINTER = 4;
var BACKDROPS_IN_PAINTER = 4;
var PATTERNS_IN_PAINTER = 4;
function disc(put, cx, cy, r, colour) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.5) put(cx + x, cy + y, colour);
}
function cloud(put, x, y) {
  for (let i = 0; i < 7; i++) put(x + i, y, WHITE);
  for (let i = 1; i < 6; i++) put(x + i, y - 1, WHITE);
  put(x + 2, y - 2, WHITE);
  put(x + 3, y - 2, WHITE);
}
function runsOf(bitmap) {
  const runs = [];
  const n = bitmap.size;
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      const c = bitmap.cells[y * n + x];
      let w = 1;
      while (x + w < n && bitmap.cells[y * n + x + w] === c) w++;
      runs.push({ x, y, w, colour: bitmap.palette[c] });
      x += w;
    }
  }
  return runs;
}

// src/render/projectPlate.ts
var PAPER = "#F5F7F1";
var INK_COLOUR = "#45665F";
var CELL = 8;
var ART = COVER_SIZE * CELL;
var PAD = 18;
var CANVAS_W = 448;
var CANVAS_H = 280;
var CAPTION_ROWS = 6;
function printedRows(progress) {
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  return Math.round(p * (COVER_SIZE + CAPTION_ROWS));
}
function projectBoard(parent, x, bottom, z, width, standing) {
  const height = width * CANVAS_H / CANVAS_W;
  const frame = new T2.Group();
  frame.name = standing ? "office-project-whiteboard" : "garage-project-whiteboard";
  frame.position.set(x, bottom, z);
  parent.add(frame);
  box(frame, 0, 0, 0, width + 0.16, height + 0.16, 0.12, "#648079");
  box(frame, 0, 0.055, 0.07, width + 0.05, height + 0.05, 0.025, "#d5ddd5");
  for (const side of [-1, 1]) {
    box(frame, side * (width / 2 + 0.055), 0.02, 0.01, 0.05, height + 0.12, 0.15, INK.wood);
    if (standing) {
      box(frame, side * width * 0.38, -bottom + 0.08, -0.01, 0.1, bottom, 0.14, "#648079");
      box(frame, side * width * 0.38, -bottom + 0.04, 0, 0.5, 0.09, 0.52, "#648079");
    }
  }
  box(frame, 0, -0.035, 0.14, width + 0.22, 0.075, 0.26, INK.wood);
  for (const [i, colour] of ["#45665f", "#668b9e", "#c39955"].entries()) {
    box(frame, width * 0.24 + i * 0.19, 0.045, 0.18, 0.13, 0.04, 0.055, colour);
  }
  box(frame, -width * 0.32, 0.04, 0.17, 0.28, 0.07, 0.12, "#45665f");
  const plate = projectPlate(width);
  plate.mesh.position.set(0, height / 2 + 0.08, 0.09);
  frame.add(plate.mesh);
  return plate;
}
var faces = /* @__PURE__ */ new Map();
function projectPlate(width) {
  const cached = faces.get(width);
  if (cached) {
    const mesh2 = new T2.Mesh(cached.geometry, cached.material);
    return { mesh: mesh2, update: cached.paint, dispose: () => {
    } };
  }
  const geometry = new T2.PlaneGeometry(width, width * CANVAS_H / CANVAS_W);
  if (typeof document === "undefined" || /jsdom/i.test(navigator.userAgent)) {
    const material3 = new T2.MeshBasicMaterial({ color: PAPER });
    if (OS_SKIN) material3.color.multiplyScalar(0.3);
    const mesh2 = new T2.Mesh(geometry, material3);
    mesh2.userData.ownGeometry = true;
    mesh2.userData.ownMaterial = true;
    return { mesh: mesh2, update: () => {
    }, dispose: () => {
      geometry.dispose();
      material3.dispose();
    } };
  }
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  const texture = new T2.CanvasTexture(canvas);
  texture.colorSpace = T2.SRGBColorSpace;
  texture.magFilter = T2.NearestFilter;
  texture.minFilter = T2.LinearMipmapLinearFilter;
  const material2 = new T2.MeshBasicMaterial({ map: texture, toneMapped: false });
  if (OS_SKIN) material2.color.setScalar(0.34);
  const mesh = new T2.Mesh(geometry, material2);
  let lastKey = "";
  const update = (spec, title, progress) => {
    const rows = printedRows(progress);
    const key = `${spec ? JSON.stringify(spec) : "none"}|${title}|${rows}`;
    if (key === lastKey) return;
    lastKey = key;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const artY = 12;
    ctx.fillStyle = "#E2E9E1";
    for (let y = 0; y <= COVER_SIZE; y += 2) for (let x = 0; x <= COVER_SIZE; x += 2) {
      ctx.fillRect(PAD + x * CELL, artY + y * CELL, 1, 1);
    }
    if (spec) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(PAD, artY, ART, Math.min(ART, rows * CELL));
      ctx.clip();
      for (const r of runsOf(paintCover(spec))) {
        ctx.fillStyle = r.colour;
        ctx.fillRect(PAD + r.x * CELL, artY + r.y * CELL, r.w * CELL, CELL);
      }
      ctx.restore();
    }
    const noteX = 299;
    ctx.fillStyle = INK_COLOUR;
    ctx.font = '18px "Departure Mono", ui-monospace, monospace';
    ctx.fillText("Now drawing", noteX, 39);
    ctx.fillStyle = "#91A69A";
    ctx.fillRect(noteX, 51, 121, 2);
    ctx.font = '13px "Departure Mono", ui-monospace, monospace';
    ctx.fillStyle = INK_COLOUR;
    ctx.fillText(spec ? "Game in progress" : "Ready to create", noteX, 77);
    if (rows > COVER_SIZE) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(noteX, 97, 132, (rows - COVER_SIZE) / CAPTION_ROWS * 120);
      ctx.clip();
      ctx.font = '20px "Departure Mono", ui-monospace, monospace';
      let line2 = "", y = 121;
      for (const word of title.split(" ")) {
        const next = line2 ? `${line2} ${word}` : word;
        if (ctx.measureText(next).width > 130 && line2) {
          ctx.fillText(line2, noteX, y, 130);
          y += 26;
          line2 = word;
        } else line2 = next;
      }
      ctx.fillText(line2, noteX, y, 130);
      ctx.restore();
    }
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i < Math.floor(rows / (COVER_SIZE + CAPTION_ROWS) * 8) ? "#648079" : "#DDE5DB";
      ctx.fillRect(noteX + i * 15, 239, 10, 5);
    }
    if (rows > 0 && rows < COVER_SIZE) {
      ctx.fillStyle = "#648079";
      ctx.fillRect(PAD, artY + rows * CELL, ART, 1);
    }
    texture.needsUpdate = true;
  };
  update(null, "", 0);
  faces.set(width, { geometry, material: material2, paint: update });
  return { mesh, update, dispose: () => {
  } };
}

// src/render/garageNeighborhood.ts
import * as T3 from "three";
function garageNeighborhood(parent) {
  const g = new T3.Group();
  g.position.y = -0.5;
  parent.add(g);
  box(g, 0, 0.02, -18, 96, 0.08, 4.4, "#808783", false);
  for (const x of [-19, 19]) {
    box(g, x, 0.02, -1.7, 4.4, 0.08, 28.2, "#808783", false);
    for (const dx of [-2.4, 2.4]) box(g, x + dx, 0.04, -1.7, 0.55, 0.1, 28.2, "#c5c5b5", false);
  }
  box(g, 0, 0.04, 18.6, 120, 0.1, 1.1, "#c5c5b5", false);
  for (const [x, width] of [[-35.3, 49.4], [25.3, 69.4]]) box(g, x, 0.04, -20.75, width, 0.1, 1.1, "#c5c5b5", false);
  for (const [x, width] of [[-35, 26], [-13.3, 5.4], [3.3, 25.4], [35, 26]]) box(g, x, 0.04, -15.55, width, 0.1, 0.55, "#c5c5b5", false);
  box(g, -10, 0, -20.75, 1.2, 0.1, 1.1, "#c6c4b2", false);
  for (let z = -19.9; z <= -16.1; z += 0.65) box(g, -10, 0.104, z, 1.2, 8e-3, 0.28, "#d8d9cd", false);
  for (let x = -42; x <= 42; x += 4) box(g, x, 0.105, -18, 1.4, 6e-3, 0.07, "#c7c8b6", false);
  const house = (x, z, turn, colour, roof) => {
    const h = new T3.Group();
    h.position.set(x, 0, z);
    h.rotation.y = turn;
    g.add(h);
    box(h, 0, -0.04, 0, 8.7, 0.04, 7.6, "#919a76", false);
    box(h, 0, 0, 3.7, 1.2, 0.1, 2.5, "#c6c4b2", false);
    box(h, 0, 0, 0, 6.8, 0.2, 5.5, "#a4a799");
    box(h, 0, 0.2, 0, 6.6, 2.6, 5.3, colour);
    const section = new T3.Shape();
    section.moveTo(-3.6, 0);
    section.lineTo(0, 1.25);
    section.lineTo(3.6, 0);
    section.closePath();
    const geometry = new T3.ExtrudeGeometry(section, { depth: 5.9, bevelEnabled: false });
    const mesh = new T3.Mesh(geometry, material(roof));
    mesh.position.set(0, 2.8, -2.95);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.ownGeometry = true;
    h.add(mesh);
    box(h, 1.9, 2.9, -0.8, 0.55, 1.05, 0.6, "#96998b");
    box(h, 0, 0.2, 2.67, 0.95, 1.85, 0.08, "#748279");
    for (const wx of [-2.05, 2.05]) {
      box(h, wx, 1.1, 2.68, 1.3, 1.05, 0.09, "#c2c6b7");
      box(h, wx, 1.2, 2.74, 1.08, 0.83, 0.025, "#839995", false);
      box(h, wx, 1.2, 2.76, 0.055, 0.83, 0.03, "#b8bfaf", false);
    }
    for (const wz of [-1.25, 1.25]) box(h, 3.32, 1.2, wz, 0.035, 0.85, 1.05, "#839995", false);
    box(h, 0, 0.02, 2.95, 1.4, 0.15, 0.5, "#bcbcae");
    hedge(h, -2.9, 3.6, 2.4, 0.5);
    hedge(h, 2.9, 3.6, 2.4, 0.5);
  };
  house(-10, -25, 0, "#b7b9a6", "#7f897c");
  house(2, -25, 0, "#b9b39f", "#8f8878");
  house(14, -25, 0, "#aab4a5", "#7d8982");
  house(-27, -7, Math.PI / 2, "#b9b6a4", "#8d8a79");
  house(-27, 6, Math.PI / 2, "#aeb6a4", "#818b7c");
  house(27, -7, -Math.PI / 2, "#b7b8a6", "#868b7c");
  house(27, 6, -Math.PI / 2, "#b8b09e", "#938b7d");
  house(-11, 26, Math.PI, "#aeb5a5", "#818b7f");
  house(4, 26, Math.PI, "#b7b6a2", "#8a8c7b");
  house(19, 27, Math.PI, "#b6b7a5", "#838d82");
  for (const z of [-38, 38]) {
    box(g, 0, 0.02, z, 120, 0.08, 4.4, "#808783", false);
    for (const dz of [-2.65, 2.65]) box(g, 0, 0.04, z + dz, 120, 0.1, 0.9, "#c5c5b5", false);
    for (const x of [-26, -12, 2, 16, 30]) {
      house(x, z + Math.sign(z) * 8, z < 0 ? 0 : Math.PI, "#adb39f", "#818b7c");
      tree(g, x + 5, z + Math.sign(z) * 7, 2.6);
    }
  }
  for (const [x, z, size] of [
    [-16, -26, 2.3],
    [-4, -26, 2.6],
    [8, -27, 2.4],
    [-27, -15, 2.8],
    [-28, 0, 2.3],
    [27, 0, 2.5],
    [28, -15, 2.7],
    [-19, 24, 2.2],
    [-3, 26, 2.3],
    [12, 26, 2.6],
    [-15, -12, 1.8],
    [15, -12, 2]
  ]) tree(g, x, z, size);
  for (const [x, z] of [[-15.5, 11], [15.5, 11], [-15.5, -14], [15.5, -14]]) {
    cylinder(g, x, 0, z, 0.055, 2.7, "#737e72");
    box(g, x, 2.7, z, 0.32, 0.15, 0.5, OS_SKIN ? OS.lamp : "#bfc6b1");
    if (OS_SKIN) {
      const pool = new T3.PointLight(OS.lamp, 9, 8, 2);
      pool.position.set(x, 2.5, z);
      g.add(pool);
    }
  }
}

// src/render/garageBackyard.ts
import * as T4 from "three";
function garageBackyard(parent) {
  const yard = new T4.Group();
  yard.position.y = -0.5;
  parent.add(yard);
  box(yard, -10, 0, -12.35, 1.2, 0.1, 6.9, "#c6c4b2");
  for (let z = -15; z < -9; z += 0.75) box(yard, -10, 0.101, z, 1.18, 3e-3, 0.014, "#aaaE9c", false);
  const fountain = new T4.Group();
  fountain.position.set(-5.9, 0, -13.1);
  yard.add(fountain);
  const mesh = (geometry, colour, y = 0) => {
    const m = new T4.Mesh(geometry, material(colour));
    m.position.y = y;
    m.userData.ownGeometry = true;
    m.castShadow = true;
    m.receiveShadow = true;
    fountain.add(m);
    return m;
  };
  mesh(new T4.CylinderGeometry(1.87, 1.92, 0.08, 32), "#a6ab99", 0.04);
  mesh(new T4.LatheGeometry([
    new T4.Vector2(0, 0.08),
    new T4.Vector2(1.73, 0.08),
    new T4.Vector2(1.73, 0.31),
    new T4.Vector2(1.79, 0.34),
    new T4.Vector2(1.79, 0.43),
    new T4.Vector2(1.48, 0.43),
    new T4.Vector2(1.48, 0.16),
    new T4.Vector2(0, 0.16)
  ], 32), "#c3c4b3");
  mesh(new T4.CylinderGeometry(1.47, 1.47, 0.018, 48), "#659d9f", 0.285);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    line(fountain, [
      new T4.Vector3(Math.cos(a) * 1.5, 0.432, Math.sin(a) * 1.5),
      new T4.Vector3(Math.cos(a) * 1.77, 0.432, Math.sin(a) * 1.77)
    ], "#9da697");
  }
  cylinder(fountain, 0, 0.16, 0, 0.39, 0.26, "#aab4a7");
  const duck = new T4.Group();
  duck.position.y = 0.447;
  duck.scale.setScalar(0.78);
  duck.rotation.y = 0.55;
  fountain.add(duck);
  const form = (x, y, z, r, colour, stretch) => {
    const part = sphere(duck, x, y, z, r, colour);
    part.scale.multiply(new T4.Vector3(...stretch));
    return part;
  };
  form(0, 0.43, 0, 0.62, "#dfbd54", [1, 0.75, 1.25]);
  form(0, 0.94, 0.38, 0.37, "#e8cc69", [1, 1, 1]);
  form(0, 0.84, 0.78, 0.22, "#c58845", [1.05, 0.32, 1.15]);
  for (const side of [-1, 1]) {
    form(side * 0.51, 0.46, -0.03, 0.3, "#cda744", [0.32, 0.7, 1.3]);
    sphere(duck, side * 0.27, 1.02, 0.59, 0.041, "#383e34");
  }
  form(0, 0.5, -0.65, 0.25, "#dfbd54", [0.6, 0.65, 1.1]).rotation.x = -0.4;
  box(yard, -0.75, 0, -14.7, 3.5, 0.1, 0.7, "#77805d");
  for (let i = 0; i < 9; i++) {
    const x = -2.2 + i * 0.36;
    sphere(yard, x, 0.24, -14.7, 0.19, "#81905e", true);
    sphere(yard, x, 0.4, -14.67, 0.07, i % 2 ? "#b7a7bf" : "#dbc48c", true);
  }
  for (const x of [-1.5, 0.1]) box(yard, x, 0, -13.7, 0.09, 0.44, 0.52, INK.metal);
  for (const z of [-13.9, -13.72, -13.54]) box(yard, -0.7, 0.44, z, 2.15, 0.07, 0.14, INK.wood);
  for (const x of [-1.5, 0.1]) box(yard, x, 0.44, -14, 0.07, 0.45, 0.07, INK.metal);
  for (const y of [0.64, 0.83]) box(yard, -0.7, y, -14, 2.15, 0.12, 0.06, INK.wood);
}

// src/sim/floorPlan.ts
var STUDIO = { width: 20, depth: 16, wallHeight: 3.2, entrance: [-6, -4] };
var GARAGE_WING_EAST = -6;
var GARAGE_OUTLINE = [
  [-10, -6.5],
  [1.5, -6.5],
  [1.5, -9.8],
  [10, -9.8],
  [10, 8],
  [GARAGE_WING_EAST, 8],
  [GARAGE_WING_EAST, 11],
  [-10, 11]
];
var GARAGE_DECK = { x0: -9.88, z0: -6.38, x1: 1.6, z1: -2, rise: 0.24 };
var GARAGE_HERO_SCALE = 1.25;
var GARAGE_PODS = [
  { x: 1.4, z: 0.4, rot: 0 },
  { x: -4.8, z: 4.7, rot: 0 },
  { x: -4.8, z: 0.4, rot: 0 },
  { x: 5.8, z: -4.4, rot: 90 },
  { x: 1.4, z: 4.7, rot: 0 }
];
var LEADER_IDS = ["founder", "james", "billy", "serena", "matt"];
var leaderSeat = (id) => -1 - LEADER_IDS.indexOf(id);
var LEADER_STATIONS = LEADER_IDS.map((id, i) => ({ id, seat: leaderSeat(id), x: -8.1 + i * 2.7, z: -5.9 }));
var GARAGE_LEADERS = [
  { id: "founder", seat: leaderSeat("founder"), x: -5.4, z: -3.9375, rot: 0 },
  { id: "james", seat: leaderSeat("james"), x: -0.7, z: -4.5, rot: 90 }
];
var OFFICE_PODS = [-3.9, 3.6].flatMap((z) => [-8.4, -3.6, 3, 7.8, 12.6].map((x) => ({ x, z, rot: 0 })));
var OFFICE_LEADERS = [
  { id: "founder", seat: leaderSeat("founder"), x: -11.2, z: -10.4, rot: 0, standing: false },
  { id: "james", seat: leaderSeat("james"), x: -6.6, z: -10.4, rot: 0, standing: false },
  { id: "billy", seat: leaderSeat("billy"), x: 0, z: -11.9, rot: 0, standing: true },
  { id: "serena", seat: leaderSeat("serena"), x: 6.6, z: -10.4, rot: 0, standing: false },
  { id: "matt", seat: leaderSeat("matt"), x: 11.8, z: -10.4, rot: 0, standing: false }
];
var OFFICE_PLOTS = OFFICE_LEADERS.map((s) => s.standing ? { id: s.id, x0: s.x - 1.2, x1: s.x + 1.2, z0: -12.6, z1: -11.2 } : { id: s.id, x0: s.x - 2.2, x1: s.x + 2.2, z0: s.z - 0.8, z1: s.z + 2.25 });
var OFFICE_PRESTIGE_RESERVE = { x: 9.5, z: 10, w: 2.4, d: 2.4 };
var STUDIO_DOOR = { x: GARAGE_WING_EAST, z: 9.5, width: 3, height: 2.75, yaw: Math.PI / 2 };
var STUDIO_GABLE = { x0: -10, x1: GARAGE_WING_EAST, z: 11, thickness: 0.24 };
var GARAGE_ENTRY_START = { x: GARAGE_WING_EAST - 0.9, z: 9.5 };
function seatsAtPod(pod, first, index) {
  return Array.from({ length: 4 }, (_, i) => {
    const along = i % 2 ? 0.66 : -0.66;
    const across = i < 2 ? -1.02 : 1.02;
    return pod.rot === 90 ? {
      seat: first + i,
      pod: index,
      x: pod.x + across,
      z: pod.z + along,
      facing: i < 2 ? -Math.PI / 2 : Math.PI / 2
    } : {
      seat: first + i,
      pod: index,
      x: pod.x + along,
      z: pod.z + across,
      facing: i < 2 ? Math.PI : 0
    };
  });
}
var garageSeats = () => GARAGE_PODS.flatMap((pod, p) => seatsAtPod(pod, p * 4, p).map((seat, i) => {
  const along = i % 2 ? 0.92 : -0.92, across = i < 2 ? -1.38 : 1.38;
  return {
    ...seat,
    x: pod.x + (pod.rot === 90 ? across : along),
    z: pod.z + (pod.rot === 90 ? along : across)
  };
}));
function inPolygon(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
var studioFloorContains = (x, z) => inPolygon(GARAGE_OUTLINE, x, z);
var OFFICE_POD_COUNT = OFFICE_PODS.length;
var GARAGE_FURNITURE = [
  /*
   * The rear annex's kitchen — **on the annex's own back wall, not the east
   * one** [amended 2026-09-21, at the user's instruction].
   *
   * The annex is the notch: the far wall steps 3.3 m away from the camera at
   * x = 1.5 and runs at z = −9.8 out to x = 10, which on §12.1's fixed lens is
   * the upper-right edge of the frame. The kitchen was *half* in it. It ran
   * north–south down the east wall from z = −9.35 to −5.05, so 2.85 m of the
   * 4.3 were inside the alcove and the rest hung out through its mouth — and
   * the run plus its clearance left 0.75 m between pod 3's pad and the
   * glazing, which is the only way into the annex from the south and is
   * narrower than a body plus the 0.25 the grid charges either side of one.
   * Turned on to the back wall the same run opens that gap to 2.13 m, and the
   * alcove reads as a room rather than as a corridor with a sink in it.
   *
   * It is the same piece, turned: 4.3 long, backed on to the wall's inner face
   * at z = −9.68. The tall unit turns the corner and ends the run beside the
   * east wall, which is what the concept means by a run that never leaves a
   * metre of wall bare.
   *
   * **The depth is the worktop's 1.2, not the carcass's 1.1**, and the unit
   * stops at x = 9.83 rather than at the wall face at 9.88. Both numbers are
   * the shell's, not the furniture's: the worktop oversails its cupboards by
   * 0.1 at the front, and the east wall's parapet cap and glazing head project
   * 0.045 and 0.03 *inboard* of the face they cap. Set flush to 9.88 the unit
   * had the cap running through it for 1.2 m, which is the defect §13.1 calls
   * 穿模 and which nothing now tests for. A footprint has to be the widest
   * thing drawn on it, and a wall's face is not always where its wall is.
   *
   * The back wall is the right wall for it for a reason the east wall could
   * not offer: it is a *far* wall, so a tall piece standing on it sweeps its
   * silhouette along (−1, −1) into the street. On the east wall the same unit
   * throws that band across the annex floor — see {@link Furniture.h}.
   */
  { kind: "counter", x: 6.56, z: -9.08, w: 4.3, d: 1.2 },
  { kind: "unit", x: 9.27, z: -9.08, w: 1.12, d: 1.2 },
  // One wall-mounted project board replaces the bench and freestanding sprint board.
  // Its tray is included in the walking footprint; huddle slots stay on its +x side.
  { kind: "board", x: -9.72, z: 0.5, w: 0.55, d: 4.82, h: 3.2, facing: Math.PI / 2 },
  // Storage down the shutter wall, in one run rather than two.
  { kind: "shelving", x: -9.6, z: -4.3, w: 0.65, d: 3.6, facing: Math.PI / 2 },
  /*
   * The lounge, backed onto the west wall and looking across the floor.
   *
   * [amended 2026-09-14, at the user's instruction.] It stood a metre off the
   * canted glazed corner, facing −z, which put it *in the entrance*: the one
   * piece of furniture in the room whose whole job is to be somewhere to sit and
   * watch the studio was parked in the draught between the door and the street,
   * with its back to a doorway and nothing behind it. A sofa wants a wall.
   *
   * This one is the wall the camera looks straight at — the west run, whose
   * inner face points +X — so the lounge reads front-on at the top left of the
   * frame and the people on it face the room. The turn is why the footprint
   * below is 0.84 by 3.1 rather than 3.1 by 0.84: §18.3 blocks an *axis-aligned*
   * rectangle, so a quarter turn swaps `w` and `d`, and the renderer takes the
   * piece's own length and depth back out of the pair through `facing`.
   *
   * It stops at z = 6.95 and not at the wing's corner. The run at z = 11 stands
   * full height now, and on §12.1's camera a 3.2 m wall sweeps its silhouette
   * back along (−1, −1) — over the floor from z = 7.8 to the corner. Furniture
   * parked in that band would be drawn with its feet cut off.
   */
  { kind: "sofa", x: -9.46, z: 5.4, w: 0.84, d: 3.1, facing: Math.PI / 2 },
  { kind: "coffee-table", x: -7.95, z: 5.4, w: 0.75, d: 1.5, low: true, facing: Math.PI / 2 },
  // Planting: one in the hub the ring encloses, the rest against the edges.
  { kind: "planter", x: -1.7, z: 0.2, w: 1, d: 1, low: true },
  { kind: "planter", x: -1.7, z: 4.7, w: 1, d: 1, low: true },
  // A shared reference table with stools and a low library makes the east bay useful.
  { kind: "island", x: 6.8, z: 1.6, w: 3, d: 3.4 },
  { kind: "locker", x: 9.1, z: 5.5, w: 0.8, d: 3.6, facing: Math.PI / 2 },
  { kind: "planter", x: 6, z: 5.9, w: 1.1, d: 1.1, low: true },
  { kind: "planter", x: 9.1, z: -0.9, w: 0.9, d: 0.9, low: true },
  { kind: "bench", x: 6, z: 7.35, w: 3.1, d: 0.62, low: true },
  { kind: "planter", x: 7.9, z: 7.2, w: 0.65, d: 0.65, low: true },
  { kind: "planter", x: 4.1, z: 7.2, w: 0.8, d: 0.8, low: true },
  { kind: "planter", x: -9.4, z: 3.3, w: 0.8, d: 0.8, low: true }
];
var OFFICE_FURNITURE = [
  // Billy's board, on the back wall behind him: the project, drawn (§12.4).
  { kind: "board", x: 0, z: -12.72, w: 5.2, d: 0.28, h: 3.2 },
  // The kitchen, along the west wall: counter, fridge and coffee at its south end.
  { kind: "counter", x: -17.3, z: 4.2, w: 1.2, d: 6.4, facing: Math.PI / 2 },
  // The sofa corner.
  { kind: "sofa", x: -17.2, z: 10.6, w: 0.9, d: 3.6, facing: Math.PI / 2 },
  { kind: "coffee-table", x: -14.9, z: 10.6, w: 1, d: 2, low: true },
  { kind: "sofa", x: -12.7, z: 10.6, w: 0.9, d: 3.6, facing: -Math.PI / 2 },
  // The front lounge: where the room meets the glass — two sofas, a low table.
  { kind: "sofa", x: 1.2, z: 8.6, w: 3.6, d: 0.9, facing: Math.PI },
  { kind: "coffee-table", x: 1.2, z: 10.4, w: 2.2, d: 1, low: true },
  { kind: "sofa", x: -3.1, z: 10.4, w: 0.9, d: 3.2, facing: Math.PI / 2 },
  // The reserved base (§9) — knee-high and empty until a reward stands on it.
  { kind: "coffee-table", ...OFFICE_PRESTIGE_RESERVE, h: 0.06, low: true },
  // Planters: along the front glass, and at the ends of the cross aisle.
  ...[-9.5, -6, 5.5, 13.5, 16.8].map((x) => ({ kind: "planter", x, z: 12.3, w: 1, d: 1 })),
  { kind: "planter", x: 16.9, z: -7.6, w: 1, d: 1 },
  { kind: "planter", x: 16.9, z: 1.4, w: 1, d: 1 }
];
function yawToward(dx, dz) {
  return Math.atan2(-dx, -dz);
}
var garageKitchen = GARAGE_FURNITURE.find((f) => f.kind === "counter");
var GARAGE_DESTINATIONS = [
  // Facing the kitchen counter, which is at −z from the standing spot now the
  // run is on the annex's back wall rather than the east one. Both numbers are
  // read off the counter rather than typed: 1.2 along it puts the body at the
  // urn, and half the depth plus 0.85 puts it a comfortable arm's length off
  // the worktop instead of inside the 0.25 the piece claims.
  {
    kind: "water",
    facing: yawToward(0, -1),
    slots: [{ x: garageKitchen.x + 1.2, z: garageKitchen.z + garageKitchen.d / 2 + 0.85 }]
  },
  // Huddles stand in the clear aisle beside the former gate, facing the board.
  {
    kind: "whiteboard",
    facing: yawToward(-1, 0),
    slots: [{ x: -8.5, z: -0.5 }, { x: -8.5, z: 0.5 }, { x: -8.5, z: 1.5 }]
  },
  // The clerestory band, on the half of the far wall the bench leaves free.
  { kind: "window", facing: yawToward(0, -1), slots: [{ x: 2.1, z: -9.1 }, { x: 2.6, z: -9.1 }] },
  // Sitting with your back to the west wall, looking across the floor.
  // Approached between the sofa and its coffee table — see `approach`. The
  // approach is a cell centre on purpose: the gap between the two is 0.7 m and
  // the grid is 0.5, so a spot chosen by eye lands in the sofa's clearance.
  {
    kind: "sofa",
    facing: yawToward(1, 0),
    approach: { x: -8.45, z: 5.4 },
    slots: [{ x: -9.76, z: 4.6 }, { x: -9.76, z: 6.2 }]
  },
  // The hub. Where you stand about in a room shaped like this, because it is
  // the one place every route passes.
  { kind: "loiter", facing: 0, slots: [{ x: -2.4, z: 2.3 }, { x: 3.3, z: -2.8 }, { x: 4.1, z: 4.5 }] }
];
var OFFICE_DESTINATIONS = [
  // The coffee machine at the kitchen's south end, facing the counter (−x).
  { kind: "water", facing: yawToward(-1, 0), slots: [{ x: -15.9, z: 5.6 }, { x: -15.9, z: 6.6 }] },
  // Billy's standup: a huddle in front of his board, facing it.
  { kind: "whiteboard", facing: yawToward(0, -1), slots: [{ x: -1.1, z: -9.6 }, { x: 0, z: -9.3 }, { x: 1.1, z: -9.6 }] },
  // The east glazing, looking down at the city.
  { kind: "window", facing: yawToward(1, 0), slots: [{ x: 17.3, z: -3.2 }, { x: 17.3, z: -2.2 }] },
  // The west sofa, approached from the gap between it and the coffee table.
  { kind: "sofa", facing: yawToward(1, 0), approach: { x: -16.15, z: 10.85 }, slots: [{ x: -17.2, z: 9.9 }, { x: -17.2, z: 11.3 }] },
  // Where you stand about: the cross aisle's two ends and the front commons.
  { kind: "loiter", facing: 0, slots: [{ x: -0.2, z: -1 }, { x: -0.2, z: 7.8 }, { x: 15.6, z: 7.6 }] }
];

// src/render/studioPeople.ts
import * as T6 from "three";

// src/sim/identity.ts
function hash(a) {
  let x = a | 0;
  x = Math.imul(x ^ x >>> 16, 569420461);
  x = Math.imul(x ^ x >>> 15, 1935289751);
  return (x ^ x >>> 15) >>> 0;
}
function draw(seed, index, channel) {
  return hash(hash(seed + index * 2654435769) + channel * 2246822507) / 4294967296;
}
function pick(list, r) {
  return list[Math.min(list.length - 1, Math.floor(r * list.length))];
}
var FIRST = [
  "Priya",
  "Marcus",
  "Yuki",
  "Sofia",
  "Dmitri",
  "Amara",
  "Tobias",
  "Mei",
  "Rafael",
  "Ingrid",
  "Kwame",
  "Elena",
  "Hassan",
  "Nora",
  "Viktor",
  "Aisha",
  "Callum",
  "Sunita",
  "Bjorn",
  "Leila",
  "Owen",
  "Chiara",
  "Farid",
  "Greta",
  "Diego",
  "Anouk",
  "Tariq",
  "Saoirse",
  "Emeka",
  "Hana",
  "Lucas",
  "Zora"
];
var LAST = [
  "Ramanathan",
  "Okonkwo",
  "Lindqvist",
  "Moreau",
  "Petrov",
  "Delgado",
  "Nakamura",
  "Fitzgerald",
  "Bergstr\xF6m",
  "Adeyemi",
  "Kowalski",
  "Haddad",
  "S\xF8rensen",
  "Villanueva",
  "Novak",
  "Achterberg",
  "Marchetti",
  "Duarte",
  "Balogun",
  "Kaminski",
  "Rasmussen",
  "Sinclair",
  "\u0412\u0430\u0440\u0433\u0430",
  "Mbeki"
];
var TRAITS = [
  "Night Owl",
  "Meeting Magnet",
  "Ex-Founder",
  "Types Loudly",
  "Never Reviews",
  "Reads The Docs",
  "Owns The Build",
  "Perpetually Blocked"
];
var CH = {
  first: 1,
  last: 2,
  hair: 3,
  hairColour: 4,
  skin: 5,
  shirt: 6,
  glasses: 7,
  headphones: 8,
  slouch: 9,
  focus: 10,
  chatter: 11,
  seniority: 12,
  hasTrait: 13,
  trait: 14,
  body: 15,
  facialHair: 16
};
var HAIR_SHAPES = 4;
var HAIR_COLOURS = 4;
var SKIN_TONES = 4;
var SHIRT_COLOURS = 5;
var BODY_SHAPES = 4;
var FACIAL_HAIR_STYLES = 4;
var JAMES_HAIR = HAIR_COLOURS;
var JAMES_SHIRT = SHIRT_COLOURS;
var BILLY_HAIR = HAIR_COLOURS + 1;
var BILLY_SHIRT = SHIRT_COLOURS + 1;
var BILLY_TORSO = BODY_SHAPES;
function identityFor(seed, index) {
  const d = (channel) => draw(seed, index, channel);
  const stat = (channel) => Math.round(d(channel) * 100);
  return {
    name: `${pick(FIRST, d(CH.first))} ${pick(LAST, d(CH.last))}`,
    look: {
      hair: Math.floor(d(CH.hair) * HAIR_SHAPES),
      hairColour: Math.floor(d(CH.hairColour) * HAIR_COLOURS),
      skin: Math.floor(d(CH.skin) * SKIN_TONES),
      shirt: Math.floor(d(CH.shirt) * SHIRT_COLOURS),
      body: Math.floor(d(CH.body) * BODY_SHAPES),
      facialHair: Math.floor(d(CH.facialHair) * FACIAL_HAIR_STYLES),
      // Roughly a third wear glasses and a quarter headphones. Both read at the
      // room's scale where nothing subtler does.
      glasses: d(CH.glasses) < 0.34,
      headphones: d(CH.headphones) < 0.26,
      slouch: d(CH.slouch) * 2 - 1
    },
    stats: {
      focus: stat(CH.focus),
      chatter: stat(CH.chatter),
      seniority: stat(CH.seniority)
    },
    trait: d(CH.hasTrait) < 0.125 ? pick(TRAITS, d(CH.trait)) : null
  };
}
var JAMES = {
  name: "James",
  look: {
    // Full head of orange hair, a full orange beard, thick glasses, and a white
    // tee. The orange hair and the white shirt are the two entries appended to
    // the room's part tables past {@link HAIR_COLOURS} and {@link SHIRT_COLOURS},
    // so they are his alone — no generated developer ever rolls them.
    hair: 0,
    hairColour: JAMES_HAIR,
    skin: 1,
    shirt: JAMES_SHIRT,
    body: 1,
    facialHair: 3,
    glasses: true,
    headphones: false,
    slouch: 0.2
  },
  stats: { focus: 99, chatter: 1, seniority: 38 },
  trait: "Owns The Build"
};
var HERO_IDENTITIES = {
  james: JAMES,
  mo: {
    name: "Mo",
    look: {
      hair: 2,
      hairColour: 2,
      skin: 3,
      shirt: 1,
      body: 3,
      facialHair: 0,
      glasses: true,
      headphones: false,
      slouch: -0.1
    },
    stats: { focus: 88, chatter: 46, seniority: 71 },
    trait: null
  },
  serena: {
    name: "Serena",
    look: {
      hair: 1,
      hairColour: 2,
      skin: 2,
      shirt: 0,
      body: 2,
      facialHair: 0,
      glasses: true,
      headphones: false,
      slouch: 0
    },
    stats: { focus: 81, chatter: 22, seniority: 84 },
    trait: null
  },
  matt: {
    name: "Matt",
    look: {
      hair: 1,
      hairColour: 6,
      skin: 2,
      shirt: 3,
      body: 3,
      facialHair: 0,
      glasses: false,
      headphones: true,
      slouch: 0.3
    },
    stats: { focus: 44, chatter: 92, seniority: 55 },
    trait: null
  },
  melany: {
    name: "Melany",
    look: {
      hair: 0,
      hairColour: 0,
      skin: 0,
      shirt: 4,
      body: 1,
      facialHair: 0,
      glasses: true,
      headphones: true,
      slouch: 0.15
    },
    stats: { focus: 63, chatter: 78, seniority: 66 },
    trait: null
  },
  /**
   * §21.7.3 amended 2026-08-29 — **Billy is drawn the way he talks.**
   *
   * He used to be a rolled-looking man with a goatee, which was fine for the
   * hero he was: somebody who turns up because the speedometer nudged past
   * `CHATTY`. He is now the person James went to school with, and the joke of
   * that scene is entirely about a world the founder cannot see — so the look
   * has to carry the half of it that is not spoken. Every field below is one
   * word of the description, and none of them is a roll:
   *
   * | Field | Why |
   * |---|---|
   * | `hair: 1` | The `crop` silhouette — the neat short back and sides. It is the only one of the four that is *tidy*; `full`, `tall` and `wide` all read as somebody who has not been to a barber this month |
   * | `hairColour: BILLY_HAIR` | Fair, and his alone (`art/personPalette.ts`) |
   * | `skin: 0` | The lightest tone. He does not go outside much and he is not sorry |
   * | `shirt: BILLY_SHIRT` | Light blue, and his alone |
   * | `body: BILLY_TORSO` | Slim and tall, with a collar. See `render/room.ts` |
   * | `facialHair: 0` | Clean-shaven. James is the full beard; the contrast is the point, because they are the same age |
   * | `glasses: true` | |
   * | `headphones: false` | §7.8.13 gives him the whiteboard, not a desk to hide at |
   * | `slouch: -0.45` | The most upright posture on the floor. Everybody else leans into a monitor |
   *
   * The stats are unchanged and they were always right: his chatter is the
   * highest number on this table and §7.8.7 is explicit that it does not enter
   * §4.1's production maths. Billy talking a lot is not a criticism of Billy —
   * it is the entire mechanism by which he fixes the studio.
   */
  billy: {
    name: "Billy",
    look: {
      hair: 1,
      hairColour: BILLY_HAIR,
      skin: 0,
      shirt: BILLY_SHIRT,
      body: BILLY_TORSO,
      facialHair: 0,
      glasses: true,
      headphones: false,
      slouch: -0.45
    },
    stats: { focus: 52, chatter: 96, seniority: 49 },
    trait: null
  }
};
function heroIdentity(id) {
  return HERO_IDENTITIES[id] ?? null;
}
function developerAt(seed, index) {
  return identityFor(seed, index);
}

// src/game/founderProfile.ts
var DEFAULT_FOUNDER = {
  name: "You",
  head: "crop",
  hairColour: 0,
  skin: 2,
  accessory: "none",
  facialHair: "none",
  body: "hoodie",
  bodyColour: 1
};
function founderLook(profile) {
  return {
    hair: { crop: 1, wave: 3, coil: 2, buzz: 0 }[profile.head],
    hairColour: profile.hairColour,
    shirt: profile.bodyColour,
    body: { hoodie: 0, tee: 1, jacket: 2, knit: 3 }[profile.body],
    skin: profile.skin,
    glasses: profile.accessory === "glasses",
    headphones: profile.accessory === "headphones",
    facialHair: { none: 0, moustache: 1, goatee: 2, fullBeard: 3 }[profile.facialHair],
    slouch: { hoodie: 0, tee: -0.12, jacket: 0.1, knit: 0.2 }[profile.body]
  };
}

// src/render/avatarParts.ts
var AVATAR_HAIR = [
  { w: 14, h: 12, y: -18 },
  // full
  { w: 15, h: 9, y: -18 },
  // cropped
  { w: 13, h: 15, y: -18 },
  // tall
  { w: 16, h: 11, y: -17 }
  // wide, low
];
var FACE = [
  { x: -4, y: -20, w: 2.5, h: 2, colour: "ink" },
  { x: 1.5, y: -20, w: 2.5, h: 2, colour: "ink" },
  { x: -1.5, y: -14.5, w: 3, h: 1, colour: "mouth" }
];
function outline(x, y, w, h) {
  const t = 0.75;
  return [
    { x, y, w, h: t, colour: "glasses" },
    { x, y: y + h - t, w, h: t, colour: "glasses" },
    { x, y: y + t, w: t, h: h - t * 2, colour: "glasses" },
    { x: x + w - t, y: y + t, w: t, h: h - t * 2, colour: "glasses" }
  ];
}
function facialHair(style) {
  if (style === 1) {
    return [
      { x: -4.5, y: -16, w: 4, h: 2.5, colour: "hair" },
      { x: 0.5, y: -16, w: 4, h: 2.5, colour: "hair" }
    ];
  }
  if (style === 2) {
    return [{ x: -2, y: -14, w: 4, h: 5, colour: "hair" }];
  }
  if (style === 3) {
    return [
      { x: -6, y: -17, w: 12, h: 5, colour: "hair" },
      { x: -5, y: -12, w: 10, h: 3, colour: "hair" }
    ];
  }
  return [];
}
function glasses(enabled) {
  if (!enabled) return [];
  return [
    ...outline(-5, -21.5, 4.5, 4.5),
    ...outline(0.5, -21.5, 4.5, 4.5),
    { x: -0.5, y: -19.75, w: 1, h: 0.75, colour: "glasses" }
  ];
}
function frontAvatarParts(look) {
  return [
    ...FACE,
    ...facialHair(look.facialHair % 4),
    ...glasses(look.glasses)
  ];
}

// src/render/heroHead.ts
function heroHead(head, id, skin, hair) {
  const james = id === "james", billy = id === "billy", serena = id === "serena";
  const ink = "#303432";
  box(head, 0, 0, 0, 0.43, 0.44, 0.38, skin);
  for (const s of [-1, 1]) {
    box(head, s * 0.224, 0.13, -5e-3, 0.045, 0.1, 0.085, skin);
    box(head, s * 0.086, 0.208, -0.196, 0.034, 0.054, 0.014, ink);
    box(head, s * 0.086, 0.296, -0.198, 0.073, 0.019, 0.016, hair);
  }
  box(head, 6e-3, 0.151, -0.208, 0.047, 0.06, 0.041, skin);
  box(head, 0, 0.089, -0.197, 0.082, 0.014, 0.014, "#93694e");
  box(head, 0, 0.377, 0.014, 0.455, 0.092, 0.43, hair);
  box(head, -0.049, 0.469, 0.027, 0.34, 0.035, 0.35, hair);
  box(head, 0, 0.22, 0.185, 0.445, 0.18, 0.07, hair);
  if (serena) {
    for (const s of [-1, 1]) {
      box(head, s * 0.229, 0.032, 0.038, 0.066, 0.365, 0.35, hair);
      box(head, s * 0.193, 0.333, -0.179, 0.075, 0.065, 0.06, hair);
    }
    box(head, -0.037, 0.357, -0.199, 0.31, 0.039, 0.05, hair);
    box(head, 0, 0.045, 0.196, 0.45, 0.26, 0.073, hair);
  } else {
    box(head, -0.062, 0.358, -0.196, 0.305, 0.063, 0.057, hair);
    box(head, 0.161, 0.325, -0.12, 0.065, 0.105, 0.22, hair);
    if (!billy && !james) {
      for (const s of [-1, 1]) box(head, s * 0.218, 0.248, 0.018, 0.029, 0.128, 0.27, "#aaa89e");
      box(head, -0.065, 0.379, -0.198, 0.29, 0.04, 0.019, "#99978f");
    }
  }
  if (james || billy) {
    const bottom = james ? 0.18 : 0.235;
    for (const s of [-1, 1]) {
      box(head, s * 0.218, bottom, -0.12, 0.035, 0.395 - bottom, 0.12, hair);
    }
  }
  if (james || billy) {
    const bottom = james ? 0.15 : 0.235;
    for (const s of [-1, 1]) {
      box(head, s * 0.218, 0.225, 0.018, 0.04, 0.18, 0.34, hair);
      box(head, s * 0.218, bottom, -0.12, 0.04, 0.405 - bottom, 0.14, hair);
      box(head, s * 0.198, bottom, -0.187, 0.043, 0.405 - bottom, 0.063, hair);
    }
  }
  if (james) {
    for (const s of [-1, 1]) {
      box(head, s * 0.164, 0.022, -0.192, 0.095, 0.173, 0.066, hair);
      box(head, s * 0.222, 0.056, -0.051, 0.035, 0.21, 0.25, hair);
      box(head, s * 0.069, 0.112, -0.224, 0.1, 0.035, 0.051, hair);
    }
    box(head, 0, -0.036, -0.198, 0.33, 0.108, 0.082, hair);
    box(head, 0, -0.064, -0.17, 0.244, 0.047, 0.11, hair);
  }
  if (james || billy || serena) {
    const rim = james ? 0.014 : 0.011;
    for (const s of [-1, 1]) {
      const x = s * 0.103, width = 0.169, height = 0.128, y = 0.183;
      box(head, x, y, -0.23, width, rim, 0.014, ink);
      box(head, x, y + height - rim, -0.23, width, rim, 0.014, ink);
      for (const edge of [-1, 1]) box(
        head,
        x + edge * (width - rim) / 2,
        y + rim,
        -0.23,
        rim,
        height - rim * 2,
        0.014,
        ink
      );
      box(head, s * 0.203, 0.252, -0.105, 0.012, 0.013, 0.25, ink);
    }
    box(head, 0, 0.243, -0.232, 0.041, 0.013, 0.014, ink);
  }
  if (id === "matt") {
    for (const s of [-1, 1]) {
      box(head, s * 0.252, 0.155, 0.016, 0.062, 0.135, 0.12, ink);
      box(head, s * 0.244, 0.283, 0.038, 0.026, 0.22, 0.045, ink);
    }
    box(head, 0, 0.504, 0.038, 0.51, 0.027, 0.055, ink);
    box(head, 0.259, 0.153, -0.103, 0.023, 0.022, 0.23, ink);
    box(head, 0.177, 0.153, -0.212, 0.17, 0.022, 0.022, ink);
    box(head, 0.101, 0.144, -0.215, 0.048, 0.038, 0.033, ink);
  }
}

// src/render/founderSculpt.ts
import * as T5 from "three";
function founderHead(head, look, skin, hair) {
  box(head, 0, 0, 0, 0.43, 0.44, 0.38, skin);
  for (const s of [-1, 1]) {
    box(head, s * 0.224, 0.13, 0, 0.05, 0.105, 0.09, skin);
    box(head, s * 0.085, 0.208, -0.198, 0.032, 0.055, 0.018, "#303432");
    box(head, s * 0.088, 0.298, -0.199, 0.075, 0.019, 0.018, hair);
  }
  box(head, 5e-3, 0.147, -0.21, 0.046, 0.067, 0.047, skin);
  box(head, 0, 0.084, -0.2, 0.077, 0.015, 0.016, "#895f48");
  const top = look.hair === 2 ? 0.54 : look.hair === 0 ? 0.435 : 0.485;
  box(head, 0, 0.378, 0.018, 0.455, top - 0.378, 0.425, hair);
  box(head, 0, 0.19, 0.19, 0.445, 0.22, 0.065, hair);
  if (look.hair !== 0) {
    box(head, -0.045, top, 0.03, 0.33, 0.036, 0.35, hair);
    box(head, -0.06, 0.356, -0.196, 0.3, 0.052, 0.055, hair);
    box(head, 0.168, 0.326, -0.12, 0.065, 0.09, 0.22, hair);
  }
  if (look.hair === 3) {
    for (const s of [-1, 1]) box(head, s * 0.224, 0.08, 0.08, 0.065, 0.32, 0.3, hair);
  }
  if (look.hair === 2) {
    for (let i = 0; i < 3; i++) box(head, -0.14 + i * 0.14, 0.515, -0.11, 0.115, 0.075 + i % 2 * 0.025, 0.18, hair);
  }
  if (look.facialHair === 1 || look.facialHair === 3) {
    for (const s of [-1, 1]) box(head, s * 0.056, 0.113, -0.227, 0.096, 0.032, 0.045, hair);
  }
  if (look.facialHair === 2) box(head, 0, -0.014, -0.205, 0.135, 0.085, 0.065, hair);
  if (look.facialHair === 3) {
    for (const s of [-1, 1]) {
      box(head, s * 0.167, 0.024, -0.193, 0.093, 0.17, 0.06, hair);
      box(head, s * 0.221, 0.07, -0.04, 0.035, 0.22, 0.27, hair);
    }
    box(head, 0, -0.037, -0.198, 0.33, 0.107, 0.078, hair);
  }
  if (look.glasses) {
    for (const s of [-1, 1]) {
      for (const y of [0.19, 0.281]) box(head, s * 0.092, y, -0.229, 0.145, 0.014, 0.02, "#293a42");
      for (const x of [0.027, 0.158]) box(head, s * x, 0.204, -0.229, 0.014, 0.077, 0.02, "#293a42");
      box(head, s * 0.218, 0.264, -0.08, 0.014, 0.018, 0.3, "#293a42");
    }
    box(head, 0, 0.251, -0.231, 0.044, 0.014, 0.02, "#293a42");
  }
  if (look.headphones) {
    for (const s of [-1, 1]) {
      box(head, s * 0.262, 0.13, 0, 0.077, 0.18, 0.16, "#344952");
      box(head, s * 0.272, 0.18, -4e-3, 0.084, 0.07, 0.085, "#a9c4c9");
      box(head, s * 0.26, 0.3, 0, 0.035, top + 0.06 - 0.3, 0.08, "#344952");
    }
    box(head, 0, top + 0.06, 0, 0.555, 0.035, 0.09, "#344952");
  }
}
function founderClothes(torso, look, shirt) {
  const trim = "#dbe4df";
  const seam = new T5.Color(shirt).multiplyScalar(0.72).getStyle();
  box(torso, 0, 0.014, -0.113, 0.43, 0.04, 0.027, seam);
  if (look.body === 0) {
    box(torso, 0, 0.095, -0.125, 0.29, 0.115, 0.043, seam);
    box(torso, 0, 0.12, -0.15, 0.23, 0.065, 0.02, shirt);
    for (const s of [-1, 1]) box(torso, s * 0.075, 0.29, -0.13, 0.017, 0.15, 0.021, trim);
  } else if (look.body === 2) {
    for (const s of [-1, 1]) {
      const lapel = box(torso, s * 0.095, 0.3, -0.135, 0.075, 0.19, 0.035, seam);
      lapel.rotation.z = s * -0.23;
      box(torso, s * 0.14, 0.14, -0.133, 0.09, 0.02, 0.02, trim);
    }
    box(torso, 0.018, 0.09, -0.14, 0.018, 0.23, 0.018, "#b6b7ac");
  } else if (look.body === 3) {
    for (let i = 0; i < 5; i++) box(torso, -0.16 + i * 0.08, 0.08, -0.113, 0.013, 0.3, 0.018, seam);
    box(torso, 0, 0.4, -0.137, 0.025, 0.1, 0.017, seam);
  } else {
    box(torso, 0, 0.455, -0.115, 0.19, 0.04, 0.025, seam);
  }
  box(torso, -0.13, 0.31, -0.159, 0.079, 0.06, 0.019, "#dbe4df");
  box(torso, -0.141, 0.329, -0.171, 0.019, 0.018, 8e-3, "#344952");
  box(torso, -0.116, 0.32, -0.171, 0.023, 9e-3, 8e-3, "#344952");
}

// src/art/palette.ts
var RAMPS = {
  /*
   * Ink to paper in nine steps, and nine is not decorative: `bubble.ts` reads
   * `NEUTRAL[7]` for a speech balloon's fill and `NEUTRAL[0]` for its ink, and
   * `bubble.test.ts` holds that pair to 4.5:1 — the body-text bar — because
   * these are short lines at a small size over a busy floor, and anything
   * below it is decoration rather than dialogue. Measured: 12.2:1.
   */
  NEUTRAL: [
    "#23201c",
    "#332e28",
    "#443d34",
    "#5d564c",
    "#756c5e",
    "#8c8272",
    "#b3a996",
    "#e6dfd0",
    "#fffdf8"
  ],
  /** The studio's blue — a poke landing, a thing going well. */
  CALM: ["#12456e", "#1e6eaf", "#4f97d1", "#a9cdea"],
  /*
   * Amber. `WARN[0]` is deliberately the bottom of the ramp and deliberately
   * never a fill: the legacy build drew a warning balloon in it against
   * `NEUTRAL[0]` ink, which measures 1.2:1 — two near-blacks, one of them
   * brown — and `bubble.test.ts` keeps a test that it stays unusable so the
   * mistake cannot be made twice.
   */
  WARN: ["#7a3712", "#b4531f", "#d98341", "#f0c08e"],
  /** The one loud red, spent only on failure — §12.2 reserves saturation. */
  ALARM: ["#6d2114", "#a8341f", "#cc6047", "#e8a08e"],
  /** A screen's own light, which is dull on a lit floor and never a highlight. */
  GLOW: ["#123c45", "#1f6b7a", "#4f9aa8"],
  /*
   * The three ramps the *character* art needs, which the room does not: the
   * founder's portrait on the setup card is drawn in CSS, not rendered in
   * Blender, so it needs skin, hair-wood and foliage as web colours. Kept here
   * rather than in a second file because §12.2's rule about one palette does
   * not stop applying just because the pixels arrive by a different route.
   */
  SKIN: ["#f4d3b4", "#e6b892", "#cf9a72", "#a9724d", "#7d4f34", "#54321f"],
  WOOD: ["#4a2f22", "#6b452c", "#96683f", "#c19366"],
  FOLIAGE: ["#2f4a2c", "#4d7a45", "#7aa86a"]
};

// src/render/studioPeople.ts
var defaultCast = () => ({ seed: 1, founder: founderLook(DEFAULT_FOUNDER), heroes: [] });
var SKINS = [RAMPS.SKIN[0], RAMPS.SKIN[1], RAMPS.SKIN[3], RAMPS.SKIN[5]];
var HAIR = [RAMPS.WOOD[1], RAMPS.WOOD[0], RAMPS.NEUTRAL[1], RAMPS.WOOD[2], "#cf792f", "#d4b05d", "#72716c"];
var SHIRTS = ["#368d90", "#679477", "#d59643", "#6689a6", "#77718a", "#eee9df", "#9dbbd1"];
var FOUNDER_SHIRTS = [RAMPS.NEUTRAL[6], RAMPS.CALM[1], RAMPS.WARN[1], RAMPS.FOLIAGE[1], RAMPS.NEUTRAL[3]];
var LEADER_COLOURS = {
  founder: INK.teal,
  james: INK.amber,
  billy: "#719ab8",
  serena: "#bf7050",
  matt: "#0f4c52"
};
var HERO_LABELS = {
  founder: "YOU",
  james: "JAMES",
  billy: "BILLY",
  serena: "SERENA",
  matt: "MATT",
  melany: "MELANY",
  mo: "MO"
};
var LEG = 0.78;
var HIP = LEG + 0.16;
function personColours(look, id) {
  return {
    skin: id === "matt" ? SKINS[1] : id === "serena" ? RAMPS.SKIN[2] : SKINS[look.skin % SKINS.length],
    hair: HAIR[look.hairColour] ?? HAIR[0],
    shirt: id === "founder" ? FOUNDER_SHIRTS[look.shirt % FOUNDER_SHIRTS.length] : id && id !== "james" && id !== "billy" ? LEADER_COLOURS[id] : SHIRTS[look.shirt] ?? SHIRTS[0]
  };
}
function studioPerson(parent, x, z, facing, look, id, upright = false) {
  const g = new T6.Group();
  g.position.set(x, 0, z);
  g.rotation.y = facing;
  parent.add(g);
  g.userData.dynamic = true;
  g.userData.identity = { ...look };
  const { skin, hair, shirt } = personColours(look, id);
  const broad = id === "billy" ? 0.87 : 1;
  const standing = id === "billy" || upright;
  const extraHeight = id === "billy" ? 0.06 : 0;
  const legLength = LEG + extraHeight;
  const lift = standing ? 0.25 + extraHeight : 0;
  g.userData.standing = standing;
  const bean = OS_SKIN && standing;
  const torso = new T6.Group();
  torso.position.y = bean ? 0 : 0.66 + lift;
  g.add(torso);
  torso.name = "torso";
  box(torso, 0, 0, 0.04, 0.43 * broad, 0.52, 0.29, shirt);
  if (look.body === 0) box(torso, 0, 0.4, 0.13, 0.46, 0.17, 0.23, shirt);
  if (look.body === 2) box(torso, 0, 0.02, -0.112, 0.13, 0.47, 0.018, INK.trim);
  if (look.body === 3 && id !== "matt") box(torso, 0, 0.44, -0.12, 0.27, 0.07, 0.025, INK.trim);
  if (id === "founder") founderClothes(torso, look, shirt);
  if (id === "billy" || id === "james" || id === "matt" || id === "serena") {
    for (const s of [-1, 1]) box(torso, s * 0.09, 0.43, -0.12, 0.1, 0.075, 0.025, id === "serena" ? shirt : INK.trim);
    if (id === "james" || id === "billy") for (let i = 0; i < 3; i++) box(torso, 0, 0.1 + i * 0.11, -0.117, 0.027, 0.027, 0.015, INK.grout);
  }
  if (id === "james" || id === "billy" || id === "serena") {
    box(torso, -0.105, 0.27, -0.119, 0.1, 0.085, 0.022, shirt);
  }
  if (id === "serena") {
    box(torso, 0.14, 0.03, -0.137, 0.074, 0.055, 0.029, INK.metal);
    box(torso, 0.14, 0.049, -0.154, 0.047, 0.021, 0.01, INK.glassLight);
  }
  for (const s of [-1, 1]) {
    if (OS_SKIN) continue;
    if (standing) {
      const leg = new T6.Group();
      leg.position.set(s * 0.13, HIP + extraHeight, 0);
      g.add(leg);
      leg.name = `leg${s}`;
      box(leg, 0, -legLength, 0.012, 0.175 * broad, legLength, 0.21, "#343d45");
      box(leg, 0, -(legLength + 0.09), -0.06, 0.215, 0.1, 0.3, INK.metal);
    } else {
      box(g, s * 0.13, 0.57, -0.1, 0.16, 0.16, 0.43, "#343d45");
      box(g, s * 0.13, 0.16, -0.3, 0.15, 0.43, 0.16, "#343d45");
      box(g, s * 0.13, 0.07, -0.36, 0.19, 0.1, 0.3, INK.metal);
    }
    const arm = new T6.Group();
    arm.position.set(s * 0.29 * broad, 1.07 + lift, 0);
    g.add(arm);
    arm.name = `arm${s}`;
    if (standing) {
      box(arm, 0, -0.42, 0, 0.14, 0.56, 0.17, shirt);
      box(arm, 0, -0.53, 0, 0.14, 0.11, 0.15, skin);
      if (id === "james") {
        box(arm, s * 0.072, -0.22, 0, 0.014, 0.085, 0.074, skin);
        for (let i = 0; i < 3; i++) box(
          arm,
          s * 0.082,
          -0.225 + i * 0.033,
          (i % 2 ? -1 : 1) * 0.035,
          0.01,
          0.018,
          0.026,
          shirt
        );
      }
    } else {
      box(arm, 0, -0.17, 0, 0.14, 0.31, 0.17, shirt);
      box(arm, 0, -0.17, -0.17, 0.14, 0.14, 0.36, shirt);
      box(arm, 0, -0.15, -0.39, 0.14, 0.11, 0.14, skin);
      if (id === "james") {
        box(arm, s * 0.071, -0.14, 0, 0.015, 0.12, 0.11, skin);
        for (let i = 0; i < 4; i++) box(arm, s * 0.082, -0.15 + i * 0.035, (i % 2 ? -1 : 1) * 0.05, 0.013, 0.025, 0.04, shirt);
      }
    }
  }
  const head = new T6.Group();
  head.position.set(0, bean ? 0.52 : 1.18 + lift, 0);
  g.add(head);
  head.name = "head";
  const namedHero = id === "james" || id === "billy" || id === "serena" || id === "matt";
  if (id === "founder") {
    founderHead(head, look, skin, hair);
  } else if (namedHero) {
    heroHead(head, id, skin, hair);
  } else {
    box(head, 0, 0, 0, 0.43, 0.44, 0.38, skin);
    const style = AVATAR_HAIR[look.hair % AVATAR_HAIR.length];
    box(head, 0, 0.37, 0.026, style.w / 30, style.h / 65, 0.44, hair);
    box(head, 0, 0.14, 0.18, 0.44, 0.24, 0.075, hair);
    const colours = { ink: "#242c2d", mouth: "#895f48", hair, glasses: "#29302f" };
    const depth = {
      ink: -0.203,
      mouth: -0.203,
      hair: -0.2055,
      glasses: -0.209
    };
    for (const p of frontAvatarParts(look)) {
      box(
        head,
        (p.x + p.w / 2) / 30,
        (-(p.y + p.h) - 12) / 30,
        depth[p.colour],
        p.w / 30,
        p.h / 30,
        0.023,
        colours[p.colour]
      );
    }
    if (look.headphones) {
      const crownTop = 0.37 + style.h / 65;
      for (const s of [-1, 1]) {
        box(head, s * 0.245, 0.13, 0, 0.06, 0.17, 0.16, "#465462");
        box(head, s * 0.245, 0.3, 0, 0.045, crownTop - 0.3, 0.09, "#303b43");
      }
      box(head, 0, crownTop, 0, 0.53, 0.05, 0.11, "#303b43");
    }
  }
  if (id === "billy") {
    const arm = g.getObjectByName("arm1");
    arm.rotation.x = -0.35;
    box(arm, 0, -0.48, -0.11, 0.25, 0.33, 0.034, INK.woodEdge);
    box(arm, 0, -0.45, -0.133, 0.21, 0.26, 0.012, INK.paper);
    box(arm, 0, -0.18, -0.143, 0.075, 0.039, 0.018, INK.metal);
    for (let i = 0; i < 3; i++) box(
      arm,
      0,
      -0.39 + i * 0.068,
      -0.143,
      0.13,
      0.011,
      0.01,
      INK.grout
    );
  }
  return g;
}
var workerLook = (cast, seat) => developerAt(cast.seed, seat).look;
var leaderLook = (cast, id) => id === "founder" ? cast.founder : heroIdentity(id).look;

// src/render/garageDetails.ts
import * as T8 from "three";

// src/render/garageCraft.ts
import * as T7 from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
var bevel = new RoundedBoxGeometry(1, 1, 1, 2, 0.025);
var finishes2 = /* @__PURE__ */ new Map();
function grain(kind) {
  const size = 128, bytes = new Uint8Array(size * size * 4);
  let seed = 71;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = Math.imul(seed, 1664525) + 1013904223 >>> 0;
    const noise = (seed >>> 24) / 255;
    const bands = Math.sin(y * 0.71 + Math.sin(x * 0.08) * 1.8) * 0.045 + Math.sin(y * 2.9 + x * 0.01) * 0.02;
    const weave = (x % 3 === 0 ? -0.1 : 0) + (y % 3 === 0 ? -0.08 : 0);
    const shade = kind === "wood" ? 0.9 + bands + noise * 0.08 : kind === "cloth" ? 0.96 + weave + noise * 0.035 : 0.92 + noise * 0.07;
    const at = (y * size + x) * 4;
    bytes[at] = bytes[at + 1] = bytes[at + 2] = Math.min(255, shade * 255);
    bytes[at + 3] = 255;
  }
  const t = new T7.DataTexture(bytes, size, size);
  t.wrapS = t.wrapT = T7.RepeatWrapping;
  t.magFilter = T7.LinearFilter;
  t.minFilter = T7.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
var maps = { wood: grain("wood"), stone: grain("stone"), cloth: grain("cloth") };
maps.cloth.repeat.set(4, 4);
function finish(colour, kind) {
  const key = `${colour}:${kind}`;
  if (!finishes2.has(key)) finishes2.set(key, new T7.MeshStandardMaterial({
    color: colour,
    map: maps[kind],
    roughness: kind === "wood" ? 0.72 : 0.94,
    bumpMap: maps[kind],
    bumpScale: kind === "wood" ? 0.018 : 9e-3
  }));
  return finishes2.get(key);
}
function garagePlatformFloor(g, d) {
  const block = 0.84, strip = block / 4;
  for (let x = d.x0, col = 0; x < d.x1; x += block, col++) {
    for (let z = d.z0, row = 0; z < d.z1; z += block, row++) {
      const turned = (col + row) % 2 === 1;
      for (let i = 0; i < 4; i++) {
        const x0 = x + (turned ? i * strip : 0), z0 = z + (turned ? 0 : i * strip);
        const x1 = Math.min(d.x1, x0 + (turned ? strip : block));
        const z1 = Math.min(d.z1, z0 + (turned ? block : strip));
        if (x1 <= x0 || z1 <= z0) continue;
        const board = box(
          g,
          (x0 + x1) / 2,
          d.rise - 0.014,
          (z0 + z1) / 2,
          x1 - x0 - 8e-3,
          0.014,
          z1 - z0 - 8e-3,
          "#aa7b4d",
          false
        );
        board.material = finish(["#ae8156", "#b68b60", "#a77a51", "#bd9367"][(col + row + i) % 4], "wood");
      }
    }
  }
}
function finishGarage(root) {
  root.traverse((node) => {
    if (!(node instanceof T7.Mesh) || node.userData.hit || !(node.material instanceof T7.MeshStandardMaterial) || node.material.map || node.material.transparent) return;
    const colour = `#${node.material.color.getHexString()}`;
    const wood = [INK.wood, INK.woodEdge, "#c39760", "#b7a37a"].includes(colour);
    const cloth = ["#3c6591", "#345b86", "#829caa", "#a8c2ba", "#576568", "#393f3d"].includes(colour);
    const stone = [INK.wall, INK.trim, "#e8e2d4", "#d3d1c5"].includes(colour);
    if (wood || cloth || stone) node.material = finish(colour === INK.wood ? "#b4824e" : colour, wood ? "wood" : cloth ? "cloth" : "stone");
    if (node.geometry.type === "BoxGeometry" && !node.userData.ownGeometry && Math.max(...node.scale.toArray()) < 4 && Math.min(...node.scale.toArray()) > 0.07) node.geometry = bevel;
  });
}
var panels = /* @__PURE__ */ new Map();
function printed(g, key, w, h, x, y, z, paint, yaw = 0) {
  if (typeof document === "undefined" || /jsdom/i.test(navigator.userAgent)) return;
  if (!panels.has(key)) {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 512;
    const c = canvas.getContext("2d");
    paint(c);
    const t = new T7.CanvasTexture(canvas);
    t.colorSpace = T7.SRGBColorSpace;
    const material2 = new T7.MeshBasicMaterial({ map: t });
    if (OS_SKIN && key.startsWith("screen-")) material2.color.setScalar(2.6);
    panels.set(key, material2);
  }
  const mesh = new T7.Mesh(new T7.PlaneGeometry(w, h), panels.get(key));
  mesh.position.set(x, y, z);
  mesh.rotation.y = yaw;
  mesh.userData.ownGeometry = true;
  g.add(mesh);
  if (OS_SKIN && key.startsWith("screen-")) {
    const glow = new T7.PointLight(OS.glow2, 1.6, 2.6, 2);
    glow.position.set(x + Math.sin(yaw) * 0.45, y - 0.05, z + Math.cos(yaw) * 0.45);
    g.add(glow);
  }
}
function garageScreen(g, id, x, y, z, yaw = 0, width = 0.81, height = 0.45) {
  printed(g, `screen-${id}`, width, height, x, y, z, (c) => {
    c.fillStyle = "#172b34";
    c.fillRect(0, 0, 768, 512);
    c.fillStyle = "#36515a";
    c.fillRect(0, 0, 768, 40);
    if (id === "founder") {
      c.fillStyle = "#95c9d8";
      c.fillRect(18, 58, 510, 410);
      c.fillStyle = "#e9f0d8";
      for (let i = 0; i < 4; i++) c.fillRect(40 + i * 120, 100 + i % 2 * 35, 70, 25);
      c.fillStyle = "#547344";
      c.fillRect(18, 398, 510, 70);
      for (let i = 0; i < 4; i++) {
        c.fillStyle = "#759c50";
        c.fillRect(90 + i * 100, 350 - i % 2 * 65, 70, 18);
        c.fillStyle = "#a07b50";
        c.fillRect(90 + i * 100, 368 - i % 2 * 65, 70, 20);
      }
      c.fillStyle = "#d39240";
      c.fillRect(223, 298, 23, 29);
      c.fillStyle = "#e7c392";
      c.fillRect(225, 279, 19, 19);
    }
    for (let i = 0; i < 22; i++) {
      c.fillStyle = ["#86b9a3", "#d6b779", "#91b2c8"][i % 3];
      c.fillRect(id === "founder" ? 554 : 35 + i % 3 * 20, 66 + i * 18, id === "founder" ? 80 + i % 3 * 25 : 220 + i * 37 % 360, 5);
    }
  }, yaw);
}
function lamp(g, x, z) {
  cylinder(g, x, 0.93, z, 0.13, 0.045, INK.metal);
  line(g, [new T7.Vector3(x, 0.97, z), new T7.Vector3(x + 0.08, 1.57, z), new T7.Vector3(x - 0.27, 1.82, z)], INK.metal);
  const stem = box(g, x + 0.04, 0.98, z, 0.045, 0.6, 0.045, INK.metal);
  stem.rotation.z = -0.13;
  const arm = box(g, x - 0.09, 1.56, z, 0.43, 0.045, 0.045, INK.metal);
  arm.rotation.z = -0.58;
  cylinder(g, x - 0.29, 1.7, z, 0.14, 0.12, "#c9a364");
  const bulb = cylinder(g, x - 0.29, 1.694, z, 0.11, 0.015, "#ffe6af");
  bulb.material = sharedMaterial("lamp-bulb", () => new T7.MeshBasicMaterial({ color: "#ffe5a8" }));
}
function craftedHeroDesk(g, id) {
  const desk = new T7.Group();
  desk.name = `${id}-station`;
  g.add(desk);
  box(desk, 0, 0.78, 0.8, 2.24, 0.14, 1.03, INK.wood);
  box(desk, -0.79, 0.08, 0.84, 0.48, 0.7, 0.86, INK.woodEdge);
  for (let i = 0; i < 3; i++) {
    box(desk, -0.79, 0.12 + i * 0.21, 0.397, 0.44, 0.18, 0.035, id === "founder" ? "#477671" : INK.wood);
    box(desk, -0.79, 0.24 + i * 0.21, 0.37, 0.19, 0.025, 0.025, "#b9beb7");
  }
  for (const zz of [0.39, 1.2]) box(desk, 0.9, 0.02, zz, 0.1, 0.76, 0.1, INK.woodEdge);
  box(desk, 0, 0.58, 1.22, 1.7, 0.18, 0.08, INK.woodEdge);
  const monitor = new T7.Group();
  monitor.position.set(-0.04, 0, 0.92);
  monitor.rotation.y = Math.PI;
  desk.add(monitor);
  box(monitor, 0, 0.925, 0, 0.27, 0.035, 0.2, INK.metal);
  box(monitor, 0, 0.95, 0, 0.06, 0.18, 0.07, INK.metal);
  box(monitor, 0, 1.08, 0, 0.91, 0.55, 0.055, INK.metal);
  garageScreen(monitor, id, 0, 1.365, 0.03);
  box(desk, -0.06, 0.924, 0.48, 0.63, 0.025, 0.22, "#747f7b");
  for (let row = 0; row < 3; row++) for (let col = 0; col < 9; col++) box(desk, -0.32 + col * 0.065, 0.95, 0.415 + row * 0.06, 0.045, 7e-3, 0.037, "#c5c8bd");
  box(desk, 0.46, 0.924, 0.49, 0.21, 0.013, 0.25, "#385359");
  box(desk, 0.46, 0.94, 0.48, 0.085, 0.04, 0.12, "#b7bdb9");
  lamp(desk, 0.89, 1.07);
  if (id === "founder") {
    printed(desk, "founder-machine-excuse", 0.73, 0.32, -0.04, 1.36, 0.958, (c) => {
      c.fillStyle = "#f6df85";
      c.fillRect(0, 0, 768, 512);
      c.fillStyle = "#3f514e";
      c.textAlign = "center";
      c.font = "bold 105px sans-serif";
      c.fillText("IT WORKS ON", 384, 205);
      c.fillText("MY MACHINE", 384, 345);
    });
    box(desk, 0.7, 0.92, 0.74, 0.38, 0.065, 0.32, "#374e50");
    cylinder(desk, 0.7, 0.985, 0.74, 0.13, 0.1, "#cf5441");
    printed(desk, "founder-ship-it", 0.34, 0.12, 0.7, 0.96, 0.907, (c) => {
      c.fillStyle = "#f5edda";
      c.fillRect(0, 0, 768, 512);
      c.fillStyle = "#7b352a";
      c.textAlign = "center";
      c.font = "bold 190px sans-serif";
      c.fillText("SHIP IT", 384, 320);
    });
  }
  const plant = new T7.Group();
  plant.position.y = 0.92;
  desk.add(plant);
  leafyPlanter(plant, id === "founder" ? 0.61 : -0.73, 1.14, 0.19);
  if (id !== "founder") for (let i = 0; i < 2; i++) box(desk, -0.69, 0.925 + i * 0.042, 0.76, 0.3, 0.035, 0.21, i ? INK.paper : "#417174");
}
var cokeMaterial;
function dietCoke(g, x, y, z) {
  const body = cylinder(g, x, y, z, 0.085, 0.22, "#cdd1cd");
  if (typeof document !== "undefined" && !/jsdom/i.test(navigator.userAgent)) {
    if (!cokeMaterial) {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 256;
      const c = canvas.getContext("2d");
      c.fillStyle = "#d5d8d6";
      c.fillRect(0, 0, 512, 256);
      for (let i = 0; i < 2; i++) {
        c.fillStyle = "#555b5b";
        c.font = "italic 36px sans-serif";
        c.fillText("Diet", 26 + i * 256, 78);
        c.fillStyle = "#b72727";
        c.font = "bold italic 75px Georgia";
        c.fillText("Coke", 8 + i * 256, 163);
      }
      const map = new T7.CanvasTexture(canvas);
      map.colorSpace = T7.SRGBColorSpace;
      cokeMaterial = new T7.MeshStandardMaterial({ map, roughness: 0.43, metalness: 0.24 });
    }
    body.material = cokeMaterial;
  }
  cylinder(g, x, y + 0.219, z, 0.078, 0.01, "#a7afac");
  box(g, x, y + 0.23, z, 0.023, 5e-3, 0.047, "#626a67");
}
function craftedChair(g, x, z, facing, hero = false) {
  const chair = new T7.Group();
  chair.position.set(x, 0, z);
  chair.rotation.y = facing;
  g.add(chair);
  const w = hero ? 0.66 : 0.55;
  box(chair, 0, 0.5, 0.06, w, 0.15, 0.56, "#414c4b");
  box(chair, 0, 0.66, 0.35, w, hero ? 0.81 : 0.57, 0.14, "#414c4b");
  for (let row = 0; row < (hero ? 4 : 3); row++) for (let col = 0; col < 2; col++) box(chair, (col - 0.5) * w * 0.48, 0.7 + row * 0.18, 0.438, w * 0.46, 0.165, 0.026, "#576568");
  cylinder(chair, 0, 0.15, 0.1, 0.05, 0.35, INK.metal);
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5, xx = Math.cos(angle) * 0.29, zz = 0.1 + Math.sin(angle) * 0.29;
    const spoke = box(chair, xx / 2, 0.11, (zz + 0.1) / 2, 0.33, 0.045, 0.045, INK.metal);
    spoke.rotation.y = -angle;
    cylinder(chair, xx, 0.045, zz, 0.052, 0.08, INK.metal);
  }
  if (hero) for (const side of [-1, 1]) {
    box(chair, side * 0.37, 0.54, 0.02, 0.035, 0.28, 0.035, INK.metal);
    box(chair, side * 0.37, 0.8, -0.04, 0.1, 0.045, 0.32, "#414c4b");
  }
  return chair;
}
function leafyPlanter(g, x, z, size = 0.55) {
  box(g, x, 0, z, size, size * 0.55, size, "#d0c7b5");
  box(g, x, size * 0.55, z, size * 0.83, 0.025, size * 0.83, "#60513b");
  for (let i = 0; i < 9; i++) {
    const angle = i * Math.PI * 2 / 9;
    const leaf2 = box(g, x + Math.cos(angle) * size * 0.23, size * 0.57, z + Math.sin(angle) * size * 0.23, size * 0.14, size * (0.8 + i % 3 * 0.18), size * 0.1, i % 2 ? "#68804b" : "#8c9d5b");
    leaf2.rotation.set(Math.sin(angle) * 0.5, angle, -Math.cos(angle) * 0.5);
  }
}
function craftedSingleDesk(g, index) {
  box(g, 0, 0.78, 0.72, 1.64, 0.12, 0.88, INK.wood);
  box(g, -0.62, 0.04, 0.74, 0.38, 0.74, 0.72, INK.woodEdge);
  for (let i = 0; i < 3; i++) {
    box(g, -0.62, 0.1 + i * 0.22, 0.365, 0.33, 0.19, 0.025, "#648079");
    box(g, -0.62, 0.22 + i * 0.22, 0.342, 0.12, 0.025, 0.025, INK.trim);
  }
  for (const z of [0.38, 1.02]) box(g, 0.72, 0.02, z, 0.07, 0.76, 0.07, INK.woodEdge);
  box(g, 0, 0.9, 0.85, 0.27, 0.035, 0.18, INK.metal);
  box(g, 0, 0.93, 0.85, 0.055, 0.16, 0.06, INK.metal);
  box(g, 0, 1.04, 0.85, 0.7, 0.43, 0.065, INK.metal);
  garageScreen(g, "developer", 0, 1.255, 0.812, Math.PI, 0.64, 0.36);
  box(g, 0, 0.905, 0.45, 0.52, 0.025, 0.19, "#b5b9af");
  cylinder(g, 0.54, 0.9, 0.55, 0.07, 0.15, index % 2 ? "#c39955" : "#648079");
  box(g, -0.5, 0.9, 0.92, 0.25, 0.045, 0.18, INK.paper);
}
function garageSurfaceDetails(g) {
  for (let z = -10.75, row = 0; z < 11; z += 0.5, row++) {
    for (let x = -9.75; x < 10; x += 0.5) {
      if (!studioFloorContains(x, z)) continue;
      const plank = Math.floor((x + 10 + row % 3) / 3);
      box(g, x, 4e-3, z, 0.501, 8e-3, 0.49, ["#b99368", "#c39c70", "#bd9569", "#c7a177"][(plank + row) % 4], false);
      if ((Math.round((x + 10) * 2) + row * 2) % 6 === 0) box(g, x - 0.247, 0.013, z, 0.012, 3e-3, 0.49, "#99774f", false);
    }
  }
  for (let y = 0.45; y < 3.15; y += 0.45) {
    for (const [x0, x1] of [[-10, -7.8], [-3.8, 1.5]]) {
      box(g, (x0 + x1) / 2, y, -6.372, x1 - x0, 9e-3, 7e-3, "#bfb6a5", false);
      for (let x = x0 + (Math.round(y / 0.45) % 2 ? 0.5 : 1); x < x1; x += 1) box(g, x, y - 0.43, -6.371, 8e-3, 0.43, 8e-3, "#c6bdac", false);
    }
    box(g, 5.75, y, -9.67, 8.4, 0.01, 7e-3, "#c6bdac", false);
  }
  for (const x of [-7.2, -4.4]) {
    const plant = new T7.Group();
    plant.position.y = 0.93;
    g.add(plant);
    leafyPlanter(plant, x, -6.27, 0.32);
  }
}
function loungeDressing(g, len) {
  for (let i = -1; i <= 1; i++) {
    box(g, i * 0.87, 0.6, 0.09, 0.83, 0.07, 0.53, "#4d738c");
    box(g, i * 0.87, 0.77, -0.16, 0.81, 0.3, 0.05, "#4d738c");
  }
  for (const dx of [-1.05, 1]) {
    const pillow = box(g, dx, 0.66, -0.01, 0.43, 0.39, 0.16, dx < 0 ? "#c6b18d" : "#c4bca9");
    pillow.rotation.z = dx < 0 ? 0.13 : -0.1;
  }
  for (let i = 0; i < 12; i++) box(g, -len / 2 + i * 0.28, 0.032, 0.97, 0.016, 4e-3, 2.4, "#b8c2b8", false);
}

// src/render/garageDetails.ts
var SIGN_INK = "#28544f";
var signs = /* @__PURE__ */ new Map();
function nameSign(parent, label, x, y, z, width, facing = 0, bg = SIGN_INK) {
  if (typeof document === "undefined" || /jsdom/i.test(navigator.userAgent)) return;
  const key = `${label}|${bg}|${width}`;
  let sign = signs.get(key);
  if (!sign) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 220;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1024, 220);
    let font = 82;
    do {
      ctx.font = `600 ${font}px sans-serif`;
      font -= 2;
    } while (ctx.measureText(label).width > 930 && font > 20);
    ctx.fillStyle = "#fffaf0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 512, 112);
    const texture = new T8.CanvasTexture(canvas);
    texture.colorSpace = T8.SRGBColorSpace;
    sign = { geometry: new T8.PlaneGeometry(width, width * 220 / 1024), material: new T8.MeshBasicMaterial({ map: texture }) };
    signs.set(key, sign);
  }
  const mesh = new T8.Mesh(sign.geometry, sign.material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = facing;
  parent.add(mesh);
}
var NAME_Y = 2.8;
var NAME_CAP = 0.34;
var NAME_DROP = 0.5;
var NAME_AXIS = 0;
var NAME_TRACKING = 2;
var NAME_FORWARD = -0.45;
var RASTER_PX = 22;
var RASTER_SCALE = 2;
function departureRuns(label, tracking = NAME_TRACKING) {
  if (typeof document === "undefined" || /jsdom/i.test(navigator.userAgent)) return null;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const font = `${RASTER_PX}px "Departure Mono", ui-monospace, monospace`;
  canvas.width = RASTER_PX * 3;
  canvas.height = RASTER_PX * 3;
  const snap = RASTER_SCALE;
  const glyph = (ch) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = font;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText(ch, RASTER_PX, RASTER_PX * 1.5);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const lit = (x, y) => data[(y * width + x) * 4 + 3] > 128;
    let x0 = width, x1 = -1, y0 = height, y1 = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!lit(x, y)) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    if (x1 < x0) return null;
    const cols = Math.ceil((x1 - x0 + 1) / snap);
    const rows2 = Math.ceil((y1 - y0 + 1) / snap);
    const cells = [];
    for (let cy = 0; cy < rows2; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        let on = false;
        for (let dy = 0; dy < snap && !on; dy++) {
          for (let dx = 0; dx < snap && !on; dx++) {
            const x = x0 + cx * snap + dx, y = y0 + cy * snap + dy;
            if (x <= x1 && y <= y1 && lit(x, y)) on = true;
          }
        }
        cells[cy * cols + cx] = on;
      }
    }
    return { cells, cols, rows: rows2, top: Math.floor(y0 / snap) };
  };
  const drawn = [...label].map(glyph);
  if (!drawn.some(Boolean)) return null;
  const capTop = Math.min(...drawn.filter(Boolean).map((g) => g.top));
  const rows = Math.max(...drawn.filter(Boolean).map((g) => g.rows + (g.top - capTop)));
  const runs = [];
  let pen = 0;
  for (const g of drawn) {
    if (!g) {
      pen += 3 + tracking;
      continue;
    }
    const lift = g.top - capTop;
    for (let cy = 0; cy < g.rows; cy++) {
      let start = -1;
      for (let cx = 0; cx <= g.cols; cx++) {
        const on = cx < g.cols && g.cells[cy * g.cols + cx];
        if (on && start < 0) start = cx;
        if (!on && start >= 0) {
          runs.push({ x: pen + start, y: cy + lift, w: cx - start });
          start = -1;
        }
      }
    }
    pen += g.cols + tracking;
  }
  return { runs, cols: Math.max(1, pen - tracking), rows };
}
function heroName(parent, label, y, colour, yaw = 0, sub) {
  const g = new T8.Group();
  g.position.set(0, 0, NAME_FORWARD);
  g.rotation.y = NAME_AXIS - yaw;
  parent.add(g);
  const cap = NAME_CAP;
  const panel = new T8.Group();
  panel.position.y = y - NAME_DROP;
  g.add(panel);
  const lift = sub ? cap * 0.62 : 0;
  const width = letterBoxes(panel, label, cap, 0.03, INK.paper, lift) || cap * 3;
  const subWidth = sub ? letterBoxes(panel, sub, cap * 0.34, 0.03, INK.paper, 0) : 0;
  const w = Math.max(width, subWidth) + cap * 0.9;
  const h = cap + lift + cap * 0.7;
  box(panel, 0, -cap * 0.35, -0.04, w, h, 0.07, colour);
  for (const at of [-cap * 0.35 - 0.04, -cap * 0.35 + h]) {
    box(panel, 0, at, -0.04, w + 0.06, 0.04, 0.1, INK.trim);
  }
  return g;
}
function letterBoxes(g, label, cap, depth, colour, base = 0, tracking = NAME_TRACKING) {
  const ink = departureRuns(label, tracking);
  if (!ink) return 0;
  const unit = cap / ink.rows;
  const width = ink.cols * unit;
  for (const run of ink.runs) {
    box(
      g,
      -width / 2 + (run.x + run.w / 2) * unit,
      base + (ink.rows - 1 - run.y) * unit,
      0,
      run.w * unit,
      unit,
      depth,
      colour
    );
  }
  return width;
}
function signLayout(label, maxWidth, maxHeight, gap, limits = {}) {
  const { maxCap = Infinity, splitBelow = 0 } = limits;
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const score = (lines) => {
    const ink = lines.map((line2) => departureRuns(line2));
    if (ink.some((m) => !m)) return null;
    return { lines, cap: Math.min(
      maxCap,
      (maxHeight - gap * (lines.length - 1)) / lines.length,
      ...ink.map((m) => maxWidth * m.rows / m.cols)
    ) };
  };
  const splits = [[words.join(" ")]];
  for (let i = 1; i < words.length; i++) {
    splits.push([words.slice(0, i).join(" "), words.slice(i).join(" ")]);
  }
  let best = null;
  for (const lines of splits) {
    const fit = score(lines);
    if (!fit) return null;
    if (!best || fit.cap > best.cap) best = fit;
  }
  if (best && best.cap < splitBelow && words.length === 1 && words[0].length > 5) {
    const whole = words[0];
    const alt = score([whole.slice(0, Math.round(whole.length / 2)), whole.slice(Math.round(whole.length / 2))]);
    if (alt && alt.cap > best.cap) best = alt;
  }
  return best;
}
function gableSign(g, name, gable = STUDIO_GABLE) {
  const sign = new T8.Group();
  sign.name = "studio-gable-sign";
  sign.position.set((gable.x0 + gable.x1) / 2, 0, gable.z + gable.thickness / 2);
  g.add(sign);
  const low = 0.9, high = 3.05;
  const width = Math.abs(gable.x1 - gable.x0) - 0.6;
  const gap = 0.12;
  const fit = signLayout(name, width, 1.25, gap, { maxCap: 0.52, splitBelow: 0.24 });
  const mark = 0.66;
  const rule = 0.05;
  const block = fit ? mark + 0.18 + fit.cap * fit.lines.length + gap * (fit.lines.length - 1) + 0.14 + rule : 0;
  let y = low + (high - low - block) / 2;
  const face = new T8.Group();
  face.position.z = 0.03;
  sign.add(face);
  if (fit) {
    const natural = fit.lines.map((line2) => letterWidth(line2, fit.cap));
    const over = Math.max(...natural) / width;
    const cap = over > 1 ? fit.cap / over : fit.cap;
    const measure = fit.lines.map((line2) => letterWidth(line2, cap));
    const widest = Math.max(...measure);
    box(face, 0, y, 0, widest, rule, 0.05, INK.amber);
    y += rule + 0.14;
    fit.lines.forEach((line2, i) => {
      const spread = measure[i] < widest - 0.01 ? justifyTracking(line2, cap, widest) : null;
      letterBoxes(
        face,
        line2,
        cap,
        0.06,
        SIGN_INK,
        y + (fit.lines.length - 1 - i) * (cap + gap),
        spread ?? NAME_TRACKING
      );
    });
    y += cap * fit.lines.length + gap * (fit.lines.length - 1) + 0.18;
  }
  const initial = [...name.trim().toUpperCase()].find((c) => /[A-Z0-9]/.test(c)) ?? "";
  box(face, 0, y, -0.01, mark, mark, 0.05, SIGN_INK);
  if (initial) {
    const plaque = new T8.Group();
    plaque.position.z = 0.055;
    sign.add(plaque);
    const cap = mark * 0.54;
    letterBoxes(plaque, initial, cap, 0.04, INK.paper, y + (mark - cap) / 2);
  }
  return sign;
}
function letterWidth(label, cap, tracking = NAME_TRACKING) {
  const ink = departureRuns(label, tracking);
  return ink ? ink.cols * cap / ink.rows : 0;
}
function justifyTracking(label, cap, width) {
  const natural = departureRuns(label, 0);
  if (!natural) return null;
  const gaps = [...label.trim()].length - 1;
  if (gaps < 1 || cap <= 0) return null;
  const tracking = (width * natural.rows / cap - natural.cols) / gaps;
  return tracking > NAME_TRACKING && tracking <= NAME_TRACKING * 3 ? tracking : null;
}
function entrance(g, placement = STUDIO_DOOR) {
  const { width, height, yaw } = placement;
  const x = 0, z = 0;
  const door = new T8.Group();
  door.name = "studio-entrance";
  g.add(door);
  door.position.set(placement.x, 0, placement.z);
  door.rotation.y = yaw;
  for (const side of [-1, 1]) {
    box(door, x + side * (width / 2 - 0.13), 0, z, 0.26, height, 0.26, INK.wall);
  }
  const leafWidth = width - 0.58;
  box(door, x, 2.55, z, width, height - 2.55, 0.26, INK.wall);
  box(door, x, height, z, width + 0.1, 0.1, 0.32, INK.trim);
  const leaf2 = new T8.Group();
  leaf2.name = "studio-door-leaf";
  leaf2.position.set(-leafWidth / 2, 0, 0);
  leaf2.rotation.y = Math.PI / 3;
  door.add(leaf2);
  box(leaf2, leafWidth / 2, 0.08, 0, leafWidth, 0.2, 0.09, INK.teal);
  const glass = box(leaf2, leafWidth / 2, 0.28, 0, leafWidth, 2.18, 0.045, "#b1c7c8", false);
  glass.material = sharedMaterial("studio-door-glass", () => new T8.MeshStandardMaterial({ color: "#b1c7c8", transparent: true, opacity: 0.28, depthWrite: false, roughness: 0.35 }));
  for (const dx of [0, leafWidth]) box(leaf2, dx, 0.08, 0, 0.075, 2.45, 0.1, INK.teal);
  box(leaf2, leafWidth / 2, 2.46, 0, leafWidth, 0.08, 0.1, INK.teal);
  box(leaf2, leafWidth - 0.2, 1.05, 0.1, 0.05, 0.45, 0.06, INK.metal);
  box(door, x + width / 2 - 0.13, 1.35, z + 0.15, 0.14, 0.22, 0.06, INK.metal);
  box(door, x, -0.02, z, leafWidth, 0.02, 0.38, INK.trim);
  box(door, x, -0.3, z + 0.48, leafWidth + 0.2, 0.15, 0.65, INK.trim);
  box(door, x, -0.315, z + 1.05, leafWidth, 0.025, 0.58, "#556964");
  return door;
}
function garageDeskStory(g, id) {
  if (id === "james") {
    const can = (x, y, z) => dietCoke(g, x, y, z);
    box(g, -1.35, 0, 0.83, 0.55, 0.78, 0.85, INK.woodEdge);
    box(g, -1.35, 0.78, 0.83, 0.61, 0.06, 0.91, INK.wood);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        for (let level = 0; level < 3 - Math.abs(col - 1); level++) can(-1.55 + col * 0.2, 0.84 + level * 0.232, 0.6 + row * 0.22);
      }
    }
    can(0.64, 0.92, 0.63);
    can(0.83, 0.92, 0.63);
    nameSign(g, "Diet Coke", -1.35, 0.55, 0.365, 0.48, Math.PI, "#9e3f36");
    box(g, -1.3, 0, -0.08, 0.47, 0.42, 0.42, "#506565");
    box(g, -1.3, 0.42, -0.08, 0.39, 0.012, 0.34, "#253b3c");
    for (let i = 0; i < 3; i++) dietCoke(g, -1.44 + i * 0.14, 0.34, -0.08);
  } else if (id === "founder") {
    box(g, -0.67, 0.92, 1, 0.47, 0.26, 0.35, "#edbe47");
    box(g, -0.67, 1.12, 1.03, 0.3, 0.28, 0.29, "#f4cf58");
    box(g, -0.67, 1.14, 1.22, 0.25, 0.085, 0.18, "#d77b36");
    for (const x of [-0.765, -0.575]) {
      box(g, x, 1.25, 1.184, 0.072, 0.09, 0.035, "#fff6dc");
      box(g, x, 1.27, 1.207, 0.034, 0.045, 0.02, "#263c3c");
    }
    box(g, -0.67, 1.4, 1.03, 0.3, 0.045, 0.26, "#d49a33");
    for (const x of [-0.78, -0.67, -0.56]) box(g, x, 1.445, 1.12, 0.045, 0.1, 0.045, "#e8b541");
    nameSign(g, "CTO", -0.67, 1.01, 1.185, 0.32, 0, "#5f4c2c");
    for (let i = 0; i < 3; i++) {
      box(g, 0.42, 0.04 + i * 0.085, 0.83, 0.67, 0.07, 0.61, i % 2 ? "#c49b68" : "#e3c99a");
      box(g, 0.42, 0.055 + i * 0.085, 1.14, 0.39, 0.035, 0.012, "#b45338");
    }
  }
}
function street(g) {
  box(g, 0, -0.55, 15, 120, 0.15, 5.2, "#747d7c", false);
  for (const [x, width] of [[-41, 38], [0, 32], [41, 38]]) box(g, x, -0.37, 12.3, width, 0.1, 0.26, INK.trim);
  box(g, 0, -0.37, 17.7, 120, 0.1, 0.26, INK.trim);
  for (let x = -57; x <= 57; x += 3) box(g, x, -0.392, 15, 1.5, 8e-3, 0.085, "#e5dfc9", false);
  for (let z = 12.65; z <= 17.4; z += 0.72) box(g, -3.2, -0.392, z, 2.6, 8e-3, 0.3, "#d8d9cd", false);
  for (const x of [-7, 1, 12]) {
    box(g, x, -0.391, 12.6, 0.65, 0.01, 0.32, INK.metal, false);
    for (let i = 0; i < 5; i++) box(g, x - 0.23 + i * 0.115, -0.38, 12.6, 0.035, 5e-3, 0.26, "#9ca49c", false);
  }
}
function garageForecourt(g) {
  const yard = new T8.Group();
  yard.position.y = -0.32;
  g.add(yard);
  for (const x of [5.1, 7.1]) box(yard, x, 0, 10.65, 0.12, 0.45, 0.62, INK.metal);
  for (const z of [10.42, 10.62, 10.82]) box(yard, 6.1, 0.45, z, 2.5, 0.09, 0.16, INK.wood);
  for (const x of [5.1, 7.1]) box(yard, x, 0.4, 10.3, 0.09, 0.6, 0.09, INK.metal);
  for (const y of [0.68, 0.88]) box(yard, 6.1, y, 10.3, 2.5, 0.14, 0.08, INK.wood);
  box(yard, 8.45, 0, 10.6, 0.55, 0.8, 0.55, "#536b62");
  box(yard, 8.45, 0.8, 10.6, 0.6, 0.07, 0.6, INK.metal);
  box(yard, 8.45, 0.59, 10.88, 0.34, 0.12, 0.012, INK.metal);
  for (const x of [-5.4, 10.6]) {
    cylinder(yard, x, 0, 11.5, 0.065, 0.95, INK.metal);
    cylinder(yard, x, 0.78, 11.5, 0.11, 0.13, INK.trim);
    cylinder(yard, x, 0.91, 11.5, 0.13, 0.06, INK.metal);
  }
}

// src/render/garageEnvironment.ts
var hitGeometry = new T9.BoxGeometry(1, 1, 1);
var heroHitGeometry = new T9.CylinderGeometry(0.5, 0.5, 1, 12);
var hitMaterial = new T9.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
function studioTarget(env, x, z, seat, label, scale = 1, elevation = 0) {
  const mesh = new T9.Mesh(seat < 0 ? heroHitGeometry : hitGeometry, hitMaterial);
  mesh.position.set(x, scale + elevation, z);
  mesh.scale.set(1.1 * scale, 1.75 * scale, 1.1 * scale);
  mesh.userData.hit = true;
  env.root.add(mesh);
  env.targets.push({ mesh, rank: 0, index: seat, label, population: 1, radius: 0.4 });
}
function placed(parent, f) {
  const turn = f.facing ?? 0;
  const g = new T9.Group();
  g.position.set(f.x, 0, f.z);
  g.rotation.y = turn;
  parent.add(g);
  const cs = Math.abs(Math.cos(turn)), sn = Math.abs(Math.sin(turn));
  return { g, len: cs * f.w + sn * f.d, dep: sn * f.w + cs * f.d };
}
function shelving(g, x, z, rotation = 0) {
  const shelf = new T9.Group();
  shelf.position.set(x, 0, z);
  shelf.rotation.y = rotation;
  g.add(shelf);
  for (const dx of [-0.75, 0.75]) box(shelf, dx, 0, 0, 0.09, 2.3, 0.65, INK.woodEdge);
  for (let i = 0; i < 4; i++) {
    box(shelf, 0, 0.12 + i * 0.64, 0, 1.6, 0.08, 0.65, INK.wood);
    for (let j = 0; j < 3; j++) {
      const colour = [INK.glassLight, "#61988a", INK.trim, INK.wood][(i + j) % 4];
      box(shelf, -0.5 + j * 0.49, 0.2 + i * 0.64, 0, 0.39, 0.35, 0.5, colour);
      box(shelf, -0.5 + j * 0.49, 0.3 + i * 0.64, 0.255, 0.16, 0.075, 0.01, INK.paper);
    }
  }
}
var GARAGE_ASSEMBLED = { founder: true, james: 3 };
function prop(env, parent, key, x = 0, z = 0) {
  const g = new T9.Group();
  g.position.set(x, 0, z);
  g.userData.prop = key;
  parent.add(g);
  env.props.set(key, { rest: new T9.Matrix4(), centre: new T9.Vector3(x, 0, z), group: g, instances: [] });
  return g;
}
function placeProp(handle, delta) {
  if (!handle) return;
  handle.group.visible = delta !== null;
  if (delta === null) showSeatInstances(handle.instances, false);
  else placeInstances(handle.instances, delta);
}
function showGarageSeats(env, count, drawn) {
  const seats = garageSeats();
  const n = Math.max(0, Math.min(seats.length, Math.floor(count)));
  const was = Math.max(0, Math.min(seats.length, Math.floor(drawn)));
  const lo = Math.min(was, n);
  const hi = Math.max(was, n);
  const shown = n > was;
  for (const s of seats) {
    if (s.seat < lo || s.seat >= hi) continue;
    placeProp(env.props?.get(`desk:${s.seat}`), shown ? IDENTITY : null);
    placeProp(env.props?.get(`chair:${s.seat}`), shown ? IDENTITY : null);
    const body = env.people.find((p) => Number(p.userData.seat) === s.seat);
    if (body) body.visible = shown;
    showSeatInstances(env.seatInstances?.get(s.seat) ?? [], shown);
    const hit = env.targets.find((t) => t.rank === 0 && t.index === s.seat);
    if (hit) hit.mesh.visible = shown;
  }
  for (const [i] of GARAGE_PODS.entries()) {
    placeProp(env.props?.get(`pod:${i}`), n > i * 4 + 2 ? IDENTITY : null);
  }
}
var GARAGE_SEATS_BUILT = 20;
function showGarageStations(env, staging, cast) {
  for (const station of GARAGE_LEADERS) {
    const present = station.id === "founder" ? staging.founder ? 3 : 0 : cast.heroes.includes(station.id) ? staging.james : 0;
    placeProp(env.props?.get(`desk:${station.id}`), present >= 1 ? IDENTITY : null);
    placeProp(env.props?.get(`chair:${station.id}`), present >= 2 ? IDENTITY : null);
    const shown = station.id === "founder" || present >= 3;
    placeProp(env.props?.get(`body:${station.id}`), shown ? IDENTITY : null);
    const body = env.people.find((p) => Number(p.userData.seat) === station.seat);
    if (body) body.visible = shown;
    const hit = env.targets.find((t) => t.rank === 0 && t.index === station.seat);
    if (hit) hit.mesh.visible = shown;
  }
}
var IDENTITY = new T9.Matrix4();
function buildGarageEnvironment(count, cast, scenery = "on", shellOnly = false, staging = GARAGE_ASSEMBLED) {
  const env = {
    root: new T9.Group(),
    targets: [],
    occluders: [],
    people: [],
    focus: new T9.Vector3(0, 0.6, 1.3),
    extent: 24.5,
    background: "#87966c",
    seatInstances: /* @__PURE__ */ new Map(),
    props: /* @__PURE__ */ new Map()
  };
  const g = env.root;
  box(g, 0, -0.6, 0, 512, 0.1, 512, env.background, false);
  if (OS_SKIN) {
    for (const [x, z] of [[-3.5, -0.5], [5, -5.5]]) {
      const lamp2 = new T9.PointLight(OS.lamp, 16, 13, 2);
      lamp2.position.set(x, 3.1, z);
      g.add(lamp2);
    }
  }
  box(g, 0, -0.48, 1.7, 24, 0.16, 21.2, "#d3d1c5");
  street(g);
  for (let x = -12; x <= 12; x += 1.2) box(g, x, -0.315, 10, 0.012, 5e-3, 4.5, "#bcbeb6", false);
  for (let z = 8; z <= 12.2; z += 1.2) box(g, 0, -0.315, z, 24, 5e-3, 0.012, "#bcbeb6", false);
  slab(g, GARAGE_OUTLINE, -0.3, 0.3, "#e8e2d4");
  box(g, -8.9, 0, -6.5, 2.2, 3.2, 0.24, INK.wall);
  box(g, -1.15, 0, -6.5, 5.3, 3.2, 0.24, INK.wall);
  box(g, -5.8, 0, -6.5, 4, 0.9, 0.24, INK.wall);
  box(g, -5.8, 2.8, -6.5, 4, 0.4, 0.24, INK.wall);
  box(g, -5.8, 0.9, -6.5, 4, 1.9, 0.04, "#a8c7cf", false);
  for (const x of [-7.8, -5.8, -3.8]) box(g, x, 0.9, -6.47, 0.1, 1.9, 0.18, INK.trim);
  box(g, -5.8, 0.86, -6.43, 4.15, 0.08, 0.38, INK.trim);
  box(g, -4.25, 3.2, -6.5, 11.9, 0.12, 0.35, INK.trim);
  box(g, 1.5, 0, -8.15, 0.24, STUDIO.wallHeight, 3.54, INK.wall);
  box(g, 5.75, 0, -9.8, 8.74, STUDIO.wallHeight, 0.24, INK.wall);
  box(g, 5.75, 2.05, -9.68, 7.2, 0.85, 0.06, "#a8c7cf", false);
  for (const x of [2.6, 5, 7.4, 9.2]) box(g, x, 2.05, -9.7, 0.13, 0.85, 0.1, INK.trim);
  box(g, 5.75, 3.2, -9.8, 8.9, 0.12, 0.35, INK.trim);
  box(g, 1.5, 3.2, -8.15, 0.35, 0.12, 3.7, INK.trim);
  box(g, 10, 0, -8.15, 0.24, 0.55, 3.54, INK.wall);
  box(g, 10, 0.55, -8.15, 0.33, 0.07, 3.54, INK.trim);
  box(g, 9.98, 0.62, -8.15, 0.05, 1, 3.4, "#a8c7cf", false);
  box(g, 10, 1.62, -8.15, 0.3, 0.08, 3.6, INK.trim);
  box(g, 10, 0, 0.75, 0.24, 0.55, 14.5, INK.wall);
  box(g, 10, 0.55, 0.75, 0.33, 0.07, 14.5, INK.trim);
  for (const [from, to] of [[[STUDIO_GABLE.x1, 8], [10, 8]]]) {
    wall(g, from, to, 0, 0.55, 0.24, INK.wall);
    wall(g, from, to, 0.55, 0.07, 0.33, INK.trim);
  }
  const gable = STUDIO_GABLE;
  for (const [from, to] of [
    [[gable.x1, gable.z], [gable.x0, gable.z]],
    [[gable.x0, gable.z], [gable.x0, 5.5]]
  ]) {
    wall(g, from, to, 0, STUDIO.wallHeight, gable.thickness, INK.wall);
    wall(g, from, to, STUDIO.wallHeight, 0.12, 0.35, INK.trim);
  }
  box(g, -10, 0, -0.5, 0.24, STUDIO.wallHeight, 12, INK.wall);
  box(g, -9.84, 0, 0.5, 0.1, 0.7, 5.3, INK.wood);
  box(g, -10, 3.2, -0.55, 0.35, 0.12, 12.1, INK.trim);
  const door = entrance(g);
  gableSign(g, cast.studio ?? "Merciless Software");
  door.userData.dynamic = true;
  door.traverse((node) => {
    if (node instanceof T9.Mesh) env.occluders.push(node);
  });
  if (shellOnly) {
    finishGarage(g);
    batchArt(g, env.seatInstances);
    return env;
  }
  const d = GARAGE_DECK;
  slab(g, [[d.x0, d.z0], [d.x1, d.z0], [d.x1, d.z1], [d.x0, d.z1]], 0, d.rise - 0.014, INK.woodEdge);
  garagePlatformFloor(g, d);
  const deck = new T9.Group();
  deck.position.y = d.rise;
  g.add(deck);
  for (const station of GARAGE_LEADERS) {
    const cast_in = station.id === "founder" || cast.heroes.includes(station.id);
    const spot = new T9.Group();
    spot.position.set(station.x, 0, station.z);
    spot.scale.setScalar(GARAGE_HERO_SCALE);
    spot.rotation.y = station.rot * Math.PI / 180;
    deck.add(spot);
    if (!cast_in) continue;
    {
      const desk = prop(env, spot, `desk:${station.id}`);
      craftedHeroDesk(desk, station.id);
      garageDeskStory(desk, station.id);
    }
    craftedChair(prop(env, spot, `chair:${station.id}`), 0, 0, Math.PI, true);
    {
      const seat = prop(env, spot, `body:${station.id}`);
      const body = studioPerson(seat, 0, 0, Math.PI, leaderLook(cast, station.id), station.id);
      body.userData.seat = station.seat;
      env.people.push(body);
      heroName(
        seat,
        HERO_LABELS[station.id] ?? station.id.toUpperCase(),
        NAME_Y,
        LEADER_COLOURS[station.id] ?? INK.teal,
        station.rot * Math.PI / 180
      );
      studioTarget(env, station.x, station.z, station.seat, station.id === "founder" ? "Founder" : station.id[0].toUpperCase() + station.id.slice(1), GARAGE_HERO_SCALE, d.rise);
    }
  }
  for (const [i, pod] of GARAGE_PODS.entries()) {
    {
      const group = prop(env, g, `pod:${i}`, pod.x, pod.z);
      const greenery = new T9.Group();
      greenery.position.y = 0.9;
      group.add(greenery);
      leafyPlanter(greenery, 0, 0, 0.25);
    }
    for (const s of garageSeats().filter((s2) => s2.pod === i)) {
      const desk = prop(env, g, `desk:${s.seat}`, s.x, s.z);
      desk.rotation.y = s.facing + Math.PI;
      craftedSingleDesk(desk, s.seat);
      craftedChair(prop(env, g, `chair:${s.seat}`, s.x, s.z), 0, 0, s.facing);
      const body = studioPerson(g, s.x, s.z, s.facing, workerLook(cast, s.seat));
      body.userData.seat = s.seat;
      env.people.push(body);
      studioTarget(env, s.x, s.z, s.seat, `Developer ${s.seat + 1}`);
    }
  }
  box(deck, -0.65, 0, -6.02, 3.4, 0.68, 0.55, INK.wood);
  for (let i = 0; i < 13; i++) box(deck, -2.1 + i * 0.23, 0.12, -5.72, 0.16, 0.42 + i % 3 * 0.06, 0.28, ["#648079", "#c39955", "#7593a0"][i % 3]);
  for (const x of [-1.9, -0.5, 0.9]) {
    box(g, x, 1.5, -6.34, 0.86, 0.72, 0.07, INK.wood);
    box(g, x, 1.57, -6.29, 0.7, 0.56, 0.025, INK.paper);
    box(g, x, 1.72, -6.265, 0.43, 0.2, 0.012, "#648079");
  }
  const at = (kind) => GARAGE_FURNITURE.find((f) => f.kind === kind);
  const shared = at("island");
  box(g, shared.x, 0.018, shared.z, shared.w + 0.25, 0.016, shared.d + 0.2, "#a8c2ba");
  box(g, shared.x, 0.82, shared.z, shared.w - 0.8, 0.12, shared.d - 1.25, INK.wood);
  for (const dx of [-0.8, 0.8]) for (const dz of [-0.8, 0.8]) box(g, shared.x + dx, 0.03, shared.z + dz, 0.1, 0.8, 0.1, INK.woodEdge);
  for (const dz of [-1.35, 1.35]) for (const dx of [-0.66, 0.66]) {
    cylinder(g, shared.x + dx, 0.08, shared.z + dz, 0.07, 0.43, INK.metal);
    cylinder(g, shared.x + dx, 0.51, shared.z + dz, 0.26, 0.12, "#648079");
  }
  for (let i = 0; i < 3; i++) box(g, shared.x - 0.45, 0.95 + i * 0.055, shared.z + 0.1, 0.48, 0.05, 0.35, i % 2 ? INK.paper : "#7593a0");
  box(g, shared.x + 0.35, 0.95, shared.z - 0.3, 0.58, 0.025, 0.44, INK.paper);
  for (const dx of [-0.6, 0.6]) cylinder(g, shared.x + dx, 0.95, shared.z + 0.6, 0.075, 0.16, "#c39955");
  const { g: library, len: libraryLen, dep: libraryDep } = placed(g, at("locker"));
  box(library, 0, 0, 0, libraryLen, 0.9, libraryDep, INK.woodEdge);
  for (let i = 0; i < 11; i++) for (const y of [0.12, 0.52]) box(library, -libraryLen / 2 + 0.22 + i * 0.3, y, libraryDep / 2, 0.21, 0.3, 0.06, ["#648079", "#c39955", "#7593a0"][i % 3]);
  box(library, 0, 0.9, 0, libraryLen + 0.08, 0.08, libraryDep + 0.08, INK.wood);
  const libraryPlant = new T9.Group();
  libraryPlant.position.y = 0.98;
  library.add(libraryPlant);
  leafyPlanter(libraryPlant, -libraryLen / 2 + 0.4, 0, 0.32);
  const readingBench = at("bench");
  box(g, readingBench.x, 0, readingBench.z, readingBench.w, 0.55, readingBench.d, INK.wood);
  box(g, readingBench.x, 0.55, readingBench.z, readingBench.w + 0.08, 0.12, readingBench.d + 0.06, "#829caa");
  for (let i = 0; i < 9; i++) box(g, readingBench.x - 1.25 + i * 0.29, 0.08, readingBench.z - 0.32, 0.2, 0.36, 0.23, ["#648079", "#c39955", "#7593a0"][i % 3]);
  const { g: kit, len: kitLen, dep: kitDep } = placed(g, at("counter"));
  const front = kitDep / 2 - 0.1;
  box(kit, 0, 0, -0.05, kitLen, 0.9, kitDep - 0.1, INK.wood);
  box(kit, -0.03, 0.9, 0, kitLen + 0.06, 0.08, kitDep, INK.trim);
  for (let i = 0; i < 4; i++) {
    const x = (i + 0.5 - 2) * (kitLen / 4);
    box(kit, x, 0.08, front + 0.01, 0.86, 0.72, 0.014, INK.woodEdge);
    box(kit, x, 0.67, front + 0.04, 0.27, 0.045, 0.045, INK.metal);
  }
  const kitchenPlant = new T9.Group();
  kitchenPlant.position.y = 0.98;
  kit.add(kitchenPlant);
  leafyPlanter(kitchenPlant, -1.4, -0.25, 0.3);
  box(kit, -0.3, 0.98, -0.05, 0.9, 0.03, 0.65, INK.glassLight);
  cylinder(kit, 1.2, 0.98, -0.15, 0.18, 0.45, INK.metal);
  for (const dx of [1.55, 1.85]) cylinder(kit, dx, 0.98, -0.25, 0.075, 0.14, INK.amber);
  const { g: tall, len: tallLen, dep: tallDep } = placed(g, at("unit"));
  box(tall, 0, 0, 0, tallLen, 2, tallDep, INK.trim);
  box(tall, 0, 1.4, tallDep / 2 + 8e-3, tallLen - 0.1, 0.025, 0.015, INK.grout);
  box(tall, -0.35, 0.7, tallDep / 2 + 0.02, 0.05, 0.48, 0.06, INK.metal);
  const shelf = at("shelving");
  for (let i = 0; i < Math.round(shelf.d / 1.6); i++) {
    shelving(deck, shelf.x, shelf.z - shelf.d / 2 + 0.8 + i * 1.6, Math.PI / 2);
  }
  const { g: lounge, len: sofaLen, dep: sofaDep } = placed(g, at("sofa"));
  box(lounge, 0, 0.01, 0.95, sofaLen + 0.3, 0.018, 2.65, "#829caa");
  box(lounge, 0, 0.2, 0, sofaLen, 0.4, sofaDep, "#3c6591");
  box(lounge, 0, 0.6, -0.3, sofaLen, 0.52, 0.22, "#345b86");
  for (const dx of [-sofaLen / 2 + 0.16, sofaLen / 2 - 0.16]) {
    box(lounge, dx, 0.55, 0.01, 0.28, 0.35, 0.88, "#3c6591");
  }
  loungeDressing(lounge, sofaLen);
  const { g: table, len: tableLen, dep: tableDep } = placed(g, at("coffee-table"));
  box(table, 0, 0.48, 0, tableLen, 0.1, tableDep, INK.wood);
  for (const dx of [-tableLen / 2 + 0.2, tableLen / 2 - 0.2]) box(table, dx, 0, 0, 0.08, 0.48, 0.6, INK.metal);
  cylinder(table, 0.4, 0.58, -0.05, 0.065, 0.13, INK.trim);
  box(table, -0.3, 0.58, 0, 0.45, 0.045, 0.3, INK.paper);
  for (const f of GARAGE_FURNITURE) if (f.kind === "planter") leafyPlanter(g, f.x, f.z, f.w);
  if (scenery === "on") {
    garageNeighborhood(g);
    garageForecourt(g);
    garageBackyard(g);
    const lawn = new T9.Group();
    lawn.position.y = -0.5;
    g.add(lawn);
    const pavement = new T9.Group();
    pavement.position.y = -0.32;
    g.add(pavement);
    const groundAt = (x, z) => Math.abs(x) <= 12 && z >= -8.9 && z <= 12.3 ? pavement : lawn;
    for (const [x, z, size] of [[-12.4, -6, 3.1], [-12.8, -1, 2.7], [-12.5, 4.4, 2.4], [3, -11.7, 2.8], [8, -12, 3.2], [12.8, -7.8, 2.6], [13.3, 1, 2.3]]) {
      tree(groundAt(x, z), x, z, size);
      if (x !== 13.3) for (const dx of [-0.9, 0.8]) planter(groundAt(x + dx, z + 0.7), x + dx, z + 0.7, 0.6);
    }
    hedge(lawn, 5.7, -10.8, 8.8, 0.75);
    hedge(pavement, 3.4, 8.85, 11.4, 0.65);
    hedge(pavement, -8.2, 11.65, 3.5, 0.65);
    hedge(pavement, 10.8, -0.6, 0.65, 13);
    planter(pavement, 10.9, 9, 0.8);
    for (let x = 0; x <= 2.3; x += 1.1) {
      line(g, [
        new T9.Vector3(x, -0.3, 9.6),
        new T9.Vector3(x, 0.8, 9.6),
        new T9.Vector3(x + 0.65, 0.8, 9.6),
        new T9.Vector3(x + 0.65, -0.3, 9.6)
      ], INK.metal);
      for (const dx of [0, 0.65]) cylinder(g, x + dx, -0.3, 9.6, 0.035, 1.05, INK.metal);
    }
  }
  garageSurfaceDetails(g);
  finishGarage(g);
  g.updateMatrixWorld(true);
  const bounds = new T9.Box3();
  for (const handle of env.props.values()) {
    handle.rest.copy(handle.group.matrixWorld);
    bounds.setFromObject(handle.group);
    if (!bounds.isEmpty()) bounds.getCenter(handle.centre);
  }
  const batched = /* @__PURE__ */ new Map();
  batchArt(g, env.seatInstances, batched);
  for (const [key, list] of batched) {
    const handle = env.props.get(key);
    if (handle) handle.instances = list;
  }
  const drawingBoard = at("board");
  const boardMount = new T9.Group();
  boardMount.position.set(drawingBoard.x, 0, drawingBoard.z);
  boardMount.rotation.y = drawingBoard.facing ?? 0;
  g.add(boardMount);
  env.projectPlate = projectBoard(boardMount, 0, 0.3, 0, drawingBoard.d - 0.22, false);
  showGarageStations(env, staging, cast);
  showGarageSeats(env, count, GARAGE_SEATS_BUILT);
  return env;
}

// src/render/garageView.ts
function createGarageView(width, height, cast = defaultCast()) {
  const renderer = new T10.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = T10.SRGBColorSpace;
  renderer.toneMapping = T10.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T10.PCFSoftShadowMap;
  const scene = new T10.Scene();
  const camera = new T10.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
  const sky = new T10.HemisphereLight("#fffdf8", "#a5a59a", 1.15);
  scene.add(sky);
  const sun = new T10.DirectionalLight("#fff0d6", 2.7);
  sun.position.set(22, 28, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 120 });
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -1e-4;
  scene.add(sun);
  const fill = new T10.DirectionalLight("#e6effa", 0.55);
  fill.position.set(-32, 15, -10);
  scene.add(fill);
  if (OS_SKIN) {
    sun.color.set("#8a93c8");
    sun.intensity = 0.7;
    sky.color.set(OS.n3);
    sky.groundColor.set(OS.n0);
    sky.intensity = 0.55;
    fill.color.set(OS.calm2);
    fill.intensity = 0.12;
    renderer.toneMappingExposure = 1.1;
  }
  const composer = new EffectComposer(renderer);
  composer.renderTarget1.samples = 4;
  composer.renderTarget2.samples = 4;
  composer.addPass(new RenderPass(scene, camera));
  const ao = new SSAOPass(scene, camera, width, height, 16);
  ao.kernelRadius = 0.65;
  ao.minDistance = 12e-5;
  ao.maxDistance = 9e-3;
  ao.ssaoMaterial.defines.PERSPECTIVE_CAMERA = 0;
  ao.ssaoMaterial.needsUpdate = true;
  composer.addPass(ao);
  composer.addPass(new OutputPass());
  let env;
  let heads = 0;
  let w = width, h = height;
  let zoom = 1;
  const pan = new T10.Vector3();
  let arms = [];
  function build() {
    if (env) {
      scene.remove(env.root);
      env.root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    }
    env = buildGarageEnvironment(heads, cast);
    scene.add(env.root);
    scene.background = new T10.Color(OS_SKIN ? OS.n0 : env.background);
    showGarageSeats(env, heads, 20);
    arms = [];
    env.root.traverse((o) => {
      const side = o.name === "arm-1" ? -1 : o.name === "arm1" ? 1 : 0;
      if (side && !o.parent?.userData.standing) arms.push({ arm: o, offset: arms.length * 1.7, side });
    });
    renderer.shadowMap.needsUpdate = true;
  }
  function frame() {
    const focus = env.focus.clone().add(pan);
    const direction = new T10.Vector3(1, 1, 1).normalize();
    camera.position.copy(focus).addScaledVector(direction, 80);
    camera.up.set(0, 1, 0);
    camera.lookAt(focus);
    const aspect = w / h;
    const span = env.extent / Math.min(1, aspect / 1.35) / zoom;
    camera.left = -span / 2;
    camera.right = span / 2;
    camera.top = span / 2 / aspect;
    camera.bottom = -span / 2 / aspect;
    camera.updateProjectionMatrix();
  }
  const view = {
    canvas: renderer.domElement,
    setHeadcount(n) {
      const next = Math.max(0, Math.floor(n));
      if (next === heads) return;
      const was = heads;
      heads = next;
      showGarageSeats(env, heads, was);
      renderer.shadowMap.needsUpdate = true;
    },
    setJames(here) {
      const has = cast.heroes.includes("james");
      if (has === here) return;
      cast = { ...cast, heroes: here ? ["james"] : [] };
      build();
    },
    resize(width2, height2) {
      w = Math.max(1, width2);
      h = Math.max(1, height2);
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      ao.setSize(w, h);
    },
    setLens(z, panX = 0, panZ = 0) {
      zoom = Math.max(0.2, z);
      pan.set(panX, 0, panZ);
    },
    render(seconds) {
      frame();
      for (const { arm, offset, side } of arms) {
        if (!arm.visible || !arm.parent?.visible) continue;
        arm.rotation.x = Math.sin(seconds * 9 + offset + (side > 0 ? Math.PI : 0)) * 0.08;
      }
      const range = camera.far - camera.near;
      ao.minDistance = 12e-5 * 300 / range;
      ao.maxDistance = 9e-3 * 300 / range;
      ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
      ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
      const hidden = env.targets.map((t) => t.mesh.visible);
      env.targets.forEach((t) => {
        t.mesh.visible = false;
      });
      composer.render();
      env.targets.forEach((t, i) => {
        t.mesh.visible = hidden[i];
      });
    },
    pick(x, y) {
      frame();
      const ray = new T10.Raycaster();
      ray.setFromCamera(new T10.Vector2(x / w * 2 - 1, 1 - y / h * 2), camera);
      const live = env.targets.filter((t) => {
        for (let o = t.mesh; o; o = o.parent) if (!o.visible) return false;
        return true;
      });
      const hit = ray.intersectObjects(live.map((t) => t.mesh), false)[0];
      return hit ? live.find((t) => t.mesh === hit.object)?.index ?? null : null;
    },
    dispose() {
      composer.dispose();
      renderer.dispose();
    }
  };
  build();
  view.resize(width, height);
  return view;
}
export {
  createGarageView
};
