/* Module for handling the spatial querying
 */
L.Icon.Default.imagePath = '../img/leaflet';
this.ckan.module('geolocalization', function ($, _) {

  return {
    options: {
      i18n: {
      },
      style: {
        color: '#F06F64',
        weight: 2,
        opacity: 1,
        fillColor: '#F06F64',
        fillOpacity: 0.1
      },
      default_extent: [[90, 180], [-90, -180]]
    },
    template: {},

    initialize: function () {
      var module = this;
      $.proxyAll(this, /_on/);

      var user_default_extent = this.el.data('default_extent');
      if (user_default_extent ){
        if (user_default_extent instanceof Array) {
          // Assume it's a pair of coords like [[90, 180], [-90, -180]]
          this.options.default_extent = user_default_extent;
        } else if (user_default_extent instanceof Object) {
          // Assume it's a GeoJSON bbox
          this.options.default_extent = new L.GeoJSON(user_default_extent).getBounds();
        }
      }
      
      this.options.messageGeoJsonNotValid = this.el.attr('messageGeoJsonNotValid');
      
      this.el.ready(this._onReady);
    },

    _getParameterByName: function (name) {
      var match = RegExp('[?&]' + name + '=([^&]*)')
                        .exec(window.location.search);
      return match ?
          decodeURIComponent(match[1].replace(/\+/g, ' '))
          : null;
    },

    _drawExtentFromCoords: function(xmin, ymin, xmax, ymax) {
        if ($.isArray(xmin)) {
            var coords = xmin;
            xmin = coords[0]; ymin = coords[1]; xmax = coords[2]; ymax = coords[3];
        }
        return new L.Rectangle([[ymin, xmin], [ymax, xmax]],
                               this.options.style);
    },

    _drawExtentFromGeoJSON: function(geom) {
        return new L.GeoJSON(geom, {style: this.options.style});
    },

    _onReady: function() {
      var module = this;
      var map;
      var extentLayer;
      var previous_box;
      var previous_extent;
      var is_exanded = false;
      var should_zoom = true;

      var buttons;

      //Aggiunto evento per sincronizzazione su mappa
      $('#field-spatial').on("blur", syncroMap )

      // OK map time
      map = ckan.commonLeafletMap('geolocalization-map-container', this.options.map_config, {attributionControl: false});

      var drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);

		
      // Initialize the draw control
      map.addControl(new L.Control.Draw({
			draw: {
				polyline: {
					metric: true
				},
				polygon: {
					allowIntersection: false,
					showArea: true,
					drawError: {
						color: '#b00b00',
						timeout: 1000
					},
					shapeOptions: {
						color: '#bada55'
					}
				},
				rectangle: false,
				circle: false,
				marker: true
			},
			edit: {
				featureGroup: drawnItems,
				remove: true
			}			
		    }));

		map.on('draw:created', function (e) {
			var type = e.layerType,
				layer = e.layer;

			/*if (type === 'marker') {
				layer.bindPopup('A popup!');
			}*/
			$('#field-spatial')[0].value = JSON.stringify(layer.toGeoJSON().geometry);

			drawnItems.clearLayers();
			drawnItems.addLayer(layer);
		});

		map.on('draw:edited', function (e) {
			$('#field-spatial')[0].value = JSON.stringify(drawnItems.getLayers()[0].toGeoJSON().geometry);
		});
		
		map.on('draw:deleted', function (e) {
			$('#field-spatial')[0].value = '';
		});		
		
	  if ($('#field-spatial')[0].value != '')
	  {
		  syncroMap();
	  }

      // Record the current map view so we can replicate it after submitting
      map.on('moveend', function(e) {
        $('#ext_prev_extent').val(map.getBounds().toBBoxString());
      });
      $('#mapDiv').show(); 
      // Ok setup the default state for the map
      var previous_bbox;
      setPreviousBBBox();
      setPreviousExtent();     
      $('#mapDiv').hide(); 

      // OK, when we expand we shouldn't zoom then
      map.on('zoomstart', function(e) {
        should_zoom = false;
      });


      // Is there an existing box from a previous search?
      function setPreviousBBBox() {
        previous_bbox = module._getParameterByName('ext_bbox');
        if (previous_bbox) {
          $('#ext_bbox').val(previous_bbox);
          extentLayer = module._drawExtentFromCoords(previous_bbox.split(','))
          map.addLayer(extentLayer);
          map.fitBounds(extentLayer.getBounds());
        }
      }

      // Is there an existing extent from a previous search?
      function setPreviousExtent() {
        previous_extent = module._getParameterByName('ext_prev_extent');
        if (previous_extent) {
          coords = previous_extent.split(',');
          map.fitBounds([[coords[1], coords[0]], [coords[3], coords[2]]]);
        } else {
          if (!previous_bbox){
              map.fitBounds(module.options.default_extent);
          }
        }
      }
      
      function syncroMap() {
    	var json = null;
    	try
    	{
    		json = jQuery.parseJSON($('#field-spatial')[0].value);
    	}
    	catch (e)
    	{
    		alert(module.options.messageGeoJsonNotValid);
    		return;
    	}
		drawnItems.clearLayers();

		var geoJsonLayer = L.geoJson(json, {});	
		if (geoJsonLayer.getLayers().length > 0){
			if (geoJsonLayer.getLayers()[0].feature.geometry.type  == 'Polygon')
			{
				var layer = L.polygon( geoJsonLayer.getLayers()[0].getLatLngs(), {} )
				drawnItems.addLayer(layer);		
			}
			else if (geoJsonLayer.getLayers()[0].feature.geometry.type == 'LineString')
			{
				var layer = L.polyline( geoJsonLayer.getLayers()[0].getLatLngs(), {} )
				drawnItems.addLayer(layer);		
			}
			else if (geoJsonLayer.getLayers()[0].feature.geometry.type == 'Point')
			{
				var layer = L.marker( geoJsonLayer.getLayers()[0].getLatLng(), {} )
				drawnItems.addLayer(layer);		
			}
			else
			{
				alert(module.options.messageGeoJsonNotValid);
			}
		}
      }
      
      // Reset map view
      function resetMap() {
        L.Util.requestAnimFrame(map.invalidateSize, map, !1, map._container);
      }

      // Add the loading class and submit the form
      function submitForm() {
        setTimeout(function() {
          form.submit();
        }, 800);
      }

      var QueryString = function () {
        // This function is anonymous, is executed immediately and
        // the return value is assigned to QueryString!
        var query_string = {};
        var query = window.location.search.substring(1);
        var vars = query.split("&");
        for (var i=0;i<vars.length;i++) {
          var pair = vars[i].split("=");
              // If first entry with this name
          if (typeof query_string[pair[0]] === "undefined") {
            query_string[pair[0]] = pair[1];
              // If second entry with this name
          } else if (typeof query_string[pair[0]] === "string") {
            var arr = [ query_string[pair[0]], pair[1] ];
            query_string[pair[0]] = arr;
              // If third or later entry with this name
          } else {
            query_string[pair[0]].push(pair[1]);
          }
        }
          return query_string;
      } ();

      // Simulating click on expand button
      if(QueryString._exp=='true')
      	$('.leaflet-control-draw a', module.el).click();   
    }
  }

});


  /* PAOLO: added for comobox comuni */

