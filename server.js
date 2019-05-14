#!/bin/env node

const fs = require('fs')
const crypto = require('crypto')
const koa = require('koa')
const app = new koa()

const page = `
<script>${fs.readFileSync('client.js')}</script>
`

app.use(async ctx => {
    switch (ctx.path) {
        case '/':
            return ctx.body = page
        case '/upload': return new Promise((resolve, reject) => {
            ctx.request.on('end', () => {
                resolve(ctx.status = 200)
            })
        })
        case '/download': return new Promise((resolve, reject) => {
            crypto.randomBytes(2000, (err, buf) => {
                resolve(ctx.body = buf)
            })
        })
        default:
            ctx.status = 404
    }
})

app.listen(3905)