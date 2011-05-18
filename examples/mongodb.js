var mongodb = require('mongodb');
var db = new mongodb.Db('test', new mongodb.Server('localhost', 27017));

db = db.open(_);

var User = db.collection('user', _);
var Blog = db.collection('blog', _);
var Tag = db.collection('tag', _);

app.get('/', function(req, res){
  var user = User.find({_id: user_id}, _).toArray(_)[0];
  var blog = Blog.find({user: user}, _).toArray(_);
  var tags = Tag.find({}, _).toArray(_);
  res.render('index.jade', {
      user: user,
      blog: blog,
      tags: tags
  });
})
