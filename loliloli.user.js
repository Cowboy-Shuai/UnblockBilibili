// ==UserScript==
// @name                哔哩哔哩解析辅助
// @namespace           https://github.com/vcheckzen/UnblockBilibili/blob/master/loliloli.user.js
// @version             0.0.6.6
// @icon                https://www.bilibili.com/favicon.ico
// @description         为哔哩哔哩视频注入一键解析按钮
// @author              https://github.com/vcheckzen
// @supportURL          https://github.com/vcheckzen/UnblockBilibili/issues
// @contributionURL     https://github.com/vcheckzen/UnblockBilibili
// @include             *2333.com*
// @include             *bilibili.com/video/bv1*
// @include             *bilibili.com/bangumi/play*
// @run-at              document-end
// ==/UserScript==

(() => {
    'use strict';

    const LOLILOLI_PORT = 2333;

    if (location.host === `2333.com:${LOLILOLI_PORT}` && box) {
        const sp = new URLSearchParams(location.search);
        const from = sp.get('from'), p = sp.get('p');
        if (from && /.+(BV1|ep)\w+/.test(from) && localStorage.getItem('token')) {
            box.originalUrl = from + (p ? '?p=' + p : '');
        }
        return;
    }

    const waiterPoor = [];
    const rightLists = ['.r-con', '.plp-r'];

    const payVideo = function () {
        if (/.+(ep|ss)\d+.+/.test(location.href)
            && __INITIAL_STATE__.mediaInfo.payMent.vipDiscount !== 1) {
            return true;
        }
        return false;
    };


    const redirectToAnalysisServer = function () {
        const bilibiliHost = 'https://www.bilibili.com/'
        let analysisServer = `http://2333.com:${LOLILOLI_PORT}/?from=`;
        if (/.+ep\d+.+/.test(location.href)) {
            analysisServer += location.href.split('?')[0];
        } else if (/.+ss\d+.+/.test(location.href)) {
            const id = __INITIAL_STATE__.epInfo.id;
            analysisServer += bilibiliHost + 'bangumi/play/ep' + id;
        } else if (/.+BV1\w+.+/.test(location.href)) {
            const p = new URLSearchParams(location.search).get('p');
            const bvid = __INITIAL_STATE__.videoData.bvid;
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
            const cloneNode = elem.cloneNode(true);
            cloneNode.innerHTML = '一键' + hintText;
            cloneNode.onclick = redirectToAnalysisServer;
            elem.parentElement.replaceChild(cloneNode, elem);
        });

        waitElements('.bilibili-player-video-top-issue', elem => {
            if (document.querySelector('.btn-anls')) return;
            elem.parentElement.insertBefore(document.createRange().createContextualFragment(
                `<div class="btn-anls"><span style="margin: 0 2em;">${hintText}</span></div>`
            ).firstElementChild, elem);
            document.querySelector('.btn-anls').addEventListener('click', redirectToAnalysisServer);
        });

        waitElements('button[class*="fullscreen"]', elem => {
            elem.addEventListener('click', () => {
                const btn = document.querySelector('.btn-anls');
                if (btn && !player.isFullScreen()) btn.style.display = 'none';
                else btn.style.display = 'initial';
            });
        }, true);

        rightLists.forEach(selector => {
            const el = document.querySelector(selector);
            if (el) el.addEventListener('click', registerAnalysisButton);
        });
    };

    registerAnalysisButton();
})();
