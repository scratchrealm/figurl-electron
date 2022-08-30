import { contextBridge } from "electron"
import { FigurlRequest, FigurlResponse, InitiateTaskResponse } from "./viewInterface/FigurlRequestTypes"
import * as fs from 'fs'
import * as process from 'process'
import LocalPubsubServer from "./LocalPubsubServer"
import { PubsubMessage, TaskType } from "./PubsubMessage"
import { sha1OfObject, sha1OfString } from "./viewInterface/kacheryTypes"
import randomAlphaString from "./randomAlphaString"
import axios from 'axios'
import { sleepMsec } from "./sleepMsec"
import { TaskJobStatus } from "./viewInterface/MessageToChildTypes"
import QueryParameters from "./QueryParameters"

const kacheryCloudDir = process.env['KACHERY_CLOUD_DIR'] || `${process.env['HOME']}/.kachery-cloud`

console.info(`KACHERY_CLOUD_DIR: ${kacheryCloudDir}`)

async function loadFileData(uri: string) {
    const a = uri.split('?')[0].split('/')
    const alg = a[0].split(':')[0]
    const hash = a[2]
    if (alg !== 'sha1') throw Error(`Invalid alg for getFileData: ${alg}`)
    const s = hash
    const filename = `${kacheryCloudDir}/sha1/${s[0]}${s[1]}/${s[2]}${s[3]}/${s[4]}${s[5]}/${s}`
    const txt = await fs.promises.readFile(filename, 'utf-8')
    const data = JSON.parse(txt)
    // don't deserialize here because Buffer behaves differently in electron
    return data
}

async function loadTaskResultData(taskName: string, taskJobId: string) {
    const s = taskJobId
    const filename = `${kacheryCloudDir}/task_results/${taskName}/${s[0]}${s[1]}/${s[2]}${s[3]}/${s[4]}${s[5]}/${s}`
    if (!fs.existsSync(filename)) return undefined
    const txt = await fs.promises.readFile(filename, 'utf-8')
    const data = JSON.parse(txt)
    // don't deserialize here because Buffer behaves differently in electron
    return data
}

const taskStatusUpdateCallbacks: ((a: {taskType: TaskType, taskName: string, taskJobId: string, status: TaskJobStatus, errorMessage?: string}) => void)[] = []

const taskTypesForJobId: {[jobId: string]: TaskType} = {}

let pubsubSubscribing = false
const startPubsubSubscribing = async (port: number) => {
    if (pubsubSubscribing) return
    pubsubSubscribing = true
    let lastMessageId = ''
    while (true) {
        const a = {
            type: 'subscribe',
            channel: `provideTasks`,
            lastMessageId,
            timeoutMsec: 15000
        }
        let resp
        try {
            const x = await axios.post(`http://localhost:${port}`, a)
            resp = x.data
            if (resp.type !== 'subscribe') throw Error('Problem subscribing to pubsub')
        }
        catch(err) {
            console.warn(err)
            console.warn('Problem subscribing to pubsub')
            pubsubSubscribing = false
            return
        }
        for (let m of resp.messages) {
            lastMessageId = m.messageId
            const messageBody: string = m.messageBody
            const msg: PubsubMessage = JSON.parse(messageBody)
            if (msg.type === 'setTaskStatus') {
                for (let cb of taskStatusUpdateCallbacks) {
                    cb({taskType: taskTypesForJobId[msg.taskJobId.toString()] || 'calculation', taskName: msg.taskName, taskJobId: msg.taskJobId.toString(), status: msg.status, errorMessage: msg.errorMessage})
                }
            }
        }
        if (resp.messages.length === 0) {
            await sleepMsec(100)
        }
    }
}

const getTaskReturnValue = async (a: {taskName: string, taskJobId: string}): Promise<any | undefined> => {
    const {taskName, taskJobId} = a
    // don't deserialize here
    return loadTaskResultData(taskName, taskJobId)
}

let queryParameters: QueryParameters | undefined = undefined

let localPubsubServer: LocalPubsubServer | undefined = undefined

contextBridge.exposeInMainWorld('electronInterface', {
    setQueryParameters: async (q: QueryParameters) => {
        queryParameters = q
        if (queryParameters.listenPort) {
            if (localPubsubServer) {
                // already listening
                if (localPubsubServer.port() !== queryParameters.listenPort) {
                    throw Error('Unexpected port mismatch in local pubsub server')
                }
                return
            }
            const callback = (event: any) => {
                console.info('pubsub server event', event)
            }
            localPubsubServer = new LocalPubsubServer({port: queryParameters.listenPort, callback})
            await localPubsubServer.run()
        }
    },
    handleFigurlRequest: async (req: FigurlRequest): Promise<FigurlResponse | undefined> => {
        if (!queryParameters) throw Error('Query parameters are not set in preload.ts')
        if (req.type === 'getFigureData') {
            if (!queryParameters.dataUri) throw Error('dataUri is not set in preload.ts')
            const figureData = await loadFileData(queryParameters.dataUri)
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
            if (!queryParameters.listenPort) throw Error('No listenPort for initiateTask')
            const {taskInput, taskName, taskType} = req
            const taskJobId = taskType === 'calculation' ? (
                sha1OfObject({taskName, taskInput})
            ) : (
                sha1OfString(randomAlphaString(100))
            )
            taskTypesForJobId[taskJobId.toString()] = taskType

            if (taskType === 'calculation') {
                // see if already finished
                const returnValue = await getTaskReturnValue({taskName, taskJobId: taskJobId.toString()})
                if (returnValue !== undefined) {
                    // already finished, no pubsub needed
                    return {
                        type: 'initiateTask',
                        taskJobId: taskJobId.toString(),
                        status: 'finished',
                        returnValue
                    }
                }
            }

            // only start subscribing if we have tasks involved
            startPubsubSubscribing(queryParameters.listenPort)

            const pubsubMsg: PubsubMessage = {
                type: 'requestTask',
                taskType,
                taskName,
                taskInput,
                taskJobId
            }
            const a = {
                type: 'publish',
                channel: `requestTasks`,
                messageBody: JSON.stringify(pubsubMsg)
            }
            await axios.post(`http://localhost:${queryParameters.listenPort}`, a)
            const ret: InitiateTaskResponse = {
                type: 'initiateTask',
                taskJobId: taskJobId.toString(),
                status: 'waiting'
            }
            return ret
        }
    },
    onTaskStatusUpdate: (callback: (a: {taskType: TaskType, taskName: string, taskJobId: string, status: TaskJobStatus, errorMessage?: string}) => void) => {
        taskStatusUpdateCallbacks.push(callback)
    },
    getTaskReturnValue
})