import { CONNECTORS } from '../../constants/connectors';
import { DEVICES } from '../../constants/devices';
import { FANS } from '../../constants/fans';
import { METALS, FILAMENTS } from '../../constants/materials';
import { PRINTERS } from '../../constants/printers';

export function getConnectorCatalog() {
  return Object.entries(CONNECTORS).map(([key, c]) => ({
    key,
    name: c.name,
    description: c.desc,
    cutout: c.cut,
    width: c.w,
    height: c.h,
    radius: c.r,
    depthBehind: c.depthBehind,
    mountHoles: c.mountHoles,
  }));
}

export function getDeviceCatalog() {
  return Object.entries(DEVICES).map(([key, d]) => ({
    key,
    name: d.name,
    width: d.w,
    depth: d.d,
    height: d.h,
    weight: d.wt,
    ports: d.ports,
    poe: d.poe,
  }));
}

export function getFanCatalog() {
  return Object.entries(FANS).map(([key, f]) => ({
    key,
    name: f.name,
    size: f.size,
    cutoutDiameter: f.cutoutDiameter,
    holeSpacing: f.holeSpacing,
    holeDiameter: f.holeDiameter,
    depthBehind: f.depthBehind,
    cfm: f.cfm,
  }));
}

export function getMaterialCatalog() {
  return {
    metals: Object.entries(METALS).map(([key, m]) => ({
      key,
      name: m.name,
      thickness: m.t,
      bendRadius: m.br,
      density: m.dn,
    })),
    filaments: Object.entries(FILAMENTS).map(([key, f]) => ({
      key,
      name: f.name,
      strength: f.str,
      heatResistance: f.heat,
    })),
    printers: Object.entries(PRINTERS).map(([key, p]) => ({
      key,
      name: p.name,
      bed: p.bed,
    })),
  };
}
