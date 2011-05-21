var a = 0, b = 0, c;

for (var i = 0; i < 100; i++) {
  a = foo(a, _);
}

for (var i = 0, j = 0; i < 100; i++, b+=1) {
  b = foo(b, j, _);
  j = bar(j);
}

console.log(b);

for (var i = 0; i < 100; i++) {
  c = foo(a, b, c, _);
}

