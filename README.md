# PokéNATS
Simplistic PokemonGo Clone written using [NATS](http://nats.io) to demonstrate modern messaging patterns.

### Notifications

```
pokenats

pokenats.bad
pokenats.trainer.data.id.grid
pokenats.trainer.new.id.grid
pokenats.trainer.update.id.grid
pokenats.trainer.genesis.id.grid

pokenats.genesis
pokenats.monitor.error
pokenats.monitor.info
pokenats.admin.request

pokenats.log.<serviceType>.<id>.[error|info]


```

`pokenats.<serviceType>.<id>.log.[info|error|invalid]`
`pokenats.<serviceType>.<id>.[hb|data|new|update|genesis].<grid>`

`pokenats.<serviceType>.<id>.[discover|kill|conf].<grid>`



# Pokenats Service Normalization
`pokenats.<serviceType>.<id>.`
`pokenats.eden.<id>.genesis.<grid>`

## Trainer normalization
`pokenats.trainer.[data|new|update|genesis].<id>.<grid>`

## Monitoring and Admin normalization
```
pokenats.monitor.<type>.<serviceType>.<id>
pokenats.monitor.[hb].<serviceType>.<id>

pokenats.admin.<cmd>.<serviceType>.<id>
pokenats.admin.[discover|kill|conf].<serviceType>.<id>.<grid>
```

Todo.todo
- Remove pokenats.admin.request (replace with discover, kill, conf)
- what is monitor.error or monitor.info?
- Only monitor type is heartbeat

## Logging normalization
The logging subject space:

`pokenats.log.[info|error|invalid].<serviceType>.id`

Tasks.todo
- Remove pokenats.bad (consolidate with log) 
- Normalize so that all logging reports the service type and id of publisher
all logs:
`pokenats.log.>`
all logs for service:
`pokenats.log.*.eden.*`


## Bad Request normalization
Tasks.todo
- Remove this type of event, it is a logging thing
`pokenats.bad.<seviceType>.<id>`



```


pokenats.log.[info|error].<serviceType>.<id>

pokenats.monitor.<type>.<serviceType>.<id>
pokenats.monitor.[hb].<serviceType>.<id>

pokenats.admin.<cmd>.<serviceType>.<id>
pokenats.admin.[discover|kill|conf].<serviceType>.<id>.<grid>

pokenats.trainer.<type>.<id>.<grid>
pokenats.trainer.[enter|data|update|genesis|exit].<id>.<grid>

pokenats.eden.<id>.


pokenats.client.



pokenats.data


pokenats.<serviceType>.<id>.update.<grid>

pokenats.trainer.update.<id>.grid
pokenats.trainer.genesis
pokenats.monitor.<serviceType>.<id>
pokenats.log.<serviceType>.<id>
```

Need to make genesis have id of the trainer