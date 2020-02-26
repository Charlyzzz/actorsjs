const crypto = require('crypto');

const generateId = () => crypto.randomBytes(16).toString('hex');

const INIT_MSG = 'init';

const BaseActor = {
    spawned() {},
    dispatch(action) {
        const immediate = setImmediate(action);
        let dispatchId = generateId();
        this.dispatchs[dispatchId] = immediate;
        return dispatchId;
    }
};

const ActorWithInit = {
    __proto__: BaseActor,
    spawned() {
        this.dispatch(() => this.context.tell(this.context.self, INIT_MSG));
    },
    receive(msg, _sender) {
        if (msg === INIT_MSG) {
            this.dispatch(() => {
                this.context.initBehavior(this.context);
                Object.setPrototypeOf(this, Actor);
            });
        } else {
            this.context.logger.warn('Received message before init');
        }
    }
};

const Actor = {
    __proto__: BaseActor,
    receive(msg, sender) {
        this.mailbox.push({ msg, sender });
        this.dispatch(async () => {
            await this.checkMailbox();
        });
    },
    async checkMailbox() {
        if (this.mailbox.length !== 0) {
            const msg = this.mailbox.shift();
            await this.processMessage(msg);
        }
    },
    async processMessage({ msg, sender }) {
        this.busy = true;
        try {
            await this.context.behavior(msg, sender, this.context);
        } catch (e) {
            console.error(e);
        }
    }
};

const Behaviors = {
    ignore: () => {},
    log: (msg, sender, ctx) => ctx.logger.log(msg)
};

const actor = (initBehavior, behavior, name, system) => {

    const proto = initBehavior ? ActorWithInit : Actor;
    let actor = Object.create(proto);

    actor.mailbox = [];
    actor.dispatchs = {};

    const logger = ['log', 'warn', 'error'].reduce((loggerSoFar, level) => {
        loggerSoFar[level] = (msg) => {
            system.tell(system.logger, [level, msg, name]);
        };
        return loggerSoFar;
    }, {});

    actor.context = {
        self: name,
        initBehavior,
        behavior,
        tell(whom, msg, sender = name) {
            system.tell(whom, msg, sender);
        },
        ask(whom, msg, timeout, sender = name) {
            return this.system.ask(whom, msg, timeout, sender);
        },
        scheduleOnce(whom, msg, delay, sender = name) {
            return system.scheduleOnce(whom, msg, delay, sender);
        },
        stop() {
            this.system.stop(this.self);
        },
        cancelTimer: clearTimeout,
        logger,
        system
    };

    actor.spawned();
    return actor;
};

const System = {
    actors: {},
    spawnActor(behavior, name = generateId(), initBehavior) {
        const actorName = '/user/' + name;
        return this.doSpawn(initBehavior, behavior, actorName);
    },
    spawnSystemActor(behavior, name = generateId(), initBehavior) {
        const actorName = '/system/' + name;
        return this.doSpawn(initBehavior, behavior, actorName);
    },
    doSpawn(initBehavior, behavior, name) {
        if (this.lookup(name) !== this.lookup(this.deadLetters))
            throw new Error(`An actor with that name already exists. Name was [${name}]`);
        this.actors[name] = actor(initBehavior, behavior, name, this);
        return name;
    },
    tell(whom, msg, sender = this.deadLetters) {
        this.lookup(whom).receive(msg, sender);
    },
    scheduleOnce(whom, msg, delay, sender = this.deadLetters) {
        return setTimeout(() => this.tell(whom, msg, sender), delay);
    },
    lookup(actor) {
        return this.actors[actor] || this.actors[this.deadLetters];
    },
    ask(whom, msg, timeout, sender = this.deadLetters) {
        return new Promise((resolve, reject) => {
            this.tell(this.replier, {
                msg, whom, timeout, resolve, reject
            }, sender);
        });
    },
    stop(actor) {
        Object.values(this.lookup(actor).dispatchs).forEach(clearImmediate);
        delete this.actors[actor];
    }
};

const system = () => {
    const newSystem = Object.create(System);
    newSystem.deadLetters = newSystem.spawnSystemActor(deadLetters, 'deadLetters');
    newSystem.logger = newSystem.spawnSystemActor(logger, 'logger');
    newSystem.replier = newSystem.spawnSystemActor(replier, 'replier');
    return newSystem;
};

const replies = {};


const timeout = ({ interactionId, timeout }, sender, ctx) => {
    const { reject, replyProxy } = replies[interactionId];
    reject(new Error(`Timeout occured after ${timeout} ms`));
    delete replies[interactionId];
    ctx.system.stop(replyProxy);
};

const ask = ({ msg, whom, timeout, resolve, reject }, sender, ctx) => {
    const interactionId = generateId();
    const replyProxy = ctx.system.spawnSystemActor((reply, _sender, ctx) => {
        const { resolve, timer } = replies[interactionId];
        clearTimeout(timer);
        resolve(reply);
        delete replies[interactionId];
        ctx.stop();
    }, 'replyAdapter-' + generateId(), (ctx) => {
        ctx.tell(whom, msg, ctx.self);
    });
    const timer = ctx.scheduleOnce(ctx.self, { type: 'timeout', interactionId, timeout }, timeout);
    replies[interactionId] = {
        resolve, timer, reject, replyProxy
    };
};

const replier = ({ type, ...msg }, sender, ctx) => {
    const action = type === 'timeout' ? timeout : ask;
    action(msg, sender, ctx);
};

const logger = ([level, msg, whom]) => {
    console[level](`[${whom}]: ` + JSON.stringify(msg));
};

const deadLetters = (msg, sender, ctx) => {
    ctx.logger.log(`Received [${msg}] from ${sender}`);
};

module.exports = {
    Behaviors,
    system
};
