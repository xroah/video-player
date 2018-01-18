import dom from "./dom.js";
import {doc, DEFAULT_OPTIONS, ERROR_TYPE, KEY_MAP, isObject, isUndefined} from "./global.js";
import Subscriber from "./subscriber.js";
import Slider from "./slider.js";
import {tpl, controls} from "./template.js";
import VideoControl, {
    VIDEO_CAN_PLAY,
    VIDEO_DBLCLICK,
    VIDEO_ENDED,
    VIDEO_ERROR,
    VIDEO_LOAD_START,
    VIDEO_LOADED_META,
    VIDEO_PROGRESS,
    VIDEO_SEEKING,
    VIDEO_TIME_UPDATE
} from "./video_control.js";

let hideVolumePopTimer = null,
    hideControlsTimer = null;
const HIDE_CLASS = "rplayer-hide";
const DEFAULT_HEIGHT = 500;

function RPlayer(selector, options) {
    let target = dom.selectElement(selector),
        config;
    Subscriber.call(this);
    if (isObject(options)) {
        config = {
            autoPlay: !!options.autoPlay,
            defaultVolume: Math.abs(parseInt(options.defaultVolume)) || DEFAULT_OPTIONS.defaultVolume,
            loop: !!options.loop,
            msg: options.msg || DEFAULT_OPTIONS.msg,
            poster: options.poster || DEFAULT_OPTIONS.poster,
            preload: options.preload || DEFAULT_OPTIONS.preload,
            source: options.source
        };
    } else {
        config = DEFAULT_OPTIONS;
    }
    if (!config.source) {
        new Error("没有设置视频链接");
    }
    if (!target) {
        throw new Error("未选中任何元素");
    }
    this.target = target;
    this.error = false;
    this.controlsDisabled = false;
    this.video = new VideoControl(config);
    this.controls = isUndefined(options.controls) ? true : !!options.controls;
    this.useNativeControls = isUndefined(options.useNativeControls) ? false : options.useNativeControls;
}

let fn = RPlayer.prototype = Object.create(Subscriber.prototype);
fn.constructor = RPlayer;

fn.toggleFullScreen = function () {
    if (this.isFullScreen = !this.isFullScreen) {
        this.requestFullScreen();
    } else {
        this.exitFullScreen();
    }
};

fn.requestFullScreen = function () {
    this.isFullScreen = true;
    dom.fullScreen(this.container)
        .addClass(this.fullScreenBtn, "rplayer-fullscreen")
        .addClass(this.container, "rplayer-fullscreen");
};

fn.exitFullScreen = function () {
    this.isFullScreen = false;
    dom.fullScreen(this.container, true)
        .removeClass(this.fullScreenBtn, "rplayer-fullscreen")
        .removeClass(this.container, "rplayer-fullscreen");
};

fn.initFullScreenEvent = function () {
    let fsApi = dom.fsApi;
    if (fsApi) {
        dom.on(doc, fsApi.fullscreenchange, () => {
            if (!doc[fsApi.fullscreenElement]) {
                this.exitFullScreen();
            }
        }).on(doc, fsApi.fullscreenerror, () => {
            this.exitFullScreen();
        });
    }
    return this;
};

fn.showLoading = function () {
    dom.removeClass(this.loading, HIDE_CLASS);
    return this;
};

fn.hideLoading = function () {
    dom.addClass(this.loading, HIDE_CLASS);
    return this;
};

fn.buffer = function (buffered, readyState) {
    this.bufferedBar && dom.css(this.bufferedBar, "width",  buffered + "%");
    if (readyState < 3) {
        this.showLoading();
    }
};

fn.updateTime = function (time, current) {
    let el = this.totalTime;
    if (current) {
        el = this.currentTime;
    }
    el.innerHTML = this.video.convertTime(time);
    return this;
};

fn.updateMetaInfo = function (meta) {
    if (this.video.isAutoPlay()) {
        this.play();
    }
    this.updateTime(meta.duration)
        .enableControls();
};

fn.playEnd = function () {
    this.trigger("play.end");
    return this.video.isLoop() ? this.play() :
        this.pause();
};

fn.hideError = function () {
    let el = this.errorMsg.parentNode;
    this.controlsDisabled = false;
    dom.addClass(el, HIDE_CLASS);
    return this;
};

