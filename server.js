#!/bin/env node

const fs = require('fs')
const http = require('http')
const { performance } = require('perf_hooks')
const crypto = require('crypto')
const koa = require('koa')
const app = new koa()

const page = `<script>${fs.readFileSync('client.js')}</script>`

app.use(async ctx => {
    switch (ctx.path) {
        case '/':
            return ctx.body = page
        case '/upload': return new Promise((resolve, reject) => {
            ctx.request.on('end', () => {
                resolve(ctx.status = 200)
            })
            ctx.request.resume()
        })
        case '/download': return new Promise((resolve, reject) => {
            crypto.randomBytes(1 << 20, (err, buf) => {
                resolve(ctx.body = buf)
            })
        })
        case '/time': return ctx.body = '' + performance.now()
        default:
            ctx.status = 404
    }
})

http.createServer(app.callback()).listen(3905)
http.createServer(app.callback()).listen(3906)