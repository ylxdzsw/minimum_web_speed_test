document.write(`
    <input type="radio" name="method" id="method-xhr" checked>xhr</input>
    <input type="radio" name="method" id="method-fetch">fetch</input>

    <input type="checkbox" id="log-events" checked>log events</input>
<!--<input type="checkbox" id="web-worker">use web worker</input>-->

    <input type="checkbox" id="test-latency" checked>test latency</input>
    <input type="checkbox" id="test-download" checked>test download</input>
    <input type="checkbox" id="test-upload" checked>test upload</input>

    <button id="start" onclick="start()">Start</button>
`)

const server = '//' + location.host.split(':')[0] + ':' + (parseInt(location.host.split(':')[1]) + 1)
let gid = 0 // global unique id

async function start() {
    const $ = document.querySelector.bind(document)
    $('#start').innerHTML = 'testing...'
    $('#start').setAttribute('disabled', true)

    const result = {}
    const type = $('#method-xhr').checked ? 'xhr' : 'fetch'

    if ($('#test-latency').checked)
        result.latency_detail = await test_latency(type)

    $('#start').remove()
    $('body').innerHTML += '<pre id="result">' + JSON.stringify(result, null, '  ')
}

// It may establish new TCP connections, and there may be packet losses, so we use the minimum latecny observed
async function test_latency(type) {
    const events = []
    const test_xhr = () => new Promise((resolve, reject) => {
        const event = { start: performance.now() }
        const req = new XMLHttpRequest()
        req.addEventListener('load', () => {
            event.server = parseFloat(req.responseText)
            event.end = performance.now()
            resolve(event)
        })
        req.addEventListener('error', reject)
        req.addEventListener('abort', reject)
        req.open('GET', `${server}/time?gid=${gid++}`)
        req.send()
    })
    const test_fetch = async () => {
        const event = { start: performance.now() }
        const res = await fetch(`${server}/time?gid=${gid++}`)
        event.server = parseFloat(await res.text())
        event.end = performance.now()
        return event
    }

    for (let i = 0; i < 10; i++) // test 10 times
        events.push(await type == 'xhr' ? test_xhr() : test_fetch())
    return events
}

function test_download(type) {
    const events = []
    let finished = false

    const test_xhr = () => {
        if (finished) return

        const event = { start: performance.now() }
        const req = new XMLHttpRequest()
        req.upload.addEventListener('load', () => {
            event.send_finished = performance.now()
        })
        req.addEventListener('load', () => {
            event.size = req.response.length
            event.end = performance.now()
            events.push(event)
            setTimeout(test_xhr, 0)
        })
        req.addEventListener('error', e => setTimeout(test_xhr, 0))
        req.addEventListener('abort', e => setTimeout(test_xhr, 0))
        req.open('GET', `/${server}download?gid=${gid++}`)
        req.send()
    }

    for (let i = 0; i < 5; i++) // 5 concurrent connections
        test_xhr()

    return new Promise((resolve, reject) => setTimeout(() => {
        finished = true
        resolve(events)
    }, 15000)) // test 15 seconds
}

function test_upload(type) {

}