var comuni = document.getElementById('field-comuni');
for (var i = getcomuni().length - 1; i >= 0; i--) {
  var current = getcomuni()[i];
  var option = document.createElement("option");
  option.text = current.display;
  option.value = current.nome;
  comuni.add(option);
}

comuni.onchange = function() {
  var selected = comuni.options[comuni.selectedIndex].value;
  for (var i = getcomuni().length - 1; i >= 0; i--) {
    var current = getcomuni()[i];
    if(current.nome==selected){
      $('#field-spatial')[0].value = JSON.stringify(current.geometry);
      if ("createEvent" in document) {
          var evt = document.createEvent("HTMLEvents");
          evt.initEvent("blur", false, true);
          $('#field-spatial')[0].dispatchEvent(evt);
      } else
          $('#field-spatial')[0].fireEvent("onblur");
      break;
    }
  };
  
   
}

function getcomuni(){
  var geojson_comuni = '[{"nome":"roma","display":"Roma","geometry":{"type": "Polygon","coordinates": [[[12.3486328125,41.78462507573973],[12.3486328125,41.999304591234996],[12.627410888671875,41.999304591234996],[12.627410888671875, 41.78462507573973],[12.3486328125,41.78462507573973 ]]]}}, {"nome":"latina","display":"Latina","geometry":{"type": "Polygon","coordinates": [[[ 12.77435302734375,  41.37165592008984],   [  12.77435302734375,   41.545589036668105  ], [   13.039398193359375,  41.545589036668105  ], [  13.039398193359375,  41.37165592008984  ], [12.77435302734375, 41.37165592008984 ]] ]}}]';
  return eval('(' + geojson_comuni + ')');
}