fn.handleError = function (error) {
    let el = this.errorMsg.parentNode;
    this.controlsDisabled = true;
    this.errorMsg.innerHTML = error.message;
    this.error = true;
    dom.removeClass(el, HIDE_CLASS);
    this.hideLoading()
        .hideControls();
    return this;
};

fn.refresh = function () {
    this.error = false;
    this.video.reload();
    this.hideError();
};

fn.initPlayEvent = function () {
    this.video
        .on(VIDEO_LOAD_START, () => this.showLoading().disableControls())
        .on(VIDEO_PROGRESS, (evt, buffered, readyState) => this.buffer(buffered, readyState))
        .on(VIDEO_LOADED_META, (evt, meta) => this.updateMetaInfo(meta))
        .on(VIDEO_TIME_UPDATE, (evt, currentTime) => this.updateTime(currentTime, true))
        .on(VIDEO_SEEKING, this.showLoading.bind(this))
        .on(VIDEO_CAN_PLAY, this.hideLoading.bind(this))
        .on(VIDEO_DBLCLICK, this.toggleFullScreen.bind(this))
        .on(VIDEO_ENDED, this.playEnd.bind(this))
        .on(VIDEO_ERROR, (evt, error) => this.handleError(error));
    return this;
};

fn.toggleVolumePopupInfo = function (volume) {
    //当音量设置面板隐藏是才显示当前音量
    if (dom.hasClass(this.volumePopup, HIDE_CLASS)) {
        clearTimeout(hideVolumePopTimer);
        this.volumePopupInfo.innerHTML = "当前音量: " + volume;
        this.currentVolume.innerHTML = volume;
        dom.removeClass(this.volumePopupInfo, HIDE_CLASS);
        hideVolumePopTimer = setTimeout(() => dom.addClass(this.volumePopupInfo, HIDE_CLASS), 3000);
    }
    return this;
};

fn.keyDown = function (evt) {
    //控制条被禁用，不做处理
    if (this.controlsDisabled) return;
    let key = evt.key.toLowerCase(),
        regUpOrDown = /(?:up)|(?:down)/,
        regLeftOrRight = /(?:left)|(?:right)/,
        regEsc = /esc/,
        regSpace = /\s|(?:spacebar)/,
        tmp = KEY_MAP[key];
    if (tmp) {
        if (regLeftOrRight.test(key)) {
            this.updateProgressByStep(tmp);
        } else if (regUpOrDown.test(key)) {
            this.updateVolumeByStep(tmp);
        } else if (regEsc.test(key)) {
            this.exitFullScreen();
        } else if (regSpace.test(key)) {
            this.togglePlay();
        }else {
            this.toggleFullScreen();
        }
    }
    evt.preventDefault();
};

fn.handleClick = function (evt) {
    let tgt = evt.target;
    switch (tgt) {
        case this.showVolumePopBtn:
            this.toggleVolumeSettingsPanel(evt);
            break;
        case this.muteBtn:
            this.mute();
            break;
        case this.playBtn:
        case this.video.el:
            this.togglePlay();
            break;
        case this.fullScreenBtn:
            this.toggleFullScreen();
            break;
        case this.errorMsg:
            this.refresh();
            break;
    }
};

fn.initEvent = function () {
    dom.on(this.container, "click", this.handleClick.bind(this));
    this.initPlayEvent();
    return this;
};

fn.updateProgress = function () {
    //在拖动滑块改变播放进度时候不改变播放进度条位置，只改变播放的当前时间
    //防止影响滑块以及进度条的位置
    let progress = this.video.getPlayedPercentage();
    if (!this.videoSlider.moving) {
        this.videoSlider.updateHPosition(progress, true);
    }
    this.updateTime(true);
};

fn.updateVolume = function (volume, scale) {
    scale && (volume *= 100);
    volume = Math.floor(volume);
    this.video.setVolume(volume);
    this.updateVolumeStyle(volume);
    return this;
};

fn.mute = function () {
    let volume = this.video.getVolume();
    //点击静音键
    if (this.video.isMuted()) {
        this.video.mute(false);
    } else {
        this.video.mute(true);
        volume = 0;
    }
    this.updateVolumeStyle(volume);
};

