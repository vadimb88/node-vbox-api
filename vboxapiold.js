'use strict';
const exec = require('child_process').exec;
const execSync = require('child_process').execSync;
const os = require('os');

var errors = {
	VBOX_E_OBJECT_NOT_FOUND: 'VBOX_E_OBJECT_NOT_FOUND'
}

var commandsList = { 
	'linux': {
		"4": {
			'NEW_STRING_CHARACTER': '\n',
			'GET_MACHINE_INFO': 'showvminfo "%vmname%" --machinereadable',
			'GET_LIST_OF_ALL_MACHINES': 'list vms',
			'GET_LIST_OF_RUNNING_MACHINES': 'list runningvms',
			'GET_LIST_OF_ALL_MACHINES_LONG': 'list --long vms',
			'GET_SCREENSHOT_OF_VM': 'controlvm "%vmname%" screenshotpng "%filename%"'
		}
	},
	'windows': {
		"5": {
			'NEW_STRING_CHARACTER': '\n',
			'GET_MACHINE_INFO': 'showvminfo "%vmname%" --machinereadable',
			'GET_LIST_OF_ALL_MACHINES': 'list vms',
			'GET_LIST_OF_RUNNING_MACHINES': 'list runningvms',
			'GET_LIST_OF_ALL_MACHINES_LONG': 'list --long vms',
			'GET_SCREENSHOT_OF_VM': 'controlvm "%vmname%" screenshotpng "%filename%"'
		}
	}
};

function execCommand(command) {
	console.log(command);
	return new Promise(function(resolve, reject) {
		exec(command, (error, stdout, stderr) => {
			if (error) {
				console.error(`exec error: ${error}`);
			    //reject(new Error(error.message.replace(/\r\n/g,'\n')));
			    resolve({stderr: error.message.replace(/\r\n/g,'\n')});
			}
			var output = {};
			output.stdout = stdout ? stdout.replace(/\r\n/g,'\n') : undefined;
			output.stderr = stderr ? stderr.replace(/\r\n/g,'\n') : undefined;
			resolve(output);			  
		});
	});
	
}

function getErrorMessage(error) {
	if(/VBOX_E_OBJECT_NOT_FOUND/.test(error)) {
		return { error: error.split('\n')[1].replace(/.*error: +(.*?)/,'$1')};
	} else if(/is not currently running/.test(error)) {
		return { error: error.split('\n')[1].replace(/.*error: +(.*?)/,'$1')};
	}
	console.log(error);
	return 'Unknown error';
}

function getVirtualBoxVersion(vboxPath) {
	var output;
	try {
		output = execSync(`${vboxPath} --version`, { encoding: 'utf8'});
	} catch(err) {
		if(/is not recognized as an internal or external command|[Nn]o command.*found/.test(err.stderr)) {
			console.log("ERROR: can't find VBoxManage on " + vboxPath);
			process.exit();
		} else {
			throw err;
		}
	}
	return output;
}

function getComandList(majorVersion) {
	var osType = os.type().match(/[Ll]inux|[Ww]indows/)[0].toLowerCase();
	if(commandsList[osType]) {
		if(commandsList[osType][majorVersion]) {
			console.log("Using major version " + majorVersion+ " of VBoxManage for " + osType);
			return commandsList[osType][majorVersion];
		} else {
			console.log("ERROR: " + majorVersion + " version of VirtualBox for " + osType + " is not supported");
			process.exit();
		}
	} else {
		console.log("ERROR: VirtualBox for " + osType + " is not supported");
		process.exit();
	}
}

function VBoxApi(vboxPath) {
	this.name="VBoxApi";	
	this.vboxManagePath = vboxPath;
	this.vboxVersion = getVirtualBoxVersion(vboxPath);
	this.vboxMajorVersion = parseInt(this.vboxVersion.replace(/\..*/,''));
	this.commands = getComandList(this.vboxMajorVersion);	
}

