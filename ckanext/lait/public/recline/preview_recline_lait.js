// recline preview module
var current_lang = parent.document.getElementById("current-lang").innerHTML;
this.ckan.module('reclinepreview', function (jQuery, _) {  
  return {
    options: {
      i18n: {
        errorLoadingPreview: "Could not load preview",
        errorDataProxy: "DataProxy returned an error",
        errorDataStore: "DataStore returned an error",
        previewNotAvailableForDataType: "Preview not available for data type: "
      },
      site_url: ""
    },

    initialize: function () {
      jQuery.proxyAll(this, /_on/);
      this.el.ready(this._onReady);
      // hack to make leaflet use a particular location to look for images
      L.Icon.Default.imagePath = this.options.site_url + 'js/vendor/leaflet/images';
      //Inizializzazione dei parametri di pagina
      this.options.user = this.el.attr('user');
      this.options.id_dataset = this.el.attr('id_dataset');   
      this.options.id_risorsa = this.el.attr('id_risorsa');   
      this.options.messagePuntualPropositionInsert = this.el.attr('message_puntual_proposition_insert');
      this.options.messagePropositionDescription = this.el.attr('message_proposition_description');
      this.options.message_description = this.el.attr('message_description');
      this.options.message_user=this.el.attr('message_user');
      this.options.message_status=this.el.attr('message_status');  
    },

    _onReady: function() {
      this.loadPreviewDialog(preload_resource);
    },

    // **Public: Loads a data preview**
    //
    // Fetches the preview data object from the link provided and loads the
    // parsed data from the webstore displaying it in the most appropriate
    // manner.
    //
    // link - Preview button.
    //
    // Returns nothing.
    loadPreviewDialog: function (resourceData) {
      var self = this;

      function showError(msg){
        msg = msg || _('error loading preview');
        window.parent.ckan.pubsub.publish('data-viewer-error', msg);
      }

      recline.Backend.DataProxy.timeout = 10000;
      // will no be necessary any more with https://github.com/okfn/recline/pull/345
      recline.Backend.DataProxy.dataproxy_url = '//jsonpdataproxy.appspot.com';

      // 2 situations
      // a) something was posted to the datastore - need to check for this
      // b) csv or xls (but not datastore)
      resourceData.formatNormalized = this.normalizeFormat(resourceData.format);

      resourceData.url  = this.normalizeUrl(resourceData.url);
      if (resourceData.formatNormalized === '') {
        var tmp = resourceData.url.split('/');
        tmp = tmp[tmp.length - 1];
        tmp = tmp.split('?'); // query strings
        tmp = tmp[0];
        var ext = tmp.split('.');
        if (ext.length > 1) {
          resourceData.formatNormalized = ext[ext.length-1];
        }
      }

      var errorMsg, dataset;

      if (resourceData.datastore_active) {
        resourceData.backend =  'ckan';
        // Set endpoint of the resource to the datastore api (so it can locate
        // CKAN DataStore)
        resourceData.endpoint = jQuery('body').data('site-root') + 'api';
        dataset = new recline.Model.Dataset(resourceData);
        errorMsg = this.options.i18n.errorLoadingPreview + ': ' + this.options.i18n.errorDataStore;
        dataset.fetch()
          .done(function(dataset){
              self.initializeDataExplorer(dataset);
          })
          .fail(function(error){
            if (error.message) errorMsg += ' (' + error.message + ')';
            showError(errorMsg);
          });

      } else if (resourceData.formatNormalized in {'csv': '', 'xls': ''}) {
        // set format as this is used by Recline in setting format for DataProxy
        resourceData.format = resourceData.formatNormalized;
        resourceData.backend = 'dataproxy';
        dataset = new recline.Model.Dataset(resourceData);
        errorMsg = this.options.i18n.errorLoadingPreview + ': ' +this.options.i18n.errorDataProxy;
        dataset.fetch()
          .done(function(dataset){
            dataset.bind('query:fail', function (error) {
              jQuery('.data-view-container', self.el).hide();
              jQuery('.header', self.el).hide();
            });

            self.initializeDataExplorer(dataset);
          })
          .fail(function(error){
            if (error.message) errorMsg += ' (' + error.message + ')';
            showError(errorMsg);
          });
      }
    },

    initializeDataExplorer: function (dataset) {
      var self = this;
      var ricerca = parent.$("#field-geometric-search");
      
	  var mapView = new recline.View.Map({
		  model: dataset
		});
      var views = [
        {
          id: 'grid',
          label: 'Grid',
          view: new recline.View.SlickGrid({
            model: dataset
          })
        },
        {
          id: 'map',
          label: 'Map',
          view: mapView
        }
      ];
      
      var sidebarViews = [
        {
          id: 'valueFilter',
          label: 'Filters',
          view: new recline.View.ValueFilter({
            model: dataset
          })
        }
      ];

      var dataExplorer = new recline.View.MultiView({
        el: this.el,
        model: dataset,
        views: views,
        sidebarViews: sidebarViews,
        config: {
          readOnly: true
        }
      });


      var layers = {};
      layers.drawnItems = new L.FeatureGroup();
      layers.markersLayer = new L.FeatureGroup();      
      mapView.map.addLayer(layers.drawnItems);
      mapView.map.addLayer(layers.markersLayer);  
      mapView.map.setView([41.9737037522, 12.7773122216], 8);    

      ricerca.on("select2-selecting", function(e){
    	  var coordinates = e.val.split(" ");
    	  if (coordinates.length > 1)
    	  {
        	  dataExplorer.updateNav("map");   
        	  layers.markersLayer.clearLayers();
      		  L.marker([coordinates[0], coordinates[1]]).addTo(layers.markersLayer).bindPopup(e.object.text).openPopup();    	  
      		  mapView.map.fitBounds([[coordinates[0], coordinates[1]],[coordinates[0], coordinates[1]]]);
      		  mapView.map.zoomOut(4);
        	  e.object.id="";
    	  }
      	});

      
	  var yellowIcon = L.icon({
			iconUrl: L.Icon.Default.imagePath + '/marker-icon-yellow.png',
			iconSize: [25, 41],
			iconAnchor: [12, 41],
			popupAnchor: [1, -34]
      });

	  var greenIcon = L.icon({
			iconUrl: L.Icon.Default.imagePath + '/marker-icon-green.png',
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
				featureNS : 'opendata',
				featureType : 'comment',
				primaryKeyField : 'id',
				onEachFeature: function (feature, layer) {
			        if (feature.properties) {
			            var popupContent;
			            popupContent = "<table><tr><td><b>"+self.options.message_description+" :</b></td><td>" + feature.properties.testo + "</td></tr>"+
			            					  "<tr><td><b>"+self.options.message_user+"      :</b></td><td>" + feature.properties.id_utente + "</td></tr>";
			            if (feature.properties.stato && feature.properties.stato == "NOT APPROVED")
			            {
			            	popupContent +=	"<tr><td><b>"+self.options.message_status+"       :</b></td><td>" + feature.properties.stato + "</td></tr>";
			            }
			            					
			            popupContent +="</table>";
			        }
			        layer.bindPopup(popupContent);  
			    },
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
			}).addTo(mapView.map); 
      
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
		
      mapView.map.addControl(drawControl);
      $('.leaflet-draw').hide();

      /** ------- Funzioni sovrascritte per gestione specifica dei popup ----- */
      mapView.map.openPopup = function (popup, latlng, options) { 
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
				mapView.map.removeLayer(currentLayer);
				var feature = currentLayer.feature;
	            var popupContent = "<table><tr><td><b>"+self.options.message_description+" :</b></td><td>" + feature.properties.testo + "</td></tr>"+
									  "<tr><td><b>"+self.options.message_user+"      :</b></td><td>" + feature.properties.id_utente + "</td></tr>"+	
									  "<tr><td><b>"+self.options.message_status+"       :</b></td><td>" + feature.properties.stato + "</td></tr>"+
							       "</table>";
	            var justInserted = layers.commentApproved.getLayers().length-1;
	            layers.commentApproved.getLayers()[justInserted].bindPopup(popupContent); 				
				layers.commentApproved.getLayers()[justInserted].addTo(mapView.map);
				 $('.commentPoint').show(); 
			});

			$("#miglioraDatoAnnullaInput" ).on("click", function() {
				var currentLayer = layers.drawnItems.getLayers()[0];
				currentLayer.closePopup();
				mapView.map.removeLayer(currentLayer);	
			});

			return returnPopup;
	  };  
	  mapView.map.closePopup = function (popup) {
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
	  
      mapView.map.on('draw:created', function (e) {
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
			
			var popup = e.layer.bindPopup('<label for="miglioraDatoInputText">'+self.options.messagePropositionDescription+'</label><input id="miglioraDatoInputText" type="text"/></br><input class="btn" id="miglioraDatoInput" type="button" value="Salva"/><input class="btn" id="miglioraDatoAnnullaInput" type="button" value="Annulla"/>',{closeButton:false,closeOnClick: false}).openPopup();
      });
      
      var improveButton = $('#improve', parent.document.body);
      improveButton.click( function() {
    	  if (improveButton.attr('class').indexOf('active')>=0)
          {
    		  $('.leaflet-draw').show();
    		  $('.commentPoint').show();   	      
          }
    	  else
          {
    		  $('.leaflet-draw').hide();   		  
    		  $('.commentPoint').hide(); 

    		  mapView.map.closePopup();
          }
      });        
      
    },
       
    normalizeFormat: function (format) {
      var out = format.toLowerCase();
      out = out.split('/');
      out = out[out.length-1];
      return out;
    },
    normalizeUrl: function (url) {
      if (url.indexOf('https') === 0) {
        return 'http' + url.slice(5);
      } else {
        return url;
      }
    }
  };
});
