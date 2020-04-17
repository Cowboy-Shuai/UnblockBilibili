// ==UserScript==
// @name                哔哩哔哩解析辅助
// @namespace           https://github.com/vcheckzen/UnblockBilibili/blob/master/loliloli.user.js
// @version             0.0.7.4
// @icon                https://www.bilibili.com/favicon.ico
// @description         为哔哩哔哩视频注入一键解析按钮
// @author              https://github.com/vcheckzen
// @supportURL          https://github.com/vcheckzen/UnblockBilibili/issues
// @contributionURL     https://github.com/vcheckzen/UnblockBilibili
// @require             https://unpkg.com/ajax-hook@2.0.2/dist/ajaxhook.min.js
// @include             *2333.com*
// @include             *bilibili.com/video/bv1*
// @include             *bilibili.com/bangumi/play*
// @grant               none
// @run-at              document-start
// ==/UserScript==

(() => {
    'use strict';

    const LOLILOLI = {
        SERVER: 'http://2333.com:2333',
        TOKEN: ''
    };

    if (location.host === new URL(LOLILOLI.SERVER).host) {
        const sp = new URLSearchParams(location.search);
        const from = sp.get('from'), p = sp.get('p');
        if (from && /.+(BV1|ep)\w+/.test(from)
            && localStorage.getItem('token')) {
            document.addEventListener('DOMContentLoaded', () => {
                box.originalUrl = from + (p ? '?p=' + p : '');
            });
        }
        return;
    }

    LOLILOLI.TOKEN = LOLILOLI.TOKEN || localStorage.getItem('LOLILOLI_TOKEN');
    localStorage.setItem('LOLILOLI_TOKEN', LOLILOLI.TOKEN);
    const parseEpId = localStorage.getItem('DIRECT_PARSE');
    if (LOLILOLI.TOKEN
        && parseEpId
        && RegExp('.*/bangumi/play.*').test(location.href)) {
        const hijackKeyResponse = () => {
            window.ah.proxy({
                onRequest: (config, handler) => {
                    if (RegExp('.*api.bilibili.com/pgc/player/web/playurl.*').test(config.url)) {
                        const vid = new URLSearchParams(config.url).get('ep_id');
                        if (vid) {
                            config.url = `${LOLILOLI.SERVER}/video/?vid=ep${vid}&token=${LOLILOLI.TOKEN}`;
                        }
                    }
                    handler.next(config);
                },
                onError: (err, handler) => {
                    handler.next(err);
                },
                onResponse: (response, handler) => {
                    if (RegExp(`.*${LOLILOLI.SERVER}.*`).test(response.config.url)) {
                        if (response.response.code) {
                            alert(response.response.message);
                        }
                        window.ah.unProxy();
                    } else if (RegExp('.*api.bilibili.com/x/web-interface/nav.*').test(response.config.url)) {
                        const resp = JSON.parse(response.response);
                        resp.data.vipType = 2;
                        resp.data.vipStatus = 1;
                        resp.data.vipDueDate = 2 * Date.now();
                        resp.data.vip_pay_type = 1;
                        resp.data.vip_theme_type = 2;
                        response.response = JSON.stringify(resp);
                    }
                    handler.next(response);
                }
            });
        };

        const modifyGlobalValue = (name, modifyFn) => {
            const copyName = `copy_${name}`;
            window[copyName] = window[name];
            let value = undefined;
            Object.defineProperty(window, name, {
                configurable: true,
                enumerable: true,
                get: () => value,
                set: newValue => {
                    value = modifyFn(newValue, copyName);
                }
            });
            if (window[copyName]) {
                window[name] = window[copyName];
            }
        };

        function replaceInitialState() {
            modifyGlobalValue('__INITIAL_STATE__', value => {
                value.loaded = false;
                for (let ep of [value.epInfo, ...value.epList]) {
                    ep.epStatus = 2;
                    ep.loaded = false;
                    if (ep.id === parseInt(parseEpId)) {
                        ep.loaded = true;
                    }
                }
                return value;
            });
        }

        function replaceUserState() {
            modifyGlobalValue('__PGC_USERSTATE__', value => {
                if (value) {
                    delete value.progress;
                    delete value.dialog;
                    value.area_limit = 0;
                    value.vip_info.due_date = Date.now() * 2;
                    value.vip_info.status = 1;
                    value.vip_info.type = 2;
                }
                return value;
            });
        }

        function replacePlayInfo() {
            modifyGlobalValue('__playinfo__', (value, copyName) => {
                if (!window[copyName] && window.document.readyState === 'loading') {
                    window[copyName] = value;
                    return;
                }
                return value;
            });
        }

        hijackKeyResponse();
        replaceUserState();
        replaceInitialState();

        if (!document.getElementById('lock__playinfo')) {
            replacePlayInfo();
            const flag = document.createElement('script');
            flag.id = 'lock__playinfo';
            document.head.appendChild(flag);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        localStorage.removeItem('DIRECT_PARSE');

        const waiterPoor = [];
        const rightLists = ['.r-con', '.plp-r'];

        const payVideo = function () {
            if (/.+(ep|ss)\d+.+/.test(location.href)
                && window.__INITIAL_STATE__.mediaInfo.payMent.vipDiscount !== 1) {
                return true;
            }
            return false;
        };

        const directParse = function () {
            let epId = location.href.match(/ep([\d]+)/);
            if (epId) {
                localStorage.setItem('DIRECT_PARSE', epId[1]);
                location.reload();
            } else {
                epId = window.__INITIAL_STATE__.epInfo.id;
                localStorage.setItem('DIRECT_PARSE', epId);
                location.href = `https://www.bilibili.com/bangumi/play/ep${epId}`;
            }
        }

        const redirectToAnalysisServer = function () {
            const bilibiliHost = 'https://www.bilibili.com/'
            let analysisServer = `${LOLILOLI.SERVER}/?from=`;
            if (/.+ep\d+.+/.test(location.href)) {
                analysisServer += location.href.split('?')[0];
            } else if (/.+ss\d+.+/.test(location.href)) {
                const id = window.__INITIAL_STATE__.epInfo.id;
                analysisServer += bilibiliHost + 'bangumi/play/ep' + id;
            } else if (/.+BV1\w+.+/.test(location.href)) {
                const p = new URLSearchParams(location.search).get('p');
                const bvid = window.__INITIAL_STATE__.videoData.bvid;
                analysisServer += bilibiliHost + 'video/' + bvid + (p ? '&p=' + p : '');
            }
            window.open(analysisServer + '&t=' + Date.now());
        };

        const waitElements = function (selector, callback, noWaiterPool, fail, interval, timeout) {
            interval = interval || 500;
            timeout = timeout || 10000;
            let elems = null, iWaiter = null, tWaiter = null;
            const doCleaning = function () {
                if (noWaiterPool) {
                    clearTimeout(iWaiter);
                    clearTimeout(tWaiter);
                } else {
                    waiterPoor.forEach(waitor => clearTimeout(waitor));
                }
            }

            iWaiter = setInterval(() => {
                elems = document.querySelectorAll(selector);
                if (elems.length) {
                    doCleaning();
                    if (!payVideo()) elems.forEach(elem => callback(elem));
                }
            }, interval);

            tWaiter = setTimeout(() => {
                doCleaning();
                if (typeof fail === 'function') fail();
            }, timeout);

            if (!noWaiterPool) waiterPoor.push(iWaiter, tWaiter);
        };

        const registerAnalysisButton = function registerAnalysisButton() {
            if (!document.head.querySelector('#style-loliloli')) {
                document.head.append(document.createRange().createContextualFragment(
                    `<style id="style-loliloli">
                    .btn-anls {
                        pointer-events: all;
                        z-index: 2;
                        margin: 18px -16px 0 0;
                        line-height: 24px;
                        border-radius: 12px;
                        cursor: pointer;
                        background: rgba(33,33,33, .9);
                    }
                </style>`
                ).firstElementChild);
            }

            const hintText = '解析';
            waitElements('.twp-btn.right.vip', elem => {
                if (elem.innerHTML.indexOf(hintText) > 0) return;
                const cloneNode = elem.cloneNode(true);
                cloneNode.innerHTML = '外链' + hintText;
                cloneNode.onclick = redirectToAnalysisServer;
                elem.parentElement.replaceChild(cloneNode, elem);

                if (!LOLILOLI.TOKEN || RegExp('.+video/BV1.+').test(location.href)) {
                    return;
                }

                const buyBtn = document.querySelector('.twp-btn.left.pay');
                if (buyBtn) {
                    const cloneNode2 = buyBtn.cloneNode(true);
                    cloneNode2.innerHTML = '本页' + hintText;
                    cloneNode2.onclick = directParse;
                    buyBtn.parentElement.replaceChild(cloneNode2, buyBtn);
                    return;
                }

                const cloneNode2 = cloneNode.cloneNode(true);
                cloneNode2.innerHTML = '本页' + hintText;
                cloneNode2.onclick = directParse;
                cloneNode.parentElement.insertBefore(cloneNode2, cloneNode);
            });

            waitElements('.bilibili-player-video-top-issue', elem => {
                if (document.querySelector('.btn-anls')) return;
                elem.parentElement.insertBefore(document.createRange().createContextualFragment(
                    `<div class="btn-anls"><span style="margin: 0 2em;">外解</span></div>`
                ).firstElementChild, elem);
                const btn = document.querySelector('.btn-anls');
                btn.addEventListener('click', redirectToAnalysisServer);

                if (!LOLILOLI.TOKEN || RegExp('.+video/BV1.+').test(location.href)) {
                    return;
                }

                const cloneBtn = btn.cloneNode(true);
                cloneBtn.innerHTML = `<span style="margin: 0 2em;">本解</span>`;
                cloneBtn.style.marginRight = '6px';
                cloneBtn.onclick = directParse;
                btn.parentElement.insertBefore(cloneBtn, btn);
            });

            waitElements('button[class*="fullscreen"]', elem => {
                elem.addEventListener('click', () => {
                    const btns = document.querySelectorAll('.btn-anls');
                    if (btns && !window.player.isFullScreen()) btns.forEach(btn => { btn.style.display = 'none' });
                    else btns.forEach(btn => { btn.style.display = 'initial' });
                });
            }, true);

            rightLists.forEach(selector => {
                const el = document.querySelector(selector);
                if (el) el.addEventListener('click', registerAnalysisButton);
            });
        };

        registerAnalysisButton();
    });
})();
