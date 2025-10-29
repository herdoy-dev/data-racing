const appId = typeof __app_id !== "undefined" ? __app_id : "default-app-id";
const margin = { top: 20, right: 100, bottom: 20, left: 100 };
const chartArea = document.getElementById("chart-area");
const svg = d3.select("#bar-chart");
let width = chartArea.clientWidth - margin.left - margin.right;
let height = chartArea.clientHeight - margin.top - margin.bottom;

let g;
let raceInterval;
let isRunning = false;
let currentYearIndex = 0;
const speed = 1500;

let allData;
let years;

const xScale = d3.scaleLinear().domain([0, 100]).range([0, width]);

const yScale = d3.scaleBand().range([0, height]).padding(0.2);

function initializeChart() {
  width = chartArea.clientWidth - margin.left - margin.right;
  xScale.range([0, width]);

  svg
    .attr("height", height + margin.top + margin.bottom)
    .attr("width", width + margin.left + margin.right);

  svg.selectAll("*").remove();

  g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(xScale).tickFormat((d) => `${d}%`))
    .selectAll("text")
    .attr("class", "text-sm text-gray-500");

  g.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(yScale).tickSize(0).tickPadding(10))
    .selectAll("text")
    .attr("class", "text-sm font-semibold text-gray-700");

  currentYearIndex = 0;

  if (allData) {
    const initialData = allData[years[currentYearIndex]];
    initialData.sort((a, b) => b.value - a.value);
    yScale.domain(initialData.map((d) => d.name));
    updateChart(initialData);
  }

  document.getElementById("start-race").disabled = false;
  document.getElementById("status-message").textContent =
    "Ready to start the race.";
}

function updateChart(data) {
  data.sort((a, b) => b.value - a.value);
  yScale.domain(data.map((d) => d.name));
  const t = d3.transition().duration(speed).ease(d3.easeLinear);

  g.select(".y-axis")
    .transition(t)
    .call(d3.axisLeft(yScale).tickSize(0).tickPadding(10));

  const bars = g.selectAll(".bar").data(data, (d) => d.name);
  const labels = g.selectAll(".label").data(data, (d) => d.name);

  bars.exit().transition(t).attr("width", 0).remove();

  bars
    .enter()
    .append("rect")
    .attr("class", "bar rounded-r-lg")
    .attr("fill", (d) => d.color)
    .attr("y", (d) => yScale(d.name))
    .attr("height", yScale.bandwidth())
    .attr("x", 0)
    .attr("width", 0)
    .merge(bars)
    .transition(t)
    .attr("y", (d) => yScale(d.name))
    .attr("height", yScale.bandwidth())
    .attrTween("width", function (d) {
      const bar = d3.select(this);
      const oldWidth = parseFloat(bar.attr("width")) || 0;
      const newWidth = xScale(d.value);
      const i = d3.interpolate(oldWidth, newWidth);

      const labelToUpdate = g
        .selectAll(".label")
        .filter((ld) => ld && ld.name === d.name);
      const labelUpdater = (newX) => {
        labelToUpdate.attr("x", newX + 5);
      };

      return function (t) {
        const currentWidth = i(t);
        labelUpdater(currentWidth);
        return currentWidth;
      };
    });

  labels.exit().transition(t).attr("x", 0).remove();

  labels
    .enter()
    .append("text")
    .attr("class", "label text-sm font-mono text-gray-800")
    .attr("y", (d) => yScale(d.name) + yScale.bandwidth() / 2 + 5)
    .attr("x", 0)
    .property("_currentValue", (d) => d.value)
    .text((d) => `${d.value.toFixed(2)}%`)
    .merge(labels)
    .transition(t)
    .attr("y", (d) => yScale(d.name) + yScale.bandwidth() / 2 + 5)
    .tween("text", function (d) {
      const i = d3.interpolate(this._currentValue, d.value);
      this._currentValue = d.value;
      return function (t) {
        this.textContent = `${i(t).toFixed(2)}%`;
      };
    });

  g.selectAll(".bar")
    .on("mouseover", (event, d) => {
      d3.select("#tooltip")
        .style("opacity", 1)
        .html(`<strong>${d.name}</strong>: ${d.value.toFixed(2)}%`);
    })
    .on("mousemove", (event) => {
      d3.select("#tooltip")
        .style("left", event.pageX + 15 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", () => {
      d3.select("#tooltip").style("opacity", 0);
    });

  d3.select("#current-year").text(years[currentYearIndex]);
}

function runRace() {
  if (isRunning) return;
  isRunning = true;
  document.getElementById("start-race").disabled = true;
  document.getElementById("status-message").textContent = "Race in progress...";

  updateChart(allData[years[currentYearIndex]]);

  raceInterval = setInterval(() => {
    currentYearIndex++;
    if (currentYearIndex < years.length) {
      updateChart(allData[years[currentYearIndex]]);
    } else {
      clearInterval(raceInterval);
      isRunning = false;
      document.getElementById("status-message").textContent =
        "Race finished. Data is current for " + years[years.length - 1];
      document.getElementById("start-race").disabled = true;
    }
  }, speed);
}

function resetRace() {
  clearInterval(raceInterval);
  isRunning = false;
  currentYearIndex = 0;
  initializeChart();
  document.getElementById("start-race").disabled = false;
  document.getElementById("status-message").textContent =
    "Ready to start the race.";
}

document.getElementById("start-race").addEventListener("click", runRace);
document.getElementById("reset-race").addEventListener("click", resetRace);

window.addEventListener("resize", () => {
  if (!isRunning) {
    initializeChart();
  }
});

window.onload = () => {
  fetch("data.json")
    .then((response) => response.json())
    .then((data) => {
      allData = data;
      years = Object.keys(allData);
      initializeChart();
    });
};
