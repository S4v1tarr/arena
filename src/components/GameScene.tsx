"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BUILDINGS, ISLAND_R, ISLAND_X, SLOT_COUNT, WEAPON_BY_ID, localSlot, slotPos } from "@/game/catalog";
import type { BuildingType, Flight, GameEvent, GameView, Side } from "@/game/types";

export interface HoverInfo {
  side: Side;
  id: number;
  x: number;
  y: number;
}
export type CamMode = "me" | "enemy" | "top" | "center";

interface Props {
  view: GameView;
  clockOffset: number;
  selectedId: number | null;
  showRanges: boolean;
  camCmd: { mode: CamMode; n: number };
  onPickEnemy: (id: number) => void;
  onPickOwn: (id: number) => void;
  onHover: (h: HoverInfo | null) => void;
  placing: BuildingType | null;
  onPickSlot: (slot: number) => void;
}

interface SceneApi {
  update: (u: { view: GameView; offset: number; selectedId: number | null; showRanges: boolean; placing: BuildingType | null }) => void;
  setCamera: (m: CamMode) => void;
  dispose: () => void;
}

const COL_ME = 0x3fd1c0;
const COL_FOE = 0xff6a4d;

const HEIGHTS: Record<BuildingType, number> = {
  hq: 10, mine: 5.5, refinery: 8.5, port: 8.5, steel: 8, petrochem: 9, tech: 8,
  airbase: 5.5, missile_site: 6.5, defense_site: 7,
};

