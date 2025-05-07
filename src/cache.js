/*jshint esversion: 8 */
const { ipcRenderer } = require("electron");

class ImageCache {
    constructor(options = {}) {
        // 快取配置
        this.config = {
            // 同一資料夾中往前往後快取的圖片數量
            sameGroupPreloadCount: options.sameGroupPreloadCount || 3,
            // 其他資料夾往前往後快取的數量
            otherGroupPreloadCount: options.otherGroupPreloadCount || 1,
            // 在第一頁時的快取窗口大小
            firstPageWindowSize: options.firstPageWindowSize || 1,
            // 最大重試次數
            maxRetries: options.maxRetries || 3,
            // 重試間隔（毫秒）
            retryDelay: options.retryDelay || 1000
        };

        // 快取存儲
        this.cache = new Map();
        
        // 當前狀態
        this.currentbookId = null;
        this.currentImageId = null;
        this.groupsCount = 0; // 改為僅存儲數量，而非整個陣列
        this.currentBookInfo = null;
    }

    // 初始化快取，設置資料夾數量
    initialize(groupsCount) {
        this.groupsCount = typeof groupsCount === 'number' ? groupsCount : 
                          (Array.isArray(groupsCount) ? groupsCount.length : 0);
    }

    // 設定當前書本信息
    setCurrentBookInfo(bookInfo, bookId) {
        this.currentBookInfo = bookInfo;
        this.currentbookId = bookId;
    }

    // 取得快取鍵
    getCacheKey(bookId, imageId) {
        return `${bookId}:${imageId}`;
    }

    // 檢查圖片是否在快取中
    hasImage(bookId, imageId) {
        const key = this.getCacheKey(bookId, imageId);
        return this.cache.has(key);
    }

    // 從快取獲取圖片
    getImage(bookId, imageId) {
        const key = this.getCacheKey(bookId, imageId);
        if (this.cache.has(key)) {
            console.log(`Cache hit: ${key}`);
            return this.cache.get(key);
        }
        return null;
    }

    // 獲取並快取單張圖片
    async fetchAndCacheImage(bookId, imageId, retryCount = 0) {
        const key = this.getCacheKey(bookId, imageId);
        console.log(`Fetching image: ${key}`);
        
        try {
            // 通過 IPC 從主進程獲取圖片路徑
            const response = await ipcRenderer.invoke('image:getImagePath', { 
                index: bookId, 
                page: imageId 
            });
            
            if (!response || !response.path) {
                throw new Error(`無法獲取圖片路徑: ${key}`);
            }
            
            // 創建新的 Image 元素
            const img = new Image();
            
            // 使用 Promise 監聽載入事件
            const loadPromise = new Promise((resolve, reject) => {
                img.onload = () => {
                    console.log(`Image loaded: ${key}`);
                    resolve(img);
                };
                
                img.onerror = (error) => {
                    reject(new Error(`圖片載入失敗: ${key} - ${error}`));
                };
            });
            
            // 設置圖片來源
            img.src = response.path;
            
            // 等待圖片載入完成
            const loadedImg = await loadPromise;
            
            // 將載入的圖片存入快取
            this.cache.set(key, loadedImg);
            
            return loadedImg;
            
        } catch (error) {
            console.error(`圖片載入錯誤 (${key}):`, error);
            
            // 實現重試邏輯
            if (retryCount < this.config.maxRetries) {
                console.log(`重試 (${retryCount + 1}/${this.config.maxRetries}): ${key}`);
                
                // 等待重試間隔
                await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
                
                // 遞迴調用自身進行重試
                return this.fetchAndCacheImage(bookId, imageId, retryCount + 1);
            } else {
                console.error(`已達到最大重試次數，無法載入圖片: ${key}`);
                throw error; // 重試失敗後拋出錯誤
            }
        }
    }

