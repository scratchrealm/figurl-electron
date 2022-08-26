import * as http from 'http'
import randomAlphaString from './randomAlphaString'
import { sleepMsec } from './sleepMsec'

type PubsubMessage = {
    channelName: string
    messageId: string
    timestamp: number
    messageBody: string
}

type RequestMessage = {
    type: 'publish'
    channel: string
    messageBody: string
} | {
    type: 'subscribe',
    channel: string
    lastMessageId: string
    timeoutMsec: number
}

type ResponseMessage = {
    type: 'publish'
} | {
    type: 'subscribe'
    messages: PubsubMessage[]
}

class LocalPubsubChannel {
    #messages: PubsubMessage[] = []
    #listeners: {[key: string]: (message: PubsubMessage) => void} = {}
    constructor(private channelName: string) {
    }
    async publish(messageBody: string) {
        const messageId = randomAlphaString(12)
        const msg = {
            channelName: this.channelName,
            messageId,
            timestamp: Date.now(),
            messageBody
        }
        this.#messages.push(msg)
        const listeners = Object.values(this.#listeners)
        for (let listener of listeners) {
            listener(msg)
        }
    }
    async subscribe(lastMessageId: string, timeoutMsec: number): Promise<PubsubMessage[]> {
        let i = this.#messages.length
        while (i - 1 >= 0) {
            const mm = this.#messages[i - 1]
            if (mm.messageId === lastMessageId) {
                break
            }
            const elapsed = Date.now() - mm.timestamp
            if (elapsed > 5000) {
                break // too old
                // todo: remove old messages
            }
            i --
        }
        if (i < this.#messages.length) {
            return this.#messages.slice(i)
        }
        return new Promise<PubsubMessage[]>((resolve, reject) => {
            let done = false
            const listenerId = randomAlphaString(12)
            const listener = (msg: PubsubMessage) => {
                if (done) return
                done = true
                delete this.#listeners[listenerId]
                resolve([msg])
            }
            this.#listeners[listenerId] = listener
            sleepMsec(timeoutMsec).then(() => {
                if (done) return
                done = true
                delete this.#listeners[listenerId]
                resolve([])
            })
        })
    }
}

class LocalPubsubServer {
    #closed = false
    #server: http.Server | undefined = undefined
    #channels: {[name: string]: LocalPubsubChannel} = {}
    constructor(private o: {port: number, callback: (x: any) => void}) {
    }
    async run() {
        const that = this
        const {port} = this.o
        const requestListener: http.RequestListener = function (req, res) {
            if (req.method === 'POST') {
                ;(async () => {
                    const reqMsg: RequestMessage = await readJsonFromReq(req)
                    that.o.callback(reqMsg)
                    if (reqMsg.type === 'publish') {
                        const ch = that._getChannel(reqMsg.channel)
                        await ch.publish(reqMsg.messageBody)
                        const ret: ResponseMessage = {
                            type: 'publish'
                        }
                        sendJsonResponse(res, ret)
                    }
                    else if (reqMsg.type === 'subscribe') {
                        const ch = that._getChannel(reqMsg.channel)
                        const messages = await ch.subscribe(reqMsg.lastMessageId, reqMsg.timeoutMsec)
                        const ret: ResponseMessage = {
                            type: 'subscribe',
                            messages
                        }
                        sendJsonResponse(res, ret)
                    }
                    else {
                        throw Error(`Invalid request type: ${(reqMsg as any).type}`)
                    }
                })()
            }
            else {
                throw Error(`Invalid request method: ${req.method}`)
            }
        }
        await sleepMsec(1000) // wait for previous to close
        if (this.#closed) return
        this.#server = http.createServer(requestListener)
        this.#server.listen(port, 'localhost', () => {
            console.info(`Server is listening on port ${port}`)
        })
        while (!this.#closed) {
            await sleepMsec(200)
        }
    }
    stop() {
        if (this.#server) {
            this.#server.close()
        }
        this.#closed = true
    }
    _getChannel(channelName: string) {
        if (!this.#channels[channelName]) {
            this.#channels[channelName] = new LocalPubsubChannel(channelName)
        }
        return this.#channels[channelName]
    }
}

const readJsonFromReq = (req: http.IncomingMessage) => {
    return new Promise<any>((resolve, reject) => {
        let body = ""
        req.on("data", (chunk) => {
            body += chunk;
        })
        req.on("error", error => {
            reject(error)
        })
        req.on("end", function() {
            let x
            try {
                x = JSON.parse(body)
            }
            catch(err) {
                reject(err)
                return
            }
            resolve(x)
        })
    })
}

const sendJsonResponse = (res: http.ServerResponse, response: any) => {
    const outgoingHeaders: http.OutgoingHttpHeaders = {
        'Content-Type': 'application/json'
    }
    res.writeHead(200, undefined, outgoingHeaders)
    res.end(JSON.stringify(response))
}

export default LocalPubsubServer