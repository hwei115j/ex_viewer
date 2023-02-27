/*jshint esversion: 8 */

const {ipcRenderer} = require("electron");


ipcRenderer.send('get-pageStatus');
ipcRenderer.on('pageStatus-data', (event, data) => {
    console.log("pageStatus");
    console.log(data);
});