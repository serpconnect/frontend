$(function () {
	/* svg settings */
	var width = 450
	var height = 450

	/* remove -10 to make svg fill the square from edge-to-edge */
	var radius = (Math.min(width, height) / 2) - 10
	var nbrPercent = d3.format("%") // e.g 53%
	var nbrSI = d3.format("s") // e.g 5.1k

	/* colorScheme is defined in util/color.js */
	var color = window.util.colorScheme()
	//used to set text size depending on 'zoom' level
	var tier =0;
	//used for back btn referencing 
	var currentTier = tier;
	/* x-axis should map to a full circle, otherwise strange chart */
	var x = d3.scale.linear().range([0, 2 * Math.PI])

	/* use pow scale to make root node radius smaller */
	var y = d3.scale.pow().exponent(1.2).range([0, radius]);

	/* compute relative to total number of entries, found in root */
	function relativeUse(d) {
		/* root node has no parent, but its usage is known (100%) */
		if (!d.parent)
			return 1.0
		var root = d.parent
		while (root.parent)
			root = root.parent
		return d.usage / Math.max(root.usage, 1)
	}
	
	function getStartAngle(d) {
		return Math.max(0, Math.min(2 * Math.PI, x(d.x)))
	}
	function getEndAngle(d) {
		return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx)))
	}

	/* sample x coord of arc for label positioning */
	function arcX(d) {
		var angle = Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx * 0.5)))
		var radius = Math.max(0, y(d.y + d.dy * 0.5))
		return Math.cos(angle - 0.5 * Math.PI) * radius
	}

	/* sample y coord of arc for label positioning */
	function arcY(d) {
		if (d.name === 'serp')
			return 0

		var angle = Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx * 0.5)))
		var radius = Math.max(0, y(d.y + d.dy * 0.5))
		return Math.sin(angle - 0.5 * Math.PI) * radius
	}

	function computeTextRotation(d) {
  		return (x(d.x + d.dx / 2) - Math.PI / 2) / Math.PI * 180;
	}
	/* Idea is to map the flat tree into an arc tree using the computed
	 * extents (d.dx, d.dy). A partition layout normally looks something
	 * like this: http://codepen.io/anon/pen/Bfpmg
	 * The y-axis is used to determine inner and outer radii, while
	 * the x-axis determines start and end angles for the arc.
	 */
	var arc = d3.svg.arc()
		.startAngle(d => Math.max(0, Math.min(2 * Math.PI, x(d.x))))
		.endAngle(d => Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))))
		.innerRadius(d => Math.max(0, y(d.y)))
		.outerRadius(d => Math.max(0, y(d.y + d.dy)))

	function renderGraph(nodeId, dataset, taxonomy) {
		var usage = window.util.computeUsage(dataset, taxonomy)
		var color = window.util.colorScheme(taxonomy)
		var serp = taxonomy.tree()

		/* Ensure that all facets and sub facets have an object that contains the
		 * 'usage' key, which is parsed during treeify and added to the new node.
		 */
		serp.map(function init(node) {
			node.usage = usage[node.id().toLowerCase()]
			node.map(init)
		})

		var partition = d3.layout.partition()
			.value(d => d.size)
			.nodes(window.util.treeify(serp, dataset.nodes().length))

		var svg = d3.select(nodeId)
			.append("svg")
				.attr("width", width)
				.attr("height", height)
				.attr('overflow','visible')
			.append("g")
				.attr("transform", `translate(${width/2}, ${height/2})`)

       function getParent(label){
			if(label == 'serp'){
				return 'serp'
			}
			else{
				var parent = serp.dfs(label).parentId().toLowerCase()
				if(parent =='root') parent='serp'
				return parent
			}
		}

        //temporarily disables Mouse Events for a given time length 
        function toggleMouseEvents(delay,d){
        	mouseOut(d)
	     	svg.selectAll("path")
					.on("mousemove", null)
					.on("mouseout", null)
					.on("click",null)
			svg.selectAll("tspan")
				.on("mousemove", null)
				.on("mouseout", null)
				.on("click",null)
			setTimeout( function(){
				svg.selectAll("path")
					.on("mousemove", mouseMove)
					.on("mouseout", mouseOut)
					.on("click",click)
				svg.selectAll("tspan")
					.on("mousemove", mouseMove)
					.on("mouseout", mouseOut)
					.on("click",click)
			}, delay)
        }

	    function mouseMove(d) {
		 	svg.select('#text'+d.name)
		 		.attr('font-size', d=>labelScale(d)+ (relativeDepth(d)*2))
		 		.attr("transform", function() {return "rotate(0)"  })
		 		.attr('text-anchor', 'middle')
				.attr('x', arcX)
				.attr('y', arcY)
				.attr('dx',"0")
	     	svg.select('#path'+d.name)
				.transition()
				.duration(500)
				.ease('elastic')
				.attr('transform',function(d){
					var dist = -3
					var startAngle = getStartAngle(d)
					var endAngle = getEndAngle(d)
					var midAngle = ((endAngle - startAngle)/2) + startAngle;
					var x = Math.sin(midAngle) * dist;
					var y = Math.cos(midAngle) * dist;
					return 'translate(' + x + ',' + y + ')';
				});
		}

		function mouseOut(d){
			if(d.name=='serp')return
		 	svg.select('#text'+d.name)
				.attr('font-size', d => (labelScale(d)) )
				.attr("x", function(d) { return y(d.y); })
		    	.attr("dx",function(d){return "6"}) 
		    	.attr("y", d.y)
		    	.attr("transform", function() {return "rotate(" + computeTextRotation(d) + ")"})
		    	.attr('text-anchor','none')
		 		.style("text-shadow", "none")
			svg.select('#path'+d.name)
				.transition()
				.duration(500)
				.ease('bounce')
				.attr('transform','translate(0,0)');
		}

		function labelScale(d){
		 	var scale = Math.max(relativeDepth(d)+.5,1)
			return 14/scale
		}

		function pathId(path){
			return 'path'+path 
		}
		function textId(text){
			return 'text'+text
		}

		function facetInfo(d){
			var info = window.info.getInfo(d.name)
			var explanation = document.getElementById('facet-explanation')
			var facetTitle = document.getElementById('facet-title')
			explanation.innerText=info.description
			var title = d.name
			if(d.name!='serp'){
				explanation.style.fontStyle= "normal"
				explanation.style.color = "black"
			}
			else{
				explanation.style.fontStyle= "italic"
				explanation.style.color = ''
			}
			if(getParent(d.name)!= 'root' || getParent(d.name)!= "serp"){
				title = title +' ('+ getParent(d.name)+')'
			}
			facetTitle.innerText = title
			var square = document.getElementById('square')
			square.style.background = color(d.name)(relativeUse(d))
		}

		function relativeDepth(d){
			return d.depth-tier
		}

      	function arcTween(d) {
		  	var xd = d3.interpolate(x.domain(), [d.x, d.x + d.dx]),
		     	yd = d3.interpolate(y.domain(), [d.y, 1]),
		      	yr = d3.interpolate(y.range(), [d.y ? 20 : 0, radius]);
			return function(d, i) {
		    	return i
		        ? function(t) { return arc(d); }
		        : function(t) { x.domain(xd(t)); y.domain(yd(t)).range(yr(t)); return arc(d); };
		  };
		}

		function pathWindUp(d){
			svg.selectAll('text').transition().attr("opacity", 0)
				.attr('font-size', d => labelScale(d))
		  	svg.selectAll("path").transition()
		  		.duration(750)
		  		.attrTween("d",arcTween(d))
			    .each("end", function(e, i) {
		        	// check if the animated element's data e lies within the visible angle span given in d
		          	if (e.name!=='serp' && e.x >= d.x && e.x < (d.x + d.dx)) {
			        // get a selection of the associated text element
		            var arcText = d3.select("#text"+e.name);
		            // fade in the text element and recalculate positions
		            arcText.transition().duration(750)
		              .attr("opacity", 1)
		              .attr("transform", function() {return "rotate(" + computeTextRotation(e) + ")"  })
		              .attr("x", function(d) { return y(d.y); });
	        		}
	        		else{
			        	svg.select("#textserp")
			        		.attr("transform", "rotate(0)")
			        		.attr('dx',"0")
			        		.attr("opacity", 1)
							.attr('text-anchor', 'middle')
							.attr('x', arcX)
							.attr('y', arcY)
			        }
		    	})
		}
		//use to isolate direction of taxonomy exporer 
		function getActiveList(d, list){
			var children = d.children
			if(typeof children!== 'undefined' && children.length >0){
				children.forEach( child => {
					if(typeof child.children !== 'undefined' && child.children.length >0){
						getActiveList(child, list)
					}
					list.push(child)
				})
			}
			return
		}

		function getHiddenItems(reverseList, type){
			var list = svg.selectAll(type).filter(function(item){
  				return reverseList.indexOf(item) === -1;
			}) 
			return list
		}
		function getActiveItems (reverseList,type){
			var list = svg.selectAll(type).filter(function(item){
  				return reverseList.indexOf(item) != -1;
			})
			return list
		} 

		function click(d){
			function first(d) {
				return new Promise(function (R, F) {
	       			zoom(d)
	     			setTimeout(R, 800)
   				})
   			}
			if(d.depth-tier!=0){
				facetInfo(d)
				first(d)
			}
		}

		function zoom(d) {
			var activeList =[]
			toggleMouseEvents(800, d)
			currentTier = tier
			tier = d.depth
			getActiveList(d, activeList)
			activeList.push(d)		
			var hiddenText = getHiddenItems(activeList,'text')
			var activeText = getActiveItems(activeList,'text')
			//add BackButton
			svg.selectAll("path").filter( function(path){ 
				if(path.name==getParent(d.name)) {
				 	activeList.push(path)
				}
			})
			var hiddenFacets = getHiddenItems(activeList,'path')
			var activeFacets = getActiveItems(activeList,'path')
			activeText[0].forEach(active => {
				setTimeout(function(){
					active.classList.remove("hide")
				},300)
			})
			hiddenText[0].forEach(hidden => {
				hidden.classList.add("hide");
			})
			activeFacets[0].forEach(active => {
				active.classList.remove("disappear")
				active.classList.remove("hide")
			})
			hiddenFacets[0].forEach(hidden => {
				hidden.classList.add("disappear")
				hidden.classList.add("hide")
			})
			pathWindUp(d)
		}

		/* setup the main graph */
		svg.selectAll("path")
			.data(partition).enter()
			.append("path")
				.attr("d", arc)
				.attr("id", d=> 'path'+d.name)
				.style("fill", d => color(d.name)(relativeUse(d)))
				.style("stroke", '#f2f2f2')
				.on("mousemove", mouseMove)
				.on("mouseout", mouseOut)
				.on("click", click)

		/* add labels positioned at area center */
		svg.selectAll("text")
			.data(partition).enter()
			.append('text')
			.attr("id", d => 'text'+d.name)
			.attr('font-family', 'Arial, sans-serif')
			.attr("transform", function(d) { if(d.name!='serp')return "rotate(" + computeTextRotation(d) + ")"  })
		    .attr("x", function(d) { return y(d.y); })
		    .attr("dx",function(d){ if(d.name!='serp') return "6"}) // margin
		    .attr("dy", ".35em") // vertical-align
		    .text(function(d) { return d.name; })
			.on("mousemove", mouseMove)
			.on("mouseout", mouseOut)
			.on("click", click)
			.attr('font-size', d => labelScale(d))
			svg.select("#textserp")
				.attr('text-anchor', 'middle')
				.attr('x', arcX)
				.attr('y', arcY)

	}
// 	Dataset.loadDefault(data => {
// 		api.v1.taxonomy().then(serp => {
// 			var taxonomy = new window.Taxonomy(serp.taxonomy)
// 			renderGraph('#taxonomy', data, taxonomy)
// 		})
// 	})
// })
// // only works on live
Dataset.loadDefault(data => {
		Promise.all([
			api.v1.taxonomy(),
			api.v1.collection.taxonomy(682)
		]).then(taxonomies => {
			var taxonomy = new window.Taxonomy(taxonomies[0].taxonomy)
			taxonomy.extend(taxonomies[1].taxonomy)
			//taxonomy.extend(taxonomies[1].taxonomy)
			renderGraph('#taxonomy', data, taxonomy)
		})
	})
})