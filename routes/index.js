
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Xively Twitter Triggers' });
};

exports.account = function(req, res){
  console.log('auth-callback,user', req.user);
  res.render('account', { user: JSON.stringify(req.user), title: 'Xively Twitter Triggers'  });
};