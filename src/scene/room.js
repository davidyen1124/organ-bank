import * as THREE from 'three';

// Concrete wall, sealed floor, one hard key light and not much else.
export function buildRoom({ tex, mobile }) {
  const g = new THREE.Group();

  const tile = (t, sx, sy) => {
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    t.repeat.set(sx, sy);
    t.anisotropy = 8;
    return t;
  };

  const WALL_W = 20, WALL_H = 7.2;
  const concrete = tile(tex.concrete, WALL_W / 3.4, WALL_H / 3.4);
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(WALL_W, WALL_H),
    // matte concrete has no highlight worth paying for, and it fills most of the frame
    new THREE.MeshLambertMaterial({ map: concrete, bumpMap: concrete, bumpScale: 1.4, color: 0xb9b5ae }),
  );
  wall.position.set(0, WALL_H / 2, 0);
  wall.receiveShadow = true;
  g.add(wall);

  const floorMap = tile(tex.floor, WALL_W / 3, 12 / 3);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(WALL_W, 12),
    new THREE.MeshStandardMaterial({ map: floorMap, bumpMap: floorMap, bumpScale: 0.5, color: 0xd2d0cc, roughness: 0.36, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 6);
  floor.receiveShadow = true;
  g.add(floor);

  // steel angle where the wall meets the floor
  const skirt = new THREE.Mesh(
    new THREE.BoxGeometry(WALL_W, 0.045, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x1a1b1d, metalness: 0.8, roughness: 0.5 }),
  );
  skirt.position.set(0, 0.0225, 0.006);
  skirt.receiveShadow = true;
  g.add(skirt);

  const key = new THREE.SpotLight(0xfff0dc, 110, 0, 0.47, 0.95, 2);
  key.position.set(-2.7, 4.7, 4.3);
  key.target.position.set(0, 1.45, 0);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(mobile ? 1024 : 2048);
  key.shadow.camera.near = 2.5;
  key.shadow.camera.far = 11;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.012;
  key.shadow.radius = 5;
  g.add(key, key.target);

  const rim = new THREE.SpotLight(0x9db8ff, 20, 0, 0.5, 1, 2);
  rim.position.set(3.6, 1.9, 3.2);
  rim.target.position.set(0, 1.5, 0);
  g.add(rim, rim.target);

  // low wash so the cord on the floor does not vanish
  const wash = new THREE.SpotLight(0xdfe6ff, 22, 0, 0.62, 1, 2);
  wash.position.set(0.8, 3.4, 3.4);
  wash.target.position.set(0.3, 0, 0.9);
  g.add(wash, wash.target);

  g.add(new THREE.HemisphereLight(0x8fa0b5, 0x17120d, 0.1));
  return g;
}
