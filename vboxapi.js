'use strict';
const { exec, execSync } = require('child_process');

const commandsList = { 	
	'win32': {
		5: {
			'NEW_STRING_CHARACTER': '\n',
			'GET_MACHINE_INFO': 'showvminfo "{{vmname}}" --machinereadable',
			'GET_LIST_OF_ALL_MACHINES': 'list vms',
			'GET_LIST_OF_RUNNING_MACHINES': 'list runningvms',
			'GET_LIST_OF_ALL_MACHINES_LONG': 'list --long vms',
			'GET_SCREENSHOT_OF_VM': 'controlvm "{{vmname}}" screenshotpng "{{filename}}"'
		},
		4: {
			'NEW_STRING_CHARACTER': '\n',
			'GET_MACHINE_INFO': 'showvminfo "{{vmname}}" --machinereadable',
			'GET_LIST_OF_ALL_MACHINES': 'list vms',
			'GET_LIST_OF_RUNNING_MACHINES': 'list runningvms',
			'GET_LIST_OF_ALL_MACHINES_LONG': 'list --long vms',
			'GET_SCREENSHOT_OF_VM': 'controlvm "{{vmname}}" screenshotpng "{{filename}}"'
		}
	}
};

const template = function(template, vals) {
  return template.replace(/{{(.*?)}}/g, (_, str) => {
  	if(str in vals) {
  		return vals[str]
  	};

  	throw new Error(`TEMPLATE ERROR: "${str}" is not defined in template "${template}"`);
  }); 
};

const execCommand = function(command) {
	console.log(command);
	return new Promise(function(resolve, reject) {
		exec(command, (error, stdout, stderr) => {
			if (error) {
				console.error(`exec error: ${error}`);			  
			  resolve({ stderr: error.message.replace(/\r\n/g,'\n') });
			}

			let output = {};
			output.stdout = stdout ? stdout.replace(/\r\n/g,'\n') : undefined;
			output.stderr = stderr ? stderr.replace(/\r\n/g,'\n') : undefined;
			resolve(output);			  
		});
	});	
};

const getComandList = function(majorVersion) {
	const platform = process.platform;
	if(commandsList[platform]) {
		if(commandsList[platform][majorVersion]) {
			console.log(`Using major version ${majorVersion} of VBoxManage for ${platform}.`);
			return commandsList[platform][majorVersion];
		} else {
			console.log(`ERROR: ${majorVersion} version of VirtualBox for ${platform} is not supported.`);
			process.exit();
		}

	} else {
		console.log(`ERROR: VirtualBox for ${platform} is not supported.`);
		process.exit();
	}
};

const getVirtualBoxBinary = function() {
	const { platform, env } = process;
	if(platform === 'win32') {
		return `"${env.VBOX_INSTALL_PATH || env.VBOX_MSI_INSTALL_PATH}VBoxManage.exe"`;
	} else {
		return 'vboxmanage';
	}
};

const getVirtualBoxVersion = function(vboxPath) {
	let output;
	try {
		output = execSync(`${vboxPath} --version`, { encoding: 'utf8'});
	} catch(err) {
		if(/is not recognized as an internal or external command|[Nn]o command.*found/.test(err.stderr)) {
			console.log(`ERROR: can\'t find VBoxManage on ${vboxPath}.`);
			process.exit();
		} else {
			throw err;
		}
	}

	return output.trim();
};

