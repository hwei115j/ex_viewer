# ex_viewer  
這是一個本本管理軟體，其想法類似[Hentai Ark](https://www.ptt.cc/bbs/AC_In/M.1569436760.A.261.html)  
會利用從EX上獲取的metadata來**自動**將本機上的本本做整理，並提供類似exhentai界面的方式來使用  
與Hentai Ark不同的地方在於，我的程式更加注重瀏覽，可以在看本時利用快捷鍵快速切換上下本  
瀏覽方式類似[HoneyView](https://tw.bandisoft.com/honeyview/)，並增加了隨機排序的方式，防止在本本資料庫中都是看到那幾本  
  
**本程式有版權疑慮，主要是UI、示例圖片，未來可能因此設為私人**  
## 目錄  
* [ex_viewer](#ex_viewer)
   * [目錄](#目錄)
   * [畫面介紹](#畫面介紹)
   * [下載＆安裝](#下載安裝)
      * [Windows執行檔安裝](#windows執行檔安裝)
      * [原始碼編譯安裝](#原始碼編譯安裝)
   * [使用說明](#使用說明)
      * [匹配畫面](#匹配畫面)
      * [主畫面](#主畫面)
      * [本子畫面](#本子畫面)
      * [瀏覽畫面](#瀏覽畫面)
      * [設定](#設定)
   * [特性與設定](#特性與設定)
      * [快取](#快取)
      * [本子隨機、順序切換](#本子隨機順序切換)
      * [UI語言分離](#ui語言分離)
      * [本機資料庫與路徑](#本機資料庫與路徑)
      * [壓縮檔](#壓縮檔)
      * [本機資料庫更新](#本機資料庫更新)
   * [免責聲明](#免責聲明)
   * [Thanks](#thanks)
## 畫面介紹  
![3](_v_images/20210606231404519_21639.gif)  
## 下載＆安裝  
Windows使用者可以使用我編譯好的執行檔安裝即可，其他作業系統使用者可以使用原始碼編譯安裝，我的程式「理論上」是跨平台的  
  
### Windows執行檔安裝  
從[這裡](https://github.com/hwei115j/ex_viewer/releases/tag/0.91)下載，其中`ex_viewer.zip`是主程式，`setting.zip`是設定和資料庫  
首先先將兩個壓縮檔分別解壓縮，會得到`ex_viewer`和`setting`兩個資料夾，再把`setting`資料夾放到`ex_viewer`資料夾中  
最後按下`ex_view.exe`就能開始程式了  
  
### 原始碼編譯安裝  
首先先安裝[node.js](https://nodejs.org/)，輸入以下指令開始編譯  
  
```bash  
git clone https://github.com/hwei115j/ex_viewer  
npm install  
npm run dist  
```  
  
產生可執行檔案，再從[這裡](https://github.com/hwei115j/ex_viewer/releases/tag/0.91)下載`setting.zip`解壓縮，再把`setting`資料夾放到`ex_viewer`資料夾中  
經測試可以在ubuntu上正常運作  
  
## 使用說明  
程式分為：  
- 匹配畫面  
- 主畫面  
- 本子畫面  
- 瀏覽畫面  
- 設定  
  
### 匹配畫面  
當第一次打開程式時，會進入匹配畫面，選擇存放本本的資料夾，它會自動搜尋底下所有的本本  
本本的定義為：裡面沒有其他資料夾且裡面有圖片的資料夾，以及裡面有圖片的zip檔案  
  
資料夾本本格式  
```  
+ 資料夾（本子名）  
    + 圖片1  
    + 圖片2  
    + .........   
```  
zip格式則是只要zip裡有圖片（忽略資料夾），就算是本本  
```  
+ zip（本子名）  
    + 圖片1  
    + 圖片2  
    + .........  
```  
  
按下選擇目錄，可以選擇要匹配的根目錄，選擇成功後路徑會在下面會列出，有一個選單可以選擇要深入的層數  
一層代表資料夾→本本，二層則是資料夾→資料夾→本本，依此類推  
  
![2](_v_images/20210606180641094_32323.gif)  
### 主畫面  
主畫面為  
![i14fykI](_v_images/20210606233644139_14693.png)  
其中有匹配到的本本，在圖片的下方會顯示對應的分類、日期（ex上傳日期）、圖片頁數（ex圖片頁數），未匹配到的本本則會全部顯示null  
而按下圖片則會進入本子畫面  
  
搜尋支援`AND`、`OR`和`-`（排除）語法而使用`.null`關鍵字可以搜尋到沒有匹配到的本本，也支援ex的標籤語法（ex:`character:"makaino ririmu$"`）  
上方分類欄則與ex一致，按下為排除對應分類，全部按下則與全部不按相同  
  
鍵盤功能：  
- `esc`: 關閉程式  
- `enter`: 全螢幕  
- `<-`: 上一頁  
- `->`: 下一頁  
  
### 本子畫面  
本子畫面為  
![0VNB9pu](_v_images/20210606233657945_10139.png)  
  
如果未匹配到則會是  
 ![O8SHpgb](_v_images/20210606233937522_9356.png)  
標題第一欄是本機本子名，第二欄是ex上的原文名稱，第三欄則是ex上的羅馬字名稱  
中間是tag，按下則會顯示藍色，並在側邊顯示tag的解釋（如果有的話），按下下方的`搜尋`，則會跳回主畫面並搜尋所有選擇（藍色）的tag  
需要注意的是，解釋只會顯示最後按下的tag，如果有想要看解釋的藍色tag，那要先把取消藍色，再按一次就能看解釋了（按兩次就對了）  
  
鍵盤功能：  
- `esc`: 關閉程式  
- `enter`: 全螢幕  
- `backspace`: 退回主畫面  
- `<-`: 上一頁  
- `->`: 下一頁  
- `ctrl + <-`、`[`: 上一本  
- `ctrl + ->`、`]`: 下一本  
- `0`: 排序（可以在隨機排序與照本子名排序中切換）  
  
  
### 瀏覽畫面  
瀏覽畫面為  
![5GUBETs](_v_images/20210606233709498_12934.png)  
使用滾輪可以切換上下頁，當在第一頁時，左上角會短暫顯示「第一頁」  
  
鍵盤功能：  
- `esc`: 關閉程式  
- `enter`: 全螢幕  
- `backspace`: 退回本子畫面  
- `+`：放大  
- `-`：縮小  
- `/`：回復預設大小  
- `home`：第一頁  
- `end`：最尾頁  
- `<-`、`pageup`: 上一頁  
- `->`、`pagedown`: 下一頁  
- `ctrl + <-`、`[`: 上一本  
- `ctrl + ->`、`]`: 下一本  
- `0`: 排序（可以在隨機排序與照本子名排序中切換）  
  
### 設定  
這個軟體的所有設定都使用JSON設定，設定檔放在`setting/setting.json`  
其中`"//"`開頭的文字是註解，用來解釋對應的功能，要修改設定可以自行參考註解去做修改  
  
## 特性與設定  
  
### 快取  
由於使用技術的限制，圖片的載入速度稍慢，所以設計了快取機制，同時載入多張圖片，以降低快速切換圖片造成的延遲（但解析度太大的圖片還是愛莫能助）  
預設是20張圖片，也就是在看一張圖片的時候，會同時載入前面10張圖與後面10張圖  
可以根據需求在設定中調整，但要注意效能瓶頸在於硬碟讀取速度，隨意加大反而會讓效能降低  
  
### 本子隨機、順序切換  
類似音樂的隨機播放功能，在看本子的時候，防止固定順序造成審美疲勞  
在「本子畫面」或「瀏覽畫面」中按下「數字鍵0」便會切換成隨機或是按照名稱排序  
如果是在「瀏覽畫面」中切換成隨機，左上角會短暫出現「Random」提示  
![5](_v_images/20210606232338747_23457.gif)  
  
### UI語言分離  
中文UI和中文解釋放在`setting/language`裡、可以自行修改UI語言  
~~我也不知道做這個幹嘛~~  
  
### 本機資料庫與路徑  
```  
setting/  
├── language  
    ├── ui.json  
    ├── LICENSE.md  
    └── definition.json  
├── local  
│   ├── dir.json  
│   └── local.db  
├── ex.db  
└── setting.json  
```  
  
- `definition.json`: ex中文翻譯  
- `ui.json`: ui中文翻譯  
- `ex.db`: ex metadata  
- `local`: 存放使用者資料  
- `dir.json`: 存放需要update的路徑  
- `local.db`: 存放匹配過得本子資料  
- `setting.json`: 存放使用者設定  
  
### 壓縮檔  
目前支援zip格式的本本，但實際使用中會有小bug  
  
### 本機資料庫更新  
由於更新本機資料庫會讓開啟速度變慢，所以預設是關閉本機資料庫更新  
如果電腦上的本本有增加或減少，請去設定裡面把`update`設為`true`  
  
## 免責聲明  
我的程式能力並不出色，此程式只在我的電腦測試過，並不可靠，從無法開啟到世界末日都有可能  
如有疑慮請不要使用，本人對此程式造成的結果不負任何責任。  
  
## Thanks  
這個程式使用`nodejs`+`eletron`開發、`electron-builder`完成分發  
照抄`exhentai.org`的HTML與CSS  
中文翻譯是使用[EhTagTranslation](https://github.com/EhTagTranslation/Database)的成果做繁簡轉換而成，其 LICENSE 為`setting/language/LICENSE.md`  
  
使用了以下套件  
- [dialogs](https://github.com/jameskyburz/dialogs)  
- [fast-levenshtein](https://github.com/hiddentao/fast-levenshtein)  
- [jszip-sync](https://github.com/ericvergnaud/jszip)  
- [sqlite3](https://github.com/mapbox/node-sqlite3)  
- [node-stream-zip](https://github.com/antelle/node-stream-zip)  
- [viewerjs](https://github.com/fengyuanchen/viewerjs)  
- [electron](https://github.com/electron/electron)  
- [electron-builder](https://github.com/electron-userland/electron-builder)