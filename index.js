const { system, Behaviors } = require('./actors');

const main = async () => {

    const mySystem = system();
    const myActor = mySystem.spawn(Behaviors.log);
    mySystem.tell(myActor, 'Hola!');

    const myDedicatedActor = mySystem.spawnDedicated('./myDedicatedActor.js');
    mySystem.tell(myDedicatedActor, 'hola desde un worker');
};

main();
