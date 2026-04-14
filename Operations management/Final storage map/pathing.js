window.WarehouseTwin = window.WarehouseTwin || {};

(function (ns) {
  ns.buildScenarioAnalysis = buildScenarioAnalysis;

  function buildScenarioAnalysis(scenario, warehouse) {
    const graph = buildGraph(warehouse, scenario.stops || []);
    const checkpoints = [graph.startNodeId].concat((scenario.stops || []).map((stop) => stop.nodeId), [graph.startNodeId]);
    const routePolyline = [];
    const edgeTotals = new Map();
    const nodeTotals = new Map();
    let travelDistance = 0;

    for (let index = 0; index < checkpoints.length - 1; index += 1) {
      const fromId = checkpoints[index];
      const toId = checkpoints[index + 1];
      const result = shortestPath(graph, fromId, toId);
      if (!result.path.length) {
        continue;
      }

      const legWeight = scenario.stopWeights[index] || 1;
      appendPath(routePolyline, result.points);
      travelDistance += result.distance;

      for (const edge of result.edges) {
        const key = normalizeEdgeKey(edge.from, edge.to);
        const existing = edgeTotals.get(key) || {
          from: edge.from,
          to: edge.to,
          distance: edge.distance,
          total: 0
        };
        existing.total += legWeight;
        edgeTotals.set(key, existing);
      }

      for (const nodeId of result.path) {
        nodeTotals.set(nodeId, (nodeTotals.get(nodeId) || 0) + legWeight);
      }
    }

    const edgeEntries = Array.from(edgeTotals.values());
    const maxEdgeLoad = edgeEntries.reduce((max, edge) => Math.max(max, edge.total), 0) || 1;
    const congestionEdges = edgeEntries.map((edge) => ({
      points: [graph.nodes.get(edge.from).point, graph.nodes.get(edge.to).point],
      intensity: edge.total / maxEdgeLoad,
      load: edge.total,
      distance: edge.distance
    }));

    const uniqueDistance = edgeEntries.reduce((sum, edge) => sum + edge.distance, 0);
    const hotspotEntries = Array.from(nodeTotals.entries())
      .filter(([nodeId]) => nodeId !== graph.startNodeId)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([nodeId, total]) => ({
        point: graph.nodes.get(nodeId).point,
        radius: 2.1 + (total / maxEdgeLoad) * 1.6,
        intensity: Math.min(total / maxEdgeLoad, 1)
      }));

    return {
      routePolyline,
      congestionEdges,
      hotspots: hotspotEntries,
      travelDistance,
      uniqueDistance,
      maxEdgeLoad,
      vehicles: buildVehicleLoops(routePolyline)
    };
  }

  function buildGraph(warehouse, stops) {
    const columns = new Map();
    const nodes = new Map();
    const startX = warehouse.routeStart.x;
    const startY = warehouse.routeStart.y;
    const transferYs = warehouse.routeTransferYs || [
      warehouse.routeAnchors.front,
      warehouse.routeAnchors.middle
    ];

    for (const x of warehouse.routeAisles) {
      columns.set(roundKey(x), new Set(transferYs));
    }

    if (!columns.has(roundKey(startX))) {
      columns.set(roundKey(startX), new Set());
    }
    columns.get(roundKey(startX)).add(startY);
    for (const y of transferYs) {
      columns.get(roundKey(startX)).add(y);
    }

    for (const stop of stops) {
      if (!columns.has(roundKey(stop.aisleX))) {
        columns.set(roundKey(stop.aisleX), new Set());
      }
      columns.get(roundKey(stop.aisleX)).add(stop.y);
      for (const y of transferYs) {
        columns.get(roundKey(stop.aisleX)).add(y);
      }
    }

    for (const [xKey, ySet] of columns.entries()) {
      const x = Number(xKey);
      const ys = Array.from(ySet).sort((a, b) => a - b);
      for (const y of ys) {
        const id = nodeId(x, y);
        nodes.set(id, {
          id,
          x,
          y,
          point: scenePoint(warehouse, x, y),
          neighbors: []
        });
      }

      for (let i = 0; i < ys.length - 1; i += 1) {
        const a = nodeId(x, ys[i]);
        const b = nodeId(x, ys[i + 1]);
        connect(nodes, a, b);
      }
    }

    for (const anchorY of transferYs) {
      const xs = Array.from(columns.keys())
        .map(Number)
        .filter((x) => columns.get(roundKey(x)).has(anchorY))
        .sort((a, b) => a - b);
      for (let i = 0; i < xs.length - 1; i += 1) {
        connect(nodes, nodeId(xs[i], anchorY), nodeId(xs[i + 1], anchorY));
      }
    }

    for (const stop of stops) {
      stop.nodeId = nodeId(stop.aisleX, stop.y);
    }

    return {
      nodes,
      startNodeId: nodeId(startX, startY)
    };
  }

  function shortestPath(graph, startId, goalId) {
    if (!graph.nodes.has(startId) || !graph.nodes.has(goalId)) {
      return emptyPath();
    }

    const queue = new Set(graph.nodes.keys());
    const distance = new Map();
    const previous = new Map();

    for (const nodeId of graph.nodes.keys()) {
      distance.set(nodeId, Infinity);
    }
    distance.set(startId, 0);

    while (queue.size) {
      let current = null;
      let currentDistance = Infinity;
      for (const nodeId of queue) {
        const nodeDistance = distance.get(nodeId);
        if (nodeDistance < currentDistance) {
          current = nodeId;
          currentDistance = nodeDistance;
        }
      }

      if (current == null || current === goalId) {
        break;
      }

      queue.delete(current);
      const node = graph.nodes.get(current);
      for (const neighbor of node.neighbors) {
        if (!queue.has(neighbor.to)) {
          continue;
        }
        const nextDistance = currentDistance + neighbor.distance;
        if (nextDistance < distance.get(neighbor.to)) {
          distance.set(neighbor.to, nextDistance);
          previous.set(neighbor.to, current);
        }
      }
    }

    if (!previous.has(goalId) && startId !== goalId) {
      return emptyPath();
    }

    const path = [goalId];
    while (path[0] !== startId) {
      path.unshift(previous.get(path[0]));
    }

    const points = path.map((id) => graph.nodes.get(id).point);
    const edges = [];
    for (let i = 0; i < path.length - 1; i += 1) {
      const from = path[i];
      const to = path[i + 1];
      const fromNode = graph.nodes.get(from);
      const toNode = graph.nodes.get(to);
      edges.push({
        from,
        to,
        distance: distanceBetweenPoints(fromNode.point, toNode.point)
      });
    }

    return {
      path,
      points,
      edges,
      distance: edges.reduce((sum, edge) => sum + edge.distance, 0)
    };
  }

  function buildVehicleLoops(routePolyline) {
    if (!routePolyline || routePolyline.length < 3) {
      return [];
    }

    return [
      {
        path: routePolyline,
        speed: 3.89,
        offset: 0.08,
        lift: 0.28
      }
    ];
  }

  function connect(nodes, aId, bId) {
    const a = nodes.get(aId);
    const b = nodes.get(bId);
    if (!a || !b) {
      return;
    }

    const distance = distanceBetweenPoints(a.point, b.point);
    a.neighbors.push({ to: bId, distance });
    b.neighbors.push({ to: aId, distance });
  }

  function appendPath(target, points) {
    for (const point of points) {
      const last = target[target.length - 1];
      if (!last || last.x !== point.x || last.z !== point.z) {
        target.push(point);
      }
    }
  }

  function normalizeEdgeKey(aId, bId) {
    return aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`;
  }

  function scenePoint(warehouse, x, y) {
    return {
      x: x - warehouse.world.width / 2,
      y: 0.08,
      z: y - warehouse.world.depth / 2
    };
  }

  function distanceBetweenPoints(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function nodeId(x, y) {
    return `${roundKey(x)}|${roundKey(y)}`;
  }

  function roundKey(value) {
    return Number(value).toFixed(2);
  }

  function emptyPath() {
    return {
      path: [],
      points: [],
      edges: [],
      distance: 0
    };
  }
})(window.WarehouseTwin);
