# PokéNATS
Simplistic game-type service written using [NATS](http://nats.io) to demonstrate modern messaging patterns. The main actors are:

- Trainer
- Eden
- PokéNATS

### Trainers
Trainers represent a player in the game. They contribute sensor data (their gps location) to the game using update notifications. When a trainer senses another trainer nearby, she absorbs emitted energy. The absorbed energy is greater the closer the player is to the other trainer.

When the player's energy reaches 100 or more, the player initiates a spawn.

### Eden
Eden creates new PokéNATS of a radom level and at a random location near a player that initiates a spawn.

### PokéNATS
PokéNATS are fuzzy pets that live for a very short period of time. They come in the shapes of 'N', 'A', 'T' and 'S'. And have levels ranging from 1-100+.

## PokéNATS As A NATS Messaging Application
The PokéNATS application is composed of several services. The services are designed to enable scaling. By enabling the individual components interact with each other without knowing about their location. 

Multiple instances of the same service can coexist and work cooperatively to handle requests.

Not surprisingly, PokéNATS uses NATS messaging.

### Subjects
Message subjects organize the message space. Their careful design enables filtering. Filtering releaves the client from discarding messages that it is not interested in processing.

PokéNATS services generate messages under different subjects. The first component of the subject sets a domain for a message. PokéNATS uses 3 groupings for their subjects:
- pokenats
- pokenats_admin
- pokenats_monitor

Typical application messages are published under the `pokenats` group. Other events such as `pokenats_admin` and `pokenats_monitor` events enabling tooling for the monitoring and management of the services.

The actual subjects are a bit more complex, they contain a number of tokens that provides information about the source of the message, type and location of the message:

- `pokenats.<serviceType>.<id>.[update|data|new|spawn].<grid>`
- `pokenats_admin.[discover|kill|conf].<seviceType>.<id>`
- `pokenats_monitor.<serviceType>.<id>.hb`
- `pokenats_monitor.<serviceType>.<id>.log.[info|error|invalid]`

_serviceType_ is specific to the service, be it a `trainer` or `eden-service` or any other component.

_id_ is an unique alpha-numeric identifier for the service that generated the message.

_grid_ is an ordinal reprenting a geographic grid where the event took plance. Grid enables the geolocation aspects of the game to filter only to clients that require notifications in that area. 

## Message Payload
Most PokéNATS services publish messages a JSON payload. Some messages don't require any payload.

## Trainer Data Service
The Trainer Data Service is a simple request-reply service. It provides an unique identifier to a trainer, and stores an email value on disk. It subscribes to `pokenats.trainer.<id>.data` requests, which it responds to the inbox of the client making the request.
__>>>>>>>>FIXME: code not currently using correct subject<<<<<<<<<<<<__

## The Eden Service
The Eden Service subscribes to `pokenats.trainer.<id>.spawn.<grid>`, an in return publishes a `pokenats.trainer.<id>.new.<grid>`. This is similar to a request-reply service, with the exception that the response is published to a well known subjects. This way other trainers are able to see where a PokéNATS spawns nearby.

## Trainers

On entering the world, a trainer makes a request to `pokenats.trainer.<id>.data.<grid>`, which is fullfilled by a Trainer Data Service.

Trainers publish `pokenats.trainer.<id>.update.<grid>` notifications every few sencods. Other trainers subscribe to `pokenats.trainer.<id>.update.<grid>` collect energy from nearby trainers. Energy is based on the location difference between the source of the event and the recipient.

When the trainer's energy reaches 100, it publishes a `pokenats.trainer.<id>.spawn.<grid>`.

## All Services
Publish a heartbeat on `pokenats_monitor.<serviceType>.<id>.hb`. This enables monitoring tooling to know what services are alive, and if necessary start a missing service.

All services also respond to requests like
`pokenats_admin.discover` - by responding with their _id_ and their _serviceType_. Because of the magic of filtering, the requests can be targetted to specific _serviceType_ or a specific _id_.

Similarly, the `kill` and `conf` can be used to initiate the termination of a specific client or set of services. `Conf` is used to target live configuration changes such as the heartbeat interval.

Note that `poke_nats` admin messages are designed to be exchanged over a secure and authenticated NATS server connection that is different from the one that the service normally uses for communication.

## Logging
Logging is an important component of managing and understanding what is going on with a service. `pokenats_monitor.<serviceType>.<id>.log.[info|error|invalid]` enables all services to publish interesting logs to the monitoring server. Where another service could perhaps grab the message from the wire and store it on a persitant store.

By convention, all services re-publish any message that is invalid (missing data fields or that validated incorrectly from the perspective of the service) to `pokenats_monitor.<serviceType>.<id>.log.invalid`. This simplifies the error handling for the service while preserving the information for forensic purposes.  In this example Invalid Message Service, listens for these messages, adds a timestamp and dumps them to the console.
