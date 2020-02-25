const crypto = require('crypto');

const generateId = () => crypto.randomBytes(16).toString('hex');

const Actor = {
    receive(msg, sender) {
        setImmediate(() => {
            this.processMessage(msg, sender);
        });
    },
    processMessage(msg, sender) {
        try {
            this.behavior(msg, this.context, sender);
        } catch (e) {
            console.error(e);
        }
    }
};

const Behaviors = {
    ignore: () => {},
    log: (msg, ctx) => ctx.logger.log(msg)
};

const actor = (behavior, name, system) => {
    let actor = Object.create(Actor);
    actor.behavior = behavior;
    actor.context = {
        self: name,
        tell(whom, msg, sender = name) {
            system.tell(whom, msg, sender);
        },
        scheduleOnce(whom, msg, delay, sender = name) {
            system.scheduleOnce(whom, msg, delay, sender);
        },
        logger: {
            log(msg) {
                system.tell(system.logger, ['log', msg, name]);
            }
        },
        system
    };
    return actor;
};

const System = {
    actors: {},
    spawnActor(behavior, name = generateId()) {
        const actorName = '/user/' + name;
        return this.doSpawn(behavior, actorName);
    },
    spawnSystemActor(behavior, name = generateId()) {
        const actorName = '/system/' + name;
        return this.doSpawn(behavior, actorName);
    },
    doSpawn(behavior, name) {
        if (this.lookup(name) !== this.deadLetterQueue)
            throw new Error(`An actor with that name already exists. Name was [${name}]`);
        this.actors[name] = actor(behavior, name, this);
        return name;
    },
    tell(whom, msg, sender = this.deadLetterQueue) {
        this.lookup(whom).receive(msg, sender);
    },
    scheduleOnce(whom, msg, delay, sender = this.deadLetterQueue) {
        setTimeout(() => this.tell(whom, msg, sender), delay);
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

const deadLetterQueue = (msg, ctx, sender) => {
    ctx.logger.log(`Received ${msg} from ${sender}`);
};

module.exports = {
    Behaviors,
    system
};
