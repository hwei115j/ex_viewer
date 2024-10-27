const { ipcRenderer, clipboard } = require("electron");
const { webFrame } = require('electron');

var json = {
    "//": "這是用來設定的JSON檔案",
    "//": "然後因為技術力不足加上JSON的格式蠻嚴格的，容易寫錯，如果修改設定後程式當掉，可以從壓縮檔中恢復setting.json",
    "//": "鍵盤設定",
    "//": "鍵盤定義可以從這個網站上得知https://keycode.info/",
    "text": "設定",
    "type": "list",
    "value": {
        "keyboard_setting": {
            "text": "鍵盤設定",
            "type": "list",
            "value": {
                "global": {
                    "text": "全域設定",
                    "type": "list",
                    "value": {
                        "full_screen": {
                            "text": "全螢幕, 預設值是Enter",
                            "type": "key",
                            "value": [
                                13
                            ]
                        },
                        "back": {
                            "text": "回到book，預設值是Backspace",
                            "type": "key",
                            "value": [
                                8
                            ]
                        },
                        "name_sort": {
                            "text": "按照名稱排序",
                            "type": "key",
                            "value": [
                                96,
                                48
                            ]
                        },
                        "random_sort": {
                            "text": "隨機排序",
                            "type": "key",
                            "value": [
                                97,
                                49
                            ]
                        },
                        "chronology": {
                            "text": "按照時間排序，由新到舊",
                            "type": "key",
                            "value": [
                                98,
                                50
                            ]
                        },
                        "exit": {
                            "text": "關閉程式",
                            "type": "key",
                            "value": [
                                27
                            ]
                        }
                    }
                },
                "book": {
                    "text": "book設定",
                    "type": "list",
                    "value": {
                        "prev_book": {
                            "text": "跳到上一本，預設值是ctrl + 方向鍵←和[",
                            "type": "key",
                            "value": [
                                [
                                    17,
                                    37
                                ],
                                219
                            ]
                        },
                        "next_book": {
                            "text": "跳到下一本，預設值是ctrl + 方向鍵→和]",
                            "type": "key",
                            "value": [
                                [
                                    17,
                                    39
                                ],
                                221
                            ]
                        }
                    }
                },
                "view": {
                    "text": "view設定",
                    "type": "list",
                    "value": {
                        "prev_book": {
                            "text": "跳到上一本，預設值是ctrl + 方向鍵←和[",
                            "value": [
                                [
                                    17,
                                    37
                                ],
                                219
                            ]
                        },
                        "next_book": {
                            "text": "跳到下一本，預設值是ctrl + 方向鍵→和]",
                            "type": "key",
                            "value": [
                                [
                                    17,
                                    39
                                ],
                                221
                            ]
                        },
                        "prev": {
                            "text": "上一頁，預設值是方向鍵←，與pageup（除了veiw頁面外無法使用）",
                            "type": "key",
                            "value": [
                                37,
                                33
                            ]
                        },
                        "next": {
                            "text": "下一頁，預設值是方向鍵→，與pagedown（除了veiw頁面外無法使用）",
                            "type": "key",
                            "value": [
                                39,
                                34
                            ]
                        },
                        "home": {
                            "text": "跳到第一頁，預設值是home（除了veiw頁面外無法使用）",
                            "type": "key",
                            "value": [
                                36
                            ]
                        },
                        "end": {
                            "text": "跳到最尾頁，預設值是end（除了veiw頁面外無法使用）",
                            "type": "key",
                            "value": [
                                35
                            ]
                        },
                        "move_up": {
                            "text": "放大之後往上移動",
                            "type": "key",
                            "value": [
                                38
                            ]
                        },
                        "move_down": {
                            "text": "放大之後往下移動",
                            "type": "key",
                            "value": [
                                40
                            ]
                        },
                        "move_left": {
                            "text": "放大之後往左移動",
                            "type": "key",
                            "value": [
                                37
                            ]
                        },
                        "move_right": {
                            "text": "放大之後往右移動",
                            "type": "key",
                            "value": [
                                39
                            ]
                        },
                        "zoom_in": {
                            "text": "放大",
                            "type": "key",
                            "value": [
                                107,
                                187
                            ]
                        },
                        "zoom_out": {
                            "text": "縮小",
                            "type": "key",
                            "value": [
                                109,
                                189
                            ]
                        },
                        "zoom": {
                            "text": "恢復為預設大小",
                            "type": "key",
                            "value": [
                                111,
                                191
                            ]
                        }
                    }
                }
            }
        },
        "update": {
            "text": "是否每次開啟時都更新資料庫",
            "type": "bool",
            "value": false
        },
        "debug": {
            "text": "是否開啟「開發人員工具」",
            "type": "bool",
            "value": true
        },
        "full_page": {
            "text": "是否開啟整頁瀏覽",
            "type": "bool",
            "value": false
        },
        "zoom": {
            "text": "頁面放大倍率，預設是110%",
            "type": "number",
            "value": 110
        },
        "home_max": {
            "text": "首頁最多顯示圖片數量",
            "type": "number",
            "value": 50
        },
        "page_max": {
            "text": "本子頁最多顯示圖片數量",
            "type": "number",
            "value": 20
        },
        "cache": {
            "text": "快取圖片數量",
            "type": "number",
            "value": 20
        }
    }
}
var r_json = JSON.parse(JSON.stringify(json));

