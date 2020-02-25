const crypto = require('crypto');

const generateId = () => crypto.randomBytes(16).toString('hex');

const INIT_MSG = 'init';

const ActorWithInit = {
    spawned() {
        setImmediate(() => this.context.tell(this.context.self, INIT_MSG));
    },
    receive(msg, _sender) {
        if (msg === INIT_MSG) {
            setImmediate(() => {
                this.context.initBehavior(this.context);
                Object.setPrototypeOf(this, Actor);
            });
        } else {
            this.context.logger.warn('Received message before init');
        }
    }
};

const Actor = {
    spawned() {},
    receive(msg, sender) {
        this.mailbox.push({ msg, sender });
        setImmediate(() => {
            this.checkMailbox();
        });
    },
    checkMailbox() {
        if (this.mailbox.length !== 0) {
            const msg = this.mailbox.shift();
            this.processMessage(msg);
        }
    },
    processMessage({ msg, sender }) {
        try {
            this.context.behavior(msg, sender, this.context);
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
        scheduleOnce(whom, msg, delay, sender = name) {
            return system.scheduleOnce(whom, msg, delay, sender);
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
        if (this.lookup(name) !== this.deadLetterQueue)
            throw new Error(`An actor with that name already exists. Name was [${name}]`);
        this.actors[name] = actor(initBehavior, behavior, name, this);
        return name;
    },
    tell(whom, msg, sender = this.deadLetterQueue) {
        this.lookup(whom).receive(msg, sender);
    },
    scheduleOnce(whom, msg, delay, sender = this.deadLetterQueue) {
        return setTimeout(() => this.tell(whom, msg, sender), delay);
    },
    lookup(actor) {
        return this.actors[actor] || this.deadLetterQueue;
    }
};

const system = () => {
    const newSystem = Object.create(System);
    newSystem.deadLetterQueue = newSystem.spawnSystemActor(deadLetterQueue, 'deadLetterQueue');
    newSystem.logger = newSystem.spawnSystemActor(logger, 'logger');
    return newSystem;
};

const logger = ([level, msg, whom]) => {
    console[level](`[${whom}]: ` + msg);
};

const deadLetterQueue = (msg, ctx) => {
    ctx.logger.log(`Received ${msg} from ${ctx.sender}`);
};

module.exports = {
    Behaviors,
    system
};
