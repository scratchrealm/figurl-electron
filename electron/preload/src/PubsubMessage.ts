import { isSha1Hash, Sha1Hash } from "./viewInterface/kacheryTypes"
import validateObject, { isEqualTo, isNumber, isString, optional } from "./viewInterface/validateObject"

export type PubsubChannelName = 'requestTasks' | 'provideTasks' | 'feedUpdates'

export const isPubsubChannelName = (x: any): x is PubsubChannelName => (['requestTasks', 'provideTasks', 'feedUpdates'].includes(x))

export type TaskStatus = 'started' | 'error' | 'finished'

export const isTaskStatus = (x: any): x is TaskStatus => (['started', 'error', 'finished'].includes(x))

export type TaskType = 'calculation' | 'action'

export const isTaskType = (x: any): x is TaskType => (['calculation', 'action'].includes(x))

export type PubsubMessage = {
    type: 'setTaskStatus'
    taskName: string
    taskJobId: Sha1Hash
    status: TaskStatus
    errorMessage?: string
} | {
    type: 'requestTask'
    taskType: TaskType
    taskName: string
    taskInput: any
    taskJobId: Sha1Hash
} | {
    type: 'feedMessagesAppended'
    projectId: string
    feedId: string
    numMessagesAppended: number
}

export const isPubsubMessage = (x: any): x is PubsubMessage => (
    validateObject(x, {
        type: isEqualTo('setTaskStatus'),
        taskName: isString,
        taskJobId: isSha1Hash,
        status: isTaskStatus,
        errorMessage: optional(isString)
    }) ||
    validateObject(x, {
        type: isEqualTo('requestTask'),
        taskType: isTaskType,
        taskName: isString,
        taskInput: () => (true),
        taskJobId: isSha1Hash
    }) ||
    validateObject(x, {
        type: isEqualTo('feedMessagesAppended'),
        projectId: isString,
        feedId: isString,
        startMessageNumber: isNumber,
        numMessagesAppended: isNumber
    })
)