import { contextBridge } from "electron"
import { FigurlRequest, FigurlResponse, InitiateTaskResponse } from "./viewInterface/FigurlRequestTypes"
import * as fs from 'fs'
import * as process from 'process'
import LocalPubsubServer from "./LocalPubsubServer"
import { PubsubMessage } from "./PubsubMessage"
import { sha1OfObject, sha1OfString } from "./viewInterface/kacheryTypes"
import randomAlphaString from "./randomAlphaString"
import axios from 'axios'
import { sleepMsec } from "./sleepMsec"

const kacheryCloudDir = process.env['KACHERY_CLOUD_DIR'] || `${process.env['HOME']}/.kachery-cloud`

console.info(`KACHERY_CLOUD_DIR: ${kacheryCloudDir}`)

async function loadFileData(uri: string) {
    const a = uri.split('?')[0].split('/')
    const alg = a[0].split(':')[0]
    const hash = a[2]
    if (alg !== 'sha1') throw Error(`Invalid alg for getFileData: ${alg}`)
    const s = hash
    const figureFname = `${kacheryCloudDir}/sha1/${s[0]}${s[1]}/${s[2]}${s[3]}/${s[4]}${s[5]}/${s}`
    const txt = await fs.promises.readFile(figureFname, 'utf-8')
    const data = JSON.parse(txt)
    // don't deserialize here because Buffer behaves differently in electron
    return data
}

const taskStatusUpdateCallbacks: ((a: {taskName: string, taskJobId: string, status: string, errorMessage?: string}) => void)[] = []

const pubsubListen = async () => {
    let lastMessageId = ''
    while (true) {
        const a = {
            type: 'subscribe',
            channel: 'provideTasks',
            lastMessageId,
            timeoutMsec: 15000
        }
        const x = await axios.post(`http://localhost:4000`, a)
        const resp = x.data
        if (resp.type !== 'subscribe') throw Error('Problem subscribing to pubsub')
        for (let m of resp.messages) {
            lastMessageId = m.messageId
            const messageBody: string = m.messageBody
            const msg: PubsubMessage = JSON.parse(messageBody)
            if (msg.type === 'setTaskStatus') {
                for (let cb of taskStatusUpdateCallbacks) {
                    cb({taskName: msg.taskName, taskJobId: msg.taskJobId.toString(), status: msg.status, errorMessage: msg.errorMessage})
                }
            }
        }
        await sleepMsec(100)
    }
}
pubsubListen()

contextBridge.exposeInMainWorld('electronInterface', {
    handleFigurlRequest: async (req: FigurlRequest, o: {dataUri: string}): Promise<FigurlResponse | undefined> => {
        if (req.type === 'getFigureData') {
            const figureData = await loadFileData(o.dataUri)
            return {
                type: 'getFigureData',
                figureData
            }
        }
        else if (req.type === 'getFileData') {
            const uri = req.uri
            const fileData = await loadFileData(uri)
            return {
                type: 'getFileData',
                fileData
            }
        }
        else if (req.type === 'initiateTask') {
            const {taskInput, taskName, taskType} = req
            const taskJobId = taskType === 'calculation' ? (
                sha1OfObject({taskName, taskInput})
            ) : (
                sha1OfString(randomAlphaString(100))
            )
            const pubsubMsg: PubsubMessage = {
                type: 'requestTask',
                taskType,
                taskName,
                taskInput,
                taskJobId
            }
            const a = {
                type: 'publish',
                channel: 'requestTasks',
                messageBody: JSON.stringify(pubsubMsg)
            }
            await axios.post(`http://localhost:4004`, a)
            const ret: InitiateTaskResponse = {
                type: 'initiateTask',
                taskJobId: taskJobId.toString(),
                status: 'waiting'
            }
            return ret
        }
    },
    onTaskStatusUpdate: (callback: (a: {taskName: string, taskJobId: string, status: string, errorMessage?: string}) => void) => {
        taskStatusUpdateCallbacks.push(callback)
    },
    createLocalPubsubServer: (port: number, callback: (x: any) => void) => {
        const X = new LocalPubsubServer({port, callback})
        return {
            run: () => {return X.run()},
            stop: () => {X.stop()}
        }
    }
})