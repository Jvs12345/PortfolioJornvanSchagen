window.WarehouseTwin = window.WarehouseTwin || {};

(function (ns) {
  ns.createDashboardUi = createDashboardUi;

  function createDashboardUi(callbacks) {
    const elements = {
      introOverlay: document.getElementById("intro-overlay"),
      skipIntroButton: document.getElementById("skip-intro-button"),
      toggleRouteButton: document.getElementById("toggle-route-button"),
      toggleCongestionButton: document.getElementById("toggle-congestion-button"),
      switchScenarioButton: document.getElementById("switch-scenario-button"),
      switchSlottingButton: document.getElementById("switch-slotting-button"),
      toggleCameraButton: document.getElementById("toggle-camera-button"),
      resetViewButton: document.getElementById("reset-view-button"),
      monthSelect: document.getElementById("month-select"),
      exportPerformanceButton: document.getElementById("export-performance-button"),
      lookupInput: document.getElementById("lookup-input"),
      lookupButton: document.getElementById("lookup-button"),
      activeScenarioChip: document.getElementById("active-scenario-chip"),
      statusCopy: document.getElementById("status-copy"),
      dataFootnote: document.getElementById("data-footnote"),
      stopList: document.getElementById("stop-list"),
      distanceValue: document.getElementById("distance-value"),
      timeValue: document.getElementById("time-value"),
      stopsValue: document.getElementById("stops-value"),
      routeLengthValue: document.getElementById("route-length-value"),
      bottleneckValue: document.getElementById("bottleneck-value"),
      scenarioValue: document.getElementById("scenario-value"),
      fastestRoundValue: document.getElementById("fastest-round-value")
    };

    if (elements.skipIntroButton) {
      elements.skipIntroButton.addEventListener("click", callbacks.onOpenControls);
    }
    elements.toggleRouteButton.addEventListener("click", callbacks.onToggleRoute);
    elements.toggleCongestionButton.addEventListener("click", callbacks.onToggleCongestion);
    elements.switchScenarioButton.addEventListener("click", callbacks.onSwitchScenario);
    elements.switchSlottingButton.addEventListener("click", callbacks.onSwitchSlotting);
    elements.toggleCameraButton.addEventListener("click", callbacks.onToggleCamera);
    elements.resetViewButton.addEventListener("click", callbacks.onResetView);
    elements.monthSelect.addEventListener("change", function () {
      callbacks.onChangeMonth(elements.monthSelect.value);
    });
    elements.exportPerformanceButton.addEventListener("click", callbacks.onExportPerformance);
    elements.lookupButton.addEventListener("click", function () {
      callbacks.onLookup(elements.lookupInput.value);
    });
    elements.lookupInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        callbacks.onLookup(elements.lookupInput.value);
      }
    });

    return {
      setLookupOptions(values) {
        const datalist = document.getElementById("sku-options");
        if (!datalist) {
          return;
        }
        datalist.replaceChildren();
        for (const value of values || []) {
          const option = document.createElement("option");
          option.value = value;
          datalist.appendChild(option);
        }
      },
      setMonthOptions(values) {
        elements.monthSelect.replaceChildren();
        for (const value of values || []) {
          const option = document.createElement("option");
          option.value = value.id;
          option.textContent = value.label;
          elements.monthSelect.appendChild(option);
        }
      },
      render(viewModel) {
        if (elements.introOverlay) {
          elements.introOverlay.classList.toggle("is-hidden", !viewModel.showIntro);
        }
        elements.activeScenarioChip.textContent = viewModel.scenario.configurationLabel || viewModel.scenario.label;
        elements.statusCopy.textContent = viewModel.statusText;
        elements.dataFootnote.textContent = viewModel.cameraMode === "pov"
          ? "Warehouse POV active. Use WASD to move through aisles and click the small item dots."
          : "Use buttons or drag to inspect the warehouse.";
        elements.distanceValue.textContent = `${Math.round(viewModel.kpis.distanceMeters)} m`;
        elements.timeValue.textContent = `${viewModel.kpis.timeMinutes.toFixed(1)} min`;
        elements.stopsValue.textContent = String(viewModel.kpis.stopCount);
        elements.routeLengthValue.textContent = `${Math.round(viewModel.kpis.routeLengthMeters)} m`;
        elements.bottleneckValue.textContent = viewModel.kpis.bottleneckLabel;
        elements.scenarioValue.textContent = viewModel.kpis.scenarioLabel;
        elements.fastestRoundValue.textContent = viewModel.fastestRoundLabel || "N/A";
        elements.toggleRouteButton.classList.toggle("is-active", viewModel.showRoute);
        elements.toggleCongestionButton.classList.toggle("is-active", viewModel.showCongestion);
        elements.toggleCameraButton.textContent = viewModel.cameraMode === "orbit" ? "Warehouse POV" : "Overview View";
        if (viewModel.monthId !== undefined) {
          elements.monthSelect.value = viewModel.monthId;
        }
        if (viewModel.lookupValue !== undefined) {
          elements.lookupInput.value = viewModel.lookupValue;
        }

        renderStops(elements.stopList, viewModel.scenario.stops, viewModel.selectedStopId, callbacks.onSelectStop);
      }
    };
  }

  function renderStops(container, stops, selectedStopId, onSelectStop) {
    container.replaceChildren();
    for (const stop of stops || []) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "stop-button";
      if (stop.id === selectedStopId) {
        button.classList.add("is-selected");
      }
      button.addEventListener("click", function () {
        onSelectStop(stop.id);
      });

      const index = document.createElement("span");
      index.className = "stop-index";
      index.textContent = `Stop ${stop.order}`;

      const title = document.createElement("span");
      title.className = "stop-title";
      title.textContent = stop.label;

      const meta = document.createElement("span");
      meta.className = "stop-meta";
      meta.textContent = `${stop.zoneLabel} | SKU ${stop.sku} | Activity ${Math.round(stop.activity || 0)}`;

      button.append(index, title, meta);
      container.appendChild(button);
    }
  }
})(window.WarehouseTwin);
