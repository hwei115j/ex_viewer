/*jshint esversion: 6 */
const fs = require("fs");
const join = require("path").join;
const url = require("url");
const JSZip = require("jszip-sync");
const exten = /^.*(\.jpg)|(\.jpeg)|(\.jfif)|(\.pjpeg)|(\.pjp)|(\.svg)|(\.webp)|(\.png)|(\.gif)/;
const comp = /^.*(\.zip)/;

function init(path) {
    let img_list = [];
    let name_list = [];
    let zip_path = null;

    function gethead() {
        if (isNaN(zip_path)) {
            let dir = fs.readFileSync(zip_path);
            let zip = new JSZip();
            let reg;

            zip.sync(() => {
                zip.loadAsync(dir).then(x => {
                    zip.file(name_list[0]).async("blob").then((blob) => {
                        reg = blob;
                    });
                });
            });

            return URL.createObjectURL(reg);
        }
        return img_list[0];
    }

    function getname(gid) {
        if (gid < 0 && gid > img_list.length) {
            console.log("err gid");
            return null;
        }
        return name_list[gid];
    }

    function getimg_async(gid, callback) {
        if (gid < 0 && gid > img_list.length) {
            console.log("err gid");
            return null;
        }

        if (isNaN(zip_path)) {
            fs.readFile(zip_path, (err, dir) => {
                let zip = new JSZip();

                zip.loadAsync(dir).then(() => {
                    zip.file(name_list[gid]).async("blob").then((blob) => {
                        callback(URL.createObjectURL(blob));
                        URL.revokeObjectURL(blob);
                    });
                });
            });
        } else {
            callback(img_list[gid]);
        }
    }

    function getimg(gid) {
        if (gid < 0 && gid > img_list.length) {
            console.log("err gid");
            return null;
        }
        if (isNaN(zip_path)) {
            let dir = fs.readFileSync(zip_path);
            let zip = new JSZip();
            let reg;

            zip.sync(() => {
                zip.loadAsync(dir).then(() => {
                    zip.file(name_list[gid]).async("blob").then((blob) => {
                        reg = blob;
                    });
                });
            });

            let url =  URL.createObjectURL(reg);
            URL.revokeObjectURL(reg);
            return url;
        }
        return img_list[gid];
    }

    if (path.indexOf(".zip") == -1 && path.indexOf(".ZIP") == -1) {
        let dir = fs.readdirSync(path);
        for (let i in dir) {
            if (exten.test(dir[i])) {
                img_list.push(
                    url.pathToFileURL(
                        join(path, dir[i])
                    ).href
                );
                name_list.push(dir[i]);
            }
        }
    } else {
        let dir = fs.readFileSync(path);
        let zip = new JSZip();
        zip_path = path;

        zip.sync(() => {
            let r = zip.loadAsync(dir);
            let input = [];

            r.then(x => {
                x.forEach(file => {
                    input.push(file);
                });
            });
            for (let i in input) {
                img_list.push(
                    url.pathToFileURL(
                        join(path, input[i])
                    ).href
                );
                name_list.push(input[i]);
            }
        });
    }

    function de() {
        return img_list;
    }

    return {
        gethead: gethead,
        getimg: getimg,
        getimg_async: getimg_async,
        getname: getname,
        length: img_list.length,
        de: de,
        id: 0
    };
}

function isbook(path) {
    try {
        fs.accessSync(path, fs.constants.F_OK);

        let dir = fs.readdirSync(path);
        let r = null;
        for (let i in dir) {
            if (exten.test(dir[i])) {
                r = dir[i];
                break;
            }
        }
        return r == null ? false : true;
    } catch (err) {
        if (comp.test(path)) {
            let dir = fs.readFileSync(path);
            let zip = new JSZip();

            return zip.sync(() => {
                let r = zip.loadAsync(dir);
                let input = [];
                r.then(x => {
                    x.forEach(file => {
                        input.push(file);
                    });
                });
                for (let i in input) {
                    if (exten.test(input[i])) {
                        return true;
                    }
                }
                return false;
            });
        }
        return false;
    }
}

module.exports = {
    init: init,
    isbook: isbook
};