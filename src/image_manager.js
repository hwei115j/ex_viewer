/*jshint esversion: 8 */
const fs = require("fs");
const join = require("path").join;
const url = require("url");
const JSZip = require("jszip-sync");
const StreamZip = require("node-stream-zip");
const exten = /^.*(\.jpg)|(\.jpeg)|(\.jfif)|(\.pjpeg)|(\.pjp)|(\.svg)|(\.webp)|(\.png)|(\.gif)/;
const comp = /^.*(\.zip)/;

function gethead(path) {
    let img;
    let name;
    let zip_path;

    if (path.indexOf(".zip") == -1 && path.indexOf(".ZIP") == -1) {
        let dir = fs.readdirSync(path);
        for (let i in dir) {
            if (exten.test(dir[i])) {
                img = url.pathToFileURL(join(path, dir[i])).href;
                name = dir[i];
                break;
            }
        }
    } else {
        let dir = fs.readFileSync(path);
        let zip = new JSZip();
        zip_path = path;

        zip.sync(() => {
            let r = zip.loadAsync(dir);
            r.then(x => {
                for (let i in x.files) {
                    if (!x.files[i].dir && exten.test(x.files[i].name)) {
                        img = url.pathToFileURL(join(path, x.files[i].name))
                            .href;
                        name = x.files[i].name;
                        break;
                    }
                }
            });
        });
    }

    if (isNaN(zip_path)) {
        let dir = fs.readFileSync(zip_path);
        let zip = new JSZip();
        let reg;

        zip.sync(() => {
            zip.loadAsync(dir).then(x => {
                zip.file(name)
                    .async("blob")
                    .then(blob => {
                        reg = blob;
                    });
            });
        });

        return URL.createObjectURL(reg);
    }
    return img;
}
async function getheadAsync(path) {
    let img;
    let name;

    if (path.indexOf(".zip") == -1 && path.indexOf(".ZIP") == -1) {
        let dir;
        try {
            dir = fs.readdirSync(path);
            for (let i in dir) {
                if (exten.test(dir[i])) {
                    img = url.pathToFileURL(join(path, dir[i])).href;
                    name = dir[i];
                    break;
                }
            }
            return img;
        } catch(e) {
            return null;
        }
    } else {
        const zip = new StreamZip.async({ file: path });
        zip_path = path;

        const entries = await zip.entries();
        for (const entry of Object.values(entries)) {
            if(!entry.isDirectory) {
                img = url.pathToFileURL(join(path, entry.name)).href;
                name = entry.name;
                break;
            }
        }
        const data = await zip.entryData(name);
        await zip.close();
        let blob = new Blob([data]);
        return URL.createObjectURL(blob);
    }
}
async function init(path) {
    let img_list = [];
    let name_list = [];
    let zip_path = null;

    async function gethead_async() {
        if (isNaN(zip_path)) {
            const zip = new StreamZip.async({ file: zip_path });
            const data = await zip.entryData(name_list[0]);
            await zip.close();
            let blob = new Blob([data]);
            return URL.createObjectURL(blob);
            /*
            let dir = fs.readFileSync(zip_path);
            let zip = new JSZip();
            let reg;

            zip.sync(() => {
                zip.loadAsync(dir).then(x => {
                    zip.file(name_list[0])
                        .async("blob")
                        .then(blob => {
                            reg = blob;
                        });
                });
            });

            return URL.createObjectURL(reg);
            */
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

    async function getimg_async(gid) {
        if (gid < 0 && gid > img_list.length) {
            console.log("err gid");
            return null;
        }

        if (isNaN(zip_path)) {
            const zip = new StreamZip.async({ file: zip_path });
            const data = await zip.entryData(name_list[gid]);
            await zip.close();
            let blob = new Blob([data]);
            let url = URL.createObjectURL(blob);

            return url;
        } else {
            return img_list[gid];
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
                    zip.file(name_list[gid])
                        .async("blob")
                        .then(blob => {
                            reg = blob;
                        });
                });
            });

            let url = URL.createObjectURL(reg);
            return url;
        }
        return img_list[gid];
    }

    if (path.indexOf(".zip") == -1 && path.indexOf(".ZIP") == -1) {
        let dir = fs.readdirSync(path);
        for (let i in dir) {
            if (exten.test(dir[i])) {
                img_list.push(url.pathToFileURL(join(path, dir[i])).href);
                name_list.push(dir[i]);
            }
        }
    } else {
        const zip = new StreamZip.async({ file: path });
        zip_path = path;
        const entries = await zip.entries();
        for (const entry of Object.values(entries)) {
            if(!entry.isDirectory && exten.test(entry.name)) {
                img_list.push(url.pathToFileURL(join(path, entry.name)).href);
                name_list.push(entry.name);
            }
        }
        await zip.close();
    }

    function de() {
        return img_list;
    }

    return {
        gethead: gethead,
        gethead_async: gethead_async,
        getimg: getimg,
        getimg_async: getimg_async,
        getname: getname,
        length: img_list.length,
        de: de,
        id: 0
    };
}

function isbook(path) {
    // 判斷是不是本子，本子是一個資料夾或是壓縮檔，內部至少有一張圖片
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
        // 這是一個同步的函式
        // 使用Jszip會有效能問題，使用node-stream-zip則只有非同步的API，所以暫時擱置
        if (comp.test(path)) {
            return true;
        } else {
            return false;
        }
        if (comp.test(path)) {
            let dir = fs.readFileSync(path);
            let zip = new JSZip();

            return zip.sync(() => {
                let r = zip.loadAsync(dir);
                let input = [];
                r.then(x => {
                    for (let i in x.files) {
                        if (!x.files[i].dir) input.push(x.files[i].name);
                    }
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
    getheadAsync: getheadAsync,
    gethead: gethead,
    init: init,
    isbook: isbook
};
