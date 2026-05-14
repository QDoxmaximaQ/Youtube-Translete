export const storage = {
    get(keys, cb) {
        if (typeof chrome !== "undefined" && chrome.storage?.local) {
            chrome.storage.local.get(keys, cb);
        } else {
            const data = {};
            keys.forEach(k => {
                const v = localStorage.getItem(k);
                if (v !== null) data[k] = JSON.parse(v);
            });
            cb(data);
        }
    },
    set(obj) {
        if (typeof chrome !== "undefined" && chrome.storage?.local) {
            chrome.storage.local.set(obj);
        } else {
            Object.entries(obj).forEach(([k, v]) => {
                localStorage.setItem(k, JSON.stringify(v));
            });
        }
    }
};
