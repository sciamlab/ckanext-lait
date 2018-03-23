moment.locale('it');

var infograph_config = JSON.parse(document.getElementById('infograph_config').getAttribute('data'));
// console.log('infograph_config', infograph_config);
// infograph_config.graph_type = 'bar';
console.log('graph_type:',infograph_config.graph_type);
console.log('axis1:',infograph_config.axis1);
console.log('axis2:',infograph_config.axis2);

var infograph_data = JSON.parse(document.getElementById('infograph_data').getAttribute('data'));
console.log('infograph_data', infograph_data);

var margin = {top: 20, right: 20, bottom: 30, left: 80};

var tooltip = d3.select("body").append("div").attr("class", "toolTip");
var tooltip_show = function(d){
	if(d.data)
		d = d.data;
	tooltip
		.style("left", d3.event.pageX - 50 + "px")
		.style("top", d3.event.pageY - 90 + "px")
		.style("display", "inline-block")
		.html("<strong>" + infograph_config.axis1 + ": </strong>" + d.axis1
		 + "<br><strong>" + infograph_config.axis2 + ": </strong>" + d.axis2.toLocaleString('it'));
};
var tooltip_hide = function(d){
	tooltip
		.style("display", "none");
};

var infograph_data_max = d3.max(infograph_data.map(function(d) { return d.axis2; }));

