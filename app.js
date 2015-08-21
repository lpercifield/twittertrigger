"use strict";
/**
 * Module dependencies.
 */
 //FROM THIS AWESOME TUTORIAL: http://blog.coolaj86.com/articles/how-to-tweet-from-nodejs.html
 //GITHUB FOR ORIGINAL FORK: https://github.com/coolaj86/node-twitter-demo

var express = require('express')
  , routes = require('./routes')
  , authCallback = require('./routes/auth-callback')
  , http = require('http')
  , path = require('path')
  , app = express()
  // server info
  , domain = "dontflushme.cloudapp.net"
  //, domain = "localhost"
  , port = process.env.PORT || 8080
  // passport / twitter stuff
  , config = require('./config')
  , passport = require('passport')
  , TwitterStrategy = require('passport-twitter').Strategy
  , twitterAuthn
  // poor man's database stub
  , user = {}
  // oauth / twitter stuff
  , OAuth= require('oauth').OAuth
  , moment = require('moment-timezone')
  , timebot = require('timebot')
  , NanoTimer = require('nanotimer')
  , oa
  ;
var MongoClient = require('mongodb').MongoClient
  , format = require('util').format
  ;
var BSON = require('mongodb').BSONPure;
var users;
var triggers;
var timezone = "America/New_York";
function initTwitterOauth() {
  oa = new OAuth(
    "https://twitter.com/oauth/request_token"
  , "https://twitter.com/oauth/access_token"
  , config.consumerKey
  , config.consumerSecret
  , "1.0A"
  , "http://" + domain + ":" + port + "/twitter/authn/callback"
  , "HMAC-SHA1"
  );
}

function makeTweet(token, tokenSecret,status,cb) {
  oa.post(
    "https://api.twitter.com/1.1/statuses/update.json"
  , token
  , tokenSecret
  , {"status": status }
  , cb
  );
}

function makeDm(sn, cb) {
  oa.post(
    "https://api.twitter.com/1.1/direct_messages/new.json"
  , user.token
  , user.tokenSecret
  , {"screen_name": sn, text: "test message via nodejs twitter api. pulled your sn at random, sorry."}
  , cb
  );
}

passport.serializeUser(function(_user, done) {
  done(null, user._id);
});

passport.deserializeUser(function(id, done) {
var o_id = new BSON.ObjectID(id );
users.findOne({'_id':o_id}, function(err, user) {
    console.log(user.triggers);
    done(err, user);
  });
});

twitterAuthn = new TwitterStrategy({
    consumerKey: config.consumerKey
  , consumerSecret: config.consumerSecret
  , callbackURL: "http://" + domain + ":" + port + "/twitter/authn/callback"
  },
  function(token, tokenSecret, profile, done) {
  users.findOne({tId : profile.id}, function(err, oldUser){
        if(oldUser){
        	console.log("OLD USER")
        	console.log(oldUser);
        	user = oldUser;
            done(null,user);
        }else{
            var newUser = {
                tId : profile.id ,
                token : token,
                tokenSecret : tokenSecret,
                username : profile.username,
                displayname : profile.displayName
            };
            users.save(newUser, function(err,newUser){
                if(err) throw err;
                console.log("NEW USER")
                user = newUser;
                done(null, user);
            });
        }
    });
/*
    user.token = token;
    user.tokenSecret = tokenSecret;
    user.profile = profile;
    console.log("ID AUTHN: "+profile.id);
    done(null, user);
*/
  }
);
twitterAuthn.name = 'twitterAuthn';

passport.use(twitterAuthn);
//passport.use(twitterAuthz);

// all environments
app.set('port', port);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
// Passport needs express/connect's cookieParser and session
app.use(express.cookieParser());
app.use(express.session({ secret: "blahhnsnhoaeunshtoe" }));
app.use(passport.initialize());
app.use(passport.session());
//  Passport MUST be initialize()d and session()d before the router
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' === app.get('env')) {
  app.use(express.errorHandler());

}
/*
var then = moment().tz("America/New_York").format('lll');
console.log("NOW: "+ then);
setInterval(function(){
	var newnow = moment().tz("America/New_York").format('lll');

	var now = moment(newnow);
	console.log(newnow);
	var secondsDiff = now.diff(then, 'seconds')
	console.log(secondsDiff);
}, 1000);
*/

