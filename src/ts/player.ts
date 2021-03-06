import EventEmitter from "./event";
import LoadState, {ErrorMessage} from "./modules/load-state";
import Video from "./modules/video";
import Contextmenu, {ContextmenuItem} from "./modules/contextmenu"
import {addListener, removeAllListeners} from "./dom-event"
import Control from "./modules/control"
import {
    isPlainObject,
    preventAndStop,
    createEl,
    getContainer
} from "./utils"
import {CONTROL_BAR_HIDE_TIMEOUT, videoEvents} from "./constants"

interface RPlayerOptions {
    container: string | HTMLElement | Node
    // autoPlay?: boolean
    url: string
    errorMessage?: ErrorMessage
    defaultVolume?: number
    contextmenu?: ContextmenuItem[]
    poster?: string
    playOnClick?: boolean
    controlBarTimeout?: number
    addons?: Array<Function | Addon>
}

interface Addon {
    options?: any
    install: Function
}

export default class RPlayer extends EventEmitter {
    root: HTMLElement
    body: HTMLElement

    video: Video
    control: Control

    private _loadState: LoadState
    private _options: RPlayerOptions
    private _contextmenu: Contextmenu | null = null
    private _container: HTMLElement
    private _addons:Function[] = []

    constructor(options: RPlayerOptions) {
        super()

        if (!isPlainObject(options)) {
            throw new Error("Options must be an object")
        }

        const container = getContainer(options.container)

        if (!container) {
            throw new Error("Can not find a container")
        }

        const el = createEl("div", "rplayer-root")
        const body = createEl("div", "rplayer-body")
        const controlBarTimeout = options.controlBarTimeout || CONTROL_BAR_HIDE_TIMEOUT

        this._loadState = new LoadState(body, options.errorMessage || {})
        this._options = options

        this.video = new Video(
            body,
            {
                url: options.url,
                poster: options.poster,
                defaultVolume: options.defaultVolume
            }
        )
        this.root = el
        this.body = body
        this.control = new Control(this, controlBarTimeout)
        this._container = container as HTMLElement

        this.init()
    }

    private init() {
        this.root.tabIndex = -1

        this.initContextmenu()
        this.initAddons()
        this.initEvents()

        this.emit("beforemount")

        this.root.appendChild(this.body)
        this._container.appendChild(this.root)
        this.control.showControlBar()

        this.emit("mounted")
    }

    private initAddons() {
        const {addons} = this._options

        if (addons && addons.length) {
            addons.forEach(a => {
                if (!a) {
                    return
                }

                if (typeof a === "function") {
                    a(this)
                } else if (a.install) {
                    a.install(this,a.options || {})
                }
            })
        }
    }

    getAddonContainers() {
        const {
            leftAddonContainer: left,
            rightAddonContainer: right
        } = this.control.bar

        return {left, right}
    }

    private initContextmenu() {
        const ctxMenu = this._options.contextmenu

        if (!ctxMenu || !ctxMenu.length) {
            return
        }

        this._contextmenu = new Contextmenu(this.root, this, ctxMenu)

        addListener(this.root, "contextmenu", this.handleContextMenu)
    }

    private handleContextMenu = (evt: MouseEvent) => {
        const {_contextmenu: ctxMenu} = this

        if (ctxMenu) {
            ctxMenu.setVisible(!ctxMenu.isVisible(), evt.clientX, evt.clientY)
        }

        preventAndStop(evt)
        this.emit(evt.type)
    }

    private initEvents() {
        const videoEl = this.video.el
        const _addListener = (n: string) => addListener(videoEl, n, this.handleVideoEvents)

        if (this._options.playOnClick !== false) {
            addListener(this.body, "click", this.handleClickBody)
        }

        videoEvents.forEach(_addListener)
    }

    handleClickBody = () => {
        this.togglePlay()
    }

    togglePlay() {
        const {video} = this

        if (video.isError()) {
            return
        }

        if (video.isPaused()) {
            video.play()
        } else {
            video.pause()
        }
    }

    private handleVideoEvents = (evt: Event) => {
        const type = evt.type
        const {video, _loadState} = this

        switch (type) {
            case "loadstart":
                _loadState.setVisible(true)
                break
            case "waiting":
                _loadState.setVisible(true)
                break
            case "canplay":
                _loadState.setVisible(false)
                break
            case "error":
                _loadState.setVisible(true, "error", video.el.error)
                break
            case "progress":
                this.control.handleBuffer()
        }

        this.emit(type)
    }

    destroy() {
        this.emit("destroy")
        this.control.destroy()
        this.root.parentNode?.removeChild(this.root)
        this._contextmenu?.destroy()
        removeAllListeners(this.video.el)
        removeAllListeners(this.root)
        removeAllListeners(this.body)
        this.off()
    }
}