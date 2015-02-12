// geojson preview module
ckan.module('geojsonpreview', function (jQuery, _) {
  return {
    options: {
      table: '<table class="table table-striped table-bordered table-condensed"><tbody>{body}</tbody></table>',
      row:'<tr><th>{key}</th><td>{value}</td></tr>',
      style: {
        opacity: 0.7,
        fillOpacity: 0.1,
        weight: 2
      },
      i18n: {
        'error': _('An error occurred: %(text)s %(error)s')
      }
    },
    initialize: function () {
      // hack to make leaflet use a particular location to look for images
      L.Icon.Default.imagePath = this.options.site_url + 'js/vendor/leaflet/images';
      var ricerca = parent.$("#field-geometric-search");
      
      //Inizializzazione dei parametri di pagina
      this.options.user = this.el.attr('user');
      this.options.id_dataset = this.el.attr('id_dataset');   
      this.options.id_risorsa = this.el.attr('id_risorsa');   
      this.options.messagePuntualPropositionInsert = this.el.attr('message_puntual_proposition_insert');
      this.options.messagePropositionDescription = this.el.attr('message_proposition_description');
      this.options.message_description = this.el.attr('message_description');
      this.options.message_user=this.el.attr('message_user');
      this.options.message_status=this.el.attr('message_status');  

      var self = this;

      self.el.empty();
      self.el.append($("<div></div>").attr("id","map"));
      self.map = ckan.commonLeafletMap('map', this.options.map_config);

      var layers = {};
      layers.drawnItems = new L.FeatureGroup();
      layers.markersLayer = new L.FeatureGroup();        
      map.addLayer(layers.drawnItems);
      map.addLayer(layers.markersLayer);      

      ricerca.on("select2-selecting", function(e){
    	  var coordinates = e.val.split(" ");
    	  if (coordinates.length > 1)
    	  {
        	  layers.markersLayer.clearLayers();
      		  L.marker([coordinates[0], coordinates[1]]).addTo(layers.markersLayer).bindPopup(e.object.text).openPopup();    	  
      		  map.fitBounds([[coordinates[0], coordinates[1]],[coordinates[0], coordinates[1]]]);
      		  map.zoomOut(4);
        	  e.object.id="";
    	  }
      	});
      
	  var yellowIcon = L.icon({
			iconUrl: L.Icon.Default.imagePath + '/marker-icon-yellow.png',
			iconSize: [25, 41],
			iconAnchor: [12, 41],
			popupAnchor: [1, -34]
      });

      var baseUrl = "http://" + document.domain;
      // Initialize the WFST layer
      layers.commentApproved = L.wfst(
			null,{
				// Required
				url : baseUrl + '/LaitExtension-hook/api/service/wfsProxy?targetUrl=' + baseUrl + '/geoserver/wfs',
					
				//url : "http://ovpngw.sinergis.it/geoserver/ows",
				featureNS : 'opendata',
				featureType : 'comment',
				primaryKeyField : 'id',
				onEachFeature: self.onEachFeature,
				pointToLayer: function (feature, latlng) {
					var marker = L.marker(latlng, {icon: yellowIcon});
					marker.on('add', function (evt){
						L.DomUtil.addClass(evt.target._icon, "commentPoint");
						$(evt.target._icon).hide();						
					}, this);
					return marker;
				},				
				wfsFilter: '<Filter>'+
								'<And>'+
									'<PropertyIsEqualTo><PropertyName>id_dataset</PropertyName><Literal>'+self.options.id_dataset+'</Literal></PropertyIsEqualTo>'+
									'<PropertyIsEqualTo><PropertyName>id_risorsa</PropertyName><Literal>'+self.options.id_risorsa+'</Literal></PropertyIsEqualTo>'+
									'<Or>'+
										'<PropertyIsEqualTo><PropertyName>stato</PropertyName><Literal>APPROVED</Literal></PropertyIsEqualTo>'+
										'<PropertyIsEqualTo><PropertyName>id_utente</PropertyName><Literal>'+self.options.user+'</Literal></PropertyIsEqualTo>'+
									'</Or>'+
								'</And>'+
							'</Filter>'
			}).addTo(map);
      //$('.leaflet-marker-pane').hide();
      //$('.leaflet-shadow-pane').hide();
      $('.commentPoint').hide();

	  var greenIcon = L.icon({
			iconUrl: L.Icon.Default.imagePath + '/marker-icon-green.png',
			iconSize: [25, 41],
			iconAnchor: [12, 41],
			popupAnchor: [1, -34]
      });
	  
      // Initialize the draw control and pass it the
      // FeatureGroup of editable layers
      L.drawLocal.draw.toolbar.buttons.marker = self.options.messagePuntualPropositionInsert;
      var drawControl = new L.Control.Draw({ 	  
			draw : {
				polyline : false,
				polygon : false,
				circle : false,
				rectangle : false,
				marker : {icon: greenIcon}
			},
			edit : {
				featureGroup : layers.drawnItems,
				edit : false,
				remove: false
			}
      });
		
      map.addControl(drawControl);
      $('.leaflet-draw').hide();
      
      /** ------- Funzioni sovrascritte per gestione specifica dei popup ----- */
 	  map.openPopup = function (popup, latlng, options) { 
			this.closePopup();
			if (!(popup instanceof L.Popup)) {
				var content = popup;
		
				popup = new L.Popup(options)
				    .setLatLng(latlng)
				    .setContent(content);
			}
			popup._isOpen = true;
			
			this._popup = popup;
			var returnPopup = this.addLayer(popup);
			if (popup.descrizione)
			{
				$('#miglioraDatoInputText')[0].value = popup.descrizione;
			}
			$("#miglioraDatoInput" ).on("click", function() {
				layers.drawnItems.getLayers()[0].feature.properties['testo'] = $('#miglioraDatoInputText')[0].value;
				var currentLayer = layers.drawnItems.getLayers()[0];
				//Copia l'oggetto come feature nel layer del wfst
				var newFeature = currentLayer.toGeoJSON();
				newFeature.id = 'comment.0';
				newFeature.type = "Feature";
				newFeature.geometry_name= "the_geom";
				newFeature._wfstSaved=false;
				layers.commentApproved.addData(newFeature);
				currentLayer.closePopup();		
				map.removeLayer(currentLayer);
				var feature = currentLayer.feature;
	            var popupContent  = "<table><tr><td><b>"+this.options.message_description+" :</b></td><td>" + feature.properties.testo + "</td></tr>"+
	            					  "<tr><td><b>"+this.options.message_user+"      :</b></td><td>" + feature.properties.id_utente + "</td></tr>";
	            if (feature.properties.stato && feature.properties.stato == "NOT APPROVED")
	            {
	            	popupContent +=	"<tr><td><b>"+this.options.message_status+"       :</b></td><td>" + feature.properties.stato + "</td></tr>";
	            }
	            					
	            popupContent +="</table>";
	            
	            var justInserted = layers.commentApproved.getLayers().length-1;
	            layers.commentApproved.getLayers()[justInserted].bindPopup(popupContent); 				
				layers.commentApproved.getLayers()[justInserted].addTo(map);
			});
			
			return returnPopup;
	  };  
	  map.closePopup = function (popup) {
		  	if ($('#miglioraDatoInputText').length > 0 && popup)
		  	{
				popup.descrizione = $('#miglioraDatoInputText')[0].value;
		  	}
			if (!popup || popup === this._popup) {
				popup = this._popup;
				this._popup = null;
			}
			if (!this.oldDescrizione && popup)
			{
				this.oldDescrizione = popup.descrizione;
			}
			if (popup) {
				this.removeLayer(popup);
				popup._isOpen = false;
			}
			return this;
	  };	
	  /** -------------------------------------------------------------- */
	  
      map.on('draw:created', function (e) {
			var layer = e.layer;    	  
			layers.drawnItems.clearLayers();
			if (!layer.feature)
			{
				layer.feature = {};
			}
			if (!layer.feature.properties)
			{
				layer.feature.properties = {};
			}
			layer.feature.properties['id_dataset'] = self.options.id_dataset;
			layer.feature.properties['id_risorsa'] = self.options.id_risorsa;
			layer.feature.properties['stato'] = 'NOT APPROVED';
			layer.feature.properties['id_utente'] = self.options.user;
		
			layers.drawnItems.addLayer(layer);
			L.DomUtil.addClass(layer._icon, "commentPoint");
			
			var popup = e.layer.bindPopup('<label for="miglioraDatoInputText">'+self.options.messagePropositionDescription+'</label><input id="miglioraDatoInputText" type="text"/></br><input class="btn" id="miglioraDatoInput" type="button" value="Salva"/>',{closeButton:false,closeOnClick: false}).openPopup();
      });
      
      // use CORS, if supported by browser and server
      if (jQuery.support.cors && preload_resource['original_url'] !== undefined) {
        jQuery.getJSON(preload_resource['original_url'])
        .done(
          function(data){
            self.showPreview(data);
          })
        .fail(
          function(jqxhr, textStatus, error) {
            jQuery.getJSON(preload_resource['url'])
            .done(
              function(data){
                self.showPreview(data);
              })
            .fail(
              function(jqXHR, textStatus, errorThrown) {
                self.showError(jqXHR, textStatus, errorThrown);
              }
            );
          }
        );
      } else {
        jQuery.getJSON(preload_resource['url']).done(
          function(data){
            self.showPreview(data);
          })
        .fail(
          function(jqXHR, textStatus, errorThrown) {
            self.showError(jqXHR, textStatus, errorThrown);
          }
        );
      }    

      var improveButton = $('#improve', parent.document.body);
      improveButton.click( function() {
    	  if (improveButton.attr('class').indexOf('active')>=0)
          {
    		  $('.leaflet-draw').show();
    	      //$('.leaflet-marker-pane').show();
    	      //$('.leaflet-shadow-pane').show();
    	      $('.commentPoint').show();
          }
    	  else
          {
    		  $('.leaflet-draw').hide();
    	      //$('.leaflet-marker-pane').hide();
    	      //$('.leaflet-shadow-pane').hide();
    	      $('.commentPoint').hide();
    	      map.closePopup();
          }
      });  

    },
    
    onEachFeature: function (feature, layer) {
        if (feature.properties) {
            var popupContent;
            popupContent = "<table><tr><td><b>"+this.options.message_description+" :</b></td><td>" + feature.properties.testo + "</td></tr>"+
            					  "<tr><td><b>"+this.options.message_user+"      :</b></td><td>" + feature.properties.id_utente + "</td></tr>";
            if (feature.properties.stato && feature.properties.stato == "NOT APPROVED")
            {
            	popupContent +=	"<tr><td><b>"+this.options.message_status+"       :</b></td><td>" + feature.properties.stato + "</td></tr>";
            }
            					
            popupContent +="</table>";
        }
        layer.bindPopup(popupContent);    	
    },
      
    showError: function (jqXHR, textStatus, errorThrown) {
      if (textStatus == 'error' && jqXHR.responseText.length) {
        this.el.html(jqXHR.responseText);
      } else {
        this.el.html(this.i18n('error', {text: textStatus, error: errorThrown}));
      }
    },

    showPreview: function (geojsonFeature) {

      var self = this;
      var gjLayer = L.geoJson(geojsonFeature, {
        style: self.options.style,
        onEachFeature: function(feature, layer) {
          var body = '';
          jQuery.each(feature.properties, function(key, value){
            if (value != null && typeof value === 'object') {
              value = JSON.stringify(value);
            }
            body += L.Util.template(self.options.row, {key: key, value: value});
          });
          var popupContent = L.Util.template(self.options.table, {body: body});
          layer.bindPopup(popupContent);
        }
      }).addTo(self.map);
      self.map.fitBounds(gjLayer.getBounds());
    }
  };
});
