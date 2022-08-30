import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as isDev from 'electron-is-dev';
import installExtension, { REACT_DEVELOPER_TOOLS } from "electron-devtools-installer";
import QueryParameters from './preload/src/QueryParameters';

let win: BrowserWindow | null = null;

type CommandLineArgs = {
    d?: string,
    v?: string,
    dev?: boolean
    label?: string
    listenPort?: number
}

const args: CommandLineArgs = parseCommandLineArgs()

function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            preload: __dirname + `/preload/src/preload.js`
        }
    })

    const queryParameters: QueryParameters = {
        viewUri: args.v,
        dataUri: args.d,
        label: args.label || 'untitled',
        listenPort: args.listenPort
    }

    let queryString: string = ''
    for (let k in queryParameters) {
        const a = `${k}=${(queryParameters as any)[k]}`
        queryString = queryString === '' ? a : `${queryString}&${a}`
    }

    if (isDev) {
        win.loadURL(`http://localhost:3000/index.html?${queryString}`);
    } else {
        // 'build/index.html'
        win.loadURL(`file://${__dirname}/../index.html?${queryString}`);
    }

    win.on('closed', () => win = null);

    if (args.dev) {
        win.webContents.openDevTools()
    }

    // Hot Reloading
    if (isDev) {
        // 'node_modules/.bin/electronPath'
        require('electron-reload')(`${__dirname} ${process.argv.slice(2).join(' ')}`, {
            electron: path.join(__dirname, '..', '..', 'node_modules', '.bin', 'electron'),
            forceHardReset: true,
            hardResetMethod: 'exit'
        });
    }

    // DevTools
    installExtension(REACT_DEVELOPER_TOOLS)
        .then((name) => console.log(`Added Extension:  ${name}`))
        .catch((err) => console.log('An error occurred: ', err));

    if (isDev) {
        win.webContents.openDevTools();
    }
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (win === null) {
        createWindow();
    }
});

function parseCommandLineArgs() {
    const ret: CommandLineArgs = {}
    const x: string[] = process.argv
    let i = 0
    while (i < x.length) {
        for (let i = 0; i < x.length; i++) {
            if (x[i] === '-d') {
                ret.d = x[i + 1]
                i ++
            }
            else if (x[i] === '-v') {
                ret.v = x[i + 1]
                i ++
            }
            else if (x[i] === '--dev') {
                ret.dev = true
            }
            else if (x[i] === '--label') {
                ret.label = x[i + 1]
                i ++
            }
            else if (x[i] === '--listenPort') {
                ret.listenPort = parseInt(x[i + 1])
                i ++
            }
        }
        i ++
    }
    return ret
}