function parseListOutputShort(output) {	
	let listOfMachines = {};	
	if(output.stdout) {
		output.stdout.split(this.commands.NEW_STRING_CHARACTER).map((machineString) => {
	    	if(!!machineString) {
	    		let machinesUUID = machineString.replace(/.*?\{(.*?)\}.*/,"$1");
		    	let machinesName = machineString.replace(/.*?\"(.*?)\".*/,"$1");
		    	if(machinesUUID && machinesName) {
		    		listOfMachines[machinesUUID] = machinesName;
		    	}	    	
	    	}    	
	    });
	}    
    return listOfMachines;
}

function parseInfoString(infoString, newStringChar, propertyesArray) {
	var machineInfo = {};
	var stringArray = infoString.split(newStringChar);
	//Вот это переделать обязательно!!!
	let usbDeviceFiltersNum = stringArray.indexOf('USB Device Filters:');
	if(usbDeviceFiltersNum != -1) {
		stringArray[usbDeviceFiltersNum] += stringArray[usbDeviceFiltersNum+1] + stringArray[usbDeviceFiltersNum+2] + stringArray[usbDeviceFiltersNum+3];
		stringArray[usbDeviceFiltersNum+1] =stringArray[usbDeviceFiltersNum+2] = stringArray[usbDeviceFiltersNum+3] = '';
	}
	console.log(propertyesArray);
	stringArray.map((propertyString) => {
		if(!!propertyString) {
			//console.log(propertyString);
			let propertyName = propertyString.replace(/(.*?):.*/,'$1');
			//console.log(propertyName + propertyName.length);
			//console.log(propertyesArray.indexOf(propertyName));
			if(!propertyesArray || propertyesArray.indexOf(propertyName) != -1) {
				let propertyValue = propertyString.replace(/.*?:[\s\t]*(.*)/,'$1');
				//console.log(propertyValue); 			
    			machineInfo[propertyName.toLowerCase().replace(/\s/,'_')] = propertyValue;
			}
			
    	}
	});
	//console.log(machineInfo);
	return machineInfo;
}

function parseListOutputLong(output, propertyesArray) {	
	let listOfMachines = {};
	console.log(output.stdout.split('\n\n\n').length);
	//var hhh= this.commands.NEW_STRING_CHARACTER+this.commands.NEW_STRING_CHARACTER+this.commands.NEW_STRING_CHARACTER;
	//console.log(this.commands.NEW_STRING_CHARACTER);
	//console.log(this.commands.NEW_STRING_CHARACTER+this.commands.NEW_STRING_CHARACTER+this.commands.NEW_STRING_CHARACTER);
    /*output.stdout.split(this.commands.NEW_STRING_CHARACTER+this.commands.NEW_STRING_CHARACTER+this.commands.NEW_STRING_CHARACTER).map((machineString) => {
    	console.log(1);
    	if(!!machineString) {
    		
    		var machineInfo = parseInfoString(machineString, this.commands.NEW_STRING_CHARACTER, propertyesArray);
    		if(machineInfo.uuid) {
    			listOfMachines[machineInfo.uuid] = machineInfo;
    		}  			
    		
    	}	    	
    	  	
    });*/
    return listOfMachines;
}

function parseMachineInfo(output, propertyesArray) {
	var machineInfo = {};
	if(output.stderr) {
		return getErrorMessage(output.stderr);
	}
	output.stdout.split(this.commands.NEW_STRING_CHARACTER).map((propertyString) => {    	
    	var propertyName = propertyString.replace(/=.*/,'').toLowerCase().replace(/\"|\'/g,'').replace(/-/g,'_');
    	var propertyValue = propertyString.replace(/.*=/,'').replace(/\"|\'/g,'');
    	//console.log(propertyName + "        " + propertyValue);
    	if(propertyName.length > 0 && (!propertyesArray || propertyesArray.indexOf(propertyName) != -1)) {
    		machineInfo[propertyName] = propertyValue;		
    	}  	    	  	
    });
    return machineInfo;
}

VBoxApi.prototype.getMachineInfo = function(vmUUID, propertyesArray) {
	return execCommand(`${this.vboxManagePath} ${this.commands.GET_MACHINE_INFO.replace(/%vmname%/,vmUUID)}`)
	.then(output => parseMachineInfo.call(this, output, propertyesArray))
	.catch(error => getErrorMessage(error.message));
	//return execCommand('"C:\\Program Files\\Oracle\\VirtualBox\\VBoxManage.exe" showvminfo \"{d48bb810-917c-4a52-8045-e8c2538b7f0c}\" --machinereadable');
}

VBoxApi.prototype.getMachinesListInfoSeq = function(vmList, propertyesArray) {
	var machinesInfo = {};
	return vmList.reduce((queue, vmUUID) => {
		return queue.then(() => this.getMachineInfo(vmUUID, propertyesArray))
		.then((machine) => machinesInfo[vmUUID] = machine);
	}, Promise.resolve(1)).then(() => machinesInfo);
}

VBoxApi.prototype.getMachinesListInfoParall = function(vmList, propertyesArray) {
	var machinesInfo = {};
	var parall = vmList.map(vmUUID => this.getMachineInfo(vmUUID, propertyesArray)
									      .then(machine => machinesInfo[vmUUID] = machine)
									      .catch(error => machinesInfo[vmUUID] = error));
	return Promise.all(parall).then(() => machinesInfo);	
}

VBoxApi.prototype.getListOfAllMachines = function() {
	return execCommand(`${this.vboxManagePath} ${this.commands.GET_LIST_OF_ALL_MACHINES}`)
	.then(parseListOutputShort.bind(this));		
}

VBoxApi.prototype.getListOfRunningMachines = function() {
	return execCommand(`${this.vboxManagePath} ${this.commands.GET_LIST_OF_RUNNING_MACHINES}`)
	.then(parseListOutputShort.bind(this));
}

VBoxApi.prototype.getListOfAllMachinesLong = function(propertyesArray = ['name','ostype','uuid', 'vmstate']) {						//фильтровать свойства можно и прямо здесь с grep'ом, но надо ли?
	return this.getListOfAllMachines(propertyesArray)
		.then(machinesList => Object.keys(machinesList))
		.then(vmList => this.getMachinesListInfoSeq(vmList, propertyesArray));

	/*return execCommand(`${this.vboxManagePath} ${this.commands.GET_LIST_OF_ALL_MACHINES_LONG}`)
	.then((output) => parseListOutputLong.call(this, output, propertyesArray));	*/
}

VBoxApi.prototype.getScreenshot = function(vmUUID, filename) {
	return execCommand(`${this.vboxManagePath} ${this.commands.GET_SCREENSHOT_OF_VM.replace(/%vmname%/,vmUUID).replace(/%filename%/,filename)}`)
		.then(output => !output.stderr ? { answer: "Ok"} : getErrorMessage(output.stderr));
}
/*execCommand('vboxmanage list vms')
.then((output)  => {
	console.log(output);
})
.catch((error) => {
	console.log(error.message);
	throw error;
});*/
module.exports.create = (vboxPath) => {
	//getVirtualBoxVersion(osType, vboxPath);
	return new VBoxApi(vboxPath)
};
