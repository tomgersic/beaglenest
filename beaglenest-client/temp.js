var b = require('bonescript');
var nest = require('unofficial-nest-api');
var http = require('http');
var twilio = require('twilio');

var client = new twilio.RestClient('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN');

//The input pin to check for voltage from the TMP36
var inputPin = "P9_40";

//allow the remote (beagle) temp to drop 1 degree celsius (1.8 degrees f) lower than the Nest ambient temp.
var maxTempDiff = 1; 
//keep track of what the target temp was when it was when it was over-ridden, so we can set the temp back to that sometime
var targetTempAtTimeOfOverride = -1;
//don't set the nest to higher than this value (don't want to come up to a 90 degree house)
var maxOverrideTemp = 23.333; //74F
//assume if we're lower than this value, then something's gone wrong (sensor unplugged or something) -- don't update the nest temp.
var lowBeagleTemp = 12; //53.6F
//assume if the nest is set to a target temp under this value, that it's nighttime or away mode, and do nothing.
var nightTimeTargetTemp = 19; //66.2F

//Nest account username and password
var username = "NEST_USERNAME";
var password = "NEST_PASSWORD";

//SMS info for Twilio
var smsFromPhone='+TWILIO_PHONE_NUMBER'; //Twilio #
var smsToPhone='+RECIPIENT_PHONE_NUMBER'; //my actual phone

//HTTP Options for web logging
var options = {
    host:"LOGGING HOST URL",
	path:"",
	method:"GET",
	port:"80"
};

/**
 * Log into the nest endpoint
 **/
nest.login(username, password, function (err, data) {
    if (err) {
        httpLog({"Nest Login Error":err.message});
        process.exit(1);
        return;
    }
    tempChangeSMS("Nest Begin");
    
    nest.fetchStatus(function (data) {
        for (var deviceId in data.device) {
            if (data.device.hasOwnProperty(deviceId)) {
                var device = data.shared[deviceId];    
                
                var nestAmbientTempC = device.current_temperature;
                var nestTargetTempC = device.target_temperature;
                var beagleTempC = getBeagleTemp();
                
                compareTemps(deviceId,nestTargetTempC,nestAmbientTempC,beagleTempC);

                // here's the device and ID
                //nest.setTemperature(deviceId, nest.ftoc(71));
            }
        }
        subscribe();        
    });
});

/**
 * Subscribe to notifications from the Nest thermostat
 **/
function subscribe() {
    nest.subscribe(subscribeDone);
}

/**
 * Callback function for Nest subscription
 **/
function subscribeDone(deviceId, data) {
    if (deviceId) {        
        var nestAmbientTempC = data.current_temperature;
        var nestTargetTempC = data.target_temperature;
        
        var beagleTempC = getBeagleTemp();        
        
        compareTemps(deviceId,nestTargetTempC,nestAmbientTempC,beagleTempC);
    }
    setTimeout(subscribe, 2000);
}

/**
 * Compare temperatures and turn up the heat if they are too far apart
 * 
 * @deviceId device id for the Nest -- assigned by Nest
 * @nestTargetTempC the current target temp of the nest (what the thermostat is set to)
 * @nestAmbientTempC the current ambient temp at the nest (what the temp actually is in the room)
 * @beagleTempC the current ambient temp at the beaglebone as reported by the TMP36 sensor
 * 
 * If the difference in temperatures between nestAmbientTempC and beagleTempC exceeds maxTempDiff, turn up
 * the temperature by a value of nestAmbientTempC+tempDiff-maxTempDiff. Eventually reset it when the temp
 * is warm enough, the 
 * 
 **/
function compareTemps(deviceId,nestTargetTempC,nestAmbientTempC,beagleTempC) {
    httpLog({"Target Temp":nest.ctof(nestTargetTempC),"Nest Ambient Temp":nest.ctof(nestAmbientTempC),"Beagle Temp":nest.ctof(beagleTempC)});

    var minBeagleTemp;
    
    if(targetTempAtTimeOfOverride == -1) {
        minBeagleTemp = nestTargetTempC-maxTempDiff;
    }
    else {
        minBeagleTemp = targetTempAtTimeOfOverride-maxTempDiff;
    }
    httpLog({"minBeagleTemp":nest.ctof(minBeagleTemp)});
    
    //difference in temps between sensors
    var tempDiff = nestAmbientTempC - beagleTempC;
    
    //beagle is too cold, let's turn up the heat
    // if it's less than minBeagleTemp (12C / 53.6F), somethings probably wrong (wire's gone loose or something)
    // if the target temp is less than nightTimeTargetTemp (19C / 66.2F), don't do anything -- it's night time or away time
    if(beagleTempC < minBeagleTemp && beagleTempC > lowBeagleTemp && nestTargetTempC > nightTimeTargetTemp) {        
        //keep track of what it was set to
        if(targetTempAtTimeOfOverride == -1) {
            
            //calculate a new target temp (turn up the heat)
            var newTargetTemp = nestAmbientTempC+tempDiff-maxTempDiff;
            
            //don't set it higher than the max
            if(newTargetTemp > maxOverrideTemp) newTargetTemp = maxOverrideTemp;
            
            //don't turn the temperature down, because that would be stupid
            if(newTargetTemp > nestTargetTempC) {
                targetTempAtTimeOfOverride = nestTargetTempC;
                
                //set the temp
                nest.setTemperature(deviceId, newTargetTemp);
                httpLog({"Target Temp Updated to":nest.ctof(newTargetTemp)});            
                tempChangeSMS("Nest Target Temp Updated to: "+nest.ctof(newTargetTemp));
            }
        }
    }
    else {
        httpLog({"message":"Temp is higher than min..."});
        if(targetTempAtTimeOfOverride > 0) {
            httpLog({"Resetting back to":nest.ctof(targetTempAtTimeOfOverride)});
            nest.setTemperature(deviceId, targetTempAtTimeOfOverride);  
            tempChangeSMS("Resetting back to: "+nest.ctof(targetTempAtTimeOfOverride));
            targetTempAtTimeOfOverride = -1;
        }
    }
}

/**
 * poll ambient temp from the BeagleBone Temperature Sensor (TMP36)
 * TMP36: https://www.sparkfun.com/products/10988
 **/
function getBeagleTemp() {
    var value = b.analogRead(inputPin);
        
    var millivolts = value * 1800;  // 1.8V reference = 1800 mV
    var temp_c = (millivolts - 500) / 10;
    
    httpLog({"Beagle Temp":nest.ctof(temp_c)});   
    return temp_c;
}

/**
 * Send a log message to the log server...
 * Not actually a requirement, but handy to know what's been changed and when
 **/
function httpLog(message) {
    console.log(JSON.stringify(message));
    
    options.path = "/log/"+encodeURIComponent(JSON.stringify(message));

    http.get(options,function(resp) {
		console.log(resp.statusCode);
        //console.log(resp);
        if(resp.statusCode >= 300) {
            console.log(resp);
        }

		var respstr = '';

		resp.on('data',function(chunk){
			respstr += chunk;
		});

		resp.on('end',function() {
			console.log(respstr);
		});
	}).on("error", function(e){
		console.log("Got http error: " + e.message);
	});
}

/**
 * Send an SMS message that the temp has been updated
 **/
function tempChangeSMS(message) {
    client.sms.messages.create({
        to:smsToPhone,
        from:smsFromPhone,
        body:message
    }, function(error, message) {
        if (!error) {
        console.log('Success! The SID for this SMS message is:');
        console.log(message.sid);
 
        console.log('Message sent on:');
        console.log(message.dateCreated);
        }
        else {
            console.log('Oops! There was an error.');
        }
    });
}