const parseListOutputShort = function(output) {	
	const listOfMachines = {};	
	if(output.stdout) {
		output.stdout.split('\n').forEach((machineString) => {
    	if(!!machineString) {
    		const machinesUUID = machineString.replace(/.*?\{(.*?)\}.*/, "$1");
	    	const machinesName = machineString.replace(/.*?\"(.*?)\".*/, "$1");
	    	if(machinesUUID && machinesName) {
	    		listOfMachines[machinesUUID] = machinesName;
	    	}	    	
    	}    	
    });
	}

  return listOfMachines;
};

const parseMachineInfo = function(output, propertyesArray) {	
	console.log("Parsing");
	const machineInfo = {};
	if(output.stderr) {
		return getErrorMessage(output.stderr);
	}

	output.stdout.split('\n').forEach((propertyString) => {	
		const property = propertyString.split(/=(.+)/, 2);		
  	const propertyName = property[0].toLowerCase();
  	const propertyValue = property[1] ? property[1].replace(/^["']|["']$/g,'') : '';  	
  	if(propertyName.length > 0 && (!propertyesArray || propertyesArray.indexOf(propertyName) != -1)) {
  		machineInfo[propertyName] = propertyValue;
  	}  	    	  	
  });

  return machineInfo;
};

const getErrorMessage = function(error) {
	console.log(error);
	if(/VBOX_E_OBJECT_NOT_FOUND/.test(error)) {
		return { error: error.split('\n')[1].replace(/.*error: +(.*?)/,'$1') };
	} else if(/not( currently)? running/.test(error)) {
		return { error: error.split('\n')[1].replace(/.*error: +(.*?)/,'$1') };
	}
	
	return 'Unknown error';
};

class VBoxApi {
	constructor(vboxPath) {
		this.name='VBoxApi';
		console.log(process.platform);	
		this.vboxBin = vboxPath || getVirtualBoxBinary();
		console.log(this.vboxBin);
		this.vboxVersion = getVirtualBoxVersion(this.vboxBin);
		console.log(this.vboxVersion);
		this.vboxMajorVersion = parseInt(this.vboxVersion.split('.')[0]);
		console.log(this.vboxMajorVersion);
		this.cmd = getComandList(this.vboxMajorVersion);	
	}
	
	exec(command) {
		return execCommand(`${this.vboxBin} ${command}`);
	}

	getListOfAllMachines() {
		return this.exec(this.cmd.GET_LIST_OF_ALL_MACHINES)
			.then(parseListOutputShort);		
	}

	getListOfAllMachinesLong(propertyesArray = ['name','ostype','uuid', 'vmstate']) {					
		return this.getListOfAllMachines()
			.then(machinesList => Object.keys(machinesList))
			.then(vmList => this.getMachinesListInfoSeq(vmList, propertyesArray));
	}

	getListOfRunningMachines() {
		return this.exec(this.cmd.GET_LIST_OF_RUNNING_MACHINES)
			.then(parseListOutputShort);
	}

	getMachinesListInfoSeq(vmList, propertyesArray) {
		const machinesInfo = {};
		return vmList.reduce((queue, vmUUID) => {
			return queue.then(() => this.getMachineInfo(vmUUID, propertyesArray))
				.then((machine) => machinesInfo[vmUUID] = machine);
		}, Promise.resolve())
			.then(() => machinesInfo);
	}

	getMachinesListInfoParall(vmList, propertyesArray) {
		const machinesInfo = {};
		const parall = vmList.map((vmUUID) => {
			return this.getMachineInfo(vmUUID, propertyesArray)
      	.then(machine => machinesInfo[vmUUID] = machine)
      	.catch(error => machinesInfo[vmUUID] = error)
    });

		return Promise.all(parall).then(() => machinesInfo);	
	}

	getMachineInfo(vmUUID, propertyesArray) {
		return this.exec(template(this.cmd.GET_MACHINE_INFO, { vmname: vmUUID }))
			.then(output => parseMachineInfo.call(this, output, propertyesArray))
			.catch(error => getErrorMessage(error.message));		
	}

	getScreenshot(vmUUID, filename) {
		return this.exec(template(this.cmd.GET_SCREENSHOT_OF_VM, { vmname: vmUUID, filename }))
			.then(output => !output.stderr ? { answer: "Ok"} : getErrorMessage(output.stderr));
	}

}

module.exports.create = (vboxPath) => {
	//getVirtualBoxVersion(osType, vboxPath);
	return new VBoxApi(vboxPath)
};