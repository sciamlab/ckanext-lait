var requestObj = false;
if (window.XMLHttpRequest) {
    requestObj = new XMLHttpRequest();
} else if (window.ActiveXObject) {
    requestObj = new ActiveXObject("Microsoft.XMLHTTP");
}

if(document.getElementById("user")!=undefined){
    var user = document.getElementById("user").innerHTML;
    var api_key = document.getElementById("api-key").innerHTML;
    //alert(user+' '+api_key);
    if(user != ''){
        //enabling the rating
        document.getElementById("star5").addEventListener('click', function (){ rate(5)});
        document.getElementById("star4").addEventListener('click', function (){ rate(4)});
        document.getElementById("star3").addEventListener('click', function (){ rate(3)});
        document.getElementById("star2").addEventListener('click', function (){ rate(2)});
        document.getElementById("star1").addEventListener('click', function (){ rate(1)});
    }else{
        //if no user is logged in the rating is disabled
        document.querySelector('.rating-new').className = "rating-new-disabled";
    }
    //getting the current rate (with no params)
    rate();
}

function rate(star_num){    
    if (requestObj) {
        var ds = window.location.pathname;
        ds = ds.substring(ds.lastIndexOf("/")+1);
        var query = 'ds='+ds;
        var method = 'GET';
        if(user!='') query = query + '&user='+user;
        if(star_num!=undefined) {
            //insert new rate
            method = 'POST';
            query = query + '&rating='+star_num;
        }
        doAjax(method, '/CKANAPIExtension/', 'rate', query, null, true, 
            function(result){
                //alert(result);
                var rating_obj = eval('(' + result + ')');
                //reset current rating
                document.querySelector("#star5").className = "";
                document.querySelector("#star4").className = "";
                document.querySelector("#star3").className = "";
                document.querySelector("#star2").className = "";
                document.querySelector("#star1").className = "";
                //show the current/updated rating
                if(rating_obj.rating>0)
                    document.querySelector('#star'+rating_obj.rating).className = "rating-new-selected";
            }
        );
    }
}

function doAjax(method, host, service, query, data, asynch, callback){    
    var requestObj = false;
    if (window.XMLHttpRequest) {
        requestObj = new XMLHttpRequest();
    } else if (window.ActiveXObject) {
        requestObj = new ActiveXObject("Microsoft.XMLHTTP");
    }
    if (requestObj) {
        //document.getElementsByTagName("body")[0].className = "loading";
        $('#loaderModal').modal('show');
        requestObj.onreadystatechange = function (){
            if (requestObj.readyState == 4){
                try {
                    if (requestObj.status == 200){
                        var result = requestObj.responseText;
                        if(callback) callback(result);
                    }else if(requestObj.status == 500){
                        //alert(requestObj.responseText);
                    }
                }catch(err){
                    //alert(err);
                }finally{
                    $('#loaderModal').modal('hide');
                }
            }
        };
        requestObj.open(method, host+service+'?'+query, asynch);
        requestObj.setRequestHeader("Content-type", "application/json");
        requestObj.setRequestHeader("Authorization", api_key);
        requestObj.send(data);
    }
}