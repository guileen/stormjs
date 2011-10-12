function fooAsync(a){
  if(!a)
    throw new Error('must specify arg a')
  return fooAsync(fooAsync())['xx'];
}

foo('test', function(err, data){
    doSomething(data);
});
