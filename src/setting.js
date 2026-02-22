const { ipcRenderer} = require("electron");
const { webFrame } = require('electron');

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

function replace(name) {
    return uiLanguage[name] ? uiLanguage[name] : name;
}

function parse(jsonInput, currentLevel = 1) {
    switch (jsonInput.type) {
        case "list": {
            let div = document.createElement("div");
            settingDiv.appendChild(div)
            div.style.marginLeft = `${(currentLevel - 1) * 20}px`; // Add an indentation based on currentLevel
            div.innerHTML = `<h${currentLevel}>${replace(jsonInput.text)}</h${currentLevel}>`
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
            div.style.marginLeft = `${(currentLevel - 1) * 20}px`;

            let toggleLabel = document.createElement("label");
            toggleLabel.classList.add("toggle-label");

            let toggleSwitch = document.createElement("span");
            toggleSwitch.classList.add("toggle-switch");

            let checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = jsonInput.value;
            checkbox.addEventListener("change", function () {
                jsonInput.value = this.checked;
            });

            let track = document.createElement("span");
            track.classList.add("toggle-track");

            toggleSwitch.appendChild(checkbox);
            toggleSwitch.appendChild(track);

            toggleLabel.appendChild(toggleSwitch);
            toggleLabel.appendChild(document.createTextNode(replace(jsonInput.text)));
            div.appendChild(toggleLabel);
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

            div.appendChild(document.createElement("label")).appendChild(document.createTextNode(replace(jsonInput.text)));
            div.appendChild(document.createElement("br"));
            div.appendChild(inputbox);
            settingDiv.appendChild(document.createElement("br"));
            break;
        }
        case "enum": {
            let div = document.createElement("div");
            settingDiv.appendChild(div);
            div.style.marginLeft = `${(currentLevel - 1) * 20}px`;

            let select = document.createElement("select");
            select.classList.add("enum-select");

            jsonInput.options.forEach(optVal => {
                let option = document.createElement("option");
                option.value = optVal;
                option.textContent = optVal;
                if (optVal === jsonInput.value) {
                    option.selected = true;
                }
                select.appendChild(option);
            });

            select.addEventListener("change", function () {
                const n = Number(this.value);
                jsonInput.value = Number.isFinite(n) ? n : this.value;
            });

            div.appendChild(document.createElement("label")).appendChild(document.createTextNode(replace(jsonInput.text)));
            div.appendChild(document.createElement("br"));
            div.appendChild(select);
            settingDiv.appendChild(document.createElement("br"));
            break;
        }
        case "key": {
            let div = document.createElement("div");
            let pressedKeys = [];
            let addPressedKeys = [];
            div.style.marginLeft = `${(currentLevel - 1) * 20}px`;
            div.classList.add("key-setting");

            // 標題
            let label = document.createElement("label");
            label.textContent = replace(jsonInput.text);
            div.appendChild(label);
            div.appendChild(document.createElement("br"));

            // 輸入區域容器
            let inputContainer = document.createElement("div");
            inputContainer.classList.add("key-input-container");

            let inputBox = document.createElement("input");
            inputBox.placeholder = replace("Press shortcut key...");
            inputBox.classList.add("key-input");

            // 清除按鈕
            let clearBtn = document.createElement("button");
            clearBtn.textContent = replace("Clear Key");
            clearBtn.classList.add("clear-button");

            let addBtn = document.createElement("button");
            addBtn.textContent = replace("Add Key");
            addBtn.classList.add("add-button");

            // 改用列表顯示已設定的快捷鍵
            let keyList = document.createElement("ul");
            keyList.classList.add("key-list");

            // 渲染已有的快捷鍵
            function renderKeyList() {
                keyList.innerHTML = "";
                jsonInput.value.forEach((keyCombo, index) => {
                    let li = document.createElement("li");
                    let keyText = Array.isArray(keyCombo)
                        ? keyCombo.map(k => keyNames[k] || k).join(" + ")
                        : keyNames[keyCombo] || keyCombo;
                    
                    let span = document.createElement("span");
                    span.textContent = keyText;
                    
                    let delBtn = document.createElement("button");
                    delBtn.textContent = "✕";
                    delBtn.classList.add("delete-key-btn");
                    delBtn.addEventListener("click", () => {
                        jsonInput.value.splice(index, 1);
                        renderKeyList();
                    });
                    
                    li.appendChild(span);
                    li.appendChild(delBtn);
                    keyList.appendChild(li);
                });
            }

            inputBox.addEventListener("keydown", function (event) {
                event.preventDefault();
                if (pressedKeys.length < 2 && !pressedKeys.includes(event.keyCode)) {
                    pressedKeys.push(event.keyCode);
                }
                let keyName = pressedKeys.map(k => keyNames[k] || k).join(" + ");
                addPressedKeys = [...pressedKeys];
                inputBox.value = keyName;
                inputBox.classList.add("key-captured");
            });

            inputBox.addEventListener("keyup", function (event) {
                pressedKeys = pressedKeys.filter(k => k !== event.keyCode);
            });

            inputBox.addEventListener("blur", function () {
                pressedKeys = [];
            });

            clearBtn.addEventListener("click", () => {
                inputBox.value = "";
                pressedKeys = [];
                addPressedKeys = [];
                inputBox.classList.remove("key-captured");
            });

            addBtn.addEventListener("click", () => {
                if (addPressedKeys.length === 0 || !keyNames[addPressedKeys[0]]) {
                    return;
                }
                
                // 檢查重複
                let newKey = addPressedKeys.length === 1 ? addPressedKeys[0] : [...addPressedKeys];
                let isDuplicate = jsonInput.value.some(existing => {
                    if (Array.isArray(existing) && Array.isArray(newKey)) {
                        return existing.length === newKey.length && 
                               existing.every((v, i) => v === newKey[i]);
                    }
                    return existing === newKey;
                });
                
                if (isDuplicate) {
                    inputBox.classList.add("key-duplicate");
                    setTimeout(() => inputBox.classList.remove("key-duplicate"), 500);
                    return;
                }
                
                jsonInput.value.push(newKey);
                renderKeyList();
                
                // 清除輸入
                inputBox.value = "";
                addPressedKeys = [];
                inputBox.classList.remove("key-captured");
            });

            inputContainer.appendChild(inputBox);
            inputContainer.appendChild(clearBtn);
            inputContainer.appendChild(addBtn);
            div.appendChild(inputContainer);
            div.appendChild(keyList);
            settingDiv.appendChild(div);
            settingDiv.appendChild(document.createElement("br"));
            
            renderKeyList();
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
        ipcRenderer.send('put-search', { str: "", category: null});
        window.location.href = "home.html"
    });
});
document.getElementById("GoBackBtn").addEventListener("click", () => {
    window.location.href = "home.html"
});
document.getElementById("RematchBtn").addEventListener("click", () => {
    ipcRenderer.send('rematch');
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