app.get('/', routes.index);

app.get('/account',ensureAuthenticated, routes.account);

app.get('/twitter/authn', passport.authenticate('twitterAuthn'));
app.get(
  '/twitter/authn/callback'
, passport.authenticate(
    'twitterAuthn'
  , { failureRedirect: '/nfailure' }
  )
, function (req, res) {
    // TODO if a direct message fails, remove this and try again
    // the user may have unauthorized the app
    res.redirect('/account');
  }
);
/*
app.get('/twitter/tweet', function (req, res) {
  makeTweet(function (error, data) {
    if(error) {
      console.log(require('sys').inspect(error));
      res.end('bad stuff happened');
    } else {
      console.log(data);
      res.end('go check your tweets!');
    }
  });
});
app.get('/twitter/direct/:sn', function (req, res) {
  makeDm(req.params.sn, function (error, data) {
    if(error) {
      console.log(require('sys').inspect(error));
      res.end('bad stuff happened (dm)');
    } else {
      console.log(data);
      res.end("the message sent (but you can't see it!");
    }
  });
});
*/

app.get('/auth-callback', ensureAuthenticated, authCallback.index);
app.post('/auth-callback', ensureAuthenticated, authCallback.index);

app.post('/trigger', function(req,res){
  console.log(req.body.body);
  if (req){
    try{
        var a=JSON.parse(req.body.body);
        console.log("Got Trigger:" + a);
        res.send(200);
        searchForTrigger(a);
    }catch(e){
        //alert(e); //error in the above string(in this case,yes)!
        console.log(e);
        res.end(e.toString());

    }
  }
});

app.post('/account', ensureAuthenticated, function(req,res){
  //console.log(req.body.triggers);
  //console.log(req.user);
  var savetrigger = {}
  savetrigger = req.body.triggers;

  console.log(savetrigger);
  //savetrigger.userid = req.user._id;
  savetrigger.forEach(function(item){
    console.log("triggers: ");
    item.userid = req.user._id;
    console.log(item);
    triggers.save(item,function(err,obj){
      if(err){
        console.log("trigger save error: "+err);
      }else{
        item._id = obj._id;
      }
    });
  });
  req.user.triggers = savetrigger;
  //triggers.save(savetrigger);
  console.log(req.user);
  users.save(req.user, function(err,newUser){
                if(err) throw err;
                console.log("UPDATED USER")
                user = newUser;
                //res.redirect('/account');
                res.send(200);
                //done(null, user);
            });
});

initTwitterOauth();
http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
  MongoClient.connect('mongodb://nodejitsu:e9b7eded50641e676a0db4e44c9ae1df@dharma.mongohq.com:10053/nodejitsudb3007530041', function(err, db) {
    if(err) throw err;

    users = db.collection('triggertweet');
    triggers = db.collection('triggers');

  })
});

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/twitter/authn')
}
//This function is executed on the timer intervals
function tweetInterval(timer, id, dataStream){
	switch(timer.intervalCount){
		case 0:
			break;
		case 1:
			timerTweet(id,1,dataStream);
			break;
		case 2:
			timerTweet(id,2,dataStream);
			break;
		case 3:
			timerTweet(id,3,dataStream);
			timer.clearInterval();
			break;
		default:
	}

}

