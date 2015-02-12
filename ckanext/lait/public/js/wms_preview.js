// WMS preview module
this.ckan.module('wmspreview', function (jQuery, _) {

    // Private
    var defaultVersion = "1.1.1";

    var preferredFormat = "image/png";

    var proxy = false;

    var getParameterByName = function(name,query_string) {
      query_string = query_string || window.location.search;
      var match = RegExp('[?&]' + name + '=([^&]*)')
                    .exec(query_string);
      return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
    }

    var cleanUrl = function(server){
      var qs;
      if (server.indexOf("?") !== -1){
        parts = server.split("?");
        server = parts[0];
        qs = parts[1];
      }

      var mapParam = getParameterByName("map", "?" + qs);
      if (mapParam)
        server = server + "?map=" + mapParam;

      return server;
    }

    var getCapabilitiesUrl = function(server,version){

        version = version || defaultVersion;

        if (server.indexOf("?") === -1)
            server += "?"
        if (server.indexOf("=") !== -1)
            server += "&"

        var url  = server +
                   "SERVICE=WMS" +
                   "&REQUEST=GetCapabilities" +
                   "&VERSION=" + version;

        return (proxy) ? proxy + escape(url) : url;
    }

    var getFormat = function(formats){
      for(var i = 0; i < formats.length; i++){
        if (formats[i] == preferredFormat){
          return formats[i];
        }
      }
      return formats[0];
    }
  
  return {
    options: {
      i18n: {
      }
    },

    initialize: function () {
      jQuery.proxyAll(this, /_on/);
      this.el.ready(this._onReady);
      OpenLayers.ImgPath = this.options.site_url + '/js/vendor/openlayers/img/';
      this.options.messagePropositionDescription = this.el.attr('message_proposition_description');
      this.options.messagePuntualPropositionInsert = this.el.attr('message_puntual_proposition_insert');     
      this.options.user = this.el.attr('user');
      this.options.id_dataset = this.el.attr('id_dataset');   
      this.options.id_risorsa = this.el.attr('id_risorsa');  
      this.options.message_description = this.el.attr('message_description');
      this.options.message_user=this.el.attr('message_user');
      this.options.message_status=this.el.attr('message_status');         
    },

    _onReady: function() {

        var server = preload_resource.url;
        var wmsUrl = cleanUrl(server);
        var proxied_server = preload_resource.proxy_url;
        var capabilitiesUrl = getCapabilitiesUrl(proxied_server);

        var self = this;
        $.get(capabilitiesUrl,function(data){
          // Most WMS Servers will return the version they prefer,
          // regardless of which one you requested, so better check
          // for the actual version returned.
          var version = $(data).find("WMS_Capabilities").attr("version"); // 1.3.0
          if (!version)
              version = $(data).find("WMS_MS_Capabilities").attr("version"); // 1.1.1

          var format = new OpenLayers.Format.WMSCapabilities({"version":version});

          var capabilities = format.read(data);
          
          if (!capabilities.capability){
            $("#main").prepend(
              $("<div></div>").attr("class","flash-banner-box").append(
                $("<div></div>").attr("class","flash-banner error").html(
                  "Error parsing the WMS capabilities document")));
            return false;
          }


          var layers = capabilities.capability.layers;

          var olLayers = [];
          var maxExtent = false;
          var maxScale = false;
          var minScale = false;
          for (var count = 0; count < layers.length; count++){
            layer = layers[count];

            // Extend the maps's maxExtent to include this layer extent
            layerMaxExtent = new OpenLayers.Bounds(layer.llbbox[0],layer.llbbox[1],layer.llbbox[2],layer.llbbox[3]);
            if (!maxExtent){
                maxExtent = layerMaxExtent;
            } else {
                maxExtent.extend(layerMaxExtent);
            }
            if (layer.maxScale && (layer.maxScale > maxScale || maxScale === false)) maxScale = layer.maxScale;
            if (layer.minScale && (layer.minScale < minScale || minScale === false)) minScale = layer.minScale;
            olLayers.push(new OpenLayers.Layer.WMS(
              layer.title,
              wmsUrl,
              {"layers": layer.name,
              "format": getFormat(layer.formats),
              "transparent":true
              },
              {"buffer":0,
              "maxExtent": layerMaxExtent,
              "maxScale": (layer.maxScale) ? layer.maxScale : null,
              "minScale": (layer.minScale) ? layer.minScale : null,
              "isBaseLayer": false,
              "visibility": true
              })  //Tiled?
            );

          }

          var dummyLayer = new OpenLayers.Layer("Dummy",{
            "maxExtent": maxExtent,
            "displayInLayerSwitcher":false,
            "isBaseLayer":true,
            "visibility":false,
            "minScale": (minScale) ? minScale : null,
            "maxScale": (maxScale) ? maxScale : null
          });
          olLayers.push(dummyLayer);

          $("#data-preview").empty();
          $("#data-preview").append($("<div></div>").attr("id","map"));

          // Create a new map
          self.map = new OpenLayers.Map("map" ,
            {
              "projection": new OpenLayers.Projection("EPSG:4326"),
              "maxResolution":"auto",
              "controls":[
                  new OpenLayers.Control.PanZoomBar(),
                  new OpenLayers.Control.Navigation(),
                  new OpenLayers.Control.CustomMousePosition({
                      "displayClass":"olControlMousePosition",
                      "numDigits":4
                  }),
                  new OpenLayers.Control.LayerSwitcher({
                      "div": document.getElementById("layers"),
                      "roundedCorner":false
                  })
              ],
              "theme": self.options.site_url + "/js/vendor/openlayers/theme/default/style.css"
            });

          self.map.maxExtent = maxExtent;
          self.map.addLayers(olLayers);

          var saveStrategy = new OpenLayers.Strategy.Save({auto: true});
          
          var markerStyle = {pointRadius: 20, 
	  			  externalGraphic: self.options.site_url + "/js/vendor/openlayers/img/marker-icon.png",
	  			  cursor: "pointer"};
          var defaultStyle = {pointRadius: 20, 
        		  			  externalGraphic: self.options.site_url + "/js/vendor/openlayers/img/marker-icon-yellow.png",
        		  			  cursor: "pointer"};
          var temporaryStyle = {pointRadius: 20, 
					  	 	  externalGraphic: self.options.site_url + "/js/vendor/openlayers/img/marker-icon-green.png",
					  	 	  cursor: "pointer"};
          var draw = null;
          self.select = null;
          var styleMapFixed = new OpenLayers.StyleMap(defaultStyle);
          var styleMapDrawing = new OpenLayers.StyleMap(temporaryStyle);          
          var styleMapMarkers = new OpenLayers.StyleMap(markerStyle);          
          self.drawLayer = new OpenLayers.Layer.Vector("Draw Layer", {
              projection: new OpenLayers.Projection("EPSG:4326"),
              styleMap: styleMapDrawing,
              displayInLayerSwitcher: false,
              onFeatureInsert: function(feature){
            	  					self.select.unselectAll();
									if (self.drawLayer.features.length > 1)
				  					{
				  						self.drawLayer.removeFeatures(self.drawLayer.features[0]);
				  					}
            	  					draw.deactivate();    
            	  					self.select.select(feature);
            	  			   }
          }); 
          
          self.markersLayer = new OpenLayers.Layer.Vector("Markers Layer", {
              projection: new OpenLayers.Projection("EPSG:4326"),
              styleMap: styleMapMarkers,
              displayInLayerSwitcher: false,
              onFeatureInsert: function(feature){
            	  					self.select.unselectAll();
									if (self.markersLayer.features.length > 1)
				  					{
				  						self.markersLayer.removeFeatures(self.markersLayer.features[0]);
				  					}
            	  					self.select.select(feature);
            	  			   }
          });           
          self.markersLayer.setVisibility(true);
          
          var ricerca = parent.$("#field-geometric-search");         
          ricerca.on("select2-selecting", function(e){
        	  var coordinates = e.val.split(" ");
        	  if (coordinates.length > 1)
        	  {
        		  self.select.unselectAll();        		  
      			  self.markersLayer.removeAllFeatures();
        		  var feature = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(coordinates[1],coordinates[0]));
      			  feature.attributes['testo'] = e.object.text;
      			  self.markersLayer.addFeatures(feature);
          		  self.select.select(feature);
          		  self.map.setCenter(new OpenLayers.LonLat(coordinates[1], coordinates[0]), self.map.getNumZoomLevels()-5);
            	  e.object.id="";
        	  }
          	});            
          
          var filter = new OpenLayers.Filter.Logical({
        	    type: OpenLayers.Filter.Logical.AND,
        	    filters: [
        	        new OpenLayers.Filter.Comparison({
        	            type: OpenLayers.Filter.Comparison.EQUAL_TO,
        	            property: "id_dataset",
        	            value: self.options.id_dataset
        	        }),
        	        new OpenLayers.Filter.Comparison({
        	            type: OpenLayers.Filter.Comparison.EQUAL_TO,
        	            property: "id_risorsa",
        	            value: self.options.id_risorsa
        	        }),
        	        new OpenLayers.Filter.Logical({
        	        	type: OpenLayers.Filter.Logical.OR,
        	        	filters: [
        	          	        new OpenLayers.Filter.Comparison({
        	        	            type: OpenLayers.Filter.Comparison.EQUAL_TO,
        	        	            property: "stato",
        	        	            value: "APPROVED"
        	        	        }),
        	        	        new OpenLayers.Filter.Comparison({
        	        	            type: OpenLayers.Filter.Comparison.EQUAL_TO,
        	        	            property: "id_utente",
        	        	            value: self.options.user
        	        	        })       	        	          
        	        	]
        	        })
        	    ]
        	});
	   var baseUrl = "http://" + document.domain;
          self.wfs = new OpenLayers.Layer.Vector("Editable Features", {
              strategies: [new OpenLayers.Strategy.BBOX(), saveStrategy],
              projection: new OpenLayers.Projection("EPSG:4326"),
              styleMap: styleMapFixed,
              protocol: new OpenLayers.Protocol.WFS({
                  version: "1.1.0",
                  srsName: "EPSG:4326",
		    //url : "http://ovpngw.sinergis.it/geoserver/ows",
                  url: baseUrl + '/LaitExtension-hook/api/service/wfsProxy?targetUrl=' + baseUrl + '/geoserver/wfs?',
                  featureNS :  "http://ovpngw.sinergis.it",
                  featureType: "comment",
                  geometryName: "the_geom"/*,
                  schema: "http://demo.opengeo.org/geoserver/wfs/DescribeFeatureType?version=1.1.0&typename=og:restricted"*/
              }),
              filter: filter,
              displayInLayerSwitcher: false
          }); 
          self.map.addLayers([self.wfs,self.drawLayer,self.markersLayer]);
          
          self.select = new OpenLayers.Control.SelectFeature([self.drawLayer, self.wfs, self.markersLayer],{toggle: true, hover: false, clickout: false, multiple: false});
          
          self.drawLayer.events.on({
              "featureselected": self.onFeatureSelect.bind(self),
              "featureunselected": self.onFeatureUnselect
          });
          
          self.markersLayer.events.on({
              "featureselected": self.onFeatureMarkerSelect.bind(self),
              "featureunselected": self.onFeatureUnselect
          });
          
          self.map.addControl(self.select);
          self.select.activate(); 

          self.wfs.events.on({
              "featureselected": self.onFeatureWfsSelect.bind(self),
              "featureunselected": self.onFeatureUnselect
          });
          
          self.wfs.setVisibility(false);          
          
          var panel = new OpenLayers.Control.Panel({
              allowDepress: true
          });
          
          draw = new OpenLayers.Control.DrawFeature(
        		    self.drawLayer, OpenLayers.Handler.Point,
        	        {
        	            title: self.options.messagePuntualPropositionInsert,
        	            multi: false
        	        }
        	    );

          panel.addControls([draw]);
          self.map.addControl(panel);
		  $('.olControlPanel').hide();
          
          self.map.zoomTo(1);
          
          var improveButton = $('#improve', parent.document.body);
          improveButton.click( function() {
        	  if (improveButton.attr('class').indexOf('active')>=0)
              {
        		  $('.olControlPanel').show();
        		  self.wfs.setVisibility(true);
        		  self.drawLayer.setVisibility(true);
              }
        	  else
              {
        		  $('.olControlPanel').hide();
        		  self.wfs.setVisibility(false);
        		  self.drawLayer.setVisibility(false);
              }
        	  self.select.unselectAll();
          });            
      });
    },

    onPopupClose: function(evt) {
        self.select.unselectAll();
    },

    onFeatureSelect: function(event) {
        var feature = event.feature;
        popup = new OpenLayers.Popup.FramedCloud(
            "chicken", 
            feature.geometry.getBounds().getCenterLonLat(),
            null,
            '<label for="miglioraDatoInputText" class="miglioraDatoInputText">'+this.options.messagePropositionDescription+'</label><input id="miglioraDatoInputText" type="text"/></br><input class="btn" id="miglioraDatoInput" type="button" value="Salva"/><input class="btn" id="miglioraDatoAnnullaInput" type="button" value="Annulla"/>',
            null, 
            false, 
            self.onPopupClose);
            
        feature.popup = popup;
        this.map.addPopup(popup);
		$("#miglioraDatoInput" ).on("click", function() {
			feature.attributes['testo'] = $('#miglioraDatoInputText')[0].value;
			feature.attributes['id_dataset'] = this.options.id_dataset;
			feature.attributes['id_risorsa'] = this.options.id_risorsa;
			feature.attributes['stato'] = 'NOT APPROVED';
			feature.attributes['id_utente'] = this.options.user;			
			this.drawLayer.removeAllFeatures();
        	this.map.removePopup(feature.popup);
            feature.popup.destroy();
            delete feature.popup;
			this.wfs.addFeatures(feature);
		}.bind(this));        
		
		$("#miglioraDatoAnnullaInput" ).on("click", function() {
this.drawLayer.removeAllFeatures();
feature.popup.destroy();
delete feature.popup;
                }.bind(this));
    },
    
    onFeatureUnselect: function(event) {
        var feature = event.feature;
        if(feature.popup) {
        	this.map.removePopup(feature.popup);
            feature.popup.destroy();
            delete feature.popup;
        }
    },
    
    onFeatureWfsSelect: function(event) {
        var feature = event.feature;
        var popupContent = "<table><tr><td><b>"+this.options.message_description+" :</b></td><td>" + feature.attributes.testo + "</td></tr>"+
		  "<tr><td><b>"+this.options.message_user+"      :</b></td><td>" + feature.attributes.id_utente + "</td></tr>";
        
        if (feature.attributes.stato && feature.attributes.stato == "NOT APPROVED")
        {
        	popupContent +=	"<tr><td><b>"+this.options.message_status+"       :</b></td><td>" + feature.attributes.stato + "</td></tr>";
        }
        
        popupContent += "</table>";
        
        popup = new OpenLayers.Popup.FramedCloud(
            "chicken", 
            feature.geometry.getBounds().getCenterLonLat(),
            null,
            popupContent,
            null, 
            true, 
            self.onPopupClose);
        feature.popup = popup;
        this.map.addPopup(popup);
    }, 
    
    onFeatureMarkerSelect: function(event) {
        var feature = event.feature;
        var popupContent = "<b>" + feature.attributes.testo + "</b>";
        
        if (feature.popup == null)
        {
            popup = new OpenLayers.Popup.FramedCloud(
                    "chicken", 
                    feature.geometry.getBounds().getCenterLonLat(),
                    null,
                    popupContent,
                    null, 
                    true, 
                    self.onPopupClose);
                feature.popup = popup;
                this.map.addPopup(popup);
        }
    }     
  }
});

OpenLayers.Control.CustomMousePosition = OpenLayers.Class(OpenLayers.Control.MousePosition,{
  formatOutput: function(lonLat) {
      var newHtml =  OpenLayers.Control.MousePosition.prototype.formatOutput.apply(this, [lonLat]);
      newHtml = "1:" + parseInt(this.map.getScale()) + " |  WGS84 " + newHtml;
      return newHtml;
  },

  CLASS_NAME: "OpenLayers.Control.CustomMousePosition"
});