    // 根據當前位置更新快取窗口
    async updateCacheWindow(bookId, imageId) {
        this.currentbookId = bookId;
        this.currentImageId = imageId;
        
        // 清除可能不再需要的快取項目
        this.pruneCache();
        
        // 計算需要快取的圖片清單
        const imagesToCache = this.calculateCacheList(bookId, imageId);
        
        // 非同步載入所有需要的圖片
        const cachePromises = [];
        for (const item of imagesToCache) {
            if (!this.hasImage(item.bookId, item.imageId)) {
                cachePromises.push(this.fetchAndCacheImage(item.bookId, item.imageId));
            }
        }
        
        // 等待所有快取操作完成
        if (cachePromises.length > 0) {
            await Promise.allSettled(cachePromises);
        }
    }
    
    // 計算需要快取的圖片列表
    calculateCacheList(bookId, imageId) {
        const result = [];
        
        if (this.groupsCount <= 0 || !this.currentBookInfo) {
            return result;
        }
        
        const totalGroups = this.groupsCount; // 使用存儲的數量，而非陣列長度
        const totalImages = this.currentBookInfo.length;
        
        // 是否在第一頁
        const isFirstPage = imageId === 0;
        
        // 同一資料夾內的快取範圍
        const sameGroupRange = isFirstPage 
            ? this.config.firstPageWindowSize 
            : this.config.sameGroupPreloadCount;
        
        // 其他資料夾的快取範圍
        const otherGroupRange = this.config.otherGroupPreloadCount;
        
        // 1. 快取當前圖片
        result.push({ bookId, imageId });
        
        // 2. 同一資料夾內往前往後的圖片
        for (let i = 1; i <= sameGroupRange; i++) {
            // 往前
            const prevImageId = (imageId - i + totalImages) % totalImages;
            if (prevImageId !== imageId) {
                result.push({ bookId, imageId: prevImageId });
            }
            
            // 往後
            const nextImageId = (imageId + i) % totalImages;
            if (nextImageId !== imageId) {
                result.push({ bookId, imageId: nextImageId });
            }
        }
        
        for (let j = 1; j <= otherGroupRange; j++) {
            // 往前的資料夾
            const prevGroupId = (bookId - j + totalGroups) % totalGroups;
            if (prevGroupId !== bookId) {
                result.push({ bookId: prevGroupId, imageId: 0 });
            }
            
            // 往後的資料夾
            const nextGroupId = (bookId + j) % totalGroups;
            if (nextGroupId !== bookId) {
                result.push({ bookId: nextGroupId, imageId: 0 });
            }
        }
        
        return result;
    }
    
    // 清理不再需要的快取項目
    pruneCache() {
        if (!this.currentbookId && !this.currentImageId) {
            return;
        }
        
        const neededItems = this.calculateCacheList(this.currentbookId, this.currentImageId);
        const neededKeys = new Set();
        
        for (const item of neededItems) {
            neededKeys.add(this.getCacheKey(item.bookId, item.imageId));
        }
        
        // 使用簡單的 LRU 策略：移除不在需要範圍內的項目
        for (const key of this.cache.keys()) {
            if (!neededKeys.has(key)) {
                this.cache.delete(key);
                console.log(`Removed from cache: ${key}`);
            }
        }
    }
    
    // 使用快取獲取圖片元素，如果沒有則載入
    async getImageElement(bookId, imageId) {
        // 首先嘗試從快取獲取
        let img = this.getImage(bookId, imageId);
        
        if (!img) {
            // 若不在快取中，則載入並快取
            img = await this.fetchAndCacheImage(bookId, imageId);
        }
        
        // 更新快取窗口（非同步，不阻塞返回）
        this.updateCacheWindow(bookId, imageId).catch(err => {
            console.error("更新快取窗口時出錯:", err);
        });
        
        return img;
    }
    
    // 清空所有快取
    clearCache() {
        this.cache.clear();
        console.log("已清空圖片快取");
    }
    
    // 更新配置
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log("快取配置已更新:", this.config);
    }
}

module.exports = ImageCache;
