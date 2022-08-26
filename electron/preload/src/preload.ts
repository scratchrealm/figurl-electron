import { contextBridge } from "electron"
import { FigurlRequest, FigurlResponse } from "./viewInterface/FigurlRequestTypes"
import * as fs from 'fs'
import * as process from 'process'
import LocalPubsubServer from "./LocalPubsubServer"

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
    },
    createLocalPubsubServer: (port: number, callback: (x: any) => void) => {
        const X = new LocalPubsubServer({port, callback})
        return {
            run: () => {return X.run()},
            stop: () => {X.stop()}
        }
    }
})