import { FunctionComponent, useEffect, useState } from "react";
import { electronInterface } from "./FigInterface";

type Props = {

}

const PubsubServer: FunctionComponent<Props> = () => {
    const [numSubscribe, setNumSubscribe] = useState<number>(0)
    const [numPublish, setNumPublish] = useState<number>(0)
    const [numOther, setNumOther] = useState<number>(0)
    useEffect(() => {
        console.info('Starting pubsub server')
        const server = electronInterface.createLocalPubsubServer(4004, (x: any) => {
            if (x.type === 'publish') setNumPublish(x => (x + 1))
            else if (x.type === 'subscribe') setNumSubscribe(x => (x + 1))
            else setNumOther(x => (x + 1))
        })
        if (!server) {
            console.warn('Unable to create local pubsub server.')
            return
        }
        server.run().then(() => {
            console.warn('Local pubsub server stopped.')
        })
        return () => {
            console.log('Stopping pubsub server')
            server.stop()
        }
    }, [])
    return (
        <div style={{margin: 30}}>
            <h1>Local pubsub server</h1>
            <hr />
            <h3>Number of requests</h3>
            <table>
                <tbody>
                    <tr>
                        <td>subscribe:</td>
                        <td>{numSubscribe}</td>
                    </tr>
                    <tr>
                        <td>publish:</td>
                        <td>{numPublish}</td>
                    </tr>
                    <tr>
                        <td>other:</td>
                        <td>{numOther}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    )
}

export default PubsubServer