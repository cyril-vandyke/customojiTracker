var slack = require('slack');

var clientId = "";
var clientSecret = "";
var verificationToken = "";
var store = {};
var storeVersion = 1;

module.exports = function (context, callback) {
    console.log("Endpoint Hit\n");
    LoadStorage(context, (error) =>
    {
       if(error)
        {
            console.log(error);
            callback(error);
        } else {
            console.log("Endpoint Hit\n");
            ResponseHandler(context,callback); 
        }
    }); 
}

function LoadStorage(context, initCallback)
{
    SetSecrets(context.secrets);
    context.storage.get((error, data) =>{
    if(error){
      initCallback(error);
    }
    else{
      if( data && data.version && data.version == storeVersion){
        store = data;
        initCallback(null);
      } else{
        store = {
          version: storeVersion,
          teams: []
        };
        context.storage.set(store, (error) =>{
          if(error) initCallback(error);
        });
      }
    }
  });
}

function SetSecrets(secrets)
{
    clientId = secrets.clientId;
    clientSecret = secrets.clientSecret;
    verificationToken = secrets.verificationToken;
}

function ResponseHandler(context,initCallback){
    if(context.body){
        console.log("Slack Message Recieved");
        console.log(context.body);
        switch(context.body.type)
            {
                case "url_verification":
                    console.log("URL Verification Received");
                    callback(null, {challenge: context.body.challenge}); 
                    break;
                case "event_callback":
                    console.log("Event Callback Received");
                    SlackEventHandler(context, initCallback);
                    break;
                default:
                    callback(null, "no challenge received, stop hitting my endpoint directly.");
            }
    } else if (context.query.command){
        console.log("Query Command Received");
        switch(context.query.command)
        {
            case "auth":
                SetAuthToken(context,initCallback);
                break;
            case "debug":
                console.log("ToDo: Create Debugging lmao. For now here's storage.");
                console.log("There are currently " + store.teams.length + " teams subscribed.");
                console.log(store);

                // store.teams[0].SubList = [];
                // context.storage.set(store, (error) =>{
                // if(error) initCallback(error);
                // });

                initCallback(null);
                break;
            default:
                console.log("Query Command Not Recognized");
                initCallback(null);
        }
    }
}

function SetAuthToken(context, initCallback)
{
    var code = context.query.code;
  
    console.log("ClientId: " + clientId);
    slack.oauth.access(
    {
      client_id: clientId,
      client_secret: clientSecret,
      code: code
    }, 
    (error, data) => { 
      if(error){
        initCallback(error);
      } else {
        if(data.bot){
            console.log("Entering New Team Auth Construction.")
            //Construct New Team Info
            var newTeamInfo = {
            TeamId: data.team_id,
            BotUserId: data.bot.bot_user_id,
            AccessToken: data.access_token,
            SubList: [],
            };
            
            //Replace or Add new Team to Storage
            if(GetTeamInfo(data.team_id) !== null){
                ReplaceTeamInfo(data.team_id, newTeamInfo);
            } else {
            store.teams.push(newTeamInfo);
            }                    
            context.storage.set(store, (error) =>{
            if(error) initCallback(error);
            });
        }
        initCallback(null, {});
      }
    })
}

function GetTeamInfo(teamId) {
  console.log("Entering GetTeamInfo");
  for (var i = 0; i < store.teams.length; i++) {
      if( store.teams[i].TeamId == teamId ){
        return store.teams[i];
      }
  }
  return null;
}

function ReplaceTeamInfo(teamId, newTeamInfo) {
    console.log("Entering ReplaceTeamInfo");
  for (var i = 0; i < store.teams.length; i++) {
    if( store.teams[i].TeamId == teamId ){
      store.teams[i] = newTeamInfo;
    }
  }
}


function SlackEventHandler(context, initCallback)
{
    var teamInfo = GetTeamInfo(context.body.team_id);
    switch(context.body.event.type)
    {
        case "message":
            MessageHandler(context, teamInfo);
            break;
        case "emoji_changed":
            console.log("Entering Emoji Handling");
            EmojiTypeHandler(context, teamInfo);
            break;
    }
    initCallback(null,{});
}

function EmojiTypeHandler(context, teamInfo)
{
    switch(context.body.event.subtype)
    {
        case "add":
            console.log(context.body.event.value);
            var emojiValue = context.body.event.value;
            var emojiName = context.body.event.name;
            if(!emojiValue.includes('alias:')){
                EmojiAdditionNotification(emojiName, teamInfo);
            }else{
                EmojiAliasNotification(emojiName, emojiValue, teamInfo);
            }
            break;
        case "remove":
            EmojiRemovalNotification(context.body.event.names, teamInfo);
            break;
    }
}

function EmojiAdditionNotification(emojiName, teamInfo)
{
    slack.chat.postMessage({
        token: teamInfo.AccessToken,
        channel:'C67MV6D88' ,
        text: "A new emoji named `" + emojiName + "` has been added!"}, (err,data)=>{});
    slack.chat.postMessage({
        token: teamInfo.AccessToken,
        channel: 'C67MV6D88',
        text: ":" +  emojiName + ":"}, (err,data)=>{});
}

