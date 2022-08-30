import { MutableRefObject } from 'react';
import './App.css';
import deserializeReturnValue from './deserializeReturnValue';
import { FigurlRequest, FigurlResponse } from './viewInterface/FigurlRequestTypes';
import { MessageToChild, TaskJobStatus, TaskType } from './viewInterface/MessageToChildTypes';
import { isMessageToParent } from './viewInterface/MessageToParentTypes';
import QueryParameters from '../electron/preload/src/QueryParameters'
import urlFromUri from './urlFromUri';

if (!((window as any).electronInterface)) {
    console.warn('Not using electron')
}

export const electronInterface: {
    setQueryParameters: (q: QueryParameters) => Promise<void>,
    handleFigurlRequest: (req: FigurlRequest) => Promise<FigurlResponse | undefined>,
    onTaskStatusUpdate: (callback: (a: {taskType: TaskType, taskName: string, taskJobId: string, status: TaskJobStatus, errorMessage?: string}) => void) => void,
    getTaskReturnValue: (a: {taskName: string, taskJobId: string}) => Promise<any | undefined>
} = (window as any).electronInterface || {
    setQueryParameters: async (q: QueryParameters) => {},
    handleFigurlRequest: async (req: FigurlRequest, o: {dataUri: string, projectId?: string, backendId?: string}) => {
        return undefined
    },
    onTaskStatusUpdate: (callback: (a: {taskType: TaskType, taskName: string, taskJobId: string, status: TaskJobStatus, errorMessage?: string}) => void) => {},
    getTaskReturnValue: async (a: {taskName: string, taskJobId: string}): Promise<any | undefined> => {}
}

class FigInterface {
    #viewUrl?: string
    constructor(private a: {
        figureId: string,
        iframeElement: MutableRefObject<HTMLIFrameElement | null | undefined>
    }) {
        electronInterface.onTaskStatusUpdate(({taskType, taskName, taskJobId, status, errorMessage}) => {
            ;(async () => {
                let returnValue: any | undefined = undefined
                if (status === 'finished') {
                    if (taskType === 'calculation') {
                        returnValue = await electronInterface.getTaskReturnValue({taskName, taskJobId})
                        if (returnValue === undefined) {
                            console.warn(taskName, taskJobId)
                            console.warn('Unexpected... calculation task is finished, but not able to load return value')
                            return
                        }
                        // deserialize data here rather than in preload
                        // because Buffer may behave differently in preload
                        returnValue = await deserializeReturnValue(returnValue)
                    }
                }
                this._sendMessageToChild({
                    type: 'taskStatusUpdate',
                    taskJobId,
                    status,
                    errorMessage, // for status=error
                    returnValue
                })
            })()
        })
        window.addEventListener('message', e => {
            const msg = e.data
            if (isMessageToParent(msg)) {
                if (msg.type === 'figurlRequest') {
                    electronInterface.handleFigurlRequest(msg.request).then(resp => {
                        ;(async () => {
                            if (resp) {
                                // deserialize data here rather than in preload
                                // because Buffer may behave differently in preload
                                if (resp.type === 'getFigureData') {
                                    resp.figureData = await deserializeReturnValue(resp.figureData)
                                }
                                if (resp.type === 'getFileData') {
                                    resp.fileData = await deserializeReturnValue(resp.fileData)
                                }
                                if (resp.type === 'initiateTask') {
                                    if (resp.returnValue) {
                                        resp.returnValue = await deserializeReturnValue(resp.returnValue)
                                    }
                                }

                                this._sendMessageToChild({
                                    type: 'figurlResponse',
                                    requestId: msg.requestId,
                                    response: resp
                                })
                            }
                            else {
                                console.warn('Did not handle request', msg.request.type)
                            }
                        })()
                    })
                }
            }
        })
    }
    async initialize(queryParameters: QueryParameters) {
        this.#viewUrl = queryParameters.viewUri ? urlFromUri(queryParameters.viewUri) : undefined
        await electronInterface.setQueryParameters(queryParameters)
    }
    _sendMessageToChild(msg: MessageToChild) {
        if (!this.a.iframeElement.current) {
            setTimeout(() => {
                // keep trying until iframe element exists
                this._sendMessageToChild(msg)
            }, 1000)
            return
        }
        const cw = this.a.iframeElement.current.contentWindow
        if (!cw) return
        if (!this.#viewUrl) {
            throw Error('No viewUrl in _sendMessageToChild')
        }
        cw.postMessage(msg, urlFromUri(this.#viewUrl))
    }
}

export default FigInterface