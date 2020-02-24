const crypto = require('crypto');
const generateId = () => crypto.randomBytes(16).toString('hex');

const Actor = {
    receive(msg) {
        setImmediate(() => {
            this.behavior(msg);
        });
    },
    reply(msg, resolve) {
        setImmediate(() => {
            const res = this.behavior(msg);
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
    spawn(behavior = Behaviors.ignore) {
        const id = generateId();
        this.actors[id] = actor(behavior);
        return id;
    },
    tell(whom, msg) {
        this.lookup(whom).receive(msg);
    },
    async ask(whom, msg, timeout) {
        const defer = {};
        const response = new Promise(((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error(`Ask timed out after ${timeout} ms`)), timeout);
            defer.resolve = resolve;
            defer.timeout = timeoutId;
        }));
        this.lookup(whom).reply(msg, (v) => {
            clearTimeout(defer.timeout);
            defer.resolve(v);
        });
        return response;
    },
    lookup(actor) {
        return this.actors[actor];
    }
};

const system = () => Object.create(System);


const main = async () => {

    const mySystem = system();
    const myActor = mySystem.spawn(Behaviors.log);

    mySystem.tell(myActor, 'Chau!');
    await mySystem.ask(myActor, 'Hola!', 1500);

    console.log('1');
    console.log('2');
};

main();
