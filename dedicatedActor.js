const { parentPort } = require('worker_threads');

const spawnActor = (behavior) => {
    parentPort.on('message', (msg) => {
        behavior(msg);
    });
};

const DedicatedActor = {
    receive(msg) {
        this.worker.postMessage(msg);
    },
    reply(msg, resolve) {
        this.worker.postMessage(msg);
        this.worker.once('message', resolve);
    }
};

const dedicatedActor = (worker) => {
    let actor = Object.create(DedicatedActor);
    actor.worker = worker;
    return actor;
};

module.exports = {
    spawnActor,
    dedicatedActor
};
