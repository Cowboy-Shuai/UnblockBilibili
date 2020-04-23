// ==UserScript==
// @name                哔哩哔哩番剧解锁
// @namespace           https://github.com/vcheckzen/UnblockBilibili
// @icon                https://www.bilibili.com/favicon.ico
// @description         大会员账号共享解锁脚本
// @version             0.1.9.5
// @author              https://github.com/vcheckzen
// @supportURL          https://github.com/vcheckzen/UnblockBilibili/issues
// @contributionURL     https://github.com/vcheckzen/UnblockBilibili
// @include             *bilibili.com/bangumi/play*
// @include             /.+bilibili.com/video/(av|bv1).+/
// @run-at              document-end
// @grant               GM.cookie
// ==/UserScript==

(() => {
    'use strict';
    // 目前看视频会自动切换到会员账号，其他页面会切回来，暂时没有精力实现更精细的登录控制。
    // 下行双引号里面填写大会员 Cookie。复制得到的 Cookie，不要做任何修改，直接粘贴保存。
    // 请务必清空哔哩哔哩 Cookie 和 LocalStorage 重新登录后再使用。
    const ORIGINAL_VIP_COOKIE_STRING = "";

    // 下行双引号里的数字用于控制画质，从高到低依次为 120，116，112，80，70，64，32，16，自适应对应 0。
    const CURRENT_QUALITY = "120";

    const NEEDED_VIP_COOKIE_KEYS = ['bili_jct', 'DedeUserID', 'DedeUserID__ckMd5', 'sid', 'SESSDATA', 'CURRENT_QUALITY'];
    const UNBLOCK_UTIL = {
        cookie: {
            set: cookie => {
                'secure session sameSite hostOnly'.split(' ').forEach(key => delete cookie[key]);
                return GM.cookie.set(cookie);
            },
            list: option => GM.cookie.list(option),
            delete: option => GM.cookie.delete(option)
        },
        localStorage: {
            set: (key, value) => window.localStorage.setItem(key, JSON.stringify(value)),
            get: key => JSON.parse(window.localStorage.getItem(key)),
            delete: key => window.localStorage.removeItem(key)
        },
        operation: {
            isLocked: () => window.localStorage.getItem('OPRATION_LOCK'),
            lock: () => window.localStorage.setItem('OPRATION_LOCK', true),
            unlock: () => window.localStorage.removeItem('OPRATION_LOCK'),
            promiseAll: (array, singlePromise) => {
                const promises = [];
                array.forEach(elem => promises.push(singlePromise(elem)));
                return Promise.all(promises);
            }
        }
    };

    const FORMATED_VIP_COOKIES = (() => {
        let formatedCookies = {};
        if (ORIGINAL_VIP_COOKIE_STRING !== '') {
            const cookies = ORIGINAL_VIP_COOKIE_STRING.split('; ');
            cookies.forEach(cookie => {
                const kv = cookie.split('=');
                if (NEEDED_VIP_COOKIE_KEYS.indexOf(kv[0]) >= 0) {
                    formatedCookies[kv[0]] = kv[1];
                }
            });
        } else {
            formatedCookies = UNBLOCK_UTIL.localStorage.get('FORMATED_VIP_COOKIES') || formatedCookies;
        }
        formatedCookies.CURRENT_QUALITY = CURRENT_QUALITY;
        UNBLOCK_UTIL.localStorage.set('FORMATED_VIP_COOKIES', formatedCookies);
        return formatedCookies;
    })();

    if (Object.getOwnPropertyNames(FORMATED_VIP_COOKIES).length !== NEEDED_VIP_COOKIE_KEYS.length) {
        if (confirm('哔哩哔哩番剧解锁：大会员 Cookie 不正确，脚本无法正常运行，是否查看详细使用说明？')) {
            location.href = 'https://logi.im/script/unblocking-bilibili-without-perception.html';
        }
        return;
    }

    const setPlayerVideoQuality = () => {
        return new Promise(resolve => {
            const player_settings = UNBLOCK_UTIL.localStorage.get('bilibili_player_settings') || { setting_config: {} };
            player_settings.setting_config.defquality = parseInt(CURRENT_QUALITY);
            UNBLOCK_UTIL.localStorage.set('bilibili_player_settings', player_settings);
            resolve();
        });
    };

    const saveUserCookie = () => UNBLOCK_UTIL.cookie.list({}).then(cookies => {
        if (!document.cookie.includes('CURRENT_QUALITY')) {
            cookies.push({ 'name': 'CURRENT_QUALITY', 'domain': '.bilibili.com', 'path': '/', 'value': CURRENT_QUALITY });
        }
        UNBLOCK_UTIL.localStorage.set('USER_COOKIES', cookies);
        return UNBLOCK_UTIL.operation.promiseAll(cookies, cookie => UNBLOCK_UTIL.cookie.delete({ name: cookie.name }))
    });

    const setVipCookie = () => {
        const vipCookies = [], userCookies = UNBLOCK_UTIL.localStorage.get('USER_COOKIES');
        const initializeCookieStructure = (name, value) => {
            const objectCookies = userCookies.filter(cookie => cookie.name === name);
            if (objectCookies.length > 0) {
                objectCookies[0].value = value;
                return objectCookies[0];
            }
        };
        for (const key in FORMATED_VIP_COOKIES) {
            if (FORMATED_VIP_COOKIES.hasOwnProperty(key)) {
                vipCookies.push(initializeCookieStructure(key, FORMATED_VIP_COOKIES[key]));
            }
        }
        return UNBLOCK_UTIL.operation.promiseAll(vipCookies, cookie => UNBLOCK_UTIL.cookie.set(cookie));
    };

    const recoverUserCookie = () => {
        return UNBLOCK_UTIL.operation.promiseAll(UNBLOCK_UTIL.localStorage.get('USER_COOKIES'),
            cookie => UNBLOCK_UTIL.cookie.set(cookie))
            .then(() => UNBLOCK_UTIL.localStorage.delete('USER_COOKIES'));
    };

    const getVideoUrl = () => {
        if (/.+ss\d+.+/.test(location.href) && window.__INITIAL_STATE__) {
            return window.__INITIAL_STATE__.epInfo.id;
        }
        return location.href;
    };

    const listenUrlChange = () => {
        UNBLOCK_UTIL.localStorage.set('LAST_PLAY_URL', getVideoUrl());
        ['.r-con', '.plp-r'].forEach(className => {
            const el = document.querySelector(className);
            if (el) {
                el.addEventListener('click', () => {
                    window.clicked = true;
                    setTimeout(() => sequence(), 400);
                })
            };
        });
    };

    const sequence = () => {
        if (UNBLOCK_UTIL.operation.isLocked()
            || (window.clicked
                && getVideoUrl() === UNBLOCK_UTIL.localStorage.get('LAST_PLAY_URL'))
        ) return;
        Promise.resolve()
            .then(() => UNBLOCK_UTIL.operation.lock())
            .then(() => saveUserCookie())
            .then(() => setPlayerVideoQuality())
            .then(() => setVipCookie())
            .then(() => UNBLOCK_UTIL.operation.unlock())
            .then(() => location.reload());
    };

    const referrer = document.referrer;
    if (UNBLOCK_UTIL.localStorage.get('USER_COOKIES') === null
        && (referrer === location.href
            || referrer.indexOf('/bangumi/play') > 0
            || (!(/.+video\/(av|bv1).+/i.test(referrer))
                && referrer.indexOf('/bangumi/play') < 0)
        )
    ) {
        sequence();
    } else if (!UNBLOCK_UTIL.operation.isLocked()) {
        UNBLOCK_UTIL.operation.lock();
        setTimeout(() => {
            recoverUserCookie()
                .then(() => listenUrlChange())
                .then(() => UNBLOCK_UTIL.operation.unlock());
        }, 250);
    }
})();