fn.updateVolumeByStep = function (step) {
    let volume = this.video.getVolume();
    volume += step;
    volume = volume > 100 ? 100 : volume < 0 ? 0 : volume;
    this.updateVolume(volume);
    this.toggleVolumePopupInfo(volume);
};

fn.updateVolumeStyle = function (volume) {
    let cls = this.showVolumePopBtn.className,
        reg = /volume-[^\s]*/;
    cls = cls.replace(reg, "");
    if (!volume) {
        cls += "volume-mute";
    } else if (volume <= 33) {
        cls += "volume-1";
    } else if (volume <= 66) {
        cls += "volume-2";
    } else {
        cls += "volume-3";
    }
    this.showVolumePopBtn.className = this.muteBtn.className = cls;
    this.currentVolume.innerHTML = volume;
    this.volumeSlider.updateVPosition(volume + "%");
    return this;
};

//点击显示/隐藏设置音量面板
fn.toggleVolumeSettingsPanel = function (evt) {
    if (!this.controlsDisabled) {
        dom.toggleClass(this.volumePopup, HIDE_CLASS);
    }
    //阻止冒泡到document, document点击事件点击面板外任意地方隐藏面板，如不阻止冒泡则显示不出来
    evt.stopPropagation();
};

fn.hideVolumeSettingsPanel = function () {
    dom.addClass(this.volumePopup, HIDE_CLASS);
    return this;
};

fn.initVolumeEvent = function () {
    dom.on(this.volumePopup, "mouseleave", this.hideVolumeSettingsPanel.bind(this))
        .on(doc, "click", evt => {
            let tgt = evt.target;
            //点击页面其他地方（点击的不是音量设置面板或者面板内的元素）则隐藏音量面板
            if (tgt !== this.volumePopup && !this.volumePopup.contains(tgt)) {
                this.hideVolumeSettingsPanel();
            }
        });
    return this;
};


fn.togglePlay = function () {
    if (!this.controlsDisabled) {
        this.video.isPaused() ? this.play(): this.pause();
    }
};

fn.play = function () {
    dom.addClass(this.playBtn, "paused");
    this.video.play(true);
    return this;
};

fn.pause = function () {
    this.video.play(false);
    dom.removeClass(this.playBtn, "paused");
    return this;
};

//鼠标在进度条上移动显示时间信息
fn.showPopupTimeInfo = function (evt) {
    let duration = this.video.getDuration(),
        popup = this.videoPopupTime,
        mark = this.mark;
    if (duration) {
        dom.removeClass(popup, HIDE_CLASS)
            .removeClass(mark, HIDE_CLASS);
        let rect = this.progressPanel.getBoundingClientRect(),
            distance = evt.clientX - rect.left,
            width = popup.offsetWidth,
            left = distance - width / 2;
        width = rect.width - width;
        left = left < 0 ? 0 : left > width ? width : left;
        width = distance / rect.width;
        popup.innerHTML = this.video.convertTime(width * duration);
        dom.css(popup, "left", left + "px");
        dom.css(mark, "left", width * 100 + "%");
    }
    return this;
};

fn.hidePopupTimeInfo = function () {
    dom.addClass(this.videoPopupTime, HIDE_CLASS)
        .addClass(this.mark, HIDE_CLASS);
    return this;
};

fn.updateProgressByStep = function (step) {
    let currentTime = this.video.getCurrentTime(),
        duration = this.video.getDuration();
    currentTime += step;
    currentTime = currentTime < 0 ? 0 : currentTime > duration ? duration : currentTime;
    this.video.setCurrentTime(currentTime);
    this.updateProgress();
};

fn.hideControls = function () {
    dom.addClass(this.controlsPanel, HIDE_CLASS);
    return this;
};

fn.showControls = function () {
    //出错了则不显示控制条
    if (!this.error) {
        clearTimeout(hideControlsTimer);
        dom.removeClass(this.controlsPanel, HIDE_CLASS);
        if (dom.hasClass(this.volumePopup, HIDE_CLASS)) {
            hideControlsTimer = setTimeout(() => this.hideControls(), 5000);
        }
    }
    return this;
};

fn.enableControls = function () {
    dom.removeClass(this.controlsPanel, "rplayer-disabled");
    this.controlsDisabled = false;
    return this;
};

fn.disableControls = function () {
    dom.addClass(this.controlsPanel, "rplayer-disabled");
    this.controlsDisabled = true;
    return this;
};

