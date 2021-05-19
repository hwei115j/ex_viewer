/*jshint esversion: 6 */
const global = require("electron").remote.getGlobal("sharedObject");
const MAX = global.setting.cache;

function init(img, id) {
    let buffer = {};
    let first = dom(id);

    function dom(gid) {
        let r = new Image();
        img.getimg_async(gid ,(i)=> {
            r.src = i;
        });
        r.id = "pic";
        return r;
    }

    return (pivot) => {
        let reg = [];

        if(pivot == id) return first;
        if (img.length < MAX) {
            if (Object.keys(buffer).length === 0) {
                for (let i = 0; i < img.length; i++) {
                    buffer[i] = dom(i);
                }
            }
            return buffer[pivot];
        }

        for (let i = pivot - MAX / 2; i < pivot + MAX / 2; i++) {
            let r = i < 0 ? img.length + i : i;
            r = r >= img.length ? r - img.length : r;

            if (buffer[r]) {
                reg[r] = buffer[r];
            } else {
                reg[r] = dom(r);
            }
        }

        buffer = [];
        for (let i in reg) {
            buffer[i] = reg[i];
        }
        return buffer[pivot];
    };

}

module.exports = {
    init: init
};
