window.WarehouseTwin = window.WarehouseTwin || {};

(function (ns) {
  const WORLD = {
    width: 80,
    depth: 88,
    height: 14
  };

  const SOURCE_STORAGE = {
    x0: 0,
    x1: 70,
    y0: 5,
    y1: 87.5
  };

  const PALETTE = {
    sky: color(224, 228, 225),
    haze: color(193, 200, 196),
    floor: color(109, 114, 111),
    floorAlt: color(123, 127, 124),
    slab: color(141, 145, 141),
    wall: color(200, 204, 200),
    wallDark: color(128, 134, 135),
    roof: color(95, 100, 103),
    rackFrame: color(57, 79, 95),
    rackBeam: color(224, 137, 41),
    rackShelf: color(176, 184, 188),
    palletWood: color(154, 117, 78),
    palletA: color(188, 194, 195),
    palletB: color(150, 159, 163),
    palletC: color(196, 174, 142),
    dock: color(173, 152, 119),
    receiving: color(168, 150, 117),
    shipping: color(160, 124, 96),
    staging: color(186, 180, 166),
    operations: color(97, 109, 116),
    kardex: color(109, 88, 147),
    fast: color(118, 143, 106),
    reserve: color(103, 127, 143),
    bulk: color(123, 129, 120),
    overflow: color(150, 145, 126),
    hazmat: color(181, 76, 53),
    lane: color(236, 231, 214),
    laneAccent: color(220, 182, 73),
    routeBaseline: color(196, 117, 71),
    routeOptimized: color(90, 156, 115),
    trafficLow: color(224, 181, 90),
    trafficHigh: color(198, 88, 57),
    truckBody: color(219, 166, 57),
    truckDark: color(47, 52, 57),
    shadow: color(16, 19, 22),
    fog: color(34, 38, 40),
    lightWarm: color(247, 222, 168),
    stopGlow: color(231, 211, 150)
  };

  const DEFAULT_VIEW = {
    target: realPoint(37, 42, 3.2),
    yaw: 2.36,
    pitch: 0.7,
    radius: 104
  };

  const DEFAULT_POV = {
    position: realPoint(61.3, 10.6, 1.72),
    yaw: 0,
    pitch: 0.06
  };

  const WALL_CLEARANCE = 3;

  ns.palette = PALETTE;
  ns.createWarehouseModel = createWarehouseModel;
  ns.recordToStop = recordToStop;
  ns.createRenderer = createRenderer;

  function createWarehouseModel(assignments) {
    const dockDepth = 5;
    const operationsWidth = 10;
    const storageBlock = { x0: 0, x1: WORLD.width - operationsWidth, y0: dockDepth, y1: 87.5 };
    const storageWidth = storageBlock.x1 - storageBlock.x0;
    const storageDepth = storageBlock.y1 - storageBlock.y0;
    const aisleWidth = 3;
    const rackDepth = 1.2;
    const moduleWidth = aisleWidth + rackDepth * 2;
    const crossAisle = {
      x0: storageBlock.x0,
      x1: storageBlock.x1,
      y0: 44.5,
      y1: 48
    };

    function makeZone(key, label, x0, x1, y0, y1, extras) {
      const aisleCount = Math.max(1, Math.floor((x1 - x0) / moduleWidth));
      const explicitAisles = extras && Array.isArray(extras.aisles) ? extras.aisles.slice() : null;
      return {
        key,
        label,
        x0,
        x1,
        y0,
        y1,
        aisles: explicitAisles || Array.from({ length: aisleCount }, (_, index) => roundTo(x0 + moduleWidth * index + moduleWidth / 2, 2)),
        ...extras
      };
    }

    function sourceBounds(xFrac0, xFrac1, yFrac0, yFrac1) {
      return {
        x0: roundTo(SOURCE_STORAGE.x0 + (SOURCE_STORAGE.x1 - SOURCE_STORAGE.x0) * xFrac0, 2),
        x1: roundTo(SOURCE_STORAGE.x0 + (SOURCE_STORAGE.x1 - SOURCE_STORAGE.x0) * xFrac1, 2),
        y0: roundTo(SOURCE_STORAGE.y0 + (SOURCE_STORAGE.y1 - SOURCE_STORAGE.y0) * yFrac0, 2),
        y1: roundTo(SOURCE_STORAGE.y0 + (SOURCE_STORAGE.y1 - SOURCE_STORAGE.y0) * yFrac1, 2)
      };
    }

    const zones = {
      kardex: makeZone("kardex", "Kardex", 0, 15, 5, 25, {
        type: "kardex",
        height: 9.8,
        aisles: [4.7, 9.7],
        displayRows: [5.1, 9.4, 12.9],
        rackY0: 8.3,
        rackY1: 22.0,
        sourceBounds: sourceBounds(0.0, 0.62, 0.0, 0.45)
      }),
      small: makeZone("small", "Fwd Pick Shelving", 0, 15, 25, 44.5, {
        type: "shelf",
        height: 7.2,
        aisles: [4.7, 9.7],
        displayRows: [4.9, 8.6, 12.1],
        rackY0: 28.1,
        rackY1: 41.5,
        sourceBounds: sourceBounds(0.62, 0.7, 0.0, 0.45)
      }),
      fast_pick: makeZone("fast_pick", "Forward Pick (A)", 15, 70, 5, 25, {
        type: "pallet",
        height: 6.1,
        levels: 3,
        lowProfile: true,
        density: 0.66,
        aisles: [21, 28, 35, 42, 49, 56, 59.8],
        displayRows: buildDisplayRows(20.2, 57.4, 3.8),
        rackY0: 10.8,
        rackY1: 22.0,
        sourceBounds: sourceBounds(0.7, 1.0, 0.0, 0.3)
      }),
      reserve: makeZone("reserve", "Reserve (B)", 15, 70, 25, 44.5, {
        type: "pallet",
        height: 8.8,
        levels: 4,
        density: 0.58,
        aisles: [21, 28, 35, 42, 49, 56, 59.8],
        displayRows: buildDisplayRows(20.2, 57.4, 3.8),
        rackY0: 27.8,
        rackY1: 41.6,
        sourceBounds: sourceBounds(0.7, 1.0, 0.3, 0.48)
      }),
      bulk: makeZone("bulk", "Bulk / Reserve (C)", 0, 70, 48, 69, {
        type: "pallet",
        height: 11.8,
        levels: 5,
        density: 0.76,
        aisles: [6, 13, 20, 27, 34, 41, 48, 55, 59.5],
        displayRows: buildDisplayRows(7.1, 57.9, 3.5),
        rackY0: 50.5,
        rackY1: 65.9,
        sourceBounds: sourceBounds(0.0, 1.0, 0.52, 0.85)
      }),
      overflow: makeZone("overflow", "Overflow / Slow Movers", 15, 70, 70, 87.5, {
        type: "pallet",
        height: 9.1,
        levels: 4,
        density: 0.5,
        aisles: [21, 28, 35, 42, 49, 56, 59.8],
        displayRows: buildDisplayRows(20.2, 57.4, 3.5),
        rackY0: 72.9,
        rackY1: 84.0,
        sourceBounds: sourceBounds(0.0, 1.0, 0.85, 1.0)
      })
    };

    for (const zone of Object.values(zones)) {
      zone.walkAisles = buildWalkAisles(zone);
    }

    const routeAnchors = {
      front: 9.2,
      middle: 46,
      rear: roundTo(storageBlock.y1 - 1.4, 2)
    };
    const routeTransferYs = [routeAnchors.front, routeAnchors.middle];

    const routeAisles = uniqueSorted([
      ...zones.kardex.aisles,
      ...zones.small.aisles,
      ...zones.fast_pick.aisles,
      ...zones.reserve.aisles,
      ...zones.bulk.aisles,
      ...zones.overflow.aisles,
      60
    ]);

    return {
      world: WORLD,
      assignments,
      dockDepth,
      aisleWidth,
      rackDepth,
      moduleWidth,
      palletFaceOffset: aisleWidth / 2 + rackDepth / 2,
      kardexFaceOffset: aisleWidth / 2 + 0.88,
      smallFaceOffset: aisleWidth / 2 + 0.72,
      palletLevelStep: 1.35,
      kardexLevelStep: 1.02,
      smallLevelStep: 0.88,
      storageBlock,
      operations: { x0: 71, x1: 79, y0: 49, y1: 60 },
      packaging: { x0: 71, x1: 79, y0: 5, y1: 35 },
      hazmat: { x0: 2.2, x1: 12.8, y0: 71, y1: 85.5 },
      charging: { x0: 71, x1: 79, y0: 35.5, y1: 46.5 },
      receiving: { x0: 0.0, x1: 24.0, y0: 0.5, y1: 7.4 },
      centralDock: { x0: 24.0, x1: 47.0, y0: 0.5, y1: 4.8 },
      shipping: { x0: 47.0, x1: 80.0, y0: 0.5, y1: 7.8 },
      inboundBuffer: { x0: 0.0, x1: 24.0, y0: 0.5, y1: 7.4 },
      packing: { x0: WORLD.width - operationsWidth, x1: WORLD.width, y0: dockDepth, y1: 35 },
      outboundBuffer: { x0: 47.0, x1: 80.0, y0: 0.5, y1: 7.8 },
      crossAisle,
      routeAnchors,
      routeTransferYs,
      routeStart: { x: 60, y: routeAnchors.front },
      zones,
      routeAisles,
      aisleLabels: buildAisleLabels(routeAisles, [7.2, routeAnchors.middle, 78]),
      areaLabels: buildAreaLabels({
        receiving: { label: "Inbound", x: 12, y: 4.0 },
        centralDock: { label: "Central Staging", x: 35.5, y: 2.5 },
        shipping: { label: "Outbound", x: 63.5, y: 4.0 },
        packaging: { label: "Packaging", x: 75, y: 20 },
        charging: { label: "Charging", x: 75, y: 41 },
        operations: { label: "Support", x: 75, y: 54.2 },
        hazmat: { label: "Hazmat", x: 7.5, y: 78.5 }
      }),
      navigationSegments: buildNavigationSegments(zones, routeAnchors, routeTransferYs)
    };
  }

  function recordToStop(record, warehouse, labelOverride) {
    if (!record) {
      return null;
    }

    const zone = warehouse.zones[record.zone_key];
    if (!zone) {
      return null;
    }

    const mapped = mapRecordIntoDisplayZone(zone, Number(record.rec_x), Number(record.rec_y));
    const side = hashString(record.recommended_location || record.sku) % 2 === 0 ? -1 : 1;
    const aisleX = nearestAisleX(zone.aisles, mapped.x);
    const displayX = nearestAisleX(zone.displayRows || zone.aisles, mapped.x);
    if (!Number.isFinite(aisleX)) {
      return null;
    }

    const faceOffset = zone.type === "kardex"
      ? warehouse.kardexFaceOffset
      : zone.type === "shelf"
        ? warehouse.smallFaceOffset
        : warehouse.palletFaceOffset;

    const y = clamp(mapped.y, zone.y0 + 1.1, zone.y1 - 1.1);
    const level = Number(record.rec_level || 0);
    const height = zone.type === "kardex"
      ? 0.72 + level * warehouse.kardexLevelStep
      : zone.type === "shelf"
        ? 0.68 + level * warehouse.smallLevelStep
        : 0.86 + level * warehouse.palletLevelStep;

    return {
      id: String(record.recommended_location || record.sku),
      label: labelOverride || String(record.recommended_location || record.sku),
      sku: record.sku,
      zoneKey: record.zone_key,
      zoneLabel: zone.label,
      activity: Number(record.activity || 0),
      side,
      aisleX,
      y,
      accessPoint: realPoint(aisleX, y, 0.08),
      worldPosition: realPoint(clamp((Number.isFinite(displayX) ? displayX : mapped.x) + side * Math.min(faceOffset * 0.35, 0.42), zone.x0 + 0.6, zone.x1 - 0.6), y, Math.min(height, WORLD.height - 1.8)),
      record
    };
  }

  function createRenderer(canvas, warehouse, options) {
    const ctx = canvas.getContext("2d");
    const callbacks = options || {};
    const staticScene = buildWarehouseScene(warehouse);
    const state = {
      elapsed: 0,
      width: window.innerWidth,
      height: window.innerHeight,
      orbitCamera: cloneView(DEFAULT_VIEW),
      povCamera: clonePovView(DEFAULT_POV),
      cameraMode: "orbit",
      layers: {
        scenarioColor: PALETTE.routeOptimized,
        showRoute: true,
        showCongestion: true,
        routePolyline: [],
        congestionEdges: [],
        hotspots: [],
        stops: [],
        selectedStopId: null,
        vehicles: [],
        lookupStop: null,
        clickableStops: []
      },
      cachedRouteFaces: [],
      cachedCongestionFaces: [],
      isDragging: false,
      keys: new Set(),
      lastX: 0,
      lastY: 0,
      pointerDownX: 0,
      pointerDownY: 0,
      lastMotionTime: 0,
      tween: null,
      tour: null
    };

    window.addEventListener("resize", resize);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    resize();

    return {
      setLayers(nextLayers) {
        state.layers = { ...state.layers, ...nextLayers };
        state.cachedRouteFaces = buildRouteStripFaces(state.layers.routePolyline, state.layers.scenarioColor);
        state.cachedCongestionFaces = buildCongestionFaces(state.layers.congestionEdges);
      },
      getCameraMode() {
        return state.cameraMode;
      },
      toggleCameraMode() {
        state.tour = null;
        state.tween = null;
        state.cameraMode = state.cameraMode === "orbit" ? "pov" : "orbit";
        if (state.cameraMode === "pov") {
          state.povCamera = clonePovView(DEFAULT_POV);
          state.povCamera.position = constrainPovPosition(state.povCamera.position, warehouse);
        }
      },
      tick(dt) {
        state.elapsed += dt;
        updateCamera(dt);
        render();
      },
      resetView() {
        state.tour = null;
        if (state.cameraMode === "orbit") {
          startTween(DEFAULT_VIEW, 1.2);
        } else {
          state.povCamera = clonePovView(DEFAULT_POV);
          state.povCamera.position = constrainPovPosition(state.povCamera.position, warehouse);
        }
      },
      focusOnStop(stop) {
        if (!stop) {
          return;
        }

        state.tour = null;
        state.cameraMode = "orbit";
        startTween({
          target: add(stop.accessPoint, vec(0, 1.9, 0)),
          yaw: stop.accessPoint.x > 0 ? -1.02 : 1.02,
          pitch: 0.42,
          radius: 34
        }, 1.15);
      },
      startTour() {
        state.tour = {
          index: -1,
          sequence: buildDemoViews(),
          holdTimer: 0
        };
        advanceTour();
      },
      stopTour() {
        state.tour = null;
      }
    };

    function resize() {
      const dpr = 1;
      state.width = window.innerWidth;
      state.height = window.innerHeight;
      canvas.width = Math.floor(state.width * dpr);
      canvas.height = Math.floor(state.height * dpr);
      canvas.style.width = state.width + "px";
      canvas.style.height = state.height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function handlePointerDown(event) {
      if (event.button !== 0) {
        return;
      }
      state.tour = null;
      state.tween = null;
      state.isDragging = true;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      state.pointerDownX = event.clientX;
      state.pointerDownY = event.clientY;
      canvas.classList.add("is-dragging");
    }

    function handleKeyDown(event) {
      if (isTypingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        state.keys.add(key);
        event.preventDefault();
      }
    }

    function handleKeyUp(event) {
      state.keys.delete(event.key.toLowerCase());
    }

    function handlePointerMove(event) {
      if (!state.isDragging) {
        return;
      }
      const dx = event.clientX - state.lastX;
      const dy = event.clientY - state.lastY;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      if (state.cameraMode === "orbit") {
        state.orbitCamera.yaw += dx * 0.005;
        state.orbitCamera.pitch = clamp(state.orbitCamera.pitch - dy * 0.0035, 0.24, 0.72);
      } else {
        state.povCamera.yaw += dx * 0.0042;
        state.povCamera.pitch = clamp(state.povCamera.pitch - dy * 0.0028, -0.14, 0.34);
      }
      state.lastMotionTime = state.elapsed;
    }

    function handlePointerUp(event) {
      const movedDistance = Math.hypot(event.clientX - state.pointerDownX, event.clientY - state.pointerDownY);
      state.isDragging = false;
      canvas.classList.remove("is-dragging");
      if (movedDistance <= 6 && state.cameraMode === "pov" && typeof callbacks.onPickStop === "function") {
        const hit = pickStoredStop(event.clientX, event.clientY);
        if (hit) {
          callbacks.onPickStop(hit);
        }
      }
    }

    function handleWheel(event) {
      event.preventDefault();
      state.tour = null;
      state.tween = null;
      if (state.cameraMode === "orbit") {
        state.orbitCamera.radius = clamp(state.orbitCamera.radius + event.deltaY * 0.04, 32, 96);
        state.lastMotionTime = state.elapsed;
      }
    }

    function updateCamera(dt) {
      updatePovMovement(dt);

      if (state.tween) {
        state.tween.elapsed += dt;
        const t = clamp(state.tween.elapsed / state.tween.duration, 0, 1);
        const eased = t * t * (3 - 2 * t);
        state.orbitCamera.target = lerpVec(state.tween.from.target, state.tween.to.target, eased);
        state.orbitCamera.yaw = lerp(state.tween.from.yaw, state.tween.to.yaw, eased);
        state.orbitCamera.pitch = lerp(state.tween.from.pitch, state.tween.to.pitch, eased);
        state.orbitCamera.radius = lerp(state.tween.from.radius, state.tween.to.radius, eased);
        if (t >= 1) {
          state.tween = null;
        }
      }

      if (!state.tour || state.tween) {
        return;
      }

      state.tour.holdTimer += dt;
      const current = state.tour.sequence[state.tour.index];
      if (state.tour.holdTimer >= current.hold) {
        advanceTour();
      }
    }

    function updatePovMovement(dt) {
      if (state.cameraMode !== "pov" || state.tween) {
        return;
      }

      let move = vec(0, 0, 0);
      const forward = directionFromAngles(state.povCamera.yaw, 0);
      const right = normalize(cross(forward, vec(0, 1, 0)));

      if (state.keys.has("w") || state.keys.has("arrowup")) {
        move = add(move, forward);
      }
      if (state.keys.has("s") || state.keys.has("arrowdown")) {
        move = sub(move, forward);
      }
      if (state.keys.has("d") || state.keys.has("arrowright")) {
        move = add(move, right);
      }
      if (state.keys.has("a") || state.keys.has("arrowleft")) {
        move = sub(move, right);
      }

      const magnitude = length(move);
      if (magnitude < 0.0001) {
        return;
      }

      const speed = 7.2;
      const displacement = scale(move, speed * dt / magnitude);
      const candidate = add(state.povCamera.position, vec(displacement.x, 0, displacement.z));
      state.povCamera.position = constrainPovPosition(candidate, warehouse);
      state.lastMotionTime = state.elapsed;
    }

    function pickStoredStop(clientX, clientY) {
      const candidates = state.layers.clickableStops || [];
      if (!candidates.length) {
        return null;
      }

      const rect = canvas.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;
      const camera = buildActiveCamera(state, state.width, state.height);
      const flatForward = normalize(vec(camera.forward.x, 0, camera.forward.z));
      const flatRight = normalize(vec(camera.right.x, 0, camera.right.z));
      let bestStop = null;
      let bestScore = Infinity;

      for (const stop of candidates) {
        const projected = projectPoint(stop.worldPosition, camera);
        const anchorProjected = projectPoint(stop.accessPoint, camera);
        if (!projected || !anchorProjected || projected.depth > 34) {
          continue;
        }

        const accessDelta = sub(stop.accessPoint, camera.position);
        const forwardDepth = dot(accessDelta, flatForward);
        const lateralToView = Math.abs(dot(accessDelta, flatRight));
        if (forwardDepth < 1.5 || forwardDepth > 34) {
          continue;
        }

        const maxLateral = clamp(1.45 + forwardDepth * 0.03, 1.45, 2.4);
        if (lateralToView > maxLateral) {
          continue;
        }

        const hitRadius = clamp(30 - projected.depth * 0.42, 9, 18);
        const dx = projected.x - screenX;
        const dy = projected.y - screenY;
        const pixelDistance = Math.sqrt(dx * dx + dy * dy);
        if (pixelDistance > hitRadius) {
          continue;
        }

        const anchorDx = anchorProjected.x - screenX;
        const anchorDy = anchorProjected.y - screenY;
        const anchorPixelDistance = Math.sqrt(anchorDx * anchorDx + anchorDy * anchorDy);
        const score = pixelDistance
          + anchorPixelDistance * 0.45
          + forwardDepth * 0.16
          + lateralToView * 14
          + (stop.worldPosition.y > 5 ? 1.5 : 0);
        if (score < bestScore) {
          bestStop = stop;
          bestScore = score;
        }
      }

      return bestStop;
    }

    function startTween(targetView, duration) {
      state.tween = {
        from: cloneView(state.orbitCamera),
        to: cloneView(targetView),
        duration: duration || 1.2,
        elapsed: 0
      };
    }

    function advanceTour() {
      if (!state.tour) {
        return;
      }

      state.tour.index = (state.tour.index + 1) % state.tour.sequence.length;
      state.tour.holdTimer = 0;
      const next = state.tour.sequence[state.tour.index];
      startTween(next.view, next.duration);
    }

    function render() {
      ctx.clearRect(0, 0, state.width, state.height);
      drawBackground(ctx, state.width, state.height);

      const camera = buildActiveCamera(state, state.width, state.height);
      const motionFast = state.isDragging || state.tween || state.keys.size > 0 || (state.elapsed - state.lastMotionTime) < 0.12;
      const faces = [];
      for (const face of staticScene.faces) {
        pushRenderableFace(face, faces, camera, 1, motionFast);
      }

      if (state.layers.showCongestion) {
        for (const face of state.cachedCongestionFaces) {
          pushRenderableFace(face, faces, camera, 1, motionFast);
        }
        if (!motionFast) {
          for (const hotspot of state.layers.hotspots) {
            pushRenderableFace(buildHotspotFace(hotspot, state.elapsed), faces, camera, 1, motionFast);
          }
        }
      }

      if (state.layers.showRoute) {
        for (const face of state.cachedRouteFaces) {
          pushRenderableFace(face, faces, camera, 1, motionFast);
        }
        if (!motionFast) {
          pushRenderableFace(buildRouteMarkerFace(state.layers.routePolyline, state.elapsed), faces, camera, 1, motionFast);
        }
      }

      for (const vehicle of state.layers.vehicles || []) {
        for (const face of buildReachTruckFaces(vehicle, state.elapsed)) {
          pushRenderableFace(face, faces, camera, 1, motionFast);
        }
      }

      faces.sort((a, b) => b.depth - a.depth);
      for (const face of faces) {
        drawFace(ctx, face, motionFast);
      }

      const visibleStops = state.layers.lookupStop
        ? [state.layers.lookupStop].concat(state.layers.stops || [])
        : (state.layers.stops || []);
      drawPovClickTargets(
        ctx,
        camera,
        state.cameraMode,
        motionFast,
        state.layers.clickableStops || [],
        state.layers.lookupStop ? state.layers.lookupStop.id : state.layers.selectedStopId
      );
      drawStopMarkers(
        ctx,
        camera,
        motionFast ? visibleStops.filter((stop) => stop && stop.id === (state.layers.lookupStop ? state.layers.lookupStop.id : state.layers.selectedStopId)) : visibleStops,
        state.layers.lookupStop ? state.layers.lookupStop.id : state.layers.selectedStopId
      );
      drawAisleLabels(ctx, camera, warehouse.aisleLabels, state.cameraMode, motionFast);
      drawAreaLabels(ctx, camera, warehouse.areaLabels, state.cameraMode);
    }
  }

  function buildDemoViews() {
    return [
      {
        hold: 3.2,
        duration: 1.4,
        view: cloneView(DEFAULT_VIEW)
      },
      {
        hold: 3,
        duration: 1.3,
        view: {
          target: realPoint(39, 47, 2.8),
          yaw: 2.48,
          pitch: 0.68,
          radius: 78
        }
      },
      {
        hold: 3,
        duration: 1.3,
        view: {
          target: realPoint(55, 17, 2.4),
          yaw: 2.86,
          pitch: 0.6,
          radius: 58
        }
      }
    ];
  }

  function buildWarehouseScene(warehouse) {
    const faces = [];
    const ceilingLights = [];

    buildFloor(faces);
    buildZoneTints(faces, warehouse);
    buildBuildingShell(faces, ceilingLights);
    buildDockArea(faces, warehouse);
    buildStorage(faces, warehouse);
    buildSafetyMarkings(faces, warehouse);

    return { faces, ceilingLights };
  }

  function buildFloor(target) {
    const slab = 10;
    const halfW = WORLD.width / 2;
    const halfD = WORLD.depth / 2;

    for (let x = -halfW; x < halfW; x += slab) {
      for (let z = -halfD; z < halfD; z += slab) {
        const tone = mixColor(PALETTE.floor, PALETTE.floorAlt, pseudoRandom((x + 60) * 7.21 + (z + 88) * 0.91) * 0.42);
        addQuad(target, [
          vec(x, 0, z),
          vec(x + slab, 0, z),
          vec(x + slab, 0, z + slab),
          vec(x, 0, z + slab)
        ], tone, { alpha: 1 });
      }
    }

    addQuad(target, [
      vec(-52, 0.01, -78),
      vec(52, 0.01, -78),
      vec(52, 0.01, -64),
      vec(-52, 0.01, -64)
    ], mixColor(PALETTE.slab, PALETTE.wall, 0.12), { alpha: 0.98 });
  }

  function buildZoneTints(target, warehouse) {
    addFloorRect(target, toSceneX(warehouse.receiving.x0), toSceneZ(warehouse.receiving.y0), warehouse.receiving.x1 - warehouse.receiving.x0, warehouse.receiving.y1 - warehouse.receiving.y0, PALETTE.receiving, 0.16);
    addFloorRect(target, toSceneX(warehouse.centralDock.x0), toSceneZ(warehouse.centralDock.y0), warehouse.centralDock.x1 - warehouse.centralDock.x0, warehouse.centralDock.y1 - warehouse.centralDock.y0, PALETTE.staging, 0.12);
    addFloorRect(target, toSceneX(warehouse.shipping.x0), toSceneZ(warehouse.shipping.y0), warehouse.shipping.x1 - warehouse.shipping.x0, warehouse.shipping.y1 - warehouse.shipping.y0, PALETTE.shipping, 0.16);

    for (const zone of Object.values(warehouse.zones)) {
      const colorValue = zone.key === "kardex"
        ? PALETTE.kardex
        : zone.key === "small"
          ? mixColor(PALETTE.kardex, PALETTE.reserve, 0.45)
          : zone.key === "fast_pick"
            ? PALETTE.fast
            : zone.key === "reserve"
              ? PALETTE.reserve
              : zone.key === "bulk"
                ? PALETTE.bulk
                : PALETTE.overflow;
      addFloorRect(target, toSceneX(zone.x0), toSceneZ(zone.y0), zone.x1 - zone.x0, zone.y1 - zone.y0, colorValue, zone.key === "bulk" ? 0.11 : 0.13);
    }

    addFloorRect(target, toSceneX(warehouse.packaging.x0), toSceneZ(warehouse.packaging.y0), warehouse.packaging.x1 - warehouse.packaging.x0, warehouse.packaging.y1 - warehouse.packaging.y0, PALETTE.staging, 0.18);
    addFloorRect(target, toSceneX(warehouse.operations.x0), toSceneZ(warehouse.operations.y0), warehouse.operations.x1 - warehouse.operations.x0, warehouse.operations.y1 - warehouse.operations.y0, PALETTE.operations, 0.12);
    addFloorRect(target, toSceneX(warehouse.hazmat.x0), toSceneZ(warehouse.hazmat.y0), warehouse.hazmat.x1 - warehouse.hazmat.x0, warehouse.hazmat.y1 - warehouse.hazmat.y0, PALETTE.hazmat, 0.24);
    addFloorRect(target, toSceneX(warehouse.charging.x0), toSceneZ(warehouse.charging.y0), warehouse.charging.x1 - warehouse.charging.x0, warehouse.charging.y1 - warehouse.charging.y0, mixColor(PALETTE.operations, PALETTE.wall, 0.24), 0.18);
  }

  function buildBuildingShell(target, ceilingLights) {
    const halfW = WORLD.width / 2;
    const halfD = WORLD.depth / 2;
    const wallOptions = { stroke: PALETTE.wall, alpha: 1, doubleSided: true, preserveStroke: true };

    addBox(target, -halfW, 0, -halfD, 1.1, WORLD.height, WORLD.depth, PALETTE.wallDark, wallOptions);
    addBox(target, halfW - 1.1, 0, -halfD, 1.1, WORLD.height, WORLD.depth, PALETTE.wallDark, wallOptions);
    addBox(target, -halfW, 0, halfD - 1.1, WORLD.width, WORLD.height, 1.1, PALETTE.wallDark, wallOptions);
    addRealBox(target, 0, 80, 0, 1.1, 5.9, WORLD.height, PALETTE.wallDark, wallOptions);

    for (const segment of [
      { x0: 0, x1: 4 },
      { x0: 10, x1: 12 },
      { x0: 18, x1: 20 },
      { x0: 26, x1: 52 },
      { x0: 57, x1: 59 },
      { x0: 64, x1: 66 },
      { x0: 71, x1: 73 },
      { x0: 78, x1: 80 }
    ]) {
      addRealBox(target, segment.x0, segment.x1, 0, 1.1, 0, 5.8, PALETTE.wallDark, wallOptions);
    }

    for (const door of [
      { x0: 4, x1: 10 },
      { x0: 12, x1: 18 },
      { x0: 20, x1: 26 },
      { x0: 52, x1: 57 },
      { x0: 59, x1: 64 },
      { x0: 66, x1: 71 },
      { x0: 73, x1: 78 }
    ]) {
      addRealBox(target, door.x0, door.x1, 0.72, 1.1, 0.02, 5.8, PALETTE.wall, { alpha: 0.82, stroke: PALETTE.wallDark });
      addRealBox(target, door.x0 + 0.3, door.x1 - 0.3, 0.76, 0.96, 0.45, 5.2, mixColor(PALETTE.wall, PALETTE.sky, 0.35), { alpha: 0.5 });
      addRealBox(target, door.x0 + 0.2, door.x1 - 0.2, 1.18, 1.52, 0.01, 0.16, PALETTE.laneAccent, { alpha: 0.88 });
      addRealBox(target, door.x0 + 0.4, door.x1 - 0.4, -0.8, 0.3, 0.02, 0.12, mixColor(PALETTE.slab, PALETTE.floor, 0.2), { alpha: 0.9 });
    }

    for (let realX = 6; realX <= 74; realX += 11.5) {
      addBox(target, toSceneX(realX) - 0.22, 0, toSceneZ(2.8), 0.44, WORLD.height, 0.44, PALETTE.wall, { alpha: 0.7 });
    }

    for (let realY = 10; realY <= 84; realY += 11.5) {
      addBox(target, -WORLD.width / 2 + 1.1, 12.6, toSceneZ(realY), WORLD.width - 2.2, 0.24, 0.42, PALETTE.roof, { alpha: 0.82 });
    }

    for (let realX = 10; realX <= 70; realX += 12) {
      for (let realY = 14; realY <= 78; realY += 18) {
        addBox(target, toSceneX(realX) - 0.55, 12.15, toSceneZ(realY) - 0.18, 1.1, 0.14, 0.36, PALETTE.lightWarm, { alpha: 0.9 });
        ceilingLights.push({ position: vec(toSceneX(realX), 12.3, toSceneZ(realY)) });
      }
    }
  }

  function buildDockArea(target, warehouse) {
    addPaintedOutline(target, toSceneX(warehouse.receiving.x0), toSceneZ(warehouse.receiving.y0), warehouse.receiving.x1 - warehouse.receiving.x0, warehouse.receiving.y1 - warehouse.receiving.y0, PALETTE.laneAccent, 0.72);
    addPaintedOutline(target, toSceneX(warehouse.centralDock.x0), toSceneZ(warehouse.centralDock.y0), warehouse.centralDock.x1 - warehouse.centralDock.x0, warehouse.centralDock.y1 - warehouse.centralDock.y0, mixColor(PALETTE.laneAccent, PALETTE.wall, 0.18), 0.64);
    addPaintedOutline(target, toSceneX(warehouse.shipping.x0), toSceneZ(warehouse.shipping.y0), warehouse.shipping.x1 - warehouse.shipping.x0, warehouse.shipping.y1 - warehouse.shipping.y0, PALETTE.laneAccent, 0.72);
    addPaintedOutline(target, toSceneX(warehouse.operations.x0), toSceneZ(warehouse.operations.y0), warehouse.operations.x1 - warehouse.operations.x0, warehouse.operations.y1 - warehouse.operations.y0, PALETTE.shipping, 0.68);
    addPaintedOutline(target, toSceneX(warehouse.packaging.x0), toSceneZ(warehouse.packaging.y0), warehouse.packaging.x1 - warehouse.packaging.x0, warehouse.packaging.y1 - warehouse.packaging.y0, PALETTE.laneAccent, 0.52);
    addPaintedOutline(target, toSceneX(warehouse.hazmat.x0), toSceneZ(warehouse.hazmat.y0), warehouse.hazmat.x1 - warehouse.hazmat.x0, warehouse.hazmat.y1 - warehouse.hazmat.y0, PALETTE.trafficHigh, 0.72);
    addPaintedOutline(target, toSceneX(warehouse.charging.x0), toSceneZ(warehouse.charging.y0), warehouse.charging.x1 - warehouse.charging.x0, warehouse.charging.y1 - warehouse.charging.y0, PALETTE.operations, 0.56);
    addStripedPad(target, warehouse.receiving, PALETTE.receiving, 2, 1.1, 0.34);
    addStripedPad(target, warehouse.centralDock, PALETTE.staging, 2, 1.1, 0.26);
    addStripedPad(target, warehouse.shipping, PALETTE.shipping, 2, 1.1, 0.34);
    addStripedPad(target, warehouse.packaging, PALETTE.laneAccent, 5, 2.2, 0.28);
    addStripedPad(target, warehouse.hazmat, PALETTE.trafficHigh, 3, 1.2, 0.28);
    addStripedPad(target, warehouse.charging, PALETTE.operations, 3, 1.6, 0.22);
    addHazmatCage(target, warehouse.hazmat);

    const inboundStacks = createPalletBlock(toSceneX(warehouse.receiving.x0 + 2.4), toSceneZ(warehouse.receiving.y0 + 0.5), 4, 3, 18, true);
    const stagingStacks = createPalletBlock(toSceneX(warehouse.centralDock.x0 + 2.6), toSceneZ(warehouse.centralDock.y0 + 0.4), 4, 2, 27, true);
    const outboundStacks = createPalletBlock(toSceneX(warehouse.shipping.x0 + 1.8), toSceneZ(warehouse.shipping.y0 + 0.5), 6, 3, 23, true);
    for (const stack of inboundStacks.concat(stagingStacks, outboundStacks)) {
      addPalletStackFaces(target, stack, 0.95);
    }

    addRealBox(target, warehouse.operations.x0 + 1.4, warehouse.operations.x1 - 1.2, warehouse.operations.y0 + 3.5, warehouse.operations.y0 + 10.8, 0, 3.7, PALETTE.wallDark, { alpha: 0.36, stroke: PALETTE.wall });
    addPackingStations(target, warehouse.packaging);
    addChargingPads(target, warehouse.charging);
    addZoneBeacon(target, warehouse.receiving, "inbound", PALETTE.receiving);
    addZoneBeacon(target, warehouse.centralDock, "staging", PALETTE.staging);
    addZoneBeacon(target, warehouse.packaging, "packing", PALETTE.laneAccent);
    addZoneBeacon(target, warehouse.shipping, "outbound", PALETTE.shipping);
    addZoneBeacon(target, warehouse.hazmat, "hazmat", PALETTE.trafficHigh);
    addZoneBeacon(target, warehouse.charging, "charging", PALETTE.operations);

    for (const x of [7.0, 15.0, 23.0, 54.5, 61.5, 68.5, 75.5]) {
      addLane(target, toSceneX(x), toSceneZ(warehouse.centralDock.y1 - 0.2), 4.8, 0.18, PALETTE.laneAccent, 0.8);
    }
  }

  function addHazmatCage(target, area) {
    const post = 0.18;
    const rail = 0.12;
    const fenceColor = mixColor(PALETTE.trafficHigh, PALETTE.wall, 0.22);

    addRealBox(target, area.x0 + 0.45, area.x1 - 0.45, area.y0 + 0.45, area.y1 - 0.45, 0.04, 3.4, PALETTE.trafficHigh, {
      alpha: 0.08,
      stroke: PALETTE.trafficHigh
    });

    for (const x of [area.x0 + 0.6, area.x1 - 0.6]) {
      for (let y = area.y0 + 0.6; y <= area.y1 - 0.6; y += 2.8) {
        addRealBox(target, x - post / 2, x + post / 2, y - post / 2, y + post / 2, 0, 3.1, PALETTE.wallDark, { alpha: 0.78 });
      }
    }
    for (const y of [area.y0 + 0.6, area.y1 - 0.6]) {
      for (let x = area.x0 + 0.6; x <= area.x1 - 0.6; x += 2.8) {
        addRealBox(target, x - post / 2, x + post / 2, y - post / 2, y + post / 2, 0, 3.1, PALETTE.wallDark, { alpha: 0.78 });
      }
    }

    addRealBox(target, area.x0 + 0.6, area.x1 - 0.6, area.y0 + 0.52, area.y0 + 0.52 + rail, 1.1, 1.24, fenceColor, { alpha: 0.84 });
    addRealBox(target, area.x0 + 0.6, area.x1 - 0.6, area.y1 - 0.64, area.y1 - 0.64 + rail, 1.1, 1.24, fenceColor, { alpha: 0.84 });
    addRealBox(target, area.x0 + 0.52, area.x0 + 0.52 + rail, area.y0 + 0.6, area.y1 - 0.6, 1.1, 1.24, fenceColor, { alpha: 0.84 });
    addRealBox(target, area.x1 - 0.64, area.x1 - 0.64 + rail, area.y0 + 0.6, area.y1 - 0.6, 1.1, 1.24, fenceColor, { alpha: 0.84 });

    addRealBox(target, area.x0 + 0.8, area.x1 - 0.8, area.y0 + 0.8, area.y0 + 1.15, 0.02, 0.12, PALETTE.trafficHigh, { alpha: 0.9 });
    addRealBox(target, area.x0 + 0.8, area.x1 - 0.8, area.y1 - 1.15, area.y1 - 0.8, 0.02, 0.12, PALETTE.trafficHigh, { alpha: 0.9 });
  }

  function buildStorage(target, warehouse) {
    buildZoneRows(target, warehouse, warehouse.zones.kardex, {
      type: "kardex",
      depth: 0.82,
      height: warehouse.zones.kardex.height,
      levels: 8,
      density: 0.22
    });

    buildZoneRows(target, warehouse, warehouse.zones.small, {
      type: "shelf",
      depth: 0.7,
      height: warehouse.zones.small.height,
      levels: 8,
      density: 0.48
    });

    buildZoneRows(target, warehouse, warehouse.zones.fast_pick, {
      type: "pallet",
      depth: warehouse.rackDepth,
      height: warehouse.zones.fast_pick.height,
      levels: warehouse.zones.fast_pick.levels,
      density: warehouse.zones.fast_pick.density,
      lowProfile: true
    });

    buildZoneRows(target, warehouse, warehouse.zones.reserve, {
      type: "pallet",
      depth: warehouse.rackDepth,
      height: warehouse.zones.reserve.height,
      levels: warehouse.zones.reserve.levels,
      density: warehouse.zones.reserve.density
    });

    buildZoneRows(target, warehouse, warehouse.zones.bulk, {
      type: "pallet",
      depth: warehouse.rackDepth,
      height: warehouse.zones.bulk.height,
      levels: warehouse.zones.bulk.levels,
      density: warehouse.zones.bulk.density
    });

    buildZoneRows(target, warehouse, warehouse.zones.overflow, {
      type: "pallet",
      depth: warehouse.rackDepth,
      height: warehouse.zones.overflow.height,
      levels: warehouse.zones.overflow.levels,
      density: warehouse.zones.overflow.density
    });

    addRealBox(target, warehouse.hazmat.x0, warehouse.hazmat.x1, warehouse.hazmat.y0, warehouse.hazmat.y1, 0, 4.2, PALETTE.hazmat, { alpha: 0.18, stroke: PALETTE.trafficHigh });
  }

  function buildZoneRows(target, warehouse, zone, options) {
    const rowInset = options.type === "kardex" || options.type === "shelf" ? 0.45 : 0.7;
    const rowY0 = (Number.isFinite(zone.rackY0) ? zone.rackY0 : zone.y0 + rowInset);
    const rowY1 = (Number.isFinite(zone.rackY1) ? zone.rackY1 : zone.y1 - rowInset);
    const rowLength = Math.max(rowY1 - rowY0, 1.8);
    const rowXs = Array.isArray(zone.displayRows) && zone.displayRows.length ? zone.displayRows : zone.aisles;
    const mirrorRows = !(Array.isArray(zone.displayRows) && zone.displayRows.length);

    for (const aisleX of rowXs) {
      const faceOffset = options.type === "kardex"
        ? warehouse.kardexFaceOffset
        : options.type === "shelf"
          ? warehouse.smallFaceOffset
          : warehouse.palletFaceOffset;

      if (options.type === "kardex" || options.type === "shelf") {
        if (mirrorRows) {
          addVerticalModuleRow(target, toSceneX(aisleX - faceOffset), toSceneZ(rowY0), rowLength, options.depth, options.height, options.levels, options.type, options.density);
          addVerticalModuleRow(target, toSceneX(aisleX + faceOffset), toSceneZ(rowY0), rowLength, options.depth, options.height, options.levels, options.type, options.density);
        } else {
          addVerticalModuleRow(target, toSceneX(aisleX), toSceneZ(rowY0), rowLength, options.depth, options.height, options.levels, options.type, options.density);
        }
      } else {
        if (mirrorRows) {
          addRackRow(target, {
            x: toSceneX(aisleX - faceOffset),
            zStart: toSceneZ(rowY0),
            length: rowLength,
            depth: options.depth,
            height: options.height,
            bays: Math.max(1, Math.floor(rowLength / 2.7)),
            levels: options.levels,
            zoneKey: zone.key,
            density: options.density,
            lowProfile: !!options.lowProfile
          });
          addRackRow(target, {
            x: toSceneX(aisleX + faceOffset),
            zStart: toSceneZ(rowY0),
            length: rowLength,
            depth: options.depth,
            height: options.height,
            bays: Math.max(1, Math.floor(rowLength / 2.7)),
            levels: options.levels,
            zoneKey: zone.key,
            density: options.density,
            lowProfile: !!options.lowProfile
          });
        } else {
          addRackRow(target, {
            x: toSceneX(aisleX),
            zStart: toSceneZ(rowY0),
            length: rowLength,
            depth: options.depth * 0.8,
            height: options.height,
            bays: Math.max(1, Math.floor(rowLength / 2.7)),
            levels: options.levels,
            zoneKey: zone.key,
            density: options.density,
            lowProfile: !!options.lowProfile
          });
        }
      }
    }

    addShadowRect(target, toSceneX(zone.x0 + 0.6), toSceneZ(zone.y0 + 0.4), zone.x1 - zone.x0 - 1.2, zone.y1 - zone.y0 - 0.8, 0.06);
  }

  function buildSafetyMarkings(target, warehouse) {
    addLane(target, toSceneX(1.1), toSceneZ(5), WALL_CLEARANCE, 82.5, PALETTE.lane, 0.1);
    addPaintedOutline(target, toSceneX(1.1), toSceneZ(5), WALL_CLEARANCE, 82.5, PALETTE.laneAccent, 0.22);
    addLane(target, toSceneX(0), toSceneZ(84.5), 70, WALL_CLEARANCE, PALETTE.lane, 0.08);
    addPaintedOutline(target, toSceneX(0), toSceneZ(84.5), 70, WALL_CLEARANCE, PALETTE.laneAccent, 0.18);

    addLane(target, toSceneX(warehouse.crossAisle.x0), toSceneZ(warehouse.crossAisle.y0), warehouse.crossAisle.x1 - warehouse.crossAisle.x0, warehouse.crossAisle.y1 - warehouse.crossAisle.y0, PALETTE.lane, 0.2);
    addPaintedOutline(target, toSceneX(warehouse.crossAisle.x0), toSceneZ(warehouse.crossAisle.y0), warehouse.crossAisle.x1 - warehouse.crossAisle.x0, warehouse.crossAisle.y1 - warehouse.crossAisle.y0, PALETTE.laneAccent, 0.7);

    for (const zone of Object.values(warehouse.zones)) {
      const outline = zone.key === "kardex"
        ? PALETTE.kardex
        : zone.key === "fast_pick"
          ? PALETTE.fast
          : zone.key === "reserve"
            ? PALETTE.reserve
            : zone.key === "bulk"
              ? mixColor(PALETTE.bulk, PALETTE.lane, 0.2)
              : PALETTE.overflow;
      addPaintedOutline(target, toSceneX(zone.x0), toSceneZ(zone.y0), zone.x1 - zone.x0, zone.y1 - zone.y0, outline, 0.34);
    }

    for (const x of warehouse.routeAisles) {
      addLane(target, toSceneX(x) - 0.12, toSceneZ(warehouse.routeAnchors.front), 0.24, warehouse.routeAnchors.rear - warehouse.routeAnchors.front, PALETTE.lane, 0.08);
    }
  }

  function addPackingStations(target, area) {
    for (let x = area.x0 + 2.2; x <= area.x1 - 3.2; x += 6.4) {
      addRealBox(target, x, x + 2.8, area.y0 + 2.2, area.y0 + 3.4, 0, 1.02, PALETTE.wallDark, { alpha: 0.78, stroke: PALETTE.wall });
      addRealBox(target, x + 0.2, x + 2.6, area.y0 + 2.35, area.y0 + 3.25, 1.02, 1.18, mixColor(PALETTE.wall, PALETTE.lane, 0.2), { alpha: 0.86 });
      addRealBox(target, x + 0.22, x + 0.38, area.y0 + 2.28, area.y0 + 3.32, 0, 1.7, PALETTE.wallDark, { alpha: 0.6 });
      addRealBox(target, x + 2.42, x + 2.58, area.y0 + 2.28, area.y0 + 3.32, 0, 1.7, PALETTE.wallDark, { alpha: 0.6 });
    }
  }

  function addChargingPads(target, area) {
    for (let y = area.y0 + 1.8; y <= area.y1 - 2.6; y += 3.6) {
      addRealBox(target, area.x0 + 0.8, area.x1 - 0.9, y, y + 1.4, 0.02, 0.08, mixColor(PALETTE.operations, PALETTE.laneAccent, 0.35), { alpha: 0.85 });
      addRealBox(target, area.x0 + 1.2, area.x0 + 2.2, y + 0.24, y + 1.16, 0.08, 1.1, PALETTE.truckDark, { alpha: 0.88 });
    }
  }

  function addStripedPad(target, area, colorValue, count, bandDepth, alpha) {
    const usableWidth = Math.max(area.x1 - area.x0 - 1.4, 2);
    const gap = Math.max(((area.y1 - area.y0) - count * bandDepth) / Math.max(count + 1, 1), 0.8);
    for (let i = 0; i < count; i += 1) {
      const y = area.y0 + gap * (i + 1) + bandDepth * i;
      addLane(target, toSceneX(area.x0 + 0.7), toSceneZ(y), usableWidth, Math.min(bandDepth, area.y1 - y - 0.4), colorValue, alpha);
    }
  }

  function addZoneBeacon(target, area, kind, colorValue) {
    const cx = (area.x0 + area.x1) * 0.5;
    const cy = area.y0 + Math.min(2.8, Math.max((area.y1 - area.y0) * 0.18, 1.8));
    addRealBox(target, cx - 0.12, cx + 0.12, cy - 0.12, cy + 0.12, 0, 5.8, PALETTE.wallDark, { alpha: 0.72 });
    addRealBox(target, cx - 1.65, cx + 1.65, cy - 0.5, cy + 0.5, 4.35, 5.35, mixColor(colorValue, PALETTE.wall, 0.22), { alpha: 0.92, stroke: PALETTE.wallDark });

    if (kind === "packing") {
      addRealBox(target, cx - 2.2, cx + 2.2, cy + 2.1, cy + 2.5, 0, 0.22, mixColor(colorValue, PALETTE.lane, 0.15), { alpha: 0.85 });
    } else if (kind === "hazmat") {
      addRealBox(target, area.x0 + 0.5, area.x1 - 0.5, area.y0 + 0.45, area.y0 + 0.9, 0, 0.18, PALETTE.trafficHigh, { alpha: 0.9 });
    } else if (kind === "charging") {
      addRealBox(target, area.x0 + 0.7, area.x1 - 0.7, area.y0 + 0.55, area.y0 + 1.05, 0, 0.16, mixColor(PALETTE.operations, PALETTE.laneAccent, 0.3), { alpha: 0.82 });
    }
  }

  function drawBackground(ctx, width, height) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(228, 232, 228, 0.94)");
    gradient.addColorStop(0.42, "rgba(187, 194, 189, 0.72)");
    gradient.addColorStop(1, "rgba(62, 69, 73, 0.84)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const bloom = ctx.createRadialGradient(width * 0.46, height * 0.18, 20, width * 0.46, height * 0.18, Math.max(width, height) * 0.8);
    bloom.addColorStop(0, "rgba(255,255,255,0.32)");
    bloom.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, width, height);
  }

  function buildRouteStripFaces(points, colorValue) {
    if (!points || points.length < 2) {
      return [];
    }

    const faces = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const direction = normalize(vec(b.x - a.x, 0, b.z - a.z));
      const perpendicular = vec(-direction.z, 0, direction.x);
      const half = 0.44;
      faces.push(makeFace([
        add(a, scale(perpendicular, half)),
        add(b, scale(perpendicular, half)),
        add(b, scale(perpendicular, -half)),
        add(a, scale(perpendicular, -half))
      ], colorValue, { alpha: 0.9, stroke: mixColor(colorValue, PALETTE.lane, 0.08) }));

      faces.push(makeFace([
        add(a, scale(perpendicular, 0.1)),
        add(b, scale(perpendicular, 0.1)),
        add(b, scale(perpendicular, -0.1)),
        add(a, scale(perpendicular, -0.1))
      ], PALETTE.lane, { alpha: 0.76 }));
    }

    return faces;
  }

  function buildRouteMarkerFace(points, elapsed) {
    if (!points || points.length < 2) {
      return null;
    }

    const marker = pointAlongRoute(points, (elapsed * 6) % Math.max(routeLength(points), 1));
    return makeDiscFace(marker.x, 0.08, marker.z, 0.62, PALETTE.lane, 0.78, 0);
  }

  function buildCongestionFaces(edges) {
    const faces = [];
    for (const edge of edges || []) {
      const width = 0.22 + edge.intensity * 0.48;
      const colorValue = mixColor(PALETTE.trafficLow, PALETTE.trafficHigh, edge.intensity);
      const a = edge.points[0];
      const b = edge.points[1];
      const direction = normalize(vec(b.x - a.x, 0, b.z - a.z));
      const perpendicular = vec(-direction.z, 0, direction.x);
      faces.push(makeFace([
        add(a, scale(perpendicular, width)),
        add(b, scale(perpendicular, width)),
        add(b, scale(perpendicular, -width)),
        add(a, scale(perpendicular, -width))
      ], colorValue, { alpha: 0.24 + edge.intensity * 0.28 }));
    }
    return faces;
  }

  function buildHotspotFace(hotspot, elapsed) {
    const radius = hotspot.radius * (0.94 + Math.sin(elapsed * 4 + hotspot.point.x) * 0.08);
    return makeDiscFace(hotspot.point.x, 0.09, hotspot.point.z, radius, mixColor(PALETTE.trafficHigh, PALETTE.trafficLow, 0.15), 0.18 + hotspot.intensity * 0.26, 1.2);
  }

  function buildReachTruckFaces(vehicle, elapsed) {
    if (!vehicle.path || vehicle.path.length < 2) {
      return [];
    }

    const totalLength = routeLength(vehicle.path);
    const distanceValue = ((elapsed * vehicle.speed + vehicle.offset * totalLength) % totalLength + totalLength) % totalLength;
    const pose = poseAlongRoute(vehicle.path, distanceValue);
    const yaw = Math.atan2(pose.direction.x, pose.direction.z);
    const liftHeight = 0.3 + Math.max(0, Math.sin(elapsed * 1.8 + vehicle.offset * 7)) * vehicle.lift;

    const parts = [];
    pushOrientedBox(parts, pose.point, 1.08, 0.95, 1.9, yaw, 0.38, PALETTE.truckBody, { stroke: PALETTE.truckDark });
    pushOrientedBox(parts, add(pose.point, rotateXZ(vec(0, 1.9, -0.72), yaw)), 0.2, 3.0 + liftHeight, 0.18, yaw, 1.08, PALETTE.truckDark, {});
    pushOrientedBox(parts, add(pose.point, rotateXZ(vec(-0.18, 0.16, -1.18), yaw)), 0.08, 0.12, 1.42, yaw, 0.06, PALETTE.truckDark, {});
    pushOrientedBox(parts, add(pose.point, rotateXZ(vec(0.18, 0.16, -1.18), yaw)), 0.08, 0.12, 1.42, yaw, 0.06, PALETTE.truckDark, {});
    pushOrientedBox(parts, add(pose.point, rotateXZ(vec(0, 1.24, 0.12), yaw)), 0.82, 0.34, 0.82, yaw, 0.18, mixColor(PALETTE.truckBody, PALETTE.lane, 0.2), {});
    return parts;
  }

  function buildReachTruckGlow(vehicle, elapsed) {
    if (!vehicle.path || vehicle.path.length < 2) {
      return null;
    }

    const totalLength = routeLength(vehicle.path);
    const distanceValue = ((elapsed * vehicle.speed + vehicle.offset * totalLength) % totalLength + totalLength) % totalLength;
    const pose = poseAlongRoute(vehicle.path, distanceValue);
    return {
      position: vec(pose.point.x, 0.72, pose.point.z),
      color: PALETTE.laneAccent,
      alpha: 0.12,
      radius: 1.8
    };
  }

  function drawStopMarkers(ctx, camera, stops, selectedStopId) {
    for (const stop of stops) {
      const anchor = projectPoint(stop.accessPoint, camera);
      const projected = projectPoint(stop.worldPosition, camera);
      if (!anchor || !projected) {
        continue;
      }

      const selected = stop.id === selectedStopId;
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(projected.x, projected.y);
      ctx.strokeStyle = selected ? "rgba(255, 246, 211, 0.92)" : "rgba(255, 243, 205, 0.62)";
      ctx.lineWidth = selected ? 2 : 1.2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, selected ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = selected ? "rgba(255, 244, 208, 0.95)" : "rgba(237, 220, 162, 0.8)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(projected.x, projected.y, selected ? 10 : 7, 0, Math.PI * 2);
      ctx.fillStyle = selected ? "rgba(255, 233, 170, 0.94)" : "rgba(236, 219, 171, 0.8)";
      ctx.fill();

      if (selected) {
        ctx.beginPath();
        ctx.arc(projected.x, projected.y, 15, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 252, 239, 0.84)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  function drawPovClickTargets(ctx, camera, cameraMode, motionFast, stops, activeStopId) {
    if (cameraMode !== "pov" || !stops || !stops.length) {
      return;
    }

    const visible = [];
    for (const stop of stops) {
      const projected = projectPoint(stop.worldPosition, camera);
      if (!projected || projected.depth < 1.2 || projected.depth > (motionFast ? 24 : 34)) {
        continue;
      }
      if (projected.x < -8 || projected.x > camera.width + 8 || projected.y < -8 || projected.y > camera.height + 8) {
        continue;
      }

      const radius = stop.id === activeStopId
        ? clamp(4.8 - projected.depth * 0.05, 2.1, 4)
        : clamp(3.4 - projected.depth * 0.045, 1.2, 2.6);
      visible.push({
        stop,
        projected,
        radius,
        active: stop.id === activeStopId
      });
    }

    visible.sort(function (a, b) {
      if (a.active !== b.active) {
        return a.active ? -1 : 1;
      }
      return a.projected.depth - b.projected.depth;
    });

    ctx.save();
    for (const target of visible) {
      const x = target.projected.x;
      const y = target.projected.y;

      ctx.beginPath();
      ctx.arc(x, y, target.radius, 0, Math.PI * 2);
      ctx.fillStyle = target.active
        ? "rgba(236, 214, 152, 0.92)"
        : (motionFast ? "rgba(239, 233, 219, 0.36)" : "rgba(239, 233, 219, 0.52)");
      ctx.fill();

      if (target.active) {
        ctx.beginPath();
        ctx.arc(x, y, target.radius + 3.4, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 246, 215, 0.92)";
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawAisleLabels(ctx, camera, labels, cameraMode, motionFast) {
    if (!labels || !labels.length) {
      return;
    }

    const visible = [];
    for (const label of labels) {
      const projected = projectPoint(label.position, camera);
      if (!projected || projected.depth < 3 || projected.depth > (cameraMode === "pov" ? 58 : 138)) {
        continue;
      }
      visible.push({
        text: label.text,
        projected
      });
    }

    visible.sort(function (a, b) {
      const rowDelta = a.projected.y - b.projected.y;
      if (Math.abs(rowDelta) > 10) {
        return rowDelta;
      }
      return a.projected.x - b.projected.x;
    });

    const minSpacing = cameraMode === "pov" ? 20 : 14;
    const placed = [];
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = cameraMode === "pov" ? "600 12px Segoe UI, Arial, sans-serif" : "600 11px Segoe UI, Arial, sans-serif";

    for (const label of visible) {
      const overlaps = placed.some(function (existing) {
        return Math.abs(existing.x - label.projected.x) < minSpacing && Math.abs(existing.y - label.projected.y) < 12;
      });
      if (overlaps) {
        continue;
      }

      placed.push({ x: label.projected.x, y: label.projected.y });
      const scale = clamp(145 / label.projected.depth, 0.75, 1.2);
      const alpha = motionFast
        ? clamp(0.26 + scale * 0.1, 0.24, 0.38)
        : clamp(0.34 + scale * 0.12, 0.32, 0.5);
      const boxWidth = cameraMode === "pov" ? 32 : 28;
      const boxHeight = cameraMode === "pov" ? 18 : 16;
      const x = label.projected.x;
      const y = label.projected.y;

      ctx.fillStyle = `rgba(248, 244, 232, ${alpha})`;
      roundRect(ctx, x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight, 5);
      ctx.fill();

      ctx.strokeStyle = motionFast ? "rgba(118, 110, 95, 0.22)" : "rgba(118, 110, 95, 0.34)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = motionFast ? "rgba(78, 72, 61, 0.72)" : "rgba(70, 64, 55, 0.82)";
      ctx.fillText(label.text, x, y + 0.5);
    }

    ctx.restore();
  }

  function drawAreaLabels(ctx, camera, labels, cameraMode) {
    if (!labels || !labels.length || cameraMode === "pov") {
      return;
    }

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 12px Segoe UI, Arial, sans-serif";
    for (const label of labels) {
      const projected = projectPoint(label.position, camera);
      if (!projected || projected.depth < 8 || projected.depth > 150) {
        continue;
      }
      ctx.fillStyle = "rgba(248, 244, 233, 0.66)";
      roundRect(ctx, projected.x - 50, projected.y - 13, 100, 26, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(129, 119, 102, 0.34)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "rgba(71, 67, 58, 0.92)";
      ctx.fillText(label.text, projected.x, projected.y + 0.5);
    }
    ctx.restore();
  }

  function drawCeilingLights(ctx, camera, ceilingLights) {
    for (const light of ceilingLights) {
      const projected = projectPoint(light.position, camera);
      if (!projected || projected.depth < 1) {
        continue;
      }

      const radius = clamp(250 / projected.depth, 2.2, 11);
      const glow = ctx.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, radius * 4.5);
      glow.addColorStop(0, "rgba(255, 228, 186, 0.26)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(projected.x - radius * 5, projected.y - radius * 5, radius * 10, radius * 10);

      ctx.beginPath();
      ctx.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 229, 182, 0.76)";
      ctx.fill();
    }
  }

  function drawProjectedGlow(ctx, glow, camera) {
    if (!glow) {
      return;
    }

    const projected = projectPoint(glow.position, camera);
    if (!projected) {
      return;
    }

    const radius = clamp(glow.radius * 118 / projected.depth, 5, 28);
    const gradient = ctx.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, radius);
    gradient.addColorStop(0, withAlpha(glow.color, glow.alpha));
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(projected.x - radius, projected.y - radius, radius * 2, radius * 2);
  }

  function pushRenderableFace(face, collector, camera, alphaMultiplier, motionFast) {
    if (!face) {
      return;
    }
    const alpha = (face.alpha == null ? 1 : face.alpha) * alphaMultiplier;
    if (alpha <= 0.01) {
      return;
    }

    const toCamera = sub(camera.position, face.center);
    if (!face.doubleSided && face.glow <= 0 && dot(face.normal, toCamera) <= 0.01) {
      return;
    }

    const projected = projectFace(face.vertices, camera);
    if (!projected) {
      return;
    }

    if (motionFast && projected.depth > 72 && projected.screenArea < (face.doubleSided ? 20 : 32)) {
      return;
    }

    if (projected.depth > 110 && projected.screenArea < (face.doubleSided ? 8 : 18)) {
      return;
    }

    const lightDir = normalize(vec(-0.42, 1, -0.2));
    const diffuse = Math.abs(dot(face.normal, lightDir));
    const shade = 0.36 + diffuse * 0.56;
    const fogAmount = smoothstep(44, 140, projected.depth) * 0.12;
    const litColor = mixColor(scaleColor(face.color, shade), PALETTE.fog, fogAmount);

    collector.push({
      points: projected.points,
      depth: projected.depth,
      color: litColor,
      stroke: projected.depth > (motionFast ? 46 : (face.doubleSided ? 125 : 90)) ? null : (face.stroke || null),
      alpha,
      glow: face.glow || 0,
      preserveStroke: !!face.preserveStroke
    });
  }

  function drawFace(ctx, face, motionFast) {
    ctx.beginPath();
    ctx.moveTo(face.points[0].x, face.points[0].y);
    for (let i = 1; i < face.points.length; i += 1) {
      ctx.lineTo(face.points[i].x, face.points[i].y);
    }
    ctx.closePath();

    if (!motionFast && face.glow > 0.24) {
      ctx.shadowColor = withAlpha(face.color, Math.min(face.alpha * 0.85, 0.7));
      ctx.shadowBlur = 18 * face.glow;
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = withAlpha(face.color, face.alpha);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (face.stroke && (!motionFast || face.preserveStroke)) {
      ctx.strokeStyle = withAlpha(face.stroke, Math.min(face.alpha * 0.7, 0.5));
      ctx.lineWidth = face.preserveStroke ? 0.9 : 0.7;
      ctx.stroke();
    }
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width * 0.5, height * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.arcTo(x + width, y, x + width, y + r, r);
    ctx.lineTo(x + width, y + height - r);
    ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
    ctx.lineTo(x + r, y + height);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function buildCamera(position, target, width, height) {
    const forward = normalize(sub(target, position));
    const right = normalize(cross(forward, vec(0, 1, 0)));
    const up = normalize(cross(right, forward));
    return {
      position,
      target,
      forward,
      right,
      up,
      focalLength: height * 0.92,
      width,
      height,
      near: 0.2
    };
  }

  function buildActiveCamera(state, width, height) {
    if (state.cameraMode === "pov") {
      const direction = directionFromAngles(state.povCamera.yaw, state.povCamera.pitch);
      return buildCamera(
        state.povCamera.position,
        add(state.povCamera.position, scale(direction, 10)),
        width,
        height
      );
    }

    const cameraPosition = orbitPosition(state.orbitCamera);
    return buildCamera(cameraPosition, state.orbitCamera.target, width, height);
  }

  function orbitPosition(view) {
    const cosPitch = Math.cos(view.pitch);
    return vec(
      view.target.x + Math.sin(view.yaw) * cosPitch * view.radius,
      view.target.y + Math.sin(view.pitch) * view.radius,
      view.target.z + Math.cos(view.yaw) * cosPitch * view.radius
    );
  }

  function cloneView(view) {
    return {
      target: vec(view.target.x, view.target.y, view.target.z),
      yaw: view.yaw,
      pitch: view.pitch,
      radius: view.radius
    };
  }

  function clonePovView(view) {
    return {
      position: vec(view.position.x, view.position.y, view.position.z),
      yaw: view.yaw,
      pitch: view.pitch
    };
  }

  function directionFromAngles(yaw, pitch) {
    const cosPitch = Math.cos(pitch);
    return normalize(vec(
      Math.sin(yaw) * cosPitch,
      Math.sin(pitch),
      Math.cos(yaw) * cosPitch
    ));
  }

  function buildNavigationSegments(zones, anchors, transferYs) {
      const segments = [];

      const frontZones = ["kardex", "small", "fast_pick", "reserve"];
      const rearZones = ["bulk", "overflow"];

      function addVertical(x, y0, y1) {
        if (!Number.isFinite(x) || !Number.isFinite(y0) || !Number.isFinite(y1) || y1 <= y0) {
          return;
        }
        segments.push({
          a: realPoint(x, y0, 1.72),
          b: realPoint(x, y1, 1.72)
        });
      }

      function addHorizontal(xs, y) {
        const walk = uniqueSorted(xs || []);
        if (!walk.length || !Number.isFinite(y)) {
          return;
        }
        segments.push({
          a: realPoint(walk[0], y, 1.72),
          b: realPoint(walk[walk.length - 1], y, 1.72)
        });
      }

      for (const key of frontZones.concat(rearZones)) {
        const zone = zones[key];
        if (!zone) {
          continue;
        }
        for (const x of zone.walkAisles || []) {
          addVertical(x, zone.y0 + 0.05, zone.y1 - 0.05);
        }

        const zoneWalk = uniqueSorted(zone.walkAisles || []);
        const localFrontY = clamp(
          Number.isFinite(zone.rackY0) ? zone.rackY0 - 1.1 : zone.y0 + 1.2,
          zone.y0 + 0.6,
          zone.y1 - 0.9
        );
        const localRearY = clamp(
          Number.isFinite(zone.rackY1) ? zone.rackY1 + 1.1 : zone.y1 - 1.2,
          zone.y0 + 0.9,
          zone.y1 - 0.6
        );

        if (zoneWalk.length > 1) {
          addHorizontal(zoneWalk, localFrontY);
          if (Math.abs(localRearY - localFrontY) > 0.8) {
            addHorizontal(zoneWalk, localRearY);
          }
        }
      }

      const frontWalk = uniqueSorted(frontZones.flatMap(function (key) {
        return (zones[key] && zones[key].walkAisles) || [];
    }));
      const rearWalk = uniqueSorted(rearZones.flatMap(function (key) {
        return (zones[key] && zones[key].walkAisles) || [];
      }));

      addHorizontal(frontWalk, (transferYs || [anchors.front])[0]);
      addHorizontal(frontWalk, 25);

      const middleY = (transferYs || [anchors.front, anchors.middle])[1];
      const combinedWalk = uniqueSorted(frontWalk.concat(rearWalk));
      addHorizontal(combinedWalk, middleY);
      addHorizontal(rearWalk, 69.5);
      addHorizontal((zones.overflow && zones.overflow.walkAisles) || [], 84.5);

      return segments;
    }

  function buildAisleLabels(routeAisles, rows) {
    const clustered = clusterLabelAisles(routeAisles, 1.2);
    const labels = [];
    for (let index = 0; index < clustered.length; index += 1) {
      const x = clustered[index];
      const text = `A${String(index + 1).padStart(2, "0")}`;
      for (const y of rows || []) {
        labels.push({ text, position: realPoint(x, y, 11.35) });
      }
    }
    return labels;
  }

  function buildAreaLabels(items) {
    return Object.values(items).map(function (item) {
      return {
        text: item.label,
        position: realPoint(item.x, item.y, 4.8)
      };
    });
  }

  function clusterLabelAisles(values, minGap) {
    const sorted = uniqueSorted(values);
    const clustered = [];
    for (const value of sorted) {
      const last = clustered[clustered.length - 1];
      if (last == null || Math.abs(value - last) > minGap) {
        clustered.push(value);
      } else {
        clustered[clustered.length - 1] = roundTo((last + value) * 0.5, 2);
      }
    }
    return clustered;
  }

  function constrainPovPosition(candidate, warehouse) {
    let bestPoint = clonePoint(candidate);
    let bestDistance = Infinity;
    for (const segment of warehouse.navigationSegments || []) {
      const point = nearestPointOnSegment(candidate, segment.a, segment.b);
      const delta = distance(point, candidate);
      if (delta < bestDistance) {
        bestDistance = delta;
        bestPoint = point;
      }
    }
    bestPoint.y = 1.72;
    return bestPoint;
  }

  function nearestPointOnSegment(point, a, b) {
    const ab = sub(b, a);
    const ap = sub(point, a);
    const denom = dot(ab, ab) || 1;
    const t = clamp(dot(ap, ab) / denom, 0, 1);
    return add(a, scale(ab, t));
  }

  function clonePoint(point) {
    return vec(point.x, point.y, point.z);
  }

  function isTypingTarget(target) {
    if (!target || !target.tagName) {
      return false;
    }
    const tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || target.isContentEditable;
  }

  function addVerticalModuleRow(target, x, zStart, length, depth, height, levels, type, density) {
    const bays = Math.max(1, Math.floor(length / 2.7));
    const renderBays = Math.max(1, Math.ceil(bays / 2));
    const bayLength = length / renderBays;
    for (let bay = 0; bay < renderBays; bay += 1) {
      const z = zStart + bay * bayLength;
      addBox(target, x - depth / 2, 0, z, depth, height, bayLength - 0.14, type === "kardex" ? PALETTE.kardex : PALETTE.rackShelf, {
        stroke: PALETTE.rackShelf,
        alpha: 0.96,
        preserveStroke: true,
        doubleSided: true
      });
      addBox(target, x - depth / 2 + 0.08, 0.4, z + 0.16, depth - 0.16, height - 0.74, bayLength - 0.46, PALETTE.truckDark, { alpha: 0.26 });

      for (let level = 0; level < levels; level += 1) {
        if (pseudoRandom(x * 0.19 + bay * 5.1 + level * 1.9) > density * 0.8) {
          continue;
        }
        const itemHeight = type === "kardex" ? 0.46 : 0.24;
        const levelStep = type === "kardex" ? 1.02 : 0.86;
        addBox(target, x - depth / 2 + 0.11, 0.46 + level * levelStep, z + 0.22, depth - 0.22, itemHeight, bayLength - 0.58, pickCargoColor(x + bay + level), {
          alpha: 0.8
        });
      }
    }
  }

  function addRackRow(target, options) {
    const columnSize = 0.14;
    const bayLength = options.length / options.bays;
    const columnStep = options.bays > 6 ? 2 : 1;
    for (let i = 0; i <= options.bays; i += columnStep) {
      const z = options.zStart + i * bayLength;
      addBox(target, options.x - options.depth / 2, 0, z - columnSize / 2, columnSize, options.height, columnSize, PALETTE.rackFrame, { stroke: PALETTE.rackShelf, preserveStroke: true, doubleSided: true });
      addBox(target, options.x + options.depth / 2 - columnSize, 0, z - columnSize / 2, columnSize, options.height, columnSize, PALETTE.rackFrame, { stroke: PALETTE.rackShelf, preserveStroke: true, doubleSided: true });
    }

    addBox(target, options.x - options.depth / 2, options.height - 0.18, options.zStart - 0.06, options.depth, 0.14, options.length + 0.12, PALETTE.rackShelf, { preserveStroke: true, doubleSided: true });

    for (let level = 0; level < options.levels; level += 1) {
      const y = options.lowProfile ? 1.82 + level * 2.05 : 2.32 + level * 2.72;
      addBox(target, options.x - options.depth / 2, y, options.zStart + 0.08, 0.12, 0.16, options.length - 0.18, PALETTE.rackBeam, { stroke: PALETTE.rackShelf, preserveStroke: true, doubleSided: true });
      addBox(target, options.x + options.depth / 2 - 0.12, y, options.zStart + 0.08, 0.12, 0.16, options.length - 0.18, PALETTE.rackBeam, { stroke: PALETTE.rackShelf, preserveStroke: true, doubleSided: true });
    }

    const cargoStep = options.bays > 6 ? 2 : 1;
    for (let bay = 0; bay < options.bays; bay += cargoStep) {
      const z = options.zStart + bay * bayLength;
      if (pseudoRandom(options.x * 0.33 + bay * 3.7 + options.height) < options.density) {
        const palletColor = pickCargoColor(bay + options.x);
        addBox(target, options.x - options.depth * 0.36, 0.34, z + 0.44, options.depth * 0.72, 0.14, 0.96, PALETTE.palletWood, {});
        addBox(target, options.x - options.depth * 0.42, 0.48, z + 0.3, options.depth * 0.84, options.lowProfile ? 0.74 : 1.16, 1.18, palletColor, {
          stroke: PALETTE.rackShelf
        });
      }

      if (!options.lowProfile && pseudoRandom(options.x * 1.1 + bay * 5.3 + 4) < options.density * 0.68) {
        const palletColor = pickCargoColor(bay + options.x + 8);
        addBox(target, options.x - options.depth * 0.36, 2.66, z + 0.44, options.depth * 0.72, 0.14, 0.96, PALETTE.palletWood, {});
        addBox(target, options.x - options.depth * 0.42, 2.8, z + 0.3, options.depth * 0.84, 0.98, 1.18, palletColor, { stroke: PALETTE.rackShelf });
      }
    }
  }

  function createPalletBlock(x, z, columns, rows, seedOffset, dense) {
    const blocks = [];
    for (let ix = 0; ix < columns; ix += 1) {
      for (let iz = 0; iz < rows; iz += 1) {
        if (!dense && pseudoRandom((ix + 1) * 4.2 + (iz + 1) * 8.4 + seedOffset) < 0.18) {
          continue;
        }
        blocks.push({
          x: x + ix * 3.3,
          z: z + iz * 3.4,
          height: dense ? 1.8 + pseudoRandom(ix * 7.1 + iz * 2.6) * 0.6 : 1.3 + pseudoRandom(ix * 7.7 + iz * 2.8) * 0.5,
          color: pickCargoColor(ix * 5 + iz + seedOffset)
        });
      }
    }
    return blocks;
  }

  function addPalletStackFaces(target, stack, alpha) {
    addBox(target, stack.x, 0.28, stack.z, 1.2, 0.14, 1.1, PALETTE.palletWood, { alpha: alpha == null ? 1 : alpha });
    addBox(target, stack.x - 0.08, 0.42, stack.z - 0.08, 1.36, stack.height, 1.26, stack.color, {
      alpha: alpha == null ? 1 : alpha,
      stroke: PALETTE.rackShelf
    });
  }

  function addPaintedOutline(target, x, z, width, depth, colorValue, alpha) {
    addLane(target, x, z, width, 0.22, colorValue, alpha == null ? 0.82 : alpha);
    addLane(target, x, z + depth - 0.22, width, 0.22, colorValue, alpha == null ? 0.82 : alpha);
    addLane(target, x, z, 0.22, depth, colorValue, alpha == null ? 0.82 : alpha);
    addLane(target, x + width - 0.22, z, 0.22, depth, colorValue, alpha == null ? 0.82 : alpha);
  }

  function addLane(target, x, z, width, depth, colorValue, alpha) {
    addQuad(target, [
      vec(x, 0.03, z),
      vec(x + width, 0.03, z),
      vec(x + width, 0.03, z + depth),
      vec(x, 0.03, z + depth)
    ], colorValue, { alpha: alpha == null ? 0.8 : alpha });
  }

  function addFloorRect(target, x, z, width, depth, colorValue, intensity) {
    addQuad(target, [
      vec(x, 0.02, z),
      vec(x + width, 0.02, z),
      vec(x + width, 0.02, z + depth),
      vec(x, 0.02, z + depth)
    ], colorValue, { alpha: intensity });
  }

  function addShadowRect(target, x, z, width, depth, alpha) {
    addQuad(target, [
      vec(x, 0.015, z),
      vec(x + width, 0.015, z),
      vec(x + width, 0.015, z + depth),
      vec(x, 0.015, z + depth)
    ], PALETTE.shadow, { alpha: alpha || 0.08 });
  }

  function addRealBox(target, x0, x1, y0, y1, z0, z1, colorValue, options) {
    addBox(target, toSceneX(x0), z0, toSceneZ(y0), x1 - x0, z1 - z0, y1 - y0, colorValue, options || {});
  }

  function addBox(target, x, y, z, width, height, depth, colorValue, options) {
    const faces = boxToFaces(x, y, z, width, height, depth, colorValue, options || {});
    for (const face of faces) {
      target.push(face);
    }
  }

  function addQuad(target, vertices, colorValue, options) {
    target.push(makeFace(vertices, colorValue, options || {}));
  }

  function boxToFaces(x, y, z, width, height, depth, colorValue, options) {
    const p000 = vec(x, y, z);
    const p100 = vec(x + width, y, z);
    const p110 = vec(x + width, y + height, z);
    const p010 = vec(x, y + height, z);
    const p001 = vec(x, y, z + depth);
    const p101 = vec(x + width, y, z + depth);
    const p111 = vec(x + width, y + height, z + depth);
    const p011 = vec(x, y + height, z + depth);

    return [
      makeFace([p000, p100, p110, p010], colorValue, options),
      makeFace([p100, p101, p111, p110], colorValue, options),
      makeFace([p101, p001, p011, p111], colorValue, options),
      makeFace([p001, p000, p010, p011], colorValue, options),
      makeFace([p010, p110, p111, p011], colorValue, options)
    ];
  }

  function pushOrientedBox(target, center, width, height, depth, yaw, yOffset, colorValue, options) {
    const hw = width / 2;
    const hd = depth / 2;
    const base = [
      vec(-hw, 0, -hd),
      vec(hw, 0, -hd),
      vec(hw, 0, hd),
      vec(-hw, 0, hd),
      vec(-hw, height, -hd),
      vec(hw, height, -hd),
      vec(hw, height, hd),
      vec(-hw, height, hd)
    ].map((vertex) => add(center, rotateXZ(vec(vertex.x, vertex.y + yOffset, vertex.z), yaw)));

    target.push(makeFace([base[0], base[1], base[5], base[4]], colorValue, options || {}));
    target.push(makeFace([base[1], base[2], base[6], base[5]], colorValue, options || {}));
    target.push(makeFace([base[2], base[3], base[7], base[6]], colorValue, options || {}));
    target.push(makeFace([base[3], base[0], base[4], base[7]], colorValue, options || {}));
    target.push(makeFace([base[4], base[5], base[6], base[7]], colorValue, options || {}));
  }

  function makeDiscFace(x, y, z, radius, colorValue, alpha, glow) {
    const steps = 18;
    const vertices = [];
    for (let i = 0; i < steps; i += 1) {
      const angle = (i / steps) * Math.PI * 2;
      vertices.push(vec(x + Math.cos(angle) * radius, y, z + Math.sin(angle) * radius));
    }
    return makeFace(vertices, colorValue, { alpha, glow });
  }

  function makeFace(vertices, colorValue, options) {
    const center = scale(vertices.reduce((sum, vertex) => add(sum, vertex), vec(0, 0, 0)), 1 / vertices.length);
    const normal = normalize(cross(sub(vertices[1], vertices[0]), sub(vertices[2], vertices[0])));
    return {
      vertices,
      center,
      normal,
      color: colorValue,
      alpha: options.alpha == null ? 1 : options.alpha,
      stroke: options.stroke || null,
      glow: options.glow || 0,
      doubleSided: !!options.doubleSided,
      preserveStroke: !!options.preserveStroke
    };
  }

  function projectFace(vertices, camera) {
    const points = [];
    let depth = 0;
    let area = 0;
    for (const vertex of vertices) {
      const projected = projectPoint(vertex, camera);
      if (!projected) {
        return null;
      }
      points.push(projected);
      depth += projected.depth;
    }

    for (let i = 0; i < points.length; i += 1) {
      const current = points[i];
      const next = points[(i + 1) % points.length];
      area += current.x * next.y - next.x * current.y;
    }

    return {
      points,
      depth: depth / vertices.length,
      screenArea: Math.abs(area) * 0.5
    };
  }

  function projectPoint(point, camera) {
    const relative = sub(point, camera.position);
    const x = dot(relative, camera.right);
    const y = dot(relative, camera.up);
    const z = dot(relative, camera.forward);
    if (z <= camera.near) {
      return null;
    }
    const scaleFactor = camera.focalLength / z;
    return {
      x: camera.width * 0.5 + x * scaleFactor,
      y: camera.height * 0.55 - y * scaleFactor,
      depth: z
    };
  }

  function routeLength(points) {
    let total = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      total += distance(points[i], points[i + 1]);
    }
    return total;
  }

  function pointAlongRoute(points, distanceValue) {
    let remaining = distanceValue;
    for (let i = 0; i < points.length - 1; i += 1) {
      const segmentLength = distance(points[i], points[i + 1]);
      if (remaining <= segmentLength) {
        return lerpVec(points[i], points[i + 1], segmentLength === 0 ? 0 : remaining / segmentLength);
      }
      remaining -= segmentLength;
    }
    return points[points.length - 1];
  }

  function poseAlongRoute(points, distanceValue) {
    let remaining = distanceValue;
    for (let i = 0; i < points.length - 1; i += 1) {
      const segment = sub(points[i + 1], points[i]);
      const segmentLength = length(segment);
      if (remaining <= segmentLength) {
        const direction = segmentLength === 0 ? vec(0, 0, 1) : scale(segment, 1 / segmentLength);
        return {
          point: lerpVec(points[i], points[i + 1], segmentLength === 0 ? 0 : remaining / segmentLength),
          direction
        };
      }
      remaining -= segmentLength;
    }
    return {
      point: points[points.length - 1],
      direction: normalize(sub(points[points.length - 1], points[points.length - 2]))
    };
  }

  function nearestAisleX(aisles, targetX) {
    let best = null;
    let bestDelta = Infinity;
    for (const aisleX of aisles || []) {
      const delta = Math.abs(aisleX - targetX);
      if (delta < bestDelta) {
        best = aisleX;
        bestDelta = delta;
      }
    }
    return best;
  }

  function mapRecordIntoDisplayZone(zone, x, y) {
    const bounds = zone && zone.sourceBounds ? zone.sourceBounds : zone;
    return {
      x: remapClamp(x, bounds.x0, bounds.x1, zone.x0, zone.x1),
      y: remapClamp(y, bounds.y0, bounds.y1, zone.y0, zone.y1)
    };
  }

  function remapClamp(value, sourceMin, sourceMax, targetMin, targetMax) {
    if (!Number.isFinite(value)) {
      return (targetMin + targetMax) * 0.5;
    }
    const sourceSpan = (sourceMax - sourceMin) || 1;
    const t = clamp((value - sourceMin) / sourceSpan, 0, 1);
    return lerp(targetMin, targetMax, t);
  }

  function buildDisplayRows(start, end, step) {
    const rows = [];
    for (let value = start; value <= end + 0.001; value += step) {
      rows.push(roundTo(value, 2));
    }
    return rows;
  }

  function buildWalkAisles(zone) {
    const rows = uniqueSorted(zone.displayRows || zone.aisles || []);
    if (rows.length < 2) {
      return rows.slice();
    }

    const aisles = [];
    for (let index = 0; index < rows.length - 1; index += 1) {
      aisles.push(roundTo((rows[index] + rows[index + 1]) * 0.5, 2));
    }
    return aisles;
  }

  function pickCargoColor(seed) {
    const value = pseudoRandom(seed * 0.87);
    if (value < 0.34) return PALETTE.palletA;
    if (value < 0.67) return PALETTE.palletB;
    return PALETTE.palletC;
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter((value) => Number.isFinite(value)))).sort((a, b) => a - b);
  }

  function toSceneX(realX) {
    return realX - WORLD.width / 2;
  }

  function toSceneZ(realY) {
    return realY - WORLD.depth / 2;
  }

  function realPoint(realX, realY, elevation) {
    return vec(toSceneX(realX), elevation || 0, toSceneZ(realY));
  }

  function rotateXZ(point, yaw) {
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    return vec(
      point.x * cosYaw - point.z * sinYaw,
      point.y,
      point.x * sinYaw + point.z * cosYaw
    );
  }

  function hashString(input) {
    let hash = 0;
    const source = String(input || "");
    for (let i = 0; i < source.length; i += 1) {
      hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  function pseudoRandom(seed) {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
    return value - Math.floor(value);
  }

  function color(r, g, b) {
    return { r, g, b };
  }

  function withAlpha(colorValue, alpha) {
    return `rgba(${Math.round(colorValue.r)}, ${Math.round(colorValue.g)}, ${Math.round(colorValue.b)}, ${clamp(alpha, 0, 1)})`;
  }

  function mixColor(a, b, t) {
    return color(
      lerp(a.r, b.r, t),
      lerp(a.g, b.g, t),
      lerp(a.b, b.b, t)
    );
  }

  function scaleColor(colorValue, factor) {
    return color(
      clamp(colorValue.r * factor, 0, 255),
      clamp(colorValue.g * factor, 0, 255),
      clamp(colorValue.b * factor, 0, 255)
    );
  }

  function vec(x, y, z) {
    return { x, y, z };
  }

  function add(a, b) {
    return vec(a.x + b.x, a.y + b.y, a.z + b.z);
  }

  function sub(a, b) {
    return vec(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  function scale(v, s) {
    return vec(v.x * s, v.y * s, v.z * s);
  }

  function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  function cross(a, b) {
    return vec(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x
    );
  }

  function length(v) {
    return Math.sqrt(dot(v, v));
  }

  function normalize(v) {
    const len = length(v);
    return len === 0 ? vec(0, 0, 0) : scale(v, 1 / len);
  }

  function distance(a, b) {
    return length(sub(a, b));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpVec(a, b, t) {
    return vec(
      lerp(a.x, b.x, t),
      lerp(a.y, b.y, t),
      lerp(a.z, b.z, t)
    );
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function roundTo(value, digits) {
    const factor = Math.pow(10, digits || 0);
    return Math.round(value * factor) / factor;
  }

  function smoothstep(edge0, edge1, value) {
    if (edge0 === edge1) {
      return value >= edge1 ? 1 : 0;
    }
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }
})(window.WarehouseTwin);