let book_id;
let uiLanguage;
let keyboardEventHome;
let setting;
const settingDiv = document.getElementById("setting-div");

const keyNames = {
    8: "Backspace",
    9: "Tab",
    13: "Enter",
    16: "Shift",
    17: "Control",
    18: "Alt",
    19: "Pause",
    20: "CapsLock",
    27: "Escape",
    32: "Space",
    33: "PageUp",
    34: "PageDown",
    35: "End",
    36: "Home",
    37: "ArrowLeft (←)",
    38: "ArrowUp (↑)",
    39: "ArrowRight (→)",
    40: "ArrowDown (↓)",
    45: "Insert",
    46: "Delete",
    48: "0",
    49: "1",
    50: "2",
    51: "3",
    52: "4",
    53: "5",
    54: "6",
    55: "7",
    56: "8",
    57: "9",
    65: "KeyA",
    66: "KeyB",
    67: "KeyC",
    68: "KeyD",
    69: "KeyE",
    70: "KeyF",
    71: "KeyG",
    72: "KeyH",
    73: "KeyI",
    74: "KeyJ",
    75: "KeyK",
    76: "KeyL",
    77: "KeyM",
    78: "KeyN",
    79: "KeyO",
    80: "KeyP",
    81: "KeyQ",
    82: "KeyR",
    83: "KeyS",
    84: "KeyT",
    85: "KeyU",
    86: "KeyV",
    87: "KeyW",
    88: "KeyX",
    89: "KeyY",
    90: "KeyZ",
    91: "Meta",
    93: "ContextMenu",
    96: "Numpad0",
    97: "Numpad1",
    98: "Numpad2",
    99: "Numpad3",
    100: "Numpad4",
    101: "Numpad5",
    102: "Numpad6",
    103: "Numpad7",
    104: "Numpad8",
    105: "Numpad9",
    106: "NumpadMultiply (*)",
    107: "NumpadAdd (+)",
    109: "NumpadSubtract (-)",
    110: "NumpadDecimal (.)",
    111: "NumpadDivide (/)",
    144: "NumLock",
    145: "ScrollLock",
    186: "Semicolon (;)",
    187: "Equal (=)",
    188: "Comma (,)",
    189: "Minus (-)",
    190: "Period (.)",
    191: "Slash (/)",
    192: "Backquote (`)",
    219: "BracketLeft ([)",
    220: "Backslash",
    221: "BracketRight (])",
    222: "Quote (')"
};

