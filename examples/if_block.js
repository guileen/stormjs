var a = 'a';
if (foo(_)) {
  a = bar(_);
}
console.log(a);

var b = 'b';

if(foo(_)) {
  b = bar(_);
} else {
  b = bar();
}

b = bar(b, _);
console.log(b);
