var host = '';
var ckan4j_webapi_endpoint = host + '/CKANAPIExtension/translate/term/';
var page_size = 25;
var page_current;
var page_last;
var terms_count;
var lang_code_current = 'en';
var lang_code_main = 'it';

var langs = 
	{
		"it":{
			"display_it":"Italiano"
		},"en":{
			"display_it":"Inglese"
		}
	};

function onLoad(){
	document.getElementById("mainLang").innerHTML = langs[lang_code_main]["display_"+lang_code_main];
	document.getElementById("translatedLang").innerHTML = langs[lang_code_current]["display_"+lang_code_main];
	search();
}

function enter(e){
	if(e.charCode == 13 && !$('#translateModal').hasClass('in'))
		search();
}

function search(){
	var term = document.getElementById("term");
	term.innerHTML = "";
	term.style.color = "grey";
	document.getElementById("term-translation").value = "";
	page_current = 1;
	populateTable();
}

function changePage(page_num){
	page_current = page_num;
	populateTable();
}

function updatePagination(){
	var ul = document.createElement('ul');
	ul.setAttribute("class", "pagination");
	var div = document.getElementById("pagination");
	var old_ul = div.getElementsByTagName('ul')[0];
	div.replaceChild(ul, old_ul);
	//first
	ul.appendChild(createPaginationElement(1, '&laquo;'));
	//prev
	var page_prev = page_current;
	if(page_current>1)
		page_prev--;
	ul.appendChild(createPaginationElement(page_prev, '&#60;'));
	//numbers
	for(var i = 1; i <= page_last; i++) {
		var li = createPaginationElement(i, i+'');
		if(i==page_current)
			li.setAttribute("class","active");
		ul.appendChild(li);
	}
	//next
	var page_next = page_current;
	if(page_current<page_last)
		page_next++;
	ul.appendChild(createPaginationElement(page_next, '&#62;'));
	//last
	ul.appendChild(createPaginationElement(page_last, '&raquo;'));
}

function createPaginationElement(page, label){
	var li = document.createElement('li');
	var a = document.createElement('a');
	a.setAttribute("onclick","changePage("+page+");");
	a.innerHTML = label;
	li.appendChild(a);
	return li;
}

function populateTable() {
	var include_not_translated = document.getElementById("search-not-translated").checked;
    var include_translated = document.getElementById("search-translated").checked;
    var query_filter = document.getElementById("search-filter").value;
	//update terms and pages count 
	var service = 'count';
	//getting current count (filtered)
	doAjax('GET', ckan4j_webapi_endpoint, service, 'e=category&l='+lang_code_current+'&tr='+include_translated+'&ntr='+include_not_translated+'&q='+query_filter, null, true, 
		function(result){
//	    	alert(result);
	    	var json = eval('(' + result + ')');
	    	terms_count = json.count;
	    	document.getElementById("terms-count").innerHTML = terms_count;
	    	document.getElementById("terms-count-box").style.display = 'block';
	    	var additional_page = 0;
	    	if(terms_count%page_size>1)
	    		additional_page = 1;
	    	page_last = (Math.floor(terms_count/page_size))+additional_page;
	    	updatePagination();
	    }
    );
    
    //getting total count
    var total_terms_count;
    doAjax('GET', ckan4j_webapi_endpoint, service, 'e=category&l='+lang_code_current+'&tr=true&ntr=true&q=', null, false, 
		function(result){
//	    	alert(result);
	    	var json = eval('(' + result + ')');
	    	total_terms_count = json.count;
	    }
    );
    //getting translated count
    var translated_terms_count;
    doAjax('GET', ckan4j_webapi_endpoint, service, 'e=category&l='+lang_code_current+'&tr=true&ntr=false&q=', null, false, 
		function(result){
//	    	alert(result);
	    	var json = eval('(' + result + ')');
	    	translated_terms_count = json.count;
	    }
    );
    var translation_percentage = translated_terms_count/total_terms_count*100;
    document.getElementById("terms-stats-translated").innerHTML = translated_terms_count;
    document.getElementById("terms-stats-total").innerHTML = total_terms_count;
    document.getElementById("terms-stats-percentage").innerHTML = translation_percentage.toFixed(2);
	document.getElementById("terms-stats-box").style.display = 'block';
    
	//update table content
	service = 'list';
    doAjax('GET', ckan4j_webapi_endpoint, service, 'e=category&pn='+page_current+'&ps='+page_size+'&l='+lang_code_current+'&tr='+include_translated+'&ntr='+include_not_translated+'&q='+query_filter, null, true, 
		function(result){
	//    	alert(result);
	    	var json = eval('(' + result + ')');
	    	var tbody = document.createElement('tbody');
	    	var table = document.getElementById("main-table");
	    	var old_tbody = table.getElementsByTagName('tbody')[0];
	    	table.replaceChild(tbody, old_tbody);
	    	window.scrollTo(0, 0);
		    for (var i = 0; i < json.length; i++) {
		    	var row = tbody.insertRow(i);
		    	row.setAttribute('data-toggle','modal');
		    	row.setAttribute('data-id',i);
		    	row.setAttribute('data-target','#translateModal');
		    	
		    	var cell0 = row.insertCell(0);
		        var cell1 = row.insertCell(1);
		        var cell2 = row.insertCell(2);
		        cell0.innerHTML = i+1+((page_current-1)*page_size);
		        cell0.setAttribute("style","text-align:center;");
		        cell1.innerHTML = json[i].term;
		        if(json[i].term_translation)
		        	cell2.innerHTML = json[i].term_translation;
		        else
		        	cell2.innerHTML = '';
		        
		        row.onclick = (function() {
		            return function() {
		            	document.getElementById("row-num").innerHTML = this.cells[0].innerHTML-1-((page_current-1)*page_size);
		            	document.getElementById("term").innerHTML = this.cells[1].innerHTML;
		            	document.getElementById("term").style.color = 'black';
		            	document.getElementById("term-translation").value = this.cells[2].innerHTML;
		            };  
		        })(i);
		    };
	    }
    );
}

