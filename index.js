const { system, Behaviors } = require('./actors');

const timer = {
    start() {
        this.startMillis = this.getCurrentMillis();
    },
    track() {
        return this.getCurrentMillis() - this.startMillis;
    },
    reset() {
        this.start();
    },
    getCurrentMillis() {
        return new Date().getTime();
    }
};

const pingPong = async (actorSystem) => {

    const ping = (msg, sender, ctx) => {
        ctx.logger.log(msg);
        ctx.scheduleOnce(sender, 'ping', 1000);
    };

    const pong = (msg, sender, ctx) => {
        ctx.logger.log(msg);
        ctx.scheduleOnce(sender, 'pong', 1000);
    };

    const pongActor = actorSystem.spawnActor(pong, 'ponger');

    actorSystem.spawnActor(ping, 'pinger', (ctx) => {
        ctx.tell(pongActor, 'ping');
    });
};

const ask = async (actorSystem) => {

    const replier = actorSystem.spawnActor((msg, sender, ctx) => {
        if (msg === 'rapido') {
            ctx.tell(sender, 'Hola!');
        } else if (msg === 'lento') {
            ctx.scheduleOnce(sender, 'Hola! (mas lento)', 1000);
        }
    });
    timer.start();
    let respuesta = await actorSystem.ask(replier, 'rapido', 1000);
    console.log({ respuesta, millis: timer.track() });
    timer.reset();
    respuesta = await actorSystem.ask(replier, 'lento', 2000);
    console.log({ respuesta, millis: timer.track() });
    try {
        await actorSystem.ask(replier, 'lento', 1000);
    } catch (e) {
        console.log(e);
    }
};

const askBetweenActors = async (actorSystem) => {

    const dolar = actorSystem.spawnActor((msg, sender, ctx) => {
        ctx.tell(sender, 83);
    });

    const catalogo = actorSystem.spawnActor((msg, sender, ctx) => {
        const precios = {
            'pc': 1500,
            'tablet': 700
        };
        const precio = precios[msg];
        precio && ctx.tell(sender, precio);
    });

    const mercadoLibre = actorSystem.spawnActor(async (msg, sender, ctx) => {
        const precioEnDolares = await ctx.ask(catalogo, msg, 1000);
        const dolarHoy = await ctx.ask(dolar, null, 1000);
        ctx.tell(sender, dolarHoy * precioEnDolares);
    });

    let precioPc = await actorSystem.ask(mercadoLibre, 'pc', 1000);
    console.log({ precioPc });
};


const scheduling = async (actorSystem) => {

    const proveedorDeAes = actorSystem.spawnActor((msg, sender, ctx) => {
        ctx.scheduleOnce(sender, 'a', 3000);
    });

    const abecedario = actorSystem.spawnActor(async (msg, sender, ctx) => {
        switch (msg) {
            case 'a':
                const a = await ctx.ask(proveedorDeAes, null, 5000);
                console.log(1);
                ctx.tell(sender, a);
                break;
            case 'b':
                ctx.tell(sender, 'b');
                console.log(2);
                break;
        }
    });

    actorSystem.ask(abecedario, 'b', 1000);
    actorSystem.ask(abecedario, 'a', 5000);
    actorSystem.ask(abecedario, 'b', 1000);
    actorSystem.ask(abecedario, 'b', 1000);

};

const actorSystem = system();
scheduling(actorSystem);