export default function GameScene(props: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<SceneApi | null>(null);
  const cbRef = useRef(props);

  useEffect(() => {
    cbRef.current = props;
  });

  useEffect(() => {
    if (!mountRef.current) return;
    const api = createScene(mountRef.current, props.view.me, {
      pickEnemy: (id) => cbRef.current.onPickEnemy(id),
      pickOwn: (id) => cbRef.current.onPickOwn(id),
      hover: (h) => cbRef.current.onHover(h),
      pickSlot: (s) => cbRef.current.onPickSlot(s),
    });
    apiRef.current = api;
    api.update({ view: props.view, offset: props.clockOffset, selectedId: props.selectedId, showRanges: props.showRanges, placing: props.placing });
    return () => {
      api.dispose();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    apiRef.current?.update({
      view: props.view,
      offset: props.clockOffset,
      selectedId: props.selectedId,
      showRanges: props.showRanges,
      placing: props.placing,
    });
  }, [props.view, props.clockOffset, props.selectedId, props.showRanges, props.placing]);

  useEffect(() => {
    apiRef.current?.setCamera(props.camCmd.mode);
  }, [props.camCmd]);

  return <div ref={mountRef} className="absolute inset-0" />;
}

// =============================================================================
// scene construction
// =============================================================================
const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: number, o: { emissive?: number; ei?: number; rough?: number; metal?: number; opacity?: number } = {}) {
  const key = `${color}-${o.emissive ?? 0}-${o.ei ?? 0}-${o.rough ?? 0.8}-${o.metal ?? 0.05}-${o.opacity ?? 1}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      emissive: o.emissive ?? 0x000000,
      emissiveIntensity: o.ei ?? 1,
      roughness: o.rough ?? 0.8,
      metalness: o.metal ?? 0.05,
      flatShading: true,
      transparent: (o.opacity ?? 1) < 1,
      opacity: o.opacity ?? 1,
    });
    matCache.set(key, m);
  }
  return m;
}

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function cyl(rt: number, rb: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 14) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function sphere(r: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function makeBuilding(type: BuildingType, team: number): THREE.Group {
  const g = new THREE.Group();
  const concrete = mat(0xb9bfc2, { rough: 0.9 });
  const dark = mat(0x2d3338, { rough: 0.7 });
  const steel = mat(0x8c969c, { rough: 0.4, metal: 0.6 });
  const accent = mat(team, { emissive: team, ei: 0.6 });
  const pad = cyl(3, 3.2, 0.25, mat(0x60686c), 0, 0, 0, 20);
  switch (type) {
    case "hq": {
      g.add(cyl(3.6, 3.8, 0.3, mat(0x5a6266), 0, 0, 0, 24));
      g.add(box(4.2, 2.6, 4.2, concrete, 0, 0.3));
      g.add(box(2.8, 1.5, 2.8, mat(0xdfe4e6), 0, 2.9));
      g.add(box(4.3, 0.3, 4.3, accent, 0, 2.6));
      g.add(cyl(0.07, 0.07, 3.6, steel, 1.8, 2.9, 1.8, 6));
      const flag = box(0.04, 0.7, 1.2, accent, 1.8, 5.7, 1.2);
      g.add(flag);
      g.add(cyl(0.05, 0.05, 2.2, steel, -1, 4.4, -1, 6));
      break;
    }
    case "mine": {
      g.add(cyl(2.6, 2.8, 0.2, mat(0x5b4a3a), 0, 0, 0, 16));
      const coal = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.6, 7), mat(0x1c1d1f));
      coal.position.set(-0.9, 1.0, 0.7);
      coal.castShadow = true;
      g.add(coal);
      g.add(box(1.4, 1.2, 1.6, mat(0x7b6a55), 1.1, 0.2, -0.6));
      g.add(box(0.15, 3.2, 0.15, steel, 0.4, 0.2, 0.6));
      g.add(box(0.15, 3.2, 0.15, steel, 1.8, 0.2, 0.6));
      g.add(box(1.6, 0.15, 0.15, steel, 0.4, 3.2, 0.6));
      const wheel = cyl(0.5, 0.5, 0.15, accent, 1.1, 2.8, 0.6, 12);
      wheel.rotation.x = Math.PI / 2;
      g.add(wheel);
      break;
    }
    case "refinery": {
      g.add(pad);
      for (let i = 0; i < 3; i++) g.add(cyl(0.85, 0.85, 2, mat(0xe9e7df, { rough: 0.5 }), -1.6 + i * 1.6, 0.25, 1.4, 16));
      g.add(cyl(0.18, 0.28, 4.8, steel, 1.5, 0.25, -1.2, 8));
      g.add(sphere(0.28, mat(0xff9a2e, { emissive: 0xff7a00, ei: 2.5 }), 1.5, 5.2, -1.2));
      g.add(box(3.2, 0.5, 0.5, dark, -0.2, 1.2, -1.2));
      g.add(cyl(0.5, 0.5, 2.8, steel, -1.4, 0.25, -1.2, 10));
      g.add(box(3.4, 0.12, 0.3, accent, 0, 0.25, 2.4));
      break;
    }
    case "port": {
      g.add(box(5.6, 0.3, 4, mat(0x4d5459), 0, 0, 0));
      g.add(box(0.3, 4.4, 0.3, mat(0xe4b13a), -1.8, 0.3, -1));
      g.add(box(0.3, 4.4, 0.3, mat(0xe4b13a), -1.8, 0.3, 1));
      g.add(box(0.3, 0.3, 4.4, mat(0xe4b13a), -1.8, 4.5, 0));
      g.add(box(2.4, 0.9, 1, mat(0xc34b3a), 0.8, 0.3, -1.2));
      g.add(box(2.4, 0.9, 1, mat(0x3a79c3), 0.8, 0.3, 0));
      g.add(box(2.4, 0.9, 1, mat(0x3ab07a), 0.8, 1.2, -0.6));
      g.add(box(1.4, 0.9, 1, accent, 0.8, 0.3, 1.3));
      break;
    }
    case "steel": {
      g.add(pad);
      g.add(box(4, 2.2, 2.6, mat(0x77706a), 0, 0.25, 0.4));
      g.add(box(4.1, 0.2, 2.7, mat(0x4a4540), 0, 2.45, 0.4));
      g.add(cyl(0.35, 0.45, 4.2, mat(0x5b524b), 1.4, 0.25, -1.4, 10));
      g.add(cyl(0.3, 0.4, 3.4, mat(0x5b524b), 0.4, 0.25, -1.5, 10));
      g.add(box(1.2, 0.8, 0.12, mat(0xff8a2a, { emissive: 0xff5a00, ei: 2 }), -1, 0.9, 1.72));
      g.add(box(1, 0.2, 1, accent, -1.5, 2.65, 0.4));
      break;
    }
    case "petrochem": {
      g.add(pad);
      g.add(cyl(0.5, 0.5, 5, steel, -1.4, 0.25, -0.8, 12));
      g.add(cyl(0.4, 0.4, 4, steel, -0.3, 0.25, -0.8, 12));
      g.add(cyl(0.45, 0.45, 4.4, steel, 0.9, 0.25, -0.8, 12));
      g.add(sphere(1, mat(0xdfe3e5, { rough: 0.3, metal: 0.3 }), 0.4, 1.3, 1.3));
      g.add(box(3.6, 0.2, 0.2, accent, -0.2, 3.5, -0.8));
      g.add(box(0.2, 1.5, 0.2, dark, 1.9, 0.25, 1.4));
      g.add(sphere(0.22, mat(0xff9a2e, { emissive: 0xff7a00, ei: 2.5 }), 1.9, 2, 1.4));
      break;
    }
    case "tech": {
      g.add(cyl(3, 3.2, 0.25, mat(0x39444c), 0, 0, 0, 20));
      const glass = mat(0x66c7ff, { emissive: 0x1a6aa0, ei: 0.8, rough: 0.1, metal: 0.8, opacity: 0.85 });
      g.add(box(2.4, 4.6, 2.4, glass, -0.4, 0.25, 0));
      g.add(box(1.6, 2.6, 1.6, glass, 1.4, 0.25, 1));
      g.add(box(2.5, 0.2, 2.5, accent, -0.4, 4.85, 0));
      g.add(cyl(0.06, 0.06, 1.2, steel, -0.4, 5.05, 0, 6));
      break;
    }
    case "airbase": {
      const tarmac = box(8.4, 0.25, 3.4, mat(0x2a2e32, { rough: 0.95 }), 0, 0, 0);
      g.add(tarmac);
      // runway stripes
      for (let i = -3; i <= 3; i++) g.add(box(0.6, 0.04, 0.15, mat(0xeaeaea), i * 1.1, 0.27, 0));
      // runway edge lights
      for (let i = -3; i <= 3; i++) {
        g.add(box(0.06, 0.06, 0.06, mat(0xff4d3a, { emissive: 0xff3018, ei: 1.4 }), -3.8, 0.27, i * 1.0));
        g.add(box(0.06, 0.06, 0.06, mat(0x3aff9c, { emissive: 0x3aff9c, ei: 1.4 }), 3.8, 0.27, i * 1.0));
      }
      // hangars
      for (let i = 0; i < 3; i++) {
        const h = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 4.5, 16, 1, false, 0, Math.PI), mat(0x7f8a8e, { metal: 0.3, rough: 0.5 }));
        h.rotation.z = Math.PI / 2;
        h.position.set(-3 + i * 3, 0.25, 2.5);
        h.castShadow = true;
        g.add(h);
      }
      // control tower
      g.add(cyl(0.45, 0.5, 3.6, concrete, 2.9, 0.25, 1.8, 10));
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.4), mat(0xeae3c8, { metal: 0.3, rough: 0.3 }));
      cabin.position.set(2.9, 4.2, 1.8);
      cabin.castShadow = true;
      g.add(cabin);
      const window = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 1.5), mat(0x4f7aa1, { emissive: 0x1a3a78, ei: 0.8, metal: 0.6, rough: 0.1, opacity: 0.9 }));
      window.position.set(2.9, 4.6, 1.8);
      g.add(window);
      // parked jets
      for (let i = 0; i < 2; i++) {
        const jet = new THREE.Group();
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 2.6, 10), mat(0xc8cfd4, { metal: 0.55, rough: 0.35 }));
        f.rotation.x = Math.PI / 2;
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 10), mat(0xc8cfd4, { metal: 0.55 }));
        nose.rotation.x = Math.PI / 2; nose.position.z = 1.7;
        const wing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.9), mat(0xc8cfd4, { metal: 0.55 }));
        wing.position.z = 0;
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.5), mat(0xc8cfd4, { metal: 0.55 }));
        tail.position.z = -1.0;
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.45), mat(team));
        fin.position.set(0, 0.3, -0.9);
        jet.add(f, nose, wing, tail, fin);
        jet.position.set(0.5, 0.35, 2.0 + i * 1.6);
        g.add(jet);
      }
      break;
    }
    case "missile_site": {
      g.add(pad);
      // command bunker
      g.add(box(2.4, 1.2, 1.6, mat(0x5b6359, { rough: 0.9 }), -2.0, 0.25, -1.0));
      g.add(box(2.5, 0.18, 1.7, mat(0x3a403a), -2.0, 1.4, -1.0));
      // 3 launchers in row
      for (let i = 0; i < 3; i++) {
        const truck = box(0.9, 0.7, 2.2, mat(0x3d463a, { metal: 0.3 }), -1.5 + i * 1.5, 0.25, 0.4);
        g.add(truck);
        const wheels = new THREE.Group();
        for (let w = -1; w <= 1; w++) {
          for (let side of [-1, 1]) {
            const wl = cyl(0.18, 0.18, 0.22, mat(0x141515), -1.5 + i * 1.5 + side * 0.5, 0.1, 0.4 + w * 0.7, 8);
            wl.rotation.z = Math.PI / 2;
            wheels.add(wl);
          }
        }
        g.add(wheels);
        // launcher arm raised
        const arm = new THREE.Group();
        const beam = box(0.5, 0.35, 3.0, mat(0x4a5547, { metal: 0.4 }), 0, 0.4, 0);
        const missile = cyl(0.32, 0.32, 3.2, mat(0xeaeaea, { metal: 0.4, rough: 0.3 }), 0, 0.4, 0, 10);
        const mNose = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 10), mat(team));
        mNose.position.y = 2.4;
        arm.add(beam, missile, mNose);
        arm.position.set(0, 0.6, 0.4);
        arm.rotation.x = -0.55;
        g.add(arm);
      }
      // radar unit
      g.add(cyl(0.18, 0.22, 3.0, mat(0x2d3338), 2.0, 0.25, -1.5, 10));
      const radar = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), mat(0x9fa9b3, { metal: 0.6, rough: 0.4 }));
      radar.scale.set(1.0, 0.45, 1.0);
      radar.position.set(2.0, 3.1, -1.5);
      g.add(radar);
      g.add(cyl(0.06, 0.06, 1.0, mat(0xff8a2a, { emissive: 0xff8a2a, ei: 1 }), 2.0, 2.2, -1.5, 6));
      break;
    }
    case "defense_site": {
      g.add(pad);
      // command trailer
      g.add(box(2.0, 1.0, 1.4, mat(0x4a4f4d), -1.8, 0.25, -0.6));
      g.add(box(2.05, 0.15, 1.45, mat(0x2c3030), -1.8, 1.2, -0.6));
      // antennas
      g.add(cyl(0.04, 0.04, 2.2, mat(0xa8b1b4), -1.8, 1.5, -0.6, 4));
      g.add(cyl(0.04, 0.04, 1.6, mat(0xa8b1b4), -1.4, 1.5, 0.0, 4));
      // rotating radar dish (tracked for animation)
      const radarArm = new THREE.Group();
      radarArm.add(cyl(0.1, 0.1, 1.6, steel, 0, 0.8, 0, 6));
      const dish = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), mat(0xcfd6d8, { metal: 0.5, rough: 0.35 }));
      dish.rotation.x = -Math.PI / 2.4;
      dish.scale.set(1.1, 0.45, 1.1);
      dish.position.y = 1.8;
      radarArm.add(dish);
      radarArm.position.set(-1.8, 0.3, -0.6);
      radarArm.userData.spin = true;
      g.add(radarArm);
      // 3 vertical launch tubes
      for (let i = 0; i < 3; i++) {
        const tube = cyl(0.35, 0.4, 1.0, mat(0x383c3a), 0.4 + i * 0.7, 0.25, 0.4, 12);
        g.add(tube);
        // internal missile
        const m = cyl(0.18, 0.18, 3.6, mat(0xcfd5db, { metal: 0.5, rough: 0.3 }), 0.4 + i * 0.7, 0.7, 0.4, 8);
        g.add(m);
        const mn = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 10), mat(team));
        mn.position.set(0.4 + i * 0.7, 2.7, 0.4);
        g.add(mn);
        // cap when ready
        const cap = box(0.7, 0.1, 0.7, mat(0x1a1c1c), 0.4 + i * 0.7, 1.3, 0.4);
        cap.visible = true;
        g.add(cap);
      }
      // power generator
      g.add(box(1.2, 0.8, 0.9, mat(0x8a6c3a), 1.8, 0.25, 0.6));
      break;
    }
  }
  return g;
}

function makeRubble(): THREE.Group {
  const g = new THREE.Group();
  const m = mat(0x1d1a18, { rough: 1 });
  const m2 = mat(0x3b322b, { rough: 1 });
  for (let i = 0; i < 9; i++) {
    const b = box(0.5 + Math.random() * 1.1, 0.25 + Math.random() * 0.7, 0.5 + Math.random() * 1.1, i % 2 ? m : m2,
      (Math.random() - 0.5) * 3.4, 0, (Math.random() - 0.5) * 3.4);
    b.rotation.y = Math.random() * 3;
    b.rotation.z = (Math.random() - 0.5) * 0.4;
    g.add(b);
  }
  g.add(cyl(2.1, 2.5, 0.12, mat(0x0d0c0b), 0, 0, 0, 14));
  return g;
}

function makeMissile(color: number, scale: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.6, 8), mat(0xe9ecee, { rough: 0.3, metal: 0.4 }));
  body.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 8), mat(color, { emissive: color, ei: 0.8 }));
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 1.05;
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.9, 8),
    new THREE.MeshBasicMaterial({ color: 0xffb347 }),
  );
  flame.rotation.x = -Math.PI / 2;
  flame.position.z = -1.2;
  g.add(body, nose, flame);
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.3), mat(color));
    fin.position.z = -0.65;
    fin.rotation.z = (i * Math.PI) / 2;
    fin.translateY(0.22);
    g.add(fin);
  }
  g.scale.setScalar(scale);
  return g;
}

function makeInterceptor(color: number): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 2.4, 10), mat(0xeef2f4, { metal: 0.5, rough: 0.3 }));
    body.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 10), mat(color, { emissive: color, ei: 1.2 }));
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = 1.55;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 14), mat(0x4c5b66, { metal: 0.7 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.z = -0.2;
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.35), mat(color));
      fin.rotation.z = (i * Math.PI) / 2;
      fin.translateY(0.3);
      fin.position.z = -1;
      g.add(fin);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.4, 10), new THREE.MeshBasicMaterial({ color: 0xb6f3ff, transparent: true, opacity: 0.95 }));
    flame.rotation.x = Math.PI / 2;
    flame.position.z = -1.8;
    g.add(body, nose, ring, flame);
    g.scale.setScalar(0.9);
    return g;
}

function makeJet(color: number, scale: number): THREE.Group {
  const g = new THREE.Group();
  const bodyM = mat(0xb9c2c7, { metal: 0.5, rough: 0.35 });
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.2, 8), bodyM);
  fus.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 8), bodyM);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 1.4;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.8), mat(color, { emissive: color, ei: 0.35 }));
  wing.position.z = -0.1;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.4), bodyM);
  tail.position.z = -1;
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.4), mat(color));
  fin.position.set(0, 0.25, -0.95);
  g.add(fus, nose, wing, tail, fin);
  g.scale.setScalar(scale);
  return g;
}

function makeDrone(color: number, scale: number, oneway: boolean): THREE.Group {
  const g = new THREE.Group();
  const bodyM = mat(0xdfe3e5, { rough: 0.5 });
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, oneway ? 1.4 : 1.8, 8), bodyM);
  fus.rotation.x = Math.PI / 2;
  const wing = new THREE.Mesh(
    oneway ? new THREE.BoxGeometry(1.3, 0.03, 0.9) : new THREE.BoxGeometry(2.4, 0.03, 0.35),
    mat(color, { emissive: color, ei: 0.4 }),
  );
  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.03), mat(0x222222));
  prop.position.z = -0.8;
  g.add(fus, wing, prop);
  if (!oneway) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.2), bodyM);
    tail.position.z = -0.8;
    g.add(tail);
  }
  g.scale.setScalar(scale);
  return g;
}

function jitterGeom(geom: THREE.BufferGeometry, seed: number) {
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + 0.07 * Math.sin(3 * a + seed) + 0.04 * Math.sin(7 * a + seed * 2) + 0.025 * Math.sin(13 * a);
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
  }
  geom.computeVertexNormals();
}

function makeIsland(side: Side, teamColor: number): THREE.Group {
  const g = new THREE.Group();
  const cx = side === 0 ? -ISLAND_X : ISLAND_X;
  g.position.x = cx;
  const R = ISLAND_R;
  const rockG = new THREE.CylinderGeometry(R + 1.2, R + 6, 7, 56, 1);
  jitterGeom(rockG, side + 1);
  const rock = new THREE.Mesh(rockG, mat(0x5e5a4d, { rough: 1 }));
  rock.position.y = -3.5;
  const sandG = new THREE.CylinderGeometry(R + 0.8, R + 1.4, 0.9, 56, 1);
  jitterGeom(sandG, side + 1);
  const sand = new THREE.Mesh(sandG, mat(0xcdb67f, { rough: 1 }));
  sand.position.y = 0.35;
  const grassG = new THREE.CylinderGeometry(R - 1.7, R - 0.7, 1.2, 56, 1);
  jitterGeom(grassG, side + 1);
  const grass = new THREE.Mesh(grassG, mat(0x4d7a45, { rough: 1 }));
  grass.position.y = 0.6;
  for (const m of [rock, sand, grass]) { m.receiveShadow = true; m.castShadow = true; g.add(m); }
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(R + 0.9, 0.14, 6, 80),
    new THREE.MeshBasicMaterial({ color: teamColor }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.85;
  g.add(ring);
  // trees (seeded)
  let seed = 7 + side * 31;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const rad = R - 1.6 - r() * 0.9 - (i % 3 === 0 ? 0 : 0);
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    const tree = new THREE.Group();
    tree.add(cyl(0.08, 0.1, 0.5, mat(0x5a3d25), 0, 0, 0, 5));
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.5 + r() * 0.2, 1.3 + r() * 0.5, 6), mat(0x2f5f3a));
    crown.position.y = 1.15;
    crown.castShadow = true;
    tree.add(crown);
    tree.position.set(x, 1.15, z);
    g.add(tree);
  }
  return g;
}

// =============================================================================
interface BEntry {
  key: string;
  side: Side;
  id: number;
  type: BuildingType;
  dead: boolean;
  group: THREE.Group;
  bar: THREE.Group;
  fg: THREE.Mesh;
  hp: number;
}
interface FEntry {
  group: THREE.Group;
  trail: THREE.Points;
  pos: Float32Array;
  col: Float32Array;
  hist: THREE.Vector3[];
  f: Flight;
}
interface Fx {
  start: number;
  dur: number;
  update: (p: number) => void;
  done: () => void;
}

const TRAIL_N = 46;
const sphereGeo = new THREE.SphereGeometry(1, 16, 12);
const ringGeo = new THREE.RingGeometry(0.85, 1, 48);

function createScene(
  mount: HTMLDivElement,
  me: Side,
  cb: { pickEnemy: (id: number) => void; pickOwn: (id: number) => void; hover: (h: HoverInfo | null) => void; pickSlot: (slot: number) => void },
): SceneApi {
  const foe: Side = me === 0 ? 1 : 0;
  const teamOf = (s: Side) => (s === me ? COL_ME : COL_FOE);

  const scene = new THREE.Scene();
  const SKY = 0x14303c;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 150, 340);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 700);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  mount.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 18;
  controls.maxDistance = 220;
  controls.maxPolarAngle = Math.PI / 2.08;

  const camPresets: Record<CamMode, { pos: THREE.Vector3; tgt: THREE.Vector3 }> = {
    me: { pos: new THREE.Vector3(me === 0 ? -86 : 86, 44, me === 0 ? 42 : -42), tgt: new THREE.Vector3(me === 0 ? -8 : 8, 0, 0) },
    enemy: { pos: new THREE.Vector3(me === 0 ? 10 : -10, 36, me === 0 ? 52 : -52), tgt: new THREE.Vector3(foe === 0 ? -ISLAND_X : ISLAND_X, 0, 0) },
    top: { pos: new THREE.Vector3(0, 120, 0.1), tgt: new THREE.Vector3(0, 0, 0) },
    center: { pos: new THREE.Vector3(0, 52, me === 0 ? 85 : -85), tgt: new THREE.Vector3(0, 0, 0) },
  };
  camera.position.copy(camPresets.me.pos);
  controls.target.copy(camPresets.me.tgt);
  let camAnim: { t0: number; p0: THREE.Vector3; t0v: THREE.Vector3; p1: THREE.Vector3; t1v: THREE.Vector3 } | null = null;

  // lights
  scene.add(new THREE.HemisphereLight(0xa5d4ff, 0x1c2a2a, 0.9));
  const sun = new THREE.DirectionalLight(0xffe0b0, 2.4);
  sun.position.set(-50, 80, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -75; sc.right = 75; sc.top = 40; sc.bottom = -40; sc.near = 10; sc.far = 220;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  // ocean
  const seaGeo = new THREE.PlaneGeometry(520, 520, 90, 90);
  seaGeo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(
    seaGeo,
    new THREE.MeshStandardMaterial({ color: 0x0c4a66, roughness: 0.28, metalness: 0.25, flatShading: true }),
  );
  sea.position.y = -0.4;
  sea.receiveShadow = true;
  scene.add(sea);
  const seaPos = seaGeo.attributes.position as THREE.BufferAttribute;
  const seaBase = Float32Array.from(seaPos.array);

  // islands
  scene.add(makeIsland(0, teamOf(0)), makeIsland(1, teamOf(1)));

  // free slot markers
  const slotMarkers = new Map<string, THREE.Mesh>();
  for (const side of [me] as Side[]) {
    for (let i = 1; i < SLOT_COUNT; i++) {
      const [x, z] = slotPos(side, i);
      const m = new THREE.Mesh(
        new THREE.RingGeometry(2.4, 2.9, 32),
        new THREE.MeshBasicMaterial({ color: COL_ME, transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 1.5, z);
      m.userData.slot = i;
      m.userData.side = side;
      m.visible = false;
      scene.add(m);
      slotMarkers.set(`${side}-${i}`, m);
    }
  }

  const buildingsRoot = new THREE.Group();
  const flightsRoot = new THREE.Group();
  const fxRoot = new THREE.Group();
  const rangeRoot = new THREE.Group();
  scene.add(buildingsRoot, flightsRoot, fxRoot, rangeRoot);

  const bEntries = new Map<string, BEntry>();
  const fEntries = new Map<number, FEntry>();
  const fxList: Fx[] = [];
  const pendingEvents: GameEvent[] = [];
  const smokers: { group: THREE.Group; puffs: THREE.Mesh[]; strength: number; key: string }[] = [];
  let lastEventId = -1;
  let cur: { view: GameView; offset: number; selectedId: number | null; showRanges: boolean; placing: BuildingType | null } | null = null;

  // target reticle
  const reticle = new THREE.Group();
  const retRing = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.1, 6, 40), new THREE.MeshBasicMaterial({ color: 0xff3b2e }));
  retRing.rotation.x = Math.PI / 2;
  reticle.add(retRing);
  for (let i = 0; i < 4; i++) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 1), new THREE.MeshBasicMaterial({ color: 0xff3b2e }));
    const a = (i * Math.PI) / 2;
    tick.position.set(Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2);
    tick.lookAt(0, 0, 0);
    reticle.add(tick);
  }
  reticle.visible = false;
  scene.add(reticle);

  const serverNow = () => Date.now() + (cur?.offset ?? 0);

  // ------------------------------------------------------------ effects
  function addFx(fx: Fx) {
    fx.start = performance.now();
    fxList.push(fx);
  }
  function spawnBlast(x: number, y: number, z: number, r: number, kind: "hit" | "intercept" | "miss" | "recon" | "launch" | "win") {
    const colors = { hit: 0xff8a2a, intercept: 0x9fe9ff, miss: 0xcfeaff, recon: 0x55aaff, launch: 0xffd27a, win: 0xff5522 } as const;
    const col = colors[kind];
    const radius = kind === "launch" ? 1.4 : kind === "intercept" ? 2.6 : Math.max(2.4, r);
    const cy = (kind === "hit" || kind === "win") ? Math.max(2.5, y + radius * 0.4) : (kind === "intercept" ? y : 1.3);

    // 4 layered meshes
    const fire = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95 }));
    const core = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: 0xfff5b6, transparent: true, opacity: 1 }));
    const halo = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: 0x4b1a08, transparent: true, opacity: 0.55 }));
    const shock = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    fire.position.set(x, cy, z);
    core.position.copy(fire.position);
    halo.position.copy(fire.position);
    shock.position.set(x, 1.3, z);
    shock.rotation.x = -Math.PI / 2;
    if (kind === "intercept") shock.rotation.set(Math.random() * 3, Math.random() * 3, 0);

    // sparks / debris particles
    const sparkN = kind === "launch" ? 0 : 12;
    const sparkPos = new Float32Array(sparkN * 3);
    const sparkVel: THREE.Vector3[] = [];
    for (let i = 0; i < sparkN; i++) {
      sparkPos[i * 3] = 0; sparkPos[i * 3 + 1] = 0; sparkPos[i * 3 + 2] = 0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.6 + 0.1;
      const sp = 8 + Math.random() * 16;
      sparkVel.push(new THREE.Vector3(Math.cos(theta) * Math.sin(phi), Math.cos(phi), Math.sin(theta) * Math.sin(phi)).multiplyScalar(sp));
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    const sparks = new THREE.Points(
      sparkGeo,
      new THREE.PointsMaterial({ size: 0.55, color: col, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }),
    );
    sparks.position.set(x, cy, z);

    // smoke column
    const smokeN = kind === "hit" || kind === "win" ? 4 : 1;
    const smokes: THREE.Mesh[] = [];
    for (let i = 0; i < smokeN; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(radius * (1.6 + i * 0.25), 12, 10), new THREE.MeshBasicMaterial({ color: 0x252019, transparent: true, opacity: 0.45, depthWrite: false }));
      s.position.set(x + (Math.random() - 0.5) * 1.2, cy + radius * 0.5 + i * radius * 0.7, z + (Math.random() - 0.5) * 1.2);
      fxRoot.add(s);
      smokes.push(s);
    }

    fxRoot.add(fire, core, halo, shock, sparks);
    const dur = kind === "launch" ? 700 : kind === "win" ? 3000 : kind === "recon" ? 1400 : kind === "intercept" ? 700 : 1200;

    addFx({
      start: 0,
      dur,
      update: (p) => {
        const e = 1 - Math.pow(1 - p, 3);
        const grow = kind === "recon" ? 0.25 : 1;
        fire.scale.setScalar(Math.max(0.01, radius * grow * (0.35 + e * 0.85)));
        (fire.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - p) * 0.95);
        core.scale.setScalar(Math.max(0.01, radius * 0.55 * (1 - p * 0.9)));
        halo.scale.setScalar(Math.max(0.01, radius * (0.4 + e * 1.4)));
        (halo.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - p) * 0.55);
        shock.scale.setScalar(Math.max(0.01, radius * (kind === "recon" ? 5 : 2.5) * e));
        (shock.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - p) * 0.85);
        // sparks
        for (let i = 0; i < sparkN; i++) {
          const v = sparkVel[i];
          const tt = p * 1.1;
          sparkPos[i * 3] = v.x * tt;
          sparkPos[i * 3 + 1] = v.y * tt - 0.5 * 9 * tt * tt;
          sparkPos[i * 3 + 2] = v.z * tt;
        }
        (sparks.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        (sparks.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - p);
        // smokes drift up and widen
        smokes.forEach((s, i) => {
          s.position.y += 0.06;
          s.scale.multiplyScalar(1.012);
          (s.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (0.55 - p * 0.4) * (1 - i * 0.15));
        });
      },
      done: () => {
        fxRoot.remove(fire, core, halo, shock, sparks);
        smokes.forEach((s) => fxRoot.remove(s));
        [fire.material, core.material, halo.material, shock.material, sparks.material, ...smokes.map((s) => s.material)].forEach((m) => (m as THREE.Material).dispose());
        sparkGeo.dispose();
      },
    });
  }

  function handleEvent(ev: GameEvent) {
    if (ev.kind === "hit" || ev.kind === "destroyed") spawnBlast(ev.x, ev.y, ev.z, ev.r || 3, "hit");
    else if (ev.kind === "win") spawnBlast(ev.x, ev.y, ev.z, ev.r || 10, "win");
    else if (ev.kind === "intercept") spawnBlast(ev.x, ev.y, ev.z, 2, "intercept");
    else if (ev.kind === "miss") spawnBlast(ev.x, 0.2, ev.z, 2, "miss");
    else if (ev.kind === "recon") spawnBlast(ev.x, 2, ev.z, 3, "recon");
    else if (ev.kind === "launch") spawnBlast(ev.x, 2, ev.z, 1.4, "launch");
  }

  // ------------------------------------------------------------ smoke
  const smokeGeo = new THREE.SphereGeometry(1, 8, 6);
  function addSmoker(key: string, x: number, z: number, strength: number) {
    const group = new THREE.Group();
    group.position.set(x, 1.3, z);
    const puffs: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(smokeGeo, new THREE.MeshBasicMaterial({ color: 0x2a2724, transparent: true, opacity: 0.5, depthWrite: false }));
      puffs.push(m);
      group.add(m);
    }
    fxRoot.add(group);
    smokers.push({ group, puffs, strength, key });
  }
  function clearSmokers(key: string) {
    for (let i = smokers.length - 1; i >= 0; i--) {
      if (smokers[i].key === key) {
        fxRoot.remove(smokers[i].group);
        smokers[i].puffs.forEach((p) => (p.material as THREE.Material).dispose());
        smokers.splice(i, 1);
      }
    }
  }

  // ------------------------------------------------------------ sync
  function makeBar(): { bar: THREE.Group; fg: THREE.Mesh } {
    const bar = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.42), new THREE.MeshBasicMaterial({ color: 0x050a0c, transparent: true, opacity: 0.85, depthTest: false }));
    bg.renderOrder = 10;
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.26), new THREE.MeshBasicMaterial({ color: 0x57e389, depthTest: false }));
    fg.renderOrder = 11;
    fg.position.z = 0.01;
    bar.add(bg, fg);
    return { bar, fg };
  }

  function syncBuildings(view: GameView) {
    const seen = new Set<string>();
    for (const side of [0, 1] as Side[]) {
      for (const b of view.players[side].buildings) {
        const key = `${side}-${b.id}`;
        seen.add(key);
        const dead = b.hp <= 0;
        let e = bEntries.get(key);
        if (!e || e.type !== b.type || e.dead !== dead) {
          if (e) {
            buildingsRoot.remove(e.group);
            buildingsRoot.remove(e.bar);
            clearSmokers(key);
          }
          const [x, z] = slotPos(side, b.slot);
          const group = dead ? makeRubble() : makeBuilding(b.type, teamOf(side));
          group.position.set(x, 1.2, z);
          const [lx, lz] = localSlot(b.slot);
          if (b.type === "airbase" && !dead) {
            const wa = side === 0 ? Math.atan2(lz, lx) : Math.atan2(lz, -lx);
            group.rotation.y = -(wa + Math.PI / 2);
          } else {
            group.rotation.y = ((b.slot * 53) % 7) * 0.2;
          }
          group.userData.key = key;
          group.traverse((o) => { o.userData.key = key; });
          const { bar, fg } = makeBar();
          bar.position.set(x, 1.2 + HEIGHTS[b.type] + 1.2, z);
          bar.visible = !dead;
          buildingsRoot.add(group, bar);
          e = { key, side, id: b.id, type: b.type, dead, group, bar, fg, hp: b.hp };
          bEntries.set(key, e);
          if (dead) addSmoker(key, x, z, 1);
        }
        e.hp = b.hp;
        if (!dead) {
          const ratio = Math.max(0.02, b.hp / BUILDINGS[b.type].hp);
          e.fg.scale.x = ratio;
          e.fg.position.x = -1.5 * (1 - ratio);
          (e.fg.material as THREE.MeshBasicMaterial).color.setHex(ratio > 0.6 ? 0x57e389 : ratio > 0.3 ? 0xf2b441 : 0xff5a47);
          const hasSmoke = smokers.some((s) => s.key === key);
          if (ratio < 0.5 && !hasSmoke) {
            const [x, z] = slotPos(side, b.slot);
            addSmoker(key, x, z, 0.5);
          } else if (ratio >= 0.5 && hasSmoke) clearSmokers(key);
        }
      }
    }
    // slot markers
    const mine = new Set(view.players[me].buildings.filter((b) => b.hp > 0).map((b) => b.slot));
    slotMarkers.forEach((m, k) => {
      const slot = Number(k.split("-")[1]);
      m.visible = !mine.has(slot);
    });
    void seen;
  }

  function syncRanges(view: GameView, show: boolean) {
    while (rangeRoot.children.length) {
      const c = rangeRoot.children[0] as THREE.Mesh;
      rangeRoot.remove(c);
      c.geometry.dispose();
      (c.material as THREE.Material).dispose();
    }
    if (!show) return;
    for (const side of [0, 1] as Side[]) {
      for (const b of view.players[side].buildings) {
        if (b.type !== "defense_site" || b.hp <= 0 || !b.stock) continue;
        let range = 0;
        for (const [wid, n] of Object.entries(b.stock)) {
          if (n > 0 && (b.ammo?.[wid] ?? 0) > 0) range = Math.max(range, WEAPON_BY_ID[wid]?.range ?? 0);
        }
        if (range <= 0) continue;
        const [x, z] = slotPos(side, b.slot);
        const col = teamOf(side);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(range, 64), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide }));
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(x, 1.4, z);
        const edge = new THREE.Mesh(new THREE.RingGeometry(range - 0.25, range, 64), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
        edge.rotation.x = -Math.PI / 2;
        edge.position.set(x, 1.45, z);
        rangeRoot.add(disc, edge);
      }
    }
  }

  function makeFlightEntry(f: Flight): FEntry {
    const w = WEAPON_BY_ID[f.wid];
    const col = teamOf(f.side);
    let model: THREE.Group;
    if (f.mission === "defense") {
      // interceptor missile - slim, fast
      model = makeInterceptor(col);
    } else if (w.kind === "missile") {
      const sc = w.cat === "icbm" ? 2.6 : w.cat === "bal" ? 1.6 : w.cat === "hyper" ? 1.5 : 1.2;
      model = makeMissile(col, sc);
    } else if (w.kind === "aircraft") model = makeJet(col, w.slots >= 3 ? 2.2 : 1.5);
    else model = makeDrone(col, w.reusable ? 1.7 : 1.2, !w.reusable);
    const group = new THREE.Group();
    group.add(model);
    group.visible = false;
    flightsRoot.add(group);
    const pos = new Float32Array(TRAIL_N * 3);
    const colA = new Float32Array(TRAIL_N * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colA, 3));
    geo.setDrawRange(0, 0);
    const trail = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: f.mission === "defense" ? 0.7 : w.kind === "missile" ? 1.1 : 0.7,
        vertexColors: true, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      }),
    );
    trail.frustumCulled = false;
    flightsRoot.add(trail);
    return { group, trail, pos, col: colA, hist: [], f };
  }

  function flightPoint(f: Flight, p: number, out: THREE.Vector3) {
    const w = WEAPON_BY_ID[f.wid];
    const x = f.a[0] + (f.b[0] - f.a[0]) * p;
    const z = f.a[1] + (f.b[1] - f.a[1]) * p;
    if (f.mission === "defense") {
      // arcing trajectory up then down toward target
      const arc = Math.sin(Math.PI * p);
      out.set(x, 2 + arc * 14, z);
      return;
    }
    const s = Math.sin(Math.PI * p);
    let y: number;
    switch (w.cat) {
      case "icbm": y = 3 + s * 70; break;
      case "bal": y = 3 + s * 42; break;
      case "sbm": y = 3 + s * 28; break;
      case "hyper": y = 3 + Math.pow(s, 0.6) * 20; break;
      case "cruise": y = 3 + s * 2.8; break;
      case "air": y = 11 + s * 5; break;
      default: y = 8 + s * 4;
    }
    out.set(x, y, z);
  }

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  function syncFlights(view: GameView) {
    const ids = new Set(view.flights.map((f) => f.id));
    fEntries.forEach((e, id) => {
      if (!ids.has(id)) {
        flightsRoot.remove(e.group, e.trail);
        e.trail.geometry.dispose();
        (e.trail.material as THREE.Material).dispose();
        fEntries.delete(id);
      }
    });
    for (const f of view.flights) {
      const e = fEntries.get(f.id);
      if (!e) fEntries.set(f.id, makeFlightEntry(f));
      else {
        if (e.f.phase !== f.phase) e.hist.length = 0;
        e.f = f;
      }
    }
  }

  function update(u: { view: GameView; offset: number; selectedId: number | null; showRanges: boolean; placing: BuildingType | null }) {
    const first = cur === null;
    cur = u;
    syncBuildings(u.view);
    syncFlights(u.view);
    syncRanges(u.view, u.showRanges);
    // slot markers
    const occupied = new Set(u.view.players[me].buildings.filter((b) => b.hp > 0).map((b) => b.slot));
    slotMarkers.forEach((m, k) => {
      const slot = Number(k.split("-")[1]);
      const free = !occupied.has(slot);
      m.visible = Boolean(u.placing) && free;
    });
    // events
    const maxId = u.view.events.reduce((m, e) => Math.max(m, e.id), 0);
    if (first) lastEventId = maxId;
    else {
      for (const ev of u.view.events) if (ev.id > lastEventId) pendingEvents.push(ev);
      lastEventId = Math.max(lastEventId, maxId);
    }
    // reticle
    const sel = u.selectedId !== null ? bEntries.get(`${foe}-${u.selectedId}`) : undefined;
    if (sel && !sel.dead) {
      reticle.visible = true;
      reticle.position.set(sel.group.position.x, 1.9, sel.group.position.z);
    } else reticle.visible = false;
  }

  function setCamera(m: CamMode) {
    const pr = camPresets[m];
    camAnim = {
      t0: performance.now(),
      p0: camera.position.clone(),
      t0v: controls.target.clone(),
      p1: pr.pos.clone(),
      t1v: pr.tgt.clone(),
    };
  }

  // ------------------------------------------------------------ interaction
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt: { x: number; y: number } | null = null;
  function pick(ev: PointerEvent): BEntry | null {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(buildingsRoot.children, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        const k = o.userData.key as string | undefined;
        if (k) {
          const e = bEntries.get(k);
          if (e) return e;
        }
        o = o.parent;
      }
    }
    return null;
  }
  function pickSlot(ev: PointerEvent): number | null {
    if (!cur?.placing) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(Array.from(slotMarkers.values()), false);
    const m = hits[0]?.object as THREE.Mesh | undefined;
    return m?.userData.slot ?? null;
  }
  const onDown = (ev: PointerEvent) => { downAt = { x: ev.clientX, y: ev.clientY }; };
  const onUp = (ev: PointerEvent) => {
    if (!downAt) return;
    const moved = Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y);
    downAt = null;
    if (moved > 5) return;
    if (cur?.placing) {
      const slot = pickSlot(ev);
      if (slot !== null) cb.pickSlot(slot);
      return;
    }
    const e = pick(ev);
    if (!e) return;
    if (e.side === me) cb.pickOwn(e.id);
    else if (!e.dead) cb.pickEnemy(e.id);
  };
  let lastHover = 0;
  const onMove = (ev: PointerEvent) => {
    const now = performance.now();
    if (now - lastHover < 60) return;
    lastHover = now;
    if (cur?.placing) {
      const s = pickSlot(ev);
      renderer.domElement.style.cursor = s !== null ? "crosshair" : "grab";
      cb.hover(null);
      return;
    }
    const e = pick(ev);
    renderer.domElement.style.cursor = e ? "pointer" : "grab";
    if (e) {
      const rect = mount.getBoundingClientRect();
      cb.hover({ side: e.side, id: e.id, x: ev.clientX - rect.left, y: ev.clientY - rect.top });
    } else cb.hover(null);
  };
  const onLeave = () => cb.hover(null);
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);
  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.addEventListener("pointerleave", onLeave);

  // ------------------------------------------------------------ resize + loop
  function resize() {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(mount);

  let raf = 0;
  const tStart = performance.now();
  function loop() {
    raf = requestAnimationFrame(loop);
    const nowMs = performance.now();
    const t = (nowMs - tStart) / 1000;

    // ocean
    for (let i = 0; i < seaPos.count; i++) {
      const x = seaBase[i * 3];
      const z = seaBase[i * 3 + 2];
      seaPos.setY(i, Math.sin(x * 0.09 + t * 0.9) * 0.28 + Math.cos(z * 0.11 + t * 1.2) * 0.24 + Math.sin((x + z) * 0.05 + t * 0.5) * 0.3);
    }
    seaPos.needsUpdate = true;

    // camera anim
    if (camAnim) {
      const p = Math.min(1, (nowMs - camAnim.t0) / 900);
      const e = 1 - Math.pow(1 - p, 3);
      camera.position.lerpVectors(camAnim.p0, camAnim.p1, e);
      controls.target.lerpVectors(camAnim.t0v, camAnim.t1v, e);
      if (p >= 1) camAnim = null;
    }
    controls.update();

    // billboards
    bEntries.forEach((e) => { if (!e.dead) e.bar.quaternion.copy(camera.quaternion); });
    reticle.rotation.y = t * 1.5;
    const pulse = 1 + Math.sin(t * 5) * 0.08;
    reticle.scale.setScalar(pulse);

    // pending events
    if (pendingEvents.length) {
      const sn = serverNow();
      for (let i = pendingEvents.length - 1; i >= 0; i--) {
        if (pendingEvents[i].t <= sn) {
          handleEvent(pendingEvents[i]);
          pendingEvents.splice(i, 1);
        }
      }
    }

    // fx
    for (let i = fxList.length - 1; i >= 0; i--) {
      const fx = fxList[i];
      const p = (nowMs - fx.start) / fx.dur;
      if (p >= 1) {
        fx.done();
        fxList.splice(i, 1);
      } else fx.update(p);
    }

    // smoke
    for (const s of smokers) {
      s.puffs.forEach((m, i) => {
        const ph = ((t * 0.35 * (0.6 + s.strength * 0.6) + i / s.puffs.length) % 1);
        m.position.set(Math.sin(i * 2.1 + t * 0.2) * 0.6 * ph, 1 + ph * (5 + s.strength * 5), Math.cos(i * 1.7) * 0.6 * ph);
        m.scale.setScalar((0.5 + ph * 1.8) * (0.6 + s.strength * 0.5));
        (m.material as THREE.MeshBasicMaterial).opacity = (1 - ph) * 0.45;
      });
    }

    // flights
    if (cur) {
      const sn = serverNow();
      fEntries.forEach((e) => {
        const f = e.f;
        const span = Math.max(1, f.t1 - f.t0);
        const p = Math.min(1, Math.max(0, (sn - f.t0) / span));
        const started = sn >= f.t0;
        e.group.visible = started;
        e.trail.visible = started;
        if (!started) return;
        flightPoint(f, p, tmpA);
        const pn = p > 0.98 ? p - 0.02 : p + 0.02;
        flightPoint(f, pn, tmpB);
        if (p > 0.98) tmpB.copy(tmpA).multiplyScalar(2).sub(tmpB);
        e.group.position.copy(tmpA);
        e.group.lookAt(tmpB);
        e.hist.push(tmpA.clone());
        if (e.hist.length > TRAIL_N) e.hist.shift();
        const col = new THREE.Color(teamOf(f.side));
        const n = e.hist.length;
        for (let i = 0; i < n; i++) {
          const h = e.hist[n - 1 - i];
          e.pos[i * 3] = h.x; e.pos[i * 3 + 1] = h.y; e.pos[i * 3 + 2] = h.z;
          const k = 1 - i / TRAIL_N;
          e.col[i * 3] = col.r * k; e.col[i * 3 + 1] = col.g * k; e.col[i * 3 + 2] = col.b * k;
        }
        const g = e.trail.geometry;
        g.setDrawRange(0, n);
        (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        (g.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      });
    }

    renderer.render(scene, camera);
  }
  loop();

  function dispose() {
    cancelAnimationFrame(raf);
    ro.disconnect();
    renderer.domElement.removeEventListener("pointerdown", onDown);
    renderer.domElement.removeEventListener("pointerup", onUp);
    renderer.domElement.removeEventListener("pointermove", onMove);
    renderer.domElement.removeEventListener("pointerleave", onLeave);
    controls.dispose();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh || (o as THREE.Points).isPoints) {
        m.geometry?.dispose();
      }
    });
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { update, setCamera, dispose };
}
