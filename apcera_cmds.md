cd pokenats

apc app create pokenats-control --depends-on runtime.node-6
apc job link pokenats-control --to nats-1 --name nats -p 4222
apc job update pokenats-control -pa 22 -o
apc app start pokenats-control

apc app create pokenats-proxy --depends-on runtime.node-6
apc job link pokenats-proxy --to nats-1 --name nats -p 4222
apc job update -sc 'npm run proxy' pokenats-proxy
apc job update pokenats-proxy -pa 8080 -o
apc job update pokenats-proxy -pa 8443 -o
apc job update pokenats-proxy -pd 0
apc job update pokenats-proxy -pa 0 -o
apc app start pokenats-proxy

apc app update pokenats-proxy --allow-sshcd 

apc app connect pokenats-control --instance-id 00f6d919-a17e-48a3-979e-64a21b920dd6