fn.initControlEvent = function () {
    let videoEl = this.video.el;
    //滑动改变进度/点击进度条改变进度
    this.videoSlider.on("slider.move.done", (evt, distance) => {
        this.video.setCurrentTime(distance, true);
        this.updateTime(true);
    });
    this.volumeSlider.on("slider.moving",  (evt, distance) => {
       this.updateVolume(distance, true);
    });
    dom.on(this.progressPanel, "mouseover mousemove", this.showPopupTimeInfo.bind(this))
        .on(this.progressPanel, "mouseout", this.hidePopupTimeInfo.bind(this))
        .on(this.container, "keydown", this.keyDown.bind(this))
        .on(this.container, "mousemove", this.showControls.bind(this));
    return this.initVolumeEvent()
        .initFullScreenEvent();
};

fn.offEvent = function () {
    dom.off(doc)
        .off(this.volumePopup)
        .off(this.container)
        .off(this.video.el);
    return this;
};

fn.removeProp = function () {
    for (let key in this) {
        delete this[key];
    }
    return this;
};

fn.destroy = function () {
    if (this.container) {
        this.videoSlider.destroy();
        this.volumeSlider.destroy();
        this.offEvent()
            .removeProp();
    }
    return this;
};

fn.initEssentialElements = function () {
    let context = this.container;
    this.loading = dom.selectElement(".rplayer-loading", context);
    this.errorMsg = dom.selectElement(".rplayer-msg", context);
    return this;
};

fn.initElements = function () {
    let context = this.container;
    this.playBtn = dom.selectElement(".rplayer-play-btn", context);
    this.progressPanel = dom.selectElement(".rplayer-progress-panel", context);
    this.videoPopupTime = dom.selectElement(".rplayer-popup-video-info", context);
    this.currentTime = dom.selectElement(".rplayer-current-time", context);
    this.totalTime = dom.selectElement(".rplayer-total-time", context);
    this.bufferedBar = dom.selectElement(".rplayer-bufferd-bar", context);
    this.showVolumePopBtn = dom.selectElement(".rplayer-audio-btn", context);
    this.muteBtn = dom.selectElement(".rplayer-mute", context);
    this.volumePopup = dom.selectElement(".rplayer-volume-popup", context);
    this.volumePopupInfo = dom.selectElement(".rplayer-popup-volume-info", context);
    this.currentVolume = dom.selectElement(".rplayer-current-volume", context);
    this.fullScreenBtn = dom.selectElement(".rplayer-fullscreen-btn", context);
    this.mark = dom.selectElement(".rplayer-mark", context);
    this.volumeSlider = new Slider(true);
    this.videoSlider = new Slider();
    this.videoSlider.init(this.progressPanel);
    this.volumeSlider.init(this.volumePopup, this.muteBtn);
    return this;
};

fn.getSource = function () {
    return this.video.getSource();
};

fn.initControls = function () {
    this.controlsPanel = dom.createElement("div");
    dom.addClass(this.controlsPanel, "rplayer-controls");
    this.controlsPanel.innerHTML = controls;
    this.container.appendChild(this.controlsPanel);
    return this.initElements()
        .updateVolumeStyle(this.video.getVolume())
        .initControlEvent();
};

fn.initialize = function () {
    if (!this.container) { //防止重复初始化
        let container = dom.createElement("div", {
                tabIndex: 100 //使元素能够获取焦点
            }),
            height = parseInt(getComputedStyle(this.target).height);
        this.isFullScreen = false;
        container.innerHTML = tpl;
        dom.css(container, "height", (height || DEFAULT_HEIGHT) + "px");
        this.container = container;
        container.appendChild(this.video.init());
        dom.addClass(this.container, "rplayer-container");
        //播放控制与原生控制二选一，如果设置了useNativeControls为true，则优先使用原生控制
        if (this.controls && !this.useNativeControls) {
            this.initControls();
        } else if (this.useNativeControls) {
            this.video.showControls();
        }
        this.target.appendChild(this.container);
        this.initEssentialElements()
            .initEvent();
    }
    return this;
};

fn.updateSource = function (src) {
    this.video.changeSource(src);
};

RPlayer.init = function (selector, options) {
    return new RPlayer(selector, options).initialize();
};

export default RPlayer;