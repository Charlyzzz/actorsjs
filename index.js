const { system, Behaviors } = require('./actors');

const ping = (msg, ctx, sender) => {
    ctx.logger.log(msg);
    ctx.scheduleOnce(sender, 'ping', 1000);
};

const pong = (msg, ctx, sender) => {
    ctx.logger.log(msg);
    ctx.scheduleOnce(sender, 'pong', 1000);
};

const main = async () => {
    const mySystem = system();
    const pingActor = mySystem.spawnActor(ping, 'pinger');
    const pongActor = mySystem.spawnActor(pong, 'ponger');
    mySystem.tell(pingActor, 'start');
};

main();
