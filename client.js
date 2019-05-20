document.write(`
    <input type=radio name=method id=method-xhr checked>xhr</input>
    <input type=radio name=method id=method-fetch>fetch</input>

<!--<input type=checkbox id=log-events checked>log events</input>-->
<!--<input type=checkbox id=web-worker>use web worker</input>-->

    <input type=checkbox id=test-latency checked>test latency</input>
    <input type=checkbox id=test-download checked>test download</input>
    <input type=checkbox id=test-upload checked>test upload</input>

    <button id=start onclick=start()>Start</button>
`)

const rand_buffer = (size=1<<22) => new Uint8Array(size).map(x => 256 * Math.random())
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

    if ($('#test-download').checked)
        result.download_detail = await test_download(type)

    if ($('#test-upload').checked)
        result.upload_detail = await test_upload(type)

    const summary = summarize(result)

    $('body').innerHTML = '<pre id=result>' + JSON.stringify({ summary, ...result }, null, '  ')
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

    const test = type == 'xhr' ? test_xhr : test_fetch
    for (let i = 0; i < 10; i++) // test 10 times
        events.push(await test())
    return events
}

function test_download(type) {
    const events = []
    let finished = false

    const test_xhr = () => {
        if (finished) return

        const event = { start: performance.now() }
        const req = new XMLHttpRequest()
        req.addEventListener('load', () => {
            event.size = req.response.length
            event.end = performance.now()
            events.push(event)
            // setTimeout(test_xhr, 0)
            test_xhr()
        })
        req.addEventListener('error', e => setTimeout(test_xhr, 0))
        req.addEventListener('abort', e => setTimeout(test_xhr, 0))
        req.open('GET', `${server}/download?gid=${gid++}`)
        req.send()
    }

    const test_fetch = async () => {
        if (finished) return

        try {
            const event = { start: performance.now() }
            const res = await fetch(`${server}/download?gid=${gid++}`)
            event.size = (await res.arrayBuffer()).byteLength
            event.end = performance.now()
            events.push(event)
        } catch (e) {
            console.error(e)
        } finally {
            // setTimeout(test_fetch, 0)
            test_fetch()
        }
    }

    for (let i = 0; i < 5; i++) // 5 concurrent connections
        type == 'xhr' ? test_xhr() : test_fetch()

    return new Promise((resolve, reject) => setTimeout(() => {
        finished = true
        const cut = [ ...events ]
        setTimeout(() => resolve(cut), 3000) // wait for last tests to finish
    }, 15000)) // test 15 seconds
}

function test_upload(type) {
    const events = []
    let finished = false
    const buf = rand_buffer()

    const test_xhr = () => {
        if (finished) return

        // const buf = rand_buffer()
        const event = { start: performance.now(), size: buf.byteLength }
        const req = new XMLHttpRequest()

        req.upload.addEventListener('load', () => {
            event.send_finished = performance.now()
        })
        req.addEventListener('load', () => {
            event.end = performance.now()
            events.push(event)
            // setTimeout(test_xhr, 0)
            test_xhr()
        })
        req.addEventListener('error', e => setTimeout(test_xhr, 0))
        req.addEventListener('abort', e => setTimeout(test_xhr, 0))
        req.open('POST', `${server}/upload?gid=${gid++}`)
        req.send(buf)
    }

    const test_fetch = async () => {
        if (finished) return

        try {
            // const buf = rand_buffer()
            const event = { start: performance.now(), size: buf.byteLength }
            await fetch(`${server}/upload?gid=${gid++}`, {
                method: 'POST', mode: 'cors', body: buf
            }).then(x => x.arrayBuffer())
            event.end = performance.now()
            events.push(event)
        } catch (e) {
            console.error(e)
        } finally {
            // setTimeout(test_fetch, 0)
            test_fetch()
        }
    }

    for (let i = 0; i < 5; i++) // 5 concurrent connections
        type == 'xhr' ? test_xhr() : test_fetch()

    return new Promise((resolve, reject) => setTimeout(() => {
        finished = true
        const cut = [ ...events ]
        setTimeout(() => resolve(cut), 3000) // wait for last tests to finish
    }, 15000)) // test 15 seconds
}

function summarize({ latency_detail, download_detail, upload_detail }) {
    const summary = {}

    if (latency_detail) {
        summary.latency = latency_detail.map(({ start, end }) => end - start).sort()[0] / 1000 + 'ms'
    }

    if (download_detail) {
        const makespan = download_detail.map(x => x.end).reduce((x, y) => x > y ? x : y) -
                         download_detail.map(x => x.start).reduce((x, y) => x < y ? x : y)
        const total_size = download_detail.map(x => x.size).reduce((x, y) => x + y)
        summary.download = (total_size * 8 / 1000000) / (makespan / 1000) + 'mbit'
    }

    if (upload_detail) {
        const makespan = upload_detail.map(x => x.end).reduce((x, y) => x > y ? x : y) -
                         upload_detail.map(x => x.start).reduce((x, y) => x < y ? x : y)
        const total_size = upload_detail.map(x => x.size).reduce((x, y) => x + y)
        summary.upload = (total_size * 8 / 1000000) / (makespan / 1000) + 'mbit'
    }

    return summary
}
