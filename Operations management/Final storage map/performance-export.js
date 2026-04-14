window.WarehouseTwin = window.WarehouseTwin || {};

(function (ns) {
  ns.exportPerformanceReport = exportPerformanceReport;

  function exportPerformanceReport(payload) {
    const month = payload.monthProfile || {};
    const scenario = payload.scenario || {};
    const kpis = payload.kpis || {};
    const analysis = payload.analysis || {};
    const assignments = payload.assignments || [];
    const comparison = payload.comparison || [];
    const fastestRound = payload.fastestRound || null;
    const generatedAt = new Date();

    const activeAssignments = assignments
      .filter(function (record) { return Number(record.monthPickedQty || 0) > 0; })
      .sort(function (a, b) {
        return Number(b.monthPickedQty || 0) - Number(a.monthPickedQty || 0);
      });

    const stopRows = (scenario.stops || []).map(function (stop) {
      return {
        order: stop.order,
        sku: stop.sku,
        label: stop.label,
        zone: stop.zoneLabel,
        aisle: formatAisle(stop),
        pickedQty: Number(stop.monthPickedQty || stop.activity || 0),
        lineCount: Number(stop.monthLineCount || 0),
        orderCount: Number(stop.monthOrderCount || 0),
        shipmentCount: Number(stop.monthShipmentCount || 0),
        location: stop.id
      };
    });
    const routeAssignments = resolveRouteAssignments(assignments, scenario.stops || []);
    const zoneRows = summarizeZones(activeAssignments);
    const topSkuRows = activeAssignments.slice(0, 40);
    const benchmark = buildBenchmarkSummary(routeAssignments, scenario, kpis, analysis);

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Type" content="application/vnd.ms-excel; charset=UTF-8">
  <title>Performance Print</title>
  <style>
    body { font-family: Aptos, Calibri, Arial, sans-serif; font-size: 12px; color: #1d2529; }
    h1, h2 { margin: 0 0 8px; }
    h1 { font-size: 22px; }
    h2 { font-size: 15px; margin-top: 18px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
    th, td { border: 1px solid #b8c0c4; padding: 6px 8px; text-align: left; }
    th { background: #eef1ee; font-weight: 700; }
    .meta { color: #4f5d63; margin-bottom: 12px; }
  </style>
</head>
<body>
  <h1>OPERMB04 Performance Print</h1>
  <div class="meta">Generated ${escapeHtml(generatedAt.toLocaleString())}</div>

  ${renderKeyValueTable("Configuration Summary", [
    ["Month", month.label || month.id || "N/A"],
    ["Picking method", scenario.pickingLabel || scenario.label || "N/A"],
    ["Slotting method", scenario.slottingLabel || "N/A"],
    ["Active configuration", scenario.configurationLabel || scenario.label || "N/A"],
    ["Travel distance (m)", formatNumber(kpis.distanceMeters)],
    ["Estimated time (min)", formatNumber(kpis.timeMinutes)],
    ["Stops", formatNumber(kpis.stopCount)],
    ["Unique route length (m)", formatNumber(kpis.routeLengthMeters)],
    ["Bottleneck", kpis.bottleneckLabel || "N/A"],
    ["Travel speed (m/s)", formatNumber(scenario.travelSpeedMps)],
    ["Handling seconds / stop", formatNumber(scenario.handlingSeconds)],
    ["Congestion penalty (s)", formatNumber(scenario.congestionPenaltySeconds)],
    ["Travel polyline points", formatNumber((analysis.routePolyline || []).length)],
    ["Peak edge load", formatNumber(analysis.maxEdgeLoad)],
    ["Fastest round in current comparison", fastestRound ? fastestRound.label : "N/A"]
  ])}

  ${renderKeyValueTable("Month Demand Summary", [
    ["Outbound lines", formatNumber(month.total_lines)],
    ["Picked units", formatNumber(month.total_units)],
    ["Orders", formatNumber(month.total_orders)],
    ["Shipments", formatNumber(month.total_shipments)],
    ["Active SKUs", formatNumber(month.active_skus)],
    ["Late lines", formatNumber(month.late_lines)],
    ["Workbook sheets", Array.isArray(month.sheet_names) ? month.sheet_names.join(", ") : ""]
  ])}

  ${renderKeyValueTable("Benchmark Hour Calculation", [
    ["Items in active route set", formatNumber(benchmark.totalItems)],
    ["Weighted average pick height (m)", formatNumber(benchmark.avgPickHeightM)],
    ["Height band benchmark", benchmark.heightBandLabel],
    ["Benchmark throughput (items/hour)", formatNumber(benchmark.benchmarkThroughputRate)],
    ["Observed throughput (items/hour)", formatNumber(benchmark.observedThroughputRate)],
    ["Travel time (hours)", formatNumber(benchmark.travelHours)],
    ["Handling hours from benchmark", formatNumber(benchmark.handlingHours)],
    ["Congestion hours", formatNumber(benchmark.congestionHours)],
    ["Estimated labor hours", formatNumber(benchmark.totalLaborHours)]
  ])}

  ${renderTable("Picking Method Comparison", [
    "Picking method",
    "Slotting method",
    "Time (min)",
    "Distance (m)",
    "Stops"
  ], comparison.map(function (row) {
    return [
      row.pickingLabel,
      row.slottingLabel,
      formatNumber(row.timeMinutes),
      formatNumber(row.distanceMeters),
      formatNumber(row.stops)
    ];
  }))}

  ${renderTable("Route Stop Detail", [
    "Stop",
    "SKU",
    "Label",
    "Zone",
    "Aisle",
    "Month picked qty",
    "Month lines",
    "Month orders",
    "Month shipments",
    "Location"
  ], stopRows.map(function (row) {
    return [
      row.order,
      row.sku,
      row.label,
      row.zone,
      row.aisle,
      formatNumber(row.pickedQty),
      formatNumber(row.lineCount),
      formatNumber(row.orderCount),
      formatNumber(row.shipmentCount),
      row.location
    ];
  }))}

  ${renderTable("Zone Performance Detail", [
    "Zone",
    "Active SKUs",
    "Picked units",
    "Order lines",
    "Orders",
    "Shipments"
  ], zoneRows.map(function (row) {
    return [
      row.zone,
      formatNumber(row.activeSkus),
      formatNumber(row.pickedQty),
      formatNumber(row.lineCount),
      formatNumber(row.orderCount),
      formatNumber(row.shipmentCount)
    ];
  }))}

  ${renderTable("Top Monthly SKUs", [
    "SKU",
    "Zone",
    "Picked units",
    "Order lines",
    "Orders",
    "Shipments",
    "Recommended location"
  ], topSkuRows.map(function (row) {
    return [
      row.sku,
      row.recommended_zone || row.zone_key || "",
      formatNumber(row.monthPickedQty),
      formatNumber(row.monthLineCount),
      formatNumber(row.monthOrderCount),
      formatNumber(row.monthShipmentCount),
      row.recommended_location || ""
    ];
  }))}

  ${renderTable("Slotting Detail", [
    "SKU",
    "Recommended zone",
    "Recommended location",
    "Weight (kg)",
    "COI",
    "Monthly picked units",
    "Monthly order lines"
  ], topSkuRows.map(function (row) {
    return [
      row.sku,
      row.recommended_zone || row.zone_key || "",
      row.recommended_location || "",
      formatNumber(row.weight_kg),
      formatNumber(row.coi),
      formatNumber(row.monthPickedQty),
      formatNumber(row.monthLineCount)
    ];
  }))}

  ${renderTable("Benchmark Assumptions", [
    "Metric",
    "Value"
  ], [
    ["Single picking low-height benchmark", "115 items/hour"],
    ["Single picking mid-height benchmark", "95 items/hour"],
    ["Single picking high-height benchmark", "72 items/hour"],
    ["Batch picking low-height benchmark", "180 items/hour"],
    ["Batch picking mid-height benchmark", "150 items/hour"],
    ["Batch picking high-height benchmark", "120 items/hour"],
    ["Height bands", "Low <= 1.5 m, Mid <= 4.0 m, High > 4.0 m"]
  ])}
</body>
</html>`;

    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const monthToken = String(month.id || "month").replace(/[^a-z0-9_-]+/gi, "-");
    const configToken = String(scenario.id || "configuration").replace(/[^a-z0-9_-]+/gi, "-");
    triggerDownload(blob, `performance-print-${monthToken}-${configToken}.xls`);
  }

  function summarizeZones(assignments) {
    const grouped = new Map();
    for (const record of assignments) {
      const key = record.recommended_zone || record.zone_key || "Unassigned";
      if (!grouped.has(key)) {
        grouped.set(key, {
          zone: key,
          activeSkus: 0,
          pickedQty: 0,
          lineCount: 0,
          orderCount: 0,
          shipmentCount: 0
        });
      }
      const current = grouped.get(key);
      current.activeSkus += 1;
      current.pickedQty += Number(record.monthPickedQty || 0);
      current.lineCount += Number(record.monthLineCount || 0);
      current.orderCount += Number(record.monthOrderCount || 0);
      current.shipmentCount += Number(record.monthShipmentCount || 0);
    }
    return Array.from(grouped.values()).sort(function (a, b) {
      return b.pickedQty - a.pickedQty;
    });
  }

  function resolveRouteAssignments(assignments, stops) {
    const stopIds = new Set((stops || []).map(function (stop) { return String(stop.id); }));
    const stopSkus = new Set((stops || []).map(function (stop) { return String(stop.sku); }));
    const matches = (assignments || []).filter(function (record) {
      return stopIds.has(String(record.recommended_location || record.sku)) || stopSkus.has(String(record.sku));
    });
    return matches.length ? matches : (assignments || []);
  }

  function buildBenchmarkSummary(assignments, scenario, kpis, analysis) {
    const totalItems = assignments.reduce(function (sum, record) {
      return sum + Number(record.monthPickedQty || 0);
    }, 0);
    const weightedHeight = assignments.reduce(function (sum, record) {
      const qty = Number(record.monthPickedQty || 0);
      return sum + qty * estimatePickHeight(record);
    }, 0);
    const avgPickHeightM = totalItems > 0 ? weightedHeight / totalItems : 0;
    const benchmarkThroughputRate = resolveBenchmarkThroughput(scenario.pickingId, avgPickHeightM);
    const totalHours = Number(kpis.timeMinutes || 0) / 60;
    const travelHours = Number(analysis.travelDistance || 0) / Math.max(Number(scenario.travelSpeedMps || 1.2), 0.8) / 3600;
    const congestionHours = Math.max(totalHours - travelHours - totalItems / Math.max(benchmarkThroughputRate, 1), 0);
    const handlingHours = totalItems / Math.max(benchmarkThroughputRate, 1);
    const observedThroughputRate = totalHours > 0 ? totalItems / totalHours : 0;

    return {
      totalItems,
      avgPickHeightM,
      heightBandLabel: resolveHeightBand(avgPickHeightM).label,
      benchmarkThroughputRate,
      observedThroughputRate,
      travelHours,
      handlingHours,
      congestionHours,
      totalLaborHours: travelHours + handlingHours + congestionHours
    };
  }

  function estimatePickHeight(record) {
    const level = Number(record.rec_level || 0);
    if (record.zone_key === "kardex") {
      return 0.72 + level * 1.02;
    }
    if (record.zone_key === "small") {
      return 0.68 + level * 0.88;
    }
    return 0.86 + level * 1.35;
  }

  function resolveBenchmarkThroughput(pickingId, avgHeightM) {
    const band = resolveHeightBand(avgHeightM).key;
    const picking = String(pickingId || "").toLowerCase();
    const benchmarks = picking.indexOf("batch") >= 0
      ? { low: 180, mid: 150, high: 120 }
      : { low: 115, mid: 95, high: 72 };
    return benchmarks[band];
  }

  function resolveHeightBand(avgHeightM) {
    if (avgHeightM <= 1.5) {
      return { key: "low", label: "Low pick height" };
    }
    if (avgHeightM <= 4.0) {
      return { key: "mid", label: "Mid pick height" };
    }
    return { key: "high", label: "High pick height" };
  }

  function renderKeyValueTable(title, rows) {
    return renderTable(title, ["Metric", "Value"], rows);
  }

  function renderTable(title, headers, rows) {
    return `
      <h2>${escapeHtml(title)}</h2>
      <table>
        <thead>
          <tr>${headers.map(function (header) { return `<th>${escapeHtml(header)}</th>`; }).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map(function (row) {
            return `<tr>${row.map(function (cell) { return `<td>${escapeHtml(cell)}</td>`; }).join("")}</tr>`;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 0);
  }

  function formatAisle(stop) {
    if (!stop || !Number.isFinite(stop.aisleX)) {
      return "";
    }
    return `x=${Number(stop.aisleX).toFixed(1)}`;
  }

  function formatNumber(value) {
    if (value == null || value === "") {
      return "";
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return String(value);
    }
    return Math.abs(numeric) >= 100 ? numeric.toFixed(0) : numeric.toFixed(2).replace(/\.00$/, "");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})(window.WarehouseTwin);