function insertTranslation(){
	var row_num = document.getElementById("row-num").innerHTML;
	var term = document.getElementById("term").innerHTML;
	var term_translation = document.getElementById("term-translation").value;
	var data = {};
	data['term'] = term;
	data['term_translation'] = term_translation;
	data['lang_code'] = lang_code_current;
	
	var service = 'insert';
	doAjax('POST', ckan4j_webapi_endpoint, service, '', JSON.stringify(data), true,
		function(result){
//	    	alert(result);
			var json = eval('(' + result + ')');
			var message_box = document.getElementById("message-box");
			var message;
			if(json.success){
				var tbody = document.getElementById("main-table").getElementsByTagName('tbody')[0];
				var row = tbody.rows[row_num];
				row.cells[2].innerHTML = json.term_translation;
				message = "<div id='message' class='alert alert-success alert-dismissible' role='alert'>" +
				"<button type='button' class='close' data-dismiss='alert'>&times;</button>" +
				"<b>"+document.getElementById("msg-ok").innerHTML+"</b>" +
				"</div>";
				window.setTimeout(function() {
					$('#translateModal').modal('hide');
					message_box.innerHTML = "";
				}, 2000);
			}else{
				var msg = document.getElementById("msg-ko").innerHTML; 
				if(json.msg)
					msg += ": "+json.msg;
				message = "<div id='message' class='alert alert-danger alert-dismissible' role='alert'>" +
				"<button type='button' class='close' data-dismiss='alert'>&times;</button>" +
				"<b>" + msg + "</b></div>";
			}
			message_box.innerHTML = message;
	    }
	);
}

function doAjax(method, host, service, query, data, asynch, callback){    
	var requestObj = false;
	if (window.XMLHttpRequest) {
	    requestObj = new XMLHttpRequest();
	} else if (window.ActiveXObject) {
	    requestObj = new ActiveXObject("Microsoft.XMLHTTP");
	}
    if (requestObj) {
    	requestObj.onreadystatechange = function (){
            try {
            	if (requestObj.readyState == 4 && requestObj.status == 200){
                    var result = requestObj.responseText;
	                if(callback) callback(result);
	            }
	        }catch(err){
	        	//alert(err);
            }finally{
            	
            }
        };
        requestObj.open(method, host+service+'?'+query, asynch);
        requestObj.setRequestHeader("Content-type","application/json");
        requestObj.setRequestHeader("Authorization",document.getElementById("api-key").innerHTML);
        requestObj.send(data);
    }
}
