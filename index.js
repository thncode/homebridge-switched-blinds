// missing: blinds<x>pos.txt not existing > create

var request = require("request");
const fs = require('fs');
const path = "/root/.homebridge/blinds";

var Service, Characteristic;

module.exports = function(homebridge) {
	console.log("homebridge API version: " + homebridge.version);
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-switched-blinds", "SmartBlinds", SmartShades);
};


function SmartShades(log, config) {
	this.service = new Service.WindowCovering(this.name);
	this.log = log;
	this.name = config.name || "Window cover";
	this.id = config.id || 0;
	this.filename = path + this.id + ".txt";
	this.rfilename = path + this.id + "pos.txt";
	this.readTime = 0;

	// Required Characteristics
	//this.currentPosition = 100;
	//this.targetPosition = 100;

	//Characteristic.PositionState.DECREASING = 0;
	//Characteristic.PositionState.INCREASING = 1;
	//Characteristic.PositionState.STOPPED = 2;

	// Optional Characteristics
	//this.holdPosition = Characteristic.HoldPosition;
	//this.targetHorizontalTiltAngle = Characteristic.TargetHorizontalTiltAngle;
	//this.targetVerticalTiltAngle = Characteristic.TargetVerticalTiltAngle;
	//this.currentHorizontalTiltAngle = Characteristic.CurrentHorizontalTiltAngle;
	//this.currentVerticalTiltAngle = Characteristic.CurrentVerticalTiltAngle;
	//this.obstructionDetected = Characteristic.ObstructionDetected;

	this.positionState = Characteristic.PositionState.STOPPED;
	this.service.setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);

    this.readData();

   	fs.watch(this.rfilename, (event, rfilename) => {
   		if (event === 'change') this.readData();
   	});
}


Number.prototype.pad = function(size) {
  var s = String(this);
  while (s.length < (size || 2)) {s = "0" + s;}
  return s;
}


SmartShades.prototype = {
	
	//Start
	identify: function(callback) {
		this.log("Identify requested!");
		pos = this.currentPosition.pad(3);
		fs.writeFileSync(this.filename, pos, "utf-8");
		callback(null);
	},
	
	// Required
	getCurrentPosition: function(callback) {
		this.log("getCurrentPosition:", this.currentPosition);
		var error = null;
		callback(error, this.currentPosition);
	},
	
	readData: function() {
	    var data;
	    try {
    		data = fs.readFileSync(this.rfilename, "utf-8");
    	} catch (err) {
    	    this.log("file ", this.rfilename, "not found");
    	    return;
    	}
		var lastSync = Date.parse(data.substring(0, 19));
		if (this.readtime == lastSync) {
		    //this.log(lastSync, "already read");
		    return;
		}
		this.readtime = lastSync;

		var position = parseFloat(data.substring(20));
		if (isNaN(position)) {
		    this.log("NaN");
		    return;
		}

		this.currentPosition = this.targetPosition = position;
		this.service.setCharacteristic(Characteristic.CurrentPosition, this.currentPosition);
		this.log("current position is now %s", this.currentPosition);
		this.positionState = Characteristic.PositionState.STOPPED;
		this.service.setCharacteristic(Characteristic.PositionState, this.positionState);

		this.service.getCharacteristic(Characteristic.PositionState).updateValue(this.positionState, null);
		this.service.getCharacteristic(Characteristic.TargetPosition).updateValue(this.targetPosition, null);
		this.service.getCharacteristic(Characteristic.CurrentPosition).updateValue(this.currentPosition, null);
	},

	getName: function(callback) {
		this.log("getName :", this.name);
		var error = null;
		callback(error, this.name);
	},

	getTargetPosition: function (callback) {
		this.log("getTargetPosition :", this.targetPosition);
		var error = null;
		callback(error, this.targetPosition);
	},

	setTargetPosition: function (value, callback) {
		this.stopped = this.positionState === Characteristic.PositionState.STOPPED;

		this.reverse = false;
		if (this.stopped) {
			if (this.currentPosition > 0 && this.currentPosition < 100 && this.lastDirection == Characteristic.PositionState.DECREASING && value == 0) {
				this.reverse = true;
				//this.log("current position %s", this.currentPosition);
				value = 100;
			}
			this.log("set target position from %s to %s", this.targetPosition, value);
		}
		else {
			this.log("stopping from %s", this.lastDirection);
		}

		this.targetPosition = value;

		if (this.targetPosition < this.currentPosition) {
			this.lastDirection = this.positionState = Characteristic.PositionState.DECREASING;
			this.stopped = false;
		} else if (this.targetPosition > this.currentPosition) {
			this.lastDirection = this.positionState = Characteristic.PositionState.INCREASING;
			this.stopped = false;
		} else if (this.targetPosition = this.currentPosition) {
			this.positionState = Characteristic.PositionState.STOPPED;
		}
		if (this.reverse) {
			this.log("reverse");
			this.lastDirection = this.positionState = Characteristic.PositionState.DECREASING;
		}
		this.service.setCharacteristic(Characteristic.PositionState, this.positionState);
		this.service.getCharacteristic(Characteristic.PositionState).updateValue(this.positionState, null);
		
		pos = this.targetPosition.pad(3);
		fs.writeFileSync(this.filename, pos, "utf-8");			
		
		callback(null); // success
	},

	getPositionState: function(callback) {
		this.log("getPositionState :", this.positionState);
		var error = null;
		callback(error, this.positionState);
	},

	getServices: function() {

		var informationService = new Service.AccessoryInformation();

		informationService
			.setCharacteristic(Characteristic.Manufacturer, "Thomas Nemec")
			.setCharacteristic(Characteristic.Model, "Jalousiesteuerung")
			.setCharacteristic(Characteristic.SerialNumber, "1");

		this.service
			.getCharacteristic(Characteristic.Name)
			.on('get', this.getName.bind(this));

		// Required Characteristics
		this.service
			.getCharacteristic(Characteristic.CurrentPosition)
			.on('get', this.getCurrentPosition.bind(this));

 		this.service
			.getCharacteristic(Characteristic.TargetPosition)
			.on('get', this.getTargetPosition.bind(this))
			.on('set', this.setTargetPosition.bind(this));

		this.service
			.getCharacteristic(Characteristic.PositionState)
			.on('get', this.getPositionState.bind(this));

		// Optional Characteristics
		//TODO
	
		return [informationService, this.service];
	}
};
