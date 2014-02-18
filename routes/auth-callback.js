
/*
 * GET auth window.
 */
exports.index = function(req, res){
  console.log('auth-callback,user', req.user);
  res.render('account', { user: JSON.stringify(req.user), title: 'Xively Twitter Triggers'  });
};
