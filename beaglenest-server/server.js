/**
 * Simple logging API based on Node.js Express
 *
 * This is intended for demo/POC purposes only. There's literally no security here, so you'll want to add some security measures if you're going to
 * use this in a production environment
 *
 * Example log GET request: http://[SOMEDOMAINHERE.COM]/log/{"somekey":"somevalue"}
 *
 **/

var express = require('express');
var app = express();
var _ = require('underscore')._;

var db = require("mongojs").connect(process.env.MONGOLAB_URI, ["logger"]);

app.set('view engine', 'ejs');
app.use("/css",express.static(__dirname + "/css"));

app.get('/log/:json', function(req,res) {
	console.log(req.params.json);

  var jsonObj = JSON.parse(req.params.json);

  jsonObj["datetime"] = new Date();

	db.logger.save(jsonObj, function(err, saved) {
      if( err || !saved ) {
      	console.log(err);
      	res.send('error');
      }
      res.send('success');
	});

});

app.get('/view/:limit?', function(req,res){

  var tableData = "";

  var limit = 50;
  if(req.params.limit != null) limit = Math.floor(req.params.limit);

  db.logger.find({}).sort( { datetime: -1 } ).limit( limit ).forEach(function(err,doc){
    //console.log(doc);
    if (!doc) {
        // we visited all docs in the collection
        res.render('index',{body:tableData});
        return;
    }

    var bgColor="#ffffff";

    if(doc["Target Temp Updated to"] != null) {
      tableData+="<tr class='highlight'><td>"+doc.datetime+"</td><td>"+JSON.stringify(doc)+"</td></tr>";
    }
    else if(doc["Resetting back to"] != null) {
      tableData+="<tr class='highlight2'><td>"+doc.datetime+"</td><td>"+JSON.stringify(doc)+"</td></tr>";
    }

    else {
      tableData+="<tr><td>"+doc.datetime+"</td><td>"+JSON.stringify(doc)+"</td></tr>";
    }
  });  
});

app.listen(process.env.PORT);

/**
 * Simple log...
 **/
function log(logText) {
  console.log(new Date() + ": "+logText);
}