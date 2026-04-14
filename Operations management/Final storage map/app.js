(function () {
  const twin = window.WarehouseTwin;
  const explorerData = window.EXPLORER_DATA || { meta: {}, assignments: [], month_profiles: [], monthly_activity: {} };
  const warehouse = twin.createWarehouseModel(explorerData.assignments || []);
  const warehouseCanvas = document.getElementById("scene");
  const monthProfiles = (explorerData.month_profiles || []).slice();
  const lookupRecords = (explorerData.assignments || [])
    .filter(function (record) { return record && record.sku && warehouse.zones[record.zone_key]; })
    .sort(function (a, b) { return String(a.sku).localeCompare(String(b.sku)); });

  let monthAssignments = [];
  let scenarios = [];
  let pickingMethods = [];
  let slottingMethods = [];
  let analyses = new Map();
  let kpis = new Map();
  let clickableStops = [];

  const state = {
    introVisible: false,
    monthIndex: resolveMonthIndex(monthProfiles, explorerData.meta || {}),
    pickingIndex: 0,
    slottingIndex: 0,
    showRoute: true,
    showCongestion: true,
    selectedStopId: null,
    lookupStop: null,
    lookupValue: ""
  };

  const renderer = twin.createRenderer(warehouseCanvas, warehouse, {
    onPickStop: handleWarehousePick
  });

  const ui = twin.createDashboardUi({
    onOpenControls: openControls,
    onToggleRoute: toggleRoute,
    onToggleCongestion: toggleCongestion,
    onSwitchScenario: switchScenario,
    onSwitchSlotting: switchSlotting,
    onChangeMonth: changeMonth,
    onExportPerformance: exportPerformance,
    onToggleCamera: toggleCamera,
    onResetView: resetView,
    onSelectStop: selectStop,
    onLookup: lookupSku
  });

  ui.setLookupOptions(lookupRecords.slice(0, 4000).map(function (record) { return String(record.sku); }));
  ui.setMonthOptions(monthProfiles.map(function (month) {
    return {
      id: month.id,
      label: month.label
    };
  }));

  rebuildScenarioState(String((currentMonth() || {}).id || ""));
  const initialScenario = currentScenario();
  state.selectedStopId = initialScenario && initialScenario.stops[0] ? initialScenario.stops[0].id : null;
  applyScenario();

  let previousTime = performance.now();
  requestAnimationFrame(frame);

  function frame(now) {
    const dt = Math.min((now - previousTime) / 1000, 0.033);
    previousTime = now;
    renderer.tick(dt);
    requestAnimationFrame(frame);
  }

  function currentMonth() {
    return monthProfiles[state.monthIndex] || monthProfiles[monthProfiles.length - 1] || null;
  }

  function currentScenario() {
    return scenarios.find(function (scenario) {
      return scenario.pickingId === currentPicking().id && scenario.slottingId === currentSlotting().id;
    }) || scenarios[0];
  }

  function currentPicking() {
    return pickingMethods[state.pickingIndex] || pickingMethods[0] || { id: null, label: "" };
  }

  function currentSlotting() {
    return slottingMethods[state.slottingIndex] || slottingMethods[0] || { id: null, label: "" };
  }

  function currentAnalysis() {
    const scenario = currentScenario();
    return scenario ? analyses.get(scenario.id) : null;
  }

  function currentKpis() {
    const scenario = currentScenario();
    return scenario ? kpis.get(scenario.id) : null;
  }

  function rebuildScenarioState(preferredSlottingId) {
    const month = currentMonth();
    const preferredPickingId = currentPicking().id;
    const slottingId = preferredSlottingId || currentSlotting().id;

    monthAssignments = twin.applyMonthActivity(
      explorerData.assignments || [],
      month ? month.id : null,
      explorerData.monthly_activity || {}
    );

    scenarios = twin.buildScenarios(monthAssignments, warehouse, {
      ...explorerData.meta,
      month_id: month ? month.id : null,
      month_label: month ? month.label : ""
    });

    analyses = new Map();
    kpis = new Map();
    for (const scenario of scenarios) {
      const analysis = twin.buildScenarioAnalysis(scenario, warehouse);
      analyses.set(scenario.id, analysis);
      kpis.set(scenario.id, twin.calculateScenarioKpis(scenario, analysis));
    }

    pickingMethods = uniqueMethods(scenarios, "pickingId", "pickingLabel");
    slottingMethods = uniqueMethods(scenarios, "slottingId", "slottingLabel");

    state.pickingIndex = resolveMethodIndex(pickingMethods, preferredPickingId);
    state.slottingIndex = resolveMethodIndex(
      slottingMethods,
      slottingId || resolveSlottingIdFromMeta(slottingMethods, explorerData.meta || {})
    );

    clickableStops = monthAssignments
      .filter(function (record) {
        return Number(record.monthPickedQty || 0) > 0 && warehouse.zones[record.zone_key];
      })
      .map(function (record) {
        return twin.recordToStop(record, warehouse, `SKU ${record.sku}`);
      })
      .filter(Boolean);
  }

  function applyScenario() {
    const scenario = currentScenario();
    const analysis = currentAnalysis();
    const scenarioKpis = currentKpis();
    const month = currentMonth();
    const fastestRound = currentFastestRound();
    const selectedStop = scenario.stops.find(function (stop) {
      return stop.id === state.selectedStopId;
    }) || scenario.stops[0] || null;

    state.selectedStopId = selectedStop ? selectedStop.id : null;

    renderer.setLayers({
      scenarioColor: scenario.color,
      showRoute: state.showRoute,
      showCongestion: state.showCongestion,
      routePolyline: analysis.routePolyline,
      congestionEdges: analysis.congestionEdges,
      hotspots: analysis.hotspots,
      stops: scenario.stops,
      selectedStopId: state.selectedStopId,
      vehicles: analysis.vehicles,
      lookupStop: state.lookupStop,
      clickableStops
    });

    ui.render({
      showIntro: state.introVisible,
      scenario: scenario,
      kpis: scenarioKpis,
      showRoute: state.showRoute,
      showCongestion: state.showCongestion,
      selectedStopId: state.selectedStopId,
      cameraMode: renderer.getCameraMode(),
      monthId: month ? month.id : "",
      lookupValue: state.lookupValue,
      fastestRoundLabel: fastestRound ? fastestRound.label : "",
      statusText: state.lookupStop
        ? `${month ? month.label : "Selected month"} | ${scenario.pickingLabel} with ${scenario.slottingLabel} slotting. Located SKU ${state.lookupStop.sku} in ${state.lookupStop.zoneLabel}.`
        : selectedStop
          ? `${month ? month.label : "Selected month"} | ${scenario.pickingLabel} with ${scenario.slottingLabel} slotting. Focused stop: ${selectedStop.label} in ${selectedStop.zoneLabel}.`
          : `${month ? month.label : "Selected month"} | ${scenario.pickingLabel} with ${scenario.slottingLabel} slotting.`
    });
  }

  function openControls() {
    state.introVisible = false;
    applyScenario();
  }

  function toggleRoute() {
    state.showRoute = !state.showRoute;
    applyScenario();
  }

  function toggleCongestion() {
    state.showCongestion = !state.showCongestion;
    applyScenario();
  }

  function switchScenario() {
    state.pickingIndex = (state.pickingIndex + 1) % Math.max(pickingMethods.length, 1);
    const scenario = currentScenario();
    state.selectedStopId = scenario.stops[0] ? scenario.stops[0].id : null;
    state.lookupStop = null;
    renderer.stopTour();
    renderer.resetView();
    applyScenario();
  }

  function switchSlotting() {
    state.slottingIndex = (state.slottingIndex + 1) % Math.max(slottingMethods.length, 1);
    const scenario = currentScenario();
    state.selectedStopId = scenario.stops[0] ? scenario.stops[0].id : null;
    state.lookupStop = null;
    renderer.stopTour();
    renderer.resetView();
    applyScenario();
  }

  function changeMonth(monthId) {
    const nextIndex = monthProfiles.findIndex(function (month) { return month.id === monthId; });
    if (nextIndex < 0 || nextIndex === state.monthIndex) {
      return;
    }

    state.monthIndex = nextIndex;
    state.lookupStop = null;
    state.lookupValue = "";
    renderer.stopTour();
    renderer.resetView();
    rebuildScenarioState();
    const scenario = currentScenario();
    state.selectedStopId = scenario && scenario.stops[0] ? scenario.stops[0].id : null;
    applyScenario();
  }

  function exportPerformance() {
    twin.exportPerformanceReport({
      monthProfile: currentMonth(),
      scenario: currentScenario(),
      kpis: currentKpis(),
      analysis: currentAnalysis(),
      assignments: monthAssignments,
      comparison: buildScenarioComparison(),
      fastestRound: currentFastestRound()
    });
  }

  function toggleCamera() {
    state.introVisible = false;
    renderer.stopTour();
    renderer.toggleCameraMode();
    applyScenario();
  }

  function resetView() {
    renderer.stopTour();
    renderer.resetView();
  }

  function selectStop(stopId) {
    state.introVisible = false;
    state.selectedStopId = stopId;
    state.lookupStop = null;
    const stop = currentScenario().stops.find(function (candidate) {
      return candidate.id === stopId;
    });
    if (stop) {
      renderer.stopTour();
      renderer.focusOnStop(stop);
    }
    applyScenario();
  }

  function lookupSku(rawValue) {
    const value = String(rawValue || "").trim();
    state.lookupValue = value;
    if (!value) {
      state.lookupStop = null;
      applyScenario();
      return;
    }

    const normalized = value.toLowerCase();
    const match = monthAssignments.find(function (record) {
      return String(record.sku).toLowerCase() === normalized;
    }) || monthAssignments.find(function (record) {
      return String(record.sku).toLowerCase().includes(normalized);
    }) || lookupRecords.find(function (record) {
      return String(record.sku).toLowerCase() === normalized;
    }) || lookupRecords.find(function (record) {
      return String(record.sku).toLowerCase().includes(normalized);
    });

    if (!match) {
      state.lookupStop = null;
      applyScenario();
      return;
    }

    const stop = twin.recordToStop(match, warehouse, `SKU ${match.sku}`);
    state.lookupStop = stop;
    state.selectedStopId = null;
    state.introVisible = false;
    renderer.stopTour();
    renderer.focusOnStop(stop);
    applyScenario();
  }

  function handleWarehousePick(stop) {
    if (!stop) {
      return;
    }
    state.lookupStop = stop;
    state.lookupValue = stop.sku || "";
    state.selectedStopId = null;
    state.introVisible = false;
    applyScenario();
  }

  function uniqueMethods(allScenarios, idKey, labelKey) {
    const methods = [];
    const seen = new Set();
    for (const scenario of allScenarios || []) {
      if (!scenario || seen.has(scenario[idKey])) {
        continue;
      }
      seen.add(scenario[idKey]);
      methods.push({
        id: scenario[idKey],
        label: scenario[labelKey]
      });
    }
    return methods;
  }

  function buildScenarioComparison() {
    const slottingId = currentSlotting().id;
    return scenarios
      .filter(function (scenario) {
        return scenario.slottingId === slottingId;
      })
      .map(function (scenario) {
        const scenarioKpis = kpis.get(scenario.id) || {};
        return {
          id: scenario.id,
          pickingId: scenario.pickingId,
          pickingLabel: scenario.pickingLabel,
          slottingId: scenario.slottingId,
          slottingLabel: scenario.slottingLabel,
          timeMinutes: Number(scenarioKpis.timeMinutes || 0),
          distanceMeters: Number(scenarioKpis.distanceMeters || 0),
          stops: Number(scenarioKpis.stopCount || 0)
        };
      })
      .sort(function (a, b) {
        return a.timeMinutes - b.timeMinutes;
      });
  }

  function currentFastestRound() {
    const comparison = buildScenarioComparison();
    if (!comparison.length) {
      return null;
    }

    const current = comparison.find(function (item) {
      return item.pickingId === currentPicking().id;
    }) || comparison[0];
    const fastest = comparison[0];
    const deltaMinutes = Math.max(current.timeMinutes - fastest.timeMinutes, 0);

    return {
      id: fastest.id,
      label: deltaMinutes > 0.05
        ? `${fastest.pickingLabel} (${deltaMinutes.toFixed(1)} min faster)`
        : `${fastest.pickingLabel} (Best current round)`,
      timeMinutes: fastest.timeMinutes
    };
  }

  function resolveMonthIndex(months, meta) {
    const preferred = String((meta && meta.default_month) || "").trim();
    const index = months.findIndex(function (month) {
      return month.id === preferred;
    });
    return index >= 0 ? index : Math.max(months.length - 1, 0);
  }

  function resolveSlottingIdFromMeta(methods, meta) {
    const source = String(meta.strategy || "").trim().toLowerCase();
    const match = methods.find(function (method) {
      return String(method.label || "").trim().toLowerCase() === source;
    });
    return match ? match.id : (methods[0] ? methods[0].id : null);
  }

  function resolveMethodIndex(methods, preferredId) {
    const index = methods.findIndex(function (method) {
      return method.id === preferredId;
    });
    return index >= 0 ? index : 0;
  }
})();
