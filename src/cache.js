/*jshint esversion: 8 */

//TODO 應該由json檔設定
const MAX = 20;

function init(img, id) {
    let buffer = [];
    let first = dom(id);

    function dom(gid) {
        let r = new Image();
        r.src = "?";
        r.complete = false;
        img.getimg_async(gid).then((url) => {
            r.src = url;
            r.complete = true;
        });
        r.id = "pic";
        return r;
    }

    function getElement(pivot) {
        let reg = [];

        if(pivot == id) 
            return first;
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

        let difference = buffer.filter(x => !reg.includes(x));
        for(let i in difference) {
            if(difference[i]) {
                URL.revokeObjectURL(difference[i].src);
            }
        }
        buffer = [];
        buffer = [...reg];

        return buffer[pivot];
    }

    function free() {
        for(let i in buffer) {
            if(buffer[i]) {
                URL.revokeObjectURL(buffer[i].src);
            }
        }
        URL.revokeObjectURL(first.src);
        first = null;
        buffer = [];
    }
    return {
        getElement: getElement,
        free: free
    };

}

module.exports = {
    init: init
};
