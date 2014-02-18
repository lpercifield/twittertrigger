/*
 * GET account page.
 */

exports.account = function(req, res){
  res.render('account', { title: 'Xively Twitter Triggers' });
};