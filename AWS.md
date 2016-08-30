# Create instance
1. Create the instance
2. Download the certificate file to some directory
3. Review security groups, open/close the ports that are necessary
4. On the console, click 'Connect', this will give the SSH command to connect to the machine.

# sudo access in AWS
sudo su

# Install pokenats
curl --silent --location https://rpm.nodesource.com/setup_6.x | bash -
yum -y install nodejs
yum install git
wget https://github.com/nats-io/gnatsd/releases/download/v0.9.4/gnatsd-v0.9.4-linux-amd64.zip
unzip gnatsd-v0.9.4-linux-amd64.zip
mv gnatsd-v0.9.4-linux-amd64 gnatsd094
git clone https://github.com/aricart/pokenats.git
cd pokenats
npm install

# Startup
../gnatsd094/gnatsd > /dev/null 2>&1 &
npm start > /dev/null 2>&1 &
npm run proxy > /dev/null 2>&1 &

> /dev/null 2>&1 &


# Tools

https://54.149.51.248/login.html
export AWS=54.149.51.248


node trainer_counter.js -s nats://$AWS:4222
node pokenats_counter -s nats://$AWS:4222

nats-sub -s nats://$AWS:4222 "pokenats.eden-service.>"
nats-sub -s nats://$AWS:4222 "pokenats_monitor.*.*.hb"

nats-pub -s nats://$AWS:4222 "pokenats_admin.conf.trainer.*" "{\"trainer.heartbeat.interval\": 1000}"

npm run stjohns -s nats://$AWS:4222 > /dev/null 2>&1 &
npm run lake -s nats://$AWS:4222 > /dev/null 2>&1 &
npm run dancingwaters -s nats://$AWS:4222 > /dev/null 2>&1 &
npm run park  -s nats://$AWS:4222 > /dev/null 2>&1 &


