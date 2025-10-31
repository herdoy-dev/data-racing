const container = document.getElementById("container");
const width = container.clientWidth;
const containerHeight = container.clientHeight || window.innerHeight;
const margin = { top: 16, right: 6, bottom: 6, left: 60 };
const n = 10;

barSize = Math.max(24, Math.floor((containerHeight - margin.top - margin.bottom) / n));
const k = 10;

// Duration will be calculated dynamically based on actual data
let duration = 250; // default, will be recalculated

const dataURL = "./data.csv";

d3.csv(dataURL, d3.autoType).then((data) => {
  console.log(data);

  const names = new Set(data.map((d) => d.name));

  const datevalues = Array.from(
    d3.rollup(
      data,
      ([d]) => d.value,
      (d) => +d.date,
      (d) => d.name
    )
  )

    .map(([date, data]) => [new Date(date), data])
    .sort(([a], [b]) => d3.ascending(a, b));

  const nameColorMap = new Map(data.map((d) => [d.name, d.color]));
  
  // Function to extract dominant color from an image
  function extractDominantColor(imageUrl, callback) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = function() {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Sample pixels (every 10th pixel for performance)
        const colorCounts = {};
        const sampleStep = 10;
        
        for (let i = 0; i < data.length; i += 4 * sampleStep) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          
          // Skip transparent pixels
          if (a < 128) continue;
          
          // Skip very light pixels (likely background)
          if (r > 240 && g > 240 && b > 240) continue;
          
          // Skip very dark pixels (likely text/outline)
          if (r < 20 && g < 20 && b < 20) continue;
          
          // Quantize colors to reduce variance
          const qr = Math.floor(r / 32) * 32;
          const qg = Math.floor(g / 32) * 32;
          const qb = Math.floor(b / 32) * 32;
          
          const key = `${qr},${qg},${qb}`;
          colorCounts[key] = (colorCounts[key] || 0) + 1;
        }
        
        // Find the most common color
        let maxCount = 0;
        let dominantColor = null;
        for (const [color, count] of Object.entries(colorCounts)) {
          if (count > maxCount) {
            maxCount = count;
            dominantColor = color;
          }
        }
        
        if (dominantColor) {
          const [r, g, b] = dominantColor.split(',').map(Number);
          const hex = `#${[r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
          }).join('')}`;
          callback(hex);
        } else {
          callback(null);
        }
      } catch (e) {
        console.warn('Error extracting color:', e);
        callback(null);
      }
    };
    
    img.onerror = function() {
      callback(null);
    };
    
    img.src = imageUrl;
  }
  
  function getLogoUrl(name) {
    // Use logo.dev as primary source (more reliable)
    // Fallback to Clearbit if needed
    const logoMap = {
      "IBM": "https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/ibm.svg",
      "Coca-Cola": "https://logo.clearbit.com/coca-cola.com",
      "Microsoft": "https://logo.clearbit.com/microsoft.com",
      "Intel": "https://logo.clearbit.com/intel.com",
      "Nokia": "https://logo.clearbit.com/nokia.com",
      "GE": "https://logo.clearbit.com/ge.com",
      "Ford": "https://logo.clearbit.com/ford.com",
      "Disney": "https://logo.clearbit.com/disney.com",
      "McDonald's": "https://logo.clearbit.com/mcdonalds.com",
      "AT&T": "https://logo.clearbit.com/att.com",
      "Mercedes-Benz": "https://logo.clearbit.com/mercedes-benz.com",
      "HP": "https://logo.clearbit.com/hp.com",
      "Cisco": "https://logo.clearbit.com/cisco.com",
      "Toyota": "https://logo.clearbit.com/toyota.com",
      "Citi": "https://logo.clearbit.com/citi.com",
      "Gillette": "https://logo.clearbit.com/gillette.com",
      "Sony": "https://logo.clearbit.com/sony.com",
      "American Express": "https://logo.clearbit.com/americanexpress.com",
      "Honda": "https://logo.clearbit.com/honda.com",
      "BMW": "https://logo.clearbit.com/bmw.com",
      "Nike": "https://logo.clearbit.com/nike.com",
      "Apple": "https://logo.clearbit.com/apple.com",
      "Amazon": "https://logo.clearbit.com/amazon.com",
      "Samsung": "https://logo.clearbit.com/samsung.com",
      "Starbucks": "https://logo.clearbit.com/starbucks.com",
      "IKEA": "https://logo.clearbit.com/ikea.com"
    };
    
    // Return direct URL if in map, otherwise generate from name
    if (logoMap[name]) {
      return logoMap[name];
    }
    
    // Fallback: generate URL from company name
    const domain = name.toLowerCase().replace(/[^a-z0-9]/g, '') + ".com";
    return `https://logo.clearbit.com/${domain}`;
  }
  
  const nameLogoMap = new Map(data.map((d) => [d.name, d.logo || getLogoUrl(d.name)]));
  
  // Extract colors from logos
  let colorExtractionPromises = [];
  const uniqueNames = Array.from(names);
  
  uniqueNames.forEach(name => {
    const logoUrl = nameLogoMap.get(name);
    if (logoUrl) {
      const promise = new Promise((resolve) => {
        extractDominantColor(logoUrl, (color) => {
          if (color) {
            nameColorMap.set(name, color);
          }
          resolve();
        });
      });
      colorExtractionPromises.push(promise);
    }
  });
  
  // Wait for all colors to be extracted before starting visualization
  Promise.all(colorExtractionPromises).then(() => {
    console.log('Color extraction complete. Starting visualization...');
    startVisualization();
  }).catch(() => {
    console.warn('Some colors failed to extract. Starting visualization with fallback colors...');
    startVisualization();
  });
  
  function startVisualization() {
    
    // Calculate duration for 6 minutes total based on actual data
    // Each pair of consecutive years creates k+1 keyframes
    const totalSeconds = 360; // 6 minutes
    const numPairs = datevalues.length - 1;
    const totalKeyframes = numPairs * (k + 1);
    duration = Math.round((totalSeconds * 1000) / totalKeyframes);
    console.log(`Animation duration: ${duration}ms per keyframe, ${totalKeyframes} total keyframes, ${totalSeconds}s total`);
  
    function rank(valueFunc) {
      const data = Array.from(names, (name) => ({
        name,
        value: valueFunc(name),
        color: nameColorMap.get(name),
        logo: nameLogoMap.get(name),
      }));
      data.sort((a, b) => d3.descending(a.value, b.value));
      for (let i = 0; i < data.length; ++i) data[i].rank = Math.min(n, i);
      return data;
    }

    const keyframes = [];
    let ka, a, kb, b;
    for ([[ka, a], [kb, b]] of d3.pairs(datevalues)) {
      for (let i = 0; i < k; ++i) {
        const t = i / k;

        keyframes.push([
          new Date(ka * (1 - t) + kb * t),
          rank((name) => (a.get(name) || 0) * (1 - t) + (b.get(name) || 0) * t),
        ]);
      }

      keyframes.push([new Date(kb), rank((name) => b.get(name) || 0)]);
    }

    const nameframes = d3.groups(
      keyframes.flatMap(([, data]) => data),
      (d) => d.name
    );

    const prev = new Map(
      nameframes.flatMap(([, data]) => d3.pairs(data, (a, b) => [b, a]))
    );

    const next = new Map(nameframes.flatMap(([, data]) => d3.pairs(data)));

    const x = d3.scaleLinear([0, 1], [margin.left, width - margin.right]);

    const y = d3
      .scaleBand()
      .domain(d3.range(n + 1))
      .rangeRound([margin.top, margin.top + barSize * (n + 1 + 0.1)])
      .padding(0.2);

    const color = (d) => d.color;


    function bars(svg) {
      let bar = svg.append("g").attr("fill-opacity", 0.6).selectAll("rect");

      return ([date, data], transition) =>
        (bar = bar

          .data(data.slice(0, n), (d) => d.name)
          .join(
            (enter) =>
              enter
                .append("rect")

                .attr("fill", color)
                .attr("height", y.bandwidth())
                .attr("x", x(0))
                .attr("y", (d) => y((prev.get(d) || d).rank))
                .attr("width", (d) => x((prev.get(d) || d).value) - x(0)),
            (update) => update,
            (exit) =>
              exit
                .transition(transition)
                .remove()
                .attr("y", (d) => y((next.get(d) || d).rank))
                .attr("width", (d) => x((next.get(d) || d).value) - x(0))
          )
          .call((bar) =>
            bar
              .transition(transition)
              .attr("y", (d) => y(d.rank))
              .attr("width", (d) => x(d.value) - x(0))
          ));
    }

    function axis(svg) {
      const g = svg.append("g").attr("transform", `translate(0,${margin.top})`);

    const tickFormat = undefined;
    const axis = d3
      .axisTop(x)
      .ticks(width / 160, tickFormat)
      .tickSizeOuter(0)

      .tickSizeInner(-barSize * (n + y.padding()));

      return (_, transition) => {
        g.transition(transition).call(axis);
        g.select(".tick:first-of-type text").remove();
        g.selectAll(".tick:not(:first-of-type) line").attr("stroke", "white");
        g.select(".domain").remove();
      };
    }

    function textTween(a, b) {
      const i = d3.interpolateNumber(a, b);

      const formatNumber = d3.format(",d");

      return function (t) {
        this.textContent = formatNumber(i(t));
      };
    }

    function labels(svg) {
      let label = svg
        .append("g")
        .style("font-variant-numeric", "tabular-nums")
        .attr("text-anchor", "end")
        .selectAll("g");

      // Size calculations relative to bar height
      const logoSize = Math.floor(y.bandwidth() * 0.8);
      const nameFontSize = 20; // fixed company name size
      const valueFontSize = Math.max(11, Math.floor(nameFontSize * 0.8));
      const logoX = -logoSize - 10;
      const textX = -logoSize - 14;
      const groupPadX = 6; // small horizontal padding for name+number group

      return ([date, data], transition) =>
        (label = label
          .data(data.slice(0, n), (d) => d.name)
          .join(
            (enter) => {
              const g = enter.append("g")
                .attr(
                  "transform",
                  (d) =>
                    `translate(${x((prev.get(d) || d).value)},${y(
                      (prev.get(d) || d).rank
                    )})`
                );

              // Add logo image (scaled to 80% of bar height, vertically centered)
              const logoImage = g.append("image")
                .attr("href", (d) => d.logo || nameLogoMap.get(d.name))
                .attr("x", logoX)
                .attr("y", (y.bandwidth() - logoSize) / 2)
                .attr("width", logoSize)
                .attr("height", logoSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .style("border-radius", "4px")
                .on("error", function(d) {
                  // Try alternative logo URL if primary fails (especially for IBM)
                  const currentUrl = d3.select(this).attr("href");
                  if (currentUrl && currentUrl.includes("ibm.com")) {
                    // Try alternative URL format
                    d3.select(this)
                      .attr("href", "https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/ibm.svg")
                      .on("error", function() {
                        d3.select(this).style("display", "none");
                      });
                  } else {
                    d3.select(this).style("display", "none");
                  }
                });

              // Group for name and number to center them together
              const nameNumberGroup = g.append("g")
                .attr("class", "name-number-group")
                .attr("transform", `translate(${textX - groupPadX}, ${y.bandwidth() / 2})`);

              // Calculate total height of name + number for centering
              const nameHeight = nameFontSize;
              const numberHeight = valueFontSize;
              const spacing = Math.max(6, Math.floor(nameFontSize * 0.4)); // Reduced spacing for less gap
              const totalHeight = nameHeight + spacing + numberHeight;
              
              // Add company name (centered as part of the group)
              nameNumberGroup.append("text")
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .attr("y", -totalHeight / 2 + nameHeight / 2)
                .style("font", `bold ${nameFontSize}px var(--sans-serif)`)
                .text((d) => d.name);

              // Add value below name, centered as part of the group
              const formatNumber = d3.format(",d");
              nameNumberGroup.append("text")
                .attr("class", "value")
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .attr("y", -totalHeight / 2 + nameHeight + spacing + numberHeight / 2)
                .attr("fill-opacity", 0.9)
                .attr("font-weight", "bold")
                .style("font", `bold ${valueFontSize}px var(--sans-serif)`)
                .text((d) => formatNumber(d.value));

              return g;
            },
            (update) => {
              // Update logo href and keep positions in sync
              update.select("image")
                .attr("href", (d) => d.logo || nameLogoMap.get(d.name))
                .attr("x", logoX)
                .attr("y", (y.bandwidth() - logoSize) / 2)
                .attr("width", logoSize)
                .attr("height", logoSize);

              // Update name+number group position
              const nameHeight = nameFontSize;
              const numberHeight = valueFontSize;
              const spacing = Math.max(6, Math.floor(nameFontSize * 0.4)); // Reduced spacing for less gap
              const totalHeight = nameHeight + spacing + numberHeight;
              
              update.select("g.name-number-group")
                .attr("transform", `translate(${textX - groupPadX}, ${y.bandwidth() / 2})`);
              
              update.select("g.name-number-group text")
                .filter(function() { return !d3.select(this).classed("value"); })
                .attr("y", -totalHeight / 2 + nameHeight / 2)
                .style("font", `bold ${nameFontSize}px var(--sans-serif)`);

              update.select("g.name-number-group text.value")
                .attr("y", -totalHeight / 2 + nameHeight + spacing + numberHeight / 2)
                .style("font", `${valueFontSize}px var(--sans-serif)`);

              return update;
            },
            (exit) =>
              exit
                .transition(transition)
                .remove()
                .attr(
                  "transform",
                  (d) =>
                    `translate(${x((next.get(d) || d).value)},${y(
                      (next.get(d) || d).rank
                    )})`
                )
                .call((g) =>
                  g
                    .select("g.name-number-group text.value")
                    .tween("text", (d) =>
                      textTween(d.value, (next.get(d) || d).value)
                    )
                )
          )
          .call((bar) =>
            bar
              .transition(transition)
              .attr("transform", (d) => `translate(${x(d.value)},${y(d.rank)})`)
              .call((g) =>
                g
                  .select("g.name-number-group text.value")
                  .tween("text", (d) =>
                    textTween((prev.get(d) || d).value, d.value)
                  )
              )
          ));
    }

    function ticker(svg) {
      const formatDate = d3.utcFormat("%Y");

      const now = svg
        .append("text")

        .style("font", `bold ${barSize}px var(--sans-serif)`)
        .style("font-variant-numeric", "tabular-nums")
        .attr("text-anchor", "end")

        .attr("x", width - 6)
        .attr("y", margin.top + barSize * (n - 0.45))
        .attr("dy", "0.32em")

        .text(formatDate(keyframes[0][0]));

      return ([date], transition) => {
        transition.end().then(() => now.text(formatDate(date)));
      };
    }

    const height = margin.top + barSize * n + margin.bottom;

    const svg = d3
      .select("#container")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    const updateBars = bars(svg);
    const updateAxis = axis(svg);
    const updateLabels = labels(svg);
    const updateTicker = ticker(svg);

    (async function () {
      for (const keyframe of keyframes) {
        const transition = svg
          .transition()
          .duration(duration)
          .ease(d3.easeLinear);
        x.domain([0, keyframe[1][0].value]);
        updateAxis(keyframe, transition);
        updateBars(keyframe, transition);
        updateLabels(keyframe, transition);
        updateTicker(keyframe, transition);
        await transition.end();
      }
    })();
  } // end startVisualization
  
});
