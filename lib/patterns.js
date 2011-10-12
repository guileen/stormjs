function Parallel(counter, done) {
  return function () {
    counter--;
    if (counter <= 0) {
      done();
    }
  };
};

var Pile = function() {
   this.pile = [];
   this.concurrency = 0;
   this.has_done = null;
   this.done = function(){
     if(this.ready){
       this.done()
     }
   };
   this.max_concurrency = 10;
}
Pile.prototype = {
  add: function(callback) {
   this.pile.push(callback);
  },

  run: function(done, max_concurrency) {
    var target = this.pile.length;
    var that = this;
    var next = function() {
      that.concurrency--;
      (--target == 0 ? that.done() : that.run());
    };
    while(this.concurrency < this.max_concurrency && this.pile.length > 0) {
      this.concurrency++;
      var callback = this.pile.shift();
      callback(next);
    }
  },

  callback: function(done){

  }

};

exports.Parallel = Parallel;