function EmojiAliasNotification(emojiName, emojiValue, teamInfo)
{
    var emojiOriginalName = emojiValue.split(':')[1];
    slack.chat.postMessage({
        token: teamInfo.AccessToken,
        channel:'C67MV6D88' ,
        text: "Existing emoji `" + emojiOriginalName + "` has been aliased as `" + emojiName + "`!"}, (err,data)=>{});
    slack.chat.postMessage({
        token: teamInfo.AccessToken,
        channel: 'C67MV6D88',
        text: ":" +  emojiName + ":"}, (err,data)=>{});
}

function EmojiRemovalNotification(emojiNames, teamInfo)
{
    console.log(emojiNames);
    slack.chat.postMessage({
        token: teamInfo.AccessToken,
        channel:'C67MV6D88' ,
        text: "`" + emojiNames[0] + "` has been deleted, goodnight sweet prince."}, (err,data)=>{
            console.log("EmojiNames.Length is " + emojiNames.length);
            if(emojiNames.length > 1)
            {
                var secondMessage = "It was also known as:";
                foreach(emojiName in emojiNames.shift())
                {
                    secondMessage = secondMessage + "`" + emojiName + "` \n";
                }
                slack.chat.postMessage({
                    token: teamInfo.AccessToken,
                    channel: 'C67MV6D88',
                    text: secondMessage}, (err,data)=>{});
            }
        }); 
}

function MessageHandler(context, teamInfo)
{
    console.log("Message Found");
    var message = context.body.event.text;
    var messageComponents = message.split(" ");
    if(messageComponents[0].toLowerCase() == "!ct")
        {
            BotCommandHandler(messageComponents, teamInfo, context);
        }
}

function BotCommandHandler(messageComponents, teamInfo, context)
{
    switch(messageComponents[1].toLowerCase())
    {
        case "help":
            HelpMessageResponse(teamInfo, context);
            break;
        case "test":
            TestMessageResponse(teamInfo, context);
            break;
        case "register":
            RegistrationHandler(teamInfo, context, 1);
            break;
        case "unregister":
            RegistrationHandler(teamInfo, context, 0);
            break;
        default:
            UnrecognizedCommandHandler(teamInfo, context);
    }
}

function HelpMessageResponse(teamInfo, context)
{
   slack.chat.postMessage({
        token: teamInfo.AccessToken,
        channel: context.body.event.channel,
        text: "Help message coming soon :^)"}, (err,data) =>{}
    );
}

function TestMessageResponse(teamInfo, context)
{
    slack.users.info({
        token:teamInfo.AccessToken,
        user:context.body.event.user}, (err,data) => 
            {
                if(err)
                {
                    console.log(err);
                } else {
                    console.log(data);
                    var firstName = data.user.profile.first_name;
                    slack.chat.postMessage({
                        token: teamInfo.AccessToken,
                        channel: context.body.event.channel,
                        text: "Hello, " + firstName}, (err,data) =>{}
                    );
                    }
            }
    );
}

function RegistrationHandler(teamInfo, context, actionBit)
{
    var teamStoreId = DetermineTeamStoreId(teamInfo);
    if(actionBit == 1)
    {
        //ok we're registering someone
        if(RegisterNewChannel(teamInfo, teamStoreId, context))
        {
            slack.chat.postMessage({
                        token: teamInfo.AccessToken,
                        channel: context.body.event.channel,
                        text: "Channel/IM Registered Successfully!"}, (err,data) =>{}
                    );
        } else{
            slack.chat.postMessage({
                        token: teamInfo.AccessToken,
                        channel: context.body.event.channel,
                        text: "Channel/IM Already Registered."}, (err,data) =>{}
                    );
        }
    }
}

function DetermineTeamStoreId(teamInfo)
{
  for (var i = 0; i < store.teams.length; i++) {
      if( store.teams[i].TeamId == teamInfo.TeamId ){
        return i;
      }
  }
}

function RegisterNewChannel(teamInfo, teamStoreId, context)
{
    var duplicateSubscription = false;
    if(store.teams[teamStoreId].SubList.length == 0)
    {
        // ok first time, just add.
        store.teams[teamStoreId].SubList.push(String(context.body.event.channel));
        context.storage.set(store, (error) =>{
            if(error) initCallback(error);
            });
        return true;
    }
    else {
        for(var j = 0; j < store.teams.SubList.length; j++)
        {
            if(store.teams.SubList[j] == String(context.body.event.channel))
            {
                duplicateSubscription = true;
            }
        }
    }
    if(duplicateSubscription)
    {
        return false;
    } else {
       store.teams[teamStoreId].SubList.push(String(context.body.event.channel));
        context.storage.set(store, (error) =>{
            if(error) initCallback(error);
            });
        return true; 
    }
}

function UnrecognizedCommandHandler(teamInfo,context)
{
    var helpString = "Sorry, I don't recognize that command.\nTry `!ct help` for a list of CustomojiTracker commands.";
    slack.chat.postMessage({
        token: teamInfo.AccessToken,
        channel: context.body.event.channel,
        text: helpString}, (err,data) =>{}
    );
}
// ToDo:
//     -Add oath storage for one team.
//     -Add subscription-model for emojis. 
//     -Remove chatting
//     -Add channel-subscription?

