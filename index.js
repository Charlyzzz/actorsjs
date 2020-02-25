const { system, Behaviors } = require('./actors');

const ping = (msg, sender, ctx) => {
    ctx.logger.log(msg);
    ctx.scheduleOnce(sender, 'ping', 1000);
};

const pong = (msg, sender, ctx) => {
    ctx.logger.log(msg);
    ctx.scheduleOnce(sender, 'pong', 1000);
};

const mySystem = system();
const pongActor = mySystem.spawnActor(pong, 'ponger');

mySystem.spawnActor(ping, 'pinger', (ctx) => {
    ctx.tell(pongActor, 'ping');
});