function parse(jsonInput, currentLevel = 1) {
    switch (jsonInput.type) {
        case "list": {
            let div = document.createElement("div");
            settingDiv.appendChild(div)
            div.style.marginLeft = `${(currentLevel - 1) * 20}px`; // Add an indentation based on currentLevel
            div.innerHTML = `<h${currentLevel}>${jsonInput.text}</h${currentLevel}>`
            settingDiv.appendChild(div)
            if (currentLevel > 4) {
                currentLevel = 4;
            }
            for (i in jsonInput.value) {
                parse(jsonInput.value[i], currentLevel + 1);
            }
            break;
        }
        case "bool": {
            let div = document.createElement("div");
            settingDiv.appendChild(div);
            div.style.marginLeft = `${(currentLevel - 1) * 20}px`; // Add an extra indentation based on parentLevel

            let checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = jsonInput.value;
            checkbox.addEventListener("change", function () {
                jsonInput.value = this.checked;
            });
            div.appendChild(document.createElement("label")).appendChild(document.createTextNode(jsonInput.text));
            div.appendChild(document.createElement("br"));
            div.appendChild(checkbox);
            settingDiv.appendChild(document.createElement("br"));
            break;
        }
        case "number": {
            let div = document.createElement("div");
            settingDiv.appendChild(div);
            div.style.marginLeft = `${(currentLevel - 1) * 20}px`; // Add an extra indentation based on parentLevel

            let inputbox = document.createElement("input");
            inputbox.value = jsonInput.value;
            inputbox.addEventListener("change", function () {
                let r = parseInt(this.value, 10);
                if (r != NaN && r > 0) {
                    console.log(r);
                    jsonInput.value = r;
                }
            });

            div.appendChild(document.createElement("label")).appendChild(document.createTextNode(jsonInput.text));
            div.appendChild(document.createElement("br"));
            div.appendChild(inputbox);
            settingDiv.appendChild(document.createElement("br"));
            break;
        }
        case "key": {
            let div = document.createElement("div");
            let pressedKeys = [];
            let addPressedKeys = [];
            settingDiv.appendChild(div)
            div.style.marginLeft = `${(currentLevel - 1) * 20}px`; // Add an extra indentation based on parentLevel

            let inputBox = document.createElement("input");
            let addBtn = document.createElement("button");
            addBtn.textContent = "Add";
            addBtn.classList.add("add-button");
            let delBtn = document.createElement("button");
            delBtn.textContent = "Delete";
            let select = document.createElement("select");

            for (i in jsonInput.value) {
                let op = document.createElement("option");

                if (jsonInput.value[i].constructor === Array) {
                    op.textContent = keyNames[parseInt(jsonInput.value[i][0])] + " + " + keyNames[parseInt(jsonInput.value[i][1])];
                } else {
                    //op.textContent = parseInt(jsonInput.value[i]);
                    op.textContent = keyNames[parseInt(jsonInput.value[i])];
                }
                select.appendChild(op);
            }


            inputBox.addEventListener("keydown", function (event) {
                event.preventDefault(); // prevent the typed text from appearing in the input box

                if (pressedKeys.length < 2 && !pressedKeys.includes(event.keyCode)) {
                    pressedKeys.push(event.keyCode);
                }

                if (pressedKeys.length > 2) {
                    pressedKeys = pressedKeys.slice(0, 2);
                }

                let keyName = pressedKeys.map(keyCode => {
                    return keyNames[parseInt(keyCode)];
                }).join(" + ");

                addPressedKeys = JSON.parse(JSON.stringify(pressedKeys));
                inputBox.value = keyName;
            });

            inputBox.addEventListener("keyup", function (event) {
                let index = pressedKeys.indexOf(event.keyCode);
                if (index > -1) {
                    pressedKeys.splice(index, 1);
                }
            });

            addBtn.addEventListener("click", () => {
                console.log(addPressedKeys);
                if (addPressedKeys.length == 0 || !keyNames.hasOwnProperty(addPressedKeys[0])) {
                    inputBox.value = "";
                    addPressedKeys = [];
                    return;
                }
                let op = document.createElement("option");
                if (addPressedKeys.length == 1) {
                    op.textContent = keyNames[addPressedKeys[0]];
                    jsonInput.value.push(addPressedKeys[0]);
                } else {
                    op.textContent = keyNames[addPressedKeys[0]] + " + " + keyNames[addPressedKeys[1]];
                    jsonInput.value.push(addPressedKeys);
                }
                inputBox.value = "";
                addPressedKeys = [];
                select.appendChild(op);
            });

            delBtn.addEventListener("click", () => {
                if (select.length == 0) {
                    return;
                }
                // get the currently selected option in the dropdown
                const selectedOption = select.options[select.selectedIndex];
                console.log(selectedOption.value + " , " + jsonInput.value[select.selectedIndex]);
                jsonInput.value.splice(select.selectedIndex, 1);
                // remove the selected option from the dropdown
                select.removeChild(selectedOption);
            });
            //div.innerHTML = `<label>${jsonInput.text}</label><br><input type="text"><button>Add</button><select></select><button>Delete</button>`;
            div.appendChild(document.createElement("label")).appendChild(document.createTextNode(jsonInput.text));
            div.appendChild(document.createElement("br"));
            div.appendChild(inputBox);
            div.appendChild(addBtn);
            div.appendChild(select);
            div.appendChild(delBtn);
            settingDiv.appendChild(document.createElement("br"));
            break;

        }
    }
}


let saveBtn = document.getElementById("saveBtn");
saveBtn.addEventListener("click", () => {
    console.log("SAVE");
    let newJson = JSON.parse(JSON.stringify(setting));
    let zoom = newJson.value.zoom.value;
    let home_max = newJson.value.home_max.value;
    let page_max = newJson.value.page_max.value;
    let cache = newJson.value.cache.value;

    console.log(zoom, home_max, page_max, cache);
    if (!Number.isInteger(zoom) || zoom < 50 || zoom > 200) {
        console.log("zoom = " + zoom);
        newJson.value.zoom.value = 110;
    }
    if (!Number.isInteger(home_max) || home_max < 20 || home_max > 200) {
        console.log("home_max = " + home_max);
        newJson.value.home_max.value = 50;
    }
    if (!Number.isInteger(page_max) || page_max < 10 || page_max > 200) {
        console.log("page_max = " + page_max);
        newJson.value.home_max.value = 20;
    }
    if (!Number.isInteger(cache) || cache < 1 || cache > 200) {
        console.log("cache = "+ cache);
        newJson.value.home_max.value = 20;
    }
    ipcRenderer.send('put-settingStatus', { setting: newJson });
    ipcRenderer.on('put-settingStatus-reply', (event) => {
        window.location.href = "home.html"
    });
});
document.getElementById("GoBackBtn").addEventListener("click", () => {
    window.location.href = "home.html"
});
ipcRenderer.send('get-pageStatus');
ipcRenderer.on('get-pageStatus-reply', (event, data) => {
    console.log("setting.js");
    book_id = data.book_id;
    uiLanguage = data.uiLanguage;
    keyboardEventHome = data.keyboardEventHome;
    setting = data.setting;

    webFrame.setZoomFactor(setting.value.zoom.value/100);
    parse(setting);
});