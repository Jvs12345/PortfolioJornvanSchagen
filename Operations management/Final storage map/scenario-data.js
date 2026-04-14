window.WarehouseTwin = window.WarehouseTwin || {};

(function (ns) {
  ns.buildScenarios = buildScenarios;
  ns.applyMonthActivity = applyMonthActivity;

  const PICKING_METHODS = [
    {
      id: "single",
      label: "Single Picking",
      routeColor: null,
      order: ["fast", "bulkRear", "kardex", "reserve", "overflow", "bulkFront"],
      travelSpeedMps: 3.89,
      handlingSeconds: 34,
      congestionPenaltySeconds: 22
    },
    {
      id: "batch",
      label: "Batch Picking",
      routeColor: null,
      order: ["kardex", "fast", "reserve", "bulkFront", "bulkRear", "overflow"],
      travelSpeedMps: 3.89,
      handlingSeconds: 27,
      congestionPenaltySeconds: 13
    }
  ];

  const SLOTTING_METHODS = [
    {
      id: "abc",
      label: "ABC",
      color: color(174, 127, 84),
      speedFactor: 1,
      handlingDelta: 2,
      congestionDelta: 2
    },
    {
      id: "coi_weight",
      label: "COI + Weight",
      color: color(90, 156, 115),
      speedFactor: 1,
      handlingDelta: -1,
      congestionDelta: -2
    },
    {
      id: "coi",
      label: "COI",
      color: color(104, 137, 160),
      speedFactor: 1,
      handlingDelta: 0,
      congestionDelta: -1
    },
    {
      id: "abc_ml",
      label: "ABC with ML",
      color: color(128, 124, 161),
      speedFactor: 1,
      handlingDelta: -2,
      congestionDelta: -3
    }
  ];

  PICKING_METHODS[0].routeColor = ns.palette.routeBaseline;
  PICKING_METHODS[1].routeColor = ns.palette.routeOptimized;

  function buildScenarios(assignments, warehouse, meta) {
    const activeRecords = (assignments || [])
      .filter((record) => Number(record.activity || 0) > 0 && warehouse.zones[record.zone_key])
      .slice();

    if (!activeRecords.length) {
      return buildFallbackScenarios(warehouse);
    }

    const metrics = buildMetrics(activeRecords);
    const slottingStopPools = new Map();

    for (const slotting of SLOTTING_METHODS) {
      const groupedRecords = groupRecordsByZone(activeRecords, function (record) {
        return scoreRecord(record, slotting.id, metrics);
      });
      slottingStopPools.set(slotting.id, selectRepresentativeStops(groupedRecords, warehouse));
    }

    const scenarios = [];
    for (const slotting of SLOTTING_METHODS) {
      const stopPool = slottingStopPools.get(slotting.id);
      for (const picking of PICKING_METHODS) {
        const stops = compactStops(picking.order.map(function (key) {
          return stopPool[key];
        }));
        if (!stops.length) {
          continue;
        }
        scenarios.push(createScenario(picking, slotting, stops, meta));
      }
    }

    return scenarios.length ? scenarios : buildFallbackScenarios(warehouse);
  }

  function applyMonthActivity(assignments, monthId, monthlyActivity) {
    const monthMap = monthlyActivity && monthId ? (monthlyActivity[monthId] || {}) : {};
    return (assignments || []).map(function (record) {
      const monthStats = monthMap[String(record.sku)] || null;
      return {
        ...record,
        activity: monthStats ? Number(monthStats.picked_qty || 0) : 0,
        monthPickedQty: monthStats ? Number(monthStats.picked_qty || 0) : 0,
        monthLineCount: monthStats ? Number(monthStats.line_count || 0) : 0,
        monthOrderCount: monthStats ? Number(monthStats.order_count || 0) : 0,
        monthShipmentCount: monthStats ? Number(monthStats.shipment_count || 0) : 0
      };
    });
  }

  function createScenario(picking, slotting, stops, meta) {
    const maxActivity = stops.reduce(function (max, stop) {
      return Math.max(max, stop.activity || 0);
    }, 1);
    const stopWeights = [];
    for (let i = 0; i < stops.length + 1; i += 1) {
      const stop = stops[i];
      const activityFactor = stop ? (stop.activity || 0) / maxActivity : 0.45;
      stopWeights.push(1 + activityFactor * 1.4);
    }

    return {
      id: `${picking.id}__${slotting.id}`,
      label: picking.label,
      pickingId: picking.id,
      pickingLabel: picking.label,
      slottingId: slotting.id,
      slottingLabel: slotting.label,
      configurationLabel: `${picking.label} | ${slotting.label}`,
      description: `${picking.label} using ${slotting.label} slotting.`,
      color: blendColor(picking.routeColor, slotting.color, 0.28),
      stops: stops.map(function (stop, index) {
        return {
          ...stop,
          order: index + 1
        };
      }),
      stopWeights,
      travelSpeedMps: picking.travelSpeedMps * slotting.speedFactor,
      handlingSeconds: Math.max(18, picking.handlingSeconds + slotting.handlingDelta),
      congestionPenaltySeconds: Math.max(6, picking.congestionPenaltySeconds + slotting.congestionDelta),
      assumptionNote: `${meta && meta.assigned_slots ? `${meta.assigned_slots} assigned locations loaded.` : "Assignment data loaded."} Slotting comparison is a front-end prototype view derived from the available activity, COI, and weight fields.`
    };
  }

  function buildMetrics(records) {
    const maxActivity = Math.max.apply(null, records.map(function (record) {
      return Number(record.activity || 0);
    }).concat([1]));
    const maxWeight = Math.max.apply(null, records.map(function (record) {
      return Number(record.weight_kg || 0);
    }).concat([1]));
    const coiValues = records
      .map(function (record) { return Number(record.coi || 0); })
      .filter(Number.isFinite);
    const minCoi = coiValues.length ? Math.min.apply(null, coiValues) : 0;
    const maxCoi = coiValues.length ? Math.max.apply(null, coiValues) : 1;

    const abcBand = new WeakMap();
    records.slice().sort(function (a, b) {
      return Number(b.activity || 0) - Number(a.activity || 0);
    }).forEach(function (record, index, list) {
      const ratio = index / Math.max(list.length - 1, 1);
      abcBand.set(record, ratio < 0.2 ? 0 : ratio < 0.5 ? 1 : 2);
    });

    return {
      maxActivity,
      maxWeight,
      minCoi,
      maxCoi,
      abcBand
    };
  }

  function scoreRecord(record, slottingId, metrics) {
    const activityNorm = Number(record.activity || 0) / Math.max(metrics.maxActivity, 1);
    const weightNorm = Number(record.weight_kg || 0) / Math.max(metrics.maxWeight, 0.001);
    const coiNorm = normalize(Number(record.coi || 0), metrics.minCoi, metrics.maxCoi);
    const abcBand = metrics.abcBand.get(record) || 2;
    const levelPenalty = Number(record.rec_level || 0) * (record.is_heavy ? 0.025 : 0.01);

    if (slottingId === "abc") {
      return abcBand * 10 + (1 - activityNorm) * 4 + coiNorm + levelPenalty;
    }

    if (slottingId === "coi") {
      return coiNorm * 0.78 + (1 - activityNorm) * 0.22 + levelPenalty;
    }

    if (slottingId === "abc_ml") {
      return abcBand * 0.55 + coiNorm * 0.2 + weightNorm * 0.12 + (1 - activityNorm) * 0.13 + levelPenalty;
    }

    return coiNorm * 0.58 + weightNorm * 0.22 + (1 - activityNorm) * 0.2 + levelPenalty;
  }

  function groupRecordsByZone(records, scoreFn) {
    const ranked = records.slice().sort(function (a, b) {
      const scoreDelta = scoreFn(a) - scoreFn(b);
      if (Math.abs(scoreDelta) > 0.000001) {
        return scoreDelta;
      }
      return Number(b.activity || 0) - Number(a.activity || 0);
    });

    const byZone = new Map();
    for (const record of ranked) {
      if (!byZone.has(record.zone_key)) {
        byZone.set(record.zone_key, []);
      }
      byZone.get(record.zone_key).push(record);
    }
    return byZone;
  }

  function selectRepresentativeStops(byZone, warehouse) {
    const used = new Set();
    return {
      fast: pickUniqueRecord(byZone, ["fast_pick", "reserve"], used, "Fast-pick aisle", warehouse),
      reserve: pickUniqueRecord(byZone, ["reserve", "bulk"], used, "Reserve pallet bay", warehouse),
      bulkFront: pickUniqueRecord(byZone, ["bulk", "overflow"], used, "Bulk aisle", warehouse),
      bulkRear: pickUniqueRecord(byZone, ["bulk", "reserve"], used, "Rear bulk aisle", warehouse, 1),
      overflow: pickUniqueRecord(byZone, ["overflow", "bulk"], used, "Overflow buffer", warehouse),
      kardex: pickUniqueRecord(byZone, ["kardex", "small"], used, "Dense small-parts tower", warehouse)
    };
  }

  function pickUniqueRecord(byZone, zoneKeys, used, label, warehouse, offset) {
    let skip = offset || 0;
    for (const zoneKey of zoneKeys) {
      const records = byZone.get(zoneKey) || [];
      for (const record of records) {
        const uniqueKey = String(record.recommended_location || record.sku);
        if (used.has(uniqueKey)) {
          continue;
        }
        if (skip > 0) {
          skip -= 1;
          continue;
        }

        const stop = ns.recordToStop(record, warehouse, label);
        if (!stop) {
          continue;
        }
        used.add(uniqueKey);
        return stop;
      }
    }
    return null;
  }

  function compactStops(stops) {
    const list = [];
    const seen = new Set();
    for (const stop of stops) {
      if (!stop || seen.has(stop.id)) {
        continue;
      }
      seen.add(stop.id);
      list.push(stop);
    }
    return list;
  }

  function buildFallbackScenarios(warehouse) {
    const fallbackStops = [
      makePlaceholderStop("PL-FAST", "Fast-pick aisle", "fast_pick", warehouse, warehouse.zones.fast_pick.aisles[1] || warehouse.zones.fast_pick.aisles[0], 18),
      makePlaceholderStop("PL-RESERVE", "Reserve pallet bay", "reserve", warehouse, warehouse.zones.reserve.aisles[1] || warehouse.zones.reserve.aisles[0], 30),
      makePlaceholderStop("PL-BULK", "Bulk aisle", "bulk", warehouse, warehouse.zones.bulk.aisles[3] || warehouse.zones.bulk.aisles[0], 58),
      makePlaceholderStop("PL-OVERFLOW", "Overflow buffer", "overflow", warehouse, warehouse.zones.overflow.aisles[2] || warehouse.zones.overflow.aisles[0], 80)
    ];

    return [
      createScenario(PICKING_METHODS[0], SLOTTING_METHODS[1], fallbackStops, {}),
      createScenario(PICKING_METHODS[1], SLOTTING_METHODS[1], fallbackStops.slice().reverse(), {})
    ];
  }

  function makePlaceholderStop(id, label, zoneKey, warehouse, aisleX, y) {
    const record = {
      sku: id,
      recommended_location: id,
      zone_key: zoneKey,
      rec_x: aisleX,
      rec_y: y,
      rec_level: 0,
      activity: 1
    };
    return ns.recordToStop(record, warehouse, label);
  }

  function normalize(value, min, max) {
    const span = Math.max(max - min, 0.000001);
    return (value - min) / span;
  }

  function blendColor(a, b, t) {
    const amount = Math.max(0, Math.min(1, t));
    return {
      r: Math.round(a.r + (b.r - a.r) * amount),
      g: Math.round(a.g + (b.g - a.g) * amount),
      b: Math.round(a.b + (b.b - a.b) * amount)
    };
  }

  function color(r, g, b) {
    return { r, g, b };
  }

})(window.WarehouseTwin);
