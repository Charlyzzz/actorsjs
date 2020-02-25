const { Worker } = require('worker_threads');
const crypto = require('crypto');
const { dedicatedActor } = require('./dedicatedActor');

const generateId = () => crypto.randomBytes(16).toString('hex');

const Actor = {
    receive(msg, sender) {
        setImmediate(() => {
            this.behavior(msg, sender);
        });
    },
    reply(msg, resolve, sender) {
        setImmediate(() => {
            const res = this.behavior(msg, sender);
            resolve(res);
        });
    }
};


const Behaviors = {
    ignore: () => {},
    log: console.log
};

const actor = (behavior) => {
    let actor = Object.create(Actor);
    actor.behavior = behavior;
    return actor;
};

const System = {
    actors: {},
    spawnDedicated(file) {
        const id = generateId();
        const worker = new Worker(file, {
            workerData: { id }
        });
        this.actors[id] = dedicatedActor(worker);
        return id;
    },
    spawn(behavior = Behaviors.ignore) {
        const id = generateId();
        this.actors[id] = actor(behavior);
        return id;
    },
    tell(whom, msg, sender = null) {
        this.lookup(whom).receive(msg, sender);
    },
    async ask(whom, msg, timeout, sender) {
        return new Promise(((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error(`Ask timed out after ${timeout} ms`)), timeout);
            this.lookup(whom).reply(msg, (v) => {
                clearTimeout(timeoutId);
                resolve(v);
            }, sender);
        }));
    },
    lookup(actor) {
        return this.actors[actor];
    }
};

const system = () => Object.create(System);

module.exports = {
    Behaviors,
    system
};