function timerTweet(id,time,dataStream){
	users.findOne({_id:id}, function(err,o){
		if(err !=null ){
      console.log("ERROR");
      console.log(err);
    }else{
    //console.log("FOUND OBJECT: "+JSON.stringify(o));
    console.log("DATASTREAM " + dataStream);
    console.log("TRIGGERS: " + o.triggers.toString());
    var tweetString;
    switch(time){
    	case 1:
    		tweetString = o.triggers[dataStream].twofourtweet;
    		break;
    	case 2:
    		tweetString = o.triggers[dataStream].foureighttweet;
    		break;
    	case 3:
    		tweetString = o.triggers[dataStream].seventwotweet;
    		break;
    }
    	var newnow = moment().tz("America/New_York").format('lll');
			makeTweet(o.token, o.tokenSecret, tweetString + " Updated: " + newnow, function (error, data) {
        if(error) {
          console.log(require('sys').inspect(error));
          //res.end('bad stuff happened');
        } else {
          console.log(data);
/*
          o.lastTweetTime = newnow;
          users.save(o, function(err,newUser){
            if(err) throw err;
            console.log("Tweet Time Saved")
            //done(null, user);
					});
*/
          //res.end('go check your tweets!');
        }
			});
    }
	})
}

//This function takes the post data from the trigger and looks to see if there is a matching twitter alert in the database
function searchForTrigger(obj){
  var tid = obj.environment.id.toString();
  var tds = obj.triggering_datastream.id.toString();
  console.log("Envodionment ID: "+tid+" DataStream ID: " + tds);
  users.findOne({'triggers.id':tid, 'triggers.datastream':tds}, function(err,o){
    if(err !=null ){
      console.log("ERROR");
      console.log(err);
    }else{
    	//var twitObject = JSON.parse(o);
    	console.log("FOUND OBJECT: "+JSON.stringify(o));
    	console.log("TRIGGERS: " + o.triggers.toString());
    	console.log("LENGTH "+o.triggers.length);
			for(var i=0; i<o.triggers.length; i++){
			//Envodionment ID: 44129 DataStream ID: 9 findOne({'triggers.id':44129, 'triggers.datastream':9})
				if(o.triggers[i].datastream == tds){
					//console.log("GOT IT " + JSON.stringify(o));
					//console.log(o.triggers[i].tweetstring);
					console.log("TIMER " + global[o._id.toString()]);
					var newnow = moment().tz("America/New_York").format('lll');
					var now = moment(newnow);
					var timeSinceLastTweet = now.diff(o.lastTweetTime,"seconds");
					var dataStreamNum = i;
					console.log("TIME SINCE LAST TWEET" + timeSinceLastTweet);
					if(global[o._id.toString()] != null){
						global[o._id.toString()].clearInterval();
					}
					if(timeSinceLastTweet<43200){ // CHANGE THIS BACK TO 43200 - 12 hours
						console.log("NOT LONG ENOUGH!!");

						makeTweet(o.token, o.tokenSecret, o.triggers[i].stillovertweet + " Updated: " + newnow, function (error, data) {
			        if(error) {
			          console.log(require('sys').inspect(error));
			          //res.end('bad stuff happened');
			        } else {
			          console.log(data);
			          o.lastTweetTime = newnow;
			          users.save(o, function(err,newUser){
	                if(err) throw err;
	                console.log("Tweet Time Saved")
	                //done(null, user);
								});
								var timerObject = o._id.toString();
								global[timerObject] = new NanoTimer();
								global[timerObject].setInterval(tweetInterval, [global[timerObject],o._id,dataStreamNum], '86400s');
								//create timers for this tweet object 24hrs 28hrs 72hrs
			          //res.end('go check your tweets!');
			        }
						});

					}else{

						makeTweet(o.token, o.tokenSecret, o.triggers[i].tweetstring + " Updated: " + newnow, function (error, data) {
			        if(error) {
			          console.log(require('sys').inspect(error));
			          //res.end('bad stuff happened');
			        } else {
			          console.log(data);
			          o.lastTweetTime = newnow;
			          users.save(o, function(err,newUser){
	                if(err) throw err;
	                console.log("Tweet Time Saved")
	                //done(null, user);
								});
								var timerObject = o._id.toString();
								global[timerObject] = new NanoTimer();
								global[timerObject].setInterval(tweetInterval, [global[timerObject],o._id,dataStreamNum], '86400s');// 86400s = 24 hours
								//create timers for this tweet object 24hrs 28hrs 72hrs
			          //res.end('go check your tweets!');
			        }
						});
					}
				}
			}
    }
  });
}