if(infograph_config.graph_type=='pie'){
	/*
	 * PIE CHART
	 */
	var svg_pie = d3.select("svg.pie_chart");
	var width_pie = +svg_pie.attr("width");// - margin.left - margin.right;
	var height_pie = +svg_pie.attr("height");// - margin.top - margin.bottom;
	var g_pie = svg_pie.append("g").attr("transform", "translate(" + width_pie / 2 + "," + height_pie / 2 + ")");
	var radius = Math.min(width_pie, height_pie) / 2;

	var pie_data = infograph_data;

	var color = d3.scaleOrdinal(jsgradient.generateGradient('#002742', '#a3a3a3', pie_data.length));

	var pie = d3.pie().sort(null).value(function(d) { return d.axis2; });

	var path = d3.arc()
			.outerRadius(radius - 10)
			.innerRadius(0);

	var label = d3.arc()
			.outerRadius(radius - 40)
			.innerRadius(radius - 40);

	var arc = g_pie.selectAll(".arc")
		.data(pie(pie_data))
		.enter().append("g")
			.attr("class", "arc")
			.on("mousemove", tooltip_show)
  		.on("mouseout", tooltip_hide);

	arc.append("path")
			.attr("d", path)
			.attr("fill", function(d) { return color(d.data.axis2); });

	arc.append("text")
			.attr("transform", function(d) { return "translate(" + label.centroid(d) + ")"; })
			.attr("dy", "0.35em")
			.text(function(d) { return d.data.axis1; });

}else if(infograph_config.graph_type=='line'){
	/*
	 * LINE CHART
	 */
	var svg_line = d3.select("svg.line_chart");
	var width_line = +svg_line.attr("width") - margin.left - margin.right;
	var height_line = +svg_line.attr("height") - margin.top - margin.bottom;
	var g_line = svg_line.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	// var x_line = d3.scaleBand()
	// 		.rangeRound([0, width_line])
	// 		.padding(1);

	var x_line = d3.scaleTime()
    .rangeRound([0, width_line]);

	var y_line = d3.scaleLinear()
		.rangeRound([height_line, 0]);

	var line = d3.line()
		.x(function(d) { return x_line(d.axis1); })
		.y(function(d) { return y_line(d.axis2); })

	// x_line.domain(infograph_data.map(function(d) { return d.axis1; }));
	// y_line.domain([0, infograph_data_max]);
  //
	// g_line.append("g")
	// 	 .attr("class", "axis axis--x")
	// 	 .attr("transform", "translate(0," + height_line + ")")
	// 	 .call(d3.axisBottom(x_line));
  //
	// g_line.append("g")
	// 	 .attr("class", "axis axis--y")
	// 	 .call(d3.axisLeft(y_line).ticks(10))
	//  .append("text")
	// 	 .attr("transform", "rotate(-90)")
	// 	 .attr("y", 6)
	// 	 .attr("dy", "0.71em")
	// 	 .attr("text-anchor", "end")
	// 	 .text("Frequency");
  //
	// g_line.append("path")
	//  .datum(infograph_data)
	//  .attr("class", "line")
	//  .attr("d", line);
  //
	// g_line.selectAll("circle")
	//  .data(infograph_data)
	// .enter().append("circle")
	//  .attr("class", "circle")
	//  .attr("cx", function(d) { return x_line(d.axis1); })
	//  .attr("cy", function(d) { return y_line(d.axis2); })
	//  .attr("r", 5)
	//  .on("mousemove", tooltip_show)
	//  .on("mouseout", tooltip_hide);

	var parseTime = d3.timeParse("%Y-%m-%dT%H:%M:%S");
	var line_data = infograph_data.map(function(d) {
		return {
			'axis1': parseTime(moment(d.axis1).tz("Europe/Rome").format("YYYY-MM-DDTHH:mm:ss")),
			'axis2': d.axis2
		};
	})

	x_line.domain(d3.extent(line_data, function(d) { return d.axis1; }));
	y_line.domain(d3.extent(line_data, function(d) { return d.axis2; }));

	g_line.append("g")
			.attr("class", "axis axis--x")
			.attr("transform", "translate(0," + height_line + ")")
      .call(d3.axisBottom(x_line)
			// .tickFormat(d3.timeFormatLocale(locale_it).timeFormat("%Y-%m-%d"))
		)
    // .select(".domain")
    //   .remove()
			;

  g_line.append("g")
			.attr("class", "axis axis--y")
		  .call(d3.axisLeft(y_line))
    .append("text")
      .attr("fill", "#000")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", "0.71em")
      .attr("text-anchor", "end")
      .text(infograph_config.axis2)
			;

  g_line.append("path")
			.attr("class", "line")
			.datum(line_data)
      .attr("d", line);

	var focus = g_line.append("g")
      .attr("class", "focus")
      .style("display", "none");

  focus.append("line")
      .attr("class", "x-hover-line hover-line")
      .attr("y1", 0)
      .attr("y2", height_line);

  focus.append("line")
      .attr("class", "y-hover-line hover-line")
      .attr("x1", width_line)
      .attr("x2", width_line);

  focus.append("circle")
      .attr("r", 3);

  // focus.append("text")
  //     .attr("x", 15)
  //   	.attr("dy", ".31em");

  svg_line.append("rect")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
      .attr("class", "overlay")
      .attr("width", width_line)
      .attr("height", height_line)
      .on("mouseover", function() { focus.style("display", null); })
      .on("mouseout", function() { focus.style("display", "none"); })
      .on("mousemove", mousemove);

	var bisectDate = d3.bisector(function(d) { return d.axis1; }).left;

  function mousemove() {
    var x0 = x_line.invert(d3.mouse(this)[0]),
        i = bisectDate(line_data, x0, 1),
        d0 = line_data[i - 1],
        d1 = line_data[i],
        d = x0 - d0.axis1 > d1.axis1 - x0 ? d1 : d0;
    focus.attr("transform", "translate(" + x_line(d.axis1) + "," + y_line(d.axis2) + ")");
    // focus.select("text").text(function() { return d.axis2; });
    focus.select(".x-hover-line").attr("y2", height_line - y_line(d.axis2));
    focus.select(".y-hover-line").attr("x2", width_line + width_line);
		tooltip_show({
			'axis1': moment(d.axis1).tz("Europe/Rome").format("D MMM YYYY, HH:mm:ss"),
			'axis2': d.axis2
		});
  }

}else if(infograph_config.graph_type=='bar'){
	/*
	 * BAR CHART
	 */

	var svg_bar = d3.select("svg.bar_chart");
	var width_bar = +svg_bar.attr("width") - margin.left - margin.right;
	var height_bar = +svg_bar.attr("height") - margin.top - margin.bottom;

	var x_bar = d3.scaleBand()
		.rangeRound([0, width_bar])
		.padding(0.1);

	var y_bar = d3.scaleLinear()
		.rangeRound([height_bar, 0]);

	var g_bar = svg_bar.append("g")
			.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	x_bar.domain(infograph_data.map(function(d) { return d.axis1; }));
	y_bar.domain([0, infograph_data_max]);

	g_bar.append("g")
			.attr("class", "axis axis--x")
			.attr("transform", "translate(0," + height_bar + ")")
			.call(d3.axisBottom(x_bar));

	g_bar.append("g")
			.attr("class", "axis axis--y")
			.call(d3.axisLeft(y_bar)
			// .ticks(10
				// , "%"
			// )
			)
		.append("text")
			.attr("fill", "#000")
			.attr("transform", "rotate(-90)")
			.attr("y", 6)
			.attr("dy", "0.71em")
			.attr("text-anchor", "end")
			.text(infograph_config.axis2)
			;

	g_bar.selectAll(".bar")
		.data(infograph_data)
		.enter().append("rect")
			.attr("class", "bar")
			.attr("x", function(d) { return x_bar(d.axis1); })
			.attr("y", function(d) { return y_bar(d.axis2); })
			.attr("width", x_bar.bandwidth())
			.attr("height", function(d) { return height_bar - y_bar(d.axis2); })
			.on("mousemove", tooltip_show)
  		.on("mouseout", tooltip_hide);
}

// $(document).ready(function() {});

// var locale_it = {
//   "dateTime": "%A %e %B %Y, %X",
//   "date": "%d/%m/%Y",
//   "time": "%H:%M:%S",
//   "periods": ["AM", "PM"],
//   "days": ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"],
//   "shortDays": ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"],
//   "months": ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"],
//   "shortMonths": ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"]
// };
