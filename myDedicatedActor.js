const { spawnActor } = require('./dedicatedActor');
const { Behaviors } = require('./actors');

spawnActor(Behaviors.log);
