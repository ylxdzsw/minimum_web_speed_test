#!/bin/env node

const fs = require('fs')
const http = require('http')
const { performance } = require('perf_hooks')
const koa = require('koa')
const app = new koa()

const page = `<script>${fs.readFileSync('client.js')}</script>`

const rand_buffer = (size=1<<22) => Buffer.allocUnsafe(size).map(x => 256 * Math.random())
const buf = rand_buffer()

app.use(async (ctx, next) => {
    const ACAO = "Access-Control-Allow-Origin"
    const ACRH = "Access-Control-Request-Headers"
    const ACAH = "Access-Control-Allow-Headers"
    const ACRM = "Access-Control-Request-Method"
    const ACAM = "Access-Control-Allow-Methods"

    ctx.set(ACAO, '*')
    if (ctx.get(ACRH)) ctx.set(ACAH, ctx.get(ACRH))
    if (ctx.get(ACRM)) ctx.set(ACAM, ctx.get(ACRM))

    if (ctx.method == 'OPTION') return ctx.status = 200
    return next()
})

app.use(async ctx => {
    switch (ctx.path) {
        case '/': return ctx.body = page
        case '/upload': return new Promise((resolve, reject) => {
            ctx.request.req.on('end', () => resolve(ctx.status = 200))
            ctx.request.req.resume()
        })
        case '/download': return ctx.body = buf //rand_buffer()
        case '/time': return ctx.body = '' + performance.now()
        default: ctx.status = 404
    }
})

http.createServer(app.callback()).listen(3905)
http.createServer(app.callback()).listen(3906)