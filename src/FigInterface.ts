import { MutableRefObject } from 'react';
import './App.css';
import deserializeReturnValue from './deserializeReturnValue';
import { FigurlRequest, FigurlResponse } from './viewInterface/FigurlRequestTypes';
import { MessageToChild } from './viewInterface/MessageToChildTypes';
import { isMessageToParent } from './viewInterface/MessageToParentTypes';

if (!((window as any).electronInterface)) {
    console.warn('Not using electron')
}

const electronInterface: {
    handleFigurlRequest: (req: FigurlRequest, o: {dataUri: string}) => Promise<FigurlResponse | undefined>
} = (window as any).electronInterface || {
    handleFigurlRequest: async (req: FigurlRequest, o: {dataUri: string}) => {
        return undefined
    }
}

class FigInterface {
    constructor(private a: {
        figureId: string,
        iframeElement: MutableRefObject<HTMLIFrameElement | null | undefined>,
        viewUrl: string,
        dataUri: string
    }) {
        // ipcRenderer.on('mainprocess-message-to-child', (event, msg) => {
        //     this._sendMessageToChild(msg)
        // })
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