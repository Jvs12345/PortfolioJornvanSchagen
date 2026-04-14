window.WarehouseTwin = window.WarehouseTwin || {};

(function (ns) {
  ns.calculateScenarioKpis = calculateScenarioKpis;

  function calculateScenarioKpis(scenario, analysis) {
    const stopCount = (scenario.stops || []).length;
    const travelSeconds = analysis.travelDistance / Math.max(scenario.travelSpeedMps || 1.2, 0.8);
    const handlingSeconds = stopCount * (scenario.handlingSeconds || 30);
    const congestionSeconds = (scenario.congestionPenaltySeconds || 15) * Math.max(analysis.maxEdgeLoad - 1, 0);
    const totalSeconds = travelSeconds + handlingSeconds + congestionSeconds;
    const bottleneckScore = analysis.maxEdgeLoad || 0;

    return {
      distanceMeters: analysis.travelDistance,
      timeMinutes: totalSeconds / 60,
      stopCount,
      routeLengthMeters: analysis.uniqueDistance,
      bottleneckLabel: bottleneckScore >= 4 ? "High" : bottleneckScore >= 2.4 ? "Medium" : "Low",
      scenarioLabel: scenario.configurationLabel || scenario.label
    };
  }
})(window.WarehouseTwin);
