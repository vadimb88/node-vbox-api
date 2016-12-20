//var VBoxApi = require('./vboxapi').create('"C:\\Program Files\\Oracle\\VirtualBox\\VBoxManage.exe"');
var VBoxApi = require('./vboxapi').create();
//console.log(VBoxApi.vboxMajorVersion);
//VBoxApi.getListOfAllMachinesLong(['Name','UUID', 'Guest OS'])
//VBoxApi.getListOfAllMachinesLong()
//VBoxApi.getListOfAllMachines()
//VBoxApi.getListOfRunningMachines()
//VBoxApi.getMachineInfo('de9db889-4b4f-4609-8501-a091d4caf424', ['name','ostype','uuid','guestmemoryballoon'])
VBoxApi.getScreenshot('bfbab461-b255-4ad2-a1d3-f3c857a7e66f', 'newscreen.png')
/*VBoxApi.getMachinesListInfoParall(['8f30a1de-2008-494f-8732-bd5ca6e25d0f', 'c06f6eea-ac45-4f59-a3e2-efaa87c9c2f8', 'a997b8d3-daa1-4346-947f-c400438e631e', '195bc3fa-c1b7-45e3-94e7-4f7c425b407f','432432423'], ['name','ostype','uuid','guestmemoryballoon'])
*/
//VBoxApi.getMachinesListInfoSeq(['bfbab461-b255-4ad2-a1d3-f3c857a7e66f', 'de9db889-4b4f-4609-8501-a091d4caf424', 'a997b8d3-daa1-4346-947f-c400438e631e', '195bc3fa-c1b7-45e3-94e7-4f7c425b407f','432432423'], ['name','ostype','uuid','guestmemoryballoon'])

.then((output)  => {
	//console.log(output['334efacf-00cb-42ef-8b52-e3ac5875e4a4']);
	console.log(output);
})
.catch((error) => {
	console.log(error.message);
	console.log(error.stack);
	throw error;
});