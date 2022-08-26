import { MutableRefObject } from 'react';
import './App.css';
import deserializeReturnValue from './deserializeReturnValue';
import { FigurlRequest, FigurlResponse } from './viewInterface/FigurlRequestTypes';
import { isTaskJobStatus, TaskJobStatus, MessageToChild } from './viewInterface/MessageToChildTypes';
import { isMessageToParent } from './viewInterface/MessageToParentTypes';

if (!((window as any).electronInterface)) {
    console.warn('Not using electron')
}

export const electronInterface: {
    handleFigurlRequest: (req: FigurlRequest, o: {dataUri: string}) => Promise<FigurlResponse | undefined>,
    onTaskStatusUpdate: (callback: (a: {taskName: string, taskJobId: string, status: string, errorMessage?: string}) => void) => void,
    createLocalPubsubServer: (port: number, callback: (x: any) => void) => any
} = (window as any).electronInterface || {
    handleFigurlRequest: async (req: FigurlRequest, o: {dataUri: string}) => {
        return undefined
    },
    onTaskStatusUpdate: (callback: (a: {taskName: string, taskJobId: string, status: string, errorMessage?: string}) => void) => {},
    createLocalPubsubServer: (port: number, callback: (x: any) => void) => {}
}

class FigInterface {
    constructor(private a: {
        figureId: string,
        iframeElement: MutableRefObject<HTMLIFrameElement | null | undefined>,
        viewUrl: string,
        dataUri: string
    }) {
        electronInterface.onTaskStatusUpdate(({taskName, taskJobId, status, errorMessage}) => {
            this._sendMessageToChild({
                type: 'taskStatusUpdate',
                taskJobId,
                status: status as TaskJobStatus,
                errorMessage // for status=error
            })
        })
        window.addEventListener('message', e => {
            const msg = e.data
            if (isMessageToParent(msg)) {
                if (msg.type === 'figurlRequest') {
                    electronInterface.handleFigurlRequest(msg.request, {dataUri: a.dataUri}).then(resp => {
                        ;(async () => {
                            if (resp) {
                                // deserialize data here rather than in electron
                                // because Buffer behaves differently in electron
                                if (resp.type === 'getFigureData') {
                                    resp.figureData = await deserializeReturnValue(resp.figureData)
                                }
                                if (resp.type === 'getFileData') {
                                    resp.fileData = await deserializeReturnValue(resp.fileData)
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
        cw.postMessage(msg, this.a.viewUrl)
    }
}

export default FigInterface