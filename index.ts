import {
    ThirdPartyAdapter,

    download, entities,

    ThirdPartyPayload, ThirdPartyMessagePayload, ThirdPartyImageMessagePayload,
    UserData, RoomData
} from 'matrix-puppet-bridge';

import { DiscordClient } from './client';
const debug = require('debug')('matrix-puppet:discord');

export class Adapter extends ThirdPartyAdapter {
    public serviceName = 'Discord';
    private client: DiscordClient;
    startClient(): Promise<void> {
        this.client = new DiscordClient();
        this.client.configure(this.config);
        debug('startClient');

        this.client.on('ready', () => {
            debug('logged in!');
            debug(this.config);
        });

        this.client.on('sent', msg => {
            this.handleDiscordMessage({channel: msg.channel, content: msg.content, sentraw: msg});
        });

        this.client.on('message', msg => {
            if(msg.channel.type === "text") {
                if(!this.config.guilds.includes(msg.guild.id)) {
                    return;
                }
            }
            debug('message', msg.author.username, msg.content);
            this.handleDiscordMessage(msg);
        });


        return new Promise(() => {
            this.client.connect();
        });
    }

    getPayload(data): ThirdPartyPayload {
        let payload = <ThirdPartyPayload>{
            roomId: data.channel.id,
            senderId: undefined
        };

        if(data.author !== undefined) {
            payload.senderId = data.author.id;
            payload.senderName = data.author.username;
            payload.avatarUrl = data.author.avatarURL;
            if(payload.avatarUrl === null) {
                payload.avatarUrl = "https://vignette3.wikia.nocookie.net/drawntolife/images/f/f3/Discord_Link.png/revision/latest?cb=20160529154328";
            }
        }
        debug('payload', payload);
        return payload;
    }

    getUserData(id: string): Promise<UserData> {
        let user = this.client.getUser(id);
        let payload = <UserData> {
            name: id
        };
        if(user) {
            payload.name = user.username;
            payload.avatarUrl = user.avatarURL;
            if(payload.avatarUrl == null) {
                payload.avatarUrl = "https://vignette3.wikia.nocookie.net/drawntolife/images/f/f3/Discord_Link.png/revision/latest?cb=20160529154328";
            }
        }

        debug('getUserData', user.avatarURL, payload);

        return Promise.resolve(payload);
    }

    getRoomData(id: string): Promise<RoomData> {
        debug('fetching additional room data...');
        debug(id);
        let payload = {};
        let channel = this.client.findChannel(id);
        if(channel) {
            let topic = "No topic set";
            if(channel.type === "text") {
                if(channel.topic !== null)
                    topic = channel.topic;
            }

            let name = channel.type;
            if(channel.type == "text") {
                name = "[" + channel.guild.name + "] " + channel.name;
            } else if (channel.type === "dm") {
                name = undefined;
            }
            let avatarUrl = undefined;
            if(channel.type === "text") {
                avatarUrl = channel.guild.iconUrl;
            } else if (channel.type === "dm") {
                avatarUrl = channel.recipient.avatarURL;
            } // TODO: group icon

            if(avatarUrl === null) {
                debug('WHOA BABY THIS SHOULDNT HAPPEN ALERT', channel);
                avatarUrl = undefined;
            }
            return Promise.resolve(<RoomData> {
                name: name,
                topic: topic,
                isDirect: (channel.type === "dm"),
                avatarUrl: avatarUrl
            });
        }
    }

    handleDiscordMessage(msg) {
        let payload =  <ThirdPartyMessagePayload>this.getPayload(msg);
        payload.text = msg.content;
        if(msg.cleanContent !== undefined) {
          payload.text = msg.cleanContent;
        } else {
            // This will be true if this is from a 'sent' event.
            if(msg.sentraw.channel.type === "dm") {
                payload.senderName = msg.sentraw.channel.recipient.username;
                payload.avatarUrl = msg.sentraw.channel.recipient.avatarURL;
            }
        }
        if(msg.attachments !== undefined && msg.attachments.size > 0) {
            for(let attachment of msg.attachments) {
                payload.text += " " + attachment[1].url;
            }
        }
        return this.puppetBridge.sendMessage(payload);
    }

    sendMessage(roomid: string, text: string): Promise<void> {
        debug('sendMessage', roomid, text);
        return this.client.sendMessage(roomid, text);
    }
    sendImageMessage(roomid: string, image: any): Promise<void> {
        debug('sendImageMessage', roomid, image);
        return this.client.sendImageMessage(roomid, image);
    }
}
