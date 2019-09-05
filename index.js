#!/usr/bin/env node
const path = require('path')
const { spawn } = require('child_process');
const axios = require('axios');
const command = process.argv[2]
const args = process.argv.slice(3);
const errKey = '[tracker] error:'
const exitKey = signal => `process exited with signal ${signal}`
let cmdExited = false;
const config = {
    pushUrl: 'https://tranquil-spire-64208.herokuapp.com/cli'
}
const configPath = path.resolve(process.cwd(), '.tracker.json')
const options = { ...require(configPath), ...config };
const projectKey = options.projectKey
const apiKey = options.apiKey
const url = options.pushUrl
const triggers = options.triggers;

// setting up number of unfinished pushes, to wait for the last,
let counter = 0;
// so to not mess with async waiting of last push to exit process
const decCounter = () => {
    counter--;
    if (cmdExited) {
        console.log(`[tracker]: exited. Good bye.`);
        process.exit(0);
    }
}


const sendPush = (content, trigger) => {
    const opts = {
        method: 'POST',
        url: url,
        data: {
            command: process.argv[2],
            content: content,
            dir: process.argv.toString(),
            // data: {
            //     trigger: trigger,
            //     apiKey: apiKey,
            //     projectKey: projectKey
            // }
        },
        headers: {
            "Content-Type": "application/json"
        }
    }
    console.log(`[tracker]: sending:${JSON.stringify(opts)}`)
    counter++;
    axios(opts).then(res => {
        console.log(`[tracker]: push sent, response: ${JSON.stringify(res.data)}`);
        decCounter();
    }).catch(error => {
        if (error.response) {
            /*
             * The request was made and the server responded with a
             * status code that falls out of the range of 2xx
             */
            console.log(`[tracker]: data: ` + JSON.stringify(error.response.data));
            console.log(`[tracker]: status: ` + error.response.status);
            console.log(`[tracker]: headers: ` + JSON.stringify(error.response.headers));
        } else if (error.request) {
            /*
             * The request was made but no response was received, `error.request`
             * is an instance of XMLHttpRequest in the browser and an instance
             * of http.ClientRequest in Node.js
             */
            console.log(`[tracker]: request: ` + error.request);
        } else {
            // Something happened in setting up the request and triggered an Error
            console.log(`[tracker]: message: `, error.message);
        }
        console.log(`[tracker]: error: ` + error);
        decCounter();
    })
}

const cmd = spawn(command, args);
process.stdin.pipe(cmd.stdin)
cmd.stdout.pipe(process.stdout)
cmd.stderr.pipe(process.stderr)
cmd.stdout.on('data', (data) => {
    let _data;
    if (data instanceof Buffer) {
        _data = data.toString('utf8')
    }
    if (typeof data === 'string') {
        _data = data;
    }
    Object.keys(triggers).map(key => {
        if (triggers[key].type == 'regex' && new RegExp(triggers[key].regex).exec(_data)) {
            console.log(`[tracker]: push`);
            sendPush(_data, key)
        }
    })

});
cmd.stderr.on('data', (data) => {
    sendPush(data.toString(), errKey)
});
cmd.on('exit', function (code, signal) {
    sendPush(`[tracker] exited with code ${code} and signal ${signal}`, exitKey(signal))
    cmdExited = true;
});
