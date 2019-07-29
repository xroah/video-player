import RPlayer from "../src/ts"

let rp = new RPlayer({
    container: "#player",
    url: "http://localhost:8000/videos/test.mp4",
    
    contextmenu: [
        {
            text(rp: RPlayer) {
                return rp.video.isPaused() ? "play" : "pause"
            },
            action(rp: RPlayer) {
                rp.togglePlay()
            }
        },
        {
            text: "copy video url",
            action(rp: RPlayer) {
                navigator.clipboard
                    .writeText(rp.video.getCurrentSrc())
                    .then(() => alert("success"))
                    .catch(() => alert("error"))
            }
        },
        {
            text: "about",
            action(rp: RPlayer) {
                setTimeout(() => alert("r-player"))
                console.log(rp)
            }
        }
    ]
})

rp.on("loadedmetadata", () => {
    // rp.video.play()
    rp.control.showControlBar()
})